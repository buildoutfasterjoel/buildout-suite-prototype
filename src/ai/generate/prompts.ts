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

/** §3.3 — contact pool → ranked, dialable `CallListSpec`. */
export const CALL_LIST_PROMPT = `You pick and rank the 5–8 best people to call now from a supplied contact pool, given an optional property and intent. Rank by likelihood to convert using role, market, asset focus, relationship stage, and how long since the last interaction. Every contactId MUST be one of the supplied ids. reason is under 90 chars. Return only the structured object.`;

/** §3.4 — property → one-page marketing flyer `DocSpec`. */
export const DOC_PROMPT = `You write a one-page marketing flyer spec for a commercial property. Confident, factual, broker-grade, no fluff. Provide a hook tagline (<70 chars), a 2–3 sentence positioning summary, EXACTLY 4 highlights (<70 chars each), and a callToAction (<60 chars). Return only the structured object.`;

/** §3.5 — off-market/public-records signal → cold-prospect callability `ProspectSpec`. */
export const PROSPECT_PROMPT = `You advise whether an off-market building flagged by a public-records signal is worth a cold call THIS WEEK. Weigh the signal (loan maturity, hold-period expiry, ownership churn, market pressure), asset class, submarket, and owner-motivation cues. Be HONEST — if weak or mistimed, say "challenging"; if strong, say so without hedging. verdict is one of strong|moderate|challenging; headline is a 4–6 word broker-grade summary; reasoning is 2–3 sentences. Return only the structured object.`;
