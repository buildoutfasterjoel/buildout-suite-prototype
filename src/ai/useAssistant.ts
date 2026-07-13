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
  /** Open the assistant and queue a prompt to send. */
  ask: (prompt: string) => void;
  /** Read and clear the queued prompt (null if none). */
  consumePrompt: () => string | null;
}

export const useAssistant = create<AssistantUIState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  pendingPrompt: null,
  ask: (prompt) => set({ open: true, pendingPrompt: prompt }),
  consumePrompt: () => {
    const prompt = get().pendingPrompt;
    if (prompt !== null) set({ pendingPrompt: null });
    return prompt;
  },
}));
