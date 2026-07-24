# Create Deal Wizard — Design

**Date:** 2026-07-20
**Component:** `src/components/deals/CreateDealModal.tsx`
**Status:** Approved (in-chat), ready to build

## Problem

`CreateDealModal` has grown dense: seven stacked sections in one long scroll, with
the document/underwriting setup (search, Available/Selected lists, a depth slider
with 12 checks) sitting at the bottom. Fast users can't get out quickly, and the
document machinery is nested-scrolled inside the modal body. We want to keep the
smart context-awareness while making the common path fast and the setup optional.

## Solution: a two-step wizard

Split the modal into two steps with a lightweight step indicator. A skip path lets
users create a bare "shell" deal without touching document setup.

### Step 1 — Deal (the essentials)

Deal type (Sale/Lease tabs) · Side cards · Stage · Contact + Property · Deal scope
(units, when the chosen property has them). Same fields and context-aware prefill
behavior as today, fenced into step 1.

### Step 2 — Documents (available at any stage)

- "Add your own files" (moved here from step 1 — groups all document work together).
- Suggested-documents picker: **Available** (with search) + **Selected**, with
  **Underwriting** and its depth control inline.
- The firm's `defaultOn` documents (OM / Rent Roll / BOV) come **pre-selected** here,
  since reaching step 2 means the user is opting into setup.

> The current `stage === "proposal"` (Pitching-only) gate on documents/underwriting
> is **removed** — documents can be created at any stage.

## Footer / CTAs

- **Step 1:** `Cancel` (ghost) · `Create deal` (secondary — **skip to shell**) ·
  **`Next`** (primary). `Next` is primary to steer users into the setup that does
  the heavy lifting for them; skipping is available but secondary.
- **Step 2:** `Back` (ghost) · `Create deal` (primary — full deal).

## Validation

Rule: **`Side` AND (`Contact` OR `Property`)**. (Loosens today's rule, which
required all three.)

`Next` and the step-1 `Create deal` are disabled until valid, **with a helper line**
below the fields stating what is missing (e.g. "Pick a side and add a contact or
property to continue") — no silent disabled button.

## What each path produces

- **Skip** (`Create deal`, step 1): bare shell — side, contact/property, stage,
  scope only. No uploads, no suggested docs, no underwriting. This is what the
  "needs attention" badges (Project B, separate) will later flag.
- **Full** (`Create deal`, step 2): the above **plus** uploads + selected suggested
  documents + underwriting (if selected).

## Implementation notes

- Add `step` state (`1 | 2`), reset to `1` each time the modal opens.
- Drop the `suggestedDocsOn` switch entirely — step 2 *is* the document setup.
- `handleCreate({ withDocuments })`: skip passes `false`, step-2 create passes `true`.
- Remove the `isPitching` conditions in `handleCreate` for `suggestedDocuments` and
  `underwriting`.
- **Step indicator is custom** (Blueprint ships no stepper). Build it with design
  tokens — `var(--bp-primary)` for the active/done accent, `text-muted` / `border`
  utilities for inactive — never hardcoded hex. Match the existing token usage in
  this file (`var(--side-*)`, `var(--bs-primary)`).
- Keep the depth slider independent: it drives only the underwriting checks, not the
  document checkboxes.

## Out of scope (Project B, separate spec)

- In-deal "needs attention" badges that flag incomplete sections on the deal detail
  pages.
- Adding/generating documents from within a deal at any stage.
