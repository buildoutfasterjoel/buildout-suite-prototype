import type { Listing } from "#/data/types";
import { dealHeadlineValue } from "./dealDisplay";

/** One period (typically a 12-month year) of a lease's rent schedule. */
export interface RentScheduleRow {
  /** ISO date-only (YYYY-MM-DD) the period begins. */
  startDate: string;
  /** ISO date-only (YYYY-MM-DD) the period ends. */
  endDate: string;
  months: number;
  /** Monthly rent for this period, after escalators — the "Lease Rate" column. */
  monthlyRate: number;
  /** monthlyRate × months. */
  totalRent: number;
  commissionPct: number;
  /** totalRent × commissionPct. */
  commissionAmount: number;
}

/** The blended total row summarizing every period. */
export interface RentScheduleTotal {
  startDate: string;
  endDate: string;
  months: number;
  totalRent: number;
  commissionPct: number;
  commissionAmount: number;
}

/** A lease's full rent schedule: per-period rows plus the blended total row. */
export interface RentSchedule {
  rows: RentScheduleRow[];
  total: RentScheduleTotal;
  /** Annual escalator % parsed from the lease terms — used to auto-calculate added terms. */
  escalatorPct: number;
}

/** The lease terms the schedule is built from — the deal's own unit, else the first. */
function primaryLeaseTerms(listing: Listing) {
  const terms = listing.marketing.spaceLeaseTerms ?? [];
  return terms.find((t) => t.unitId === listing.unitId) ?? terms[0];
}

/** Pull the leading percentage out of an escalator string, e.g. "3% annual" → 3. */
function parseEscalatorPct(escalators: string | null): number {
  if (!escalators) return 0;
  const match = escalators.match(/([\d.]+)\s*%/);
  return match ? Number.parseFloat(match[1]) : 0;
}

/** Parse a YYYY-MM-DD string as a local date (avoids the UTC shift of `new Date(str)`). */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** MM/DD/YYYY from a schedule's YYYY-MM-DD date (local, no timezone drift). */
export function formatScheduleDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

/** Build one period row, deriving its end date and money columns from the inputs. */
export function makeRow(
  startDate: string,
  months: number,
  monthlyRate: number,
  commissionPct: number,
): RentScheduleRow {
  const start = parseLocalDate(startDate);
  const endDate = addDays(addMonths(start, months), -1);
  const totalRent = monthlyRate * months;
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(endDate),
    months,
    monthlyRate,
    totalRent,
    commissionPct,
    commissionAmount: totalRent * (commissionPct / 100),
  };
}

/** Re-anchor rows to contiguous dates from the first row's start — keeps the schedule
 * gapless after a term is added, duplicated, or removed. */
export function reflowDates(rows: RentScheduleRow[]): RentScheduleRow[] {
  if (rows.length === 0) return rows;
  let cursor = parseLocalDate(rows[0].startDate);
  return rows.map((r) => {
    const row = makeRow(toIsoDate(cursor), r.months, r.monthlyRate, r.commissionPct);
    cursor = addMonths(cursor, r.months);
    return row;
  });
}

/** Recompute the blended total row from the current set of period rows. */
export function computeTotal(rows: RentScheduleRow[]): RentScheduleTotal | null {
  if (rows.length === 0) return null;
  return {
    startDate: rows[0].startDate,
    endDate: rows[rows.length - 1].endDate,
    months: rows.reduce((sum, r) => sum + r.months, 0),
    totalRent: rows.reduce((sum, r) => sum + r.totalRent, 0),
    commissionPct: rows[0].commissionPct,
    commissionAmount: rows.reduce((sum, r) => sum + r.commissionAmount, 0),
  };
}

/**
 * Derive a lease's rent schedule from its terms: base annual rent (rate × available
 * SqFt) split into 12-month periods, escalated each year, with commission taken at the
 * deal's commission rate. Returns null unless this is a Lease deal with usable terms —
 * so the schedule surfaces only on leases (whole building or an individual space).
 */
export function buildRentSchedule(listing: Listing): RentSchedule | null {
  if (listing.dealType !== "Lease") return null;

  const terms = primaryLeaseTerms(listing);
  if (!terms || terms.leaseRate == null) return null;

  const termMonths = terms.leaseTermMonths ?? 0;
  if (termMonths <= 0) return null;

  const baseAnnualRent = dealHeadlineValue(listing);
  if (baseAnnualRent <= 0) return null;

  const baseMonthlyRent = baseAnnualRent / 12;
  const escalatorPct = parseEscalatorPct(terms.rentEscalators);
  const commissionPct = listing.transaction.commissionPct;
  const start = parseLocalDate(terms.dateAvailable ?? listing.createdAt);

  const rows: RentScheduleRow[] = [];
  let cursor = start;
  let monthsRemaining = termMonths;
  let year = 0;

  while (monthsRemaining > 0) {
    const months = Math.min(12, monthsRemaining);
    const monthlyRate = baseMonthlyRent * Math.pow(1 + escalatorPct / 100, year);
    rows.push(makeRow(toIsoDate(cursor), months, monthlyRate, commissionPct));

    cursor = addMonths(cursor, months);
    monthsRemaining -= months;
    year += 1;
  }

  return { rows, total: computeTotal(rows)!, escalatorPct };
}
