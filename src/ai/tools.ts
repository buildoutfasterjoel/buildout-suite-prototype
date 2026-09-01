import type { AnyClientTool } from "@tanstack/ai";
import type { Contact, Listing, Property, PropertyStatus } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { addDealActivity, getContact, getListing, getProperty } from "#/data/store";
import { voucherParty } from "#/data/vouchers";
import {
  generateFilter,
  generateEmail,
  generateCallList,
  generateContactBrief,
  generateStrategy,
  generateMarketingDoc,
  generateRecordBrief,
} from "#/ai/generate";
import { composeContactData } from "#/ai/contactData";
import {
  composeDealData,
  composePropertyData,
  composeTaskData,
  type RecordDump,
} from "#/ai/recordData";
import {
  searchTasks,
  loadTask,
  searchActivities,
  loadActivity,
  listAttachments,
  searchVouchers,
  loadVoucher,
  searchResearchProperties,
  loadResearchProperty,
  pipelineTotals,
  taskSummary,
  voucherSummary,
  researchSummary,
  ownedPropertiesFor,
  dealOpportunityFor,
} from "#/ai/recordQueries";
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
  updateContact,
  addContactTags,
  removeContactTags,
  touchContactActivity,
} from "#/data/actions";
import { CURRENT_USER } from "#/data/teammates";
import { buildDayPlan, emptyDayPlanHeadline } from "#/ai/dayPlan";
import { parseDueDate } from "#/ai/dueDate";
import { buildAssistantContext } from "#/ai/context";
import { emptyDraft } from "#/data/createListing";
import { documentsFromContact } from "#/components/contacts/useContactSession";
import {
  dealSupportsUnderwriting,
  propertyQualifiesForUnderwriting,
} from "#/components/deals/underwriting/eligibility";
import { useUnderwritingOffer } from "#/ai/underwritingOffer";
import { callFlow } from "#/components/call/callFlow";
import { useComposeFocus } from "#/components/contacts/useComposeFocus";
import { toISODate } from "#/lib/isoDate";
import { useAssistant } from "#/ai/useAssistant";
import {
  requestComposerSend,
  getPendingEmail,
  setPendingEmail,
} from "#/components/contacts/composerSend";
import { withPhase } from "#/ai/toolPhase";
import { useContactSession } from "#/components/contacts/useContactSession";
import { assignContactTo } from "#/components/contacts/contactAssignment";
import { useRoster } from "#/components/settings/users/useRoster";
import {
  checkContactRight,
  isContactVisible,
  maskContactForText,
  visibleContacts,
  type ContactRight,
} from "#/components/contacts/contactRights";
import { useDayPlanQueue } from "#/components/ai/useDayPlanQueue";
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
  addActivityDef,
  stageFieldValueDef,
  logCallDef,
  createTaskDef,
  findContactDef,
  createContactDef,
  planMyDayDef,
  startCallDef,
  taskSearchDef,
  taskLoadDef,
  activitySearchDef,
  activityLoadDef,
  attachmentListDef,
  attachmentLoadDef,
  voucherSearchDef,
  voucherLoadDef,
  researchPropertySearchDef,
  researchPropertyLoadDef,
  dealPipelineTotalsDef,
  updateContactDef,
  contactTagsDef,
  addContactTagsDef,
  removeContactTagsDef,
  assignContactDef,
  briefDef,
  supportDef,
} from "./toolDefs";

// ── Compact summaries — keep tool results small for the model ────────────────

const contactSummary = (c: Contact) => {
  // A private party on a deal the viewer can see: existence and role, never who.
  const m = maskContactForText(c);
  return {
    id: c.id,
    name: m.name,
    company: m.company,
    relationship: c.relationship,
    role: c.role,
    email: m.email,
    phone: m.phone,
    ...(m.private ? { private: true } : {}),
  };
};

/**
 * Resolve the contact a tag tool is talking about, by id or by name. Returns the
 * error object the tool should hand straight back when there is no match — the
 * three tag tools each accept both forms, and a bare "Contact not found" tells
 * the model nothing about which half of the lookup failed.
 */
function resolveTagTarget(
  contactId: string | undefined,
  contactName: string | undefined,
): { contact: Contact } | { error: string } {
  const contact = contactId
    ? getContact(contactId)
    : contactName
      ? resolveContactByName(contactName)
      : null;
  if (contact) return { contact };
  // Three different failures, three different answers. "Tell me which contact"
  // in response to an id that simply didn't resolve sends the model back to the
  // broker for something they already gave it.
  if (contactId) return { error: `No contact with id ${contactId}.` };
  return {
    error: contactName
      ? `No contact named "${contactName}".`
      : "Tell me which contact's tags to work with.",
  };
}

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
 * (`add_activity`, `log_call`, `create_task`, `start_call`) that take a `contact_name`
 * argument instead of a resolved id.
 */
export function resolveContactByName(name: string): Contact | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  // Only the book as the viewer may see it — a private contact the viewer has
  // no relationship with can't be found by name, not even to say it exists.
  const contacts = visibleContacts();
  return (
    contacts.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === q) ??
    contacts.find((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)) ??
    null
  );
}

/**
 * Resolve the contact an activity is being logged against: a resolved id wins,
 * then a name, then whoever's page is open.
 *
 * The open page is the *last* resort deliberately, for the same reason
 * `draft_email` orders it that way — logging "spoke to Rosa" onto Earl's record
 * because Earl's page happened to be open is a silent corruption of the record,
 * and the broker has no reason to go looking for it.
 */
function resolveActivityContact({
  contactId,
  contact_name,
}: {
  contactId?: string;
  contact_name?: string;
}): Contact | null {
  if (contactId) {
    const byId = getContact(contactId);
    if (byId && isContactVisible(contactId)) return byId;
  }
  if (contact_name) return resolveContactByName(contact_name);
  const onContact = window.location.pathname.match(/^\/backoffice\/contacts\/([^/]+)/);
  return (onContact ? getContact(onContact[1]) : undefined) ?? null;
}

/**
 * Reaching the person the queue was pointing at counts as working that move.
 *
 * The day-plan queue only ever noticed work done through its own buttons, so a
 * broker who emailed Rosa instead of calling her was left with the move still on
 * the list asking to be done again — the same gap that let a call typed into the
 * chat go unnoticed. Clearing it here means the queue tracks the outreach rather
 * than the button that happened to start it.
 *
 * Clears the move, deliberately without completing any task record behind it:
 * emailing someone about a deliverable is not the deliverable being finished.
 */
function clearQueuedMoveFor(contactId: string | undefined): void {
  if (!contactId) return;
  useDayPlanQueue.getState().clearForContact(contactId, "Emailed them. Next up…");
}

/**
 * Otto's activity vocabulary → the compose module's.
 *
 * Buildout logs a property visit as a *showing*; this prototype's composer calls
 * the same thing a tour, and has no separate kind for a text message. Mapping
 * here rather than widening `LoggedKind` keeps the timeline's five tabs as the
 * one list of what a logged activity can be.
 */
const LOG_KIND = {
  meeting: "meeting",
  showing: "tour",
  message: "note",
  note: "note",
} as const;

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
 * Make a tool result safe to hand back to the runtime.
 *
 * The runtime canonicalises a client tool's output, and its serializer is
 * stricter than `JSON.stringify`: an `undefined` anywhere in the tree throws
 * `Interrupt values must be JSON-compatible.`, and so does any value that isn't
 * a plain object (a `Date`, a `Map`, a class instance). `JSON.stringify` merely
 * drops or coerces all of those, which is why this looked like working code.
 *
 * The failure was invisible in the worst way. A throw was caught upstream and
 * stored as the call's output — `{ error: "Interrupt values must be
 * JSON-compatible." }` — so the tool "succeeded" with an error payload the
 * model then narrated straight past: "Here are your active deals:" above no
 * deals at all, because the rail had no `deals` array to draw cards from.
 * `listDeals` tripped it on one line, `dealType: undefined` inside the nav it
 * returns when the broker didn't name a deal type.
 *
 * Fixed here, once, rather than in each of the forty-odd tools: an optional
 * field is the normal shape of this data, so a rule that every tool must
 * remember to write `?? null` is a rule that gets broken by the next tool
 * added. A round-trip through JSON is exactly the "make it JSON-compatible"
 * the runtime is asking for.
 */
export function jsonSafeResult(value: unknown): unknown {
  try {
    // `?? null` because `JSON.stringify(undefined)` returns undefined rather
    // than a string, which `JSON.parse` then rejects — a tool that returns
    // nothing must not become a serialization error.
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    // Only a cycle or a BigInt reaches here. Report it as a tool error the
    // model can speak to, rather than throwing into the runtime and having it
    // surface as the same opaque message this whole helper exists to prevent.
    return { error: "That result couldn't be serialized to send back." };
  }
}

/** Wrap one client tool so whatever it returns goes through {@link jsonSafeResult}. */
function withJsonSafeOutput(tool: AnyClientTool): AnyClientTool {
  const { execute } = tool as AnyClientTool & {
    execute?: (...args: never[]) => unknown | Promise<unknown>;
  };
  if (typeof execute !== "function") return tool;
  return {
    ...tool,
    execute: async (...args: never[]) => jsonSafeResult(await execute(...args)),
  } as AnyClientTool;
}

/**
 * Build the browser-executed client tools, matched by name to the shared
 * definitions in `toolDefs.ts`. `navigate` is injected from the sidebar (which
 * holds the router). Each `execute` runs against the live Zustand store.
 */
/** A tool's answer when the viewer lacks a right on the contact it targets. */
function denied(contactId: string, right: ContactRight): { error: string } | null {
  const r = checkContactRight(contactId, right);
  return r.ok ? null : { error: r.message };
}

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
          propertiesQuery: query,
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
      let rows = visibleContacts();
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
        // What the broker is looking at while they ask. The contact page's
        // "Properties" panel is built from `ownedPropertyIds` plus the properties
        // behind their deals, and this tool used to return neither — so "make a
        // deal for Rosa" got "she has no property on file" from an assistant
        // staring at a panel that said otherwise.
        ownedProperties: ownedPropertiesFor(detail.contact).map(propertySummary),
        // A building of theirs with nothing tracking it, when something says now
        // is the moment. `null` rather than omitted — an `undefined` in a tool
        // result throws on serialize.
        dealOpportunity: dealOpportunityFor(contactId) ?? null,
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
      const { propertyId, name, address, dealType, sellerContactId, buyerContactId } = args as {
        propertyId?: string;
        name?: string;
        address?: string;
        dealType?: "Sale" | "Lease";
        sellerContactId?: string;
        buyerContactId?: string;
      };
      // `createProposalListing` only fabricates a stub property when no
      // `propertyId` is given, so passing one through is the whole fix for the
      // duplicate-building bug — a deal asked for on "the Delgado Building" was
      // landing on a brand-new $0 / 0 SF property of the same name.
      const linked = propertyId ? getProperty(propertyId) : undefined;
      if (propertyId && !linked) return { error: "No property with that id." };
      if (!linked && !address?.trim()) {
        return {
          error:
            "Give me either an existing propertyId or a street address — I won't guess which building this is.",
        };
      }
      // Files the party to the deal has emailed in this session — Rosa's T-12
      // and rent roll, say. The timeline's own "Start a Deal" action already
      // attaches them (see `createRosaProposalDeal`); the rail's deal carries
      // the same set, so the two ways to start a deal produce one record.
      const partyId = sellerContactId ?? buyerContactId ?? "";
      const sent = partyId ? documentsFromContact(partyId) : [];
      const { deal } = createDeal({
        ...emptyDraft(),
        propertyId: linked?.id ?? "",
        name: name ?? (linked ? linked.name : (address ?? "")),
        address: linked ? "" : (address ?? ""),
        ...(linked?.propertyType && { propertyType: linked.propertyType }),
        ...(dealType && { dealType }),
        // Side follows whoever was named: `createProposalListing` reads
        // `dealSide` to decide which array the contact lands in, so a buyer
        // passed with the default 'seller' side would be silently dropped.
        dealSide: buyerContactId && !sellerContactId ? "buyer" : "seller",
        sellerContactId: sellerContactId ?? "",
        buyerContactId: buyerContactId ?? "",
        documents: sent.map(({ name: docName, meta }) => ({
          id: crypto.randomUUID(),
          name: docName,
          // "PDF · 268 KB" → "268 KB"; the chip renders the size on its own.
          size: meta.split("·").pop()?.trim() ?? "",
          uploadedAt: new Date().toISOString(),
        })),
      });
      // Offer the underwriting once the deal exists, but only where it can
      // actually run: a suite never gets one (`dealSupportsUnderwriting`), nor
      // does an asset class the Cactus flow doesn't cover. Answered in the
      // rail's `send()` — see `underwritingOffer`.
      if (
        sellerContactId &&
        dealSupportsUnderwriting(deal) &&
        propertyQualifiesForUnderwriting(linked) &&
        deal.underwriting == null
      ) {
        useUnderwritingOffer.getState().offer({
          dealId: deal.id,
          contactId: sellerContactId,
          dealName: deal.name,
        });
      }
      return {
        // An ARRAY, not a bare `deal`, and that is the whole difference between
        // a card and nothing: `entitiesOf` in the rail reads `deals` /
        // `contacts` / `properties`, and a single entity renders as its full
        // clickable card. The contact family has always returned one (see
        // `create_contact`), so a created contact was one click from its record
        // and a created deal was a sentence saying it existed.
        deals: [dealSummary(deal)],
        // Say which way it went, so the model's confirmation can't claim it used
        // the broker's building when it actually made a new one.
        usedExistingProperty: !!linked,
        propertyId: deal.propertyId,
        // Drives the transcript's scan → map → create checklist, so starting a
        // deal from the rail shows the same working as the modal flow does.
        dealBuild: {
          documents: sent.map((d) => d.name),
          label: `${deal.name} · Pitching`,
          source: linked ? `${linked.name}'s record` : "The address you gave me",
        },
      };
    }),

    updateDealStageDef.client(async (args) => {
      const { dealId, status } = args as { dealId: string; status: PropertyStatus };
      const { deal } = updateDealStage(dealId, status);
      // Same array, same reason as createDeal: the record just touched is one
      // click away. `update_contact` already worked this way.
      return deal ? { deals: [dealSummary(deal)] } : { error: "Deal not found" };
    }),

    linkContactToDealDef.client(async (args) => {
      const { dealId, contactId, role } = args as {
        dealId: string;
        contactId: string;
        role: "seller" | "buyer" | "other";
      };
      const blocked = denied(contactId, "canEdit");
      if (blocked) return blocked;
      const { deal } = linkContactToDeal(dealId, contactId, role);
      return deal
        ? { deals: [dealSummary(deal)], linked: contactId, role }
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
      const spec = await withPhase("filter_listings", "Working out the filter", () =>
        generateFilter({ data: { query } }),
      );
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
      const draft = await withPhase("draft_email", "Writing the draft", () =>
        generateEmail({ data: { property: propPayload, intent, recipients } }),
      );
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
        clearQueuedMoveFor(fromComposer.contactId);
        return {
          sentEmail: {
            subject: fromComposer.subject,
            to: fromComposer.to,
            contactId: fromComposer.contactId,
            contactName: fromComposer.contactName,
            // Carried so the receipt can offer "Show Content" — the rail folds
            // the sent body away, but folding it away means still having it.
            body: fromComposer.body,
            sentAt: new Date().toISOString(),
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
      const cannotSend = denied(pending.contactId, "canReachOut");
      if (cannotSend) return cannotSend;
      useContactSession.getState().addLog(pending.contactId, {
        kind: "email",
        body: pending.body,
        subject: pending.subject,
        to: pending.to,
        date: new Date().toISOString().slice(0, 10),
      });
      setPendingEmail(null);
      clearQueuedMoveFor(pending.contactId);
      return {
        sentEmail: {
          subject: pending.subject,
          to: pending.to,
          contactId: pending.contactId,
          contactName: pending.contactName,
          body: pending.body,
          sentAt: new Date().toISOString(),
        },
      };
    }),

    buildCallListDef.client(async (args) => {
      const { intent } = args as { intent?: string };
      const pool = contactCallPool(visibleContacts());
      const ranked = await withPhase("build_call_list", "Ranking by stage and last touch", () =>
        generateCallList({ data: { intent, contacts: pool } }),
      );
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
      const [doc, email] = await withPhase(
        "build_marketing_package",
        "Writing the flyer and its launch email",
        () =>
          Promise.all([
            generateMarketingDoc({ data: { property, docType: "marketing_flyer" } }),
            generateEmail({
              data: { property, intent: `Launch marketing for ${address}`, recipients: [] },
            }),
          ]),
      );
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
      const { brief } = await withPhase("research_contact", `Reading ${name}'s record`, () =>
        generateContactBrief({ data: { data: composeContactData(contactId), name } }),
      );
      // Reading someone's whole record is the deepest look the assistant takes,
      // so an untracked building of theirs belongs in the answer. Grounded
      // rather than inferred: the offer has to be able to name the property id
      // it would create the deal on.
      return { brief, contactName: name, dealOpportunity: dealOpportunityFor(contactId) ?? null };
    }),

    answerAboutContactDef.client(async (args) => {
      const { contactId, question } = args as { contactId: string; question: string };
      const detail = getContactDetailClient(contactId);
      if (!detail) return { error: "Contact not found" };
      const name = `${detail.contact.firstName} ${detail.contact.lastName}`.trim();
      const { brief } = await withPhase("answer_about_contact", `Reading ${name}'s record`, () =>
        generateContactBrief({ data: { data: composeContactData(contactId), name, question } }),
      );
      return { brief, contactName: name, dealOpportunity: dealOpportunityFor(contactId) ?? null };
    }),

    analyzeBookDef.client(async (args) => {
      const { question } = args as { question: string };
      const { answer } = await withPhase("analyze_book", "Reading your whole book", () =>
        generateStrategy({ data: { book: composeBookSnapshot(), question } }),
      );
      return { answer };
    }),

    addActivityDef.client(async (args) => {
      const { type, body, contact_name, contactId, dealId } = args as {
        type?: "note" | "meeting" | "showing" | "message";
        body: string;
        contact_name?: string;
        contactId?: string;
        dealId?: string;
      };
      const kind = type ?? "note";
      if (dealId) {
        const deal = addDealActivity(dealId, { type: kind, note: body, actor: CURRENT_USER.name });
        return deal
          ? { logged: true, type: kind, dealId, dealName: deal.name }
          : { error: "Deal not found" };
      }
      const c = resolveActivityContact({ contactId, contact_name });
      if (!c) {
        return {
          error: contact_name
            ? `No contact named "${contact_name}".`
            : "Tell me who or which deal to log this against.",
        };
      }
      const blocked = denied(c.id, "canLog");
      if (blocked) return blocked;
      const name = `${c.firstName} ${c.lastName}`.trim();
      // Everything logged here reaches the timeline, notes included. A note used
      // to go ONLY to the contact's notes field, which is read by the Edit
      // Contact form and nothing else — so asking the assistant to log a note
      // wrote it somewhere the broker would never look, while typing the same
      // note into the composer three inches away put it on the timeline. Same
      // action, two destinations, decided by who performed it.
      useContactSession.getState().addLog(c.id, {
        kind: LOG_KIND[kind],
        body,
        date: toISODate(new Date()),
      });
      if (kind === "note") {
        // Still appended to the notes field as well — that is the record's own
        // running note, and `GlobalLogCallModal` writes both halves too.
        addNote(c.id, body);
      } else {
        // A meeting or a showing is a touch; a note isn't. Only the former moves
        // "last contacted" (see `log_call` for the same rule).
        touchContactActivity(c.id);
      }
      return { logged: true, type: kind, contactId: c.id, contactName: name };
    }),

    /**
     * Step 03 of the "ask at the rail, review at the field" grammar: the model's
     * answer lands in the field the broker is looking at, not on the record.
     *
     * A composer draft IS the review surface — nothing is written to the
     * timeline until the broker hits Log Note — so this stages rather than
     * commits without needing an Accept/Discard pair layered on top of a box
     * that is already unsaved.
     */
    stageFieldValueDef.client(async (args) => {
      const { text, subject, changed } = args as {
        text: string;
        subject?: string;
        changed?: string;
      };
      const ask = useAssistant.getState().fieldAsk;
      if (!ask) {
        return {
          error:
            "No field is pinned right now — the broker hasn't handed you one from the page.",
        };
      }
      const contact = getContact(ask.target.contactId);
      if (!contact) return { error: "That field's record is no longer loaded." };
      const { activity } = ask.target;
      useComposeFocus.getState().requestActivityDraft({
        contactId: ask.target.contactId,
        kind: activity,
        body: text,
        // Only ever passed on an email, and only when the model set one —
        // `undefined` here is what leaves the broker's own subject standing.
        subject: activity === "email" ? subject : undefined,
      });
      // A staged email has to be sendable from anywhere, the same as one from
      // `draft_email` — otherwise "send it" works only while the composer is
      // the surface in focus. Subject falls back to what is already there,
      // which `send_email` prefers from the live composer anyway.
      if (activity === "email") {
        setPendingEmail({
          contactId: contact.id,
          contactName: `${contact.firstName} ${contact.lastName}`.trim(),
          to: contact.email,
          subject: subject ?? "",
          body: text,
        });
      }
      // The pinned value follows what was just written, so the next revision
      // revises THIS text rather than the version before it.
      useAssistant.getState().updateFieldAskValue(text);
      // Every key defined: an `undefined` in a client tool's result throws on
      // serialize and the throw is stored as the tool's output, so the call
      // reads as though it worked.
      return {
        staged: true,
        field: ask.label,
        changed: changed ?? "",
      };
    }),

    logCallDef.client(async (args) => {
      const { contact_name, contactId, dealId, outcome, duration_minutes, direction } = args as {
        contact_name?: string;
        contactId?: string;
        dealId?: string;
        outcome: string;
        duration_minutes?: number;
        direction?: "outbound" | "inbound";
      };
      const note = duration_minutes ? `${outcome} (${duration_minutes} min)` : outcome;
      if (dealId) {
        const deal = addDealActivity(dealId, { type: "call", note, actor: CURRENT_USER.name });
        return deal
          ? { logged: true, dealId, dealName: deal.name }
          : { error: "Deal not found" };
      }
      const c = resolveActivityContact({ contactId, contact_name });
      if (!c) {
        return {
          error: contact_name
            ? `No contact named "${contact_name}".`
            : "Tell me who the call was with.",
        };
      }
      const blocked = denied(c.id, "canLog");
      if (blocked) return blocked;
      useContactSession.getState().addLog(c.id, {
        kind: "call",
        body: note,
        date: new Date().toISOString().slice(0, 10),
      });
      // A logged call is activity on the record, so the People table's Last
      // Activity column has to move with it. Deliberately NOT `lastContactedAt`:
      // that field anchors the synthesized timeline arc (see `timelineArcs.ts`),
      // so writing it would silently re-date the contact's whole history.
      touchContactActivity(c.id);
      return {
        logged: true,
        contactId: c.id,
        contactName: `${c.firstName} ${c.lastName}`.trim(),
        direction: direction ?? "outbound",
      };
    }),

    createTaskDef.client(async (args) => {
      const { task_title, contact_name, dealId, task_type, due } = args as {
        task_title: string;
        contact_name?: string;
        dealId?: string;
        task_type?: string;
        due?: string;
      };
      const c = contact_name ? resolveContactByName(contact_name) : null;
      if (c) {
        const blocked = denied(c.id, "canEdit");
        if (blocked) return blocked;
      }
      const deal = dealId ? getListing(dealId) : undefined;
      const { task } = createTask({
        name: task_title,
        dueDate: due ? parseDueDate(due) : null,
        contactId: c?.id ?? null,
        dealId: deal?.id ?? null,
        type: task_type ?? null,
        // A task hangs off whichever record it was created against, so the Tasks
        // page badges it and the record's own list picks it up.
        source: deal ? "deal" : "contact",
        // The assistant queued this, so the row earns its sparkle badge.
        createdByAi: true,
      });
      return {
        taskId: task.id,
        title: task.name,
        due: task.dueDate,
        contactName: c ? `${c.firstName} ${c.lastName}`.trim() : null,
        dealName: deal?.name ?? null,
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
      const blocked = denied(c.id, "canReachOut");
      if (blocked) return { started: false, ...blocked };
      callFlow.open(c);
      // Land the broker on the contact's page so the call bar + arc play out
      // over their record (mirrors the homepage "Call Rosa" CTA).
      navigate(`/backoffice/contacts/${c.id}`);
      return { started: true, contactId: c.id };
    }),

    // ── Tasks ────────────────────────────────────────────────────────────────

    taskSearchDef.client(async (args) => {
      const q = args as Parameters<typeof searchTasks>[0];
      const { total, tasks } = searchTasks(q);
      return {
        total,
        tasks: tasks.map(taskSummary),
        // No `navs` entry: `ResultNav` only knows deals, contacts and properties,
        // so a task list would have nowhere to send the broker. The tool answers
        // in prose and the model names the tasks.
        tasksPath: "/backoffice/tasks",
      };
    }),

    taskLoadDef.client(async (args) => {
      const { taskId } = args as { taskId: string };
      const task = loadTask(taskId);
      return task ? { task: taskSummary(task) } : { error: "Task not found" };
    }),

    // ── Activities ───────────────────────────────────────────────────────────

    activitySearchDef.client(async (args) => {
      const q = args as Parameters<typeof searchActivities>[0];
      if (!q.contactId && !q.dealId) {
        return { error: "Give me a contact or a deal to read the activity on." };
      }
      const { total, activities } = searchActivities(q);
      // Reading someone's timeline is exactly when an untracked building should
      // surface: the broker is looking at what just happened, and whether it has
      // a deal behind it is the next question. See `dealOpportunityFor`.
      return {
        total,
        activities,
        dealOpportunity: q.contactId ? (dealOpportunityFor(q.contactId) ?? null) : null,
      };
    }),

    activityLoadDef.client(async (args) => {
      const { activityId, contactId, dealId } = args as {
        activityId: string;
        contactId?: string;
        dealId?: string;
      };
      const activity = loadActivity(activityId, { contactId, dealId });
      return activity ? { activity } : { error: "Activity not found" };
    }),

    // ── Attachments ──────────────────────────────────────────────────────────

    attachmentListDef.client(async (args) => {
      const { dealId } = args as { dealId: string };
      const deal = getListing(dealId);
      if (!deal) return { error: "Deal not found" };
      const items = listAttachments(dealId);
      return {
        dealName: deal.name,
        total: items.filter((i) => i.kind === "file").length,
        attachments: items,
        documentsPath: `/listings/${buildingSectionListingId(dealId)}/documents`,
      };
    }),

    attachmentLoadDef.client(async (args) => {
      const { dealId, fileId } = args as { dealId: string; fileId: string };
      const item = listAttachments(dealId).find((i) => i.id === fileId);
      if (!item) return { error: "File not found on that deal" };
      return {
        attachment: item,
        // Said out loud in the payload, not just in the tool description: the
        // prototype stores a name and a size, and a model handed a filename will
        // otherwise happily summarize a document it has never read.
        contentsAvailable: false,
      };
    }),

    // ── Vouchers ─────────────────────────────────────────────────────────────

    voucherSearchDef.client(async (args) => {
      const q = args as Parameters<typeof searchVouchers>[0];
      const { total, vouchers } = searchVouchers(q);
      return { total, vouchers: vouchers.map(voucherSummary), vouchersPath: "/backoffice/vouchers" };
    }),

    voucherLoadDef.client(async (args) => {
      const { dealId } = args as { dealId: string };
      const found = loadVoucher(dealId);
      if (!found) {
        return {
          error:
            "No voucher on that deal — either the id isn't a deal, or it's a building whose spaces each carry their own transaction.",
        };
      }
      const { voucher, deal } = found;
      const back = deal.transaction.backOffice;
      return {
        voucher: {
          ...voucherSummary(voucher),
          deductions: back.preSplitDeductions.map((d) => ({
            category: d.category,
            description: d.description,
            amount: d.amount,
          })),
          receivables: back.receivables.map((r) => ({
            payer: voucherParty(r.payerContactId).name,
            description: r.billingDescription,
            dueDate: r.dueDate,
            amount: r.amount,
            outstanding: r.amount - r.credited,
          })),
          approval: back.approval,
        },
        // `target` is a typed TanStack destination, not a string — flattened here
        // because `navigateTo` (and the model composing a link) both take a path.
        voucherPath: voucher.target.to
          .replace("$listingId", voucher.target.params.listingId)
          .replace(
            "$spaceId",
            "spaceId" in voucher.target.params ? voucher.target.params.spaceId : "",
          ),
      };
    }),

    // ── Insights research properties ─────────────────────────────────────────

    researchPropertySearchDef.client(async (args) => {
      const q = args as Parameters<typeof searchResearchProperties>[0];
      const { total, properties } = searchResearchProperties(q);
      return {
        total,
        // Deliberately NOT returned under `properties`: that key is what the rail
        // renders as clickable property cards, and a prospect has no page in the
        // broker's database to click through to. See `entitiesOf`.
        researchProperties: properties.map(researchSummary),
        insightsPath: "/prospect",
      };
    }),

    researchPropertyLoadDef.client(async (args) => {
      const { propertyId } = args as { propertyId: string };
      const p = loadResearchProperty(propertyId);
      return p
        ? { researchProperty: researchSummary(p) }
        : { error: "No research property with that id" };
    }),

    // ── Pipeline ─────────────────────────────────────────────────────────────

    dealPipelineTotalsDef.client(async (args) => {
      const { dealType } = args as { dealType?: "Sale" | "Lease" };
      return { pipeline: pipelineTotals(dealType) };
    }),

    // ── Contact updates ──────────────────────────────────────────────────────

    updateContactDef.client(async (args) => {
      const { contactId, contact_name, first_name, last_name, email, phone, company, title, notes } =
        args as {
          contactId?: string;
          contact_name?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          company?: string;
          title?: string;
          notes?: string;
        };
      const target = contactId
        ? getContact(contactId)
        : contact_name
          ? resolveContactByName(contact_name)
          : null;
      if (!target) {
        return {
          error: contact_name
            ? `No contact named "${contact_name}".`
            : "Tell me which contact to update.",
        };
      }
      // `updateContact` is the Edit Contact *form's* writer: it takes the whole
      // form, so every field the model left out has to be filled back in from the
      // record. Passing a bare patch would blank a name, an email, a phone —
      // whatever wasn't mentioned — which is how an update quietly becomes a wipe.
      const blocked = denied(target.id, "canEdit");
      if (blocked) return blocked;
      const sent = { first_name, last_name, email, phone, company, title, notes };
      const changed = Object.entries(sent)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => k);
      const { contact } = updateContact(target.id, {
        firstName: first_name ?? target.firstName,
        lastName: last_name ?? target.lastName,
        email: email ?? target.email,
        phone: phone ?? target.phone,
        company: company ?? target.company,
        title: title ?? target.title,
        notes: notes ?? target.notes,
        emails: target.emails,
        phones: target.phones,
        source: target.source,
        doNotCall: target.doNotCall,
      });
      if (!contact) return { error: "Contact not found" };
      return {
        updated: changed,
        contactId: contact.id,
        contactName: `${contact.firstName} ${contact.lastName}`.trim(),
        contacts: [contactSummary(contact)],
      };
    }),

    // ── Contact tags ─────────────────────────────────────────────────────────
    //
    // Tags are the broker's own segmentation — the thing the People page filters
    // on — so they are read and written as their own small surface rather than
    // through `update_contact`. That tool is the Edit Contact form's writer: it
    // takes the whole form back, which makes "add one tag" a round-trip through
    // every other field on the record.

    contactTagsDef.client(async (args) => {
      const { contactId, contact_name } = args as {
        contactId?: string;
        contact_name?: string;
      };
      const target = resolveTagTarget(contactId, contact_name);
      if ("error" in target) return target;
      // Every tag in the book, so the model matches an existing spelling instead
      // of coining a near-duplicate that segments half the same people.
      const inUse = [
        ...new Set(
          visibleContacts().flatMap((c) => c.tags),
        ),
      ].sort();
      return {
        contactId: target.contact.id,
        contactName: `${target.contact.firstName} ${target.contact.lastName}`.trim(),
        tags: target.contact.tags,
        tagsInUse: inUse,
      };
    }),

    addContactTagsDef.client(async (args) => {
      const { contactId, contact_name, tags } = args as {
        contactId?: string;
        contact_name?: string;
        tags: string[];
      };
      const target = resolveTagTarget(contactId, contact_name);
      if ("error" in target) return target;
      const blocked = denied(target.contact.id, "canEdit");
      if (blocked) return blocked;
      const { contact, added } = addContactTags(target.contact.id, tags ?? []);
      if (!contact) return { error: "Contact not found" };
      return {
        added,
        // What was asked for but already there. Reported rather than silently
        // dropped, so "add VIP" on someone already tagged VIP reads as a no-op
        // instead of a success the broker can't find on the record.
        alreadyPresent: (tags ?? [])
          .map((t) => t.trim())
          .filter((t) => t && !added.some((a) => a.toLowerCase() === t.toLowerCase())),
        tags: contact.tags,
        contactId: contact.id,
        contactName: `${contact.firstName} ${contact.lastName}`.trim(),
        contacts: [contactSummary(contact)],
      };
    }),

    assignContactDef.client(async (args) => {
      const { contactId, contact_name, assignee_name } = args as {
        contactId?: string;
        contact_name?: string;
        assignee_name?: string;
      };
      const c = resolveActivityContact({ contactId, contact_name });
      if (!c) {
        return {
          error: contact_name ? `No contact named "${contact_name}".` : "Tell me which contact.",
        };
      }
      const blocked = denied(c.id, "canAssign");
      if (blocked) return blocked;
      let assignee: string | null = null;
      if (assignee_name) {
        const q = assignee_name.trim().toLowerCase();
        const user = useRoster
          .getState()
          .users.find((u) => u.status === "active" && u.name.toLowerCase() === q);
        if (!user) return { error: `No active teammate named "${assignee_name}".` };
        assignee = user.name;
      }
      assignContactTo(c.id, assignee);
      const updated = getContact(c.id);
      return {
        contacts: updated ? [contactSummary(updated)] : [],
        assignedTo: assignee,
      };
    }),

    removeContactTagsDef.client(async (args) => {
      const { contactId, contact_name, tags } = args as {
        contactId?: string;
        contact_name?: string;
        tags: string[];
      };
      const target = resolveTagTarget(contactId, contact_name);
      if ("error" in target) return target;
      const blocked = denied(target.contact.id, "canEdit");
      if (blocked) return blocked;
      const { contact, removed } = removeContactTags(target.contact.id, tags ?? []);
      if (!contact) return { error: "Contact not found" };
      return {
        removed,
        notPresent: (tags ?? [])
          .map((t) => t.trim())
          .filter((t) => t && !removed.some((r) => r.toLowerCase() === t.toLowerCase())),
        tags: contact.tags,
        contactId: contact.id,
        contactName: `${contact.firstName} ${contact.lastName}`.trim(),
        contacts: [contactSummary(contact)],
      };
    }),

    // ── Cross-record brief ───────────────────────────────────────────────────

    briefDef.client(async (args) => {
      const { recordType, recordId, question } = args as {
        recordType: "deal" | "listing" | "property" | "task";
        recordId: string;
        question?: string;
      };
      // "deal" and "listing" are the same record here (a listing IS its deal),
      // so both land on the same composer rather than the model having to guess
      // which word this app uses.
      const dump: RecordDump | null =
        recordType === "property"
          ? composePropertyData(recordId)
          : recordType === "task"
            ? composeTaskData(recordId)
            : composeDealData(recordId);
      if (!dump) return { error: `No ${recordType} with that id.` };
      const { brief } = await withPhase("brief", `Reading ${dump.name}`, () =>
        generateRecordBrief({
          data: { data: dump.data, name: dump.name, kind: dump.kind, question },
        }),
      );
      return { brief, recordName: dump.name, recordType: dump.kind };
    }),

    // ── Support handoff ──────────────────────────────────────────────────────

    supportDef.client(async (args) => {
      const { topic } = args as { topic: string };
      return {
        handoff: true,
        topic,
        // A canned route, not a ticket: this prototype has no support desk behind
        // it, so the tool hands over an address rather than pretending to file
        // anything. Saying that here keeps the model from claiming it filed one.
        channel: "Buildout Support",
        email: "support@buildout.com",
        ticketFiled: false,
      };
    }),
    // Every tool's output goes through the same serializer guard — see
    // `jsonSafeResult`. Applied to the whole list rather than at each
    // `.client()` call so a tool added later cannot opt out by forgetting.
  ].map(withJsonSafeOutput);
}
