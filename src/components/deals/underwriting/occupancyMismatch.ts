import type { Property, UnderwritingResult } from "#/data/types";

export interface OccupancyMismatch {
  stated: number;
  actual: number;
  gapPts: number;
  isMismatch: boolean;
}

/** Compare the property's stated (marketing) occupancy against the newest financial
 * record's (T-12) occupancy. A gap of >= 10 points is a mismatch worth flagging. */
export function computeOccupancyMismatch(property: Property): OccupancyMismatch {
  const stated = property.occupancyPct;
  const actual = property.financialRecords?.[0]?.occupancyPct ?? stated;
  const gapPts = Math.round(stated - actual);
  return { stated, actual, gapPts, isMismatch: gapPts >= 10 };
}

function metricValue(result: UnderwritingResult, key: string): number | undefined {
  return result.metrics.find((m) => m.key === key)?.value;
}

/** A grounded BOV value range: the underwriting NOI/cap, adjusted DOWN for the actual
 * occupancy when there's a mismatch, ±5%, rounded to 10k. Falls back to asking ±5%. */
export function bovValueRange(
  result: UnderwritingResult,
  mismatch: OccupancyMismatch,
): { low: number; high: number } {
  const noi = metricValue(result, "netOperatingIncome");
  const cap = metricValue(result, "goingInCapRate");
  const round10k = (n: number) => Math.round(n / 10_000) * 10_000;
  let mid: number;
  if (noi && cap) {
    const occFactor = mismatch.isMismatch && mismatch.stated > 0 ? mismatch.actual / mismatch.stated : 1;
    mid = (noi * occFactor) / cap;
  } else {
    mid = result.inputs.askingPrice;
  }
  return { low: round10k(mid * 0.95), high: round10k(mid * 1.05) };
}
