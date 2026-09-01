import { describe, expect, it } from "vitest";
import type { Inquiry } from "./inquiryRow";
import { JOURNEY_STAGES, journeyProgress, journeyReach } from "./inquiryJourney";

function inquiry(patch: Partial<Inquiry> = {}): Inquiry {
  return {
    id: "c1",
    listingId: "l1",
    name: "Dana Reyes",
    initials: "DR",
    email: "dana@example.com",
    phone: "(555) 010-0000",
    addedBy: "MK",
    accessLevel: "Low",
    verified: false,
    status: "New",
    referralSource: "Website",
    company: "Reyes Holdings",
    role: "Buyer",
    dateAdded: "01/01/2026",
    lastUpdated: "01/02/2026",
    exchange1031: "--",
    expiration1031: "--",
    createdProfile: false,
    caSigned: false,
    caFileName: null,
    caSignedAt: null,
    ...patch,
  };
}

describe("journeyReach", () => {
  it("puts a lead who only inquired on the first stage", () => {
    expect(journeyReach(inquiry())).toBe(0);
  });

  it("advances to Created Profile once they have an account", () => {
    expect(journeyReach(inquiry({ createdProfile: true }))).toBe(1);
  });

  it("carries a verified lead past the email gate to their access level", () => {
    const base = { createdProfile: true, verified: true } as const;
    expect(journeyReach(inquiry({ ...base, accessLevel: "Low" }))).toBe(3);
    expect(journeyReach(inquiry({ ...base, accessLevel: "Medium" }))).toBe(4);
    expect(journeyReach(inquiry({ ...base, accessLevel: "High" }))).toBe(5);
  });

  it("caps at the first unmet gate rather than counting later facts", () => {
    // The whole point of walking the funnel in order: High access does not
    // backfill a gate they never passed, so the bar cannot show a hole and
    // cannot contradict the Account Status row beside it.
    expect(
      journeyReach(
        inquiry({ createdProfile: true, verified: false, accessLevel: "High" }),
      ),
    ).toBe(1);
    expect(
      journeyReach(
        inquiry({ createdProfile: false, verified: false, accessLevel: "High" }),
      ),
    ).toBe(0);
  });
});

describe("journeyProgress", () => {
  it("counts the stage they stand on as complete", () => {
    const p = journeyProgress(inquiry());
    expect(p.complete).toBe(1);
    expect(p.total).toBe(JOURNEY_STAGES.length);
    expect(p.current).toBe("Public Documents");
    expect(p.next).toBe("Created Profile");
  });

  it("reports no next stage at the end of the journey", () => {
    const p = journeyProgress(
      inquiry({ createdProfile: true, verified: true, accessLevel: "High" }),
    );
    expect(p.complete).toBe(6);
    expect(p.pct).toBe(100);
    expect(p.current).toBe("High Documents");
    expect(p.next).toBeNull();
  });
});
