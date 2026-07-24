import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { addNote } from "#/data/actions";

beforeEach(() => { useDataStore.setState(seedSlice()); });

describe("addNote", () => {
  it("appends a note to an existing contact", () => {
    const id = [...useDataStore.getState().contacts.keys()][0];
    const { contact } = addNote(id, "Called, left VM.");
    expect(contact?.notes).toContain("Called, left VM.");
  });
  it("returns null for an unknown contact", () => {
    expect(addNote("nope", "x").contact).toBeNull();
  });
});
