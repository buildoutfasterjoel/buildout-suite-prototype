# Unify the Hero Demo onto Rosa Delgado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Rosa Delgado the single flagship hero — the newer sidebar-driven AI arc (signal greeting → live call → recap → self-arriving email → underwrite → BOV → **signed agreement → Activate Listing** → replay) runs on her story and The Delgado Building — and remove Marcus Pinckney entirely.

**Architecture:** Additive, reusing the existing Marcus arc mechanics. Rosa becomes the sole `signal` owner; her owned multifamily "The Delgado Building" becomes the occupancy-gap hero property; the recap creates the deal at `proposal` (not `active`); two new closing beats (signed-agreement arrival + Activate-Listing) are arc-owned, mirroring `heroInbound`/`InboundEmailCard`; arc-complete moves from BOV-send to listing activation. The orphaned contact-page Rosa effects and dead `LogCallModal` are retired.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Zustand · Vitest · Bun.

## Global Constraints

- Package manager is **Bun**: run tests with `bun --bun run test`, typecheck with `bunx tsc --noEmit`. `vite build` does NOT type-check.
- The `module is not defined` line in Vitest stderr is benign React-SSR transform noise — not a failure.
- FontAwesome: default `pro-regular`; **never** pass `fixedWidth` on `FontAwesomeIcon`.
- Only Rosa carries a `signal` after this work; `isHeroCall` (keys on `contact.signal`) therefore identifies Rosa's calls without change.
- The hero property must stay **multifamily** so it passes `propertyQualifiesForUnderwriting` (`src/components/deals/underwriting/eligibility.ts`).
- Commit after each task. Do not push, merge, or open PRs — leave the branch as-is.
- Copy is written in Rosa's register (cautious, grieving widow; her late husband **Miguel**; **The Delgado Building**).

---

## File map

- `src/data/types.ts` — remove `'marcus'` from `HeroKey`.
- `src/data/seed.ts` — delete Marcus fixture; add Rosa `signal`; merge the signal-owner + owned-property coercion so the occupancy gap lands on The Delgado Building.
- `src/data/persistence.ts` — bump `SEED_VERSION`.
- `src/data/signal.ts` — selector keys on Rosa. Delete `src/data/signal 2.ts` (stale dup).
- `src/ai/voice/greeting.ts` — variable rename + Rosa-safe copy (already data-driven via `signalText`).
- `src/components/call/heroRecapExtensions.ts` — create at `proposal`, no auto-activate, Rosa follow-up task + narration.
- `src/components/call/heroInbound.ts` — Rosa copy for the arriving financials email.
- `src/components/call/useBovDraft.ts` — carry `propertyName`; de-hardcode `bovSummaryText`.
- `src/components/call/BovCard.tsx` — on Send, arm the signed-agreement watcher instead of `markArcComplete`.
- `src/components/call/rosaClosing.ts` (**new**) — shared Rosa closing constants + the signed-agreement arrival watcher (mirrors `heroInbound`).
- `src/components/call/ClosingEmailCard.tsx` (**new**) — the "Activate Listing" inbound card; marks arc complete on success.
- `src/components/call/heroDemo.ts` — `arcCompleteText` copy → Rosa/full-close; `resetHeroDemo` cancels the new watcher.
- `src/routes/_shell/backoffice/contacts/$contactId.tsx` + `src/components/contacts/ContactEngagementPanel.tsx` — retire the orphaned Rosa email effects.
- `src/components/contacts/LogCallModal.tsx` — delete (dead).
- `src/data/dataStore.ts` — `resetRosaDemoState` preserves Rosa's `signal`.
- Tests: `src/data/seed.marcus.test.ts` → rename to Rosa; `palmetto`/`signal`/`greeting`/`heroRecap` suites updated; new closing-beat test.

---

## Task 1: Make Rosa the hero owner in seed data

**Files:**
- Modify: `src/data/types.ts` (`HeroKey`)
- Modify: `src/data/seed.ts` (Rosa fixture ~1637; delete Marcus fixture ~1736–1761; coercion ~1825–1887)
- Modify: `src/data/persistence.ts:5` (`SEED_VERSION`)
- Test: rename `src/data/seed.marcus.test.ts` → `src/data/seed.rosaHero.test.ts`

**Interfaces:**
- Produces: after `generateDataset()`, exactly one contact with `heroKey === 'rosa'` that has `role:'owner'`, `signal.kind === 'loan-maturity'`, and a linked **multifamily** property named "The Delgado Building" whose `occupancyPct === 94` while `financialRecords[0].occupancyPct === 78` / `vacancyRate === 0.22`. No contact has `heroKey === 'marcus'`.

- [ ] **Step 1: Write the failing test** — rename the file and rewrite for Rosa.

```ts
// src/data/seed.rosaHero.test.ts
import { describe, it, expect } from "vitest";
import { generateDataset } from "./seed";

describe("Rosa Delgado hero seed", () => {
  const { contacts, properties } = generateDataset();
  const rosa = contacts.find((c) => c.heroKey === "rosa");

  it("seeds Rosa as a signal owner", () => {
    expect(rosa).toBeDefined();
    expect(rosa!.role).toBe("owner");
    expect(rosa!.firstName).toBe("Rosa");
    expect(rosa!.lastName).toBe("Delgado");
    expect(rosa!.signal?.kind).toBe("loan-maturity");
  });

  it("removes Marcus entirely", () => {
    expect(contacts.some((c) => c.heroKey === "marcus")).toBe(false);
    expect(properties.some((p) => p.name === "Palmetto Court")).toBe(false);
  });

  it("makes The Delgado Building the multifamily occupancy-gap hero property", () => {
    const prop = properties.find((p) => p.id === rosa!.propertyIds[0]);
    expect(prop).toBeDefined();
    expect(prop!.name).toBe("The Delgado Building");
    expect(prop!.propertyType).toBe("multifamily");
    expect(prop!.occupancyPct).toBe(94); // stated
    expect(prop!.financialRecords[0]?.occupancyPct).toBe(78); // T-12 actual
    expect(prop!.financialRecords[0]?.vacancyRate).toBeCloseTo(0.22);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `bun --bun run test seed.rosaHero`
Expected: FAIL (Marcus still present / Rosa has no signal / occupancy gap not on her building).

- [ ] **Step 3: Remove `'marcus'` from `HeroKey`**

`src/data/types.ts` — change the union to:

```ts
export type HeroKey = 'rosa' | 'earl' | 'victor' | 'margaret' | 'patricia'
```

- [ ] **Step 4: Delete the Marcus fixture** — remove the entire `{ heroKey: 'marcus', … }` object (~1736–1761) from `HERO_FIXTURES`.

- [ ] **Step 5: Give the Rosa fixture a signal.** In the Rosa fixture object, after the `ownedProperty` block, add:

```ts
    // Miguel's balloon note surfaces overnight — the loan-docs voicemail she left
    // is this signal made concrete (see timelineHeroes.ts rosa()).
    signal: {
      kind: 'loan-maturity',
      headline: "a maturing loan on Rosa Delgado's Delgado Building",
      detail:
        'The Delgado Building carries a balloon note maturing soon — the loan documents Rosa found in Miguel’s papers. Refinancing at today’s rates is tight, which is why she’s finally weighing her options.',
      observedAt: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    },
```

- [ ] **Step 6: Merge the coercion so the occupancy gap lands on the owned building.**

In `applyHeroes`, the owned-property block (`if (h.ownedProperty)`) runs and sets `host.propertyIds = [p.id]`. Change the signal block (`if (h.signal)`) so that, when the host already has an owned property, it applies the 48-unit / occupancy-gap treatment to **that** property instead of selecting a separate listing-property. Replace the property-selection lines at the top of the `if (h.signal)` block:

```ts
    if (h.signal) {
      host.signal = h.signal
      // Prefer the hero's own building (Rosa's Delgado Building) so the signal,
      // opportunity, and underwriting all land on one place. Fall back to the
      // old coerced-listing behavior only if the hero has no owned property.
      let heroProp = properties.find((p) => p.id === host.ownedPropertyIds[0])
      if (!heroProp) {
        const usedPropIds = new Set(
          listings.filter((l) => claimed.has(l.id)).map((l) => l.propertyId),
        )
        heroProp =
          properties.find((p) => p.propertyType === 'multifamily' && !usedPropIds.has(p.id)) ??
          properties.find((p) => !usedPropIds.has(p.id))!
        host.propertyIds = [heroProp.id, ...host.propertyIds.filter((id) => id !== heroProp.id)]
      }
      heroProp.propertyType = 'multifamily'
      heroProp.propertySubtype = 'Mid-Rise'
      if (h.dealName) heroProp.name = h.dealName
      // …unchanged: residentialUnits/buildingSqFt/askingPrice/capRate/occupancyPct
      //   and the financialRecords[0] T-12 gap block stay exactly as-is…
    }
```

> Note: the owned-property block must run **before** the signal block for `host.ownedPropertyIds[0]` to be populated. Verify ordering; if the signal block currently precedes the owned-property block, move the signal block to after it.

- [ ] **Step 7: Bump the seed version** — `src/data/persistence.ts:5`, increment `SEED_VERSION` by 1 (forces a reseed).

- [ ] **Step 8: Run tests**

Run: `bun --bun run test seed.rosaHero` → Expected: PASS.
Run: `bun --bun run test seed` → fix any Palmetto/Marcus assertions in other seed suites (rename to Delgado/Rosa). Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(seed): make Rosa the signal hero on The Delgado Building; remove Marcus"
```

---

## Task 2: Point the overnight-signal selector at Rosa

**Files:**
- Modify: `src/data/signal.ts:14`
- Delete: `src/data/signal 2.ts` (stale duplicate)
- Modify: `src/ai/voice/greeting.ts:39` (variable name only; copy is data-driven)
- Test: `src/data/signal.test.ts` (or the greeting suite) — update the hero key.

**Interfaces:**
- Consumes: seed from Task 1 (Rosa has `signal`).
- Produces: `getOvernightSignalContact()` returns the Rosa contact.

- [ ] **Step 1: Update the failing test** — in the signal/greeting test, change the seeded hero from `marcus` to `rosa` and assert `getOvernightSignalContact()?.firstName === "Rosa"`.

Run: `bun --bun run test signal` → Expected: FAIL (selector still keys on `"marcus"`).

- [ ] **Step 2: Update the selector** — `src/data/signal.ts`:

```ts
    if (c.heroKey === "rosa" && c.signal) return c;
```

- [ ] **Step 3: Delete the stale duplicate**

```bash
git rm "src/data/signal 2.ts"
```

- [ ] **Step 4: Rename the greeting variable** — `src/ai/voice/greeting.ts:39`, rename `const marcus = getOvernightSignalContact()` to `const signalOwner = getOvernightSignalContact()` and update its references in that function. (The greeting text itself comes from `signalText`/the signal fields, so no copy change is needed here.)

- [ ] **Step 5: Run tests**

Run: `bun --bun run test signal greeting` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(signal): overnight-signal owner is Rosa; drop stale signal dup"
```

---

## Task 3: Recap creates the deal at `proposal` (no auto-activate) with a Rosa follow-up task

**Files:**
- Modify: `src/components/call/heroRecapExtensions.ts`
- Test: `src/components/call/heroRecapExtensions.test.ts` (or the existing heroRecap suite)

**Interfaces:**
- Produces: `applyHeroRecapExtensions(...)` returns `HeroActions` with `createdStage: "proposal"` and a `followUpTaskId`; it does **not** move the deal into `active`.

- [ ] **Step 1: Update the test** to assert the recap leaves the deal at `proposal` and schedules a follow-up task:

```ts
it("opens the opportunity at proposal and schedules a follow-up (no auto-activate)", () => {
  // …arrange a hero target with a signal + linked multifamily property…
  const actions = applyHeroRecapExtensions({ target, recap }, { now: new Date("2026-07-24") });
  expect(actions).not.toBeNull();
  const deal = getListing(actions!.dealId);
  expect(deal!.status).toBe("proposal"); // NOT "active"
  expect(actions!.followUpTaskId).toBeTruthy();
});
```

Run: `bun --bun run test heroRecap` → Expected: FAIL (currently commits to `active`).

- [ ] **Step 2: Change `HeroActions` and the implementation.** In `heroRecapExtensions.ts`:
  - Change the interface field `movedToStage: "active"` → `createdStage: "proposal"`, and rename `tourTaskId`/`tourDate` → `followUpTaskId`/`followUpDate`.
  - Remove the `commitStageTransition({... targetStage: "active" ...})` call entirely (the deal stays at `proposal`; `createDeal` already starts there).
  - Replace the tour `createTask` with a BOV-prep follow-up:

```ts
  const followUpDate = parseDueDate("thursday", opts.now) ?? "";
  const { task } = createTask({
    name: `Prep the BOV for ${dealName}`,
    dueDate: followUpDate,
    type: "deal",
    source: "deal",
    contactId: contact.id,
    dealId: deal.id,
  });

  return {
    dealId: deal.id,
    dealName,
    createdStage: "proposal",
    followUpTaskId: task.id,
    followUpDate,
    narration: heroNarration(dealName),
  };
```

  - Update `heroNarration` to drop the pipeline-move/tour language:

```ts
export function heroNarration(dealName: string): string {
  return (
    `I opened a new opportunity on ${dealName} and put a task on your list to prep the BOV.`
  );
}
```

  - Update `undoHeroActions` to `deleteTask(actions.followUpTaskId)` and `updateDealStage(actions.dealId, "inactive")` (unchanged behavior, renamed field).

- [ ] **Step 3: Fix callers.** Grep for `movedToStage`, `tourTaskId`, `tourDate`, `weekdayFromIsoDate`, `heroNarration(` (e.g. `CallRecapCard.tsx`) and update to the new field names / single-arg narration. Remove `weekdayFromIsoDate` if now unused.

Run: `bunx tsc --noEmit` → Expected: clean.

- [ ] **Step 4: Run tests**

Run: `bun --bun run test heroRecap callFlow` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(call): recap opens the deal at proposal with a BOV follow-up, no auto-activate"
```

---

## Task 4: Rosa copy for the arriving financials email

**Files:**
- Modify: `src/components/call/heroInbound.ts`
- Test: `src/components/call/heroInbound.test.ts` if present, else manual.

**Interfaces:**
- Consumes: the deal + Rosa contact from Task 3.
- Produces: the ~10s arrival files a Rent Roll + T-12 onto the deal and sets `useInboundEmail`; `inboundSummaryText` reads naturally for Rosa.

- [ ] **Step 1: Reskin the fallback + summary copy** in `heroInbound.ts` so it reads as Rosa returning Miguel's files. Update `synthesizedOriginal` body and the `catch` fallback body to her register, e.g. the fallback:

```ts
    res = { tone: "interested" as const, body: `Attached are Miguel's full trailing twelve and the current rent roll — see what the building actually does. — ${contact.firstName}` };
```

Keep the attachment names as `${propertyName} — Rent Roll.xlsx` / `${propertyName} — T-12.pdf` (propertyName is "The Delgado Building"). `inboundSummaryText` already reads generically ("rent roll and the T-12") — leave it.

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit` → clean. Run: `bun --bun run test heroInbound` (if a suite exists) → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(call): arriving financials email reads as Rosa returning Miguel's files"
```

---

## Task 5: De-hardcode the BOV summary; stop completing the arc at BOV-send

**Files:**
- Modify: `src/components/call/useBovDraft.ts` (`BovDraft`, `buildBovDraft`, `bovSummaryText`)
- Modify: `src/components/call/BovCard.tsx` (Send handler)
- Test: `src/components/call/useBovDraft.test.ts` if present, else the BOV suite.

**Interfaces:**
- Produces: `BovDraft.propertyName: string`; `bovSummaryText(draft)` names the actual property; `BovCard` Send arms the closing watcher (Task 6) rather than calling `markArcComplete`.

- [ ] **Step 1: Add `propertyName` to `BovDraft`** and set it in `buildBovDraft`:

```ts
export interface BovDraft {
  dealId: string;
  propertyName: string;
  valueLow: number;
  valueHigh: number;
  mismatch: OccupancyMismatch;
  spec: BovSpecT;
}
// …in buildBovDraft return: { dealId, propertyName: property.name, valueLow: low, valueHigh: high, mismatch, spec }
```

- [ ] **Step 2: De-hardcode `bovSummaryText`** — replace `"Palmetto Court"` with `draft.propertyName`:

```ts
  return `I've priced ${draft.propertyName} at ${range} and drafted the BOV.${flag} Want me to send it?`;
```

- [ ] **Step 3: Change the BovCard Send handler.** In `BovCard.tsx`, where Send currently files `… — BOV.pdf`, logs the `bov` activity, and calls `useHeroDemo.getState().markArcComplete()`, replace the `markArcComplete()` call with arming the closing watcher (Task 6):

```ts
    rosaClosing.arm(draft.dealId, /* ownerContactId */ ownerContactId);
```

(Resolve `ownerContactId` from the deal's seller contact — the same contact the arc has been using; read it via the existing deal/store lookup in the file.)

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit` → clean (a missing `rosaClosing` import is expected until Task 6; import it then).

- [ ] **Step 5: Commit** (may be committed together with Task 6 if tsc requires the new module first — acceptable to sequence Task 6 before this step's final tsc).

```bash
git add -A
git commit -m "feat(call): BOV summary names the real property; send arms the closing beat"
```

---

## Task 6: Signed-agreement arrival watcher (new closing beat)

**Files:**
- Create: `src/components/call/useClosingEmail.ts` (tiny Zustand store, defined here so the watcher can set it)
- Create: `src/components/call/rosaClosing.ts`
- Test: `src/components/call/rosaClosing.test.ts`

**Interfaces:**
- Consumes: `dealId`, `ownerContactId` (from Task 5's Send).
- Produces: `useClosingEmail` store (`{ pending: { dealId, from } | null; set; clear }`), consumed by Task 7's card; and `rosaClosing.arm(dealId, ownerContactId)` which schedules (~6s) filing `The Delgado Building — Listing Agreement (Signed).pdf` onto the deal, completing the open listing-agreement task if present, and setting the closing inbound via `useClosingEmail` that exposes an **Activate Listing** action; `rosaClosing.cancel()` drops a pending arrival. Mirrors `heroInbound`'s monotonic-session pattern.

- [ ] **Step 1: Write the failing test** for the deterministic parts (session cancel + doc filing). Model on how `heroInbound` is structured; assert that after `arm` + advancing timers, the deal has the signed-agreement document, and that `cancel()` before the timer prevents it.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { rosaClosing, SIGNED_AGREEMENT_DOC } from "./rosaClosing";
// …arrange a deal + owner contact in the store…

describe("rosaClosing", () => {
  beforeEach(() => vi.useFakeTimers());
  it("files the signed agreement ~6s after arm", async () => {
    rosaClosing.arm(dealId, ownerId);
    await vi.advanceTimersByTimeAsync(6000);
    expect(getListing(dealId)!.documents.some((d) => d.name === SIGNED_AGREEMENT_DOC.name)).toBe(true);
  });
  it("cancel() drops a pending arrival", async () => {
    rosaClosing.arm(dealId, ownerId);
    rosaClosing.cancel();
    await vi.advanceTimersByTimeAsync(6000);
    expect(getListing(dealId)!.documents.some((d) => d.name === SIGNED_AGREEMENT_DOC.name)).toBe(false);
  });
});
```

Run: `bun --bun run test rosaClosing` → Expected: FAIL (module missing).

- [ ] **Step 1b: Create `useClosingEmail.ts`** (mirrors `useInboundEmail`'s shape) so the watcher has somewhere to publish:

```ts
import { create } from "zustand";
interface ClosingEmail { dealId: string; from: string; }
interface S { pending: ClosingEmail | null; set: (e: ClosingEmail) => void; clear: () => void; }
export const useClosingEmail = create<S>((set) => ({ pending: null, set: (pending) => set({ pending }), clear: () => set({ pending: null }) }));
```

- [ ] **Step 2: Implement `rosaClosing.ts`** mirroring `heroInbound.ts` (monotonic `session` + `timer`, `arm`/`cancel`). On arrival: `addDealDocument(dealId, SIGNED_AGREEMENT_DOC)`; complete the open "listing agreement" task for the deal if one exists (reuse the same task action `ContactEngagementPanel` used — grep for the completion call it made ~197–208); `addDealMessage`; `notify({ title: "New email from Rosa Delgado", … })`; then set a closing inbound that the card in Task 7 renders. Export `SIGNED_AGREEMENT_DOC = { name: "The Delgado Building — Listing Agreement (Signed).pdf", size: "0.3 MB" }` and an `ARRIVAL_MS = 6_000`.

```ts
// Skeleton — fill imports from heroInbound.ts's set (addDealDocument, addDealMessage, notify, getContact, useAssistant)
let session = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
export const SIGNED_AGREEMENT_DOC = { name: "The Delgado Building — Listing Agreement (Signed).pdf", size: "0.3 MB" };
const ARRIVAL_MS = 6_000;
async function onArrive(dealId: string, ownerContactId: string, mySession: number) {
  if (mySession !== session) return;
  const contact = getContact(ownerContactId); if (!contact) return;
  const now = new Date().toISOString();
  addDealDocument(dealId, { id: crypto.randomUUID(), ...SIGNED_AGREEMENT_DOC, uploadedAt: now, aiGenerated: false });
  // complete the open listing-agreement task for this deal, if any (reuse existing action)
  addDealMessage(dealId, { author: contactFullName(contact), text: "Signed listing agreement attached." });
  notify({ title: "New email from Rosa Delgado", description: "Signed listing agreement attached" });
  useClosingEmail.getState().set({ dealId, from: contactFullName(contact) }); // store from Task 7
  useAssistant.getState().setOpen(true);
}
export const rosaClosing = {
  arm(dealId: string, ownerContactId: string) { if (timer) clearTimeout(timer); session += 1; const s = session; timer = setTimeout(() => void onArrive(dealId, ownerContactId, s), ARRIVAL_MS); },
  cancel() { if (timer) clearTimeout(timer); timer = null; session += 1; },
};
```

- [ ] **Step 3: Run tests** → `bun --bun run test rosaClosing` → PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(call): Rosa returns the signed listing agreement (closing-beat watcher)"
```

---

## Task 7: Activate-Listing card + arc completes on activation

**Files:**
- Create: `src/components/call/ClosingEmailCard.tsx`
- Modify: `src/components/call/heroDemo.ts` (`arcCompleteText`; `resetHeroDemo` cancels `rosaClosing` + clears `useClosingEmail`)
- Modify: `src/components/ai/AssistantSidebar.tsx` (render `ClosingEmailCard` where the arc's inbound/BOV cards render)
- Test: manual (React wiring) + `heroDemo` copy test if a suite exists.

**Interfaces:**
- Consumes: `useClosingEmail.pending` (store created in Task 6).
- Produces: an "Activate Listing" button → `requestStageChange(dealId, "active")`; a store/effect that, once the deal actually reaches `active`, calls `useHeroDemo.getState().markArcComplete()` and clears the closing email.

- [ ] **Step 1: Create `ClosingEmailCard.tsx`** — model on `InboundEmailCard.tsx`. Render the from/subject/attachment and an **Activate Listing** button:

```tsx
import { requestStageChange } from "#/components/deals/useStageGate";
import { useClosingEmail } from "./useClosingEmail";
// on click:
//   requestStageChange(pending.dealId, "active");
// Completion is detected by the effect in Step 3 (guards against a cancelled gate).
```

Use `faFileSignature` (pro-regular) for the attachment; no `fixedWidth`.

- [ ] **Step 2: Complete the arc on activation.** In `ClosingEmailCard` (or a small watcher), subscribe to the deal's stage; when `getListing(pending.dealId)?.status === "active"`, call `useHeroDemo.getState().markArcComplete()` and `useClosingEmail.getState().clear()`. (Mirror the guarded deals-watching effect `ContactEngagementPanel.tsx:235–243` used for the same beat.)

- [ ] **Step 3: Update `heroDemo.ts` copy + reset.**

```ts
export function arcCompleteText(): string {
  return (
    "That's the full loop — from Rosa's overnight voicemail to a signed listing agreement and " +
    "an active listing, all captured on one record. Want me to run it again?"
  );
}
```

In `resetHeroDemo`, add `rosaClosing.cancel();` and `useClosingEmail.getState().clear();` alongside `heroInbound.cancel()`.

- [ ] **Step 4: Render the card.** In `AssistantSidebar.tsx`, where `InboundEmailCard`/`BovCard` are rendered from their stores, add a `useClosingEmail((s) => s.pending)` read and render `<ClosingEmailCard />` when pending. Speak an Otto one-liner on arrival if the arc narrates other beats (match the existing pattern; optional).

- [ ] **Step 5: Verify**

Run: `bunx tsc --noEmit` → clean. Run: `bun --bun run test heroDemo` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(call): Activate Listing closes the arc; loop-close copy to Rosa"
```

---

## Task 8: Retire the orphaned contact-page Rosa effects and dead code

**Files:**
- Modify: `src/components/contacts/ContactEngagementPanel.tsx` (remove the financials-email effect ~124–156 and the signed-agreement effect ~180–230, and the `ROSA_*` email/flag constants they used; keep deal-card / BOV-flow rendering)
- Modify: `src/routes/_shell/backoffice/contacts/$contactId.tsx` (leave call wiring to `callFlow.open`; remove any now-unused `onStartCall` plumbing tied to the retired effects)
- Delete: `src/components/contacts/LogCallModal.tsx`
- Modify: `src/data/dataStore.ts` (`resetRosaDemoState` preserves `signal`)
- Test: `bun --bun run test` (full)

**Interfaces:** none new. This removes duplication so each beat fires once (from the arc).

- [ ] **Step 1: Remove the two Rosa email effects** in `ContactEngagementPanel.tsx` (the `logged[0].kind==="call"`-gated financials effect and the `_BOV.pdf`-gated signed-agreement effect) and the constants/flags only they used (`ROSA_FINANCIALS_EMAIL_ID`, `ROSA_AGREEMENT_EMAIL_ID`, `ROSA_CALLBACK_ARMED_FLAG`, `ROSA_FINANCIAL_DOCS`/`ROSA_SIGNED_AGREEMENT` if not moved). If the `Start a Deal` / `Activate Listing` `handleAction` branches are now unreachable from the arc-driven flow, remove them too. Keep the deal card, the AI-deal progress rendering, and the BOV flow entry that still make sense on the page.

> If any removed constant (e.g. `ROSA_SIGNED_AGREEMENT` content) is still wanted, it should already live in `rosaClosing.ts` (Task 6) — import from there rather than keep a copy.

- [ ] **Step 2: Delete dead `LogCallModal`**

```bash
git rm src/components/contacts/LogCallModal.tsx
```

Grep for any import of it and remove.

- [ ] **Step 3: Preserve Rosa's signal on hard-refresh reset.** In `dataStore.ts` `resetRosaDemoState`, ensure the restored Rosa contact keeps `signal` (and that her owned building keeps the occupancy gap). If the reset rebuilds her contact from a snapshot that predates the signal, add `signal` back explicitly.

- [ ] **Step 4: Full verify**

Run: `bunx tsc --noEmit` → clean.
Run: `bun --bun run test` → all green (fix any lingering Marcus/Palmetto/`LogCallModal` references surfaced by the suite).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(contacts): retire orphaned Rosa contact-page effects; delete dead LogCallModal"
```

---

## Task 9: End-to-end verification pass

**Files:** none (verification only).

- [ ] **Step 1: Typecheck** — `bunx tsc --noEmit` → clean.
- [ ] **Step 2: Full test suite** — `bun --bun run test` → all green; note the benign `module is not defined` stderr line.
- [ ] **Step 3: Grep for stragglers** — `git grep -in "marcus\|palmetto" -- src` returns only intended/none; `git grep -n "LogCallModal" -- src` returns nothing.
- [ ] **Step 4: Manual smoke (ask the user to run the app).** Open the assistant → greeting names Rosa's loan-docs voicemail → "Yes" → live call → hang up → recap opens the deal at proposal + BOV task → financials email (2 files) arrives → Underwrite → BOV → Send → signed listing agreement arrives → Activate Listing → arc-complete line → "Run it again" resets cleanly.
- [ ] **Step 5: Final commit if any fixups were needed.**

```bash
git add -A
git commit -m "chore: final verification fixups for the Rosa hero unification"
```
