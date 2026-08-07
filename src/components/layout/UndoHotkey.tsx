import { useHotkey } from "@tanstack/react-hotkeys";
import { runUndo, useUndo } from "#/lib/undo";

/**
 * Arms the platform undo chord while an undo toast is up. `Mod+Z` resolves to
 * ⌘Z on macOS and Ctrl+Z elsewhere, so it matches the hint the toast prints.
 *
 * `ignoreInputs` leaves the browser's own text undo alone when the caret is in
 * a field — Mod chords don't get that treatment by default.
 */
export function UndoHotkey() {
  const armed = useUndo((s) => s.pending !== null);
  useHotkey("Mod+Z", () => runUndo(), { enabled: armed, ignoreInputs: true });
  return null;
}
