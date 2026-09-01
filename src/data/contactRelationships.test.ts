import { describe, expect, it } from "vitest";
import type { Contact } from "#/data/types";
import {
  duplicateOf,
  normalizePhone,
  relationshipCounts,
  siblingRelationships,
} from "#/data/contactRelationships";

function c(over: Partial<Contact>): Contact {
  return {
    id: over.id ?? "x",
    firstName: "Jim",
    lastName: "Halvorsen",
    email: "",
    phone: "",
    company: "",
    assignedTo: "Ethan Thompson",
    tags: [],
    ...over,
  } as Contact;
}

const susans = c({ id: "s", email: "Jim@Halvorsen.com", phone: "(843) 555-0100", personId: "p1" });
const toms = c({ id: "t", email: "jim@halvorsen.com" });
const linkedTwin = c({ id: "l", email: "other@x.com", personId: "p1" });
const stranger = c({ id: "z", email: "z@z.com", phone: "843-555-0999" });

describe("siblingRelationships", () => {
  it("finds linked records by personId and suspects by email or phone", () => {
    const s = siblingRelationships(susans, [susans, toms, linkedTwin, stranger]);
    expect(s.linked.map((x) => x.id)).toEqual(["l"]);
    expect(s.suspected.map((x) => x.id)).toEqual(["t"]);
  });

  it("only ever runs over the visible book — a hidden record can't be suspected", () => {
    // The caller passes what the viewer may see; Susan's record isn't in it.
    const s = siblingRelationships(toms, [toms, stranger]);
    expect(s.linked).toEqual([]);
    expect(s.suspected).toEqual([]);
  });

  it("matches on phone digits, ignoring formatting", () => {
    const a = c({ id: "a", phone: "843.555.0100" });
    const b = c({ id: "b", phone: "(843) 555-0100" });
    expect(siblingRelationships(a, [a, b]).suspected.map((x) => x.id)).toEqual(["b"]);
    expect(normalizePhone("(843) 555-0100")).toBe("8435550100");
  });

  it("doesn't suspect two records already linked to different people", () => {
    const a = c({ id: "a", email: "same@x.com", personId: "p1" });
    const b = c({ id: "b", email: "same@x.com", personId: "p2" });
    expect(siblingRelationships(a, [a, b]).suspected).toEqual([]);
  });
});

describe("duplicateOf", () => {
  it("points at a visible record with the same email or phone", () => {
    expect(duplicateOf({ email: "JIM@halvorsen.com" }, [susans, stranger])?.id).toBe("s");
    expect(duplicateOf({ phone: "843 555 0999" }, [susans, stranger])?.id).toBe("z");
  });

  it("finds nothing when the match isn't in the visible book", () => {
    expect(duplicateOf({ email: "jim@halvorsen.com" }, [stranger])).toBeUndefined();
  });

  it("needs something to match on", () => {
    expect(duplicateOf({ email: "", phone: "12" }, [susans])).toBeUndefined();
  });
});

describe("relationshipCounts", () => {
  it("counts only groups of two or more", () => {
    const solo = c({ id: "solo", personId: "p9" });
    const counts = relationshipCounts([susans, linkedTwin, toms, solo]);
    expect(counts.get("s")).toBe(2);
    expect(counts.get("l")).toBe(2);
    expect(counts.has("t")).toBe(false);
    expect(counts.has("solo")).toBe(false);
  });
});
