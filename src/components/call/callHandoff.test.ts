import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createContact } from "#/data/actions";
import { getOvernightSignalContact } from "#/data/signal";
import { composeCallHandoff } from "./callHandoff";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

describe("composeCallHandoff", () => {
  it("names the destination and brings the overnight signal into the brief", () => {
    const rosa = getOvernightSignalContact();
    expect(rosa).toBeTruthy();
    const text = composeCallHandoff(rosa!);
    expect(text.startsWith("Taking you to Rosa Delgado.")).toBe(true);
    expect(text).toContain("Quick brief before you dial:");
    expect(text).toContain("maturing loan");
    expect(text.endsWith("Connecting now…")).toBe(true);
  });

  it("drops the brief sentence when the record has nothing to offer", () => {
    const { contact } = createContact({ firstName: "Bob", lastName: "Buyer" });
    const text = composeCallHandoff(contact);
    expect(text).toBe("Taking you to Bob Buyer. Connecting now…");
    expect(text).not.toContain("Quick brief");
  });

  it("reports a verified number when the record has one", () => {
    const { contact } = createContact({ firstName: "Dana", lastName: "Reed" });
    useDataStore.setState((s) => {
      const contacts = new Map(s.contacts);
      contacts.set(contact.id, { ...contact, phoneStatus: "valid" });
      return { contacts };
    });
    const updated = useDataStore.getState().contacts.get(contact.id)!;
    expect(composeCallHandoff(updated)).toContain("their number's verified");
  });

  it("lowercases a signal headline so it reads mid-sentence", () => {
    const { contact } = createContact({ firstName: "Otis", lastName: "Reed" });
    useDataStore.setState((s) => {
      const contacts = new Map(s.contacts);
      contacts.set(contact.id, {
        ...contact,
        signal: {
          kind: "hold-expiry",
          headline: "Their hold period expires in Q1",
          detail: "…",
          observedAt: "2026-08-11",
        },
      });
      return { contacts };
    });
    const updated = useDataStore.getState().contacts.get(contact.id)!;
    expect(composeCallHandoff(updated)).toContain("their hold period expires in Q1");
  });
});
