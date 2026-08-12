import { create } from "zustand";

/**
 * Shared open/close state for the AI Assistant panel, so the global navbar
 * launcher and the docked sidebar stay in sync without prop-drilling.
 */
interface AssistantUIState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /**
   * A message queued from another surface (e.g. omni search "Ask AI") to be
   * sent as soon as the sidebar mounts. The sidebar consumes and clears it.
   */
  pendingPrompt: string | null;
  /**
   * Open the assistant, queue a prompt to send, and request that the composer
   * input take focus — so the user is auto-answered and immediately ready to
   * type a follow-up.
   */
  ask: (prompt: string) => void;
  /** Read and clear the queued prompt (null if none). */
  consumePrompt: () => string | null;
  /**
   * An assistant line queued from another surface (e.g. the day-plan card's
   * "Call X" hand-off) to be appended to the transcript. Unlike `ask`, this is
   * the assistant *speaking*, not a prompt to answer — so it never hits the
   * model. The sidebar consumes and clears it.
   */
  pendingLine: string | null;
  /** Queue an assistant line into the transcript. */
  say: (line: string) => void;
  /** Read and clear the queued assistant line (null if none). */
  consumeLine: () => string | null;
  /** Bumped whenever a surface requests the composer input be focused. */
  focusNonce: number;
  /** True once Otto has greeted the broker this session (greeting fires once). */
  greetedThisSession: boolean;
  setGreeted: (greeted: boolean) => void;
}

export const useAssistant = create<AssistantUIState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  pendingPrompt: null,
  ask: (prompt) =>
    set((s) => ({ open: true, pendingPrompt: prompt, focusNonce: s.focusNonce + 1 })),
  consumePrompt: () => {
    const prompt = get().pendingPrompt;
    if (prompt !== null) set({ pendingPrompt: null });
    return prompt;
  },
  pendingLine: null,
  say: (pendingLine) => set({ open: true, pendingLine }),
  consumeLine: () => {
    const line = get().pendingLine;
    if (line !== null) set({ pendingLine: null });
    return line;
  },
  focusNonce: 0,
  greetedThisSession: false,
  setGreeted: (greetedThisSession) => set({ greetedThisSession }),
}));
