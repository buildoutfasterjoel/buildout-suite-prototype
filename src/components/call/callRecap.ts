import type { CallRecapSpecT } from "#/ai/generate/schemas";

const SENTIMENT_LABEL: Record<CallRecapSpecT["sentiment"], string> = {
  positive: "positive",
  neutral: "neutral",
  negative: "cool",
};

/**
 * Turn a CallRecapSpec into the "Otto reports" message (light HTML) plus the
 * interactive card payload. Pure — no store or data writes here.
 */
export function composeRecapReport(
  recap: CallRecapSpecT,
  contactName: string,
): {
  /** Headline + detail as one string — what gets spoken, and the legacy shape. */
  message: string;
  /** "Here's your recap with X — the call felt Y." */
  headline: string;
  /** What was actually said, as prose. Empty when the recap carried no points. */
  detail: string;
  tasks: { title: string; due: string | null }[];
  opportunity: { name: string; address: string } | null;
} {
  const headline =
    `Here's your recap with <strong>${contactName}</strong> — the call felt ` +
    `${SENTIMENT_LABEL[recap.sentiment]}.`;
  // Split from the headline rather than run on after it: three key points
  // appended to the sentiment line read as one unbroken sentence, which is why
  // the card looked bare even when the recap wasn't — there was nothing to
  // distinguish the substance from the boilerplate in front of it.
  const detail = recap.keyPoints
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
  // `opportunity` is a required object on the spec (Anthropic strict output can't
  // express a nullable object); empty name/address means "no opportunity" → null.
  const opportunity = recap.opportunity.name.trim() ? recap.opportunity : null;
  return {
    message: detail ? `${headline} ${detail}` : headline,
    headline,
    detail,
    tasks: recap.tasks,
    opportunity,
  };
}

/** Strip the light HTML for text-to-speech (voiceEngine also strips, but keep the
 * spoken line clean). */
export function recapSpeechText(message: string): string {
  return message.replace(/<[^>]+>/g, "");
}
