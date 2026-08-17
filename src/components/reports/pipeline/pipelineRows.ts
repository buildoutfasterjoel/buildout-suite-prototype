import type {
  DealSide,
  DealType,
  Listing,
  Property,
  PropertyStatus,
  PropertyType,
} from "#/data/types";
import { getProperty } from "#/data/store";
import { isUmbrella } from "#/data/leaseSpaces";
import { SEED_ROSTER } from "#/data/roster";

/** One deal, flattened to exactly the columns the Pipeline Report shows. */
export interface PipelineRow {
  /** Listing id — what links resolve against. Not the displayed number. */
  listingId: string;
  /** The human-facing sequential deal number, e.g. "100". */
  dealId: string;
  name: string;
  stage: PropertyStatus;
  dealType: DealType;
  dealSide: DealSide;
  propertyType: PropertyType | null;
  street: string | null;
  city: string | null;
  state: string | null;
  office: string | null;
  brokers: string[];
  transactionValue: number;
  brokerageGross: number;
  closeDate: string | null;
}

/**
 * Exact dollars and cents. Deliberately not `formatPrice`, which abbreviates to
 * "$4.8M" — a report column is read as a figure, not a headline.
 *
 * `--` and `$0.00` mean different things and both appear in the reference: no
 * value on the record versus a real zero. Collapsing them loses information.
 */
export function formatReportCurrency(value: number | null): string {
  if (value == null) return "--";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A deal has no office of its own, so it inherits its lead internal broker's.
 *
 * Returns null rather than defaulting to an office: filing an unassigned deal
 * under a real office would quietly make that office's numbers wrong, and the
 * Office Leaderboard Report will read the same derivation.
 */
export function officeForDeal(deal: Listing): string | null {
  const lead = deal.internalBrokers[0];
  if (!lead) return null;
  return SEED_ROSTER.find((u) => u.name === lead.name)?.office ?? null;
}

export function toPipelineRow(
  deal: Listing,
  property: Property | undefined,
): PipelineRow {
  return {
    listingId: deal.id,
    dealId: deal.dealId,
    name: deal.name,
    stage: deal.status,
    dealType: deal.dealType,
    dealSide: deal.dealSide,
    propertyType: property?.propertyType ?? null,
    street: property?.street ?? null,
    city: property?.city ?? null,
    state: property?.state ?? null,
    office: officeForDeal(deal),
    brokers: deal.internalBrokers.map((b) => b.name),
    transactionValue: deal.transaction.salePrice,
    brokerageGross: deal.transaction.commissionAmount,
    closeDate: deal.transaction.closeDate,
  };
}

/**
 * Every reportable deal, umbrella shells excluded.
 *
 * A shell and its child space deals would otherwise both appear, overstating
 * Count and double-counting the same money in both total columns. The Deals
 * list excludes shells for the same reason.
 */
export function pipelineRows(deals: Listing[]): PipelineRow[] {
  return deals
    .filter((d) => !isUmbrella(d.id))
    .map((d) => toPipelineRow(d, getProperty(d.propertyId)));
}

export function pipelineTotals(rows: PipelineRow[]): {
  count: number;
  transactionValue: number;
  brokerageGross: number;
} {
  return {
    count: rows.length,
    transactionValue: rows.reduce((n, r) => n + r.transactionValue, 0),
    brokerageGross: rows.reduce((n, r) => n + r.brokerageGross, 0),
  };
}
