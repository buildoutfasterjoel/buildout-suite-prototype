/**
 * Whether the app shell's left rail shows its labels.
 *
 * Two widths (Figma nodes 2482:5072 and 2482:5509): a 52px strip of section
 * icons, and a 220px column where every section is named and each group's
 * pages are listed beneath it. The hamburger in the top bar flips between them.
 *
 * Persisted under `dev_rail_expanded` so a reload keeps the chosen width. Like
 * `useNavMode`, the read/write pair is kept free of React and of a direct
 * `window` reference so it stays testable in Vitest's node environment; the
 * zustand store below is the React-facing half.
 */
import { create } from "zustand";

/** The slice of the Storage API this module needs. */
export type RailStore = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "dev_rail_expanded";

/**
 * Collapsed is the default: it is the width the shell has always had, so a
 * fresh browser looks the way every screenshot so far does. Expanding is the
 * broker's own choice, and it sticks.
 */
const DEFAULT_EXPANDED = false;

/** localStorage when there is a document, null during SSR. */
function browserStore(): RailStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * The persisted choice, or collapsed when absent, unrecognized, or on the
 * server. Only the literal strings are honoured, so a stale key can never
 * leave the rail at a width that no longer exists.
 */
export function readRailExpanded(
  store: RailStore | null = browserStore(),
): boolean {
  if (!store) return DEFAULT_EXPANDED;
  const stored = store.getItem(STORAGE_KEY);
  if (stored === "expanded") return true;
  if (stored === "collapsed") return false;
  return DEFAULT_EXPANDED;
}

export function writeRailExpanded(
  expanded: boolean,
  store: RailStore | null = browserStore(),
): void {
  store?.setItem(STORAGE_KEY, expanded ? "expanded" : "collapsed");
}

interface RailExpandedState {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  toggle: () => void;
}

/**
 * Starts collapsed rather than reading storage in its initializer: the server
 * has no storage, and a store that disagreed with the server would blow up
 * hydration. `AppShell` restores the persisted choice in an effect.
 */
export const useRailExpanded = create<RailExpandedState>((set) => ({
  expanded: DEFAULT_EXPANDED,
  setExpanded: (expanded) => {
    writeRailExpanded(expanded);
    set({ expanded });
  },
  toggle: () =>
    set((s) => {
      const expanded = !s.expanded;
      writeRailExpanded(expanded);
      return { expanded };
    }),
}));
