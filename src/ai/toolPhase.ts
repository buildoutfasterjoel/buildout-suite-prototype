import { create } from "zustand";

/**
 * What a running tool is actually doing right now, surfaced under its chip.
 *
 * The chip alone says a tool is running, not that it's making progress — and the
 * generative tools take long enough (a `draft_email` is a whole model call) that
 * a lone spinner reads as stuck. This carries the *real* phase: the tools report
 * it as they cross each step, so nothing here is a timer pretending to be
 * progress. If a tool reports nothing, the chip simply shows its elapsed time,
 * which is still honest evidence that something is happening.
 *
 * Keyed by tool name rather than by call id because that's all the chip knows —
 * `ToolChip` is handed a name and a running flag, and the same tool running
 * twice concurrently isn't a shape the rail produces.
 *
 * A zustand store rather than a module slot like `composerSend.ts`, because
 * unlike those this one has to re-render something when it changes.
 */
interface ToolPhaseState {
  /** Tool name → the phase it last reported. */
  phases: Record<string, string>;
  report: (tool: string, phase: string | null) => void;
}

export const useToolPhase = create<ToolPhaseState>((set) => ({
  phases: {},
  report: (tool, phase) =>
    set((s) => {
      if (phase === null) {
        if (!(tool in s.phases)) return s;
        const next = { ...s.phases };
        delete next[tool];
        return { phases: next };
      }
      if (s.phases[tool] === phase) return s;
      return { phases: { ...s.phases, [tool]: phase } };
    }),
}));

/**
 * Report where a tool has got to. Pass `null` on the way out to clear it.
 *
 * Imported straight into the tool implementations rather than threaded through
 * `createClientTools`, matching how they already reach `setPendingEmail` and the
 * data stores.
 */
export function reportPhase(tool: string, phase: string | null): void {
  useToolPhase.getState().report(tool, phase);
}

/**
 * Run `fn`, reporting `phase` for its duration and clearing on the way out —
 * including when it throws, so a failed tool doesn't strand its last phase on
 * screen for the next call to inherit.
 */
export async function withPhase<T>(
  tool: string,
  phase: string,
  fn: () => Promise<T>,
): Promise<T> {
  reportPhase(tool, phase);
  try {
    return await fn();
  } finally {
    reportPhase(tool, null);
  }
}
