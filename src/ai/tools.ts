import type { AnyClientTool } from "@tanstack/ai";
import type { Contact, Listing, Property, PropertyStatus } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getContact, getListing, getProperty } from "#/data/store";
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
  createContact,
} from "#/data/actions";
import { buildDayPlan, emptyDayPlanHeadline } from "#/ai/dayPlan";
import { parseDueDate } from "#/ai/dueDate";
import { buildAssistantContext } from "#/ai/context";
import { emptyDraft } from "#/data/createListing";
import { callFlow } from "#/components/call/callFlow";
import { useComposeFocus } from "#/components/contacts/useComposeFocus";
import {
  requestComposerSend,
  getPendingEmail,
  setPendingEmail,
} from "#/components/contacts/composerSend";
import { useContactSession } from "#/components/contacts/useContactSession";
import {
  getClientReportKpis,
  buildActivitySummaryText,
} from "#/data/listingClientReport";
import { buildingSectionListingId } from "#/components/deals/dealCardLink";
import { visibleNavGroups } from "#/components/properties/dealNav";
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
  sendEmailDef,
  buildCallListDef,
  buildMarketingPackageDef,
  researchContactDef,
  answerAboutContactDef,
  analyzeBookDef,
  navigateToDef,
  addNoteDef,
  createTaskDef,
  findContactDef,
  createContactDef,
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

/** The section slugs a space's own page actually has routes for. */
const SPACE_SECTIONS = new Set(
  visibleNavGroups("space", { leaseParent: false, showsUnderwriting: true }).flatMap((group) =>
    group.items.map((item) => item.href),
  ),
);

/**
 * Send a model-composed deal path to a space's own page, nested under its
 * building — but only for a section a space's page actually has. `navigateTo`
 * takes the path from the model, which composes it from an id it looked up
 * (see `navigateToDef`), so there is no link to fix — the correction has to
 * happen on the way out.
 *
 *   /listings/{space}           → /listings/{building}/spaces/{space}/overview
 *   /listings/{space}/{section} → /listings/{building}/spaces/{space}/{section}
 *     (only when {section} is one of `SPACE_SECTIONS`)
 *
 * A space has no `listing`, `spaces`, `vouchers`, or `edit` route, so a
 * section outside `SPACE_SECTIONS` falls back to the pre-space-page behaviour
 * instead: hand the section straight to the building, e.g.
 * /listings/{space}/listing → /listings/{building}/listing. That keeps every
 * model-composed path landing on a real page instead of a dead end.
 *
 * Anything else passes through untouched: another route, a path already
 * carrying a query or hash, an unknown id, or a building.
 */
export function rewriteSpaceDealPath(path: string): string {
  const match = /^\/listings\/([^/?#]+)(\/[^?#]*)?$/.exec(path);
  if (!match) return path;
  const [, listingId, section] = match;
  const buildingId = getListing(listingId)?.parentDealId;
  if (!buildingId) return path;
  const slug = !section || section === "/" ? "overview" : section.replace(/^\//, "").split("/")[0];
  if (!SPACE_SECTIONS.has(slug)) return `/listings/${buildingId}${section ?? ""}`;
  // A space's sections live under its own page, so the section survives the
  // rewrite rather than being handed to the building.
  const leaf = !section || section === "/" ? "/overview" : section;
  return `/listings/${buildingId}/spaces/${listingId}${leaf}`;
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
      const { contactId, contact_name, propertyId, listingId, intent } = args as {
        contactId?: string;
        contact_name?: string;
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
      // WHO the email is to, in strict order of authority:
      //   1. the contact the model resolved from what the broker said
      //   2. that name, resolved here as a fallback
      //   3. only then whoever's page is open
      //
      // The order is the whole fix: an earlier pass took the open page as the
      // recipient unconditionally, so "email Rosa" while reading Earl's record
      // drafted to Earl and left the model apologising for it in the body. A
      // named person always outranks the current route.
      const onContact = window.location.pathname.match(
        /^\/backoffice\/contacts\/([^/]+)/,
      );
      const pageContact = onContact ? getContact(onContact[1]) : undefined;
      let recipient: Contact | undefined = contactId ? getContact(contactId) : undefined;
      if (!recipient && contact_name) {
        recipient = resolveContactByName(contact_name) ?? undefined;
      }
      if (!recipient) recipient = pageContact;

      // Hand the real recipient over rather than letting the model invent one.
      // Without this it writes a plausible stranger into the To: line — a draft
      // to "Earl Whitman at Colliers" when the broker means Earl Pettigrew —
      // which is wrong on the card and wrong to send.
      const recipients = recipient
        ? [
            {
              name: `${recipient.firstName} ${recipient.lastName}`.trim(),
              email: recipient.email,
              company: recipient.company,
              title: recipient.title,
            },
          ]
        : [];
      const draft = await generateEmail({ data: { property: propPayload, intent, recipients } });
      const { email } = createEmailDraft({ subject: draft.subject });
      // Trust the record over the generated line: the model still sometimes
      // rewrites the address it was handed.
      const to = recipient
        ? [`${recipient.firstName} ${recipient.lastName}`.trim() + ` <${recipient.email}>`]
        : draft.to;
      // Fill the composer only when the broker is already on the recipient's own
      // page — that's the composer this draft belongs in, and revisions land
      // there too. Drafting to someone else from this page must NOT touch it:
      // writing Rosa's email into Earl's composer is the same bug wearing a
      // different hat. The card's "Open in Email" carries it to her page.
      if (recipient && recipient.id === pageContact?.id) {
        useComposeFocus.getState().requestEmailDraft({
          contactId: recipient.id,
          subject: draft.subject,
          body: draft.body,
        });
      }
      // Hold the draft as sendable wherever the broker happens to be. Without
      // this, "send it" only worked from the recipient's own page — and the card
      // deliberately doesn't take them there, so it usually failed.
      if (recipient) {
        setPendingEmail({
          contactId: recipient.id,
          contactName: `${recipient.firstName} ${recipient.lastName}`.trim(),
          to: recipient.email,
          subject: draft.subject,
          body: draft.body,
        });
      }
      return { emailDraft: { ...draft, to, id: email.id } };
    }),

    sendEmailDef.client(async () => {
      // Prefer the open composer: it holds whatever the broker has edited by
      // hand, and going through its own submit keeps "send it" and the Send
      // Email button the same action (see `composerSend.ts`).
      const fromComposer = requestComposerSend();
      if (fromComposer?.sent) {
        setPendingEmail(null);
        return {
          sentEmail: {
            subject: fromComposer.subject,
            to: fromComposer.to,
            contactId: fromComposer.contactId,
            contactName: fromComposer.contactName,
          },
        };
      }

      // No composer open — send the draft itself. It's a complete email to a
      // real record, so making the broker go open it first was busywork.
      const pending = getPendingEmail();
      if (!pending) {
        // A composer that's open but empty (or on another tab) gets to explain
        // itself; otherwise there is simply nothing drafted.
        return {
          error:
            fromComposer?.sent === false
              ? fromComposer.reason
              : "There's no draft to send — ask me to write one first.",
        };
      }
      useContactSession.getState().addLog(pending.contactId, {
        kind: "email",
        body: pending.body,
        subject: pending.subject,
        to: pending.to,
        date: new Date().toISOString().slice(0, 10),
      });
      setPendingEmail(null);
      return {
        sentEmail: {
          subject: pending.subject,
          to: pending.to,
          contactId: pending.contactId,
          contactName: pending.contactName,
        },
      };
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
        // The assistant queued this, so the row earns its sparkle badge.
        createdByAi: true,
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

    createContactDef.client(async (args) => {
      const {
        first_name,
        last_name,
        email,
        phone,
        company,
        title,
        notes,
        contact_info_unavailable,
      } = args as {
        first_name: string;
        last_name?: string;
        email?: string;
        phone?: string;
        company?: string;
        title?: string;
        notes?: string;
        contact_info_unavailable?: boolean;
      };
      // Enforce the "ask for a phone or email" turn here rather than trusting the
      // prompt: a contact with no way to reach them is the one record the broker
      // can't act on. `contact_info_unavailable` is the deliberate escape hatch,
      // so a broker who genuinely has neither can't get stuck in a loop.
      if (!email?.trim() && !phone?.trim() && !contact_info_unavailable) {
        const name = [first_name, last_name].filter(Boolean).join(" ");
        return {
          created: false,
          needs: "phone_or_email",
          ask: `Got it, ${name}. What's the best phone or email for them?`,
        };
      }
      const { contact } = createContact({
        firstName: first_name,
        // NewContactInput requires a last name; the broker often gives only a
        // first ("add a contact named Rosa"), so default it rather than refuse.
        lastName: last_name ?? "",
        email,
        phone,
        company,
        title,
        notes,
      });
      return {
        created: true,
        contactId: contact.id,
        contactName: `${contact.firstName} ${contact.lastName}`.trim(),
        email: contact.email || null,
        // A single contact renders as a clickable card, so the broker can open
        // the record they just created without another turn.
        contacts: [contactSummary(contact)],
      };
    }),

    planMyDayDef.client(async () => {
      const { items, totalDue } = buildDayPlan();
      if (items.length === 0) {
        const ctx = buildAssistantContext();
        return {
          headline: emptyDayPlanHeadline(),
          openDeals: ctx.pipeline.openDeals,
          dayPlan: null,
        };
      }
      return {
        // The card renders the queue; these are grounding for the model's
        // one-line framing (see the tool description). `totalDue` is the honest
        // total so the reply can't imply the queue is the whole backlog.
        queued: items.length,
        totalDue,
        dayPlan: { items },
      };
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
