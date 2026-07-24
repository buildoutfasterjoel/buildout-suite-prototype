// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { assembleTranscript, useHandsFree } from "./useHandsFree";
import { useVoice } from "./useVoice";
import * as notifyModule from "#/lib/notify";

describe("assembleTranscript", () => {
  it("joins all segments in order (continuous mode keeps earlier words)", () => {
    expect(assembleTranscript([
      { transcript: "call " }, { transcript: "Marcus " }, { transcript: "today" },
    ])).toBe("call Marcus today");
  });
  it("collapses whitespace and trims", () => {
    expect(assembleTranscript([{ transcript: "  hey   " }, { transcript: " there " }])).toBe("hey there");
  });
  it("returns empty string for no segments", () => {
    expect(assembleTranscript([])).toBe("");
  });
});

describe("useHandsFree — mic permission denied", () => {
  let instances: Array<{
    onerror: ((e: { error: string }) => void) | null;
    onresult: ((e: unknown) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
  }> = [];

  beforeEach(() => {
    instances = [];
    class FakeSpeechRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSpeechRecognition;
    useVoice.getState().setConversationMode(true);
  });

  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    useVoice.getState().setConversationMode(false);
    vi.restoreAllMocks();
  });

  it("notifies the user and exits conversation mode on not-allowed", () => {
    const notifySpy = vi.spyOn(notifyModule, "notify");
    const { result } = renderHook(() => useHandsFree({ onSubmit: vi.fn() }));

    act(() => { result.current.start(); });
    expect(instances).toHaveLength(1);

    act(() => { instances[0].onerror?.({ error: "not-allowed" }); });

    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Microphone unavailable" }),
    );
    expect(useVoice.getState().conversationMode).toBe(false);
  });
});
