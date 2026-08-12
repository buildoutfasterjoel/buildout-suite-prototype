import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createContact } from "#/data/actions";
import { buildBriefing } from "./contactDisplay";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

describe("buildBriefing identity beat", () => {
  it("reads cleanly when a contact has neither title nor company", () => {
    // The shape the assistant creates from "add a contact named Bob Buyer".
    const { contact } = createContact({ firstName: "Bob", lastName: "Buyer" });
    const briefing = buildBriefing(contact, []);
    expect(briefing.startsWith("Bob Buyer.")).toBe(true);
    expect(briefing).not.toContain("at .");
    expect(briefing).not.toContain(",  ");
  });

  it("drops the dangling comma when there's a company but no title", () => {
    const { contact } = createContact({
      firstName: "Jane",
      lastName: "Doe",
      company: "Acme Holdings",
    });
    expect(buildBriefing(contact, []).startsWith("Jane Doe at Acme Holdings.")).toBe(true);
  });

  it("keeps the full form when both are present", () => {
    const { contact } = createContact({
      firstName: "Rosa",
      lastName: "Delgado",
      company: "Delgado Holdings",
      title: "Managing Partner",
    });
    expect(
      buildBriefing(contact, []).startsWith("Rosa Delgado, Managing Partner at Delgado Holdings."),
    ).toBe(true);
  });

  it("handles a title with no company", () => {
    const { contact } = createContact({
      firstName: "Otis",
      lastName: "Reed",
      title: "Principal",
    });
    expect(buildBriefing(contact, []).startsWith("Otis Reed, Principal.")).toBe(true);
  });

  it("does not trail a space when only a first name was given", () => {
    const { contact } = createContact({ firstName: "Rosa", lastName: "" });
    expect(buildBriefing(contact, []).startsWith("Rosa.")).toBe(true);
  });
});
