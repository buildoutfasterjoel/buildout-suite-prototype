import type { AnyClientTool } from "@tanstack/ai";
import type { Contact, Listing, Property, PropertyStatus } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import {
  generateFilter,
  generateEmail,
  generateCallList,
  generateContactBrief,
  generateStrategy,
} from "#/ai/generate";
import { composeContactData } from "#/ai/contactData";
import { composeBookSnapshot } from "#/ai/bookSnapshot";
import { useListingsFilter } from "#/routes/_shell/listings/-useListingsFilter";
import {
  searchAll,
  getContactDetailClient,
  listDealsForContact,
  listDealsForProperty,
  listContactsForDeal,
} from "#/data/selectors";
import {
  createDeal,
  updateDealStage,
  linkContactToDeal,
  createEmailDraft,
  createCallList,
  addNote,
  createTask,
} from "#/data/actions";
import { parseDueDate } from "#/ai/dueDate";
import { buildAssistantContext } from "#/ai/context";
import { emptyDraft } from "#/data/createListing";
import {
  getClientReportKpis,
  buildActivitySummaryText,
} from "#/data/listingClientReport";
import {
  searchAllDef,
  listDealsDef,
  listContactsDef,
  getContactDetailDef,
  listDealsForContactDef,
  listDealsForPropertyDef,
  listContactsForDealDef,
  getPropertyDef,
  getListingDef,
  createDealDef,
  updateDealStageDef,
  linkContactToDealDef,
  createEmailDraftDef,
  createCallListDef,
  generateDocDef,
  filterListingsDef,
  draftEmailDef,
  buildCallListDef,
  researchContactDef,
  answerAboutContactDef,
  analyzeBookDef,
  navigateToDef,
  addNoteDef,
  createTaskDef,
  findContactDef,
  planMyDayDef,
  startCallDef,
} from "./toolDefs";

// ── Compact summaries — keep tool results small for the model ────────────────

const contactSummary = (c: Contact) => ({
  id: c.id,
  name: `${c.firstName} ${c.lastName}`.trim(),
  company: c.company,
  relationship: c.relationship,
  role: c.role,
  email: c.email,
  phone: c.phone,
});

const dealSummary = (l: Listing) => {
  const p = getProperty(l.propertyId);
  return {
    id: l.id,
    name: l.name,
    status: l.status,
    dealType: l.dealType,
    city: p?.city ?? "",
    state: p?.state ?? "",
    askingPrice: l.financials.askingPrice,
  };
};

/**
 * Build the `generateCallList` contact pool: excludes do-not-call contacts and
 * strips each contact down to the recency/relationship fields the ranker needs.
 * Shared by the `build_call_list` agent tool and the People grid's "Build call
 * list with AI" button (`src/routes/_shell/backoffice/contacts/index.tsx`) so
 * both stay in lockstep on the do-not-call rule.
 */
export const contactCallPool = (
  contacts: Contact[],
): Array<{ id: string; lastContactedAt: string | null; relationship: string }> =>
  contacts
    .filter((c) => !c.doNotCall)
    .map((c) => ({ id: c.id, lastContactedAt: c.lastContactedAt, relationship: c.relationship }));

/** Shared with the "Draft with AI" in-context button (`ListingEmail.tsx`). */
export const propertySummary = (p: Property) => ({
  id: p.id,
  address: [p.street, p.city, p.state].filter(Boolean).join(", "),
  propertyType: p.propertyType,
  subtype: p.propertySubtype,
  buildingSqFt: p.buildingSqFt,
  askingPrice: p.askingPrice,
  capRate: p.capRate,
});

/**
 * Resolve a plain-English name to a contact: exact full-name match first,
 * falling back to a substring match. Used by the Phase-1 client tools
 * (`add_note`, `create_task`, `start_call`) that take a `contact_name`
 * argument instead of a resolved id.
 */
export function resolveContactByName(name: string): Contact | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const contacts = [...useDataStore.getState().contacts.values()];
  return (
    contacts.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === q) ??
    contacts.find((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)) ??
    null
  );
}

/**
 * Build the browser-executed client tools, matched by name to the shared
 * definitions in `toolDefs.ts`. `navigate` is injected from the sidebar (which
 * holds the router). Each `execute` runs against the live Zustand store.
 */
export function createClientTools({
  navigate,
}: {
  navigate: (path: string) => void;
}): AnyClientTool[] {
  return [
    searchAllDef.client(async (args) => {
      const { query } = args as { query: string };
      const r = searchAll(query);
      return {
        properties: r.properties.slice(0, 8).map(propertySummary),
        deals: r.deals.slice(0, 8).map(dealSummary),
        contacts: r.contacts.slice(0, 8).map(contactSummary),
      };
    }),

    listDealsDef.client(async (args) => {
      const { status, dealType, limit } = args as {
        status?: PropertyStatus;
        dealType?: string;
        limit?: number;
      };
      let rows = [...useDataStore.getState().listings.values()];
      if (status) rows = rows.filter((l) => l.status === status);
      if (dealType) rows = rows.filter((l) => l.dealType === dealType);
      return {
        total: rows.length,
        deals: rows.slice(0, limit ?? 50).map(dealSummary),
      };
    }),

    listContactsDef.client(async (args) => {
      const { relationship, role, tag, limit } = args as {
        relationship?: string;
        role?: string;
        tag?: string;
        limit?: number;
      };
      let rows = [...useDataStore.getState().contacts.values()];
      if (relationship) rows = rows.filter((c) => c.relationship === relationship);
      if (role) rows = rows.filter((c) => c.role === role);
      if (tag) rows = rows.filter((c) => c.tags.includes(tag));
      return {
        total: rows.length,
        contacts: rows.slice(0, limit ?? 50).map(contactSummary),
      };
    }),

    getContactDetailDef.client(async (args) => {
      const { contactId } = args as { contactId: string };
      const detail = getContactDetailClient(contactId);
      if (!detail) return { error: "Contact not found" };
      return {
        contact: contactSummary(detail.contact),
        deals: detail.deals.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          dealType: d.dealType,
        })),
        openTaskCount: detail.openTaskCount,
      };
    }),

    listDealsForContactDef.client(async (args) => {
      const { contactId } = args as { contactId: string };
      return { deals: listDealsForContact(contactId).map(dealSummary) };
    }),

    listDealsForPropertyDef.client(async (args) => {
      const { propertyId } = args as { propertyId: string };
      return { deals: listDealsForProperty(propertyId).map(dealSummary) };
    }),

    listContactsForDealDef.client(async (args) => {
      const { dealId } = args as { dealId: string };
      return { contacts: listContactsForDeal(dealId).map(contactSummary) };
    }),

    getPropertyDef.client(async (args) => {
      const { propertyId } = args as { propertyId: string };
      const p = getProperty(propertyId);
      return p ? { property: propertySummary(p) } : { error: "Property not found" };
    }),

    getListingDef.client(async (args) => {
      const { listingId } = args as { listingId: string };
      const l = getListing(listingId);
      return l ? { listing: dealSummary(l) } : { error: "Listing not found" };
    }),

    createDealDef.client(async (args) => {
      const { name, address } = args as { name?: string; address: string };
      const { deal } = createDeal({
        ...emptyDraft(),
        name: name ?? address,
        address,
      });
      return { deal: dealSummary(deal) };
    }),

    updateDealStageDef.client(async (args) => {
      const { dealId, status } = args as { dealId: string; status: PropertyStatus };
      const { deal } = updateDealStage(dealId, status);
      return deal ? { deal: dealSummary(deal) } : { error: "Deal not found" };
    }),

    linkContactToDealDef.client(async (args) => {
      const { dealId, contactId, role } = args as {
        dealId: string;
        contactId: string;
        role: "seller" | "buyer" | "other";
      };
      const { deal } = linkContactToDeal(dealId, contactId, role);
      return deal
        ? { deal: dealSummary(deal), linked: contactId, role }
        : { error: "Deal not found" };
    }),

    createEmailDraftDef.client(async (args) => {
      const { subject, list, primaryBroker } = args as {
        subject: string;
        list?: string;
        primaryBroker?: string;
      };
      const { email } = createEmailDraft({ subject, list, primaryBroker });
      return {
        email: { id: email.id, subject: email.subject, status: email.status, list: email.list },
      };
    }),

    createCallListDef.client(async (args) => {
      const { name, contactIds, description } = args as {
        name: string;
        contactIds: string[];
        description?: string;
      };
      const { callList } = createCallList({
        name,
        contactIds,
        description,
        source: "ai",
      });
      return {
        callList: { id: callList.id, name: callList.label, count: callList.contactIds.length },
      };
    }),

    generateDocDef.client(async (args) => {
      const { listingId } = args as { listingId: string };
      const listing = getListing(listingId);
      if (!listing) return { error: "Listing not found" };
      const property = getProperty(listing.propertyId);
      if (!property) return { error: "Property not found" };
      const kpis = getClientReportKpis(property);
      return {
        summary: buildActivitySummaryText(listing.name, kpis),
        kpis,
        reportPath: `/listings/${listingId}/client-report`,
      };
    }),

    navigateToDef.client(async (args) => {
      const { path } = args as { path: string };
      navigate(path);
      return { navigatedTo: path };
    }),

    filterListingsDef.client(async (args) => {
      const { query } = args as { query: string };
      const spec = await generateFilter({ data: { query } });
      useListingsFilter.getState().apply(spec);
      navigate("/listings");
      return { explanation: spec.explanation };
    }),

    draftEmailDef.client(async (args) => {
      const { propertyId, listingId, intent } = args as {
        propertyId?: string;
        listingId?: string;
        intent: string;
      };
      const listing = listingId ? getListing(listingId) : undefined;
      const property = propertyId
        ? getProperty(propertyId)
        : listing
          ? getProperty(listing.propertyId)
          : undefined;
      const propPayload = property
        ? propertySummary(property)
        : { name: listing?.name ?? "the property" };
      const draft = await generateEmail({ data: { property: propPayload, intent, recipients: [] } });
      const { email } = createEmailDraft({ subject: draft.subject });
      return { emailDraft: { ...draft, id: email.id } };
    }),

    buildCallListDef.client(async (args) => {
      const { intent } = args as { intent?: string };
      const pool = contactCallPool([...useDataStore.getState().contacts.values()]);
      const ranked = await generateCallList({ data: { intent, contacts: pool } });
      const { callList } = createCallList({
        name: intent ? `AI: ${intent}` : "AI call list",
        contactIds: ranked.calls.map((c) => c.contactId),
        description: ranked.headline,
        source: "ai",
      });
      const byId = new Map(
        [...useDataStore.getState().contacts.values()].map((c) => [c.id, c]),
      );
      return {
        callListId: callList.id,
        headline: ranked.headline,
        contacts: ranked.calls.map((c) => {
          const ct = byId.get(c.contactId);
          return {
            id: c.contactId,
            name: ct ? `${ct.firstName} ${ct.lastName}`.trim() : c.contactId,
            relationship: ct?.relationship,
            company: ct?.company,
            score: c.score,
            reason: c.reason,
          };
        }),
      };
    }),

    researchContactDef.client(async (args) => {
      const { contactId } = args as { contactId: string };
      const detail = getContactDetailClient(contactId);
      if (!detail) return { error: "Contact not found" };
      const name = `${detail.contact.firstName} ${detail.contact.lastName}`.trim();
      const { brief } = await generateContactBrief({
        data: { data: composeContactData(contactId), name },
      });
      return { brief, contactName: name };
    }),

    answerAboutContactDef.client(async (args) => {
      const { contactId, question } = args as { contactId: string; question: string };
      const detail = getContactDetailClient(contactId);
      if (!detail) return { error: "Contact not found" };
      const name = `${detail.contact.firstName} ${detail.contact.lastName}`.trim();
      const { brief } = await generateContactBrief({
        data: { data: composeContactData(contactId), name, question },
      });
      return { brief, contactName: name };
    }),

    analyzeBookDef.client(async (args) => {
      const { question } = args as { question: string };
      const { answer } = await generateStrategy({ data: { book: composeBookSnapshot(), question } });
      return { answer };
    }),

    addNoteDef.client(async (args) => {
      const { contact_name, note_text } = args as { contact_name: string; note_text: string };
      const c = resolveContactByName(contact_name);
      if (!c) return { error: `No contact named "${contact_name}".` };
      addNote(c.id, note_text);
      return { noted: true, contactId: c.id, contactName: `${c.firstName} ${c.lastName}`.trim() };
    }),

    createTaskDef.client(async (args) => {
      const { task_title, contact_name, due } = args as {
        task_title: string;
        contact_name?: string;
        due?: string;
      };
      const c = contact_name ? resolveContactByName(contact_name) : null;
      const { task } = createTask({
        name: task_title,
        dueDate: due ? parseDueDate(due) : null,
        contactId: c?.id ?? null,
        source: "contact",
      });
      return {
        taskId: task.id,
        title: task.name,
        due: task.dueDate,
        contactName: c ? `${c.firstName} ${c.lastName}`.trim() : null,
      };
    }),

    findContactDef.client(async (args) => {
      const { query } = args as { query: string };
      return { contacts: searchAll(query).contacts.slice(0, 6).map(contactSummary) };
    }),

    planMyDayDef.client(async () => {
      const ctx = buildAssistantContext();
      const headline =
        ctx.tasks.overdue > 0
          ? `You have ${ctx.tasks.overdue} overdue task${ctx.tasks.overdue === 1 ? "" : "s"} — clear those first.`
          : ctx.tasks.dueToday > 0
            ? `${ctx.tasks.dueToday} task${ctx.tasks.dueToday === 1 ? "" : "s"} due today. Start at the top of your list.`
            : "Nothing overdue — good time to prospect. Want me to build a call list?";
      return { headline, action: "Open tasks" };
    }),

    startCallDef.client(async (args) => {
      // Phase 1 stub: announce + navigate. Full live-call flow lands in Phase 3.
      const { contact_name } = args as { contact_name: string };
      const c = resolveContactByName(contact_name);
      if (!c) return { started: false, error: `No contact named "${contact_name}".` };
      navigate(`/backoffice/contacts/${c.id}`);
      return { started: true, contactId: c.id, note: "Call flow arrives in Phase 3." };
    }),
  ];
}
