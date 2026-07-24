import { describe, it, expect, beforeEach } from "vitest";
import type { Contact } from "./types";
import { signalText, getOvernightSignalContact } from "./signal";
import { useDataStore } from "./dataStore";

const baseContact = (over: Partial<Contact>): Contact =>
  ({
    id: "c1", firstName: "Marcus", lastName: "Pinckney",
    propertyIds: [], role: "owner",
    ...over,
  } as unknown as Contact);

describe("signalText", () => {
  it("renders the signal string when present", () => {
    const c = baseContact({
      signal: { kind: "loan-maturity", headline: "$4.2M CMBS loan maturing", detail: "d", observedAt: "2026-07-24" },
    });
    expect(signalText(c)).toBe("$4.2M CMBS loan maturing");
  });
  it("returns empty string when no signal", () => {
    expect(signalText(baseContact({}))).toBe("");
  });
});

describe("getOvernightSignalContact", () => {
  beforeEach(() => {
    useDataStore.setState({ contacts: new Map() });
  });
  it("finds the heroKey==='marcus' contact", () => {
    const marcus = baseContact({ id: "m", heroKey: "marcus" });
    useDataStore.setState({ contacts: new Map([["m", marcus]]) });
    expect(getOvernightSignalContact()?.id).toBe("m");
  });
  it("returns null when absent", () => {
    expect(getOvernightSignalContact()).toBeNull();
  });
});
