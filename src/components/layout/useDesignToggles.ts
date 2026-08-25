/**
 * Whether the floating design-options button is on screen.
 *
 * `ContactDesignToggles` — the paintbrush in the lower-left of the contact
 * detail page and the Pipeline board — exists so two design treatments can be
 * compared live. That's a reviewer's tool, not part of the product, and it sits
 * in the corner of every screenshot taken of those pages. So it's off by
 * default and turned on from the account menu when someone actually wants to
 * flip between treatments.
 *
 * This is only the button's *visibility*. Which treatment each switch selects
 * still lives in `useContactUiPrefs`, and hiding the button leaves those
 * settings exactly as they were.
 *
 * Persisted under `dev_design_toggles`, and kept free of React and of a direct
 * `window` reference for the same reason `useNavMode` is — see that file.
 */
import { create } from "zustand";

/** The slice of the Storage API this module needs. */
export type DesignTogglesStore = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "dev_design_toggles";

const DEFAULT_SHOWN = false;

/** localStorage when there is a document, null during SSR. */
function browserStore(): DesignTogglesStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * The persisted setting, or hidden when absent, unrecognized, or on the server.
 * Only the literal string `"show"` turns it on, so a stale or garbled value can
 * never surface prototype scaffolding in a demo.
 */
export function readDesignTogglesShown(
  store: DesignTogglesStore | null = browserStore(),
): boolean {
  if (!store) return DEFAULT_SHOWN;
  return store.getItem(STORAGE_KEY) === "show";
}

export function writeDesignTogglesShown(
  shown: boolean,
  store: DesignTogglesStore | null = browserStore(),
): void {
  store?.setItem(STORAGE_KEY, shown ? "show" : "hide");
}

interface DesignTogglesState {
  shown: boolean;
  setShown: (shown: boolean) => void;
  toggle: () => void;
}

/**
 * Starts hidden rather than reading storage in its initializer: the server has
 * no storage, and a store that disagreed with the server would blow up
 * hydration. `AppShell` restores the persisted choice in an effect, which runs
 * after the first commit and so can only ever *add* the button.
 */
export const useDesignToggles = create<DesignTogglesState>((set) => ({
  shown: DEFAULT_SHOWN,
  setShown: (shown) => {
    writeDesignTogglesShown(shown);
    set({ shown });
  },
  toggle: () =>
    set((s) => {
      const shown = !s.shown;
      writeDesignTogglesShown(shown);
      return { shown };
    }),
}));
