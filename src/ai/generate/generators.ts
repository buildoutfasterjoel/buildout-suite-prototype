import { createServerFn } from "@tanstack/react-start";
import { runGenerator } from "./runGenerator";
import { FilterSpec, type FilterSpecT, EmailDraftSpec, type EmailDraftSpecT } from "./schemas";
import { FILTER_PROMPT, EMAIL_PROMPT } from "./prompts";
import { filterFallback } from "./fallbacks";

/** §3.1 — plain-English listings query → structured `FilterSpec`, applied to
 * the Listings grid by `filter_listings` (see `src/ai/tools.ts`). */
export const generateFilter = createServerFn({ method: "POST" })
  .validator((d: { query: string }) => d)
  .handler(({ data }): Promise<FilterSpecT> =>
    runGenerator({
      system: FILTER_PROMPT,
      user: data.query,
      schema: FilterSpec,
      fallback: () => filterFallback(data.query),
    }),
  );

/** §3.2 — deterministic outreach email when the model is unavailable: a short,
 * usable draft with no recipients pre-filled (the broker fills those in). */
export function emailFallback(intent: string, propertyName: string): EmailDraftSpecT {
  return {
    subject: `Regarding ${propertyName}`,
    to: [],
    body: `I wanted to reach out about ${propertyName}. ${intent}. Do you have time this week for a quick call?`,
    signature: "",
  };
}

/** §3.2 — plain-English intent → broker outreach `EmailDraftSpec`, used by
 * the `draft_email` agent tool (see `src/ai/tools.ts`). */
export const generateEmail = createServerFn({ method: "POST" })
  .validator((d: { property: unknown; intent: string; recipients?: unknown[] }) => d)
  .handler(({ data }): Promise<EmailDraftSpecT> => {
    const pname = (data.property as { name?: string })?.name ?? "the property";
    return runGenerator({
      system: EMAIL_PROMPT,
      user: JSON.stringify({ property: data.property, intent: data.intent, recipients: data.recipients ?? [] }),
      schema: EmailDraftSpec,
      fallback: () => emailFallback(data.intent, pname),
    });
  });
