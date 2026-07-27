import { create } from "zustand";

/**
 * Reactive voice UI state (voice-foundation design §6.1). The imperative work
 * lives in voiceEngine; this store only holds flags the UI renders from.
 */
interface VoiceState {
  voiceEnabled: boolean;
  /**
   * The user explicitly turned voice off via the toggle. Sticky: while set,
   * starting the mic won't auto-enable voice (a deliberate off is respected).
   * Cleared only by explicitly turning voice back on.
   */
  voiceMutedByUser: boolean;
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
  /** The header speaker toggle: on clears the manual-off flag; off sets it. */
  toggleVoice: (on: boolean) => void;
  /** Enable voice for a mic session, unless the user manually turned it off. */
  enableVoiceForMic: () => void;
}

export const useVoice = create<VoiceState>((set) => ({
  // Voice is off by default — the assistant is text-only until the user turns
  // voice on or starts the mic (see toggleVoice / enableVoiceForMic).
  voiceEnabled: false,
  voiceMutedByUser: false,
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
  toggleVoice: (on) =>
    set({ voiceEnabled: on, voiceMutedByUser: !on }),
  enableVoiceForMic: () =>
    set((s) => (s.voiceMutedByUser ? {} : { voiceEnabled: true })),
}));
