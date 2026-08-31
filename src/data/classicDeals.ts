import type { DealType, ListingStage, PropertyType } from "./types";
import { getListing, getProperty } from "./store";
import { getRefId } from "#/components/properties/propertyDisplay";

/** One row of the classic deal's Deals table. */
export interface ClassicDealRow {
  /** Row key. Not a `Listing.id` unless `listingId` below is set. */
  id: string;
  title: string;
  /**
   * The legacy numeric deal id the table shows. For the listing's own deal this
   * is `getRefId`, the same number its page header and card already show — not
   * `Listing.dealId`, which is a two- or three-digit seed counter and would read
   * as a different record from the one in the header.
   */
  dealId: number;
  dealType: DealType;
  stage: ListingStage;
  /** "Charlotte, NC" — resolved from the property, so every row agrees. */
  location: string;
  propertyType: PropertyType;
  /** Initials for the Brokers column, in order. */
  brokerInitials: string[];
  transactionValue: number;
  brokerageGross: number;
  openTasks: number;
  /** ISO date, or null when the deal has no next milestone. */
  nextCriticalDate: string | null;
  /**
   * The deal this row opens, when the row is a real deal in the store. Null on
   * a companion row, whose title then renders as plain text — a link that goes
   * nowhere is worse than no link.
   */
  listingId: string | null;
}

function initials(name: string): string {
  const [first = "", last = ""] = name.trim().split(/\s+/);
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

/**
 * The companion deals on a classic listing — everything a row needs that the
 * store cannot answer.
 *
 * A Listing *is* its deal in this model, 1:1, so "the other deals on this
 * listing" is a relation we do not have. Rather than invent the relation (a new
 * entity, a `SEED_VERSION` move, and every deal surface in the app having to
 * decide what a second deal on a listing means), these two rows are fixtures:
 * the money, the stage and the legacy id are fixed here, while location,
 * property type and the brokers are read from the real listing below, so the
 * table cannot show a row that disagrees with the property it sits on.
 *
 * Faker-free and fixed, so the table reads the same on every seed.
 *
 * Titles come from the property's own address rather than being made up: legacy
 * deal titles are addresses, and this way a companion row names a real place.
 */
const COMPANIONS: {
  suffix: string;
  /**
   * Which real name this row takes. Two rows on one property must not share a
   * title — identical titles in a table read as a duplicated row — so one takes
   * the street address and the other the address plus a real unit label.
   */
  titleFrom: "street" | "unit";
  dealId: number;
  dealType: DealType;
  stage: ListingStage;
  transactionValue: number;
  brokerageGross: number;
  openTasks: number;
  /** Days from today, or null for no next milestone. */
  criticalInDays: number | null;
}[] = [
  {
    suffix: "sale",
    titleFrom: "street",
    dealId: 369236,
    dealType: "Sale",
    stage: "under-contract",
    transactionValue: 20_000_000,
    brokerageGross: 600_000,
    openTasks: 5,
    criticalInDays: 12,
  },
  {
    suffix: "lease",
    titleFrom: "unit",
    dealId: 412884,
    dealType: "Lease",
    stage: "active",
    transactionValue: 2_450_000,
    brokerageGross: 73_500,
    openTasks: 2,
    criticalInDays: null,
  },
];

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Every deal attached to this listing, for the classic deal's Deals table.
 *
 * The listing's own deal leads — it is the deal you are looking at, and it is
 * the one row whose every figure is real — followed by the companion fixtures
 * above. Returns an empty array for an unknown listing rather than throwing, the
 * same way the other section selectors do.
 */
export function classicDeals(listingId: string): ClassicDealRow[] {
  const listing = getListing(listingId);
  if (!listing) return [];
  const property = getProperty(listing.propertyId);
  const location = property
    ? [property.city, property.state].filter(Boolean).join(", ")
    : "";
  const propertyType: PropertyType = property?.propertyType ?? "office";
  const brokerInitials = listing.internalBrokers.map((b) => initials(b.name));

  const own: ClassicDealRow = {
    id: listing.id,
    title: listing.name,
    dealId: getRefId(listing.id),
    dealType: listing.dealType,
    stage: listing.status,
    location,
    propertyType,
    brokerInitials,
    transactionValue: listing.transaction.salePrice,
    brokerageGross: listing.transaction.commissionAmount,
    openTasks: listing.tasks.filter((t) => t.status !== "complete").length,
    nextCriticalDate: listing.transaction.nextCriticalDate,
    listingId: listing.id,
  };

  // A lease deal on the building names the space it is for, and the property's
  // own units are where that name comes from — nothing here is invented.
  //
  // `||`, not `??`: a property with no address has `street: ''`, and an empty
  // first column reads as a broken row. Falls back to the deal's own name.
  const base = property?.street.trim() || listing.name;
  const unitLabel = property?.units[0]?.label;
  const companionTitle = (from: "street" | "unit") =>
    from === "unit" && unitLabel ? `${base} — ${unitLabel}` : base;

  const companions = COMPANIONS.map((c) => ({
    id: `${listing.id}-${c.suffix}`,
    title: companionTitle(c.titleFrom),
    dealId: c.dealId,
    dealType: c.dealType,
    stage: c.stage,
    location,
    propertyType,
    brokerInitials,
    transactionValue: c.transactionValue,
    brokerageGross: c.brokerageGross,
    openTasks: c.openTasks,
    nextCriticalDate:
      c.criticalInDays == null ? null : isoInDays(c.criticalInDays),
    listingId: null,
  }));

  return [own, ...companions];
}
