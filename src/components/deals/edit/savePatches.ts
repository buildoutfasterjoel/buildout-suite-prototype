import type {
  DealBroker,
  DealMarketing,
  DealPitchFinancials,
  DealTransaction,
  DealType,
  Listing,
  Property,
  PropertyStatus,
  RentRollRow,
} from "#/data/types";

/**
 * Who owns which deal/property fields now that the edit form is two pages.
 * Each page holds its own draft, so each save here writes only the keys its
 * page owns and takes everything else off the live record — otherwise
 * whichever page saves second would silently revert the other, or a write
 * from outside either page (the stage gate, the Spaces roster, seeding) made
 * mid-edit.
 *
 * Seven keys are shared this way: `financials.rentRoll` (Listing page's Units
 * section, inside a `financials` object the Deal page owns the rest of),
 * `marketing.spaceLeaseTerms` / `marketing.availableSqFt` (the stage gate,
 * inside a `marketing` object the Listing page owns the rest of),
 * `marketing.occupancySnapshot` (written only at seed/creation today, same
 * reasoning), `marketing.photos` / `marketing.links` (the Media page and a
 * suite's Media tab, same reasoning — see `listingSavePatch` below), and
 * `Property.units` (`addPropertyUnit`, off the property record the Listing
 * page otherwise owns). `listingSavePatch` and `propertySavePatch` cover the
 * two record types the Listing page saves; `dealSavePatch` covers the one the
 * Deal page saves.
 */

/** The Listing page's draft (`/listings/:id/listing`). */
export interface ListingDraft {
  marketing: DealMarketing;
  internalNotes: string;
  rentRoll: RentRollRow[];
}

/** The Deal page's draft (`/listings/:id/edit`). */
export interface DealDraft {
  status: PropertyStatus;
  dealType: DealType;
  internalBrokers: DealBroker[];
  outsideBrokers: DealBroker[];
  transaction: DealTransaction;
  financials: DealPitchFinancials;
}

/** `current` is the record as stored *at save time*, not at mount. */
export function listingSavePatch(
  current: Listing,
  draft: ListingDraft,
): Partial<Listing> {
  return {
    marketing: {
      ...draft.marketing,
      // Owned by the stage gate (`commitStageTransition`), not this form: a
      // gate commit made while this page sits open and dirty must not be
      // reverted by this draft's mount-time snapshot of these two.
      spaceLeaseTerms: current.marketing.spaceLeaseTerms,
      availableSqFt: current.marketing.availableSqFt,
      // Written only at seed/creation today (seed.ts, createListing.ts) —
      // nothing else touches it yet. Excluded anyway so a future roster-side
      // write can't be reverted by this draft's mount-time snapshot.
      occupancySnapshot: current.marketing.occupancySnapshot,
      // Owned exclusively by the Media page (and a suite's Media tab, which
      // patches this same building record) — not this form. This draft's
      // mount-time snapshot would otherwise revert a media edit made in
      // another tab while this page sat open.
      photos: current.marketing.photos,
      links: current.marketing.links,
      // `visualMedia` is deliberately NOT carved out here, unlike `photos` and
      // `links` above: this form's own `VisualMediaSection` legitimately edits
      // it too, so `draft.marketing.visualMedia` must win. Carving it out would
      // make this form's own visual-media edits unsavable.
    },
    internalNotes: draft.internalNotes,
    // Only `rentRoll` is ours; the rest of financials comes off the record.
    financials: { ...current.financials, rentRoll: draft.rentRoll },
  };
}

/**
 * `current` is the record as stored *at save time*, not at mount. `units` is
 * excluded because it is owned by `addPropertyUnit` (adding a space from the
 * property header), not by this form — writing the mount-time draft back would
 * delete a unit added while the page was open, orphaning the child space deal
 * that already points at it.
 */
export function propertySavePatch(
  current: Property,
  draft: Property,
): Partial<Property> {
  return { ...draft, units: current.units };
}

/** `current` is the record as stored *at save time*, not at mount. */
export function dealSavePatch(
  current: Listing,
  draft: DealDraft,
): Partial<Listing> {
  return {
    status: draft.status,
    dealType: draft.dealType,
    internalBrokers: draft.internalBrokers,
    outsideBrokers: draft.outsideBrokers,
    transaction: draft.transaction,
    // Everything but `rentRoll` is ours; that one stays as stored.
    financials: { ...draft.financials, rentRoll: current.financials.rentRoll },
  };
}
