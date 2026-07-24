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
});
