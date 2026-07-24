import { create } from "zustand";

/**
 * Reactive voice UI state (voice-foundation design §6.1). The imperative work
 * lives in voiceEngine; this store only holds flags the UI renders from.
 */
interface VoiceState {
  voiceEnabled: boolean;
  muted: boolean;
  paused: boolean;
  speaking: boolean;
  listening: boolean;
  conversationMode: boolean;
  setVoiceEnabled: (b: boolean) => void;
  setMuted: (b: boolean) => void;
  setPaused: (b: boolean) => void;
  setSpeaking: (b: boolean) => void;
  setListening: (b: boolean) => void;
  setConversationMode: (b: boolean) => void;
}

export const useVoice = create<VoiceState>((set) => ({
  voiceEnabled: true,
  muted: false,
  paused: false,
  speaking: false,
  listening: false,
  conversationMode: false,
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setMuted: (muted) => set({ muted }),
  setPaused: (paused) => set({ paused }),
  setSpeaking: (speaking) => set({ speaking }),
  setListening: (listening) => set({ listening }),
  setConversationMode: (conversationMode) => set({ conversationMode }),
}));
