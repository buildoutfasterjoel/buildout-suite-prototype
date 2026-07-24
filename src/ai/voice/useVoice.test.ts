import { describe, it, expect, beforeEach } from "vitest";
import { useVoice } from "./useVoice";

describe("useVoice", () => {
  beforeEach(() => {
    useVoice.setState({
      voiceEnabled: true, muted: false, paused: false,
      speaking: false, listening: false, conversationMode: false,
    });
  });

  it("defaults to voice enabled, nothing active", () => {
    const s = useVoice.getState();
    expect(s.voiceEnabled).toBe(true);
    expect(s.speaking).toBe(false);
    expect(s.conversationMode).toBe(false);
  });

  it("setters update state", () => {
    useVoice.getState().setVoiceEnabled(false);
    expect(useVoice.getState().voiceEnabled).toBe(false);
    useVoice.getState().setConversationMode(true);
    expect(useVoice.getState().conversationMode).toBe(true);
  });
});
