import { create } from "zustand";
import { dismissNotify, notify } from "#/lib/notify";

/**
 * A one-slot undo offer. Something the user just did pops a toast carrying an
 * "Undo" button, and for as long as that toast is up the platform undo chord
 * (⌘Z / Ctrl+Z) runs the same thing — see `UndoHotkey`, which arms itself off
 * the `pending` slot here.
 *
 * Deliberately one slot, not a stack: a second offer replaces the first, so the
 * chord always undoes the most recent action and never something the user has
 * forgotten about.
 */

/** How long the offer stays live, in ms — also the toast's timer. */
const UNDO_MS = 7000;

/**
 * Extra ms the chord stays armed past the toast timer, covering the toast's
 * exit animation. (Base UI pauses that timer while the toast is hovered, so a
 * hovered toast can outlive its window — an accepted trade for not reaching
 * into Blueprint's toast internals to track the real lifetime.)
 */
const GRACE_MS = 500;

interface Pending {
  toastId: string;
  run: () => void;
}

export const useUndo = create<{ pending: Pending | null }>(() => ({
  pending: null,
}));

/** Bare `setTimeout`, not `window.`'s — this module is exercised under Node too. */
let timer: ReturnType<typeof setTimeout> | null = null;

function clear(dismissToast: boolean): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  const { pending } = useUndo.getState();
  if (!pending) return;
  if (dismissToast) dismissNotify(pending.toastId);
  useUndo.setState({ pending: null });
}

/**
 * ⌘Z on Apple hardware, Ctrl+Z everywhere else — matching what the `Mod+Z`
 * hotkey actually resolves to on this device.
 */
export function undoShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+Z";
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘Z" : "Ctrl+Z";
}

/** Run the pending undo, if there is one, and take its toast down with it. */
export function runUndo(): void {
  const { pending } = useUndo.getState();
  if (!pending) return;
  clear(true);
  pending.run();
}

/**
 * Announce something the user just did, with a way back out of it. The keyboard
 * hint goes in the description because the button has to stay a crisp "Undo".
 */
export function offerUndo({
  title,
  description,
  onUndo,
}: {
  title: string;
  /** What was acted on — the task's name, say. */
  description?: string;
  onUndo: () => void;
}): void {
  clear(true);
  const hint = `Press ${undoShortcutLabel()} to undo`;
  const toastId = notify({
    title,
    description: description ? `${description} · ${hint}` : hint,
    duration: UNDO_MS,
    action: { label: "Undo", onClick: runUndo },
  });
  useUndo.setState({ pending: { toastId, run: onUndo } });
  timer = setTimeout(() => clear(false), UNDO_MS + GRACE_MS);
}
