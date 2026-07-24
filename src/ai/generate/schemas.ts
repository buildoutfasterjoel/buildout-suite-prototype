// NOTE: default import is intentional. Under this repo's Vitest (Vite module
// runner), the named `import { z } from "zod"` resolves `z` to undefined at
// runtime, while the default import works under Vitest, `bun run build`, and
// tsc alike. This is the only zod import in src/.
import z from "zod";

/** §3.1 listing filter. savedView enum matches the requirements doc. */
export const FilterSpec = z.object({
  search: z.string(),
  savedView: z.enum(["all", "active-listings", "under-contract", "my-deals", "chicago", "stale"]),
  assetClass: z.enum(["Retail", "Office", "Multifamily", "Industrial", "Land"]).nullable(),
  saleLease: z.enum(["Sale", "Lease"]).nullable(),
  explanation: z.string(),
});
export type FilterSpecT = z.infer<typeof FilterSpec>;

/** §3.2 outreach email. */
export const EmailDraftSpec = z.object({
  subject: z.string(),
  to: z.array(z.string()),
  body: z.string(),
  signature: z.string(),
});
export type EmailDraftSpecT = z.infer<typeof EmailDraftSpec>;

/** §3.3 ranked call list. */
export const CallListSpec = z.object({
  headline: z.string(),
  calls: z.array(
    z.object({
      contactId: z.string(),
      score: z.number().min(0).max(100),
      reason: z.string().max(90),
    }),
  ),
});
export type CallListSpecT = z.infer<typeof CallListSpec>;

/** §3.4 marketing doc/flyer. */
export const DocSpec = z.object({
  tagline: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  callToAction: z.string(),
});
export type DocSpecT = z.infer<typeof DocSpec>;

/** §3.5 prospect callability. */
export const ProspectSpec = z.object({
  verdict: z.enum(["strong", "moderate", "challenging"]),
  headline: z.string(),
  reasoning: z.string(),
});
export type ProspectSpecT = z.infer<typeof ProspectSpec>;

/** §3.10 contact brief (long-form or targeted answer). */
export const ContactBriefSpec = z.object({ brief: z.string() });
export type ContactBriefSpecT = z.infer<typeof ContactBriefSpec>;

/** §3.9 book strategy. */
export const StrategySpec = z.object({ answer: z.string() });
export type StrategySpecT = z.infer<typeof StrategySpec>;

/** §3.7 live-call owner turn.
 * NOTE: `suggestions` is unbounded in the schema — the "2-3" count is enforced
 * by CALL_TURN_PROMPT. Anthropic's strict structured output rejects array size
 * bounds (`.max()` → `maxItems`), so we never put them on a generator schema. */
export const CallTurnSpec = z.object({
  ownerReply: z.string(),
  suggestions: z.array(z.string()),
  shouldEnd: z.boolean(),
});
export type CallTurnSpecT = z.infer<typeof CallTurnSpec>;

/** §3.4 hang-up recap.
 * NOTE: `opportunity` is a REQUIRED object, not a nullable one — Anthropic's
 * strict structured output rejects a nullable object (it renders as an `anyOf`
 * whose inner object lacks `additionalProperties: false`). "No opportunity" is
 * signalled by empty `name`/`address` strings (see CALL_RECAP_PROMPT); the
 * empty→null mapping lives in `composeRecapReport`. */
export const CallRecapSpec = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  keyPoints: z.array(z.string()),
  tasks: z.array(z.object({ title: z.string(), due: z.string().nullable() })),
  opportunity: z.object({ name: z.string(), address: z.string() }),
});
export type CallRecapSpecT = z.infer<typeof CallRecapSpec>;
