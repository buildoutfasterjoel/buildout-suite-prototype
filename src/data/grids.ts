import type { Grid, LeaseComp, SaleComp } from "#/components/grids/types";

/** Deterministic per-listing Grids data. Empty for now — no creation flow exists yet. */
export function getGridsData(
  listingId: string,
): { grids: Grid[]; saleComps: SaleComp[]; leaseComps: LeaseComp[] } {
  void listingId;
  return { grids: [], saleComps: [], leaseComps: [] };
}
