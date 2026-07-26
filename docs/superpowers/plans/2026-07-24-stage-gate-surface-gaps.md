# Stage Gate — Surface Only the Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stage-gate modal shows only the required fields the deal hasn't already satisfied, and moves the deal with no modal at all when nothing is missing.

**Architecture:** One predicate — "is this required field already satisfied by the deal?" — drives both the request layer (skip the modal entirely when there are no gaps) and the modal render (show only the unsatisfied fields). The `websiteReviewed` attestation is removed entirely, since it has no stored deal state and could never self-satisfy.

**Tech Stack:** React 19 · TypeScript · Zustand · Vitest · Blueprint React

## Global Constraints

- Package manager is Bun. Run commands with `bun --bun run …`.
- Type-check with `bunx tsc --noEmit` — `vite build` does NOT type-check.
- Do NOT use Playwright. Run unit tests + tsc; ask the user for manual UI verification.
- Stay strictly inside the project folder `/Users/joellopez/Dev/projects/buildout/prototypes/suite-prototype`.
- Default FontAwesome weight is `pro-regular`; never pass `fixedWidth`.
- Blueprint `Field.*` subparts require a `Field.Root`; use `form-text` for detached helper text.

---

### Task 1: `stageGates.ts` — drop `websiteReviewed`, add `unsatisfiedRequired` + `completeSetupGate`

Remove the website attestation from the gate model, and add the two shared helpers the request layer and modal will consume.

**Files:**
- Modify: `src/data/stageGates.ts`
- Test: `src/data/stageGates.test.ts`

**Interfaces:**
- Consumes: existing `GateConfig`, `GateFormState`, `RequiredField`, `resolveGate`, `fieldSatisfied` (module-private), `Listing` type.
- Produces:
  - `unsatisfiedRequired(config: GateConfig, form: GateFormState): RequiredField[]` — the required fields NOT satisfied by `form`.
  - `completeSetupGate(deal: Listing): GateConfig` — the Approve & Publish gate config, but pinned to the deal's current stage (publishes in place, no stage change).
  - `RequiredField` union no longer includes `'websiteReviewed'`; `GateFormState` no longer has a `websiteReviewed` key.

- [ ] **Step 1: Update the existing `resolveGate` test to stop requiring `websiteReviewed`, and delete the website-attestation `canConfirm` test**

In `src/data/stageGates.test.ts`, edit the `Pitching → Active` assertion (remove `'websiteReviewed'` from the `arrayContaining` list and add a negative assertion):

```ts
  it('Pitching → Active is a publishing field gate — listing content + doc review + dates', () => {
    const g = resolveGate('proposal', 'active', 'Sale')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(true)
    expect(g.required).toEqual(
      expect.arrayContaining([
        'saleTitle',
        'saleDescription',
        'askingPrice',
        'aiDocsReviewed',
        'listedOnDate',
        'listingExpirationDate',
      ]),
    )
    // Website review is no longer a gate blocker.
    expect(g.required).not.toContain('websiteReviewed')
    // Seller/Side are captured at creation — the gate must NOT re-require them.
    expect(g.required).not.toContain('sellerLinked')
    expect(g.required).not.toContain('dealSide')
  })
```

Delete this whole test block (lines ~150–153):

```ts
  it('the website attestation blocks the publish gate when unchecked', () => {
    const g = resolveGate('proposal', 'active', 'Sale')
    expect(canConfirm(g, { ...readyToPublish, websiteReviewed: false })).toBe(false)
  })
```

Remove the `websiteReviewed: false,` line from the `emptyForm` fixture and the `websiteReviewed: true,` line from the `readyToPublish` fixture.

- [ ] **Step 2: Add tests for `unsatisfiedRequired` and `completeSetupGate`**

Append to `src/data/stageGates.test.ts` (add `unsatisfiedRequired` and `completeSetupGate` to the import from `./stageGates`, and import the store for a real deal):

```ts
import { useDataStore } from '#/data/dataStore'
import { seedGateForm } from './stageGates'

describe('unsatisfiedRequired', () => {
  it('returns every required field for an empty form', () => {
    const g = resolveGate('proposal', 'active', 'Sale')
    expect(unsatisfiedRequired(g, emptyForm).sort()).toEqual([...g.required].sort())
  })

  it('returns [] when the form satisfies every requirement', () => {
    const g = resolveGate('proposal', 'active', 'Sale')
    expect(unsatisfiedRequired(g, readyToPublish)).toEqual([])
  })

  it('returns only the still-missing field', () => {
    const g = resolveGate('proposal', 'active', 'Sale')
    expect(unsatisfiedRequired(g, { ...readyToPublish, listingExpirationDate: null })).toEqual([
      'listingExpirationDate',
    ])
  })
})

describe('completeSetupGate', () => {
  it('reuses the publish requirements but keeps the deal in its current stage', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const config = completeSetupGate(deal)
    expect(config.publishes).toBe(true)
    expect(config.targetStage).toBe(deal.status)
    expect(config.fromStage).toBe(deal.status)
    expect(config.leavesActive).toBe(false)
    expect(config.required).toEqual(resolveGate('proposal', 'active', deal.dealType).required)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun --bun run test src/data/stageGates.test.ts`
Expected: FAIL — `unsatisfiedRequired` / `completeSetupGate` are not exported, and the `resolveGate` test still sees `websiteReviewed` in `required`.

- [ ] **Step 4: Remove `websiteReviewed` from the gate model in `src/data/stageGates.ts`**

In the `RequiredField` union, delete the `| 'websiteReviewed'` member.

In `REQUIRED_FIELD_LABEL`, delete the `websiteReviewed: 'Website review',` entry.

In `GateFormState`, delete the `websiteReviewed: boolean` field and its doc comment (`/** Broker attestation that the public listing website has been reviewed. */`).

In `EMPTY_GATE_FORM`, delete the `websiteReviewed: false,` line.

In `seedGateForm`, delete the `websiteReviewed: false,` line from the returned object.

In `fieldSatisfied`, delete the `case 'websiteReviewed': return form.websiteReviewed` branch.

In `resolveGate`, in the `case 'active':` block, remove `'websiteReviewed',` from the `required` array so it reads:

```ts
        required: [
          'saleTitle',
          'saleDescription',
          // Sale gates on asking price; lease gates on rate + available SF.
          ...(isLease
            ? (['leaseRate', 'availableSqFt'] as const)
            : (['askingPrice'] as const)),
          'aiDocsReviewed',
          'listedOnDate',
          'listingExpirationDate',
        ],
```

- [ ] **Step 5: Add `unsatisfiedRequired` and `completeSetupGate` to `src/data/stageGates.ts`**

Add `unsatisfiedRequired` immediately after the `canConfirm` function:

```ts
/** The required fields a form has NOT yet satisfied — the gaps the gate must surface. */
export function unsatisfiedRequired(
  config: GateConfig,
  form: GateFormState,
): RequiredField[] {
  return config.required.filter((f) => !fieldSatisfied(f, form))
}
```

Add `completeSetupGate` immediately after `resolveGate`:

```ts
/**
 * The Approve & Publish gate for a deal created directly in a live stage: same
 * required fields as the publish gate, but pinned to the deal's current stage so
 * it publishes in place without changing the stage.
 */
export function completeSetupGate(deal: Listing): GateConfig {
  const publishGate = resolveGate('proposal', 'active', deal.dealType)
  return {
    ...publishGate,
    fromStage: deal.status,
    targetStage: deal.status,
    leavesActive: false,
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --bun run test src/data/stageGates.test.ts`
Expected: PASS (all cases).

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`
Expected: errors ONLY at `src/components/deals/StageGate.tsx` (it still references `websiteReviewed`). Those are fixed in Task 3. No errors in `stageGates.ts` or `stageGates.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/data/stageGates.ts src/data/stageGates.test.ts
git commit -m "feat(stage-gate): drop websiteReviewed; add unsatisfiedRequired + completeSetupGate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Note: `tsc` still fails after this commit because Task 3 hasn't landed. That's expected — the two tasks form one logical change; the tree is green again after Task 3.

---

### Task 2: `useStageGate.ts` — auto-commit when there are no gaps

Move the deal without a modal when a forward gate has no unsatisfied fields, or when it's a pure backward confirm. Otherwise open the gate as before.

**Files:**
- Modify: `src/components/deals/useStageGate.ts`
- Test: `src/components/deals/useStageGate.test.ts`

**Interfaces:**
- Consumes: `resolveGate`, `seedGateForm`, `unsatisfiedRequired`, `buildTransitionInput`, `completeSetupGate` (Task 1), `commitStageTransition`, `getListing`.
- Produces: unchanged public signatures — `requestStageChange(dealId, targetStage)` and `requestSetupCompletion(dealId)` — but they now commit directly (no modal) when there are no gaps.

- [ ] **Step 1: Write the failing tests**

Replace the first test in `src/components/deals/useStageGate.test.ts` (the "opens the gate for a sell-side deal without committing" case) and add the auto-commit cases. Replace the file's body below the imports with this — and extend the imports:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { useStageGate, requestStageChange } from "./useStageGate";
import type { DealSide, Listing } from "#/data/types";

function findDeal(side: DealSide) {
  const deal = [...useDataStore.getState().listings.values()].find(
    (l) => l.dealSide === side,
  );
  if (!deal) throw new Error(`no seeded ${side}-side deal`);
  return deal;
}

/** Put a mutated copy of a deal into the store so a test controls its exact state. */
function putDeal(deal: Listing) {
  useDataStore.setState((s) => {
    const listings = new Map(s.listings);
    listings.set(deal.id, deal);
    return { listings } as never;
  });
}

/** A deterministic sell-side Sale deal parked in Under Contract. */
function sellSideUnderContract(closeDate: string | null): Listing {
  const base = [...useDataStore.getState().listings.values()][0];
  const deal: Listing = {
    ...base,
    dealSide: "seller",
    dealType: "Sale",
    status: "under-contract",
    transaction: { ...base.transaction, closeDate },
  };
  putDeal(deal);
  return deal;
}

describe("requestStageChange", () => {
  beforeEach(() => useStageGate.getState().close());

  it("opens the gate when a forward move has a missing required field", () => {
    // Under Contract → Closed requires closeDate; leave it blank to force a gap.
    const deal = sellSideUnderContract(null);
    requestStageChange(deal.id, "closed");

    const gate = useStageGate.getState();
    expect(gate.open).toBe(true);
    expect(gate.dealId).toBe(deal.id);
    expect(gate.targetStage).toBe("closed");
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe(
      "under-contract",
    );
  });

  it("commits a forward move with no gaps without opening the gate", () => {
    const deal = sellSideUnderContract("2026-08-01");
    requestStageChange(deal.id, "closed");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("closed");
  });

  it("swaps a pure backward move directly, no gate", () => {
    const deal = sellSideUnderContract(null);
    requestStageChange(deal.id, "active");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("active");
  });

  it("keeps the gate for a backward move OUT of Active (unpublish choice)", () => {
    const base = [...useDataStore.getState().listings.values()][0];
    const deal: Listing = {
      ...base,
      dealSide: "seller",
      dealType: "Sale",
      status: "active",
    };
    putDeal(deal);
    requestStageChange(deal.id, "proposal");

    expect(useStageGate.getState().open).toBe(true);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("active");
  });

  it("commits directly for a buy-side deal without opening the gate", () => {
    const deal = findDeal("buyer");
    const target = deal.status === "active" ? "under-contract" : "active";
    requestStageChange(deal.id, target);

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe(target);
  });

  it("is a no-op when the target equals the current stage", () => {
    const deal = findDeal("seller");
    requestStageChange(deal.id, deal.status);
    expect(useStageGate.getState().open).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test src/components/deals/useStageGate.test.ts`
Expected: FAIL — the "commits a forward move with no gaps" and "swaps a pure backward move" cases still open the gate instead of committing.

- [ ] **Step 3: Implement the auto-commit logic**

Rewrite `requestStageChange` and `requestSetupCompletion` in `src/components/deals/useStageGate.ts`. First extend the imports at the top of the file:

```ts
import { getListing } from "#/data/store";
import { commitStageTransition } from "#/data/actions";
import {
  resolveGate,
  seedGateForm,
  unsatisfiedRequired,
  buildTransitionInput,
  completeSetupGate,
} from "#/data/stageGates";
```

Then replace the two functions:

```ts
export function requestStageChange(
  dealId: string,
  targetStage: PropertyStatus,
): void {
  const deal = getListing(dealId);
  if (!deal || deal.status === targetStage) return;
  const actor = deal.internalBrokers[0]?.name ?? "You";

  // A buy-side deal is not a listing — it moves stages directly, no gate.
  if (deal.dealSide === "buyer") {
    commitStageTransition({ dealId, targetStage, actor });
    return;
  }

  const config = resolveGate(deal.status, targetStage, deal.dealType);

  // Pure backward confirm (not leaving Active) — nothing to decide, swap directly.
  if (config.kind === "confirm" && !config.leavesActive) {
    commitStageTransition({ dealId, targetStage, actor });
    return;
  }

  // Forward field gate whose requirements the deal already satisfies — no modal.
  if (config.kind === "field") {
    const form = seedGateForm(deal);
    if (unsatisfiedRequired(config, form).length === 0) {
      commitStageTransition(
        buildTransitionInput(config, form, deal.id, actor, deal.dealType),
      );
      return;
    }
  }

  // Otherwise surface the gate: forward gaps, the dead gate, or backward-out-of-Active.
  useStageGate.getState().openGate(dealId, targetStage);
}

/**
 * Open the Approve & Publish gate to finish setup on a deal that was created
 * directly in a live stage (Active/Under Contract) and never published. When the
 * deal already satisfies every publish requirement, it's published in place with
 * no modal.
 */
export function requestSetupCompletion(dealId: string): void {
  const deal = getListing(dealId);
  if (!deal) return;
  const config = completeSetupGate(deal);
  const form = seedGateForm(deal);
  if (unsatisfiedRequired(config, form).length === 0) {
    commitStageTransition(
      buildTransitionInput(
        config,
        form,
        deal.id,
        deal.internalBrokers[0]?.name ?? "You",
        deal.dealType,
      ),
    );
    return;
  }
  useStageGate.getState().openGate(dealId, deal.status, "complete");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test src/components/deals/useStageGate.test.ts`
Expected: PASS (all six cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/useStageGate.ts src/components/deals/useStageGate.test.ts
git commit -m "feat(stage-gate): swap deals directly when the gate has no gaps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `StageGate.tsx` — render only the unsatisfied fields

Show only the required fields the deal hasn't satisfied, remove the website checkbox, and use `completeSetupGate`.

**Files:**
- Modify: `src/components/deals/StageGate.tsx`

**Interfaces:**
- Consumes: `unsatisfiedRequired`, `completeSetupGate`, `seedGateForm`, `resolveGate` (Task 1); `canConfirm`, `buildTransitionInput` unchanged.
- Produces: no exported-signature change — `StageGate` still takes the same props.

- [ ] **Step 1: Use `completeSetupGate` in the config memo**

In `src/components/deals/StageGate.tsx`, extend the import from `#/data/stageGates` to include `unsatisfiedRequired` and `completeSetupGate`, and remove `signedListingAgreementDoc` only if unused (it is still used — keep it):

```ts
import {
  resolveGate,
  canConfirm,
  buildTransitionInput,
  seedGateForm,
  signedListingAgreementDoc,
  unsatisfiedRequired,
  completeSetupGate,
  EMPTY_GATE_FORM,
  type GateFormState,
} from "#/data/stageGates";
```

Replace the inline `completeSetup` config construction in the `config` `useMemo` (the block that builds `publishGate` and spreads it) with:

```ts
  const config = useMemo(() => {
    if (!deal) return null;
    if (completeSetup) return completeSetupGate(deal);
    return resolveGate(deal.status, targetStage, deal.dealType);
  }, [deal, targetStage, completeSetup]);
```

- [ ] **Step 2: Compute the visible (unsatisfied) field set and a `show` predicate**

Right after the `initialForm` `useMemo`, add a memo of the fields to surface — derived from the INITIAL seeded form so a field doesn't disappear mid-typing:

```ts
  // Surface only the required fields the deal hasn't already satisfied. Derived
  // from the initial seeded form so a field stays visible while the user fills it.
  const visibleFields = useMemo(
    () => new Set(config ? unsatisfiedRequired(config, initialForm) : []),
    [config, initialForm],
  );
```

Then, after the existing `const req = (f: string) => …` line, add:

```ts
  const show = (f: string) => visibleFields.has(f as never);
```

- [ ] **Step 3: Gate the publish-content fields on `show(...)` instead of `config.publishes`**

In the publish block, keep the read-only summary header under `config.publishes`, but guard each editable content field on `show(...)`:

- Wrap the **Listing title** `<Field>` in `{show("saleTitle") && ( … )}`.
- Wrap the **Listing description** `<Field>` in `{show("saleDescription") && ( … )}`.
- For the sale/lease price branch, change the outer `deal.dealType === "Sale" ? (…) : (…)` so the **Sale** asking-price field is guarded by `{show("askingPrice") && ( … )}`, and the **Lease** rate/units/available-SF block is guarded by `{(show("leaseRate") || show("availableSqFt")) && ( … )}`. (Both rate and available SF live in one visual block; show it if either is a gap.)
- Change the AI-docs review block guard from `{config.publishes && aiDocs.length > 0 && ( … )}` to `{show("aiDocsReviewed") && aiDocs.length > 0 && ( … )}`.

Concretely, the price branch becomes:

```tsx
              {show("askingPrice") && deal.dealType === "Sale" && (
                <Field>
                  <Field.Label>Asking price</Field.Label>
                  <CurrencyInput
                    value={form.askingPrice}
                    onChange={(v) => set("askingPrice", v)}
                  />
                  <Field.Description>
                    Editing here updates the listing.{" "}
                    <a
                      href={`/listings/${deal.id}/edit`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open full marketing editor{" "}
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    </a>
                  </Field.Description>
                </Field>
              )}

              {(show("leaseRate") || show("availableSqFt")) &&
                deal.dealType !== "Sale" && (
                  <>
                    <div className="d-flex gap-2">
                      <Field className="flex-grow-1">
                        <Field.Label>Lease rate</Field.Label>
                        <CurrencyInput
                          value={form.leaseRate}
                          onChange={(v) => set("leaseRate", v)}
                        />
                      </Field>
                      <Field style={{ width: 140 }}>
                        <Field.Label>Units</Field.Label>
                        <Select
                          items={LEASE_RATE_UNIT_OPTIONS}
                          value={form.leaseRateUnits}
                          onValueChange={(v) =>
                            set("leaseRateUnits", v as typeof form.leaseRateUnits)
                          }
                        >
                          <Select.Trigger>
                            <Select.Value />
                          </Select.Trigger>
                          <Select.Content>
                            {LEASE_RATE_UNIT_OPTIONS.map((o) => (
                              <Select.Item key={o.value} value={o.value}>
                                {o.label}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select>
                      </Field>
                    </div>
                    <Field>
                      <Field.Label>Available SF</Field.Label>
                      <Input
                        type="number"
                        value={form.availableSqFt ?? ""}
                        onChange={(e) =>
                          set(
                            "availableSqFt",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        placeholder="e.g. 2400"
                      />
                    </Field>
                  </>
                )}
```

> The outer `{config.publishes && ( … )}` wrapper around the title/description/price group stays as-is — it's what scopes these fields to the publish gate. The `show(...)` guards nest inside it. The read-only "You're publishing this listing" summary and its own `{config.publishes && ( … )}` wrapper are unchanged.

- [ ] **Step 4: Remove the website-reviewed checkbox**

Delete the entire website-attestation `<Field>` block (the one containing the `form.websiteReviewed` checkbox and the "Open website" link, previously guarded by `{config.publishes && ( … )}`). It is gone from the gate.

- [ ] **Step 5: Swap the remaining `req(...)` guards to `show(...)`**

Change each of these field guards from `req("…")` to `show("…")` so a field the deal already carries collapses away:

- `{req("buyerLinked") && ( … )}` → `{show("buyerLinked") && ( … )}`
- `{req("tenantLinked") && ( … )}` → `{show("tenantLinked") && ( … )}`
- `{req("listedOnDate") && ( … )}` → `{show("listedOnDate") && ( … )}`
- `{req("listingExpirationDate") && ( … )}` → `{show("listingExpirationDate") && ( … )}`
- `{req("salePrice") && ( … )}` → `{show("salePrice") && ( … )}`
- both `{req("commissionAmount") && ( … )}` blocks → `{show("commissionAmount") && ( … )}`
- `{req("leaseTermMonths") && ( … )}` → `{show("leaseTermMonths") && ( … )}`
- `{req("leaseCommencementDate") && ( … )}` → `{show("leaseCommencementDate") && ( … )}`
- `{req("closeDate") && ( … )}` → `{show("closeDate") && ( … )}`
- `{req("deadReason") && ( … )}` → `{show("deadReason") && ( … )}`

And the AI-dates-from-agreement note guard:

```tsx
              {aiDatesFromAgreement &&
                (show("listedOnDate") || show("listingExpirationDate")) && (
```

Then delete the now-unused `const req = …` line.

- [ ] **Step 6: Type-check the whole project**

Run: `bunx tsc --noEmit`
Expected: PASS with no errors (the `websiteReviewed` references are gone; `req` is removed).

- [ ] **Step 7: Run the full test suite**

Run: `bun --bun run test`
Expected: PASS. Pre-existing non-gating stderr lines (a biome / react-module Vitest line) may appear — those are not failures.

- [ ] **Step 8: Production build sanity check**

Run: `bun --bun run build`
Expected: build completes, writes `dist/`.

- [ ] **Step 9: Commit**

```bash
git add src/components/deals/StageGate.tsx
git commit -m "feat(stage-gate): render only unsatisfied fields; remove website checkbox

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 10: Ask the user to manually verify the UI**

The app can't be Playwright-tested here. Ask the user to check, on the Deals board:
1. Drag a fully-populated deal forward across a gate → it swaps stages with no modal.
2. Drag a deal that's missing one field (e.g. no close date) → the gate opens showing ONLY that field.
3. Open the Approve & Publish gate on a thin deal → title/description/price/dates appear as needed; NO "Listing website reviewed" checkbox.
4. Drag a deal backward out of Active → the confirm modal with the "also unpublish" checkbox still appears.

---

## Self-Review

**Spec coverage:**
- "Render only unsatisfied fields" → Task 3 (`show` predicate, Steps 3 & 5). ✓
- "Skip modal when no gaps" (forward field gate) → Task 2, Step 3. ✓
- "Pure backward confirm swaps directly; backward-out-of-Active keeps modal" → Task 2, Step 3 + tests. ✓
- "Drop `websiteReviewed`; remove its checkbox" → Task 1 (model) + Task 3 Step 4 (UI). ✓
- "`aiDocsReviewed` stays, self-satisfies when no docs" → unchanged in model; Task 3 Step 3 guards on `show("aiDocsReviewed")`. ✓
- "`requestSetupCompletion` runs the same emptiness check" → Task 2, Step 3. ✓
- "Mark as Lost unchanged (deadReason never pre-filled)" → Task 3 Step 5 uses `show("deadReason")`, which is always visible since deadReason can't be satisfied at seed. ✓
- "Hidden set from initial seeded form (no vanish mid-typing)" → Task 3, Step 2. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `unsatisfiedRequired(config, form)` and `completeSetupGate(deal)` signatures match between Task 1 (definition) and Tasks 2–3 (consumption). `show(f: string)` casts to `never` to match the existing `req` pattern already in the file. `putDeal`/`sellSideUnderContract` helpers are self-contained in the test. ✓
