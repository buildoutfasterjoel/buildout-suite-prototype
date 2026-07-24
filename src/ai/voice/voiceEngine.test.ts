import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("#/ai/tts", () => ({
  tts: vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
  ttsConfigured: vi.fn(async () => ({ configured: false })), // force browser-speech path
}));

class FakeUtterance { text: string; onend: (() => void) | null = null; constructor(t: string) { this.text = t; } }
beforeEach(() => {
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance;
  (globalThis as Record<string, unknown>).speechSynthesis = {
    speak: (u: FakeUtterance) => setTimeout(() => u.onend?.(), 5),
    cancel: vi.fn(),
    getVoices: () => [],
  };
});

describe("voiceEngine", () => {
  it("speak() resolves after browser speech ends", async () => {
    const { voiceEngine } = await import("./voiceEngine");
    voiceEngine.__setTtsConfiguredForTest(false);
    await expect(voiceEngine.speak("hello there")).resolves.toBeUndefined();
  });

  it("cancel() force-resolves an in-flight speak and bumps generation", async () => {
    const { voiceEngine } = await import("./voiceEngine");
    voiceEngine.__setTtsConfiguredForTest(false);
    (globalThis as Record<string, unknown>).speechSynthesis = {
      speak: vi.fn(), cancel: vi.fn(), getVoices: () => [],   // never fires onend
    };
    const p = voiceEngine.speak("this will be cancelled");
    voiceEngine.cancel();
    await expect(p).resolves.toBeUndefined(); // settled despite no `ended`
  });

  it("resolves a superseded speak when a new speak supersedes it", async () => {
    const { voiceEngine } = await import("./voiceEngine");
    voiceEngine.__setTtsConfiguredForTest(false);
    (globalThis as Record<string, unknown>).speechSynthesis = {
      speak: vi.fn(), cancel: vi.fn(), getVoices: () => [],  // never fires onend
    };
    const a = voiceEngine.speak("first utterance");   // starts "playing", will hang without fix
    // Let A's async chain actually reach speechSynthesis.speak() (past its
    // `await ensureTtsReady()` suspension) before B supersedes it — otherwise
    // both calls stall on the same microtask and A bails via the pre-existing
    // "cancelled while suspended" guard instead of exercising the real bug.
    await Promise.resolve();
    const b = voiceEngine.speak("second utterance");  // supersedes A
    await expect(a).resolves.toBeUndefined();
    voiceEngine.cancel(); // settle B so the test doesn't leak a pending promise
    await expect(b).resolves.toBeUndefined();
  });
});
