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

describe("useHandsFree — live transcript", () => {
  let instances: Array<{
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    useVoice.getState().setConversationMode(false);
    vi.restoreAllMocks();
  });

  /** One recognition event carrying the segments spoken so far. */
  const result = (...segments: string[]) => ({
    results: segments.map((transcript) => [{ transcript }]),
  });

  // The rail and the omni bar both type interim speech into their input, so a
  // misheard phrase is visible before it is sent. Only the settled transcript
  // is submitted — otherwise a half-spoken sentence goes to Otto.
  it("reports interim speech as it lands, and submits only after the pause", () => {
    const onInterim = vi.fn();
    const onSubmit = vi.fn();
    const { result: hook } = renderHook(() => useHandsFree({ onInterim, onSubmit }));

    act(() => { hook.current.start(); });
    act(() => { instances[0].onresult?.(result("call ")); });
    act(() => { instances[0].onresult?.(result("call ", "Rosa")); });

    expect(onInterim.mock.calls.map((c) => c[0])).toEqual(["call", "call Rosa"]);
    expect(onSubmit).not.toHaveBeenCalled();

    // Still inside the silence window — nothing sent yet.
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(400); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("call Rosa");
  });

  // Cancelling is not finishing: the transcript so far stays in the caller's
  // input (it was typed there by onInterim) but is never submitted.
  it("does not submit what was captured when the broker stops the mic", () => {
    const onSubmit = vi.fn();
    const { result: hook } = renderHook(() => useHandsFree({ onInterim: vi.fn(), onSubmit }));

    act(() => { hook.current.start(); });
    act(() => { instances[0].onresult?.(result("never mind")); });
    act(() => { hook.current.stop(); });
    act(() => { vi.advanceTimersByTime(5000); });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
