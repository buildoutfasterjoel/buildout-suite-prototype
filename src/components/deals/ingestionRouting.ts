import type { IngestionConflict, IngestionFieldKey } from "#/data/types";

/** The two pages the deal edit form was split into. */
export type ConflictPage = "deal" | "listing";

/**
 * Which edit page each ingestion-conflict field lives on. Replaces the two-tab
 * `CONFLICT_TAB`: the fields did not move, the tabs became pages.
 *
 * Stated exactly once, and read three ways — the banner picks a link with it,
 * each page counts its own badge with it, and each page picks its scroll target
 * with it. A field missing here would be unresolvable.
 */
export const CONFLICT_PAGE: Record<IngestionFieldKey, ConflictPage> = {
  askingPrice: "deal",
  noi: "deal",
  occupancyPct: "listing",
};

/** The conflict field keys a page owns. */
export function conflictKeysOn(page: ConflictPage): IngestionFieldKey[] {
  return (Object.keys(CONFLICT_PAGE) as IngestionFieldKey[]).filter(
    (key) => CONFLICT_PAGE[key] === page,
  );
}

/** The page a given page's conflict fields are NOT on — the cross-page link
 * each page's header shows once its own badge count drops to zero. */
export function otherPage(page: ConflictPage): ConflictPage {
  return page === "deal" ? "listing" : "deal";
}

/**
 * Where "Review fields" should land: the page holding the first conflict the
 * broker has not settled, so they are not left hunting across two pages.
 *
 * Falls back to the listing page, which is where the bulk of ingested content
 * lands — the banner only renders while something is unresolved, so the
 * fallback is a formality rather than a real destination.
 */
export function ingestionReviewTarget(
  conflicts: IngestionConflict[],
): ConflictPage {
  const first = conflicts.find((c) => !c.resolution);
  return first ? CONFLICT_PAGE[first.fieldKey] : "listing";
}

/** The first unresolved conflict *this* page owns — the review-mode scroll target. */
export function firstUnresolvedOn(
  conflicts: IngestionConflict[],
  page: ConflictPage,
): IngestionFieldKey | null {
  const keys = conflictKeysOn(page);
  return (
    conflicts.find((c) => !c.resolution && keys.includes(c.fieldKey))?.fieldKey ??
    null
  );
}
