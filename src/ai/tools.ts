import type { AnyClientTool } from "@tanstack/ai";
import type { Contact, Listing, Property, PropertyStatus } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
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
} from "#/data/actions";
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
  navigateToDef,
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

const propertySummary = (p: Property) => ({
  id: p.id,
  address: [p.street, p.city, p.state].filter(Boolean).join(", "),
  propertyType: p.propertyType,
  subtype: p.propertySubtype,
  buildingSqFt: p.buildingSqFt,
  askingPrice: p.askingPrice,
  capRate: p.capRate,
});

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
  ];
}
