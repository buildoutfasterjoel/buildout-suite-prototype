import { create } from "zustand";

/**
 * Conversation state for the editor's Otto panel.
 *
 * Deliberately its own store rather than a slice of `useEditorStore`: the thread
 * is chrome, not document data, and keeping it separate means the editor store
 * stays a pure model of the document. It also has to outlive the panel — the
 * component unmounts whenever the broker selects a block or switches rail tabs,
 * and a thread that vanished on every tab switch would read as broken.
 *
 * Phase 2 replaces `send` with a real call that streams a reply and applies
 * document edits. Nothing in `OttoPanel` should need to change when it does.
 */

/** One turn in the thread. */
export interface OttoMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/** The reply every ask gets until the agent is wired up. */
export const PLACEHOLDER_REPLY =
  "I can't change the document yet — that lands in a later phase. For now this is just the thread we'll have the conversation in.";

/** Beat before the placeholder lands, so the pending state is actually seen. */
const REPLY_DELAY_MS = 700;

interface OttoChatState {
  messages: OttoMessage[];
  /** True between an ask and its reply — drives the "Thinking…" line. */
  pending: boolean;
  send: (text: string) => void;
  reset: () => void;
}

let nextId = 0;
const message = (role: OttoMessage["role"], text: string): OttoMessage => ({
  id: `otto-${(nextId += 1)}`,
  role,
  text,
});

export const useOttoChat = create<OttoChatState>((set, get) => ({
  messages: [],
  pending: false,

  send: (text) => {
    const trimmed = text.trim();
    // Ignore a second ask while one is in flight — the composer disables its
    // send button, but a starter row can still be clicked.
    if (!trimmed || get().pending) return;

    set((s) => ({
      messages: [...s.messages, message("user", trimmed)],
      pending: true,
    }));

    setTimeout(() => {
      set((s) => ({
        messages: [...s.messages, message("assistant", PLACEHOLDER_REPLY)],
        pending: false,
      }));
    }, REPLY_DELAY_MS);
  },

  reset: () => set({ messages: [], pending: false }),
}));
