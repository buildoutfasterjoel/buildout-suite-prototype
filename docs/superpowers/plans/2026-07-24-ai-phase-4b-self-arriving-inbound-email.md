# AI Phase 4B — Self-Arriving Inbound Owner Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ~10s after the hero call's recap, a simulated owner email from Marcus self-arrives with a rent roll + T-12, files both to the 4A deal, adds a deal-timeline message + toast, renders a sidebar `InboundEmailCard` with the body, and Otto offers to underwrite (accepting kicks off the existing underwriting flow, gated on multifamily eligibility).

**Architecture:** A new `generateDraftReply` generator (§3.6) + a `heroInbound` module-singleton (armed off `useCallStore.heroActions` by a mounted watcher; ~10s timer; session-guarded) that files documents, posts a timeline message, toasts, and sets a `useInboundEmail` store the sidebar reacts to. Reactive state in Zustand, effectful/timer logic in the module singleton, presentational card + a thin watcher. No inbox/route.

**Tech Stack:** TanStack Start + React 19 · TypeScript · Zustand · Zod (default import) · `@tanstack/ai` (Anthropic adapter) · Vitest · Blueprint React + Bootstrap · FontAwesome Pro.

**Design spec:** `docs/superpowers/specs/2026-07-24-ai-phase-4b-self-arriving-inbound-email-design.md`

## Global Constraints

- Gates: `bun --bun run test` green AND `bun --bun x tsc --noEmit` 0 errors. `vite build` does NOT type-check.
- Non-gates to ignore: biome; the pre-existing `ReferenceError: module is not defined` Vitest stderr line.
- **No Playwright.** Pure logic unit-tested; UI/audio/timer paths verified by the manual smoke test.
- `import z from "zod"` — **default import**.
- Every new generator schema Anthropic strict-output compatible (NO array `.min()`/`.max()`; NO nullable objects) AND registered in `src/ai/generate/schemaCompat.test.ts`.
- Everything runs **key-less** via deterministic fallbacks.
- Assistant is named **Otto**. FontAwesome `pro-regular`, never `fixedWidth`. Blueprint + Bootstrap; no unsolicited redesigns of existing components.
- The self-arrival summary is spoken ONE-WAY (no `setConversationMode`, no mic re-arm — same rule as the recap).
- Commit after every task. Branch `joel/ai-tools` — do NOT merge/push/open PRs.

## Verified signatures (consume exactly)

- `addDealDocument(listingId: string, doc: DealDocument): Listing | undefined` (`src/data/store.ts:194`). `DealDocument = { id: string; name: string; uploadedAt: string; size?: string; aiGenerated?: boolean }` (`src/data/types.ts:418`).
- `addDealMessage(listingId: string, m: { author: string; text: string }): Listing` (`src/data/store.ts:201`).
- `notify(item: { title: string; description?: string }): void` from `#/lib/notify`.
- `getContact(contactId): Contact | undefined` (`src/data/store.ts:216`); `getProperty(propertyId): Property | undefined` (`src/data/store.ts:41`).
- `propertyQualifiesForUnderwriting(property): boolean` (`src/components/deals/underwriting/eligibility.ts:9`).
- `updateListingUnderwriting(listingId, patch: Partial<DealUnderwriting>): Listing | undefined` (`src/data/store.ts:161`).
- `underwritingFromSelection(id, sel: Set<number>): DealUnderwriting` + `defaultSelectionFor(id): Set<number>` (`src/components/deals/underwriting/strategies.ts:75,80`). Strategy `'value-add'` fits an existing multifamily (has the `rent-roll` check).
- `useCallStore.getState().heroActions` (`{ dealId, ... } | null`) + `.target` (`{ contactId, firstName, name, ... } | null`) (`src/components/call/useCallStore.ts`).
- `useAssistant.getState().setOpen(true)` (`src/ai/useAssistant.ts`).
- `contactFullName(contact)` (`src/components/contacts/contactDisplay.ts`).
- Generator pattern + `runGenerator` (`src/ai/generate/`), `AI_MODEL` default (fast) model.

## File Structure

- `src/ai/generate/{schemas,prompts,fallbacks,generators,index}.ts` + `schemaCompat.test.ts` — **Modify**: add `generateDraftReply`.
- `src/components/call/useInboundEmail.ts` — **Create**: store + `InboundEmail` type.
- `src/components/call/heroInbound.ts` — **Create**: `arm`/`cancel`/`onArrive` + `synthesizedOriginal`/`inboundSummaryText`/`startUnderwriting`.
- `src/components/call/InboundEmailCard.tsx` — **Create**.
- `src/components/layout/AppShell.tsx` — **Modify**: mount `<HeroInboundWatcher/>`.
- `src/components/call/HeroInboundWatcher.tsx` — **Create**.
- `src/components/ai/AssistantSidebar.tsx` — **Modify**: render `InboundEmailCard`, speak the one-line summary once.

---

### Task 1: `generateDraftReply` generator (§3.6)

**Files:**
- Modify: `src/ai/generate/schemas.ts`, `prompts.ts`, `fallbacks.ts`, `generators.ts`, `index.ts`, `schemaCompat.test.ts`
- Test: `src/ai/generate/draftReply.test.ts`

**Interfaces:**
- Produces: `DraftReplySpec = z.object({ tone: z.enum(["interested","open","decline"]), body: z.string() })`; `DraftReplySpecT`; `draftReplyFallback(firstName: string): DraftReplySpecT`; `generateDraftReply` server fn taking `{ original: {subject,body}, candidate: {name,role,entity,note,phone}, property: {name,signal} }`.

- [ ] **Step 1: Write the failing test**

Create `src/ai/generate/draftReply.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DraftReplySpec } from "./schemas";
import { draftReplyFallback } from "./fallbacks";

describe("draftReplyFallback", () => {
  it("produces a schema-valid interested reply signed with the first name", () => {
    const r = draftReplyFallback("Marcus");
    expect(() => DraftReplySpec.parse(r)).not.toThrow();
    expect(r.tone).toBe("interested");
    expect(r.body).toContain("Marcus");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test draftReply`
Expected: FAIL (`DraftReplySpec`/`draftReplyFallback` missing).

- [ ] **Step 3: Add the schema**

In `src/ai/generate/schemas.ts` (after `CallBriefSpec`):

```ts
/** §3.6 simulated owner email reply. All-simple → Anthropic strict-output safe. */
export const DraftReplySpec = z.object({
  tone: z.enum(["interested", "open", "decline"]),
  body: z.string(),
});
export type DraftReplySpecT = z.infer<typeof DraftReplySpec>;
```

- [ ] **Step 4: Add the prompt**

In `src/ai/generate/prompts.ts` (after `CALL_BRIEF_PROMPT`):

```ts
/** §3.6 — simulated owner reply to the broker's outreach. */
export const DRAFT_REPLY_PROMPT = `You role-play a commercial-property OWNER replying to a broker's message. Write as the owner would on a phone mid-day: busy, concise, sometimes warm, sometimes guarded. Rules:
- 2-4 sentences. Reference ONE specific thing from the broker's message. End with the owner's FIRST-NAME signoff.
- Let the owner's note (decision-maker, retiring, family, institutional, etc.) shape the tone.
- tone is one of interested | open | decline — pick what fits this owner and message.
- If the broker asked for documents (e.g. a rent roll or T-12), acknowledge sending them.
Return only the structured object.`;
```

- [ ] **Step 5: Add the fallback**

In `src/ai/generate/fallbacks.ts` — add `DraftReplySpecT` to the existing `import type { ... } from "./schemas"` line, then append:

```ts
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
```

- [ ] **Step 6: Add the generator**

In `src/ai/generate/generators.ts`, add `DraftReplySpec`/`DraftReplySpecT`, `DRAFT_REPLY_PROMPT`, `draftReplyFallback` to the existing import lines, then append:

```ts
/** §3.6 — simulated owner email reply. Default (fast) model. */
export const generateDraftReply = createServerFn({ method: "POST" })
  .validator(
    (d: {
      original: { subject: string; body: string };
      candidate: { name: string; role: string; entity: string; note: string; phone: string };
      property: { name: string; signal: string };
      firstName: string;
    }) => d,
  )
  .handler(({ data }): Promise<DraftReplySpecT> =>
    runGenerator({
      system: DRAFT_REPLY_PROMPT,
      user: JSON.stringify({
        original: data.original,
        candidate: data.candidate,
        property: data.property,
      }),
      schema: DraftReplySpec,
      fallback: () => draftReplyFallback(data.firstName),
    }),
  );
```

- [ ] **Step 7: Re-export**

In `src/ai/generate/index.ts`: add `generateDraftReply` to the `./generators` export and `draftReplyFallback` to the `./fallbacks` export.

- [ ] **Step 8: Register in schemaCompat**

In `src/ai/generate/schemaCompat.test.ts`: add `DraftReplySpec` to the `./schemas` import and to the `LLM_SCHEMAS` array: `["DraftReplySpec", DraftReplySpec],`.

- [ ] **Step 9: Run tests + gates**

Run: `bun --bun run test draftReply schemaCompat`
Expected: PASS (fallback test + the new schemaCompat case).
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/ai/generate
git commit -m "feat(ai): add generateDraftReply generator (simulated owner email reply)"
```

---

### Task 2: `useInboundEmail` store

**Files:**
- Create: `src/components/call/useInboundEmail.ts`
- Test: `src/components/call/useInboundEmail.test.ts`

**Interfaces:**
- Produces: `interface InboundEmail { dealId: string; from: string; subject: string; body: string; tone: "interested"|"open"|"decline"; attachments: string[]; canUnderwrite: boolean }`; `useInboundEmail` (Zustand: `inbound: InboundEmail | null`, `setInbound(e)`, `clearInbound()`).

- [ ] **Step 1: Write the failing test**

Create `src/components/call/useInboundEmail.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { useInboundEmail, type InboundEmail } from "./useInboundEmail";

const sample: InboundEmail = {
  dealId: "d", from: "Marcus Pinckney", subject: "Re: Following up on our call",
  body: "…", tone: "interested", attachments: ["Palmetto Court — Rent Roll.xlsx"], canUnderwrite: true,
};

describe("useInboundEmail", () => {
  it("sets and clears the inbound email", () => {
    useInboundEmail.getState().setInbound(sample);
    expect(useInboundEmail.getState().inbound?.dealId).toBe("d");
    useInboundEmail.getState().clearInbound();
    expect(useInboundEmail.getState().inbound).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test useInboundEmail`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Create `src/components/call/useInboundEmail.ts`:

```ts
import { create } from "zustand";

export interface InboundEmail {
  dealId: string;
  from: string;
  subject: string;
  body: string;
  tone: "interested" | "open" | "decline";
  attachments: string[];
  canUnderwrite: boolean;
}

interface InboundEmailState {
  inbound: InboundEmail | null;
  setInbound: (e: InboundEmail) => void;
  clearInbound: () => void;
}

export const useInboundEmail = create<InboundEmailState>((set) => ({
  inbound: null,
  setInbound: (inbound) => set({ inbound }),
  clearInbound: () => set({ inbound: null }),
}));
```

- [ ] **Step 4: Run test + gates**

Run: `bun --bun run test useInboundEmail`
Expected: PASS.
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/call/useInboundEmail.ts src/components/call/useInboundEmail.test.ts
git commit -m "feat(call): add useInboundEmail store"
```

---

### Task 3: `heroInbound` module — self-arrival, filing, and offer

**Files:**
- Create: `src/components/call/heroInbound.ts`
- Test: `src/components/call/heroInbound.test.ts`

**Interfaces:**
- Consumes: `generateDraftReply` (`#/ai/generate`); `useInboundEmail` (Task 2); `addDealDocument`, `addDealMessage`, `getContact`, `getProperty` (`#/data/store`); `notify` (`#/lib/notify`); `propertyQualifiesForUnderwriting` (`#/components/deals/underwriting/eligibility`); `updateListingUnderwriting` (`#/data/store`); `underwritingFromSelection`, `defaultSelectionFor` (`#/components/deals/underwriting/strategies`); `contactFullName` (`#/components/contacts/contactDisplay`); `useAssistant` (`#/ai/useAssistant`).
- Produces: `synthesizedOriginal(firstName): { subject, body }`; `inboundSummaryText(inbound: InboundEmail): string`; `startUnderwriting(dealId: string): void`; `heroInbound = { arm(dealId, ownerContactId), cancel() }`; internal `onArrive`.

- [ ] **Step 1: Write the failing test**

Create `src/components/call/heroInbound.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { useInboundEmail } from "./useInboundEmail";

// The generator is a server fn; mock it to a fixed interested reply.
vi.mock("#/ai/generate", () => ({
  generateDraftReply: vi.fn(async () => ({ tone: "interested", body: "Sending the rent roll and T-12. — Marcus" })),
}));

import { synthesizedOriginal, inboundSummaryText, heroInbound } from "./heroInbound";

function hydrate() {
  const ds = generateDataset();
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never);
  return ds;
}

describe("synthesizedOriginal", () => {
  it("asks for the rent roll and T-12 and names the owner", () => {
    const o = synthesizedOriginal("Marcus");
    expect(o.body).toContain("Marcus");
    expect(o.body.toLowerCase()).toContain("rent roll");
    expect(o.body.toLowerCase()).toContain("t-12");
  });
});

describe("inboundSummaryText", () => {
  it("is a one-line offer that mentions the attachments and underwriting", () => {
    const s = inboundSummaryText({
      dealId: "d", from: "Marcus Pinckney", subject: "s", body: "b",
      tone: "interested", attachments: ["Rent Roll", "T-12"], canUnderwrite: true,
    });
    expect(s.toLowerCase()).toContain("marcus");
    expect(s.toLowerCase()).toContain("underwrite");
  });
});

describe("heroInbound arm/onArrive", () => {
  beforeEach(() => {
    hydrate();
    useInboundEmail.setState({ inbound: null });
    vi.useFakeTimers();
  });

  it("files two docs + a message + sets the inbound after ~10s", async () => {
    const ds = useDataStore.getState();
    const marcus = [...ds.contacts.values()].find((c) => c.heroKey === "marcus")!;
    const dealId = [...ds.listings.values()][0].id; // any listing to file onto
    heroInbound.arm(dealId, marcus.id);
    await vi.advanceTimersByTimeAsync(10_500);
    const deal = useDataStore.getState().listings.get(dealId)!;
    expect(deal.documents.filter((d) => d.aiGenerated === false).length).toBeGreaterThanOrEqual(2);
    expect(deal.messages.length).toBeGreaterThanOrEqual(1);
    expect(useInboundEmail.getState().inbound?.dealId).toBe(dealId);
    expect(useInboundEmail.getState().inbound?.canUnderwrite).toBe(true); // Marcus's property is multifamily
  });

  it("cancel() before the timer fires drops the arrival", async () => {
    const ds = useDataStore.getState();
    const marcus = [...ds.contacts.values()].find((c) => c.heroKey === "marcus")!;
    const dealId = [...ds.listings.values()][0].id;
    heroInbound.arm(dealId, marcus.id);
    heroInbound.cancel();
    await vi.advanceTimersByTimeAsync(10_500);
    expect(useInboundEmail.getState().inbound).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test heroInbound`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Create `src/components/call/heroInbound.ts`:

```ts
import { generateDraftReply } from "#/ai/generate";
import { useInboundEmail, type InboundEmail } from "./useInboundEmail";
import { addDealDocument, addDealMessage, getContact, getProperty, updateListingUnderwriting } from "#/data/store";
import { notify } from "#/lib/notify";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";
import { underwritingFromSelection, defaultSelectionFor } from "#/components/deals/underwriting/strategies";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useAssistant } from "#/ai/useAssistant";

const ARRIVAL_MS = 10_000;

// Monotonic session so a cancel()/re-arm drops a pending or in-flight arrival.
let session = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The broker's post-call follow-up the owner is replying to (no prior email exists —
 * the broker called). Deterministic, drives the draft-reply. */
export function synthesizedOriginal(firstName: string): { subject: string; body: string } {
  return {
    subject: "Following up on our call",
    body:
      `Great speaking just now, ${firstName} — when you get a moment, could you send ` +
      `the current rent roll and the T-12? I'll take a look and come back with a valuation.`,
  };
}

/** Otto's spoken one-line summary/offer on arrival (one-way; not the email body). */
export function inboundSummaryText(inbound: InboundEmail): string {
  const first = inbound.from.split(" ")[0] || "the owner";
  const offer = inbound.canUnderwrite ? " Want me to underwrite it?" : "";
  return `${first} just replied and sent the rent roll and the T-12 — I filed both to the deal.${offer}`;
}

/** Kick off the existing underwriting generation on the deal (value-add fits an existing
 * multifamily; setting underwriting also keeps the row visible at the Active stage). */
export function startUnderwriting(dealId: string): void {
  updateListingUnderwriting(dealId, {
    ...underwritingFromSelection("value-add", defaultSelectionFor("value-add")),
    status: "generating",
  });
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function onArrive(dealId: string, ownerContactId: string, mySession: number) {
  if (mySession !== session) return;
  const contact = getContact(ownerContactId);
  if (!contact) return;
  const property = getProperty(contact.propertyIds[0] ?? "");
  const propertyName = property?.name ?? "the property";
  const original = synthesizedOriginal(contact.firstName);

  let res;
  try {
    res = await generateDraftReply({
      data: {
        original,
        candidate: {
          name: contactFullName(contact),
          role: contact.role,
          entity: contact.company,
          note: contact.notes ?? "",
          phone: contact.phone,
        },
        property: { name: propertyName, signal: contact.signal?.detail ?? "" },
        firstName: contact.firstName,
      },
    });
  } catch {
    res = { tone: "interested" as const, body: `Sending the rent roll and T-12. — ${contact.firstName}` };
  }
  if (mySession !== session) return; // superseded during the await

  const now = new Date().toISOString();
  const attachments = [`${propertyName} — Rent Roll.xlsx`, `${propertyName} — T-12.pdf`];
  addDealDocument(dealId, { id: crypto.randomUUID(), name: attachments[0], uploadedAt: now, size: "2.1 MB", aiGenerated: false });
  addDealDocument(dealId, { id: crypto.randomUUID(), name: attachments[1], uploadedAt: now, size: "1.4 MB", aiGenerated: false });

  const from = contactFullName(contact);
  addDealMessage(dealId, { author: from, text: "Sent the rent roll and T-12 — filed to the deal." });
  notify({ title: `New email from ${from}`, description: "Rent roll + T-12 attached" });

  useInboundEmail.getState().setInbound({
    dealId,
    from,
    subject: `Re: ${original.subject}`,
    body: res.body,
    tone: res.tone,
    attachments,
    canUnderwrite: propertyQualifiesForUnderwriting(property),
  });
  useAssistant.getState().setOpen(true);
}

export const heroInbound = {
  /** Schedule the ~10s self-arrival. Bumps session so a prior pending arrival is dropped. */
  arm(dealId: string, ownerContactId: string) {
    clearTimer();
    session += 1;
    const mySession = session;
    timer = setTimeout(() => void onArrive(dealId, ownerContactId, mySession), ARRIVAL_MS);
  },
  /** Drop a pending/in-flight arrival (reset / new call / 4D replay). */
  cancel() {
    clearTimer();
    session += 1;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test heroInbound`
Expected: PASS (both arm/onArrive and cancel cases + the pure helpers).
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors. Then `bun --bun run test` → full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/components/call/heroInbound.ts src/components/call/heroInbound.test.ts
git commit -m "feat(call): heroInbound self-arrival — files owner email docs + arms underwrite offer"
```

---

### Task 4: `HeroInboundWatcher` mounted in `AppShell`

**Files:**
- Create: `src/components/call/HeroInboundWatcher.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- (No unit test — a thin mounted observer; the arm logic is tested in Task 3. Verified by the smoke test.)

**Interfaces:**
- Consumes: `useCallStore` (`heroActions`, `target`), `heroInbound.arm` (Task 3).

- [ ] **Step 1: Create the watcher**

Create `src/components/call/HeroInboundWatcher.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useCallStore } from "./useCallStore";
import { heroInbound } from "./heroInbound";

/** Renders nothing. Watches the hero recap completing (`heroActions` set on hang-up) and
 * arms the ~10s self-arriving owner email once per hero call. Mounted in AppShell. */
export function HeroInboundWatcher() {
  const heroActions = useCallStore((s) => s.heroActions);
  const armedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!heroActions) {
      armedFor.current = null; // reset when the recap is dismissed, so a later call re-arms
      return;
    }
    if (armedFor.current === heroActions.dealId) return; // already armed for this deal
    const contactId = useCallStore.getState().target?.contactId;
    if (!contactId) return;
    armedFor.current = heroActions.dealId;
    heroInbound.arm(heroActions.dealId, contactId);
  }, [heroActions]);

  return null;
}
```

- [ ] **Step 2: Mount it in AppShell**

In `src/components/layout/AppShell.tsx`, add the import and mount it alongside the other `hydrated`-gated globals (next to `<LiveCallBar/>`):

```tsx
import { HeroInboundWatcher } from "#/components/call/HeroInboundWatcher";
```

```tsx
{hydrated && <HeroInboundWatcher />}
```

- [ ] **Step 3: Verify gates**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.
Run: `bun --bun run test`
Expected: full suite green (no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/components/call/HeroInboundWatcher.tsx src/components/layout/AppShell.tsx
git commit -m "feat(call): arm the self-arriving inbound off the hero recap (AppShell watcher)"
```

---

### Task 5: `InboundEmailCard` + sidebar render, spoken summary, and accept

**Files:**
- Create: `src/components/call/InboundEmailCard.tsx`
- Modify: `src/components/ai/AssistantSidebar.tsx`
- (No unit test — UI wiring; the summary/underwrite logic is tested in Task 3. Verified by the smoke test.)

**Interfaces:**
- Consumes: `useInboundEmail` (Task 2), `inboundSummaryText`/`startUnderwriting` (Task 3), `voiceEngine` (`#/ai/voice/voiceEngine`), the router (`useRouter`).

- [ ] **Step 1: Create `InboundEmailCard`**

Create `src/components/call/InboundEmailCard.tsx`:

```tsx
import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faPaperclip } from "@fortawesome/pro-regular-svg-icons";
import { useInboundEmail } from "#/components/call/useInboundEmail";
import { startUnderwriting } from "#/components/call/heroInbound";

/** The self-arriving owner email, surfaced in the sidebar flow. Shows the body + attachment
 * chips; offers to underwrite when the property is eligible. */
export function InboundEmailCard() {
  const inbound = useInboundEmail((s) => s.inbound);
  const clearInbound = useInboundEmail((s) => s.clearInbound);
  const router = useRouter();
  if (!inbound) return null;

  const underwrite = () => {
    startUnderwriting(inbound.dealId);
    const dealId = inbound.dealId;
    clearInbound();
    router.navigate({ to: "/listings/$listingId", params: { listingId: dealId } });
  };

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
        <FontAwesomeIcon icon={faEnvelope} />
        Email — {inbound.from}
      </div>
      <div className="fw-semibold">{inbound.subject}</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{inbound.body}</div>
      <div className="d-flex flex-column gap-1">
        {inbound.attachments.map((a) => (
          <div key={a} className="small text-muted d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faPaperclip} />
            {a}
          </div>
        ))}
      </div>
      {inbound.canUnderwrite && (
        <div className="d-flex gap-2">
          <Button variant="primary" size="sm" onClick={underwrite}>
            Underwrite this deal
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clearInbound()}>
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render it + speak the summary once in `AssistantSidebar`**

In `src/components/ai/AssistantSidebar.tsx`:
- Add imports:

```tsx
import { InboundEmailCard } from "#/components/call/InboundEmailCard";
import { useInboundEmail } from "#/components/call/useInboundEmail";
import { inboundSummaryText } from "#/components/call/heroInbound";
```

- Render the card in the sidebar flow, next to where `CallRecapCard` / `CallBriefCard` render:

```tsx
<InboundEmailCard />
```

- Add a one-way spoken-summary effect (mirrors the recap-speech effect — NO conversation mode / mic re-arm):

```tsx
const inbound = useInboundEmail((s) => s.inbound);
const spokenInboundRef = useRef<object | null>(null);
useEffect(() => {
  if (!inbound || inbound === spokenInboundRef.current) return;
  spokenInboundRef.current = inbound;
  requestAnimationFrame(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  });
  if (!voiceEnabled) return;
  void voiceEngine.speak(inboundSummaryText(inbound)); // one-way: no re-arm
}, [inbound, voiceEnabled]);
```

> Use the existing `voiceEngine`/`voiceEnabled`/`scrollRef` already imported in the file (mirror the recap effect at the same location). Additive only — do not change existing effects.

- [ ] **Step 3: Verify gates**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.
Run: `bun --bun run test`
Expected: full suite green.

- [ ] **Step 4: Commit**

```bash
git add src/components/call/InboundEmailCard.tsx src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): render the inbound owner email in the sidebar + speak Otto's offer"
```

---

## Final verification

- [ ] `bun --bun run test` — full suite green.
- [ ] `bun --bun x tsc --noEmit` — 0 errors.
- [ ] Whole-branch review (superpowers:requesting-code-review) of the 4B range before handing back.

## Manual browser smoke test (hand to the user — real ANTHROPIC + ELEVENLABS keys)

1. Run the hero call to Marcus (4A) and hang up → the recap's "What Otto did" appears.
2. **~10s later**, unprompted: a toast "New email from Marcus Pinckney"; the sidebar shows an **email card** (from Marcus, the generated body, "…— Rent Roll.xlsx" + "…— T-12.pdf" chips); Otto **speaks** a one-line summary once (no mic re-arm).
3. Open the deal → the rent roll + T-12 appear in the overview **Files** section; the Activities tab shows the "Sent the rent roll and T-12" message.
4. Click **Underwrite this deal** → navigates to the deal and the underwriting row starts **generating** (existing flow); "Not now" dismisses and leaves the docs filed.
5. Key-less check (unset `ANTHROPIC_API_KEY`): the email still self-arrives with the deterministic fallback body; the whole beat runs.
6. Cancel path: start another call right after the recap (before ~10s) — the earlier pending email does not arrive.
