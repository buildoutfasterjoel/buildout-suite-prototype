import { create } from "zustand";
import type { UIMessage } from "@tanstack/ai-react";

/**
 * The editor Otto thread's transcript, held outside the panel.
 *
 * `OttoPanel` unmounts whenever the broker selects a block or switches rail
 * tabs, and `useChat` keeps its messages in component state — so without this
 * the conversation would vanish on every tab switch and read as broken. The
 * panel passes this transcript to `useChat` as its `initialMessages`, so a
 * remount's very first paint already has it, and writes back as it changes.
 *
 * Deliberately not a slice of `useEditorStore`: the thread is chrome, not
 * document data, and the editor store stays a pure model of the document.
 */
interface OttoThreadState {
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  reset: () => void;
}

export const useOttoThread = create<OttoThreadState>((set) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),
  reset: () => set({ messages: [] }),
}));
