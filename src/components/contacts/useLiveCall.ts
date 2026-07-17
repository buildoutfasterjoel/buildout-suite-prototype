import { useCallback, useEffect, useRef, useState } from "react";
import type { Contact } from "#/data/types";
import {
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";

export type CallPhase = "calling" | "ringing" | "connected";

export interface LiveCall {
  phase: CallPhase;
  name: string;
  entity: string;
  phone: string;
  initials: string;
  /** Countdown number shown during the "calling" phase (3 → 1). */
  countdown: number;
  /** Seconds since the call connected (drives the "connected" timer). */
  elapsedSecs: number;
  muted: boolean;
}

/** `123` → `2:03`. */
export function formatDuration(secs: number): string {
  const mm = Math.floor(secs / 60);
  const ss = (secs % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

// ── Synthesized ring tone (Web Audio, no assets) ─────────────────────────────
// A classic North-American two-tone ring (440 + 480 Hz) pulsed on a loop. Only
// runs during the "ringing" phase; muteable. Kicked off by a user click, so it
// clears the browser autoplay gate.
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!_ctx) _ctx = new Ctor();
  return _ctx;
}

function playOneRing() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 1.4;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
  gain.gain.setValueAtTime(0.08, now + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  [440, 480].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + dur);
  });
}

/** A short ascending note played when the call connects. */
function playAnsweredCue() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.03);
  gain.gain.linearRampToValueAtTime(0, now + 0.35);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.linearRampToValueAtTime(880, now + 0.25);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.4);
}

/**
 * Drives the simulated outbound call: calling (countdown) → ringing → connected,
 * with a live timer, mute, and a synthesized ring tone. Hanging up before
 * connecting logs nothing; ending a connected call raises `pendingLog` so the
 * caller can pop the (mandatory) log-call modal.
 */
export function useLiveCall({ contact }: { contact: Contact | null }) {
  const [call, setCall] = useState<LiveCall | null>(null);
  // True from the moment a connected call ends until the log modal is submitted.
  const [pendingLog, setPendingLog] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringLoop = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedAt = useRef(0);
  const mutedRef = useRef(false);

  const stopRing = useCallback(() => {
    if (ringLoop.current) {
      clearInterval(ringLoop.current);
      ringLoop.current = null;
    }
  }, []);

  const startRing = useCallback(() => {
    stopRing();
    if (!mutedRef.current) playOneRing();
    // ~3s cadence so the demo doesn't drag (real US ring is 6s).
    ringLoop.current = setInterval(() => {
      if (!mutedRef.current) playOneRing();
    }, 3000);
  }, [stopRing]);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
    stopRing();
  }, [stopRing]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const toConnected = useCallback(() => {
    stopRing();
    playAnsweredCue();
    connectedAt.current = Date.now();
    setCall((c) => (c ? { ...c, phase: "connected", elapsedSecs: 0 } : c));
    ticker.current = setInterval(() => {
      setCall((c) =>
        c ? { ...c, elapsedSecs: Math.floor((Date.now() - connectedAt.current) / 1000) } : c,
      );
    }, 500);
  }, [stopRing]);

  const toRinging = useCallback(() => {
    setCall((c) => (c ? { ...c, phase: "ringing", countdown: 0 } : c));
    startRing();
    later(toConnected, 3400);
  }, [startRing, later, toConnected]);

  const startCall = useCallback((phone?: string) => {
    if (!contact) return;
    clearAll();
    mutedRef.current = false;
    setCall({
      phase: "calling",
      name: contactFullName(contact),
      entity: contact.company,
      phone: phone ?? contact.phone,
      initials: contactInitials(contact),
      countdown: 3,
      elapsedSecs: 0,
      muted: false,
    });
    let n = 3;
    const step = () => {
      n -= 1;
      if (n >= 1) {
        setCall((c) => (c ? { ...c, countdown: n } : c));
        later(step, 900);
      } else {
        toRinging();
      }
    };
    later(step, 900);
  }, [clearAll, contact, later, toRinging]);

  /** Abandon a call that never connected (calling / ringing) — nothing logged. */
  const hangUp = useCallback(() => {
    clearAll();
    setCall(null);
  }, [clearAll]);

  /** End a connected call — clears the bar and opens the mandatory log modal. */
  const endCall = useCallback(() => {
    clearAll();
    setCall(null);
    setPendingLog(true);
  }, [clearAll]);

  /** Dismiss the log modal (called once the user has logged the call). */
  const clearPendingLog = useCallback(() => setPendingLog(false), []);

  const toggleMute = useCallback(() => {
    setCall((c) => {
      if (!c) return c;
      const muted = !c.muted;
      mutedRef.current = muted;
      return { ...c, muted };
    });
  }, []);

  // Tear everything down if the contact page unmounts mid-call.
  useEffect(() => clearAll, [clearAll]);

  return { call, startCall, hangUp, endCall, toggleMute, pendingLog, clearPendingLog };
}
