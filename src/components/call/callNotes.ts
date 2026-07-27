import type { CallRecapSpecT } from "#/ai/generate/schemas";
import type { HeroKey } from "#/data/types";

/**
 * Turns a call recap into the notes the Log Call modal drafts for the broker.
 *
 * Two things make a call note useful: what was actually discussed, and what
 * happens next. The recap carries both — `keyPoints` and `tasks` — so the note
 * is composed from both rather than just the headline points.
 */

/**
 * Hand-authored summaries for the demo personas, used when the model is
 * unavailable (no API key → `callRecapFallback`, which can't say anything
 * specific). Without these the demo's marquee call logs "you spoke with Rosa;
 * review the transcript", which reads worse than the story deserves.
 */
const PERSONA_NOTES: Partial<Record<HeroKey, string>> = {
  rosa:
    "Returned Rosa's call about the loan documents she found in Miguel's papers — " +
    "the balloon note we'd talked about. She wants to understand her options: nothing " +
    "decided, no pressure applied. Warmest she's sounded — she offered to send the " +
    "building's T-12 and rent roll so I can see what it actually does before we talk " +
    "again.\n\nNext steps:\n" +
    "- Review the T-12 and rent roll when they land\n" +
    "- Follow up gently once I've read them — no ask",
};

/**
 * Whether a recap carries no real substance — i.e. the deterministic
 * `callRecapFallback` ran because the model was unavailable.
 *
 * Coupled to that fallback's phrasing on purpose, and pinned by a test that
 * feeds real `callRecapFallback` output through here, so changing one without
 * the other fails loudly rather than silently degrading the draft.
 */
export function isThinRecap(recap: CallRecapSpecT): boolean {
  const points = recap.keyPoints.filter((p) => p.trim().length > 0);
  if (points.length === 0) return true;
  if (points.length > 1) return false;
  return /review the transcript|ended before much was said/i.test(points[0]);
}

/** `["a.", "b"]` → `"a. b."` — keyPoints read as prose, not a bullet dump. */
function asProse(points: string[]): string {
  return points
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(" ");
}

/**
 * The draft call notes for a finished call: the persona's hand-authored summary
 * when the recap is thin, otherwise the AI's key points followed by its
 * follow-up tasks as explicit next steps.
 */
export function composeCallNotes(input: {
  recap: CallRecapSpecT;
  firstName: string;
  heroKey?: HeroKey;
}): string {
  const { recap, firstName, heroKey } = input;

  const persona = heroKey ? PERSONA_NOTES[heroKey] : undefined;
  if (persona && isThinRecap(recap)) return persona;

  const discussed = asProse(recap.keyPoints);
  const nextSteps = recap.tasks
    .map((t) => t.title.trim())
    .filter(Boolean)
    .map((title, i) => {
      const due = recap.tasks[i]?.due?.trim();
      return `- ${title}${due ? ` (${due})` : ""}`;
    });

  const body = discussed || `Call with ${firstName}.`;
  return nextSteps.length > 0
    ? `${body}\n\nNext steps:\n${nextSteps.join("\n")}`
    : body;
}
