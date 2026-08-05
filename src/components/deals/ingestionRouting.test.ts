import { describe, expect, it } from "vitest";
import type { IngestionConflict, IngestionFieldKey } from "#/data/types";
import {
  CONFLICT_PAGE,
  conflictKeysOn,
  firstUnresolvedOn,
  ingestionReviewTarget,
  otherPage,
} from "./ingestionRouting";

function conflict(
  fieldKey: IngestionFieldKey,
  resolution?: "doc" | "current",
): IngestionConflict {
  return {
    fieldKey,
    label: fieldKey,
    docValue: "1",
    currentValue: "2",
    docSource: "T-12.pdf",
    currentSource: "Property record",
    docRaw: 1,
    currentRaw: 2,
    ...(resolution ? { resolution } : {}),
  };
}

describe("CONFLICT_PAGE", () => {
  it("routes every conflict field to exactly one page", () => {
    // A field with no page would be unreachable — the broker could never
    // resolve it, and the publish gate would block forever.
    expect(CONFLICT_PAGE).toEqual({
      askingPrice: "deal",
      noi: "deal",
      occupancyPct: "listing",
    });
  });
});

describe("conflictKeysOn", () => {
  it("partitions the keys between the two pages", () => {
    expect(conflictKeysOn("deal").sort()).toEqual(["askingPrice", "noi"]);
    expect(conflictKeysOn("listing")).toEqual(["occupancyPct"]);
  });
});

describe("ingestionReviewTarget", () => {
  it("picks the page holding the first unresolved conflict", () => {
    expect(ingestionReviewTarget([conflict("occupancyPct")])).toBe("listing");
    expect(ingestionReviewTarget([conflict("noi")])).toBe("deal");
  });

  it("skips resolved conflicts when choosing", () => {
    const conflicts = [conflict("noi", "doc"), conflict("occupancyPct")];
    expect(ingestionReviewTarget(conflicts)).toBe("listing");
  });

  it("falls back to the listing page when nothing is unresolved", () => {
    expect(ingestionReviewTarget([])).toBe("listing");
    expect(ingestionReviewTarget([conflict("noi", "current")])).toBe("listing");
  });
});

describe("otherPage", () => {
  it("names the page each page's fields are not on", () => {
    expect(otherPage("deal")).toBe("listing");
    expect(otherPage("listing")).toBe("deal");
  });
});

describe("firstUnresolvedOn", () => {
  it("returns only a conflict the page owns", () => {
    const conflicts = [conflict("occupancyPct"), conflict("noi")];
    expect(firstUnresolvedOn(conflicts, "deal")).toBe("noi");
    expect(firstUnresolvedOn(conflicts, "listing")).toBe("occupancyPct");
  });

  it("returns null when the page owns nothing unresolved", () => {
    expect(firstUnresolvedOn([conflict("noi", "doc")], "deal")).toBeNull();
    expect(firstUnresolvedOn([], "listing")).toBeNull();
  });
});
