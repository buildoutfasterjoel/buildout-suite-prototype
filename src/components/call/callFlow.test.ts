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
    tasks: [{ title: "Send comps", due: null }], opportunity: { name: "", address: "" },
  })),
}));

import "fake-indexeddb/auto";
import { callFlow, registerStopForCall, personaNote } from "./callFlow";
import { useCallStore } from "./useCallStore";
import { heroInbound } from "./heroInbound";
import { usePendingCallLog } from "./usePendingCallLog";
import { generateCallTurn, generateCallRecap } from "#/ai/generate";
import { addNote } from "#/data/actions";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";

const CONTACT = {
  id: "c1", firstName: "Marcus", lastName: "Pinckney", company: "Pinckney Holdings",
  phone: "843-555-0101", role: "owner", notes: "Retiring.",
} as never;

describe("callFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useCallStore.getState().reset();
    usePendingCallLog.getState().clear();
    registerStopForCall(null);
  });

  it("open() silences Otto, kills the mic, and starts the countdown at 5", () => {
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

  it("dialNow skips the remaining countdown and starts ringing", async () => {
    callFlow.open(CONTACT);
    expect(useCallStore.getState().phase).toBe("calling");
    expect(useCallStore.getState().countdown).toBe(5);
    callFlow.dialNow();
    expect(useCallStore.getState().phase).toBe("ringing");
    // The dropped countdown steps must not fire and drag it back to 'calling'.
    await vi.advanceTimersByTimeAsync(900 * 5);
    expect(useCallStore.getState().phase).not.toBe("calling");
  });

  it("dialNow is a no-op once past the countdown", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10); // → connected
    expect(useCallStore.getState().phase).toBe("connected");
    callFlow.dialNow();
    expect(useCallStore.getState().phase).toBe("connected");
  });

  it("noAnswer ends the attempt and queues a No Answer log", () => {
    callFlow.open(CONTACT);
    callFlow.noAnswer();
    expect(useCallStore.getState().phase).toBe("idle");
    const pending = usePendingCallLog.getState().pending;
    expect(pending).toMatchObject({ contactId: "c1", outcome: "No Answer" });
    expect(pending?.draft).toMatch(/no answer/i);
    expect(pending?.armHeroInbound).toBe(false);
  });

  it("hangUp resets the store and cancels audio", () => {
    callFlow.open(CONTACT);
    callFlow.hangUp();
    expect(cancel).toHaveBeenCalled();
    expect(useCallStore.getState().phase).toBe("idle");
    expect(useCallStore.getState().target).toBeNull();
  });

  /**
   * The recap travels with the pending log rather than being published at
   * hang-up: the rail's recap card reports a *logged* call, so it appears from
   * the broker's confirm in `GlobalLogCallModal`, not from behind a modal they
   * have not answered yet.
   */
  it("endCall hands the recap to the pending log and leaves idle", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10);
    useCallStore.getState().appendLine("you", "Hi Marcus");
    await callFlow.endCall();
    expect(useCallStore.getState().phase).toBe("idle");
    // Not on the store yet — that is the confirm's job.
    expect(useCallStore.getState().recap).toBeNull();
    expect(usePendingCallLog.getState().pending?.recap?.sentiment).toBe("positive");
  });

  it("queues the log with the hero flag, deferring the financials email to the confirm", async () => {
    const ds = generateDataset();
    useDataStore.setState({
      properties: new Map(ds.properties.map((p) => [p.id, p])),
      listings: new Map(ds.listings.map((l) => [l.id, l])),
      contacts: new Map(ds.contacts.map((c) => [c.id, c])),
      tasks: new Map(),
    } as never);
    const rosa = ds.contacts.find((c) => c.heroKey === "rosa")!;
    const armSpy = vi.spyOn(heroInbound, "arm").mockImplementation(() => {});

    useCallStore.getState().startTarget({
      contactId: rosa.id,
      name: `${rosa.firstName} ${rosa.lastName}`.trim(),
      entity: rosa.company,
      phone: rosa.phone,
      initials: "RD",
      firstName: rosa.firstName,
      role: rosa.role,
      note: "",
    });
    await callFlow.endCall();

    // Nothing is armed or written at hang-up: the pending log carries the hero
    // flag, and confirming it (GlobalLogCallModal) is what arms the email.
    expect(armSpy).not.toHaveBeenCalled();
    expect(addNote).not.toHaveBeenCalled();
    expect(usePendingCallLog.getState().pending).toMatchObject({
      contactId: rosa.id,
      armHeroInbound: true,
    });
    armSpy.mockRestore();
  });

  it("queues a non-hero call's log without the financials-email flag", async () => {
    const ds = generateDataset();
    useDataStore.setState({
      properties: new Map(ds.properties.map((p) => [p.id, p])),
      listings: new Map(ds.listings.map((l) => [l.id, l])),
      contacts: new Map(ds.contacts.map((c) => [c.id, c])),
      tasks: new Map(),
    } as never);
    const plain = ds.contacts.find((c) => c.heroKey !== "rosa" && !c.signal)!;
    const armSpy = vi.spyOn(heroInbound, "arm").mockImplementation(() => {});

    useCallStore.getState().startTarget({
      contactId: plain.id,
      name: `${plain.firstName} ${plain.lastName}`.trim(),
      entity: plain.company,
      phone: plain.phone,
      initials: "XX",
      firstName: plain.firstName,
      role: plain.role,
      note: "",
    });
    await callFlow.endCall();

    expect(armSpy).not.toHaveBeenCalled();
    expect(usePendingCallLog.getState().pending).toMatchObject({
      contactId: plain.id,
      armHeroInbound: false,
    });
    armSpy.mockRestore();
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
      tasks: [{ title: "Send comps", due: null }], opportunity: { name: "", address: "" },
    });
    await endPromise;

    expect(addNote).not.toHaveBeenCalled(); // nothing is written until the log is confirmed
    expect(usePendingCallLog.getState().pending).toBeNull(); // no blocking modal for a stale call
    expect(useCallStore.getState().recap).toBeNull(); // stale recap dropped, not surfaced
    expect(useCallStore.getState().phase).toBe("calling"); // new call's phase left untouched
  });

  it("drops an in-flight owner reply if hangUp happens before it resolves (talk-over guard)", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10); // countdown + ring → connect
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve(); // flush the opening owner turn seeded by toConnected

    expect(speak).toHaveBeenCalledTimes(1); // opening owner line spoken once

    let resolveTurn: (v: Awaited<ReturnType<typeof generateCallTurn>>) => void = () => {};
    vi.mocked(generateCallTurn).mockImplementationOnce(
      () => new Promise((resolve) => { resolveTurn = resolve; }),
    );

    callFlow.submitLine("Got a sec?"); // owner turn now pending on the deferred above

    callFlow.hangUp(); // hang up BEFORE the in-flight turn resolves — bumps session, resets store
    expect(useCallStore.getState().phase).toBe("idle");
    expect(useCallStore.getState().transcript).toHaveLength(0);

    resolveTurn({ ownerReply: "Sure, what's up?", suggestions: [], shouldEnd: false });
    await Promise.resolve();
    await Promise.resolve();

    // The guard (`mySession !== session || phase !== "connected"`, re-checked after
    // the await) must drop this turn silently: no extra speak, no appended line.
    // Without the guard, appendLine/speak would fire against the post-hangup store.
    expect(speak).toHaveBeenCalledTimes(1); // no 2nd call for the dropped reply
    expect(useCallStore.getState().transcript).toHaveLength(0); // still empty — not regrown
    expect(
      useCallStore.getState().transcript.some((l) => l.text === "Sure, what's up?"),
    ).toBe(false);
  });
});

describe("personaNote", () => {
  it("returns the broker's strategic prose unchanged when there are no call-log lines", () => {
    expect(personaNote("Retiring in 2 years, price sensitive.")).toBe(
      "Retiring in 2 years, price sensitive.",
    );
  });

  it("strips addNote()'s dated call-log lines, keeping only the strategic note", () => {
    const notes =
      "Retiring in 2 years, price sensitive.\n" +
      "2026-07-20: Call with Marcus Pinckney — positive. Open to a valuation.\n" +
      "2026-07-24: Call with Marcus Pinckney — neutral. Asked for more time.";
    expect(personaNote(notes)).toBe("Retiring in 2 years, price sensitive.");
  });

  it("returns an empty string for empty or undefined notes", () => {
    expect(personaNote(undefined)).toBe("");
    expect(personaNote("")).toBe("");
  });
});
