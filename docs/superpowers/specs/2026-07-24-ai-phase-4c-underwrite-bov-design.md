# AI Phase 4C — Underwrite + BOV

**Status:** Approved design (user delegated judgement for 4C/4D), ready for implementation plan
**Date:** 2026-07-24
**Program:** AI & Voice — see [`AI-VOICE-PRD.md`](./AI-VOICE-PRD.md) §4.1 steps 6–7
**Builds on:** 4A (hero deal + Marcus's multifamily property) and 4B (the inbound email whose "Underwrite this deal" accept kicks off underwriting via `startUnderwriting`)
**Branch:** `joel/ai-tools` (leave as-is; user handles PRs/merges)

> Assistant is **Otto**.

---

## 1. Context + verified ground truth

Hero-arc steps 6–7: after the broker accepts the underwrite (4B), Otto prices Palmetto Court,
**flags an occupancy mismatch** (stated ~94% vs T-12 actual ~78%), drafts a **BOV** (AI
narrative + a grounded, occupancy-adjusted value range), the broker **sends** it, and it lands
on the deal's **Activity timeline**.

Traced in the codebase:
- **The underwriting builder ignores occupancy.** `buildCtx(property)`
  (`src/components/deals/underwriting/underwritingResult.ts:31`) reads only `askingPrice`,
  `buildingSqFt`, `capRate`. Metrics include `netOperatingIncome` (=`price*cap`) and
  `goingInCapRate` (`buildMetrics` :66). `buildUnderwritingResult(property, underwriting)`
  (:287) returns `{ strategy, metrics: UnderwritingMetric[], sections, inputs:{address,
  askingPrice,buildingSqFt,capRate} }`, stored at `listing.underwriting.result` +
  `.generatedAt` by `generateUnderwritingResult(listingId)` (`src/data/store.ts:182`).
- **Occupancy exists on the data model, unused by underwriting:** `Property.occupancyPct`
  (`types.ts:201`) and `PropertyFinancialRecord.occupancyPct` (`types.ts:356`, newest-first;
  `[0]` is the current record, source e.g. `'T-12 actuals'`). → the mismatch is a **new
  derivation** comparing these two; the shared `buildCtx` is left untouched.
- **No BOV/valuation concept** — build new. Represent as a `DealDocument`
  (`{id,name,uploadedAt,size?,aiGenerated?}`, `types.ts:418`) via `addDealDocument`
  (`store.ts:194`).
- **No `addDealActivity`.** `Listing.activities: DealActivity[]` (`{id,type,note,actor,
  timestamp}`, `types.ts:573`) is never appended to; the Activity feed's `buildFeed`
  (`DealStubs.tsx:52`) already folds `activities` + `history`. → add `addDealActivity`
  mirroring `addDealMessage` (`store.ts:201`).
- **The 4B→4C seam:** 4B's `InboundEmailCard` "Underwrite" → `startUnderwriting(dealId)`
  (`heroInbound.ts`) sets `underwriting.status:"generating"` (value-add) + navigates; the
  deal-overview `UnderwritingPlannerRow` auto-runs generation on mount; `onComplete`
  (`UnderwritingPlannerRow.tsx:159` / `DealUnderwritingTab.tsx`) calls
  `generateUnderwritingResult` + `updateListingUnderwriting({status:"generated"})`. The
  result lands on the reactive store → observable.
- **Sidebar proactive pattern** (recap/inbound): a store flag + a card in `AssistantSidebar`
  + a one-way spoken summary (no mic re-arm). **Alert** component:
  `import { Alert } from "@buildoutinc/blueprint-react/ui/Alert"` →
  `<Alert severity="warning" withIcon><Alert.Title>…</Alert.Title>…</Alert>`
  (`SyndicationStatus.tsx:147`). Alert/Banner icons use **duotone** weight (per the `icons` skill).
- **Generator pattern** (mirror `generateDraftReply`): schema in `schemas.ts` → prompt →
  fallback → `createServerFn`+`runGenerator` → `index.ts` re-export → `schemaCompat.test.ts`.
  `AI_MODEL_REASONING = "claude-opus-4-8"` for synthesis over numbers.

---

## 2. Decisions (user-approved)

1. **Occupancy mismatch = focused deterministic derivation** (`computeOccupancyMismatch`),
   surfaced BOTH as a duotone **Alert on the underwriting review** AND in Otto's spoken
   summary. Does **not** rewrite `buildCtx` (all ~50 seeded deals + tests stay stable; the
   Alert only fires on a real gap → Palmetto Court).
2. **BOV = AI narrative + deterministic value range.** `generateBov` writes headline +
   rationale + occupancy note; `bovValueRange` computes low/high from the underwriting
   NOI/cap, **adjusted down for the actual occupancy** (honestly prices the 78%). Numbers
   never come from the LLM.
3. **Send → `addDealActivity`** (new store action) so the BOV lands as a first-class Activity
   entry, plus the BOV filed as a `DealDocument`.
4. **Trigger = arm-on-underwrite:** 4B's `startUnderwriting(dealId)` also arms `useBovDraft`
   for that deal, so the BOV is scoped to the hero-initiated underwrite (a plain deal-page
   "Generate" never triggers a BOV). A `BovWatcher` fires when the armed deal's underwriting
   result is ready.

### Non-goals
- The scripted director / reset-replay / overall arc timing coordination (4D).
- Rewriting the shared underwriting math to be occupancy-aware.

---

## 3. Architecture

```
src/data/
  seed.ts        ~ extend the 4A Marcus-property coercion: 48 units, realistic
                 #   askingPrice/buildingSqFt/capRate/occupancyPct(stated≈94) +
                 #   financialRecords[0] (T-12 actuals, occupancyPct≈78)
  store.ts       + addDealActivity(listingId, { type, note, actor }): Listing | undefined
  underwriting/occupancyMismatch.ts (NEW)
                 + computeOccupancyMismatch(property): OccupancyMismatch
                 + bovValueRange(result, mismatch): { low: number; high: number }

src/ai/generate/ + BovSpec, BOV_PROMPT, bovFallback, generateBov, index, schemaCompat

src/components/call/
  useBovDraft.ts (NEW)  # Zustand: armedDealId | null; draft: BovDraft | null;
                        #   armFor(dealId)/setDraft(d)/clear()
  BovWatcher.tsx (NEW)  # mounted in AppShell; when armedDealId's underwriting result is
                        #   ready → compute mismatch+range → generateBov → setDraft → open sidebar
  BovCard.tsx (NEW)     # sidebar: value range + occupancy note + rationale + Send/Not-now
  heroInbound.ts ~ startUnderwriting(dealId) also useBovDraft.getState().armFor(dealId)
  bovSummary.ts (NEW, or in useBovDraft) # bovSummaryText(draft) one-way spoken line

src/components/layout/AppShell.tsx     ~ mount <BovWatcher/>
src/components/ai/AssistantSidebar.tsx ~ render <BovCard/> + one-way spoken-summary effect
src/components/deals/underwriting/DealUnderwritingTab.tsx
                 ~ compute mismatch from the property, pass to UnderwritingBreakdown →
                 #   render a duotone Alert when isMismatch
```

### 3.1 Types

```ts
// occupancyMismatch.ts
export interface OccupancyMismatch {
  stated: number;   // property.occupancyPct
  actual: number;   // financialRecords[0].occupancyPct (T-12), or stated if none
  gapPts: number;   // round(stated - actual)
  isMismatch: boolean; // gapPts >= 10
}

// useBovDraft.ts
import type { BovSpecT } from "#/ai/generate/schemas";
export interface BovDraft {
  dealId: string;
  valueLow: number;
  valueHigh: number;
  mismatch: OccupancyMismatch;
  spec: BovSpecT;   // { headline, rationale, occupancyNote }
}
```

---

## 4. Occupancy mismatch + value range (§2 of the design)

- `computeOccupancyMismatch(property)`:
  `stated = property.occupancyPct`; `actual = property.financialRecords?.[0]?.occupancyPct ??
  stated`; `gapPts = Math.round(stated - actual)`; `isMismatch = gapPts >= 10`.
- `bovValueRange(result, mismatch)`:
  `noi = metric("netOperatingIncome").value`, `cap = metric("goingInCapRate").value`;
  `occFactor = mismatch.isMismatch ? mismatch.actual / mismatch.stated : 1`;
  `adjNoi = noi * occFactor`; `mid = adjNoi / cap`;
  `low = round(mid*0.95 / 10_000)*10_000`, `high = round(mid*1.05 / 10_000)*10_000`.
  Deterministic; if the metrics are missing, fall back to `result.inputs.askingPrice` ± 5%.
- **Alert** (duotone, `severity="warning"`) on `UnderwritingBreakdown` when `isMismatch`:
  "Priced on stated {stated}% occupancy; T-12 actuals show {actual}% — value may be
  overstated." The parent (`DealUnderwritingTab`) computes the mismatch from
  `getProperty(listing.propertyId)` and passes it in.

## 5. `generateBov` (§3 of the design)

```ts
export const BovSpec = z.object({
  headline: z.string(),      // one-line value thesis
  rationale: z.string(),     // 2-4 sentences grounding the range in NOI/cap/comps
  occupancyNote: z.string(), // the mismatch caveat (empty string if no mismatch)
});
```
- `generateBov` — `createServerFn` + `runGenerator({ model: AI_MODEL_REASONING, system:
  BOV_PROMPT, user: JSON.stringify({ property:{name,address}, valueLow, valueHigh,
  askingPrice, noi, capRate, mismatch }), schema: BovSpec, fallback: () => bovFallback(...) })`.
  Registered in `schemaCompat.test.ts`.
- **Prompt:** a broker's opinion of value — justify the given value RANGE (do not invent new
  numbers) from NOI/cap/asset/submarket; if a mismatch is present, `occupancyNote` explains
  the stated-vs-actual gap and its value impact; else `occupancyNote` is empty. CRE-native,
  concise.
- **Fallback** (`bovFallback(valueLow, valueHigh, mismatch)`): deterministic headline +
  rationale referencing the range + an occupancy note when `isMismatch`.

## 6. Flow — arm → watch → draft → send (§4 of the design)

1. **Arm:** `startUnderwriting(dealId)` (heroInbound.ts, 4B) also calls
   `useBovDraft.getState().armFor(dealId)`.
2. **`BovWatcher`** (AppShell, gated on `hydrated`): subscribes to the armed deal's
   `underwriting` via `useDataStore`. When `armedDealId` is set and that listing's
   `underwriting.status` is `"generated"`/`"ready"` with a `result`, and no draft is set yet,
   it: computes `computeOccupancyMismatch(property)` + `bovValueRange(result, mismatch)`,
   calls `generateBov(...)`, `setDraft({ dealId, valueLow, valueHigh, mismatch, spec })`, and
   opens the sidebar (`useAssistant.getState().setOpen(true)`). Guards so it drafts once.
3. **`BovCard`** (sidebar, reads `useBovDraft.draft`): value range (`$low–$high`),
   the `occupancyNote` (⚠️ styling when mismatch), the `rationale`, and **Send BOV** /
   **Not now**. Otto **speaks** `bovSummaryText(draft)` once (one-way, no mic re-arm).
4. **Send:** `addDealDocument(dealId, { id, name: "{property} — BOV.pdf", uploadedAt, size,
   aiGenerated: true })` + `addDealActivity(dealId, { type: "bov", note: "Sent BOV to
   {ownerFirst} — $low–$high", actor: CURRENT_USER.name })`; `clear()` the draft. **Not now**
   → `clear()`.

## 7. `addDealActivity` (new store action)

```ts
export function addDealActivity(
  listingId: string,
  activity: { type: string; note: string; actor: string },
): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId);
  if (!existing) return undefined;
  const full: DealActivity = {
    id: crypto.randomUUID(),
    type: activity.type, note: activity.note, actor: activity.actor,
    timestamp: new Date().toISOString(),
  };
  return patchListing(listingId, { activities: [...existing.activities, full] });
}
```
Renders via the existing `buildFeed` on the Activities tab.

## 8. Degradation / testing / gates

- **Keyless:** mismatch, value range, arming, filing, and `addDealActivity` are deterministic;
  `generateBov` falls back. **Voice off:** card + Alert still work, unspoken. **Non-hero:** no
  `armFor` → no BOV; the Alert only appears on a genuine occupancy gap.
- **Vitest:** `computeOccupancyMismatch` (gap→isMismatch; equal records→false; no records→
  actual=stated); `bovValueRange` (occupancy-adjusted, deterministic, 10k-rounded; missing-
  metric fallback); `BovSpec`+`bovFallback`+schemaCompat; `addDealActivity` (appends + shows
  in `buildFeed`); seed guard (Palmetto Court stated≈94, T-12 actual≈78, 48 units,
  underwriting-eligible); `useBovDraft` arm/set/clear; the BovWatcher's pure draft-builder.
  BovCard / BovWatcher / the Alert UI → manual smoke.
- **Gates:** `bun --bun run test` green AND `bun --bun x tsc --noEmit` 0 errors. `import z`
  default; new schema in schemaCompat. FontAwesome pro-regular (duotone for the Alert),
  never fixedWidth; Blueprint + Bootstrap; no unsolicited redesigns; one-way spoken summary.

## 9. Acceptance criteria (4C slice)

- [ ] Palmetto Court seeds as a 48-unit multifamily with stated ≈94% vs T-12 actual ≈78%.
- [ ] After the hero underwrite completes, Otto surfaces a BOV card (grounded value range +
      occupancy caveat + rationale) and speaks a one-line summary (no mic re-arm).
- [ ] The deal's underwriting review shows a duotone occupancy-mismatch Alert (only when a
      real gap exists).
- [ ] Send files a BOV document and adds a first-class Activity entry visible on the deal's
      Activity feed; "Not now" dismisses.
- [ ] A non-hero underwrite (deal-page Generate) produces NO BOV.
- [ ] Everything runs key-less. `bun --bun run test` green; `bun --bun x tsc --noEmit` 0.

## 10. Downstream

- **4D — the director:** sequences 4A→4B→4C with deterministic timing + reset/replay, driving
  `heroInbound.arm/cancel`, `useBovDraft`, and the 4A/4B seams; a reset clears
  `heroActions`/`useInboundEmail`/`useBovDraft` and any created hero records for a clean replay.
