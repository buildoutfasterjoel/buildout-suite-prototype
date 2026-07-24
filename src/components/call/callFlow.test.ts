import { describe, it, expect, beforeEach, vi } from "vitest";

const { cancel, speak } = vi.hoisted(() => ({
  cancel: vi.fn(),
  speak: vi.fn(() => Promise.resolve()),
}));
vi.mock("#/ai/voice/voiceEngine", () => ({ voiceEngine: { cancel, speak } }));
vi.mock("#/ai/voice/ownerVoice", () => ({ ownerVoiceFor: () => "voice-x" }));
vi.mock("#/data/actions", () => ({ addNote: vi.fn() }));
vi.mock("#/ai/generate", () => ({
  generateCallTurn: vi.fn(async () => ({
    ownerReply: "Who's this?", suggestions: ["It's Ethan.", "Got a sec?", "Bad time?"], shouldEnd: false,
  })),
  generateCallRecap: vi.fn(async () => ({
    sentiment: "positive", keyPoints: ["Open to a valuation."],
    tasks: [{ title: "Send comps", due: null }], opportunity: null,
  })),
}));

import { callFlow, registerStopForCall } from "./callFlow";
import { useCallStore } from "./useCallStore";
import { generateCallTurn, generateCallRecap } from "#/ai/generate";
import { addNote } from "#/data/actions";

const CONTACT = {
  id: "c1", firstName: "Marcus", lastName: "Pinckney", company: "Pinckney Holdings",
  phone: "843-555-0101", role: "owner", notes: "Retiring.",
} as never;

describe("callFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useCallStore.getState().reset();
    registerStopForCall(null);
  });

  it("open() silences Al, kills the mic, and starts the countdown at 5", () => {
    const stop = vi.fn();
    registerStopForCall(stop);
    callFlow.open(CONTACT);
    expect(cancel).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
    const s = useCallStore.getState();
    expect(s.phase).toBe("calling");
    expect(s.countdown).toBe(5);
    expect(s.target?.name).toBe("Marcus Pinckney");
  });

  it("advances calling → ringing → connected and seeds the opening owner line", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10); // countdown + ring → connect
    expect(useCallStore.getState().phase).toBe("connected");
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(generateCallTurn).toHaveBeenCalled();
    expect(useCallStore.getState().transcript.some((l) => l.speaker === "them")).toBe(true);
  });

  it("submitLine is a no-op when not connected", () => {
    callFlow.open(CONTACT); // still 'calling'
    callFlow.submitLine("hello?");
    expect(useCallStore.getState().transcript).toHaveLength(0);
  });

  it("hangUp resets the store and cancels audio", () => {
    callFlow.open(CONTACT);
    callFlow.hangUp();
    expect(cancel).toHaveBeenCalled();
    expect(useCallStore.getState().phase).toBe("idle");
    expect(useCallStore.getState().target).toBeNull();
  });

  it("endCall on a connected call sets a recap and leaves idle", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10);
    useCallStore.getState().appendLine("you", "Hi Marcus");
    await callFlow.endCall();
    expect(useCallStore.getState().phase).toBe("idle");
    expect(useCallStore.getState().recap?.sentiment).toBe("positive");
  });

  it("drops a stale recap if a new call starts before endCall's fetch resolves", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10);
    useCallStore.getState().appendLine("you", "Hi Marcus");

    let resolveRecap: (v: Awaited<ReturnType<typeof generateCallRecap>>) => void = () => {};
    vi.mocked(generateCallRecap).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRecap = resolve; }),
    );

    const endPromise = callFlow.endCall(); // recap fetch now pending on the deferred above

    callFlow.open(CONTACT); // a new call starts before the recap resolves — bumps session
    expect(useCallStore.getState().phase).toBe("calling");

    resolveRecap({
      sentiment: "positive", keyPoints: ["Open to a valuation."],
      tasks: [{ title: "Send comps", due: null }], opportunity: null,
    });
    await endPromise;

    expect(addNote).toHaveBeenCalled(); // logging the completed call is unconditional
    expect(useCallStore.getState().recap).toBeNull(); // stale recap dropped, not surfaced
    expect(useCallStore.getState().phase).toBe("calling"); // new call's phase left untouched
  });
});
