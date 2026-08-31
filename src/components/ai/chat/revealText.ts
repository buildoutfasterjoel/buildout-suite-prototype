/**
 * The pacing behind Otto's text reveal.
 *
 * ## Why a reveal exists at all
 *
 * AWS Amplify Hosting buffers SSR responses — it does not stream them. Our
 * server streams correctly (measured; see `docs/amplify-hosting.md`), but
 * Amplify's edge collects the whole reply and delivers it in a single chunk,
 * so on the deployed prototype Otto's answer lands all at once after a silence.
 * This paces it back out.
 *
 * **It is a visual effect over an already-complete response, not streaming.**
 * Nobody should later read fast-looking text on Amplify as evidence that the
 * buffering was fixed.
 *
 * ## Why it runs everywhere rather than only on Amplify
 *
 * The reveal never runs ahead of text that has actually arrived. Where
 * streaming works — local dev, the Vercel deploy — the reveal is already behind
 * the incoming text and barely changes what you see. Where it is buffered, the
 * same code types the answer out. No environment detection, so there is no
 * detection to get wrong.
 */

/**
 * Characters per second at rest.
 *
 * Measured, not guessed: a real streamed 200-word reply took 5.9s for ~1,100
 * characters. Matching it is the whole point — the deployed reveal should look
 * like the local original, not like a typewriter.
 */
export const BASE_CHARS_PER_SEC = 190;

/**
 * Roughly how long a large backlog should take to drain, in seconds.
 *
 * A buffered reply arrives as one 1,500-character chunk. At the base rate alone
 * that would crawl for eight seconds, which reads as slow rather than live — so
 * the rate scales with the backlog and eases off as it catches up.
 */
const CATCH_UP_SECONDS = 3;

/** Below this many characters left, finish rather than inch toward the end. */
const SNAP_REMAINDER = 2;

/**
 * How far the reveal should have advanced after `dtMs`.
 *
 * Returns a fractional count — callers keep the fraction between frames and
 * floor only when slicing, so a slow frame doesn't quantise away progress.
 */
export function advanceReveal(revealed: number, total: number, dtMs: number): number {
  if (revealed >= total) return total;
  const backlog = total - revealed;
  // The faster of "a steady readable pace" and "drain this backlog in about
  // CATCH_UP_SECONDS". Because backlog shrinks as we go, the second term decays
  // on its own, which is what gives the ease-out rather than a linear crawl.
  const perSec = Math.max(BASE_CHARS_PER_SEC, backlog / CATCH_UP_SECONDS);
  const next = revealed + Math.max(1, (perSec * dtMs) / 1000);
  return next >= total - SNAP_REMAINDER ? total : next;
}

/**
 * Trim a reveal point back to the nearest word boundary.
 *
 * Without this the reveal cuts mid-word, and since each newly revealed word
 * fades in, a half-word would fade in and then silently grow — which reads as a
 * glitch rather than as typing. Whole words only.
 *
 * The final slice is exempt: at the end there is no following boundary to trim
 * to, and the last word must not be held back forever.
 */
export function sliceToWord(text: string, count: number): string {
  if (count >= text.length) return text;
  const cut = text.lastIndexOf(" ", count);
  // No boundary yet — the reply so far is one long first word. Show nothing
  // rather than a fragment; the next frame will almost always clear it.
  if (cut <= 0) return "";
  return text.slice(0, cut);
}
