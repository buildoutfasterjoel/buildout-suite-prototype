import { describe, it, expect, beforeEach } from "vitest";
import { useVoice } from "./useVoice";

describe("useVoice", () => {
  beforeEach(() => {
    useVoice.setState({
      voiceEnabled: false, voiceMutedByUser: false, muted: false, paused: false,
      speaking: false, listening: false, conversationMode: false,
    });
  });

  it("defaults to voice disabled, nothing active", () => {
    const s = useVoice.getState();
    expect(s.voiceEnabled).toBe(false);
    expect(s.voiceMutedByUser).toBe(false);
    expect(s.speaking).toBe(false);
    expect(s.conversationMode).toBe(false);
  });

  it("setters update state", () => {
    useVoice.getState().setVoiceEnabled(true);
    expect(useVoice.getState().voiceEnabled).toBe(true);
    useVoice.getState().setConversationMode(true);
    expect(useVoice.getState().conversationMode).toBe(true);
  });

  it("toggleVoice on enables and clears the manual-off flag", () => {
    useVoice.setState({ voiceMutedByUser: true });
    useVoice.getState().toggleVoice(true);
    expect(useVoice.getState().voiceEnabled).toBe(true);
    expect(useVoice.getState().voiceMutedByUser).toBe(false);
  });

  it("toggleVoice off disables and sets the sticky manual-off flag", () => {
    useVoice.getState().toggleVoice(true);
    useVoice.getState().toggleVoice(false);
    expect(useVoice.getState().voiceEnabled).toBe(false);
    expect(useVoice.getState().voiceMutedByUser).toBe(true);
  });

  it("enableVoiceForMic turns voice on from the default off state", () => {
    useVoice.getState().enableVoiceForMic();
    expect(useVoice.getState().voiceEnabled).toBe(true);
  });

  it("enableVoiceForMic respects a manual off (stays silent)", () => {
    useVoice.getState().toggleVoice(false); // user deliberately muted
    useVoice.getState().enableVoiceForMic();
    expect(useVoice.getState().voiceEnabled).toBe(false);
    expect(useVoice.getState().voiceMutedByUser).toBe(true);
  });
});
