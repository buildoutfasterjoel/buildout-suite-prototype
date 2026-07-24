# AI Phase 1 — Generative Agent Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generative capability layer (draft email, ranked call list, book strategy, contact brief, NL listing filter, prospect assessment, marketing doc) plus the missing agent client-tools, backed by the prototype's live Zustand store, so both the keynote and off-script requests actually operate on real data.

**Architecture:** Each generative capability is one `createServerFn` that runs a one-shot `chat({ adapter, outputSchema })` with a Zod schema and returns a typed object, with the Anthropic key held server-side exactly like the existing `relay.ts`. Every generator has two consumers with no duplicated logic: an in-context screen affordance, and an agent client-tool whose `execute` calls the same server fn. The existing relay/agent-loop chassis is untouched.

**Tech Stack:** React 19 · TanStack Start (`createServerFn`) · TanStack AI 0.40 (`chat`, `createAnthropicChat`, `outputSchema`) · Zod 4 · Zustand 5 · Blueprint React · FontAwesome Pro · Vitest.

## Global Constraints

- Package manager is Bun; run everything with `bun --bun run <script>` (e.g. `bun --bun run test`).
- The Anthropic key (`process.env.ANTHROPIC_API_KEY`) is read **server-side only** — never import it or reference it in a `.client()` tool or a component.
- Model id: `claude-sonnet-5` for the interactive agent loop and most generators; `claude-opus-4-8` for the two reasoning-heavy generators (contact brief, book strategy). The adapter just forwards the string.
- Structured output uses Zod schemas passed to `chat({ outputSchema })`; when `outputSchema` is set, `chat()` returns `await`-able typed data directly (no streaming, no manual JSON parsing).
- Never hard-fail on a missing key or provider error: return the capability's deterministic fallback (filter, call-list) or a typed `{ notConfigured: true, … }` object the UI renders as a normal state.
- UI uses Blueprint React components + Bootstrap utility classes; icons are FontAwesome `pro-regular` by default (duotone only for Alert/Banner). Do **not** pass `fixedWidth` to `FontAwesomeIcon`.
- Conversational model output is light HTML only (`<strong>`, `<em>`, `<br>`) — never markdown, never headers (§6.3 of the requirements doc).
- All model output must be grounded in supplied data; never invent contacts, deals, addresses, or amounts.
- TypeScript must stay warning-clean — scan `bun --bun run dev` / `tsc` output after edits.
- Do not merge, push, or open PRs; leave the branch as-is when the plan is complete.

---

## File structure

**Create:**
- `src/ai/generate/schemas.ts` — Zod schemas for every capability's I/O contract.
- `src/ai/generate/prompts.ts` — one system-prompt string per capability.
- `src/ai/generate/runGenerator.ts` — shared server-side helper wrapping `chat({ outputSchema })` + no-key/error handling.
- `src/ai/generate/generators.ts` — the seven `createServerFn` generators.
- `src/ai/generate/fallbacks.ts` — deterministic fallbacks for filter + call-list.
- `src/ai/generate/index.ts` — barrel re-exporting the server fns.
- `src/ai/context.ts` — `buildAssistantContext()` live-store snapshot.
- `src/ai/dueDate.ts` — `parseDueDate()` natural-language date parser.
- Test files colocated: `src/ai/generate/schemas.test.ts`, `src/ai/generate/fallbacks.test.ts`, `src/ai/context.test.ts`, `src/ai/dueDate.test.ts`, `src/data/addNote.test.ts`.

**Modify:**
- `src/data/actions.ts` — add `addNote(contactId, text)`.
- `src/ai/systemPrompt.ts` — add grounding injection + routing rules.
- `src/ai/relay.ts` — accept `context`, inject into system prompt, replace no-key 500 with a graceful assistant message.
- `src/ai/toolDefs.ts` — add new tool definitions; extend `TOOL_DEFS`.
- `src/ai/tools.ts` — add new client tool implementations to `createClientTools`.
- `src/components/ai/AssistantSidebar.tsx` — pass live context; render brief/strategy/email/prospect results.
- `src/routes/_shell/listings/index.tsx` — NL filter box.
- `src/routes/_shell/backoffice/contacts/index.tsx` — "Build call list with Al" affordance.
- `src/routes/_shell/backoffice/contacts/$contactId.tsx` — "Brief me" affordance.
- The property/deal screen and dashboard — draft-email, marketing-package, and strategy affordances (exact files located during their tasks).

---

## Task 1: Zod schemas for every capability I/O contract

**Files:**
- Create: `src/ai/generate/schemas.ts`
- Test: `src/ai/generate/schemas.test.ts`

**Interfaces:**
- Produces: `FilterSpec`, `EmailDraftSpec`, `CallListSpec`, `DocSpec`, `ProspectSpec`, `ContactBriefSpec`, `StrategySpec` Zod schemas and their inferred TS types (`FilterSpecT`, etc.). Each capability's server fn uses these as its `outputSchema`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/generate/schemas.test.ts
import { describe, it, expect } from "vitest";
import { FilterSpec, EmailDraftSpec, CallListSpec, ProspectSpec } from "./schemas";

describe("schemas", () => {
  it("accepts a valid filter spec", () => {
    const r = FilterSpec.safeParse({
      search: "chicago", savedView: "stale", assetClass: "Office",
      saleLease: "Sale", explanation: "Stale Chicago office for sale.",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an out-of-enum savedView", () => {
    const r = FilterSpec.safeParse({ search: "", savedView: "bogus", assetClass: null, saleLease: null, explanation: "x" });
    expect(r.success).toBe(false);
  });

  it("accepts nullable assetClass/saleLease", () => {
    const r = FilterSpec.safeParse({ search: "", savedView: "all", assetClass: null, saleLease: null, explanation: "Everything." });
    expect(r.success).toBe(true);
  });

  it("clamps call-list score bounds", () => {
    const bad = CallListSpec.safeParse({ headline: "h", calls: [{ contactId: "c1", score: 140, reason: "r" }] });
    expect(bad.success).toBe(false);
  });

  it("requires prospect verdict enum", () => {
    expect(ProspectSpec.safeParse({ verdict: "meh", headline: "h", reasoning: "r" }).success).toBe(false);
    expect(ProspectSpec.safeParse({ verdict: "challenging", headline: "Weak, wrong time", reasoning: "The loan matures in 4 years." }).success).toBe(true);
  });

  it("email body and recipients", () => {
    expect(EmailDraftSpec.safeParse({ subject: "s", to: ["Jane Doe <j@co.com>"], body: "b", signature: "— John" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/schemas.test.ts`
Expected: FAIL — cannot find module `./schemas`.

- [ ] **Step 3: Write the schemas**

```ts
// src/ai/generate/schemas.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/generate/schemas.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/generate/schemas.ts src/ai/generate/schemas.test.ts
git commit -m "feat(ai): Zod schemas for generative capability contracts"
```

---

## Task 2: Shared generator helper (no-key + error → fallback)

**Files:**
- Create: `src/ai/generate/runGenerator.ts`
- Test: `src/ai/generate/runGenerator.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks except types.
- Produces:
  - `AI_MODEL` (`"claude-sonnet-5"`) and `AI_MODEL_REASONING` (`"claude-opus-4-8"`) constants.
  - `runGenerator<T>(opts: { model?: string; system: string; user: string; schema: ZodType<T>; fallback: () => T }): Promise<T>` — reads the key server-side, calls `chat({ outputSchema })`, and on missing key or any thrown error returns `fallback()`.

- [ ] **Step 1: Write the failing test**

`runGenerator` calls the model, so the test exercises only the **no-key fallback branch** (no live API). Temporarily clear the env var.

```ts
// src/ai/generate/runGenerator.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { z } from "zod";
import { runGenerator } from "./runGenerator";

const prev = process.env.ANTHROPIC_API_KEY;
afterEach(() => { process.env.ANTHROPIC_API_KEY = prev; });

describe("runGenerator", () => {
  it("returns fallback when no key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const schema = z.object({ answer: z.string() });
    const out = await runGenerator({
      system: "s", user: "u", schema,
      fallback: () => ({ answer: "FALLBACK" }),
    });
    expect(out.answer).toBe("FALLBACK");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/runGenerator.test.ts`
Expected: FAIL — cannot find module `./runGenerator`.

- [ ] **Step 3: Write the helper**

```ts
// src/ai/generate/runGenerator.ts
import { chat } from "@tanstack/ai";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import type { ZodType } from "zod";

export const AI_MODEL = "claude-sonnet-5";
export const AI_MODEL_REASONING = "claude-opus-4-8";

/**
 * Server-side one-shot structured generation. Holds the Anthropic key, runs a
 * single `chat({ outputSchema })` turn, and NEVER throws: a missing key or any
 * provider/parse error resolves to the caller's deterministic `fallback()`.
 */
export async function runGenerator<T>(opts: {
  model?: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  fallback: () => T;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return opts.fallback();
  try {
    const result = await chat({
      adapter: createAnthropicChat(opts.model ?? AI_MODEL, apiKey),
      systemPrompts: [opts.system],
      messages: [{ role: "user", content: opts.user }] as never,
      outputSchema: opts.schema as never,
    });
    return result as T;
  } catch {
    return opts.fallback();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/generate/runGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/generate/runGenerator.ts src/ai/generate/runGenerator.test.ts
git commit -m "feat(ai): server-side generator helper with no-key fallback"
```

---

## Task 3: `buildAssistantContext()` live-store snapshot

**Files:**
- Create: `src/ai/context.ts`
- Test: `src/ai/context.test.ts`

**Interfaces:**
- Consumes: `useDataStore` (`src/data/dataStore.ts`), `listAllTasks` (`src/data/selectors.ts`), `Contact`/`Listing` types.
- Produces:
  - `AssistantContext` type: `{ broker: { name: string; role: string }; tasks: { overdue: number; dueToday: number }; pipeline: { openDeals: number; totalValue: number }; contacts: Array<{ id: string; name: string; role: string; company: string; relationship: string; lastTouch: string }> }`.
  - `buildAssistantContext(): AssistantContext` — reads the live store.
  - `serializeContext(ctx: AssistantContext, maxBytes?: number): string` — compact string capped to `maxBytes` (default 3072) for the agent prompt.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/context.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { seedStore } from "#/data/seed";
import { buildAssistantContext, serializeContext } from "./context";

beforeEach(() => { useDataStore.setState(seedStore()); });

describe("buildAssistantContext", () => {
  it("summarizes the live store", () => {
    const ctx = buildAssistantContext();
    expect(ctx.broker.name).toBeTruthy();
    expect(ctx.pipeline.openDeals).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(ctx.contacts)).toBe(true);
  });

  it("caps the serialized size", () => {
    const s = serializeContext(buildAssistantContext(), 3072);
    expect(s.length).toBeLessThanOrEqual(3072);
  });
});
```

> Note: confirm the seed helper's real export name while implementing (`grep "export" src/data/seed.ts`); the test's `seedStore` import must match. Adjust the import, not the assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/context.test.ts`
Expected: FAIL — cannot find module `./context`.

- [ ] **Step 3: Write the context builder**

```ts
// src/ai/context.ts
import { useDataStore } from "#/data/dataStore";
import { CURRENT_USER } from "#/data/teammates";

export interface AssistantContext {
  broker: { name: string; role: string };
  tasks: { overdue: number; dueToday: number };
  pipeline: { openDeals: number; totalValue: number };
  contacts: Array<{
    id: string; name: string; role: string; company: string;
    relationship: string; lastTouch: string;
  }>;
}

const OPEN_STATUSES = new Set(["proposal", "active", "under-contract"]);

export function buildAssistantContext(): AssistantContext {
  const s = useDataStore.getState();
  const today = new Date().toISOString().slice(0, 10);

  let overdue = 0;
  let dueToday = 0;
  for (const t of s.tasks.values()) {
    if (t.status === "complete") continue;
    if (t.dueDate && t.dueDate < today) overdue += 1;
    else if (t.dueDate === today) dueToday += 1;
  }

  const openDeals = [...s.listings.values()].filter((l) => OPEN_STATUSES.has(l.status));
  const totalValue = openDeals.reduce((sum, l) => sum + (l.financials.askingPrice ?? 0), 0);

  const contacts = [...s.contacts.values()].slice(0, 30).map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    role: c.role,
    company: c.company,
    relationship: c.relationship,
    lastTouch: c.lastTouch,
  }));

  return {
    broker: { name: CURRENT_USER.name, role: "Broker" },
    tasks: { overdue, dueToday },
    pipeline: { openDeals: openDeals.length, totalValue },
    contacts,
  };
}

/** Compact JSON, trimmed to fit `maxBytes` by dropping trailing contacts. */
export function serializeContext(ctx: AssistantContext, maxBytes = 3072): string {
  const clone: AssistantContext = { ...ctx, contacts: [...ctx.contacts] };
  let out = JSON.stringify(clone);
  while (out.length > maxBytes && clone.contacts.length > 0) {
    clone.contacts.pop();
    out = JSON.stringify(clone);
  }
  return out;
}
```

> While implementing: verify `CURRENT_USER` is exported from `src/data/teammates.ts` with a `.name`. If the field differs (e.g. `fullName`), use the real one. If `CURRENT_USER` isn't exported, use the first teammate or a literal `"John Whitfield"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/context.ts src/ai/context.test.ts
git commit -m "feat(ai): live-store assistant context snapshot"
```

---

## Task 4: `addNote` action + natural-language due-date parser

**Files:**
- Modify: `src/data/actions.ts` (add `addNote`)
- Create: `src/ai/dueDate.ts`
- Test: `src/data/addNote.test.ts`, `src/ai/dueDate.test.ts`

**Interfaces:**
- Produces:
  - `addNote(contactId: string, text: string): { contact: Contact | null }` in `src/data/actions.ts` — appends a timestamped line to the contact's `notes` and persists.
  - `parseDueDate(input: string, from?: Date): string | null` in `src/ai/dueDate.ts` — maps natural-language ("today", "tomorrow", "friday", "next week", "in 3 days", an ISO date) to an ISO `YYYY-MM-DD`, or `null` if unparseable.

- [ ] **Step 1: Write the failing tests**

```ts
// src/ai/dueDate.test.ts
import { describe, it, expect } from "vitest";
import { parseDueDate } from "./dueDate";

const FROM = new Date(2026, 6, 23); // Thu 2026-07-23

describe("parseDueDate", () => {
  it("today / tomorrow", () => {
    expect(parseDueDate("today", FROM)).toBe("2026-07-23");
    expect(parseDueDate("tomorrow", FROM)).toBe("2026-07-24");
  });
  it("in N days", () => {
    expect(parseDueDate("in 3 days", FROM)).toBe("2026-07-26");
  });
  it("next weekday (friday from thursday)", () => {
    expect(parseDueDate("friday", FROM)).toBe("2026-07-24");
  });
  it("passes through an ISO date", () => {
    expect(parseDueDate("2026-08-01", FROM)).toBe("2026-08-01");
  });
  it("returns null for gibberish", () => {
    expect(parseDueDate("someday maybe", FROM)).toBeNull();
  });
});
```

```ts
// src/data/addNote.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { seedStore } from "#/data/seed";
import { addNote } from "#/data/actions";

beforeEach(() => { useDataStore.setState(seedStore()); });

describe("addNote", () => {
  it("appends a note to an existing contact", () => {
    const id = [...useDataStore.getState().contacts.keys()][0];
    const { contact } = addNote(id, "Called, left VM.");
    expect(contact?.notes).toContain("Called, left VM.");
  });
  it("returns null for an unknown contact", () => {
    expect(addNote("nope", "x").contact).toBeNull();
  });
});
```

> Match the real `seedStore` export name (see Task 3 note).

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --bun run test src/ai/dueDate.test.ts src/data/addNote.test.ts`
Expected: FAIL — modules/exports missing.

- [ ] **Step 3: Implement the parser**

```ts
// src/ai/dueDate.ts
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Map a natural-language due phrase to an ISO date, or null if unparseable. */
export function parseDueDate(input: string, from: Date = new Date()): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (s === "today") return iso(base);
  if (s === "tomorrow") { base.setDate(base.getDate() + 1); return iso(base); }
  if (s === "next week") { base.setDate(base.getDate() + 7); return iso(base); }

  const inDays = s.match(/^in (\d+) days?$/);
  if (inDays) { base.setDate(base.getDate() + Number(inDays[1])); return iso(base); }

  const wd = DAYS.findIndex((d) => s === d || s === `next ${d}`);
  if (wd >= 0) {
    let delta = (wd - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7; // "friday" on a Friday means next Friday
    base.setDate(base.getDate() + delta);
    return iso(base);
  }

  return null;
}
```

- [ ] **Step 4: Implement `addNote`** — add to `src/data/actions.ts` near the other contact actions:

```ts
/**
 * Append a timestamped note line to a contact's freeform `notes` and persist.
 * Used by the AI `add_note` tool and any manual note affordance.
 */
export function addNote(contactId: string, text: string): { contact: Contact | null } {
  const existing = useDataStore.getState().contacts.get(contactId);
  if (!existing) return { contact: null };
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `${stamp}: ${text.trim()}`;
  const notes = existing.notes ? `${existing.notes}\n${line}` : line;
  const contact: Contact = { ...existing, notes };
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts);
    contacts.set(contactId, contact);
    return { contacts };
  });
  useDataStore.getState().persist();
  return { contact };
}
```

> `Contact` is already imported in `actions.ts` (it's used by `updateContact`/`createContact`). If not, add it to the existing `import type … from "./types"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun --bun run test src/ai/dueDate.test.ts src/data/addNote.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ai/dueDate.ts src/ai/dueDate.test.ts src/data/actions.ts src/data/addNote.test.ts
git commit -m "feat(data): addNote action + natural-language due-date parser"
```

---

## Task 5: Ground the agent + graceful no-key path

**Files:**
- Modify: `src/ai/systemPrompt.ts`, `src/ai/relay.ts`, `src/components/ai/AssistantSidebar.tsx`

**Interfaces:**
- Consumes: `buildAssistantContext`, `serializeContext` (Task 3).
- Produces:
  - `buildSystemPrompt(contextJson?: string): string` in `systemPrompt.ts` — the base prompt + routing rules + an injected `CURRENT CONTEXT` block.
  - `aiChat` accepts `{ messages, context }` and, when no key is set, returns a graceful SSE-free message instead of a 500.

- [ ] **Step 1: Extend the system prompt.** Replace the exported `SYSTEM_PROMPT` const in `src/ai/systemPrompt.ts` with a builder that keeps the existing body and adds routing rules + context:

```ts
const BASE = `...existing SYSTEM_PROMPT body...`; // keep verbatim

const ROUTING = `
Routing rules for actions:
- "Remind me to call X on Friday" → create a task (create_task), NOT a live call.
- "Call X" / "get X on the phone now" → start_call.
- "Tell me about X" / "who is X" / "research X" → research_contact. A SPECIFIC question about X → answer_about_contact.
- Any portfolio/strategy question not about one named person ("who should I work", "who can close in 90 days", "who's gone cold") → analyze_book. Never refuse for lack of a tool.
- "Build my call list" / "who should I call" → build_call_list immediately, no confirmation.
- On an add-note request call add_note only; do not also create a task for the same thing.
- Missing a required input (which contact? note body?) → ask ONE short question and stop.
- Light HTML only (<strong>, <em>); never markdown.`;

export function buildSystemPrompt(contextJson?: string): string {
  return contextJson ? `${BASE}\n${ROUTING}\n\nCURRENT CONTEXT (live, grounded — never contradict this):\n${contextJson}` : `${BASE}\n${ROUTING}`;
}

/** Back-compat export for callers that want the ungrounded prompt. */
export const SYSTEM_PROMPT = buildSystemPrompt();
```

- [ ] **Step 2: Update the relay** in `src/ai/relay.ts`:

```ts
import { buildSystemPrompt } from "./systemPrompt";

export const aiChat = createServerFn({ method: "POST" })
  .validator((data: { messages: unknown[]; context?: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Graceful, not a 500: emit a single assistant SSE message.
      return new Response(
        `data: ${JSON.stringify({ type: "TEXT_MESSAGE_CONTENT", delta: "The assistant isn't configured (no API key), so I can't run AI actions right now." })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } },
      );
    }
    const stream = chat({
      adapter: createAnthropicChat(MODEL, apiKey),
      systemPrompts: [buildSystemPrompt(data.context)],
      messages: data.messages as never,
      tools: TOOL_DEFS,
    });
    return toServerSentEventsResponse(stream);
  });
```

> Verify the exact SSE chunk shape `useChat` expects by reading how `toServerSentEventsResponse` frames chunks (grep `TEXT_MESSAGE_CONTENT` in `node_modules/@tanstack/ai/dist`). If the wire shape differs, match it; the intent is "one assistant text message, then done," never a 500.

- [ ] **Step 3: Pass live context from the client** in `AssistantSidebar.tsx` — update the `fetcher`:

```ts
import { buildAssistantContext, serializeContext } from "#/ai/context";

const fetcher = useCallback(
  ({ messages }: { messages: Array<UIMessage> }, { signal }: { signal: AbortSignal }) =>
    aiChat({ data: { messages, context: serializeContext(buildAssistantContext()) }, signal }),
  [],
);
```

- [ ] **Step 4: Verify build + existing tests still pass**

Run: `bun --bun run test src/ai && bun --bun run build`
Expected: tests PASS; build succeeds. (No new unit test here — this is wiring; its behavior is exercised by the smoke test in Task 15.)

- [ ] **Step 5: Commit**

```bash
git add src/ai/systemPrompt.ts src/ai/relay.ts src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): ground agent in live context; graceful no-key path"
```

---

## Task 6: NL listing filter capability (§3.1)

**Files:**
- Create: `src/ai/generate/prompts.ts` (start it here), `src/ai/generate/fallbacks.ts`, `src/ai/generate/generators.ts` (start it here), `src/ai/generate/index.ts`
- Test: `src/ai/generate/fallbacks.test.ts`
- Modify: `src/ai/toolDefs.ts`, `src/ai/tools.ts`, `src/routes/_shell/listings/index.tsx`

**Interfaces:**
- Consumes: `FilterSpec`/`FilterSpecT` (Task 1), `runGenerator`/`AI_MODEL` (Task 2).
- Produces:
  - `FILTER_PROMPT` in `prompts.ts`.
  - `filterFallback(query: string): FilterSpecT` in `fallbacks.ts`.
  - `generateFilter` server fn in `generators.ts`, re-exported from `index.ts`.
  - `filterListingsDef` tool + `filter_listings` client tool.

- [ ] **Step 1: Write the failing fallback test**

```ts
// src/ai/generate/fallbacks.test.ts
import { describe, it, expect } from "vitest";
import { filterFallback } from "./fallbacks";

describe("filterFallback", () => {
  it("dumps the query into search with an explanation", () => {
    const f = filterFallback("stale chicago office");
    expect(f.search).toBe("stale chicago office");
    expect(f.savedView).toBe("all");
    expect(f.assetClass).toBeNull();
    expect(f.explanation.toLowerCase()).toContain("stale chicago office");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/fallbacks.test.ts`
Expected: FAIL — cannot find module `./fallbacks`.

- [ ] **Step 3: Create the prompt, fallback, generator, barrel**

```ts
// src/ai/generate/prompts.ts
export const FILTER_PROMPT = `You convert a broker's plain-English listings query into a structured filter. Rules:
- City/place mentions → search. "stale/old/lingering" → savedView:"stale". "active" → "active-listings". "my deals/mine" → "my-deals". "under contract" → "under-contract". "chicago" as a saved view only if they clearly mean the Chicago book; otherwise put the city in search.
- Asset words (retail/office/multifamily/industrial/land) → assetClass. "for sale/asking price" → saleLease:"Sale"; "lease/$ per SF" → "Lease".
- If unclear, leave fields null/empty and say so in explanation.
- explanation is ONE plain-English sentence describing what you filtered to.
Return only the structured object.`;
```

```ts
// src/ai/generate/fallbacks.ts
import type { FilterSpecT, CallListSpecT } from "./schemas";

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
```

```ts
// src/ai/generate/generators.ts
import { createServerFn } from "@tanstack/react-start";
import { runGenerator } from "./runGenerator";
import { FilterSpec, type FilterSpecT } from "./schemas";
import { FILTER_PROMPT } from "./prompts";
import { filterFallback } from "./fallbacks";

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
```

```ts
// src/ai/generate/index.ts
export { generateFilter } from "./generators";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/generate/fallbacks.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the agent tool.** In `src/ai/toolDefs.ts` add:

```ts
export const filterListingsDef = toolDefinition({
  name: "filter_listings",
  description:
    "Filter the Listings grid from a plain-English query (e.g. 'stale Chicago office for sale'). Navigates to Listings and applies the filter. Use for any 'show me / find listings that…' request.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "The plain-English listings query." } },
    required: ["query"],
    additionalProperties: false,
  },
});
```

and add `filterListingsDef` to the `TOOL_DEFS` array.

- [ ] **Step 6: Implement the client tool.** In `src/ai/tools.ts`, import `generateFilter` and add to the returned array. The tool applies the filter via a shared UI store (create a tiny `useListingsFilter` Zustand store in `src/routes/_shell/listings/` OR reuse existing filter state — see Step 7). For now the tool navigates and stashes the spec:

```ts
import { generateFilter } from "#/ai/generate";
import { useListingsFilter } from "#/routes/_shell/listings/useListingsFilter";

filterListingsDef.client(async (args) => {
  const { query } = args as { query: string };
  const spec = await generateFilter({ data: { query } });
  useListingsFilter.getState().apply(spec);
  navigate("/listings");
  return { explanation: spec.explanation };
}),
```

- [ ] **Step 7: Add the filter store + in-context box.** Create `src/routes/_shell/listings/useListingsFilter.ts`:

```ts
import { create } from "zustand";
import type { FilterSpecT } from "#/ai/generate/schemas";

interface ListingsFilterState {
  spec: FilterSpecT | null;
  apply: (spec: FilterSpecT) => void;
  clear: () => void;
}
export const useListingsFilter = create<ListingsFilterState>((set) => ({
  spec: null,
  apply: (spec) => set({ spec }),
  clear: () => set({ spec: null }),
}));
```

In `src/routes/_shell/listings/index.tsx`, add an AI filter input above the grid that on submit calls `generateFilter`, stores the spec, and shows the explanation; and make the grid read `useListingsFilter().spec` to bias its existing `search`/`type`/`saleLease` state. Concrete input block (place near the top of the listings toolbar):

```tsx
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkles } from "@fortawesome/pro-regular-svg-icons";
import { generateFilter } from "#/ai/generate";
import { useListingsFilter } from "./useListingsFilter";

function AiFilterBox() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const apply = useListingsFilter((s) => s.apply);
  const spec = useListingsFilter((s) => s.spec);
  return (
    <div className="d-flex flex-column gap-1">
      <form
        className="d-flex align-items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!q.trim() || busy) return;
          setBusy(true);
          try { apply(await generateFilter({ data: { query: q } })); } finally { setBusy(false); }
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter listings in plain English…" aria-label="AI listings filter" />
        <Button type="submit" variant="outline" disabled={busy || !q.trim()}>
          <FontAwesomeIcon icon={faSparkles} /> Filter
        </Button>
      </form>
      {spec && <div className="form-text">{spec.explanation}</div>}
    </div>
  );
}
```

Wire the grid's existing filter state to `spec` (apply `spec.search` to the text search, `spec.saleLease` to the saleLease toggle, `spec.assetClass` to the type toggle) via a `useEffect` keyed on `spec`. Follow the file's existing `useToggleSet` API — read lines around `src/routes/_shell/listings/index.tsx:164-233` and set the toggle sets accordingly.

- [ ] **Step 8: Verify**

Run: `bun --bun run test src/ai/generate && bun --bun run build`
Expected: tests PASS; build succeeds; no TS warnings.

- [ ] **Step 9: Commit**

```bash
git add src/ai/generate/ src/ai/toolDefs.ts src/ai/tools.ts src/routes/_shell/listings/
git commit -m "feat(ai): NL listing filter capability (generator + tool + in-context box)"
```

---

## Task 7: Draft outreach email capability (§3.2)

**Files:**
- Modify: `src/ai/generate/prompts.ts`, `src/ai/generate/generators.ts`, `src/ai/generate/index.ts`, `src/ai/toolDefs.ts`, `src/ai/tools.ts`, `src/components/ai/AssistantSidebar.tsx`; the property/deal screen for the in-context button.
- Test: `src/ai/generate/email.test.ts`

**Interfaces:**
- Consumes: `EmailDraftSpec`/`EmailDraftSpecT` (Task 1), `runGenerator` (Task 2).
- Produces: `EMAIL_PROMPT`, `emailFallback(intent, propertyName)`, `generateEmail` server fn, `draftEmailDef` + `draft_email` client tool.

- [ ] **Step 1: Write the failing fallback test**

```ts
// src/ai/generate/email.test.ts
import { describe, it, expect } from "vitest";
import { emailFallback } from "./generators";

describe("emailFallback", () => {
  it("produces a not-configured draft with a usable subject/body", () => {
    const e = emailFallback("price reduction", "123 Main St");
    expect(e.subject.length).toBeGreaterThan(0);
    expect(e.body.length).toBeGreaterThan(0);
    expect(Array.isArray(e.to)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/email.test.ts`
Expected: FAIL — `emailFallback` not exported.

- [ ] **Step 3: Add the prompt** to `prompts.ts`:

```ts
export const EMAIL_PROMPT = `You draft a broker outreach email about a commercial property. Rules:
- Warm but direct, American CRE conventions, no salesy fluff. Reference 1–2 concrete property details. End with a clear next step. Body UNDER 140 words. Subject under 70 chars.
- If recipients are supplied, address them by first name and use their exact emails; do not invent extras. If none supplied, invent 1–3 plausible reps at major brokerages as the audience (to[] as "First Last <email>").
- body has no signature; signature is a short broker sign-off.
Return only the structured object.`;
```

- [ ] **Step 4: Add the generator + fallback** to `generators.ts`:

```ts
import { EmailDraftSpec, type EmailDraftSpecT } from "./schemas";
import { EMAIL_PROMPT } from "./prompts";

export function emailFallback(intent: string, propertyName: string): EmailDraftSpecT {
  return {
    subject: `Regarding ${propertyName}`,
    to: [],
    body: `I wanted to reach out about ${propertyName}. ${intent}. Do you have time this week for a quick call?`,
    signature: "",
  };
}

export const generateEmail = createServerFn({ method: "POST" })
  .validator((d: { property: unknown; intent: string; recipients?: unknown[] }) => d)
  .handler(({ data }): Promise<EmailDraftSpecT> => {
    const pname =
      (data.property as { name?: string })?.name ?? "the property";
    return runGenerator({
      system: EMAIL_PROMPT,
      user: JSON.stringify({ property: data.property, intent: data.intent, recipients: data.recipients ?? [] }),
      schema: EmailDraftSpec,
      fallback: () => emailFallback(data.intent, pname),
    });
  });
```

Export `generateEmail` from `index.ts`.

- [ ] **Step 5: Add the agent tool** in `toolDefs.ts`:

```ts
export const draftEmailDef = toolDefinition({
  name: "draft_email",
  description:
    "Draft a professional broker outreach email about a specific property or deal. Resolve the property with searchAll first. Optionally target named recipients. Produces subject + body the broker can edit before sending.",
  inputSchema: {
    type: "object",
    properties: {
      propertyId: { type: "string", description: "Resolved property id." },
      listingId: { type: "string", description: "Resolved listing/deal id (alternative to propertyId)." },
      intent: { type: "string", description: "What the email is about, e.g. 'price reduction' or 'introduce myself as the listing broker'." },
    },
    required: ["intent"],
    additionalProperties: false,
  },
});
```

Add `draftEmailDef` to `TOOL_DEFS`.

- [ ] **Step 6: Implement the client tool** in `tools.ts` — resolve the property from the store, call `generateEmail`, create a draft record via the existing `createEmailDraft`, return the draft for card rendering:

```ts
import { generateEmail } from "#/ai/generate";

draftEmailDef.client(async (args) => {
  const { propertyId, listingId, intent } = args as { propertyId?: string; listingId?: string; intent: string };
  const listing = listingId ? getListing(listingId) : undefined;
  const property = propertyId ? getProperty(propertyId) : listing ? getProperty(listing.propertyId) : undefined;
  const propPayload = property ? propertySummary(property) : { name: listing?.name ?? "the property" };
  const draft = await generateEmail({ data: { property: propPayload, intent, recipients: [] } });
  const { email } = createEmailDraft({ subject: draft.subject });
  return { emailDraft: { ...draft, id: email.id } };
}),
```

- [ ] **Step 7: Render the draft in chat.** In `AssistantSidebar.tsx`, extend the tool-result rendering: when a tool output has an `emailDraft`, render a small card showing subject, to[], body, signature, with a "Open in Email" button navigating to `/email/{id}`. Add an `EmailDraftCard` component beside `ResultCard`.

- [ ] **Step 8: Add the in-context button.** On the property/deal detail screen (locate with `grep -rl "askingPrice" src/routes/_shell/listings/\$listingId` and the property route), add a "Draft with Al" `Button` (icon `faPenNib`) that calls `generateEmail` and opens the resulting draft. Reuse `EmailDraftCard` in a small dialog/popover.

- [ ] **Step 9: Verify**

Run: `bun --bun run test src/ai/generate/email.test.ts && bun --bun run build`
Expected: PASS; build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/ai/generate/ src/ai/toolDefs.ts src/ai/tools.ts src/components/ai/AssistantSidebar.tsx src/routes/_shell/listings/
git commit -m "feat(ai): draft outreach email capability"
```

---

## Task 8: Ranked call list capability (§3.3) + `build_call_list`

**Files:**
- Modify: `src/ai/generate/prompts.ts`, `generators.ts`, `index.ts`, `toolDefs.ts`, `tools.ts`, `src/routes/_shell/backoffice/contacts/index.tsx`
- Test: `src/ai/generate/callList.test.ts`

**Interfaces:**
- Consumes: `CallListSpec` (Task 1), `callListFallback` (Task 6 `fallbacks.ts`), `runGenerator`, `createCallList` (`src/data/actions.ts`).
- Produces: `CALL_LIST_PROMPT`, `generateCallList` server fn, `buildCallListDef` + `build_call_list` client tool.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/generate/callList.test.ts
import { describe, it, expect } from "vitest";
import { callListFallback } from "./fallbacks";

describe("callListFallback", () => {
  it("returns at most 8 ranked contacts with valid ids", () => {
    const contacts = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`, lastContactedAt: null, relationship: i % 2 ? "cold" : "pitching",
    }));
    const r = callListFallback(contacts);
    expect(r.calls.length).toBeLessThanOrEqual(8);
    expect(r.calls.every((c) => contacts.some((x) => x.id === c.contactId))).toBe(true);
    expect(r.calls[0].score).toBeGreaterThanOrEqual(r.calls[r.calls.length - 1].score);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/callList.test.ts`
Expected: FAIL — `callListFallback` not found (added in Task 6; if Task 6 not yet done, add it now per Task 6 Step 3).

- [ ] **Step 3: Add the prompt** to `prompts.ts`:

```ts
export const CALL_LIST_PROMPT = `You pick and rank the 5–8 best people to call now from a supplied contact pool, given an optional property and intent. Rank by likelihood to convert using role, market, asset focus, relationship stage, and how long since the last interaction. Every contactId MUST be one of the supplied ids. reason is under 90 chars. Return only the structured object.`;
```

- [ ] **Step 4: Add the generator** to `generators.ts`:

```ts
import { CallListSpec, type CallListSpecT } from "./schemas";
import { CALL_LIST_PROMPT } from "./prompts";
import { callListFallback } from "./fallbacks";

export const generateCallList = createServerFn({ method: "POST" })
  .validator((d: { property?: unknown; intent?: string; contacts: Array<{ id: string; lastContactedAt: string | null; relationship: string }> }) => d)
  .handler(({ data }): Promise<CallListSpecT> =>
    runGenerator({
      system: CALL_LIST_PROMPT,
      user: JSON.stringify({ property: data.property ?? null, intent: data.intent ?? "general outreach", contacts: data.contacts }),
      schema: CallListSpec,
      fallback: () => callListFallback(data.contacts),
    }),
  );
```

Export from `index.ts`.

- [ ] **Step 5: Add the agent tool** in `toolDefs.ts`:

```ts
export const buildCallListDef = toolDefinition({
  name: "build_call_list",
  description:
    "Build a ranked, dialable call list from the broker's book and save it to the People module. Call IMMEDIATELY with no confirmation when the broker says 'build my call list' / 'who should I call'. Distinct from analyze_book (which is a written answer).",
  inputSchema: {
    type: "object",
    properties: { intent: { type: "string", description: "Optional focus, e.g. 'cold prospects to warm up'." } },
    additionalProperties: false,
  },
});
```

Add `buildCallListDef` to `TOOL_DEFS`.

- [ ] **Step 6: Implement the client tool** in `tools.ts`:

```ts
import { generateCallList } from "#/ai/generate";

buildCallListDef.client(async (args) => {
  const { intent } = args as { intent?: string };
  const pool = [...useDataStore.getState().contacts.values()]
    .filter((c) => !c.doNotCall)
    .map((c) => ({ id: c.id, lastContactedAt: c.lastContactedAt, relationship: c.relationship }));
  const ranked = await generateCallList({ data: { intent, contacts: pool } });
  const { callList } = createCallList({
    name: intent ? `Al: ${intent}` : "Al call list",
    contactIds: ranked.calls.map((c) => c.contactId),
    description: ranked.headline,
    source: "ai",
  });
  const byId = new Map([...useDataStore.getState().contacts.values()].map((c) => [c.id, c]));
  return {
    callListId: callList.id,
    headline: ranked.headline,
    contacts: ranked.calls.map((c) => {
      const ct = byId.get(c.contactId);
      return { id: c.contactId, name: ct ? `${ct.firstName} ${ct.lastName}`.trim() : c.contactId, relationship: ct?.relationship, company: ct?.company, score: c.score, reason: c.reason };
    }),
  };
}),
```

The existing `ToolResultCards` already renders a `contacts` array — the added `score`/`reason` fields are ignored gracefully, so the ranked list shows as contact cards. (Optional: show `reason` under each card if trivial.)

- [ ] **Step 7: In-context affordance** on `src/routes/_shell/backoffice/contacts/index.tsx`: a "Build call list with Al" button that calls `generateCallList` over the currently-shown contacts, creates the call list, and applies the ranked order to the grid. Reuse the same pool-building logic (extract a small `contactCallPool(contacts)` helper in `tools.ts` or a shared module to keep it DRY).

- [ ] **Step 8: Verify**

Run: `bun --bun run test src/ai/generate/callList.test.ts && bun --bun run build`
Expected: PASS; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/ai/generate/ src/ai/toolDefs.ts src/ai/tools.ts src/routes/_shell/backoffice/contacts/index.tsx
git commit -m "feat(ai): ranked call-list capability + build_call_list tool"
```

---

## Task 9: Marketing doc capability (§3.4)

**Files:**
- Modify: `prompts.ts`, `generators.ts`, `index.ts`
- Test: `src/ai/generate/doc.test.ts`

**Interfaces:**
- Consumes: `DocSpec` (Task 1), `runGenerator`.
- Produces: `DOC_PROMPT`, `docFallback(propertyName)`, `generateDoc` server fn (the marketing flyer generator; distinct from the existing `generateDoc` *tool* which produces a client-report summary — name this one `generateMarketingDoc` to avoid collision).

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/generate/doc.test.ts
import { describe, it, expect } from "vitest";
import { docFallback } from "./generators";

describe("docFallback", () => {
  it("uses the property name as tagline and a safe CTA", () => {
    const d = docFallback("123 Main St");
    expect(d.tagline).toContain("123 Main St");
    expect(d.callToAction.length).toBeGreaterThan(0);
    expect(Array.isArray(d.highlights)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/doc.test.ts`
Expected: FAIL — `docFallback` not exported.

- [ ] **Step 3: Add prompt + generator**

```ts
// prompts.ts
export const DOC_PROMPT = `You write a one-page marketing flyer spec for a commercial property. Confident, factual, broker-grade, no fluff. Provide a hook tagline (<70 chars), a 2–3 sentence positioning summary, EXACTLY 4 highlights (<70 chars each), and a callToAction (<60 chars). Return only the structured object.`;
```

```ts
// generators.ts
import { DocSpec, type DocSpecT } from "./schemas";
import { DOC_PROMPT } from "./prompts";

export function docFallback(propertyName: string): DocSpecT {
  return { tagline: propertyName, summary: "", highlights: [], callToAction: "Contact us to schedule a tour" };
}

export const generateMarketingDoc = createServerFn({ method: "POST" })
  .validator((d: { property: unknown; docType?: string }) => d)
  .handler(({ data }): Promise<DocSpecT> => {
    const pname = (data.property as { name?: string })?.name ?? "This property";
    return runGenerator({ system: DOC_PROMPT, user: JSON.stringify({ property: data.property, docType: data.docType ?? "marketing_flyer" }), schema: DocSpec, fallback: () => docFallback(pname) });
  });
```

Export `generateMarketingDoc` from `index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/generate/doc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/generate/ && git commit -m "feat(ai): marketing doc/flyer generator"
```

---

## Task 10: Prospect callability capability (§3.5)

**Files:**
- Modify: `prompts.ts`, `generators.ts`, `index.ts`; a prospect/off-market card component (locate with `grep -rl "signal" src/components`).
- Test: `src/ai/generate/prospect.test.ts`

**Interfaces:**
- Consumes: `ProspectSpec` (Task 1), `runGenerator`.
- Produces: `PROSPECT_PROMPT`, `prospectFallback()`, `generateProspectAssessment` server fn.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/generate/prospect.test.ts
import { describe, it, expect } from "vitest";
import { prospectFallback } from "./generators";
import { ProspectSpec } from "./schemas";

describe("prospectFallback", () => {
  it("returns a schema-valid moderate default", () => {
    const p = prospectFallback();
    expect(ProspectSpec.safeParse(p).success).toBe(true);
    expect(p.verdict).toBe("moderate");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/prospect.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add prompt + generator**

```ts
// prompts.ts
export const PROSPECT_PROMPT = `You advise whether an off-market building flagged by a public-records signal is worth a cold call THIS WEEK. Weigh the signal (loan maturity, hold-period expiry, ownership churn, market pressure), asset class, submarket, and owner-motivation cues. Be HONEST — if weak or mistimed, say "challenging"; if strong, say so without hedging. verdict is one of strong|moderate|challenging; headline is a 4–6 word broker-grade summary; reasoning is 2–3 sentences. Return only the structured object.`;
```

```ts
// generators.ts
import { ProspectSpec, type ProspectSpecT } from "./schemas";
import { PROSPECT_PROMPT } from "./prompts";

export function prospectFallback(): ProspectSpecT {
  return { verdict: "moderate", headline: "Worth a first-touch call", reasoning: "The signal is real but not urgent. A light first touch to gauge interest is reasonable this week." };
}

export const generateProspectAssessment = createServerFn({ method: "POST" })
  .validator((d: { property: unknown }) => d)
  .handler(({ data }): Promise<ProspectSpecT> =>
    runGenerator({ system: PROSPECT_PROMPT, user: JSON.stringify({ property: data.property }), schema: ProspectSpec, fallback: () => prospectFallback() }),
  );
```

Export from `index.ts`.

- [ ] **Step 4: In-context card.** On the off-market/prospect card, add an "Is this worth a call?" button that calls `generateProspectAssessment` and renders the verdict as a colored `Badge` (strong=success, moderate=warning, challenging=secondary) + headline + reasoning.

- [ ] **Step 5: Verify + commit**

Run: `bun --bun run test src/ai/generate/prospect.test.ts && bun --bun run build`

```bash
git add src/ai/generate/ src/components/ && git commit -m "feat(ai): prospect callability assessment capability"
```

---

## Task 11: Contact brief capability (§3.10) + research/answer tools

**Files:**
- Modify: `prompts.ts`, `generators.ts`, `index.ts`, `toolDefs.ts`, `tools.ts`, `src/routes/_shell/backoffice/contacts/$contactId.tsx`, `AssistantSidebar.tsx`
- Test: `src/ai/generate/contactBrief.test.ts`

**Interfaces:**
- Consumes: `ContactBriefSpec` (Task 1), `runGenerator`, `AI_MODEL_REASONING`, `getContactDetailClient` (`src/data/selectors.ts`).
- Produces: `CONTACT_BRIEF_PROMPT`, `contactBriefFallback(data)`, `generateContactBrief` server fn, `composeContactData(contactId)` helper (client), `researchContactDef`/`answerAboutContactDef` tools + implementations.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/generate/contactBrief.test.ts
import { describe, it, expect } from "vitest";
import { contactBriefFallback } from "./generators";

describe("contactBriefFallback", () => {
  it("echoes the supplied data as the brief", () => {
    const b = contactBriefFallback("NAME: Jane\nROLE: owner");
    expect(b.brief).toContain("Jane");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/contactBrief.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add prompt + generator**

```ts
// prompts.ts
export const CONTACT_BRIEF_PROMPT = `You are a CRE analyst briefing a broker on ONE contact, using ONLY the supplied data. Never invent facts.
- If a specific question is provided: answer it directly and concisely (2–4 sentences), leading with the answer; if the data doesn't contain it, say so and offer the closest fact. Plain prose, no headers.
- If no question: produce a comprehensive brief with plain ALL-CAPS section headers (no markdown, no asterisks), including only sections where data exists: CONTACT OVERVIEW, PROPERTY OWNERSHIP, DEAL HISTORY, OCCUPIED SPACES, INQUIRIES & REQUIREMENTS, MARKET INTEL, RECENT ACTIVITY, BROKER TAKEAWAYS (2–3 bullets).
Return only the structured object (a single 'brief' string).`;
```

```ts
// generators.ts
import { ContactBriefSpec, type ContactBriefSpecT } from "./schemas";
import { CONTACT_BRIEF_PROMPT } from "./prompts";
import { AI_MODEL_REASONING } from "./runGenerator";

export function contactBriefFallback(dataDump: string): ContactBriefSpecT {
  return { brief: dataDump };
}

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
```

Export from `index.ts`.

- [ ] **Step 4: Add the `composeContactData` client helper** (in `tools.ts` or a small `src/ai/contactData.ts`) that builds the text dump from `getContactDetailClient(contactId)` — name, role, company, relationship, notes, and linked deals (name/status). Keep it plain text, one field per line.

- [ ] **Step 5: Add the agent tools** in `toolDefs.ts`:

```ts
export const researchContactDef = toolDefinition({
  name: "research_contact",
  description: "Produce a full analyst brief on ONE contact (ownership, deals, activity, takeaways). Use for broad 'tell me about / who is / research X' requests. Resolve the name with searchAll first if needed.",
  inputSchema: { type: "object", properties: { contactId: { type: "string" } }, required: ["contactId"], additionalProperties: false },
});

export const answerAboutContactDef = toolDefinition({
  name: "answer_about_contact",
  description: "Answer a SPECIFIC question about one contact using their record. Use when the broker asks a targeted question about a named person (not a broad 'tell me about').",
  inputSchema: { type: "object", properties: { contactId: { type: "string" }, question: { type: "string" } }, required: ["contactId", "question"], additionalProperties: false },
});
```

Add both to `TOOL_DEFS`.

- [ ] **Step 6: Implement the client tools** in `tools.ts`:

```ts
import { generateContactBrief } from "#/ai/generate";

researchContactDef.client(async (args) => {
  const { contactId } = args as { contactId: string };
  const detail = getContactDetailClient(contactId);
  if (!detail) return { error: "Contact not found" };
  const name = `${detail.contact.firstName} ${detail.contact.lastName}`.trim();
  const { brief } = await generateContactBrief({ data: { data: composeContactData(contactId), name } });
  return { brief, contactName: name };
}),

answerAboutContactDef.client(async (args) => {
  const { contactId, question } = args as { contactId: string; question: string };
  const detail = getContactDetailClient(contactId);
  if (!detail) return { error: "Contact not found" };
  const name = `${detail.contact.firstName} ${detail.contact.lastName}`.trim();
  const { brief } = await generateContactBrief({ data: { data: composeContactData(contactId), name, question } });
  return { brief, contactName: name };
}),
```

- [ ] **Step 7: Render the brief** in `AssistantSidebar.tsx`: when a tool output has a `brief` string, render it in a `<div className="assistant-markdown" style={{ whiteSpace: "pre-wrap" }}>` (preserves the ALL-CAPS section layout). Light HTML is safe via the existing markdown-free text path.

- [ ] **Step 8: In-context "Brief me"** on `$contactId.tsx`: a button calling `generateContactBrief` with `composeContactData`, plus an input for a targeted question that routes to the question mode. Render in a dialog.

- [ ] **Step 9: Verify + commit**

Run: `bun --bun run test src/ai/generate/contactBrief.test.ts && bun --bun run build`

```bash
git add src/ai/ src/routes/_shell/backoffice/contacts/\$contactId.tsx src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): contact brief capability + research/answer tools"
```

---

## Task 12: Book strategy capability (§3.9) + `analyze_book`

**Files:**
- Modify: `prompts.ts`, `generators.ts`, `index.ts`, `toolDefs.ts`, `tools.ts`, a dashboard component, `AssistantSidebar.tsx`
- Test: `src/ai/generate/strategy.test.ts`

**Interfaces:**
- Consumes: `StrategySpec` (Task 1), `runGenerator`, `AI_MODEL_REASONING`, `buildAssistantContext` (Task 3).
- Produces: `STRATEGY_PROMPT`, `strategyFallback(book)`, `generateStrategy` server fn, `composeBookSnapshot()` client helper, `analyzeBookDef` + `analyze_book` client tool.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/generate/strategy.test.ts
import { describe, it, expect } from "vitest";
import { strategyFallback } from "./generators";

describe("strategyFallback", () => {
  it("returns a non-empty grounded answer string", () => {
    const s = strategyFallback("PIPELINE: 3 open deals\nJane Doe — pitching — no touch in 45 days");
    expect(s.answer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/generate/strategy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add prompt + generator**

```ts
// prompts.ts
export const STRATEGY_PROMPT = `You reason across the broker's WHOLE book to answer portfolio questions (who to work, who can close in 90 days, who's gone cold, how to drum up business, review the pipeline). Use ONLY the supplied book data. Name actual contacts; for each give the WHY (stage, signal, deal value, days since last touch) and a concrete NEXT ACTION; rank by what moves revenue fastest. For time-window questions reason from stage + signal. Honest and concise; light HTML (<strong>) on names/numbers only; a short ranked list is ideal. Return only the structured object (a single 'answer' string).`;
```

```ts
// generators.ts
import { StrategySpec, type StrategySpecT } from "./schemas";
import { STRATEGY_PROMPT } from "./prompts";

export function strategyFallback(book: string): StrategySpecT {
  const lines = book.split("\n").filter((l) => l.includes("—")).slice(0, 5);
  return { answer: `Here's where I'd focus, ranked by proximity to close:<br>${lines.map((l) => `• ${l}`).join("<br>") || "Your book looks quiet — consider a prospecting push."}` };
}

export const generateStrategy = createServerFn({ method: "POST" })
  .validator((d: { book: string; question: string }) => d)
  .handler(({ data }): Promise<StrategySpecT> =>
    runGenerator({ model: AI_MODEL_REASONING, system: STRATEGY_PROMPT, user: `QUESTION: ${data.question}\n\nBOOK:\n${data.book}`, schema: StrategySpec, fallback: () => strategyFallback(data.book) }),
  );
```

Export from `index.ts`.

- [ ] **Step 4: Add `composeBookSnapshot()`** client helper (in `tools.ts` or `src/ai/bookSnapshot.ts`): a PIPELINE line (open deal count, total value, stage-weighted forecast) followed by one line per contact — `name (role, entity) — relationship — open-deal side+stage+value or "no open deal" — last-touch days-ago — open tasks — signal — short note`. Reuse `buildAssistantContext` + store reads; keep bounded (~30 contacts).

- [ ] **Step 5: Add the agent tool** in `toolDefs.ts`:

```ts
export const analyzeBookDef = toolDefinition({
  name: "analyze_book",
  description:
    "Portfolio strategy across the WHOLE book — who to work, who can close in 90 days, who's gone cold, how to drum up business, review the pipeline. Use for any strategy/portfolio question NOT about one named person. Never refuse for lack of a tool. Returns a written answer (distinct from build_call_list).",
  inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"], additionalProperties: false },
});
```

Add to `TOOL_DEFS`.

- [ ] **Step 6: Implement the client tool** in `tools.ts`:

```ts
import { generateStrategy } from "#/ai/generate";

analyzeBookDef.client(async (args) => {
  const { question } = args as { question: string };
  const { answer } = await generateStrategy({ data: { book: composeBookSnapshot(), question } });
  return { answer };
}),
```

- [ ] **Step 7: Render `answer`** in `AssistantSidebar.tsx`: when a tool output has an `answer` string, render it as light HTML (a `dangerouslySetInnerHTML` limited to `<strong>/<em>/<br>`, or a tiny sanitizer). Since the model is constrained to light HTML and content is grounded, render via a small allow-list sanitizer helper `renderLightHtml(s)`.

- [ ] **Step 8: In-context "Ask about my book"** on a dashboard component: an input that calls `generateStrategy` with `composeBookSnapshot()` and renders the answer.

- [ ] **Step 9: Verify + commit**

Run: `bun --bun run test src/ai/generate/strategy.test.ts && bun --bun run build`

```bash
git add src/ai/ src/components/ src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): book strategy capability + analyze_book tool"
```

---

## Task 13: Pure client tools — add_note, create_task, find_contact, plan_my_day, start_call

**Files:**
- Modify: `src/ai/toolDefs.ts`, `src/ai/tools.ts`
- Test: `src/ai/clientTools.test.ts`

**Interfaces:**
- Consumes: `addNote` (Task 4), `parseDueDate` (Task 4), `createTask`/`NewTaskInput` (`src/data/actions.ts`), `searchAll` (`src/data/selectors.ts`), `buildAssistantContext` (Task 3).
- Produces: tool defs `addNoteDef`, `createTaskDef`, `findContactDef`, `planMyDayDef`, `startCallDef`; their client implementations; and a `resolveContactByName(name): Contact | null` helper.

- [ ] **Step 1: Write the failing test** for name resolution + due parsing wiring:

```ts
// src/ai/clientTools.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { seedStore } from "#/data/seed";
import { resolveContactByName } from "./tools";

beforeEach(() => { useDataStore.setState(seedStore()); });

describe("resolveContactByName", () => {
  it("resolves a full name to a contact", () => {
    const first = [...useDataStore.getState().contacts.values()][0];
    const full = `${first.firstName} ${first.lastName}`.trim();
    expect(resolveContactByName(full)?.id).toBe(first.id);
  });
  it("returns null for an unknown name", () => {
    expect(resolveContactByName("Zzz Nobody")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/clientTools.test.ts`
Expected: FAIL — `resolveContactByName` not exported.

- [ ] **Step 3: Add `resolveContactByName`** to `tools.ts` (module scope, exported):

```ts
export function resolveContactByName(name: string): Contact | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const contacts = [...useDataStore.getState().contacts.values()];
  return (
    contacts.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === q) ??
    contacts.find((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)) ??
    null
  );
}
```

- [ ] **Step 4: Add the tool defs** in `toolDefs.ts`:

```ts
export const addNoteDef = toolDefinition({
  name: "add_note",
  description: "Save a note on a contact's record. If the note is task-oriented the app auto-creates a follow-up; do NOT also call create_task for the same thing.",
  inputSchema: { type: "object", properties: { contact_name: { type: "string" }, note_text: { type: "string" } }, required: ["contact_name", "note_text"], additionalProperties: false },
});
export const createTaskDef = toolDefinition({
  name: "create_task",
  description: "Create a follow-up task/reminder. Use for 'remind me to…' / 'follow up …' — including reminders to CALL someone LATER (a live call NOW is start_call). due is natural language ('friday', 'in 3 days').",
  inputSchema: { type: "object", properties: { task_title: { type: "string" }, contact_name: { type: "string" }, due: { type: "string" } }, required: ["task_title"], additionalProperties: false },
});
export const findContactDef = toolDefinition({
  name: "find_contact",
  description: "Search the CRM and show a clickable result card for a person. Use when the broker wants to locate someone.",
  inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
});
export const planMyDayDef = toolDefinition({
  name: "plan_my_day",
  description: "Name the broker's single most important next move right now (headline + action) from their live book. Use for 'what should I do' / 'plan my day' / 'what's next'.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
});
export const startCallDef = toolDefinition({
  name: "start_call",
  description: "Start a call with a contact NOW (opens the call flow). A reminder to call LATER is create_task instead.",
  inputSchema: { type: "object", properties: { contact_name: { type: "string" } }, required: ["contact_name"], additionalProperties: false },
});
```

Add all five to `TOOL_DEFS`.

- [ ] **Step 5: Implement the client tools** in `tools.ts`:

```ts
import { addNote, createTask } from "#/data/actions";
import { parseDueDate } from "#/ai/dueDate";
import { buildAssistantContext } from "#/ai/context";

addNoteDef.client(async (args) => {
  const { contact_name, note_text } = args as { contact_name: string; note_text: string };
  const c = resolveContactByName(contact_name);
  if (!c) return { error: `No contact named "${contact_name}".` };
  addNote(c.id, note_text);
  return { noted: true, contactId: c.id, contactName: `${c.firstName} ${c.lastName}`.trim() };
}),

createTaskDef.client(async (args) => {
  const { task_title, contact_name, due } = args as { task_title: string; contact_name?: string; due?: string };
  const c = contact_name ? resolveContactByName(contact_name) : null;
  const { task } = createTask({
    name: task_title,
    dueDate: due ? parseDueDate(due) : null,
    contactId: c?.id ?? null,
    source: c ? "contact" : "contact",
  } as never);
  return { taskId: task.id, title: task.name, due: task.dueDate, contactName: c ? `${c.firstName} ${c.lastName}`.trim() : null };
}),

findContactDef.client(async (args) => {
  const { query } = args as { query: string };
  return { contacts: searchAll(query).contacts.slice(0, 6).map(contactSummary) };
}),

planMyDayDef.client(async () => {
  const ctx = buildAssistantContext();
  const headline = ctx.tasks.overdue > 0
    ? `You have ${ctx.tasks.overdue} overdue task${ctx.tasks.overdue === 1 ? "" : "s"} — clear those first.`
    : ctx.tasks.dueToday > 0
    ? `${ctx.tasks.dueToday} task${ctx.tasks.dueToday === 1 ? "" : "s"} due today. Start at the top of your list.`
    : "Nothing overdue — good time to prospect. Want me to build a call list?";
  return { headline, action: "Open tasks" };
}),

startCallDef.client(async (args) => {
  // Phase 1 stub: announce + navigate. Full live-call flow lands in Phase 3.
  const { contact_name } = args as { contact_name: string };
  const c = resolveContactByName(contact_name);
  if (!c) return { started: false, error: `No contact named "${contact_name}".` };
  navigate(`/backoffice/contacts/${c.id}`);
  return { started: true, contactId: c.id, note: "Call flow arrives in Phase 3." };
}),
```

> Verify `NewTaskInput`'s exact required fields at `src/data/actions.ts:370`. If `name` is the only required field, drop the `as never` cast and pass a properly-typed object. The `source` value must be one of the documented `'contact' | 'deal' | 'listing' | 'property'`.

- [ ] **Step 6: Client-side de-dup rule.** In `AssistantSidebar.tsx`, when a single assistant turn returns both an `add_note` and a `create_task` tool call for the same contact, drop the `create_task` from rendering/effect (per §4.3). Implement as a filter in `MessageBubble` over `toolCalls`: if an `add_note` call is present, remove any `create_task` call in the same message.

- [ ] **Step 7: Run test to verify it passes**

Run: `bun --bun run test src/ai/clientTools.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ai/toolDefs.ts src/ai/tools.ts src/ai/clientTools.test.ts src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): add_note, create_task, find_contact, plan_my_day, start_call tools"
```

---

## Task 14: `build_marketing_package` mixed tool

**Files:**
- Modify: `src/ai/toolDefs.ts`, `src/ai/tools.ts`, `AssistantSidebar.tsx`
- Test: none new (composition of already-tested generators; covered by smoke test).

**Interfaces:**
- Consumes: `generateMarketingDoc` (Task 9), `generateEmail` (Task 7), `resolveContactByName` (Task 13), store reads.
- Produces: `buildMarketingPackageDef` + `build_marketing_package` client tool returning `{ package: { doc, email, financials } }`.

- [ ] **Step 1: Add the tool def** in `toolDefs.ts`:

```ts
export const buildMarketingPackageDef = toolDefinition({
  name: "build_marketing_package",
  description:
    "Build a full marketing package for an address: flyer + launch email + a financial summary. REQUIRES an address; if missing, ask for it, then owner and asset type — ONE short question at a time — before calling.",
  inputSchema: {
    type: "object",
    properties: {
      address: { type: "string" },
      owner_name: { type: "string" },
      asset_type: { type: "string" },
      asking_price: { type: "number" },
      notes: { type: "string" },
    },
    required: ["address"],
    additionalProperties: false,
  },
});
```

Add to `TOOL_DEFS`.

- [ ] **Step 2: Implement the client tool** in `tools.ts`:

```ts
import { generateMarketingDoc, generateEmail } from "#/ai/generate";

buildMarketingPackageDef.client(async (args) => {
  const { address, owner_name, asset_type, asking_price, notes } = args as {
    address: string; owner_name?: string; asset_type?: string; asking_price?: number; notes?: string;
  };
  const property = { name: address, address, assetType: asset_type, askingPrice: asking_price, owner: owner_name, notes };
  const [doc, email] = await Promise.all([
    generateMarketingDoc({ data: { property, docType: "marketing_flyer" } }),
    generateEmail({ data: { property, intent: `Launch marketing for ${address}`, recipients: [] } }),
  ]);
  return {
    package: {
      doc,
      email,
      financials: { askingPrice: asking_price ?? null, assetType: asset_type ?? null },
    },
  };
}),
```

- [ ] **Step 3: Render the package** in `AssistantSidebar.tsx`: when a tool output has a `package`, render a card with the flyer (tagline/summary/highlights/CTA), the launch email (subject/body), and the financial line. Reuse `EmailDraftCard` for the email portion.

- [ ] **Step 4: Verify + commit**

Run: `bun --bun run build`

```bash
git add src/ai/toolDefs.ts src/ai/tools.ts src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): build_marketing_package mixed tool"
```

---

## Task 15: Full-suite verification + prototype index card

**Files:**
- Modify: none required beyond fixes; optionally `src/routes/index.tsx` if the AI assistant warrants a prototype-directory card.

- [ ] **Step 1: Run the full test suite**

Run: `bun --bun run test`
Expected: all tests PASS (existing + new). Fix any regressions before proceeding.

- [ ] **Step 2: Typecheck + build clean**

Run: `bun --bun run build`
Expected: build succeeds with no TypeScript errors or warnings. Scan output; resolve every warning.

- [ ] **Step 3: Lint/format**

Run: `bun --bun run check`
Expected: Biome reports no errors. Fix or `bun --bun run format` as needed.

- [ ] **Step 4: Manual smoke test (dev server).** Since Playwright is disallowed, verify by hand — run `bun --bun run dev` and, with `ANTHROPIC_API_KEY` set, confirm in the assistant sidebar:
  - "Draft a price-reduction email for <a real listing>" → renders an email draft card.
  - "Build my call list" → creates a call list and shows ranked contact cards.
  - "Who should I work this quarter?" → renders a grounded strategy answer naming real contacts.
  - "Tell me about <a real contact>" → renders a sectioned brief.
  - "Remind me to call <contact> Friday" → creates a task dated to the upcoming Friday (NOT a call).
  - "Filter listings to stale office" (or the Listings AI box) → grid filters + explanation shows.
  - Unset the key and repeat "Build my call list" → still returns a locally-ranked list; "Draft an email" → shows a graceful not-configured draft; the sidebar never shows a 500.

  If you cannot run the model (no key), verify only the fallback paths and ask the user to run the keyed smoke checks.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(ai): Phase 1 verification fixes"
```

- [ ] **Step 6: Report** the smoke-test results to the user (which checks passed, which need their keyed run), per the verification-before-completion discipline.

---

## Self-review notes (coverage map)

- §3.1 filter → Task 6. §3.2 email → Task 7. §3.3 call list → Task 8. §3.4 doc → Task 9. §3.5 prospect → Task 10. §3.10 contact brief → Task 11. §3.9 strategy → Task 12.
- Client tools `add_note`/`create_task`/`find_contact`/`plan_my_day`/`start_call` → Task 13; `build_marketing_package` → Task 14; existing 16 tools untouched.
- Grounding (`buildAssistantContext`) → Task 3, wired in Task 5. Degradation (filter+call-list fallbacks, graceful no-key) → Tasks 2, 5, 6, 8. `addNote` + NL due parsing → Task 4. add_note/create_task de-dup → Task 13 Step 6.
- Out of scope (Phases 2–4): voice, live-call `call-turn`, simulated inbound `draft-reply`, hero-arc orchestration — intentionally absent.
