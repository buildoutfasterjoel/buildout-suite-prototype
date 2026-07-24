/**
 * System prompts for one-shot structured generators (`src/ai/generate/generators.ts`).
 * Each prompt pairs with a schema in `schemas.ts` and a fallback in `fallbacks.ts`.
 */

/** §3.1 — plain-English listings query → structured `FilterSpec`. */
export const FILTER_PROMPT = `You convert a broker's plain-English listings query into a structured filter. Rules:
- City/place mentions → search. "stale/old/lingering" → savedView:"stale". "active" → "active-listings". "my deals/mine" → "my-deals". "under contract" → "under-contract". "chicago" as a saved view only if they clearly mean the Chicago book; otherwise put the city in search.
- Asset words (retail/office/multifamily/industrial/land) → assetClass. "for sale/asking price" → saleLease:"Sale"; "lease/$ per SF" → "Lease".
- If unclear, leave fields null/empty and say so in explanation.
- explanation is ONE plain-English sentence describing what you filtered to.
Return only the structured object.`;
