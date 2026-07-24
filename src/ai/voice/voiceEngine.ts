import { createGenerationGuard } from "./generationGuard";
import { prepForSpeech } from "./textPrep";
import { tts, ttsConfigured } from "#/ai/tts";
import { useVoice } from "./useVoice";

/**
 * Imperative voice singleton (voice-foundation design §5). Owns audio playback,
 * the browser-speech fallback, the generation guard, and cancel/pause/mute.
 * Callable from anywhere (React or a client-tool handler); reads reactive
 * gates from the useVoice store.
 */
function createVoiceEngine() {
  const guard = createGenerationGuard();
  let audio: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let ttsReady: boolean | null = null;
  let pendingResolve: (() => void) | null = null;
  let currentUrl: string | null = null;

  function settle() {
    const r = pendingResolve;
    pendingResolve = null;
    r?.();
  }

  async function ensureTtsReady(): Promise<boolean> {
    if (ttsReady !== null) return ttsReady;
    try {
      ttsReady = (await ttsConfigured()).configured;
    } catch {
      ttsReady = false;
    }
    return ttsReady;
  }

  function stopPlayback() {
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  function speakViaBrowser(text: string, gen: number): Promise<void> {
    return new Promise<void>((resolve) => {
      pendingResolve = resolve;
      // A cancel() may have landed while `speak` was suspended (e.g. on the
      // `await ensureTtsReady()` microtask tick) before we ever reached this
      // executor — settle immediately rather than starting stale playback
      // that nothing will ever end.
      if (!guard.isCurrent(gen)) return settle();
      if (typeof speechSynthesis === "undefined") return settle();
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => { if (guard.isCurrent(gen)) settle(); };
      u.onerror = () => { if (guard.isCurrent(gen)) settle(); };
      speechSynthesis.speak(u);
    });
  }

  async function speakViaServer(text: string, voiceId: string | undefined, gen: number): Promise<void> {
    let res: Response;
    try {
      res = (await tts({ data: { text, voiceId } })) as unknown as Response;
    } catch {
      return speakViaBrowser(text, gen);
    }
    if (!guard.isCurrent(gen)) return;              // superseded during fetch — drop
    let url: string;
    try {
      if (!res.ok) return speakViaBrowser(text, gen); // 503/502 → fallback
      url = URL.createObjectURL(await res.blob());
      if (!guard.isCurrent(gen)) {                    // superseded during blob read — drop, avoid leak
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      return speakViaBrowser(text, gen);
    }
    currentUrl = url;
    return new Promise<void>((resolve) => {
      pendingResolve = resolve;
      const el = new Audio(url);
      audio = el;
      const revoke = () => {
        if (currentUrl === url) {
          URL.revokeObjectURL(url);
          currentUrl = null;
        }
      };
      el.onended = () => { if (guard.isCurrent(gen)) { revoke(); settle(); } };
      el.onerror = () => { if (guard.isCurrent(gen)) { revoke(); settle(); } };
      void el.play().catch(() => { if (guard.isCurrent(gen)) settle(); });
    });
  }

  return {
    unlock() {
      try {
        const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
        const AC = Ctx.AudioContext ?? Ctx.webkitAudioContext;
        if (AC) {
          audioCtx = audioCtx ?? new AC();
          void audioCtx.resume();
        }
        const silent = new Audio(
          "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA",
        );
        silent.volume = 0;
        void silent.play().catch(() => {});
      } catch { /* unlock is best-effort */ }
    },

    async speak(text: string, opts?: { voiceId?: string }): Promise<void> {
      const store = useVoice.getState();
      if (!store.voiceEnabled || store.muted) return;
      const clean = prepForSpeech(text);
      if (!clean) return;
      const gen = guard.next();     // supersede any prior speak
      stopPlayback();
      settle();                     // resolve any still-pending prior speak before we overwrite it
      useVoice.setState({ speaking: true });
      try {
        if (await ensureTtsReady()) await speakViaServer(clean, opts?.voiceId, gen);
        else await speakViaBrowser(clean, gen);
      } finally {
        if (guard.isCurrent(gen)) useVoice.setState({ speaking: false });
      }
    },

    cancel() {
      guard.next();                 // invalidate in-flight speak
      stopPlayback();
      useVoice.setState({ speaking: false });
      settle();                     // force-resolve awaiters (pause() fires no `ended`)
    },

    pause() { audio?.pause(); if (typeof speechSynthesis !== "undefined") speechSynthesis.pause(); },
    resume() { void audio?.play().catch(() => {}); if (typeof speechSynthesis !== "undefined") speechSynthesis.resume(); },
    isSpeaking() { return useVoice.getState().speaking; },

    /** Test-only: force the server-TTS readiness flag. */
    __setTtsConfiguredForTest(v: boolean) { ttsReady = v; },
  };
}

export const voiceEngine = createVoiceEngine();
