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
  generateMarketingDoc,
} from "#/ai/generate";
import { composeContactData } from "#/ai/contactData";
import { composeBookSnapshot } from "#/ai/bookSnapshot";
import { useListingsFilter } from "#/routes/_shell/listings/-useListingsFilter";
import { useCallListView } from "#/routes/_shell/backoffice/contacts/-useCallListView";
import type { ResultNav } from "#/ai/resultNav";
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
import { callFlow } from "#/components/call/callFlow";
import {
  getClientReportKpis,
  buildActivitySummaryText,
} from "#/data/listingClientReport";
import { buildingSectionListingId } from "#/components/deals/dealCardLink";
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
  buildMarketingPackageDef,
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
 * Used by the `build_call_list` agent tool to feed the ranker.
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
 * Keep a model-composed deal path off a space's page. A space has no page of
 * its own: its terms live on its building's Spaces roster and its voucher
 * behind the building's Vouchers section. `navigateTo` takes the path from the
 * model, which composes it from an id it looked up (see `navigateToDef`), so
 * there is no link to fix — the correction has to happen on the way out.
 *
 *   /listings/{space}           → /listings/{building}/spaces?space={space}
 *   /listings/{space}/{section} → /listings/{building}/{section}
 *
 * Anything else passes through untouched: another route, a path already
 * carrying a query or hash, an unknown id, or a building.
 *
 * The `?space=` rides along inside the path string because the injected
 * `navigate` takes a pathname; the router splits the query off when it commits
 * the location.
 */
export function rewriteSpaceDealPath(path: string): string {
  const match = /^\/listings\/([^/?#]+)(\/[^?#]*)?$/.exec(path);
  if (!match) return path;
  const [, listingId, section] = match;
  const buildingId = getListing(listingId)?.parentDealId;
  if (!buildingId) return path;
  if (!section || section === "/") {
    return `/listings/${buildingId}/spaces?space=${listingId}`;
  }
  return `/listings/${buildingId}${section}`;
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
      const navs: ResultNav[] = [];
      if (r.properties.length)
        navs.push({
          entity: "properties",
          count: r.properties.length,
          summary: `${r.properties.length} ${r.properties.length === 1 ? "property" : "properties"} matching “${query}”`,
          listingsFacets: { search: query },
        });
      if (r.deals.length)
        navs.push({
          entity: "deals",
          count: r.deals.length,
          summary: `${r.deals.length} deal${r.deals.length === 1 ? "" : "s"} matching “${query}”`,
          listingsFacets: { search: query },
        });
      if (r.contacts.length)
        navs.push({
          entity: "contacts",
          count: r.contacts.length,
          summary: `${r.contacts.length} contact${r.contacts.length === 1 ? "" : "s"} matching “${query}”`,
          contactsFilter: { search: query },
        });
      return {
        properties: r.properties.slice(0, 8).map(propertySummary),
        deals: r.deals.slice(0, 8).map(dealSummary),
        contacts: r.contacts.slice(0, 8).map(contactSummary),
        navs,
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
      const desc = [status?.replace(/-/g, " "), dealType].filter(Boolean).join(" ");
      const navs: ResultNav[] = rows.length
        ? [
            {
              entity: "deals",
              count: rows.length,
              summary: `${rows.length} ${desc ? `${desc} ` : ""}deal${rows.length === 1 ? "" : "s"}`,
              listingsFacets: {
                statuses: status ? [status] : undefined,
                dealType: dealType as "Sale" | "Lease" | undefined,
              },
            },
          ]
        : [];
      return {
        total: rows.length,
        deals: rows.slice(0, limit ?? 50).map(dealSummary),
        navs,
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
      const desc = [relationship, role].filter(Boolean).join(" ");
      const navs: ResultNav[] = rows.length
        ? [
            {
              entity: "contacts",
              count: rows.length,
              summary: `${rows.length} ${desc ? `${desc} ` : ""}contact${rows.length === 1 ? "" : "s"}${tag ? ` tagged ${tag}` : ""}`,
              contactsFilter: { relationship, tag },
            },
          ]
        : [];
      return {
        total: rows.length,
        contacts: rows.slice(0, limit ?? 50).map(contactSummary),
        navs,
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
      // Open the new list on the People page in the order it was built (this
      // tool doesn't rank, so the given contactId order is the display order),
      // matching build_call_list so any "make me a call list" lands the broker
      // on the list itself — not just adds it to the sidebar.
      useCallListView.getState().activate({
        listId: callList.id,
        rankedContactIds: contactIds,
      });
      navigate("/backoffice/contacts");
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
        // The client report is a building-level section, and the id came from
        // the model — a space resolves to the building that owns the report.
        reportPath: `/listings/${buildingSectionListingId(listingId)}/client-report`,
      };
    }),

    navigateToDef.client(async (args) => {
      const { path } = args as { path: string };
      // The model builds this path itself, so a space id can arrive in it —
      // see `rewriteSpaceDealPath` for why that has to be corrected here.
      const to = rewriteSpaceDealPath(path);
      navigate(to);
      return { navigatedTo: to };
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
      // Open the freshly-built list on the People page in AI-ranked order — the
      // same result the old on-page "Build call list with AI" button gave.
      useCallListView.getState().activate({
        listId: callList.id,
        rankedContactIds: ranked.calls.map((c) => c.contactId),
      });
      navigate("/backoffice/contacts");
      return {
        callListId: callList.id,
        headline: ranked.headline,
        count: ranked.calls.length,
      };
    }),

    buildMarketingPackageDef.client(async (args) => {
      const { address, owner_name, asset_type, asking_price, notes } = args as {
        address: string;
        owner_name?: string;
        asset_type?: string;
        asking_price?: number;
        notes?: string;
      };
      const property = {
        name: address,
        address,
        assetType: asset_type,
        askingPrice: asking_price,
        owner: owner_name,
        notes,
      };
      const [doc, email] = await Promise.all([
        generateMarketingDoc({ data: { property, docType: "marketing_flyer" } }),
        generateEmail({
          data: { property, intent: `Launch marketing for ${address}`, recipients: [] },
        }),
      ]);
      return {
        package: {
          doc,
          email,
          financials: { askingPrice: asking_price ?? null, assetType: asset_type ?? null },
        },
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
      const { contact_name } = args as { contact_name: string };
      const c = resolveContactByName(contact_name);
      if (!c) return { started: false, error: `No contact named "${contact_name}".` };
      callFlow.open(c);
      // Land the broker on the contact's page so the call bar + arc play out
      // over their record (mirrors the homepage "Call Rosa" CTA).
      navigate(`/backoffice/contacts/${c.id}`);
      return { started: true, contactId: c.id };
    }),
  ];
}
