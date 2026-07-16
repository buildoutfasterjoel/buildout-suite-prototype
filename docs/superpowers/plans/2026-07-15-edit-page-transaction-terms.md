# Deal Edit Page — Transaction Terms Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Transaction Terms" section to the deal edit page surfacing the six transaction fields the gate/dialog collect but the editor omits, with Sale Price / % / $ as a bi-directional trio.

**Architecture:** Pure UI wiring inside `DealMarketingEditor.tsx`. The editor already holds the full `transaction` in working-copy state and commits it via `updateDeal` on Save — this task only adds a section of inputs bound to that state, plus three commission handlers reusing `src/data/commission.ts`. No data-layer change.

**Tech Stack:** React 19 · TypeScript · Blueprint React · Vitest.

## Global Constraints

- Package manager is Bun; run everything with `bun --bun run`. `bun --bun run test` runs the full suite once (`vitest run`).
- UI uses Blueprint React components + Bootstrap 5 utility classes. No Tailwind.
- Reuse the editor's EXISTING in-file field helpers (`NumberField`, `DateField`, `Section`, `FieldGrid`, `Col`). Do NOT add new helper components, do NOT convert the editor's native `type="date"` inputs to a Calendar popover, and do NOT restructure existing sections.
- FontAwesome `pro-regular`; never `fixedWidth`.
- Do NOT edit `routeTree.gen.ts`. Do NOT use Playwright.
- The repo has PRE-EXISTING tsc errors (ContactDealCard.tsx, EmailsCalendar.tsx:120, actions.ts ~line 338, store.test.ts:2, EditorRoot.tsx:56). Gate = "no NEW errors beyond these."
- Commission math: reuse `commissionAmountFromPct(salePrice, pct)` and `commissionPctFromAmount(salePrice, amount)` from `#/data/commission`. Sale price anchors. `salePrice`/`commissionPct`/`commissionAmount`/`closeProbability` are non-nullable `number` on `DealTransaction` (cleared input → `0`); `contractExecutedDate`/`closeDate` are `string | null`.

---

### Task 1: Transaction Terms section in the deal editor

**Files:**
- Modify: `src/components/deals/DealMarketingEditor.tsx`
  - Add a commission import near the other `#/data/...` imports (the file already imports `updateDeal` from `#/data/actions` around line 36).
  - Add three commission handlers right after the `patchTransaction` helper (defined ~line 762-763, inside the `DealMarketingEditor` component).
  - Insert a new `<Section title="Transaction Terms">` between the end of the "Setup & Status" `</Section>` (~line 874) and the `{/* ── Sale-side marketing + terms ── */}` comment (~line 876).

**Interfaces:**
- Consumes: `commissionAmountFromPct`, `commissionPctFromAmount` from `#/data/commission`; the component's existing `transaction` state, `setTransaction`, `patchTransaction`; existing in-file `NumberField`, `DateField`, `Section`, `FieldGrid`, `Col`.
- Produces: no new exports.

- [ ] **Step 1: Add the commission helper import**

Open `src/components/deals/DealMarketingEditor.tsx`. Find the existing import of `updateDeal` (around line 36: `import { updateDeal } from "#/data/actions";`). Add directly below it:

```ts
import { commissionAmountFromPct, commissionPctFromAmount } from "#/data/commission";
```

- [ ] **Step 2: Add the three bi-directional commission handlers**

Find the `patchTransaction` helper inside the `DealMarketingEditor` component (around line 762):

```ts
  const patchTransaction = (patch: Partial<DealTransaction>) =>
    setTransaction((t) => ({ ...t, ...patch }));
```

Immediately after it, add:

```ts
  // Sale Price / Gross Commission % / Gross Commission $ — bi-directional, sale
  // price anchors (same math as the stage gate and Edit Transaction dialog).
  const setSalePrice = (v: number | null) =>
    setTransaction((t) => ({
      ...t,
      salePrice: v ?? 0,
      commissionAmount:
        v != null && t.commissionPct != null
          ? commissionAmountFromPct(v, t.commissionPct)
          : t.commissionAmount,
    }));
  const setCommissionPct = (v: number | null) =>
    setTransaction((t) => ({
      ...t,
      commissionPct: v ?? 0,
      commissionAmount:
        v != null && t.salePrice != null
          ? commissionAmountFromPct(t.salePrice, v)
          : t.commissionAmount,
    }));
  const setCommissionAmount = (v: number | null) =>
    setTransaction((t) => ({
      ...t,
      commissionAmount: v ?? 0,
      commissionPct:
        v != null && t.salePrice > 0
          ? commissionPctFromAmount(t.salePrice, v)
          : t.commissionPct,
    }));
```

- [ ] **Step 3: Insert the Transaction Terms section**

Find the end of the "Setup & Status" section. It closes with the two `BrokerEditor` blocks followed by `</Section>` (around line 873-874):

```tsx
        <BrokerEditor
          title="Outside Brokers"
          brokers={outsideBrokers}
          side="outside"
          onChange={setOutsideBrokers}
        />
      </Section>

      {/* ── Sale-side marketing + terms ── */}
```

Insert the new section BETWEEN `</Section>` and the `{/* ── Sale-side marketing + terms ── */}` comment, so it reads:

```tsx
        <BrokerEditor
          title="Outside Brokers"
          brokers={outsideBrokers}
          side="outside"
          onChange={setOutsideBrokers}
        />
      </Section>

      {/* ── Transaction terms (parity with the stage gate + Edit Transaction dialog) ── */}
      <Section title="Transaction Terms">
        <FieldGrid>
          <Col>
            <NumberField
              label="Sale Price"
              value={transaction.salePrice || null}
              onChange={setSalePrice}
            />
          </Col>
          <Col>
            <NumberField
              label="Gross Commission %"
              value={transaction.commissionPct || null}
              onChange={setCommissionPct}
            />
          </Col>
          <Col>
            <NumberField
              label="Gross Commission $"
              value={transaction.commissionAmount || null}
              onChange={setCommissionAmount}
            />
          </Col>
          <Col>
            <NumberField
              label="Close Probability (%)"
              value={transaction.closeProbability || null}
              onChange={(v) => patchTransaction({ closeProbability: v ?? 0 })}
            />
          </Col>
          <Col>
            <DateField
              label="Contract Executed"
              value={transaction.contractExecutedDate}
              onChange={(v) => patchTransaction({ contractExecutedDate: v })}
            />
          </Col>
          <Col>
            <DateField
              label="Close Date"
              value={transaction.closeDate}
              onChange={(v) => patchTransaction({ closeDate: v })}
            />
          </Col>
        </FieldGrid>
      </Section>

      {/* ── Sale-side marketing + terms ── */}
```

> `value={transaction.salePrice || null}` shows an empty input when the value is `0` (a not-yet-set field), matching how the Edit Transaction dialog seeds. The `NumberField` helper maps `""` → `null` on change, and the handlers coalesce `null` → `0` for the non-nullable numeric fields.

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit 2>&1`
Expected: only the pre-existing baseline errors listed in Global Constraints — none in `DealMarketingEditor.tsx`, no unused-import/var errors from the new code.

- [ ] **Step 5: Build**

Run: `bun --bun run build`
Expected: build succeeds (`✓ built`).

- [ ] **Step 6: Test suite**

Run: `bun --bun run test`
Expected: full suite green (94 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/deals/DealMarketingEditor.tsx
git commit -m "feat(deals): surface transaction terms on the deal edit page"
```

- [ ] **Step 8: Manual verification (ask the user — No Playwright)**

Run: `bun --bun run dev`
Ask the user to: open a deal → Edit → confirm the new "Transaction Terms" section shows the six fields prefilled; editing Gross Commission % updates Gross Commission $, editing $ updates %, editing Sale Price updates $; Save returns to the deal and the values show on the Transaction tab.

---

## Notes / Non-goals

- No data-layer change: `DealMarketingEditor.save()` already commits the whole `transaction` via `updateDeal`.
- No Dead Reason field (gate-only). No cascade into broker splits / deductions / receivables. No restructuring of existing sections or date inputs.
