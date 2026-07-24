import { createServerFn } from "@tanstack/react-start";
import { runGenerator, AI_MODEL_REASONING } from "./runGenerator";
import {
  FilterSpec,
  type FilterSpecT,
  EmailDraftSpec,
  type EmailDraftSpecT,
  CallListSpec,
  type CallListSpecT,
  DocSpec,
  type DocSpecT,
  ProspectSpec,
  type ProspectSpecT,
  ContactBriefSpec,
  type ContactBriefSpecT,
} from "./schemas";
import {
  FILTER_PROMPT,
  EMAIL_PROMPT,
  CALL_LIST_PROMPT,
  DOC_PROMPT,
  PROSPECT_PROMPT,
  CONTACT_BRIEF_PROMPT,
} from "./prompts";
import { filterFallback, callListFallback } from "./fallbacks";

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

/** §3.3 — contact pool (+ optional property/intent) → ranked `CallListSpec`,
 * used by the `build_call_list` agent tool and the People grid's "Build call
 * list with AI" button (see `src/ai/tools.ts`). */
export const generateCallList = createServerFn({ method: "POST" })
  .validator(
    (d: {
      property?: unknown;
      intent?: string;
      contacts: Array<{ id: string; lastContactedAt: string | null; relationship: string }>;
    }) => d,
  )
  .handler(({ data }): Promise<CallListSpecT> =>
    runGenerator({
      system: CALL_LIST_PROMPT,
      user: JSON.stringify({
        property: data.property ?? null,
        intent: data.intent ?? "general outreach",
        contacts: data.contacts,
      }),
      schema: CallListSpec,
      fallback: () => callListFallback(data.contacts),
    }),
  );

/** §3.4 — deterministic marketing flyer when the model is unavailable: the
 * property name stands in for the tagline, with no summary/highlights and a
 * safe generic CTA. */
export function docFallback(propertyName: string): DocSpecT {
  return { tagline: propertyName, summary: "", highlights: [], callToAction: "Contact us to schedule a tour" };
}

/** §3.4 — property (+ optional docType) → one-page marketing flyer `DocSpec`,
 * consumed by `build_marketing_package` (see `src/ai/tools.ts`). */
export const generateMarketingDoc = createServerFn({ method: "POST" })
  .validator((d: { property: unknown; docType?: string }) => d)
  .handler(({ data }): Promise<DocSpecT> => {
    const pname = (data.property as { name?: string })?.name ?? "This property";
    return runGenerator({
      system: DOC_PROMPT,
      user: JSON.stringify({ property: data.property, docType: data.docType ?? "marketing_flyer" }),
      schema: DocSpec,
      fallback: () => docFallback(pname),
    });
  });

/** §3.5 — deterministic prospect verdict when the model is unavailable: a
 * cautious "moderate" default that still reads as usable broker guidance. */
export function prospectFallback(): ProspectSpecT {
  return {
    verdict: "moderate",
    headline: "Worth a first-touch call",
    reasoning:
      "The signal is real but not urgent. A light first touch to gauge interest is reasonable this week.",
  };
}

/** §3.5 — off-market/public-records signal → cold-prospect callability
 * `ProspectSpec`. No agent tool exposes this; its only entry point is the
 * "Is this worth a call?" affordance on the dashboard's Focus card. */
export const generateProspectAssessment = createServerFn({ method: "POST" })
  .validator((d: { property: unknown }) => d)
  .handler(({ data }): Promise<ProspectSpecT> =>
    runGenerator({
      system: PROSPECT_PROMPT,
      user: JSON.stringify({ property: data.property }),
      schema: ProspectSpec,
      fallback: () => prospectFallback(),
    }),
  );

/** §3.10 — deterministic contact brief when the model is unavailable: echoes
 * the raw data dump back as the brief so the broker still sees every fact
 * that would have informed the generated version. */
export function contactBriefFallback(dataDump: string): ContactBriefSpecT {
  return { brief: dataDump };
}

/** §3.10 — a contact's data dump (+ optional targeted question) → long-form
 * analyst brief or direct answer `ContactBriefSpec`, consumed by
 * `research_contact`/`answer_about_contact` (see `src/ai/tools.ts`) and the
 * "Brief me" affordance on the contact detail page. Uses the REASONING model
 * since this is a synthesis task over a larger data dump. */
export const generateContactBrief = createServerFn({ method: "POST" })
  .validator((d: { data: string; name: string; question?: string }) => d)
  .handler(({ data }): Promise<ContactBriefSpecT> =>
    runGenerator({
      model: AI_MODEL_REASONING,
      system: CONTACT_BRIEF_PROMPT,
      user: `CONTACT: ${data.name}\n${data.question ? `QUESTION: ${data.question}\n` : ""}\nDATA:\n${data.data}`,
      schema: ContactBriefSpec,
      fallback: () => contactBriefFallback(data.data),
    }),
  );
