/**
 * A soft two-note notification chime (Web Audio, no assets) for simulated
 * inbound events — e.g. Rosa's story emails arriving on the timeline. Mirrors
 * the synthesized ring tone in useLiveCall. Browsers allow audio here because
 * the arrival always follows real user gestures (sticky activation); if the
 * context is still suspended we try to resume and otherwise stay silent.
 */
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!_ctx) _ctx = new Ctor();
  return _ctx;
}

export function playArrivalChime(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const note = (freq: number, at: number, dur: number, peak: number) => {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + dur);
  };

  const now = ctx.currentTime;
  // E5 → A5, quick and quiet — a "new message" ding, not an alarm.
  note(659.25, now, 0.28, 0.06);
  note(880, now + 0.12, 0.38, 0.06);
}
