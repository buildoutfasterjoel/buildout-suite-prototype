# Suggested Documents section refinement — Create Deal modal

**Date:** 2026-07-21
**File:** `src/components/deals/CreateDealModal.tsx` (step 2, ~lines 905–1027)

## Goal

Tidy the step-2 "Suggested documents" section of the Create Deal wizard. Pure
layout/chrome changes — no logic, state, or behavior changes.

## Changes

### 1. Remove the wrapping box
The outer container currently carries `border rounded p-2`, which is the only
visible border in the section and reads as redundant chrome. Drop it so the
container is a plain vertical flex stack (`d-flex flex-column gap-3`), letting
the two sub-sections sit directly on the modal background.

### 2. Reorder to Selected → Separator → Available
- **Selected** moves to the top. It now **always renders** with its
  `Selected (n)` header (previously it was hidden when nothing was selected).
  When the count is 0, render an empty hint (`Nothing selected yet.`) in place
  of the rows so the layout stays stable and Available never jumps up.
  - Styling: `fs-small`, **not** muted (plain body color).
- A Blueprint `<Separator />` (horizontal, from
  `@buildoutinc/blueprint-react/ui/Separator`) sits between the two blocks.
- **Available** (search field + scrollable list) moves underneath.
- Underwriting's inline `<UnderwritingDepth>` control moves up with the
  Selected block — consistent with "Selected on top".

### 3. Always-visible scrollbar on the Available list
The scrollable Available list (`maxHeight: 208`) changes from `overflow-auto`
to an always-visible vertical scrollbar via inline style
`overflowY: "scroll"`, reserving the gutter and keeping the bar visible whether
or not the content overflows.

## Non-goals
- No changes to document selection logic, underwriting eligibility, or any
  state.
- No changes to step 1 or the modal footer.
