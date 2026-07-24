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

/** §3.2 — plain-English intent → broker outreach `EmailDraftSpec`. */
export const EMAIL_PROMPT = `You draft a broker outreach email about a commercial property. Rules:
- Warm but direct, American CRE conventions, no salesy fluff. Reference 1–2 concrete property details. End with a clear next step. Body UNDER 140 words. Subject under 70 chars.
- If recipients are supplied, address them by first name and use their exact emails; do not invent extras. If none supplied, invent 1–3 plausible reps at major brokerages as the audience (to[] as "First Last <email>").
- body has no signature; signature is a short broker sign-off.
Return only the structured object.`;
