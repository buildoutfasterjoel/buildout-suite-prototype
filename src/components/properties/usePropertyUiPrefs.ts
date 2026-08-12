import { create } from "zustand";

/**
 * Prototype-only design switches for the Properties page, mirroring
 * `useContactUiPrefs`. Persisted to localStorage so a comparison survives a
 * reload — you're usually flipping back and forth across navigations.
 */

/**
 * How the page announces itself.
 *
 * - `banner` — a full-bleed header band above the content, matching Deals.
 * - `card` — headline, toolbar and results all inside one panel card, matching
 *   the People index.
 */
export type HeaderStyle = "banner" | "card";

const STORAGE_KEY = "properties:headerStyle";

interface PropertyUiPrefs {
  headerStyle: HeaderStyle;
  setHeaderStyle: (next: HeaderStyle) => void;
  /** Reads the stored choice — call from an effect, never during SSR render. */
  hydrate: () => void;
}

export const usePropertyUiPrefs = create<PropertyUiPrefs>((set) => ({
  headerStyle: "banner",

  setHeaderStyle: (next) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    set({ headerStyle: next });
  },

  hydrate: () => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "banner" || stored === "card") set({ headerStyle: stored });
  },
}));
