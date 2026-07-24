import type {
  FilterSpecT,
  CallListSpecT,
  CallTurnSpecT,
  CallRecapSpecT,
  CallBriefSpecT,
  DraftReplySpecT,
  BovSpecT,
} from "./schemas";

/** §3.1 — deterministic filter when the model is unavailable: dumps the raw
 * query into search and leaves everything else unset. */
export function filterFallback(query: string): FilterSpecT {
  return {
    search: query.trim(),
    savedView: "all",
    assetClass: null,
    saleLease: null,
    explanation: `Showing everything matching “${query.trim()}”.`,
  };
}

/** Local recency/stage ranking used when the model is unavailable (§3.3). */
export function callListFallback(
  contacts: Array<{ id: string; lastContactedAt: string | null; relationship: string }>,
): CallListSpecT {
  const stageWeight: Record<string, number> = { pitching: 5, active: 4, nurturing: 3, client: 2, cold: 1, past_client: 1 };
  const ranked = [...contacts]
    .sort((a, b) => {
      const sw = (stageWeight[b.relationship] ?? 0) - (stageWeight[a.relationship] ?? 0);
      if (sw !== 0) return sw;
      const at = a.lastContactedAt ? Date.parse(a.lastContactedAt) : 0;
      const bt = b.lastContactedAt ? Date.parse(b.lastContactedAt) : 0;
      return at - bt; // oldest touch first
    })
    .slice(0, 8);
  return {
    headline: "Ranked by stage and how long since your last touch.",
    calls: ranked.map((c, i) => ({
      contactId: c.id,
      score: Math.max(40, 95 - i * 7),
      reason: "Overdue for a touch given their stage.",
    })),
  };
}

/** §3.7 — minimal owner turn when the model is unavailable: the owner nudges
 * the broker to keep talking and never ends the call on its own. */
export function callTurnFallback(): CallTurnSpecT {
  return { ownerReply: "Mhm, go on.", suggestions: [], shouldEnd: false };
}

/** §3.4 — deterministic recap when the model is unavailable: a neutral summary
 * derived from the transcript plus one generic follow-up task on the contact. */
export function callRecapFallback(
  transcript: { speaker: "you" | "them"; text: string }[],
  contactFirstName: string,
): CallRecapSpecT {
  const spoke = transcript.length > 0;
  return {
    sentiment: "neutral",
    keyPoints: spoke
      ? [`You spoke with ${contactFirstName}; review the transcript for details.`]
      : [`Call with ${contactFirstName} ended before much was said.`],
    tasks: [{ title: `Follow up with ${contactFirstName}`, due: null }],
    opportunity: { name: "", address: "" },
  };
}

/** §4.1 — deterministic pre-call brief from the signal when the model is
 * unavailable. */
export function callBriefFallback(signalDetail: string, firstName: string): CallBriefSpecT {
  return {
    opener: `Hi ${firstName}, it's Otto's broker — do you have thirty seconds? I'll be quick.`,
    leadWith: signalDetail || "Lead with the timing pressure on their asset, not a listing pitch.",
    ask: "Ask for a short conversation this week — no listing talk, just options.",
    voicemail: `${firstName}, quick call about your building — there's a time-sensitive angle worth two minutes. Call me back when you get a sec.`,
  };
}

/** §3.6 — deterministic owner reply when the model is unavailable. */
export function draftReplyFallback(firstName: string): DraftReplySpecT {
  return {
    tone: "interested",
    body:
      `Good speaking with you. I've attached the current rent roll and the T-12 — ` +
      `take a look and let me know what you think the building could trade for. ` +
      `Talk soon, ${firstName}.`,
  };
}

/** §4.1 — deterministic BOV narrative when the model is unavailable: grounds
 * the headline/rationale in the given value range and notes the occupancy
 * gap only when a mismatch is present. */
export function bovFallback(
  valueLow: number,
  valueHigh: number,
  mismatch: { isMismatch: boolean; stated: number; actual: number },
): BovSpecT {
  const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
  return {
    headline: `Positioned at ${money(valueLow)}–${money(valueHigh)} on in-place income.`,
    rationale:
      `The range reflects trailing net operating income capitalized at market and adjusted ` +
      `for the asset's condition and submarket. It brackets a defensible clearing price for a ` +
      `qualified buyer.`,
    occupancyNote: mismatch.isMismatch
      ? `Note: marketing shows ${mismatch.stated}% occupancy, but the T-12 reflects ${mismatch.actual}%. ` +
        `The value is priced on the lower in-place occupancy.`
      : "",
  };
}
