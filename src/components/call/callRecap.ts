import type { CallRecapSpecT } from "#/ai/generate/schemas";

const SENTIMENT_LABEL: Record<CallRecapSpecT["sentiment"], string> = {
  positive: "positive",
  neutral: "neutral",
  negative: "cool",
};

/**
 * Turn a CallRecapSpec into the "Al reports" message (light HTML) plus the
 * interactive card payload. Pure — no store or data writes here.
 */
export function composeRecapReport(
  recap: CallRecapSpecT,
  contactName: string,
): {
  message: string;
  tasks: { title: string; due: string | null }[];
  opportunity: { name: string; address: string } | null;
} {
  const points = recap.keyPoints.length
    ? ` ${recap.keyPoints.join(" ")}`
    : "";
  const message =
    `Here's your recap with <strong>${contactName}</strong> — the call felt ` +
    `${SENTIMENT_LABEL[recap.sentiment]}.${points}`;
  return { message, tasks: recap.tasks, opportunity: recap.opportunity };
}

/** Strip the light HTML for text-to-speech (voiceEngine also strips, but keep the
 * spoken line clean). */
export function recapSpeechText(message: string): string {
  return message.replace(/<[^>]+>/g, "");
}
