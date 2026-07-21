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
  /** Bumped whenever a surface requests the composer input be focused. */
  focusNonce: number;
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
  focusNonce: 0,
}));
