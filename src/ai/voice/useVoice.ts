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
  /** The header speaker toggle — the ONLY way voice turns on. */
  toggleVoice: (on: boolean) => void;
}

export const useVoice = create<VoiceState>((set) => ({
  // Voice is off by default, and only the user turns it on (`toggleVoice`).
  // Nothing else may: starting the mic used to enable voice for the session,
  // which meant dictating one sentence signed the broker up for a talking
  // assistant they never asked for.
  voiceEnabled: false,
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
  toggleVoice: (on) => set({ voiceEnabled: on }),
}));
