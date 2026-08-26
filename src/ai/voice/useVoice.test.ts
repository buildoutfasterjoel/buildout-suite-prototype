import { describe, it, expect, beforeEach } from "vitest";
import { useVoice } from "./useVoice";

describe("useVoice", () => {
  beforeEach(() => {
    useVoice.setState({
      voiceEnabled: false, muted: false, paused: false,
      speaking: false, listening: false, conversationMode: false,
    });
  });

  it("defaults to voice disabled, nothing active", () => {
    const s = useVoice.getState();
    expect(s.voiceEnabled).toBe(false);
    expect(s.speaking).toBe(false);
    expect(s.conversationMode).toBe(false);
  });

  it("setters update state", () => {
    useVoice.getState().setVoiceEnabled(true);
    expect(useVoice.getState().voiceEnabled).toBe(true);
    useVoice.getState().setConversationMode(true);
    expect(useVoice.getState().conversationMode).toBe(true);
  });

  it("toggleVoice is the switch, both ways", () => {
    useVoice.getState().toggleVoice(true);
    expect(useVoice.getState().voiceEnabled).toBe(true);
    useVoice.getState().toggleVoice(false);
    expect(useVoice.getState().voiceEnabled).toBe(false);
  });

  // The mic used to enable voice for the session. It no longer may: opening the
  // mic sets `listening` (and the rail sets conversationMode) and nothing else,
  // so dictating one sentence can't sign the broker up for a talking assistant.
  it("listening and conversation mode never turn voice on", () => {
    useVoice.getState().setListening(true);
    useVoice.getState().setConversationMode(true);
    expect(useVoice.getState().voiceEnabled).toBe(false);
  });
});
