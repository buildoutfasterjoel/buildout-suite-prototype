import type { FilterSpecT, CallListSpecT } from "./schemas";

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
