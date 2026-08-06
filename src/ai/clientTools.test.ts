import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createProposalListing, emptyDraft } from "#/data/createListing";
import { addPropertyUnit, addSpaceToDeal } from "#/data/leaseSpaces";
import { resolveContactByName, rewriteSpaceDealPath } from "./tools";

beforeEach(() => { useDataStore.setState(seedSlice()); });

describe("resolveContactByName", () => {
  it("resolves a full name to a contact", () => {
    const first = [...useDataStore.getState().contacts.values()][0];
    const full = `${first.firstName} ${first.lastName}`.trim();
    expect(resolveContactByName(full)?.id).toBe(first.id);
  });
  it("returns null for an unknown name", () => {
    expect(resolveContactByName("Zzz Nobody")).toBeNull();
  });
});

describe("rewriteSpaceDealPath", () => {
  /** A building with one space, both live in the store. */
  function building() {
    const parent = createProposalListing({ ...emptyDraft(), name: "Rowan Center", dealType: "Lease" });
    const unit = addPropertyUnit(parent.propertyId, { label: "Suite 300", sqft: 2000, unitType: "office" })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;
    return { parent, child };
  }

  it("rewrites a space's bare deal path to its page under its building", () => {
    const { parent, child } = building();
    expect(rewriteSpaceDealPath(`/listings/${child.id}`)).toBe(
      `/listings/${parent.id}/spaces/${child.id}/overview`,
    );
  });

  it("keeps the section when rewriting a space's sectioned path", () => {
    const { parent, child } = building();
    expect(rewriteSpaceDealPath(`/listings/${child.id}/leads`)).toBe(
      `/listings/${parent.id}/spaces/${child.id}/leads`,
    );
  });

  it("leaves a building's own paths alone", () => {
    const { parent } = building();
    expect(rewriteSpaceDealPath(`/listings/${parent.id}`)).toBe(`/listings/${parent.id}`);
    expect(rewriteSpaceDealPath(`/listings/${parent.id}/documents`)).toBe(
      `/listings/${parent.id}/documents`,
    );
  });

  it("passes through anything that isn't a resolvable deal path", () => {
    for (const path of [
      "/listings",
      "/backoffice/contacts",
      "/listings/no-such-deal",
      "/properties/prop-1",
    ]) {
      expect(rewriteSpaceDealPath(path)).toBe(path);
    }
  });
});
