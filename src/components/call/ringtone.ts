// Synthesized call tones (Web Audio, no assets), moved from the contact-page
// useLiveCall hook so the global call flow can reuse them.
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!_ctx) _ctx = new Ctor();
  return _ctx;
}

/** A classic North-American two-tone ring (440 + 480 Hz), one pulse. */
export function playOneRing() {
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
export function playAnsweredCue() {
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

/** `123` → `2:03`. */
export function formatDuration(secs: number): string {
  const mm = Math.floor(secs / 60);
  const ss = (secs % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
