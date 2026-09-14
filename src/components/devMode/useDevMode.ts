/**
 * Whether dev mode is on.
 *
 * Dev mode is a hidden layer of prototype tooling — overlays, inspectors,
 * whatever helps the person *building* the prototype rather than the person
 * being shown it. It is toggled with ⌘⇧D (Ctrl+Shift+D off a Mac) and
 * announced by the pink bar in the bottom-left (`DevModeBar`), so nothing it
 * exposes can be mistaken for product UI.
 *
 * Persisted under `dev_mode` so a reload mid-session doesn't turn it off.
 * Only the literal string `"on"` enables it: a stale or garbled value must
 * read as off, because the failure mode of guessing wrong is dev tooling in
 * the corner of a demo. Kept free of React and of a direct `window` reference
 * for the same reason `useNavMode` is — see that file.
 */
import { create } from "zustand";

/** The slice of the Storage API this module needs. */
export type DevModeStore = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "dev_mode";

const DEFAULT_ENABLED = false;

/** localStorage when there is a document, null during SSR. */
function browserStore(): DevModeStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * The persisted setting, or off when absent, unrecognized, or on the server.
 */
export function readDevModeEnabled(
  store: DevModeStore | null = browserStore(),
): boolean {
  if (!store) return DEFAULT_ENABLED;
  return store.getItem(STORAGE_KEY) === "on";
}

export function writeDevModeEnabled(
  enabled: boolean,
  store: DevModeStore | null = browserStore(),
): void {
  store?.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

interface DevModeState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

/**
 * Starts off rather than reading storage in its initializer: the server has no
 * storage, and a store that disagreed with the server would blow up hydration.
 * `DevModeBar` restores the persisted choice in an effect, which runs after the
 * first commit and so can only ever *add* the bar.
 */
export const useDevMode = create<DevModeState>((set) => ({
  enabled: DEFAULT_ENABLED,
  setEnabled: (enabled) => {
    writeDevModeEnabled(enabled);
    set({ enabled });
  },
  toggle: () =>
    set((s) => {
      const enabled = !s.enabled;
      writeDevModeEnabled(enabled);
      return { enabled };
    }),
}));
