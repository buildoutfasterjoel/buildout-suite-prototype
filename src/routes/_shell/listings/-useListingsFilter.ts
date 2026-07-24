import { create } from "zustand";
import type { FilterSpecT } from "#/ai/generate/schemas";

/**
 * Bridge between the `filter_listings` agent tool (and the in-context
 * `AiFilterBox`) and the Listings grid. Holding the last generated
 * `FilterSpec` here — rather than routing it through props — lets the tool
 * stash a spec and navigate to `/listings` without the grid needing to exist
 * yet; the grid picks it up via a `useEffect` keyed on `spec` (see
 * `src/routes/_shell/listings/index.tsx`).
 */
interface ListingsFilterState {
  spec: FilterSpecT | null;
  apply: (spec: FilterSpecT) => void;
  clear: () => void;
}

export const useListingsFilter = create<ListingsFilterState>((set) => ({
  spec: null,
  apply: (spec) => set({ spec }),
  clear: () => set({ spec: null }),
}));
