# AI Phase 4C — Underwrite + BOV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** After the hero underwrite completes, flag the occupancy mismatch (stated ≈94% vs T-12 actual ≈78%) on the underwriting review, have Otto draft a BOV (AI narrative + a grounded, occupancy-adjusted value range) in the sidebar, and on Send file a BOV document + a first-class Activity-feed entry.

**Architecture:** A pure `computeOccupancyMismatch`/`bovValueRange`; a `generateBov` generator; a new `addDealActivity` store action; a `useBovDraft` store armed by 4B's `startUnderwriting`; a `BovWatcher` (AppShell) that drafts the BOV when the armed deal's underwriting result is ready; a sidebar `BovCard` + one-way spoken summary; and a duotone occupancy-mismatch Alert on the underwriting review. Does NOT rewrite the shared underwriting builder.

**Tech Stack:** TanStack Start + React 19 · TypeScript · Zustand · Zod (default import) · `@tanstack/ai` · Vitest · Blueprint React + Bootstrap · FontAwesome Pro.

**Design spec:** `docs/superpowers/specs/2026-07-24-ai-phase-4c-underwrite-bov-design.md`

## Global Constraints

- Gates: `bun --bun run test` green AND `bun --bun x tsc --noEmit` 0 errors. `vite build` does NOT type-check.
- Ignore biome + the pre-existing `ReferenceError: module is not defined` Vitest stderr line.
- No Playwright. `import z from "zod"` default. New generator schema Anthropic strict-compatible AND registered in `src/ai/generate/schemaCompat.test.ts`.
- Everything key-less via deterministic fallbacks. Assistant = **Otto**. FontAwesome `pro-regular` (Alert/Banner use **duotone**), NEVER `fixedWidth`. Blueprint `Button`/`Alert` + Bootstrap; no unsolicited redesigns. Any spoken summary is ONE-WAY (no conversation mode / mic re-arm).
- Commit after every task. Branch `joel/ai-tools` — no merge/push/PR.

## Verified signatures (consume exactly)

- Underwriting result stored at `listing.underwriting.result` (`UnderwritingResult = { strategy, metrics: UnderwritingMetric[], sections, inputs:{address,askingPrice,buildingSqFt,capRate} }`); `UnderwritingMetric = { key, label, value:number, display, format }`; metric keys incl. `netOperatingIncome`, `goingInCapRate`, `askingPrice` (`underwritingResult.ts:66`).
- `Property.occupancyPct:number` (`types.ts:201`), `Property.financialRecords: PropertyFinancialRecord[]` (`[0]` current; `.occupancyPct`, `.source`, `.vacancyRate`, `types.ts:343`), `residentialUnits`, `buildingSqFt`, `askingPrice`, `capRate`.
- `getProperty(id)`, `getContact(id)`, `addDealDocument(listingId, doc)`, `addDealMessage(listingId,{author,text})` (`src/data/store.ts`). `patchListing` is module-internal to store.ts.
- `DealActivity = { id, type, note, actor, timestamp }` (`types.ts:573`); `Listing.activities: DealActivity[]`.
- `CURRENT_USER` (`src/data/teammates.ts`, name "Ethan Thompson"). `contactFullName` (`src/components/contacts/contactDisplay.ts`).
- `startUnderwriting(dealId)` (`src/components/call/heroInbound.ts`) — extend to arm the BOV.
- Generator pattern + `runGenerator`, `AI_MODEL_REASONING` (`src/ai/generate/`). Mirror `generateDraftReply` (`generators.ts`).
- `Alert` (`@buildoutinc/blueprint-react/ui/Alert`): `<Alert severity="warning" withIcon><Alert.Title>…</Alert.Title>…</Alert>`.
- `useAssistant.getState().setOpen(true)`; `voiceEngine.speak(text)` (`#/ai/voice/voiceEngine`).
- `applyHeroes` signal block at `seed.ts:1789` (the 4A coercion to extend).

## File Structure

- `src/data/seed.ts` — **Modify**: extend the `if (h.signal)` block (Palmetto Court financials + occupancy gap).
- `src/components/deals/underwriting/occupancyMismatch.ts` — **Create**: `computeOccupancyMismatch`, `bovValueRange`.
- `src/data/store.ts` — **Modify**: `addDealActivity`.
- `src/ai/generate/{schemas,prompts,fallbacks,generators,index}.ts` + `schemaCompat.test.ts` — **Modify**: `generateBov`.
- `src/components/call/useBovDraft.ts` — **Create**: store + `buildBovDraft` + `bovSummaryText`.
- `src/components/call/heroInbound.ts` — **Modify**: `startUnderwriting` arms `useBovDraft`.
- `src/components/call/BovWatcher.tsx` — **Create**; mounted in `src/components/layout/AppShell.tsx` — **Modify**.
- `src/components/call/BovCard.tsx` — **Create**; rendered + spoken in `src/components/ai/AssistantSidebar.tsx` — **Modify**.
- `src/components/deals/underwriting/DealUnderwritingTab.tsx` — **Modify**: occupancy-mismatch Alert.

---

### Task 1: Seed Palmetto Court financials + occupancy gap

**Files:** Modify `src/data/seed.ts`; Test `src/data/seed.palmetto.test.ts`

**Interfaces:** Produces — after `generateDataset()`, Marcus's property has `residentialUnits:48`, `occupancyPct:94`, `financialRecords[0].occupancyPct:78` (source `'T-12 actuals'`), and stays underwriting-eligible.

- [ ] **Step 1: Failing test** — `src/data/seed.palmetto.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateDataset } from "./seed";

describe("Palmetto Court financials + occupancy gap", () => {
  const { contacts, properties } = generateDataset();
  const marcus = contacts.find((c) => c.heroKey === "marcus")!;
  const prop = properties.find((p) => p.id === marcus.propertyIds[0])!;

  it("is a 48-unit multifamily with a stated-vs-actual occupancy gap", () => {
    expect(prop.propertyType).toBe("multifamily");
    expect(prop.residentialUnits).toBe(48);
    expect(prop.occupancyPct).toBe(94); // stated / marketing
    expect(prop.financialRecords[0].occupancyPct).toBe(78); // T-12 actual
    expect(prop.financialRecords[0].source).toBe("T-12 actuals");
  });
});
```

- [ ] **Step 2: Run** `bun --bun run test seed.palmetto` → FAIL.

- [ ] **Step 3: Extend the signal block** in `src/data/seed.ts` — inside `if (h.signal) { … }` (at `seed.ts:1789`), AFTER the existing `host.propertyIds = [...]` line and before the block's closing brace, add:

```ts
      // Phase 4C: make the hero property read like a real 48-unit workforce building
      // with a STATED (marketing) vs ACTUAL (T-12) occupancy gap the underwrite flags.
      heroProp.residentialUnits = 48
      heroProp.buildingSqFt = 41_000
      heroProp.askingPrice = 6_200_000
      heroProp.capRate = 0.058
      heroProp.occupancyPct = 94 // stated
      if (heroProp.financialRecords[0]) {
        heroProp.financialRecords[0].source = 'T-12 actuals'
        heroProp.financialRecords[0].occupancyPct = 78 // actual
        heroProp.financialRecords[0].vacancyRate = 0.22
      }
```

- [ ] **Step 4: Run** `bun --bun run test seed.palmetto` → PASS; then `bun --bun run test` (full suite) → PASS; `bun --bun x tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts src/data/seed.palmetto.test.ts
git commit -m "feat(data): seed Palmetto Court as a 48-unit building with a T-12 occupancy gap"
```

---

### Task 2: `occupancyMismatch.ts` — mismatch + value range

**Files:** Create `src/components/deals/underwriting/occupancyMismatch.ts`; Test `…/occupancyMismatch.test.ts`

**Interfaces:** Produces — `interface OccupancyMismatch { stated:number; actual:number; gapPts:number; isMismatch:boolean }`; `computeOccupancyMismatch(property: Property): OccupancyMismatch`; `bovValueRange(result: UnderwritingResult, mismatch: OccupancyMismatch): { low:number; high:number }`.

- [ ] **Step 1: Failing test** — `occupancyMismatch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Property } from "#/data/types";
import type { UnderwritingResult } from "#/data/types";
import { computeOccupancyMismatch, bovValueRange } from "./occupancyMismatch";

const prop = (stated: number, actual?: number): Property =>
  ({ occupancyPct: stated, financialRecords: actual == null ? [] : [{ occupancyPct: actual }] } as unknown as Property);

const result = (noi: number, cap: number): UnderwritingResult =>
  ({
    strategy: "value-add", sections: [], inputs: { address: "x", askingPrice: 6_200_000, buildingSqFt: 41_000, capRate: cap },
    metrics: [
      { key: "netOperatingIncome", label: "NOI", value: noi, display: "", format: "money" },
      { key: "goingInCapRate", label: "Cap", value: cap, display: "", format: "percent" },
    ],
  } as unknown as UnderwritingResult);

describe("computeOccupancyMismatch", () => {
  it("flags a >=10pt gap", () => {
    expect(computeOccupancyMismatch(prop(94, 78))).toEqual({ stated: 94, actual: 78, gapPts: 16, isMismatch: true });
  });
  it("no mismatch when close", () => {
    expect(computeOccupancyMismatch(prop(94, 92)).isMismatch).toBe(false);
  });
  it("no records → actual = stated, no mismatch", () => {
    expect(computeOccupancyMismatch(prop(94)).isMismatch).toBe(false);
  });
});

describe("bovValueRange", () => {
  it("adjusts value down for the actual occupancy, 10k-rounded", () => {
    const m = computeOccupancyMismatch(prop(94, 78));
    const { low, high } = bovValueRange(result(400_000, 0.058), m);
    // adjNoi = 400000 * (78/94) = 331914.9; mid = /0.058 = 5,722,671; low ~5,436,540 high ~6,008,800
    expect(low % 10_000).toBe(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(6_200_000); // below asking because occupancy is lower than stated
  });
  it("no mismatch → occFactor 1", () => {
    const m = computeOccupancyMismatch(prop(94, 92));
    const { low, high } = bovValueRange(result(400_000, 0.058), m);
    expect(high).toBeGreaterThan(low);
  });
});
```

- [ ] **Step 2: Run** `bun --bun run test occupancyMismatch` → FAIL.

- [ ] **Step 3: Implement** `src/components/deals/underwriting/occupancyMismatch.ts`:

```ts
import type { Property, UnderwritingResult } from "#/data/types";

export interface OccupancyMismatch {
  stated: number;
  actual: number;
  gapPts: number;
  isMismatch: boolean;
}

/** Compare the property's stated (marketing) occupancy against the newest financial
 * record's (T-12) occupancy. A gap of >= 10 points is a mismatch worth flagging. */
export function computeOccupancyMismatch(property: Property): OccupancyMismatch {
  const stated = property.occupancyPct;
  const actual = property.financialRecords?.[0]?.occupancyPct ?? stated;
  const gapPts = Math.round(stated - actual);
  return { stated, actual, gapPts, isMismatch: gapPts >= 10 };
}

function metricValue(result: UnderwritingResult, key: string): number | undefined {
  return result.metrics.find((m) => m.key === key)?.value;
}

/** A grounded BOV value range: the underwriting NOI/cap, adjusted DOWN for the actual
 * occupancy when there's a mismatch, ±5%, rounded to 10k. Falls back to asking ±5%. */
export function bovValueRange(
  result: UnderwritingResult,
  mismatch: OccupancyMismatch,
): { low: number; high: number } {
  const noi = metricValue(result, "netOperatingIncome");
  const cap = metricValue(result, "goingInCapRate");
  const round10k = (n: number) => Math.round(n / 10_000) * 10_000;
  let mid: number;
  if (noi && cap) {
    const occFactor = mismatch.isMismatch && mismatch.stated > 0 ? mismatch.actual / mismatch.stated : 1;
    mid = (noi * occFactor) / cap;
  } else {
    mid = result.inputs.askingPrice;
  }
  return { low: round10k(mid * 0.95), high: round10k(mid * 1.05) };
}
```

- [ ] **Step 4: Run** `bun --bun run test occupancyMismatch` → PASS; `bun --bun x tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/underwriting/occupancyMismatch.ts src/components/deals/underwriting/occupancyMismatch.test.ts
git commit -m "feat(underwriting): occupancy mismatch + grounded BOV value range"
```

---

### Task 3: `addDealActivity` store action

**Files:** Modify `src/data/store.ts`; Test `src/data/addDealActivity.test.ts`

**Interfaces:** Produces — `addDealActivity(listingId: string, activity: { type: string; note: string; actor: string }): Listing | undefined`.

- [ ] **Step 1: Failing test** — `src/data/addDealActivity.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "./dataStore";
import { generateDataset } from "./seed";
import { addDealActivity } from "./store";

describe("addDealActivity", () => {
  beforeEach(() => {
    const ds = generateDataset();
    useDataStore.setState({ listings: new Map(ds.listings.map((l) => [l.id, l])) } as never);
  });
  it("appends a DealActivity to the listing", () => {
    const id = [...useDataStore.getState().listings.values()][0].id;
    const before = useDataStore.getState().listings.get(id)!.activities.length;
    addDealActivity(id, { type: "bov", note: "Sent BOV — $5.4M–$6.0M", actor: "Ethan Thompson" });
    const after = useDataStore.getState().listings.get(id)!.activities;
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toMatchObject({ type: "bov", note: "Sent BOV — $5.4M–$6.0M", actor: "Ethan Thompson" });
  });
  it("returns undefined for an unknown listing", () => {
    expect(addDealActivity("nope", { type: "x", note: "y", actor: "z" })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `bun --bun run test addDealActivity` → FAIL.

- [ ] **Step 3: Implement** — in `src/data/store.ts`, next to `addDealMessage`, add (ensure `DealActivity` is imported from `./types` — add it to the existing type import if absent):

```ts
export function addDealActivity(
  listingId: string,
  activity: { type: string; note: string; actor: string },
): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId)
  if (!existing) return undefined
  const full: DealActivity = {
    id: crypto.randomUUID(),
    type: activity.type,
    note: activity.note,
    actor: activity.actor,
    timestamp: new Date().toISOString(),
  }
  return patchListing(listingId, { activities: [...existing.activities, full] })
}
```

- [ ] **Step 4: Run** `bun --bun run test addDealActivity` → PASS; full suite → PASS; `bun --bun x tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts src/data/addDealActivity.test.ts
git commit -m "feat(data): add addDealActivity store action (Activity-feed append)"
```

---

### Task 4: `generateBov` generator

**Files:** Modify `src/ai/generate/{schemas,prompts,fallbacks,generators,index}.ts` + `schemaCompat.test.ts`; Test `src/ai/generate/bov.test.ts`

**Interfaces:** Produces — `BovSpec = z.object({ headline: z.string(), rationale: z.string(), occupancyNote: z.string() })`; `BovSpecT`; `bovFallback(valueLow, valueHigh, mismatch: { isMismatch:boolean; stated:number; actual:number }): BovSpecT`; `generateBov` server fn taking `{ property:{name,address}, valueLow, valueHigh, askingPrice, noi, capRate, mismatch }`.

- [ ] **Step 1: Failing test** — `src/ai/generate/bov.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BovSpec } from "./schemas";
import { bovFallback } from "./fallbacks";

describe("bovFallback", () => {
  it("is schema-valid and notes the occupancy gap when present", () => {
    const r = bovFallback(5_400_000, 6_000_000, { isMismatch: true, stated: 94, actual: 78 });
    expect(() => BovSpec.parse(r)).not.toThrow();
    expect(r.occupancyNote).not.toBe("");
  });
  it("empty occupancyNote when no mismatch", () => {
    const r = bovFallback(5_400_000, 6_000_000, { isMismatch: false, stated: 94, actual: 92 });
    expect(r.occupancyNote).toBe("");
  });
});
```

- [ ] **Step 2: Run** `bun --bun run test bov` → FAIL.

- [ ] **Step 3: Schema** — `schemas.ts` (after `DraftReplySpec`):

```ts
/** §4.1 — Broker Opinion of Value narrative (numbers come from bovValueRange, not the LLM). */
export const BovSpec = z.object({
  headline: z.string(),
  rationale: z.string(),
  occupancyNote: z.string(),
});
export type BovSpecT = z.infer<typeof BovSpec>;
```

- [ ] **Step 4: Prompt** — `prompts.ts`:

```ts
/** §4.1 — Broker Opinion of Value. Justify the GIVEN value range; never invent numbers. */
export const BOV_PROMPT = `You write a broker's opinion of value (BOV) for a commercial property. You are GIVEN a value range, the asking price, NOI, and cap rate — justify that range; do NOT invent different numbers. Rules:
- headline: a one-line value thesis (e.g. "Positioned at $5.4M–$6.0M on in-place income").
- rationale: 2-4 sentences grounding the range in NOI / cap rate / asset class / submarket. CRE-native, no fluff.
- occupancyNote: if a stated-vs-actual occupancy mismatch is present, explain the gap and that the value reflects the LOWER in-place occupancy; if there is no mismatch, return an EMPTY string.
Return only the structured object.`;
```

- [ ] **Step 5: Fallback** — `fallbacks.ts` (add `BovSpecT` to the existing `./schemas` type import), then:

```ts
export function bovFallback(
  valueLow: number,
  valueHigh: number,
  mismatch: { isMismatch: boolean; stated: number; actual: number },
): BovSpecT {
  const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
  return {
    headline: `Positioned at ${money(valueLow)}–${money(valueHigh)} on in-place income.`,
    rationale:
      `The range reflects trailing net operating income capitalized at market and adjusted ` +
      `for the asset's condition and submarket. It brackets a defensible clearing price for a ` +
      `qualified buyer.`,
    occupancyNote: mismatch.isMismatch
      ? `Note: marketing shows ${mismatch.stated}% occupancy, but the T-12 reflects ${mismatch.actual}%. ` +
        `The value is priced on the lower in-place occupancy.`
      : "",
  };
}
```

- [ ] **Step 6: Generator** — `generators.ts` (add imports `BovSpec`/`BovSpecT`, `BOV_PROMPT`, `bovFallback`):

```ts
/** §4.1 — BOV narrative. REASONING model (synthesis over the deal numbers). */
export const generateBov = createServerFn({ method: "POST" })
  .validator(
    (d: {
      property: { name: string; address: string };
      valueLow: number;
      valueHigh: number;
      askingPrice: number;
      noi: number;
      capRate: number;
      mismatch: { isMismatch: boolean; stated: number; actual: number };
    }) => d,
  )
  .handler(({ data }): Promise<BovSpecT> =>
    runGenerator({
      model: AI_MODEL_REASONING,
      system: BOV_PROMPT,
      user: JSON.stringify(data),
      schema: BovSpec,
      fallback: () => bovFallback(data.valueLow, data.valueHigh, data.mismatch),
    }),
  );
```

- [ ] **Step 7: Re-export** — `index.ts`: `generateBov` (from ./generators), `bovFallback` (from ./fallbacks).

- [ ] **Step 8: Register** — `schemaCompat.test.ts`: import `BovSpec` + add `["BovSpec", BovSpec]` to `LLM_SCHEMAS`.

- [ ] **Step 9: Run** `bun --bun run test bov schemaCompat` → PASS; full suite → PASS; `bun --bun x tsc --noEmit` → 0.

- [ ] **Step 10: Commit**

```bash
git add src/ai/generate
git commit -m "feat(ai): add generateBov generator (BOV narrative)"
```

---

### Task 5: `useBovDraft` store + arm-on-underwrite + `buildBovDraft`/`bovSummaryText`

**Files:** Create `src/components/call/useBovDraft.ts`; Modify `src/components/call/heroInbound.ts`; Test `src/components/call/useBovDraft.test.ts`

**Interfaces:**
- Consumes: `generateBov` (`#/ai/generate`), `computeOccupancyMismatch`/`bovValueRange` (`#/components/deals/underwriting/occupancyMismatch`), `OccupancyMismatch`, `BovSpecT`, `UnderwritingResult`, `Property`.
- Produces: `interface BovDraft { dealId; valueLow; valueHigh; mismatch: OccupancyMismatch; spec: BovSpecT }`; `useBovDraft` (Zustand: `armedDealId: string|null`, `draft: BovDraft|null`, `armFor(dealId)`, `setDraft(d)`, `clear()`); `buildBovDraft(dealId, property, result): Promise<BovDraft>`; `bovSummaryText(draft): string`.

- [ ] **Step 1: Failing test** — `src/components/call/useBovDraft.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("#/ai/generate", () => ({
  generateBov: vi.fn(async () => ({ headline: "H", rationale: "R", occupancyNote: "N" })),
}));

import type { Property, UnderwritingResult } from "#/data/types";
import { useBovDraft, buildBovDraft, bovSummaryText } from "./useBovDraft";

const prop = ({ occupancyPct: 94, name: "Palmetto Court", street: "12 King St", financialRecords: [{ occupancyPct: 78 }] } as unknown) as Property;
const result = ({
  strategy: "value-add", sections: [], inputs: { address: "12 King St", askingPrice: 6_200_000, buildingSqFt: 41_000, capRate: 0.058 },
  metrics: [
    { key: "netOperatingIncome", value: 400_000, label: "", display: "", format: "money" },
    { key: "goingInCapRate", value: 0.058, label: "", display: "", format: "percent" },
  ],
} as unknown) as UnderwritingResult;

describe("useBovDraft", () => {
  it("arms, sets, clears", () => {
    useBovDraft.getState().armFor("d1");
    expect(useBovDraft.getState().armedDealId).toBe("d1");
    useBovDraft.getState().clear();
    expect(useBovDraft.getState().armedDealId).toBeNull();
    expect(useBovDraft.getState().draft).toBeNull();
  });
});

describe("buildBovDraft", () => {
  it("computes an occupancy-adjusted range + attaches the generated spec", async () => {
    const d = await buildBovDraft("d1", prop, result);
    expect(d.dealId).toBe("d1");
    expect(d.mismatch.isMismatch).toBe(true);
    expect(d.valueHigh).toBeGreaterThan(d.valueLow);
    expect(d.spec.headline).toBe("H");
  });
});

describe("bovSummaryText", () => {
  it("mentions the value range and flags the occupancy gap", async () => {
    const d = await buildBovDraft("d1", prop, result);
    const s = bovSummaryText(d);
    expect(s.toLowerCase()).toContain("occupancy");
  });
});
```

- [ ] **Step 2: Run** `bun --bun run test useBovDraft` → FAIL.

- [ ] **Step 3: Implement** `src/components/call/useBovDraft.ts`:

```ts
import { create } from "zustand";
import type { Property, UnderwritingResult } from "#/data/types";
import type { BovSpecT } from "#/ai/generate/schemas";
import { generateBov } from "#/ai/generate";
import { computeOccupancyMismatch, bovValueRange, type OccupancyMismatch } from "#/components/deals/underwriting/occupancyMismatch";

export interface BovDraft {
  dealId: string;
  valueLow: number;
  valueHigh: number;
  mismatch: OccupancyMismatch;
  spec: BovSpecT;
}

interface BovDraftState {
  armedDealId: string | null;
  draft: BovDraft | null;
  armFor: (dealId: string) => void;
  setDraft: (d: BovDraft) => void;
  clear: () => void;
}

export const useBovDraft = create<BovDraftState>((set) => ({
  armedDealId: null,
  draft: null,
  armFor: (armedDealId) => set({ armedDealId }),
  setDraft: (draft) => set({ draft }),
  clear: () => set({ armedDealId: null, draft: null }),
}));

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

function metricValue(result: UnderwritingResult, key: string): number {
  return result.metrics.find((m) => m.key === key)?.value ?? 0;
}

/** Compute the mismatch + grounded range, then generate the BOV narrative. Deterministic
 * except the narrative, which falls back key-less. */
export async function buildBovDraft(
  dealId: string,
  property: Property,
  result: UnderwritingResult,
): Promise<BovDraft> {
  const mismatch = computeOccupancyMismatch(property);
  const { low, high } = bovValueRange(result, mismatch);
  let spec: BovSpecT;
  try {
    spec = await generateBov({
      data: {
        property: { name: property.name, address: result.inputs.address },
        valueLow: low,
        valueHigh: high,
        askingPrice: result.inputs.askingPrice,
        noi: metricValue(result, "netOperatingIncome"),
        capRate: metricValue(result, "goingInCapRate"),
        mismatch: { isMismatch: mismatch.isMismatch, stated: mismatch.stated, actual: mismatch.actual },
      },
    });
  } catch {
    spec = {
      headline: `Positioned at ${money(low)}–${money(high)}.`,
      rationale: "Range grounded in trailing NOI capitalized at market.",
      occupancyNote: mismatch.isMismatch
        ? `Marketing shows ${mismatch.stated}% occupancy; the T-12 reflects ${mismatch.actual}%.`
        : "",
    };
  }
  return { dealId, valueLow: low, valueHigh: high, mismatch, spec };
}

/** Otto's one-line spoken summary on the BOV draft (one-way). */
export function bovSummaryText(draft: BovDraft): string {
  const range = `${money(draft.valueLow)} to ${money(draft.valueHigh)}`;
  const flag = draft.mismatch.isMismatch
    ? ` Heads up — the T-12 shows ${draft.mismatch.actual}% occupancy versus ${draft.mismatch.stated}% stated, so I priced on the lower in-place occupancy.`
    : "";
  return `I've priced Palmetto Court at ${range} and drafted the BOV.${flag} Want me to send it?`;
}
```

- [ ] **Step 4: Arm on underwrite** — in `src/components/call/heroInbound.ts`, in `startUnderwriting(dealId)`, add after the `updateListingUnderwriting(...)` call: `useBovDraft.getState().armFor(dealId);` (import `useBovDraft` from `./useBovDraft`).

- [ ] **Step 5: Run** `bun --bun run test useBovDraft heroInbound` → PASS; full suite → PASS; `bun --bun x tsc --noEmit` → 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/call/useBovDraft.ts src/components/call/useBovDraft.test.ts src/components/call/heroInbound.ts
git commit -m "feat(call): useBovDraft store + buildBovDraft + arm-on-underwrite"
```

---

### Task 6: `BovWatcher` (AppShell) + `BovCard` + sidebar render/speak/send

**Files:** Create `src/components/call/BovWatcher.tsx`, `src/components/call/BovCard.tsx`; Modify `src/components/layout/AppShell.tsx`, `src/components/ai/AssistantSidebar.tsx`
(No unit test — UI/watcher wiring; the draft/summary logic is tested in Task 5.)

**Interfaces:** Consumes — `useBovDraft`, `buildBovDraft`, `bovSummaryText` (Task 5); `useDataStore`/`getProperty` (`#/data/store`), `addDealDocument`, `addDealActivity` (`#/data/store`); `CURRENT_USER`; `voiceEngine`, `useAssistant`.

- [ ] **Step 1: `BovWatcher.tsx`** — mounted observer that drafts the BOV once when the armed deal's underwriting result is ready:

```tsx
import { useEffect, useRef } from "react";
import { useDataStore, getProperty } from "#/data/store";
import { useBovDraft, buildBovDraft } from "./useBovDraft";
import { useAssistant } from "#/ai/useAssistant";

/** Renders nothing. When the BOV-armed deal's underwriting result is ready, builds the BOV
 * draft once and opens the sidebar. Armed by startUnderwriting (the hero underwrite). */
export function BovWatcher() {
  const armedDealId = useBovDraft((s) => s.armedDealId);
  const listing = useDataStore((s) => (armedDealId ? s.listings.get(armedDealId) : undefined));
  const status = listing?.underwriting?.status;
  const hasResult = !!listing?.underwriting?.result;
  const builtFor = useRef<string | null>(null);

  useEffect(() => {
    if (!armedDealId) {
      builtFor.current = null;
      return;
    }
    if (builtFor.current === armedDealId) return;
    if (!listing || !hasResult || (status !== "generated" && status !== "ready")) return;
    const property = getProperty(listing.propertyId);
    if (!property) return;
    builtFor.current = armedDealId;
    void buildBovDraft(armedDealId, property, listing.underwriting!.result!).then((draft) => {
      useBovDraft.getState().setDraft(draft);
      useAssistant.getState().setOpen(true);
    });
  }, [armedDealId, listing, status, hasResult]);

  return null;
}
```

- [ ] **Step 2: Mount in AppShell** — `src/components/layout/AppShell.tsx`: import + `{hydrated && <BovWatcher />}` next to `<HeroInboundWatcher />`.

- [ ] **Step 3: `BovCard.tsx`**:

```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileInvoiceDollar, faTriangleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { useBovDraft } from "#/components/call/useBovDraft";
import { addDealDocument, addDealActivity } from "#/data/store";
import { CURRENT_USER } from "#/data/teammates";

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export function BovCard() {
  const draft = useBovDraft((s) => s.draft);
  const clear = useBovDraft((s) => s.clear);
  if (!draft) return null;
  const range = `${money(draft.valueLow)}–${money(draft.valueHigh)}`;

  const send = () => {
    const now = new Date().toISOString();
    addDealDocument(draft.dealId, {
      id: crypto.randomUUID(),
      name: "Palmetto Court — BOV.pdf",
      uploadedAt: now,
      size: "0.4 MB",
      aiGenerated: true,
    });
    addDealActivity(draft.dealId, {
      type: "bov",
      note: `Sent BOV to Marcus — ${range}`,
      actor: CURRENT_USER.name,
    });
    clear();
  };

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
        <FontAwesomeIcon icon={faFileInvoiceDollar} />
        Broker Opinion of Value
      </div>
      <div className="fw-bold fs-5">{range}</div>
      <div>{draft.spec.headline}</div>
      <div className="text-muted">{draft.spec.rationale}</div>
      {draft.mismatch.isMismatch && draft.spec.occupancyNote && (
        <div className="d-flex align-items-start gap-2 text-warning-emphasis">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <div className="small">{draft.spec.occupancyNote}</div>
        </div>
      )}
      <div className="d-flex gap-2">
        <Button variant="primary" size="sm" onClick={send}>Send BOV</Button>
        <Button variant="ghost" size="sm" onClick={() => clear()}>Not now</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Sidebar render + one-way speak** — `AssistantSidebar.tsx`: import `BovCard`, `useBovDraft`, `bovSummaryText`; render `<BovCard />` next to `<InboundEmailCard />`; add a one-way spoken-summary effect mirroring the inbound effect:

```tsx
const bovDraft = useBovDraft((s) => s.draft);
const spokenBovRef = useRef<object | null>(null);
useEffect(() => {
  if (!bovDraft || bovDraft === spokenBovRef.current) return;
  spokenBovRef.current = bovDraft;
  requestAnimationFrame(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); });
  if (!voiceEnabled) return;
  void voiceEngine.speak(bovSummaryText(bovDraft)); // one-way: no re-arm
}, [bovDraft, voiceEnabled]);
```

- [ ] **Step 5: Verify** `bun --bun x tsc --noEmit` → 0; `bun --bun run test` → full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/components/call/BovWatcher.tsx src/components/call/BovCard.tsx src/components/layout/AppShell.tsx src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): BovWatcher + BovCard — Otto drafts + sends the BOV"
```

---

### Task 7: Occupancy-mismatch Alert on the underwriting review

**Files:** Modify `src/components/deals/underwriting/DealUnderwritingTab.tsx`
(No unit test — UI; the derivation is tested in Task 2.)

**Interfaces:** Consumes — `computeOccupancyMismatch` (Task 2), `getProperty`, `Alert`.

- [ ] **Step 1: Compute the mismatch in the parent + pass to `UnderwritingBreakdown`** — in `DealUnderwritingTab.tsx`:
  - Import `computeOccupancyMismatch` from `./occupancyMismatch`, `getProperty` from `#/data/store`, and `Alert` from `@buildoutinc/blueprint-react/ui/Alert`.
  - Where the parent renders `<UnderwritingBreakdown result={result} … />` (≈ line 133), add a `mismatch` prop: `mismatch={(() => { const p = getProperty(listing.propertyId); return p ? computeOccupancyMismatch(p) : null; })()}` (or compute into a `const mismatch` above the return).
  - Add `mismatch: OccupancyMismatch | null` to `UnderwritingBreakdown`'s props type (import the type).

- [ ] **Step 2: Render the Alert** — inside `UnderwritingBreakdown`, immediately after the header block and before the "Key metrics" section, add:

```tsx
      {mismatch?.isMismatch && (
        <Alert severity="warning" withIcon>
          <Alert.Title>Occupancy mismatch</Alert.Title>
          Priced on stated {mismatch.stated}% occupancy; the T-12 actuals show{" "}
          {mismatch.actual}% — the valuation may be overstated at the asking price.
        </Alert>
      )}
```

> Blueprint `Alert` renders its own duotone icon via `withIcon`; do NOT pass a `fixedWidth` icon.

- [ ] **Step 3: Verify** `bun --bun x tsc --noEmit` → 0; `bun --bun run test` → full suite green.

- [ ] **Step 4: Commit**

```bash
git add src/components/deals/underwriting/DealUnderwritingTab.tsx
git commit -m "feat(underwriting): flag the occupancy mismatch on the review with an Alert"
```

---

## Final verification

- [ ] `bun --bun run test` — full suite green.
- [ ] `bun --bun x tsc --noEmit` — 0 errors.
- [ ] Whole-branch review (superpowers:requesting-code-review) of the 4C range.

## Manual smoke test (hand to the user — real ANTHROPIC + ELEVENLABS keys)

1. Run the hero arc through 4B, click "Underwrite this deal" → navigates to the deal; underwriting generates.
2. When it completes: Otto surfaces a **BOV card** in the sidebar (value range below the asking price, headline, rationale, ⚠️ occupancy note) and speaks a one-line summary once (no mic re-arm).
3. The deal's underwriting review shows a **duotone occupancy-mismatch Alert** (stated 94% vs T-12 78%).
4. Click **Send BOV** → a "Palmetto Court — BOV.pdf" document is filed and a "Sent BOV to Marcus — $X–$Y" entry appears on the deal's **Activity** feed; "Not now" dismisses.
5. Key-less (unset `ANTHROPIC_API_KEY`): the BOV still drafts with the deterministic fallback narrative.
6. Non-hero check: generate underwriting on an ordinary deal from the deal page → NO BOV card appears.
