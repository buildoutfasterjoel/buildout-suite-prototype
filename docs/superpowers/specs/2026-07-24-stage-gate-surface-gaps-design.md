# Stage Gate — Surface Only the Gaps

**Date:** 2026-07-24
**Status:** Approved, ready for planning
**Branch:** joel/polish-1

## Problem

When a deal is dragged across a stage gate (e.g. Pitching → Active, or → Under
Contract), the gate modal renders **every** required field for that transition,
even the ones the deal already carries from creation. `seedGateForm` pre-fills
them, and `canConfirm` already lights the confirm button the moment all required
fields are satisfied — but the broker still faces a wall of pre-filled inputs and
has to hunt for the one gap. A deal that's already complete should just swap
stages, not force a form.

## Goal

Surface only the required fields the deal has **not** already satisfied. When
nothing is missing, skip the modal entirely and move the deal — a true
drag-and-drop swap; the board and stage chips re-render from the store.

## The rule (one mechanic, applied per gate)

On gate open, compute the unsatisfied required fields from the seeded deal data:

```
unsatisfied = config.required.filter(f => !fieldSatisfied(f, seededForm))
```

- **Render only the unsatisfied fields.** Title, price, listing dates, a linked
  buyer — anything already on the deal collapses away.
- **When `unsatisfied` is empty on a forward field gate, skip the modal** and
  commit the transition directly. The confirmation is the deal itself moving —
  the Kanban board re-derives from the store, and stage chips re-render, exactly
  as they do after a modal commit today. (There is no move toast in the codebase;
  none is added.)

Validation (`canConfirm`) is unchanged: it still checks *all* required fields.
Hidden fields are hidden precisely because they're already satisfied, so they
pass.

## Decisions

- **Attestations follow the same rule** as data fields (no special-casing).
- **`websiteReviewed` is dropped** from the publish gate's `required` list, and
  its checkbox is removed from the gate UI. There is no stored "website reviewed"
  state on a deal, so it could never self-satisfy; dropping it is what lets the
  publish gate reach zero-click. Website review still lives in the marketing
  editor.
- **`aiDocsReviewed` stays.** It already self-satisfies when the deal has no
  AI-generated docs (`seedGateForm` sets `aiDocsAllReviewed: aiDocs.length === 0`).
  When AI docs exist and are unreviewed, the review checklist is the one thing the
  gate surfaces.

## Changes by file

### `src/data/stageGates.ts`
- Remove `'websiteReviewed'` from the `active` case's `required` array in
  `resolveGate`.
- Export a shared helper:
  ```ts
  export function unsatisfiedRequired(
    config: GateConfig,
    form: GateFormState,
  ): RequiredField[] {
    return config.required.filter((f) => !fieldSatisfied(f, form))
  }
  ```
  Both the request layer and the modal use it, so "what's a gap" has one source
  of truth.

### `src/components/deals/useStageGate.ts` (`requestStageChange`)
- For sell-side deals, before opening the gate: resolve the config, seed the
  form, and compute `unsatisfiedRequired`.
- **Auto-commit (no modal)** in either of these cases:
  - A **forward field gate** (`kind === 'field'`) whose `unsatisfiedRequired` is
    empty — build the transition input (`buildTransitionInput`) and call
    `commitStageTransition` directly.
  - A **pure backward confirm** (`kind === 'confirm'` and `!config.leavesActive`)
    — nothing to decide, so commit directly.
- Otherwise, open the gate as today. This preserves the modal for: forward gates
  with real gaps, the dead gate, and backward-out-of-Active (which carries the
  unpublish choice).
- `requestSetupCompletion` (Approve & Publish for a deal created live) runs
  through the same emptiness check so a fully-populated deal completes setup
  without a modal.

### `src/components/deals/StageGate.tsx`
- Compute the hidden set **once** from the *initial* seeded form (not the live
  form) so a field doesn't vanish mid-typing as the user fills it in.
- Introduce a single `show(field)` predicate = "required AND unsatisfied at seed."
- Replace the blanket `config.publishes && (…)` guards around the listing-content
  fields (title, description, asking price / lease rate + available SF, AI-doc
  review) with per-field `show(...)` guards.
- Keep the "You're publishing this listing" summary header whenever the publish
  modal is shown (context), and keep the AI-dates-from-agreement note when the
  date fields are shown.
- Remove the "Listing website reviewed" checkbox from the gate.

## Gates left as-is

- **Mark as Lost** (`deadReason`, `closeDate`): `deadReason` is never pre-filled,
  so it always shows. Correct — no change.
- **Backward moves that leave Active**: these carry the "also unpublish (pull
  off-market)" choice, a real decision, so they keep their confirm modal.
- **Other pure backward confirms** (e.g. Under Contract → Active): nothing to
  decide, so these become instant swaps under the same emptiness check.

## Out of scope

- No change to which fields each gate requires, beyond dropping `websiteReviewed`.
- No snapshot of "what was filled at creation" — the live "is it satisfied now"
  check is sufficient and simpler.
- No redesign of the modal's visual layout beyond hiding fields.
