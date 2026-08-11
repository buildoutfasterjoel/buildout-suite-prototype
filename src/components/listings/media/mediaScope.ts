import type { DealMarketing, MediaAsset, MediaAssetKind } from "#/data/types";
import { buildingWide, ownedByUnit } from "#/data/unitScopedMarketing";

/**
 * What every Media section needs, and the reason one component set serves both
 * the building's page and a suite's.
 *
 * `patchMarketing` ALWAYS targets the building's listing — the building page
 * builds this from its own listing, a space page builds it from its shell. That
 * is the one-home rule: a unit's media lives in the building's `marketing`, and a
 * suite's Media tab is a filtered editor onto it. Expressed here, once, instead of
 * in every component.
 */
export interface MediaScope {
  /** The BUILDING's marketing, whichever page is rendering. */
  marketing: DealMarketing;
  /** Patches the BUILDING's marketing. Never a space's. */
  patchMarketing: (patch: Partial<DealMarketing>) => void;
  /** null = the building's own assets; a unit id = that suite's own. */
  unitId: string | null;
  /** Renders without upload or per-item controls. Used for the inherited block. */
  readOnly?: boolean;
}

/**
 * The assets of one kind in one scope — strictly owned, never inherited.
 *
 * Filters on `kind` rather than assuming, so a `floorPlan` with a null `unitId`
 * (which has no section to render in) is silently ignored instead of appearing in
 * the building's photo grid.
 */
export function assetsInScope(
  marketing: DealMarketing,
  unitId: string | null,
  kind: MediaAssetKind,
): MediaAsset[] {
  const all = marketing.photos ?? [];
  const scoped = unitId ? ownedByUnit(all, unitId) : buildingWide(all);
  return scoped.filter((a) => a.kind === kind);
}

export function removeAsset(all: MediaAsset[], id: string): MediaAsset[] {
  return all.filter((a) => a.id !== id);
}
