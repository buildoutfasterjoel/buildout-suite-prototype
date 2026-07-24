import { describe, it, expect } from "vitest";
import {
  buildRentSchedule,
  computeTotal,
  formatScheduleDate,
  makeRow,
  reflowDates,
} from "./rentSchedule";
import type { Listing } from "#/data/types";

/** Minimal lease listing: $1,800/mo, N-month term, given escalator + commission. */
function leaseListing(opts: {
  termMonths: number;
  escalators?: string | null;
  commissionPct?: number;
  monthlyRate?: number;
  dealType?: "Lease" | "Sale";
}): Listing {
  return {
    dealType: opts.dealType ?? "Lease",
    unitId: "u1",
    createdAt: "2025-07-31",
    transaction: { commissionPct: opts.commissionPct ?? 2 },
    marketing: {
      availableSqFt: 0,
      spaceLeaseTerms: [
        {
          unitId: "u1",
          leaseRate: opts.monthlyRate ?? 1800,
          leaseRateUnits: "Monthly",
          leaseTermMonths: opts.termMonths,
          rentEscalators: opts.escalators ?? null,
          dateAvailable: "2025-07-31",
        },
      ],
    },
  } as unknown as Listing;
}

describe("buildRentSchedule", () => {
  it("returns null for a Sale deal", () => {
    expect(buildRentSchedule(leaseListing({ termMonths: 36, dealType: "Sale" }))).toBeNull();
  });

  it("builds a flat 36-month schedule matching the reference screenshot", () => {
    const schedule = buildRentSchedule(leaseListing({ termMonths: 36 }))!;
    expect(schedule.rows).toHaveLength(3);

    for (const row of schedule.rows) {
      expect(row.months).toBe(12);
      expect(row.monthlyRate).toBe(1800);
      expect(row.totalRent).toBe(21_600);
      expect(row.commissionAmount).toBe(432);
    }

    expect(schedule.rows[0].startDate).toBe("2025-07-31");
    expect(schedule.rows[0].endDate).toBe("2026-07-30");
    expect(schedule.rows[2].endDate).toBe("2028-07-30");

    expect(schedule.total.months).toBe(36);
    expect(schedule.total.totalRent).toBe(64_800);
    expect(schedule.total.commissionAmount).toBe(1_296);
    expect(schedule.total.startDate).toBe("2025-07-31");
    expect(schedule.total.endDate).toBe("2028-07-30");
  });

  it("applies annual escalators per period", () => {
    const schedule = buildRentSchedule(leaseListing({ termMonths: 36, escalators: "3% annual" }))!;
    expect(schedule.rows[0].monthlyRate).toBeCloseTo(1800, 5);
    expect(schedule.rows[1].monthlyRate).toBeCloseTo(1854, 5);
    expect(schedule.rows[2].monthlyRate).toBeCloseTo(1909.62, 5);
  });

  it("emits a final partial period for terms that aren't a whole number of years", () => {
    const schedule = buildRentSchedule(leaseListing({ termMonths: 18 }))!;
    expect(schedule.rows).toHaveLength(2);
    expect(schedule.rows[1].months).toBe(6);
    expect(schedule.rows[1].totalRent).toBe(10_800);
    expect(schedule.total.months).toBe(18);
  });
});

describe("makeRow", () => {
  it("derives end date and money columns from the inputs", () => {
    const row = makeRow("2025-07-31", 12, 1800, 2);
    expect(row.endDate).toBe("2026-07-30");
    expect(row.totalRent).toBe(21_600);
    expect(row.commissionAmount).toBe(432);
  });
});

describe("reflowDates", () => {
  it("re-anchors rows to gapless contiguous dates after a term is removed", () => {
    const rows = buildRentSchedule(leaseListing({ termMonths: 36 }))!.rows;
    // Drop the middle year, then reflow.
    const reflowed = reflowDates([rows[0], rows[2]]);
    expect(reflowed).toHaveLength(2);
    expect(reflowed[0].startDate).toBe("2025-07-31");
    expect(reflowed[0].endDate).toBe("2026-07-30");
    // Second row now starts the day after the first, not its original 2027 date.
    expect(reflowed[1].startDate).toBe("2026-07-31");
    expect(reflowed[1].endDate).toBe("2027-07-30");
  });
});

describe("computeTotal", () => {
  it("returns null when there are no rows", () => {
    expect(computeTotal([])).toBeNull();
  });

  it("sums months, rent, and commission across rows", () => {
    const rows = buildRentSchedule(leaseListing({ termMonths: 24 }))!.rows;
    const total = computeTotal(rows)!;
    expect(total.months).toBe(24);
    expect(total.totalRent).toBe(43_200);
    expect(total.commissionAmount).toBe(864);
  });
});

describe("formatScheduleDate", () => {
  it("formats a YYYY-MM-DD date as MM/DD/YYYY without timezone drift", () => {
    expect(formatScheduleDate("2025-07-31")).toBe("07/31/2025");
  });
});
