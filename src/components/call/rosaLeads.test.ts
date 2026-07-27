import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { getContact, getLeadsForProperty, getListingsForProperty } from "#/data/store";
import { buildContactTimeline } from "#/components/contacts/timelineArcs";
import { createRosaProposalDeal } from "./rosaDeal";
import {
  DELGADO_BUYER_LEAD_ID,
  DELGADO_LEAD_FIXTURES,
  onDelgadoDealActivated,
  seedDelgadoLeads,
} from "./rosaLeads";

function hydrate() {
  const ds = generateDataset();
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never);
}

/**
 * Rosa's building with her deal on it — the state the leads land into. The deal
 * matters: it names Rosa as the seller, which is what keeps her out of her own
 * building's Leads list.
 */
function setUpDeal(): string {
  const rosa = [...useDataStore.getState().contacts.values()].find(
    (c) => c.heroKey === "rosa",
  )!;
  const propertyId = rosa.ownedPropertyIds![0];
  const property = useDataStore.getState().properties.get(propertyId)!;
  createRosaProposalDeal(rosa, property);
  return propertyId;
}

describe("seedDelgadoLeads", () => {
  beforeEach(hydrate);

  it("lands three callable leads on the deal's Leads list, buyer last", () => {
    const propertyId = setUpDeal();
    expect(getLeadsForProperty(propertyId)).toHaveLength(0);

    const created = seedDelgadoLeads(propertyId);
    expect(created).toHaveLength(3);

    const leads = getLeadsForProperty(propertyId);
    expect(leads.map((l) => l.id)).toEqual(
      DELGADO_LEAD_FIXTURES.map((f) => f.id),
    );
    expect(leads.at(-1)!.id).toBe(DELGADO_BUYER_LEAD_ID);
    // The demo calls this list — every lead needs a dialable number.
    for (const lead of leads) {
      expect(lead.phone.trim()).not.toBe("");
      expect(lead.doNotCall).toBe(false);
      expect(lead.role).toBe("buyer");
    }
  });

  it("is idempotent — a second run adds nothing", () => {
    const propertyId = setUpDeal();
    seedDelgadoLeads(propertyId);
    expect(seedDelgadoLeads(propertyId)).toHaveLength(0);
    expect(getLeadsForProperty(propertyId)).toHaveLength(3);
  });

  it("onDelgadoDealActivated seeds once and reports nothing on replay", () => {
    const propertyId = setUpDeal();
    expect(onDelgadoDealActivated(propertyId)).toHaveLength(3);
    expect(onDelgadoDealActivated(propertyId)).toHaveLength(0);
  });

  it("each lead carries their own inquiry on the deal, in their own voice", () => {
    const propertyId = setUpDeal();
    const dealId = getListingsForProperty(propertyId)[0].id;
    seedDelgadoLeads(propertyId);

    const messages = new Set<string>();
    for (const lead of getLeadsForProperty(propertyId)) {
      expect(lead.inquiries).toBe(1);
      expect(lead.inquiredListingIds).toEqual([dealId]);
      const detail = lead.inquiryDetails?.[dealId];
      expect(detail?.message).toBeTruthy();
      expect(detail?.channel).toBeTruthy();
      messages.add(detail!.message);
    }
    // Tailored, not shared — three leads, three distinct inquiries.
    expect(messages.size).toBe(3);

    // The inquiry reaches the timeline as the lead's own row on the deal.
    const buyer = getContact(DELGADO_BUYER_LEAD_ID)!;
    const inquiry = buildContactTimeline(buyer, []).find(
      (e) => e.type === "inquiry",
    )!;
    expect(inquiry.body).toBe(buyer.inquiryDetails![dealId].message);
    expect(inquiry.associations?.[0]?.id).toBe(dealId);
  });

  it("leads read as brand new — never contacted, added just now", () => {
    const propertyId = setUpDeal();
    seedDelgadoLeads(propertyId);
    for (const lead of getLeadsForProperty(propertyId)) {
      expect(lead.lastContactedAt).toBeNull();
      expect(Date.now() - new Date(lead.createdAt).getTime()).toBeLessThan(
        60_000,
      );
    }
  });
});
