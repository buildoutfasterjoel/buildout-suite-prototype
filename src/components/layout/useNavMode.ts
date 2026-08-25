/**
 * Which global navigation chrome the prototype wears.
 *
 * Two shapes, switched from the account menu so a stakeholder can put them side
 * by side in one session:
 *
 * - **classic** — today's single full-width `GlobalNavbar`: brand, sections,
 *   omnibar, and the footer action cluster, all on one dark bar.
 * - **app** — a 48px icon rail down the left plus a top bar that carries only
 *   the brand, the omnibar, the Assistant pill, and the right-hand actions. The
 *   page content sits in a rounded container inside that frame, so the product
 *   reads as an application rather than a website (Figma node 193:3678).
 *
 * Persisted under `dev_nav_mode` so a reload keeps the chosen shape. Like
 * `viewAsRole`, the read/write pair is kept free of React and of a direct
 * `window` reference so it stays testable in Vitest's node environment; the
 * zustand store below is the React-facing half.
 */
import { create } from "zustand";

export type NavMode = "classic" | "app";

/** The slice of the Storage API this module needs. */
export type NavModeStore = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "dev_nav_mode";

/**
 * The app shell is the default: it's the shape the prototype is being taken
 * forward in, so a fresh browser should land on it. Classic stays reachable
 * from the same menu row for side-by-side comparison.
 */
const DEFAULT_MODE: NavMode = "app";

/** localStorage when there is a document, null during SSR. */
function browserStore(): NavModeStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isNavMode(value: string | null): value is NavMode {
  return value === "classic" || value === "app";
}

/** The persisted mode, or the default when absent, unrecognized, or on the server. */
export function readNavMode(
  store: NavModeStore | null = browserStore(),
): NavMode {
  if (!store) return DEFAULT_MODE;
  const stored = store.getItem(STORAGE_KEY);
  return isNavMode(stored) ? stored : DEFAULT_MODE;
}

export function writeNavMode(
  mode: NavMode,
  store: NavModeStore | null = browserStore(),
): void {
  store?.setItem(STORAGE_KEY, mode);
}

/** The label for the account-menu row that flips the mode. */
export function navModeLabel(mode: NavMode): string {
  return mode === "app" ? "App shell" : "Classic nav";
}

interface NavModeState {
  mode: NavMode;
  setMode: (mode: NavMode) => void;
  toggle: () => void;
}

/**
 * The store starts on the default rather than reading storage in its
 * initializer: the server has no storage, and a store that disagreed with the
 * server's value would blow up hydration. `AppShell` restores the persisted
 * choice in an effect, which is safe because every mode-dependent branch is
 * held behind its `mounted` flag until then.
 */
export const useNavMode = create<NavModeState>((set) => ({
  mode: DEFAULT_MODE,
  setMode: (mode) => {
    writeNavMode(mode);
    set({ mode });
  },
  toggle: () =>
    set((s) => {
      const mode: NavMode = s.mode === "app" ? "classic" : "app";
      writeNavMode(mode);
      return { mode };
    }),
}));
