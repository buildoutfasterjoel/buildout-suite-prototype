import { create } from "zustand";
import {
  EMPTY_FACETS,
  type PropertyFacetState,
} from "#/components/properties/propertyIndexFilters";

/**
 * Session-wide UI state for the Properties index — the search box and the
 * facet dropdowns. Held outside the route component (mirrors
 * `useContactUiPrefs` / `useTaskUiPrefs`) so opening a property or a space and
 * coming back lands you on the filtered view you left, not a reset list. A full
 * page reload starts clean, matching the rest of the app's filters.
 *
 * The owned / prospecting mode is not here: it already persists across
 * reloads in localStorage (`properties:mode` in the route), because which half
 * you work in is a standing preference rather than a session's working state.
 */
interface PropertyUiPrefs {
  query: string;
  facets: PropertyFacetState;
  setQuery: (query: string) => void;
  setFacets: (facets: PropertyFacetState) => void;
}

export const usePropertyUiPrefs = create<PropertyUiPrefs>((set) => ({
  query: "",
  facets: EMPTY_FACETS,
  setQuery: (query) => set({ query }),
  setFacets: (facets) => set({ facets }),
}));
