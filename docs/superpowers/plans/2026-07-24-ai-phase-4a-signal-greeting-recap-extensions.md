# AI Phase 4A — Signal, Greeting & Recap Hero-Extensions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the front half of the hero arc — an overnight signal on owner Marcus Pinckney that the greeting names, a "yes"/"brief me first" that opens the Phase-3 live call, and a hang-up recap that auto-opens the opportunity, moves it into the pipeline, schedules the Thursday tour, and narrates it as Otto.

**Architecture:** Additive, mirroring Phases 1–3. New signal data on `Contact` + a Marcus hero fixture; a tiny `useHeroOffer` store + pure `matchOfferIntent` for the keyless "yes" fast-path; a new `generateCallBrief` generator; a pure `heroRecapExtensions` module that performs the three writes and returns a narration + summary, invoked from `callFlow.endCall`. Reactive state in Zustand; effectful/imperative logic in module singletons and pure functions; presentational components stay thin.

**Tech Stack:** TanStack Start + React 19 · TypeScript · Zustand · Zod (default import) · `@tanstack/ai` (Anthropic adapter) · Vitest · Blueprint React + Bootstrap · FontAwesome Pro.

**Design spec:** `docs/superpowers/specs/2026-07-24-ai-phase-4a-signal-greeting-recap-extensions-design.md`

## Global Constraints

- Gates: `bun --bun run test` green AND `bun --bun x tsc --noEmit` 0 errors. `vite build` does NOT type-check — never rely on it for types.
- Non-gates to ignore: biome; the pre-existing `ReferenceError: module is not defined` Vitest stderr line.
- **No Playwright.** Pure logic is unit-tested; UI/audio/live-call paths are verified by the manual browser smoke test (§ end).
- `import z from "zod"` — **default import** (named `{ z }` resolves to `undefined` under this repo's Vitest).
- Every new generator schema must be **Anthropic strict-output compatible** (NO `.min()`/`.max()` on arrays; NO nullable objects — use a required object + a sentinel and map in the consumer) AND registered in `src/ai/generate/schemaCompat.test.ts`. `runGenerator` swallows a 400 into the fallback, so this fails silently without the test.
- Everything runs **key-less** via deterministic fallbacks.
- The in-product assistant is named **Otto** (not "Al").
- FontAwesome `pro-regular` by default; **never** pass `fixedWidth`. Blueprint React + Bootstrap utilities (no Tailwind). No unsolicited redesigns of existing components.
- Commit after every task (frequent commits). The branch is `joel/ai-tools` — do NOT merge/push/open PRs; leave it as-is.

## File Structure

- `src/data/types.ts` — **Modify**: add `OwnerSignal` interface, `Contact.signal?`, `HeroKey += 'marcus'`.
- `src/data/signal.ts` — **Create**: `signalText(contact)` + `getOvernightSignalContact()`.
- `src/data/seed.ts` — **Modify**: `HeroFixture.signal?`; Marcus fixture; signal + multifamily-property wiring in `applyHeroes`.
- `src/ai/heroOffer.ts` — **Create**: `useHeroOffer` store + `matchOfferIntent`.
- `src/ai/voice/greeting.ts` — **Modify**: add `buildGreetingWithOffer()` (store reads → text + offer).
- `src/ai/voice/useGreeting.ts` — **Modify**: use `buildGreetingWithOffer()` and set the offer.
- `src/ai/generate/{schemas,prompts,generators,fallbacks,index}.ts` + `schemaCompat.test.ts` — **Modify**: `CallBriefSpec`, `CALL_BRIEF_PROMPT`, `generateCallBrief`, `callBriefFallback`.
- `src/components/call/CallBriefCard.tsx` — **Create**.
- `src/components/ai/AssistantSidebar.tsx` — **Modify**: offer routing in `send`, `HeroOfferChips`, hero narration append.
- `src/components/call/heroRecapExtensions.ts` — **Create**: `isHeroCall`, `applyHeroRecapExtensions`, `undoHeroActions`, `heroNarration`.
- `src/components/call/useCallStore.ts` — **Modify**: `heroActions` state.
- `src/components/call/callFlow.ts` — **Modify**: enrich target with `signalText`; run extensions on `endCall`.
- `src/components/call/CallRecapCard.tsx` — **Modify**: additive "What Otto did" done-state block + Undo.

---

### Task 0: Global Al → Otto rename

Rename the assistant across Phase 1–3 **code + tests** (user-facing strings, spoken narration, comments where "Al" is the assistant's name). Historical design docs + the PRD keep "Al".

**Files:**
- Modify: any `src/**/*.{ts,tsx}` with the assistant name "Al" (e.g. `src/components/call/callRecap.ts:10` `"Al reports"`, `src/ai/voice/greeting.ts`, `src/components/call/CallRecapCard.tsx:16`, `src/components/ai/*`).
- Modify tests: `src/ai/voice/greeting.test.ts` and any test asserting "Al".

- [ ] **Step 1: Inventory the occurrences**

Run: `rg -n "\bAl\b" src --glob '!**/*.snap'`
Expected: a list of matches. Review each: rename ONLY where "Al" is the assistant's name (strings, comments, JSDoc). Do NOT touch unrelated identifiers that merely contain the letters `al` (e.g. `calling`, `total`, `Alert`), and do NOT touch the `docs/` specs.

- [ ] **Step 2: Apply the rename**

Edit each real occurrence "Al" → "Otto". Notable copy: `callRecap.ts` JSDoc `"Al reports"` → `"Otto reports"`; the recap message in `composeRecapReport` has no "Al" literal (safe); comments like `// Al goes quiet` in `callFlow.ts:132` → `// Otto goes quiet`.

- [ ] **Step 3: Update tests that assert the name**

If any test asserts "Al" as the assistant name, update the expectation to "Otto". (The greeting copy in `greeting.ts` uses no "Al" literal — verify before editing `greeting.test.ts`.)

- [ ] **Step 4: Verify gates**

Run: `bun --bun run test`
Expected: PASS (all suites green).
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.
Run: `rg -n "\bAl\b" src` and confirm no remaining match is the assistant name.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "refactor(ai): rename the assistant Al -> Otto across the app"
```

---

### Task 1: OwnerSignal model + signal helpers

**Files:**
- Modify: `src/data/types.ts` (add `OwnerSignal`; `Contact.signal?`; extend `HeroKey`)
- Create: `src/data/signal.ts`
- Test: `src/data/signal.test.ts`

**Interfaces:**
- Produces: `interface OwnerSignal { kind: 'loan-maturity'|'hold-expiry'|'ownership-change'|'market-pressure'; headline: string; detail: string; observedAt: string }`; `Contact.signal?: OwnerSignal`; `signalText(contact: Pick<Contact,'signal'>): string`; `getOvernightSignalContact(): Contact | null`.

- [ ] **Step 1: Write the failing test**

Create `src/data/signal.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Contact } from "./types";
import { signalText, getOvernightSignalContact } from "./signal";
import { useDataStore } from "./dataStore";

const baseContact = (over: Partial<Contact>): Contact =>
  ({
    id: "c1", firstName: "Marcus", lastName: "Pinckney",
    propertyIds: [], role: "owner",
    ...over,
  } as unknown as Contact);

describe("signalText", () => {
  it("renders the signal string when present", () => {
    const c = baseContact({
      signal: { kind: "loan-maturity", headline: "$4.2M CMBS loan maturing", detail: "d", observedAt: "2026-07-24" },
    });
    expect(signalText(c)).toBe("$4.2M CMBS loan maturing");
  });
  it("returns empty string when no signal", () => {
    expect(signalText(baseContact({}))).toBe("");
  });
});

describe("getOvernightSignalContact", () => {
  beforeEach(() => {
    useDataStore.setState({ contacts: new Map() });
  });
  it("finds the heroKey==='marcus' contact", () => {
    const marcus = baseContact({ id: "m", heroKey: "marcus" });
    useDataStore.setState({ contacts: new Map([["m", marcus]]) });
    expect(getOvernightSignalContact()?.id).toBe("m");
  });
  it("returns null when absent", () => {
    expect(getOvernightSignalContact()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test signal`
Expected: FAIL (`signal.ts` does not exist / exports missing).

- [ ] **Step 3: Add the types**

In `src/data/types.ts`, above `interface Contact`:

```ts
export interface OwnerSignal {
  kind: 'loan-maturity' | 'hold-expiry' | 'ownership-change' | 'market-pressure'
  /** Short, for the greeting — e.g. "$4.2M CMBS loan maturing". */
  headline: string
  /** Full sentence — for the brief / call-turn / prospect. */
  detail: string
  /** ISO date; "overnight". */
  observedAt: string
}
```

Add to `interface Contact` (near `heroKey?`):

```ts
  /** An overnight market signal on this owner (Phase 4A). */
  signal?: OwnerSignal
```

Extend the union:

```ts
export type HeroKey = 'rosa' | 'earl' | 'victor' | 'margaret' | 'patricia' | 'marcus'
```

- [ ] **Step 4: Write the implementation**

Create `src/data/signal.ts`:

```ts
import type { Contact } from "./types";
import { useDataStore } from "./dataStore";

/** The string form of an owner's signal, used by the greeting's overnightSignal
 * and by generator `property.signal` payloads. Empty when there is no signal. */
export function signalText(contact: Pick<Contact, "signal">): string {
  return contact.signal?.headline ?? "";
}

/** The single overnight-signal owner that lights the greeting (the hero, Marcus).
 * Null when the seed hasn't placed one. */
export function getOvernightSignalContact(): Contact | null {
  for (const c of useDataStore.getState().contacts.values()) {
    if (c.heroKey === "marcus" && c.signal) return c;
  }
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --bun run test signal`
Expected: PASS.
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/signal.ts src/data/signal.test.ts
git commit -m "feat(data): add OwnerSignal on Contact + signal helpers"
```

---

### Task 2: Seed Marcus Pinckney as the overnight-signal hero

Marcus is a new hero owner with a `signal` and **no deal yet** (the arc creates it), linked to a **multifamily** property (so Phase 4C's underwriting is eligible).

**Files:**
- Modify: `src/data/seed.ts` (extend `HeroFixture`, add the Marcus fixture, wire signal + property in `applyHeroes`)
- Test: `src/data/seed.marcus.test.ts`

**Interfaces:**
- Consumes: `OwnerSignal`, `HeroKey` (Task 1); `propertyQualifiesForUnderwriting` from `src/components/deals/underwriting/eligibility.ts`.
- Produces: after `generateDataset()`, a `Contact` with `heroKey==='marcus'`, `role:'owner'`, a `signal`, and a linked property that qualifies for underwriting.

- [ ] **Step 1: Write the failing test**

Create `src/data/seed.marcus.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateDataset } from "./seed";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";

describe("Marcus Pinckney hero seed", () => {
  const { contacts, properties } = generateDataset();
  const marcus = contacts.find((c) => c.heroKey === "marcus");

  it("exists as an owner with an overnight signal and no deal yet", () => {
    expect(marcus).toBeDefined();
    expect(marcus!.role).toBe("owner");
    expect(marcus!.firstName).toBe("Marcus");
    expect(marcus!.lastName).toBe("Pinckney");
    expect(marcus!.signal?.kind).toBe("loan-maturity");
  });

  it("is linked to an underwriting-eligible (multifamily) property", () => {
    const linked = marcus!.propertyIds
      .map((id) => properties.find((p) => p.id === id))
      .filter(Boolean);
    expect(linked.some((p) => propertyQualifiesForUnderwriting(p!))).toBe(true);
  });
});
```

> Note: `generateDataset()` returns `{ properties, contacts, listings, … }` (see `src/data/seed.ts` bottom export). Confirm the returned property array key name when implementing and adjust the destructure if needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test seed.marcus`
Expected: FAIL (no `marcus` hero).

- [ ] **Step 3: Extend the HeroFixture interface**

In `src/data/seed.ts`, add to `interface HeroFixture` (after `dealName?`):

```ts
  /** An overnight market signal on this owner (Phase 4A hero). Owners with a
   * signal but `deal: null` get a coerced multifamily "hero property" so the
   * arc's opportunity + underwriting land on a real building. */
  signal?: OwnerSignal
```

Add the `OwnerSignal` import to the existing `#/data/types` import in `seed.ts`.

- [ ] **Step 4: Add the Marcus fixture**

Append to the `HERO_FIXTURES` array (after Patricia):

```ts
  {
    heroKey: 'marcus',
    firstName: 'Marcus',
    lastName: 'Pinckney',
    company: 'Pinckney Holdings LLC',
    title: 'Owner',
    role: 'owner',
    source: 'Cold outreach',
    relationship: 'nurturing',
    tags: ['Local', 'Off-market'],
    notes:
      'Owns a 48-unit workforce building on the peninsula. Guarded; hates being sold to. Lead with the loan, not the listing.',
    createdDaysAgo: 220,
    lastContactedDaysAgo: 95,
    lastTouch: 'Added to book',
    openTaskCount: 0,
    deal: null,
    dealName: 'Palmetto Court',
    signal: {
      kind: 'loan-maturity',
      headline: "a $4.2M CMBS loan on Marcus Pinckney's Palmetto Court maturing in 90 days",
      detail:
        'Palmetto Court carries a $4.2M CMBS loan maturing in ~90 days; refinancing at today’s rates is tight, which often turns a reluctant owner into a seller.',
      observedAt: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    },
  },
```

- [ ] **Step 5: Wire the signal + multifamily property in `applyHeroes`**

In `applyHeroes`, inside the `HERO_FIXTURES.forEach`, **after** the `Object.assign(host, {...})` block and **before** `if (!h.deal) return`, insert:

```ts
    // Phase 4A hero: an owner carrying a signal but no deal yet. Give them a
    // multifamily "hero property" (coerced if needed) so the arc's opportunity
    // and its underwriting land on a real, eligible building.
    if (h.signal) {
      host.signal = h.signal
      const usedPropIds = new Set(
        listings.filter((l) => claimed.has(l.id)).map((l) => l.propertyId),
      )
      const heroProp =
        properties.find((p) => p.propertyType === 'multifamily' && !usedPropIds.has(p.id)) ??
        properties.find((p) => !usedPropIds.has(p.id))!
      heroProp.propertyType = 'multifamily'
      heroProp.propertySubtype = 'Mid-Rise'
      if (h.dealName) heroProp.name = h.dealName
      host.propertyIds = [heroProp.id, ...host.propertyIds.filter((id) => id !== heroProp.id)]
    }
```

> `deal: null` means the existing `if (!h.deal) return` runs right after — Marcus claims no listing, exactly as intended.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun --bun run test seed.marcus`
Expected: PASS.
Run: `bun --bun run test` (full suite — the seed feeds many tests)
Expected: PASS.
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/data/seed.ts src/data/seed.marcus.test.ts
git commit -m "feat(data): seed Marcus Pinckney as the overnight-signal hero owner"
```

---

### Task 3: `useHeroOffer` store + `matchOfferIntent`

**Files:**
- Create: `src/ai/heroOffer.ts`
- Test: `src/ai/heroOffer.test.ts`

**Interfaces:**
- Produces: `type HeroOffer = { kind: 'call' | 'brief'; contactId: string }`; `useHeroOffer` (Zustand: `pendingOffer: HeroOffer | null`, `setOffer(o)`, `clearOffer()`); `matchOfferIntent(text: string): 'call' | 'brief' | null`.

- [ ] **Step 1: Write the failing test**

Create `src/ai/heroOffer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchOfferIntent, useHeroOffer } from "./heroOffer";

describe("matchOfferIntent", () => {
  it("recognises yes-intents as 'call'", () => {
    for (const t of ["yes", "Yeah", "sure", "go ahead", "do it", "let's go", "call him", "please do"]) {
      expect(matchOfferIntent(t)).toBe("call");
    }
  });
  it("recognises brief-intents as 'brief'", () => {
    for (const t of ["brief me first", "brief me", "what's the signal?", "give me more first"]) {
      expect(matchOfferIntent(t)).toBe("brief");
    }
  });
  it("returns null for anything else", () => {
    for (const t of ["who is he", "no thanks", "show my tasks", "later"]) {
      expect(matchOfferIntent(t)).toBeNull();
    }
  });
});

describe("useHeroOffer", () => {
  it("sets and clears the pending offer", () => {
    useHeroOffer.getState().setOffer({ kind: "call", contactId: "m" });
    expect(useHeroOffer.getState().pendingOffer).toEqual({ kind: "call", contactId: "m" });
    useHeroOffer.getState().clearOffer();
    expect(useHeroOffer.getState().pendingOffer).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test heroOffer`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Create `src/ai/heroOffer.ts`:

```ts
import { create } from "zustand";

export type HeroOffer = { kind: "call" | "brief"; contactId: string };

interface HeroOfferState {
  pendingOffer: HeroOffer | null;
  setOffer: (o: HeroOffer) => void;
  clearOffer: () => void;
}

export const useHeroOffer = create<HeroOfferState>((set) => ({
  pendingOffer: null,
  setOffer: (pendingOffer) => set({ pendingOffer }),
  clearOffer: () => set({ pendingOffer: null }),
}));

const BRIEF = /\bbrief\b|what'?s the signal|more (?:first|before)|tell me (?:more|about the signal)/i;
const YES = /\b(yes|yeah|yep|yup|sure|ok(?:ay)?|please|absolutely|definitely)\b|go ahead|do it|let'?s go|call (?:him|her|them|marcus)|make the call/i;

/** Classify a broker reply to a pending hero offer. Brief takes precedence over
 * yes (a "yes, but brief me" should brief). Null → not a clear offer response. */
export function matchOfferIntent(text: string): "call" | "brief" | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (BRIEF.test(t)) return "brief";
  if (YES.test(t)) return "call";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test heroOffer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/heroOffer.ts src/ai/heroOffer.test.ts
git commit -m "feat(ai): add useHeroOffer store + matchOfferIntent"
```

---

### Task 4: Greeting wires the signal + arms the offer

**Files:**
- Modify: `src/ai/voice/greeting.ts` (add `buildGreetingWithOffer`)
- Modify: `src/ai/voice/useGreeting.ts` (use it + set the offer)
- Test: `src/ai/voice/greeting.test.ts` (extend)

**Interfaces:**
- Consumes: `composeGreeting` (existing), `getOvernightSignalContact`/`signalText` (Task 1), `buildAssistantContext` (existing), `HeroOffer` (Task 3).
- Produces: `buildGreetingWithOffer(): { text: string; offer: HeroOffer | null }`.

- [ ] **Step 1: Write the failing test**

Append to `src/ai/voice/greeting.test.ts`:

```ts
import { buildGreetingWithOffer } from "./greeting";
import { useDataStore } from "#/data/dataStore";
import type { Contact } from "#/data/types";

describe("buildGreetingWithOffer", () => {
  it("names the overnight signal and arms a call offer when the hero is present", () => {
    const marcus = {
      id: "m", firstName: "Marcus", lastName: "Pinckney", role: "owner", propertyIds: [], heroKey: "marcus",
      signal: { kind: "loan-maturity", headline: "a maturing CMBS loan", detail: "d", observedAt: "2026-07-24" },
    } as unknown as Contact;
    useDataStore.setState({ contacts: new Map([["m", marcus]]) });
    const { text, offer } = buildGreetingWithOffer();
    expect(text).toContain("maturing CMBS loan");
    expect(offer).toEqual({ kind: "call", contactId: "m" });
  });

  it("has no offer when there is no hero signal", () => {
    useDataStore.setState({ contacts: new Map() });
    const { offer } = buildGreetingWithOffer();
    expect(offer).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test greeting`
Expected: FAIL (`buildGreetingWithOffer` missing).

- [ ] **Step 3: Implement `buildGreetingWithOffer`**

In `src/ai/voice/greeting.ts`, add imports + function:

```ts
import { buildAssistantContext } from "#/ai/context";
import { getOvernightSignalContact, signalText } from "#/data/signal";
import type { HeroOffer } from "#/ai/heroOffer";

/** The session greeting text plus the offer to arm (call the signal owner).
 * Composed from the live store so it works key-less. */
export function buildGreetingWithOffer(): { text: string; offer: HeroOffer | null } {
  const marcus = getOvernightSignalContact();
  const text = composeGreeting(buildAssistantContext(), {
    overnightSignal: marcus ? signalText(marcus) : undefined,
  });
  const offer: HeroOffer | null = marcus ? { kind: "call", contactId: marcus.id } : null;
  return { text, offer };
}
```

- [ ] **Step 4: Wire it into `useGreeting`**

In `src/ai/voice/useGreeting.ts`, replace the `composeGreeting(buildAssistantContext())` line and arm the offer:

```ts
import { buildGreetingWithOffer } from "./greeting";
import { useHeroOffer } from "#/ai/heroOffer";
// remove the now-unused composeGreeting/buildAssistantContext imports if they are only used here
```

Inside the effect, replace:

```ts
    const text = composeGreeting(buildAssistantContext());
    onGreeting(text);
```

with:

```ts
    const { text, offer } = buildGreetingWithOffer();
    onGreeting(text);
    if (offer) useHeroOffer.getState().setOffer(offer);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun --bun run test greeting`
Expected: PASS.
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors (fix any now-unused-import errors in `useGreeting.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/ai/voice/greeting.ts src/ai/voice/useGreeting.ts src/ai/voice/greeting.test.ts
git commit -m "feat(ai): greeting names the overnight signal and arms the call offer"
```

---

### Task 5: `generateCallBrief` generator (schema + prompt + generator + fallback + schemaCompat)

**Files:**
- Modify: `src/ai/generate/schemas.ts` (`CallBriefSpec`)
- Modify: `src/ai/generate/prompts.ts` (`CALL_BRIEF_PROMPT`)
- Modify: `src/ai/generate/fallbacks.ts` (`callBriefFallback`)
- Modify: `src/ai/generate/generators.ts` (`generateCallBrief`)
- Modify: `src/ai/generate/index.ts` (re-exports)
- Modify: `src/ai/generate/schemaCompat.test.ts` (register `CallBriefSpec`)
- Test: `src/ai/generate/callBrief.test.ts`

**Interfaces:**
- Produces: `CallBriefSpec = z.object({ opener, leadWith, ask, voicemail })` (all `z.string()`); `CallBriefSpecT`; `callBriefFallback(signalDetail: string, firstName: string): CallBriefSpecT`; `generateCallBrief` server fn taking `{ candidate, property, signal }`.

- [ ] **Step 1: Write the failing test**

Create `src/ai/generate/callBrief.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CallBriefSpec } from "./schemas";
import { callBriefFallback } from "./fallbacks";

describe("callBriefFallback", () => {
  it("produces a schema-valid brief from the signal", () => {
    const brief = callBriefFallback("A $4.2M loan matures in 90 days.", "Marcus");
    expect(() => CallBriefSpec.parse(brief)).not.toThrow();
    expect(brief.voicemail).toContain("Marcus");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test callBrief`
Expected: FAIL (`CallBriefSpec`/`callBriefFallback` missing).

- [ ] **Step 3: Add the schema**

In `src/ai/generate/schemas.ts` (after `CallRecapSpec`):

```ts
/** §3.4 / §4.1 pre-call brief. All strings → Anthropic strict-output safe. */
export const CallBriefSpec = z.object({
  opener: z.string(),
  leadWith: z.string(),
  ask: z.string(),
  voicemail: z.string(),
});
export type CallBriefSpecT = z.infer<typeof CallBriefSpec>;
```

- [ ] **Step 4: Add the prompt**

In `src/ai/generate/prompts.ts` (after the recap prompt):

```ts
/** §4.1 — signal-driven pre-call brief for the hero call. */
export const CALL_BRIEF_PROMPT = `You write a broker's pre-call brief for a cold outreach call to a property owner, built around a market signal. Keep it tactical and CRE-native.
- opener: the exact first line to say when the owner picks up (warm, one sentence, references the signal indirectly — do NOT sound like a cold sales pitch).
- leadWith: the single angle to lead with (the signal), phrased as guidance to the broker.
- ask: the specific, low-friction ask for this call (e.g. a quick conversation, not a listing).
- voicemail: a 2-3 sentence voicemail script naming the owner's first name and leaving a callback reason.
Return only the structured object.`;
```

- [ ] **Step 5: Add the fallback**

In `src/ai/generate/fallbacks.ts` (import the type at top, then append):

```ts
import type { /* …existing… */ CallBriefSpecT } from "./schemas";

/** §4.1 — deterministic pre-call brief from the signal when the model is
 * unavailable. */
export function callBriefFallback(signalDetail: string, firstName: string): CallBriefSpecT {
  return {
    opener: `Hi ${firstName}, it's Otto's broker — do you have thirty seconds? I'll be quick.`,
    leadWith: signalDetail || "Lead with the timing pressure on their asset, not a listing pitch.",
    ask: "Ask for a short conversation this week — no listing talk, just options.",
    voicemail: `${firstName}, quick call about your building — there's a time-sensitive angle worth two minutes. Call me back when you get a sec.`,
  };
}
```

> If `fallbacks.ts` already imports named types from `./schemas`, add `CallBriefSpecT` to that existing import instead of adding a second import line.

- [ ] **Step 6: Add the generator**

In `src/ai/generate/generators.ts`, add `CallBriefSpec`/`CallBriefSpecT` + `CALL_BRIEF_PROMPT` + `callBriefFallback` to the existing imports, then append:

```ts
/** §4.1 — pre-call brief. Default (fast) model; short signal-driven generation. */
export const generateCallBrief = createServerFn({ method: "POST" })
  .validator(
    (d: {
      candidate: { name: string; role: string; entity: string; note: string; phone: string };
      property: unknown | null;
      signal: string;
      firstName: string;
    }) => d,
  )
  .handler(({ data }): Promise<CallBriefSpecT> =>
    runGenerator({
      system: CALL_BRIEF_PROMPT,
      user: JSON.stringify({
        candidate: data.candidate,
        property: data.property ?? null,
        signal: data.signal,
      }),
      schema: CallBriefSpec,
      fallback: () => callBriefFallback(data.signal, data.firstName),
    }),
  );
```

- [ ] **Step 7: Re-export**

In `src/ai/generate/index.ts`, add `generateCallBrief` to the `./generators` export list and `callBriefFallback` to the `./fallbacks` export list.

- [ ] **Step 8: Register in schemaCompat**

In `src/ai/generate/schemaCompat.test.ts`, add `CallBriefSpec` to the `./schemas` import and to the `LLM_SCHEMAS` array:

```ts
  ["CallBriefSpec", CallBriefSpec],
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `bun --bun run test callBrief schemaCompat`
Expected: PASS (both the fallback test and the new schemaCompat case).
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/ai/generate
git commit -m "feat(ai): add generateCallBrief generator (schema + prompt + fallback)"
```

---

### Task 6: `CallBriefCard` + sidebar offer routing (call / brief / fall-through) + chips

**Files:**
- Create: `src/components/call/CallBriefCard.tsx`
- Modify: `src/components/ai/AssistantSidebar.tsx` (intercept offer in `send`; render chips + brief card)
- (No unit test — this is UI wiring; verified by the manual smoke test. The intent classifier it relies on is tested in Task 3.)

**Interfaces:**
- Consumes: `useHeroOffer`, `matchOfferIntent` (Task 3); `callFlow.open` (`src/components/call/callFlow.ts`); `generateCallBrief`, `signalText` (Tasks 5/1); `getContact` (`src/data/store.ts`); `CallBriefSpecT` (Task 5).
- Produces: `CallBriefCard` (props: `{ brief: CallBriefSpecT; contactName: string; onCall: () => void }`); an in-sidebar `HeroOfferChips`.

- [ ] **Step 1: Create `CallBriefCard`**

```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone } from "@fortawesome/pro-regular-svg-icons";
import type { CallBriefSpecT } from "#/ai/generate/schemas";

/** Signal-driven pre-call brief shown when the broker asks Otto to "brief me
 * first". A Call button starts the live call. */
export function CallBriefCard({
  brief,
  contactName,
  onCall,
}: {
  brief: CallBriefSpecT;
  contactName: string;
  onCall: () => void;
}) {
  const rows: [string, string][] = [
    ["Opener", brief.opener],
    ["Lead with", brief.leadWith],
    ["The ask", brief.ask],
    ["Voicemail", brief.voicemail],
  ];
  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="small text-muted text-uppercase fw-semibold">Call brief — {contactName}</div>
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="small text-muted fw-semibold">{label}</div>
          <div>{value}</div>
        </div>
      ))}
      <Button variant="primary" size="sm" onClick={onCall}>
        <FontAwesomeIcon icon={faPhone} /> Call {contactName}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Intercept the offer in `AssistantSidebar.send`**

Add imports to `AssistantSidebar.tsx`:

```tsx
import { useHeroOffer, matchOfferIntent } from "#/ai/heroOffer";
import { callFlow } from "#/components/call/callFlow";
import { getContact } from "#/data/store";
import { signalText } from "#/data/signal";
import { generateCallBrief } from "#/ai/generate";
import { CallBriefCard } from "#/components/call/CallBriefCard";
import type { CallBriefSpecT } from "#/ai/generate/schemas";
```

Add local brief state near the other `useState`/`useRef` in the component:

```tsx
const [brief, setBrief] = useState<{ spec: CallBriefSpecT; name: string; contactId: string } | null>(null);
```

At the **top** of the `send` callback body, before the `configuredRef` branch, insert:

```tsx
      const offer = useHeroOffer.getState().pendingOffer;
      if (offer) {
        const intent = matchOfferIntent(content);
        if (intent) {
          useHeroOffer.getState().clearOffer();
          setDraft("");
          const contact = getContact(offer.contactId);
          if (contact && intent === "call") {
            callFlow.open(contact);
            return;
          }
          if (contact && intent === "brief") {
            void generateCallBrief({
              data: {
                candidate: {
                  name: `${contact.firstName} ${contact.lastName}`.trim(),
                  role: contact.role,
                  entity: contact.company,
                  note: contact.notes ?? "",
                  phone: contact.phone,
                },
                property: null,
                signal: contact.signal?.detail ?? signalText(contact),
                firstName: contact.firstName,
              },
            }).then((spec) =>
              setBrief({ spec, name: `${contact.firstName} ${contact.lastName}`.trim(), contactId: contact.id }),
            );
            return;
          }
        } else {
          useHeroOffer.getState().clearOffer(); // fall through to the agent
        }
      }
```

Add the callback deps `[]`-safe: since it reads stores imperatively via `getState()`, no new deps are required beyond the existing ones.

- [ ] **Step 3: Render chips + the brief card**

Add a small `HeroOfferChips` inside the file (above the component's return), reading the offer reactively:

```tsx
function HeroOfferChips({ onCall, onBrief }: { onCall: () => void; onBrief: () => void }) {
  const offer = useHeroOffer((s) => s.pendingOffer);
  if (!offer) return null;
  return (
    <div className="d-flex gap-2 px-3 pb-2">
      <Button variant="primary" size="sm" onClick={onCall}>Yes, call now</Button>
      <Button variant="outline" size="sm" onClick={onBrief}>Brief me first</Button>
    </div>
  );
}
```

In the sidebar's JSX (near the composer / above the input, alongside where messages render), mount:

```tsx
{brief && (
  <div className="px-3 pb-2">
    <CallBriefCard
      brief={brief.spec}
      contactName={brief.name}
      onCall={() => { const c = getContact(brief.contactId); if (c) { setBrief(null); callFlow.open(c); } }}
    />
  </div>
)}
<HeroOfferChips onCall={() => send("yes")} onBrief={() => send("brief me first")} />
```

> The chips call `send(...)` so the click path and the voice/typed path share the exact same routing.

- [ ] **Step 4: Verify types + gates**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.
Run: `bun --bun run test`
Expected: PASS (no logic regressions).

- [ ] **Step 5: Commit**

```bash
git add src/components/call/CallBriefCard.tsx src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): route the hero offer (yes/brief) + render brief card and chips"
```

---

### Task 7: `heroRecapExtensions` — the hero writes, narration, and undo

**Files:**
- Create: `src/components/call/heroRecapExtensions.ts`
- Test: `src/components/call/heroRecapExtensions.test.ts`

**Interfaces:**
- Consumes: `createDeal`, `createTask`, `commitStageTransition`, `updateDealStage`, `deleteTask` (`src/data/actions.ts`); `emptyDraft` (`src/data/createListing.ts`); `getContact` (`src/data/store.ts`); `parseDueDate` (`src/ai/dueDate.ts`); `CURRENT_USER` (`src/data/teammates.ts`); `CallTarget` (`useCallStore`); `CallRecapSpecT` (`src/ai/generate/schemas.ts`).
- Produces: `interface HeroActions { dealId: string; dealName: string; movedToStage: 'active'; tourTaskId: string; tourDate: string; narration: string }`; `isHeroCall(target: CallTarget): boolean`; `applyHeroRecapExtensions(input: { target: CallTarget; recap: CallRecapSpecT }, opts?: { now?: Date }): HeroActions | null`; `undoHeroActions(actions: HeroActions): void`; `heroNarration(dealName: string, tourWeekday: string): string`.

- [ ] **Step 1: Write the failing test**

Create `src/components/call/heroRecapExtensions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { getContact } from "#/data/store";
import { isHeroCall, applyHeroRecapExtensions, undoHeroActions } from "./heroRecapExtensions";
import type { CallTarget } from "./useCallStore";
import type { CallRecapSpecT } from "#/ai/generate/schemas";

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

const targetFor = (contactId: string, name: string): CallTarget => ({
  contactId, name, entity: "Pinckney Holdings LLC", phone: "555", initials: "MP",
  firstName: "Marcus", role: "owner", note: "",
});

const recap: CallRecapSpecT = {
  sentiment: "positive",
  keyPoints: ["Open to a conversation."],
  tasks: [],
  opportunity: { name: "Palmetto Court", address: "12 King St" },
};

describe("heroRecapExtensions", () => {
  beforeEach(() => hydrate());

  it("isHeroCall is true for the signal owner, false otherwise", () => {
    const marcus = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "marcus")!;
    const other = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey !== "marcus" && !c.signal)!;
    expect(isHeroCall(targetFor(marcus.id, marcus.firstName))).toBe(true);
    expect(isHeroCall(targetFor(other.id, other.firstName))).toBe(false);
  });

  it("opens a proposal deal, moves it to active, and schedules the Thursday tour", () => {
    const marcus = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "marcus")!;
    const actions = applyHeroRecapExtensions(
      { target: targetFor(marcus.id, marcus.firstName), recap },
      { now: new Date("2026-07-24T09:00:00") }, // a Friday
    )!;
    expect(actions.movedToStage).toBe("active");
    expect(actions.tourDate).toBe("2026-07-30"); // next Thursday
    const deal = useDataStore.getState().listings.get(actions.dealId)!;
    expect(deal.status).toBe("active");
    const task = useDataStore.getState().tasks.get(actions.tourTaskId)!;
    expect(task.type).toBe("tour");
    expect(task.dueDate).toBe("2026-07-30");
    expect(actions.narration).toContain("pipeline");
  });

  it("undo removes the tour task and pulls the deal out of the pipeline", () => {
    const marcus = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "marcus")!;
    const actions = applyHeroRecapExtensions({ target: targetFor(marcus.id, marcus.firstName), recap })!;
    undoHeroActions(actions);
    expect(useDataStore.getState().tasks.get(actions.tourTaskId)).toBeUndefined();
    expect(useDataStore.getState().listings.get(actions.dealId)!.status).toBe("inactive");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test heroRecapExtensions`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

Create `src/components/call/heroRecapExtensions.ts`:

```ts
import type { CallTarget } from "./useCallStore";
import type { CallRecapSpecT } from "#/ai/generate/schemas";
import { createDeal, createTask, commitStageTransition, updateDealStage, deleteTask } from "#/data/actions";
import { emptyDraft } from "#/data/createListing";
import { getContact } from "#/data/store";
import { parseDueDate } from "#/ai/dueDate";
import { CURRENT_USER } from "#/data/teammates";

export interface HeroActions {
  dealId: string;
  dealName: string;
  movedToStage: "active";
  tourTaskId: string;
  tourDate: string;
  narration: string;
}

/** A hero call = the target owner carries an overnight signal (the arc's Marcus). */
export function isHeroCall(target: CallTarget | null): boolean {
  if (!target) return false;
  return !!getContact(target.contactId)?.signal;
}

export function heroNarration(dealName: string, tourDate: string): string {
  return (
    `I opened a new opportunity on ${dealName}, moved it into your pipeline, ` +
    `and put a tour on your calendar for ${tourDate}.`
  );
}

/** Auto-execute the hero recap extensions: open the opportunity on the owner's
 * (multifamily) property, advance it proposal→active, and schedule the Thursday
 * tour. Deterministic — runs regardless of API keys. Returns null if the target
 * isn't a hero or its contact/property can't be resolved. */
export function applyHeroRecapExtensions(
  input: { target: CallTarget; recap: CallRecapSpecT },
  opts: { now?: Date } = {},
): HeroActions | null {
  const { target, recap } = input;
  const contact = getContact(target.contactId);
  if (!contact || !contact.signal) return null;

  const propertyId = contact.propertyIds[0] ?? "";
  const dealName = recap.opportunity.name.trim() || target.entity || `${target.firstName}'s deal`;

  // 1. Open the opportunity on the owner's existing property (keeps it multifamily
  //    → underwriting-eligible in Phase 4C).
  const { deal } = createDeal({
    ...emptyDraft(),
    name: dealName,
    address: recap.opportunity.address,
    propertyId,
    propertyType: "multifamily",
    sellerContactId: contact.id,
    dealSide: "seller",
  });

  // 2. Move it into the pipeline (proposal → active), with a real history entry.
  commitStageTransition({
    dealId: deal.id,
    targetStage: "active",
    actor: CURRENT_USER.name,
    dealSide: "seller",
    sellerContactId: contact.id,
    publish: true,
  });

  // 3. Schedule the Thursday tour.
  const tourDate = parseDueDate("thursday", opts.now) ?? "";
  const { task } = createTask({
    name: `Tour ${dealName} with ${target.firstName}`,
    dueDate: tourDate,
    type: "tour",
    source: "deal",
    contactId: contact.id,
    dealId: deal.id,
  });

  return {
    dealId: deal.id,
    dealName,
    movedToStage: "active",
    tourTaskId: task.id,
    tourDate,
    narration: heroNarration(dealName, tourDate),
  };
}

/** Reverse the three writes (no hard deal-delete exists → move it off-ladder). */
export function undoHeroActions(actions: HeroActions): void {
  deleteTask(actions.tourTaskId);
  updateDealStage(actions.dealId, "inactive");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test heroRecapExtensions`
Expected: PASS.
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/call/heroRecapExtensions.ts src/components/call/heroRecapExtensions.test.ts
git commit -m "feat(call): hero recap extensions (open opp -> pipeline -> tour) + undo"
```

---

### Task 8: Wire the extensions into the call flow (`useCallStore.heroActions` + `callFlow`)

**Files:**
- Modify: `src/components/call/useCallStore.ts` (add `heroActions`)
- Modify: `src/components/call/callFlow.ts` (enrich target with signal; run extensions on `endCall`)
- Test: `src/components/call/useCallStore.test.ts` (extend, if present) or `src/components/call/callStoreHeroActions.test.ts`

**Interfaces:**
- Consumes: `applyHeroRecapExtensions`, `isHeroCall`, `HeroActions` (Task 7); `getContact`, `signalText` (Tasks 1).
- Produces: `useCallStore.heroActions: HeroActions | null`, `setHeroActions(a)`, `clearHeroActions()`; `CallTarget.signalText?: string`.

- [ ] **Step 1: Write the failing test**

Create `src/components/call/callStoreHeroActions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { useCallStore } from "./useCallStore";
import type { HeroActions } from "./heroRecapExtensions";

const sample: HeroActions = {
  dealId: "d", dealName: "Palmetto Court", movedToStage: "active",
  tourTaskId: "t", tourDate: "2026-07-30", narration: "…",
};

describe("useCallStore.heroActions", () => {
  it("sets and clears heroActions; reset clears it too", () => {
    useCallStore.getState().setHeroActions(sample);
    expect(useCallStore.getState().heroActions?.dealId).toBe("d");
    useCallStore.getState().clearHeroActions();
    expect(useCallStore.getState().heroActions).toBeNull();
    useCallStore.getState().setHeroActions(sample);
    useCallStore.getState().reset();
    expect(useCallStore.getState().heroActions).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test callStoreHeroActions`
Expected: FAIL (`setHeroActions` missing).

- [ ] **Step 3: Add `heroActions` to the store**

In `src/components/call/useCallStore.ts`:
- Add `import type { HeroActions } from "./heroRecapExtensions";`
- Add to `CallState`: `heroActions: HeroActions | null; setHeroActions: (a: HeroActions | null) => void; clearHeroActions: () => void;`
- Add to `IDLE`: `heroActions: null as HeroActions | null,`
- Add to the store body: `setHeroActions: (heroActions) => set({ heroActions }), clearHeroActions: () => set({ heroActions: null }),`
- Add `signalText?: string;` to the `CallTarget` interface (optional; set for hero calls).

- [ ] **Step 4: Enrich the target + run extensions in `callFlow`**

In `src/components/call/callFlow.ts`:
- Add imports: `import { applyHeroRecapExtensions, isHeroCall } from "./heroRecapExtensions";` and `import { getContact } from "#/data/store";` and `import { signalText } from "#/data/signal";`
- In `open(contact, phone?)`, add `signalText: signalText(contact) || undefined,` to the `startTarget({...})` object.
- In `runOwnerTurn`, change the `property` passed to `generateCallTurn` from `null` to the signal (so the hero owner references it):

```ts
        property: target.signalText ? { signal: target.signalText } : null,
```

- In `endCall`, after `useCallStore.getState().setRecap(recap);` and before `useAssistant.getState().setOpen(true);`, insert:

```ts
    if (isHeroCall(target)) {
      const actions = applyHeroRecapExtensions({ target, recap });
      if (actions) useCallStore.getState().setHeroActions(actions);
    }
```

> `endCall` already guards `if (mySession !== session) return;` before `setRecap`, so the extensions only run for the current call.

- [ ] **Step 5: Run tests + gates**

Run: `bun --bun run test callStoreHeroActions callFlow`
Expected: PASS (existing callFlow tests still green).
Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/call/useCallStore.ts src/components/call/callFlow.ts src/components/call/callStoreHeroActions.test.ts
git commit -m "feat(call): run hero recap extensions on hang-up + pass the signal to the owner turn"
```

---

### Task 9: Recap card "What Otto did" block + spoken narration

**Files:**
- Modify: `src/components/call/CallRecapCard.tsx` (additive done-state block + Undo)
- Modify: `src/components/ai/AssistantSidebar.tsx` (append hero narration to the spoken recap)
- (UI wiring — verified by smoke test; the `heroActions`/`narration` logic is tested in Tasks 7–8.)

**Interfaces:**
- Consumes: `useCallStore.heroActions`, `clearHeroActions` (Task 8); `undoHeroActions` (Task 7).

- [ ] **Step 1: Add the "What Otto did" block to `CallRecapCard`**

In `CallRecapCard.tsx`:
- Add store reads: `const heroActions = useCallStore((s) => s.heroActions); const clearHeroActions = useCallStore((s) => s.clearHeroActions);`
- Import `undoHeroActions`: `import { undoHeroActions } from "#/components/call/heroRecapExtensions";`
- In `dismiss()`, also call `clearHeroActions();`
- Before the closing `</div>` of the card, render (only when present):

```tsx
      {heroActions && (
        <div className="border rounded p-2 d-flex flex-column gap-2 bg-light">
          <div className="small text-muted text-uppercase fw-semibold">What Otto did</div>
          <ul className="mb-0 ps-3">
            <li>Opened opportunity <span className="fw-semibold">{heroActions.dealName}</span></li>
            <li>Moved it into your pipeline (Active)</li>
            <li>Scheduled a tour for {heroActions.tourDate}</li>
          </ul>
          <div className="d-flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.navigate({ to: "/listings/$listingId", params: { listingId: heroActions.dealId } })}>
              View deal
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { undoHeroActions(heroActions); clearHeroActions(); }}>
              Undo
            </Button>
          </div>
        </div>
      )}
```

- [ ] **Step 2: Append the narration to the spoken recap**

In `AssistantSidebar.tsx`, the recap-speech effect (currently around line 460) composes `message` via `composeRecapReport`. Extend the spoken text with the hero narration when present:

```tsx
    const { message } = composeRecapReport(recap, recapTarget?.name ?? "your contact");
    const hero = useCallStore.getState().heroActions;
    const spoken = hero ? `${recapSpeechText(message)} ${hero.narration}` : recapSpeechText(message);
    void voiceEngine.speak(spoken);
```

- [ ] **Step 3: Verify types + gates**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.
Run: `bun --bun run test`
Expected: PASS (full suite).

- [ ] **Step 4: Commit**

```bash
git add src/components/call/CallRecapCard.tsx src/components/ai/AssistantSidebar.tsx
git commit -m "feat(call): recap shows what Otto did (with undo) and narrates it aloud"
```

---

## Final verification

- [ ] Run `bun --bun run test` — full suite green.
- [ ] Run `bun --bun x tsc --noEmit` — 0 errors.
- [ ] Run `rg -n "\bAl\b" src` — no assistant-name "Al" remains.
- [ ] Whole-branch review (superpowers:requesting-code-review) before handing back.

## Manual browser smoke test (hand to the user — real ANTHROPIC + ELEVENLABS keys)

1. `bun --bun run dev`; open the app; open the assistant sidebar so the greeting fires.
2. Greeting **names Marcus's signal** ("…a $4.2M CMBS loan on Marcus Pinckney's Palmetto Court maturing…") and speaks it; **Yes, call now** / **Brief me first** chips appear.
3. Say/type/click **"yes"** → the live call opens to Marcus (countdown → ringing → connected); the owner references the loan signal.
4. Alternatively **"brief me first"** → the `CallBriefCard` shows opener/lead-with/ask/voicemail with a **Call Marcus** button.
5. Hang up (End) → recap appears: sentiment + key points, and a **"What Otto did"** block (opportunity **Palmetto Court**, moved to pipeline, Thursday tour); Otto **narrates** it. **View deal** opens the new Active deal; **Undo** removes the tour task and pulls the deal off the pipeline.
6. Confirm the new deal is on the multifamily property (so Phase 4C underwriting will be offered).
7. Key-less check (unset `ANTHROPIC_API_KEY`): the whole flow still runs — greeting names the signal, "yes" calls, recap + extensions + narration all fire via fallbacks.
