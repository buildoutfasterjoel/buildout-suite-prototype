import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { getProperty } from "#/data/store";
import { createRosaProposalDeal } from "./rosaDeal";
import { ROSA_FINANCIAL_DOCS } from "./rosaDocs";

function hydrate() {
  const ds = generateDataset();
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never);
  return ds;
}

describe("createRosaProposalDeal", () => {
  beforeEach(() => hydrate());

  it("creates a proposal deal on the owner's building carrying the T-12 + rent roll", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "rosa")!;
    const property = getProperty(rosa.ownedPropertyIds![0])!;

    const { deal } = createRosaProposalDeal(rosa, property);

    expect(deal.status).toBe("proposal");
    expect(deal.propertyId).toBe(property.id);
    expect(deal.sellerContactIds).toContain(rosa.id);
    const docNames = (deal.documents ?? []).map((d) => d.name);
    for (const { name } of ROSA_FINANCIAL_DOCS) {
      expect(docNames).toContain(name);
    }
  });
});
