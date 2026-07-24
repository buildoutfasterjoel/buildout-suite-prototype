import { useCallback, useEffect, useRef } from "react";
import { useVoice } from "./useVoice";
import { notify } from "#/lib/notify";

const SILENCE_MS = 3200;   // pause after speech starts → submit
const NO_START_MS = 10000; // wait this long for speech to begin at all

/** Pure: rebuild the full transcript from all recognition segments. */
export function assembleTranscript(results: Array<{ transcript: string }>): string {
  return results.map((r) => r.transcript).join("").replace(/\s+/g, " ").trim();
}

type SpeechRecognitionCtor = new () => {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Hands-free mic loop (voice-foundation design §6.2). Own silence timer, never
 * a perpetually-hot mic. The caller submits via onSubmit; interim text is NOT
 * sent — only the final transcript, after a silence pause.
 */
export function useHandsFree(opts: { onSubmit: (text: string) => void }) {
  const setListening = useVoice((s) => s.setListening);
  const setConversationMode = useVoice((s) => s.setConversationMode);
  const recRef = useRef<ReturnType<SpeechRecognitionCtor> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const supported = typeof window !== "undefined" && getRecognitionCtor() !== null;

  const clearTimers = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (startTimer.current) clearTimeout(startTimer.current);
    silenceTimer.current = null;
    startTimer.current = null;
  }, []);

  const teardown = useCallback(() => {
    clearTimers();
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
  }, [clearTimers, setListening]);

  const start = useCallback(() => {
    if (recRef.current) teardown(); // guard against re-entrant start() overwriting a live recognizer
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      notify({ title: "Voice input isn't supported here", description: "Type your message instead." });
      setConversationMode(false);
      return;
    }
    const rec = new Ctor();
    recRef.current = rec;
    transcriptRef.current = "";
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    const finish = () => {
      clearTimers();
      const text = transcriptRef.current.trim();
      teardown();
      if (text) opts.onSubmit(text);
    };

    startTimer.current = setTimeout(() => {
      if (!transcriptRef.current) {
        teardown();
        setConversationMode(false); // broker never spoke — end the loop, don't strand a dead mic
      }
    }, NO_START_MS);

    rec.onresult = (e) => {
      const segs = Array.from({ length: e.results.length }, (_, i) => ({ transcript: e.results[i][0].transcript }));
      transcriptRef.current = assembleTranscript(segs);
      if (startTimer.current) { clearTimeout(startTimer.current); startTimer.current = null; }
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(finish, SILENCE_MS);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech") return; // keep waiting
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        notify({ title: "Microphone unavailable", description: "Check mic permissions, or type your message instead." });
        setConversationMode(false);
        teardown();
        return;
      }
      teardown();
    };
    rec.onend = () => { /* silence timer drives submission; nothing to do here */ };

    setListening(true);
    try { rec.start(); } catch { teardown(); }
  }, [clearTimers, opts, setConversationMode, setListening, teardown]);

  /** Hard stop for when a live call opens (Phase 3) — no mic over call audio. */
  const stopForCall = useCallback(() => {
    teardown();
    setConversationMode(false);
  }, [teardown, setConversationMode]);

  useEffect(() => () => teardown(), [teardown]); // cleanup on unmount

  return { start, stopForCall, supported };
}
