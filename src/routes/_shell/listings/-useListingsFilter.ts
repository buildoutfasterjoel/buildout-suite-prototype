import { create } from "zustand";
import type { FilterSpecT } from "#/ai/generate/schemas";
import type { ListingsFacets } from "#/ai/resultNav";

/**
 * Bridge between the `filter_listings` agent tool and the Listings grid.
 * Holding the last generated `FilterSpec` here — rather than routing it
 * through props — lets the tool stash a spec and navigate to `/listings`
 * without the grid needing to exist yet; the grid picks it up via a
 * `useEffect` keyed on `spec` (see `src/routes/_shell/listings/index.tsx`).
 *
 * `facets` is the explicit-facet channel used by the assistant's result
 * summary cards (see `src/ai/resultNav.ts`): a "View in Deals" button pushes
 * concrete stage/deal-type/search values the grid applies directly, sidestepping
 * `FilterSpec`'s narrower saved-view vocabulary.
 */
interface ListingsFilterState {
  spec: FilterSpecT | null;
  facets: ListingsFacets | null;
  apply: (spec: FilterSpecT) => void;
  applyFacets: (facets: ListingsFacets) => void;
  clear: () => void;
}

export const useListingsFilter = create<ListingsFilterState>((set) => ({
  spec: null,
  facets: null,
  apply: (spec) => set({ spec }),
  applyFacets: (facets) => set({ facets }),
  clear: () => set({ spec: null, facets: null }),
}));
