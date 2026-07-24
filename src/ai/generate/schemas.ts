import { z } from "zod";

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
