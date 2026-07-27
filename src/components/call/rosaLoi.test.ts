import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { getListingsForProperty } from "#/data/store";
import { useContactSession } from "#/components/contacts/useContactSession";
import { createRosaProposalDeal } from "./rosaDeal";
import {
  DELGADO_BUYER_LEAD_ID,
  DELGADO_LEAD_FIXTURES,
  seedDelgadoLeads,
} from "./rosaLeads";
import { rosaLoi, DELGADO_LOI_EMAIL_ID } from "./rosaLoi";
import { DELGADO_LOI } from "./rosaDocs";

function hydrate() {
  const ds = generateDataset();
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never);
}

/** Rosa's building, with the deal on it and the three leads landed. */
function setUpArc(): { propertyId: string; dealId: string } {
  const rosa = [...useDataStore.getState().contacts.values()].find(
    (c) => c.heroKey === "rosa",
  )!;
  const propertyId = rosa.ownedPropertyIds![0];
  const property = useDataStore.getState().properties.get(propertyId)!;
  const { deal } = createRosaProposalDeal(rosa, property);
  seedDelgadoLeads(propertyId);
  return { propertyId, dealId: deal.id };
}

describe("rosaLoi", () => {
  beforeEach(() => {
    hydrate();
    useContactSession.setState({ logged: {}, simEvents: {}, resolved: {}, flags: {} });
    vi.useFakeTimers();
  });

  it("files the LOI onto the deal and posts it to the buyer's timeline ~6s after arm", async () => {
    const { propertyId, dealId } = setUpArc();
    rosaLoi.arm(DELGADO_BUYER_LEAD_ID, propertyId);
    await vi.advanceTimersByTimeAsync(6_000);

    const deal = useDataStore.getState().listings.get(dealId)!;
    expect((deal.documents ?? []).some((d) => d.name === DELGADO_LOI.name)).toBe(
      true,
    );

    const events =
      useContactSession.getState().simEvents[DELGADO_BUYER_LEAD_ID] ?? [];
    const email = events.find((e) => e.id === DELGADO_LOI_EMAIL_ID);
    expect(email).toBeTruthy();
    expect(email?.type).toBe("inbound-email");
    expect(email?.attachments?.[0]?.name).toBe(DELGADO_LOI.name);
    // The row links back to the deal the LOI is on.
    expect(email?.associations?.[0]?.id).toBe(dealId);
  });

  it("maybeArmFor only arms for the last lead in the list", async () => {
    const { propertyId } = setUpArc();
    const earlier = DELGADO_LEAD_FIXTURES[0].id;
    expect(earlier).not.toBe(DELGADO_BUYER_LEAD_ID);

    expect(rosaLoi.maybeArmFor(earlier)).toBe(false);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(useContactSession.getState().simEvents[earlier]).toBeUndefined();

    expect(rosaLoi.maybeArmFor(DELGADO_BUYER_LEAD_ID)).toBe(true);
    await vi.advanceTimersByTimeAsync(6_000);
    const deal = getListingsForProperty(propertyId)[0];
    expect((deal.documents ?? []).some((d) => d.name === DELGADO_LOI.name)).toBe(
      true,
    );
  });

  it("cancel() before the timer fires drops the arrival", async () => {
    const { propertyId, dealId } = setUpArc();
    rosaLoi.arm(DELGADO_BUYER_LEAD_ID, propertyId);
    rosaLoi.cancel();
    await vi.advanceTimersByTimeAsync(6_000);

    const deal = useDataStore.getState().listings.get(dealId)!;
    expect((deal.documents ?? []).some((d) => d.name === DELGADO_LOI.name)).toBe(
      false,
    );
    expect(
      useContactSession.getState().simEvents[DELGADO_BUYER_LEAD_ID],
    ).toBeUndefined();
  });
});
