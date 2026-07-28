# Publish Preview — Review the Listing Before It Goes Live

**Date:** 2026-07-28
**Status:** Approved, ready for planning
**Branch:** joel/polish-4

## Problem

Moving a deal Pitching → Active publishes the listing. Today the gate that guards
that moment only ever shows the broker what's **missing** — `unsatisfiedRequired`
filters the field list (`StageGate.tsx:253`), and when nothing is missing
`requestStageChange` skips the modal entirely (`useStageGate.ts:78-86`) and
commits.

So the better-prepared the deal, the less the broker sees. A fully-filled deal
goes live with **no confirmation at all**. The one moment a broker most wants to
look over their listing — right before it's public — is the moment the product
shows them nothing.

## Goal

Replace the publish gate's form-of-gaps with a **preview of the listing**: the
content that will go live, the photos, and the documents on the deal. The broker
either approves and publishes, or bails out to the edit space to fix something
and comes back.

## Relationship to the 2026-07-24 "Surface Only the Gaps" spec

That spec established two rules. This spec keeps one and reverses the other, for
publishing transitions only:

- **Kept:** the gate does not render a wall of pre-filled inputs. The preview
  shows values as *content*, not as form fields.
- **Reversed for `config.publishes`:** "when nothing is missing, skip the modal."
  This reversal is deliberate and is the user feedback that prompted this spec —
  the zero-click publish is what brokers reported as the problem, not a
  regression to guard against.
  A publish always opens the preview. The zero-click swap was the right call for
  Under Contract and Closed, where the transition is bookkeeping; it is the wrong
  call for the transition that makes a listing public.

Every non-publishing gate keeps its 2026-07-24 behavior unchanged.

## Decisions

1. **The preview replaces the publish modal's body.** It is the gate, not a step
   before or after it.
2. **It renders in the existing `lg` scrollable modal.** No new route, no
   full-screen takeover. Sections are compact to fit.
3. **Photos are derived, not modeled.** A deterministic gallery drawn from the
   existing `CRE_PHOTO_IDS` pool. No change to `Listing`.
4. **Content gaps bounce out; attestations stay in.** Title, description, price /
   lease rate, available SF render as flagged rows that send the broker to the
   edit space. The AI-document review checkboxes and the two listing dates stay
   interactive in the preview — a document review has no editor equivalent, and
   the AI-extracted dates exist precisely to be confirmed at the publish moment.
5. **The commit path does not change.** `buildTransitionInput` →
   `commitStageTransition`, exactly as today.

## Flow

```
Broker drags Pitching → Active  (sell-side)
        │
        ▼
   Publish preview  ──── Approve & Publish ────▶  commitStageTransition (publish)
        │                                          flag cleared
        ├──── Back to editing ──▶ /listings/$id/edit
        │                          deal stays in Pitching
        │                          pendingPublishDealId set
        │                          banner offers "Review & publish"
        │
        └──── X / cancel ──▶ board unchanged, no flag
```

Buy-side deals are unaffected: a buy-side deal is not a listing, so it moves
stages with no gate and no preview (existing rule in `requestStageChange`).

## The model — `src/data/publishPreview.ts` (new, pure)

```ts
export type PreviewRowStatus = 'ok' | 'missing'

export interface PreviewRow {
  label: string
  /** Display value, or null when not set. */
  value: string | null
  status: PreviewRowStatus
  /** Set when this row corresponds to a gating requirement. */
  field?: RequiredField
}

/** Row-based sections only. Photos and documents are separate model fields. */
export interface PreviewSection {
  id: 'deal' | 'content'
  title: string
  rows: PreviewRow[]
}

export interface PublishPreviewModel {
  sections: PreviewSection[]
  /** Resolved photo URLs for the gallery strip. */
  photos: string[]
  documents: DealDocument[]
}

export function buildPublishPreview(
  deal: Listing,
  property: Property | undefined,
  form: GateFormState,
): PublishPreviewModel
```

The view renders four sections. Two are row-based and come from `sections`; the
other two render the `photos` and `documents` fields directly.

| Section | Source | Contents | Gates? |
|---|---|---|---|
| **Deal** | `sections[0]` | Property address, Side, Seller, Deal type | No — context only |
| **Listing content** | `sections[1]` | Title, Description, Asking price *(sale)* / Lease rate + Available SF *(lease)*, Property use | Yes |
| **Photos** | `photos` | Derived gallery strip | No |
| **Documents** | `documents` | Deal documents, AI ones with a review checkbox | Review attestation only |

Row status is computed with `stageGates.ts`'s existing `fieldSatisfied`, and row
labels come from `REQUIRED_FIELD_LABEL`, so "what counts as missing" keeps a
single definition. `fieldSatisfied` is currently module-private and gets exported
for this.

The model reads the working `GateFormState` rather than the raw `Listing` so
values the broker edits in the preview (the two dates) reflect immediately.

## Photos — `listingGallery(id, count)`

Added to `src/components/properties/propertyDisplay.ts`, beside `getPhotoUrl`.

- Walks `CRE_PHOTO_IDS` starting at the same index `getPhotoUrl` resolves, so
  **photo #1 is the deal's existing hero image**, including the pinned photo for
  story properties (Rosa's building) via `pinnedPhotoResolver`.
- Returns `count` distinct photo ids, wrapping the pool, mapped through
  `crePhotoUrl`.
- Deterministic: same id in, same gallery out.

`ListingMedia` is repointed at the same helper so the Media tab renders that
gallery instead of its current "No media uploaded yet" `Empty` state. Without
this, the preview would show five photos while the Media tab claims there are
none.

## The view — `src/components/deals/PublishPreview.tsx` (new)

Rendered inside the existing `Modal.Body` when `config.publishes`.

- **Gap alert** when any row is `missing`: `Alert severity="warning" withIcon`
  with a duotone icon as a direct child (per the theme's `.alert-icon` rule),
  reading e.g. "2 items need attention before this goes live."
- **Sections** as compact label/value rows inside the bordered
  `bg-body-tertiary` block the publish gate already uses. A `missing` row shows
  its label, a muted "Not set", and a warning marker. It does **not** become an
  input.
- **Photos**: horizontal thumbnail strip, fixed-height rounded thumbnails with
  `object-fit: cover`, plus a count.
- **Documents**: compact rows. AI-generated documents carry a badge and their
  review checkbox inline — this is where the `aiDocsReviewed` attestation lives.
  When the deal has no documents the section renders "No documents on this deal"
  rather than disappearing; the point of the preview is showing what's there.
- **Listing dates**: the existing two `GateDatePicker`s, keeping the `ai-draft`
  note when the dates were AI-extracted from a signed listing agreement.

## Footer

| Control | Behavior |
|---|---|
| **Back to editing** (outline) | Close modal, set `pendingPublishDealId`, navigate to `/listings/$listingId/edit`. Deal stays in Pitching. |
| **Approve & Publish** (primary) | Disabled until `canConfirm`. Commits via the unchanged `buildTransitionInput` → `commitStageTransition` path. Clears the flag. |
| **Modal X** | Plain cancel. No navigation, no flag, board unchanged. |

## Return path

- `useStageGate` gains `pendingPublishDealId: string | null`, with actions to set
  and clear it.
- `DealMarketingEditor` renders a `PublishReviewBanner` when
  `pendingPublishDealId === listing.id`: a short "You're finishing up before
  publishing" line with a **Review & publish** button that calls
  `requestStageChange(id, 'active')` — or `requestSetupCompletion(id)` when the
  deal is already in a live stage.
- The flag clears on publish and on plain cancel.

**Navigation must use TanStack `useNavigate` / `<Link>`, not `<a href>`.** A full
page reload would reset the Zustand store and drop the flag. The gate's existing
`<a target="_blank">` links to the editor and documents stay as they are — those
are deliberate new-tab links and don't carry the flag.

## Setup-completion mode

`requestSetupCompletion` (a deal created directly in Active/Under Contract that
never published) shows the same preview via `completeSetupGate`, publishing in
place without changing stage. Its own "no modal when satisfied" shortcut is
removed for the same reason as the publish gate's.

## Changes by file

| File | Change |
|---|---|
| `src/data/publishPreview.ts` | **New.** Pure model builder. |
| `src/data/publishPreview.test.ts` | **New.** Model tests. |
| `src/data/stageGates.ts` | Export `fieldSatisfied`. No rule changes. |
| `src/components/properties/propertyDisplay.ts` | Add `listingGallery`. |
| `src/components/listings/ListingMedia.tsx` | Render the derived gallery. |
| `src/components/deals/PublishPreview.tsx` | **New.** Preview view. |
| `src/components/deals/StageGate.tsx` | Delegate to `PublishPreview` when `config.publishes`; new footer for that path. Other gates untouched. |
| `src/components/deals/useStageGate.ts` | Always open for publishing gates; add `pendingPublishDealId`. |
| `src/components/deals/DealMarketingEditor.tsx` | Render `PublishReviewBanner`. |
| `src/components/deals/useStageGate.test.ts` | Update the satisfied-publish-gate expectation (see below). |

## Testing

New `publishPreview.test.ts`:
- Sale deal produces the asking-price row; lease deal produces lease rate +
  available SF instead.
- Each gating field, when unset, produces a `missing` row with the right label.
- A complete deal produces zero `missing` rows.
- `listingGallery` is deterministic, returns `count` distinct photos, and its
  first photo matches `getPhotoUrl` for the same id — including a pinned story
  property.
- Documents pass through, and an empty document list is represented rather than
  dropped.

Updated `useStageGate.test.ts`: the case
`"publishes in place with no modal when the deal is fully populated"` (line 137)
asserts exactly the silent-commit path this spec removes. It is rewritten to
expect the preview to open, and to assert the deal is *not* yet published — the
behavior change, asserted directly rather than weakened or deleted.

`setupIncompleteBanner.test.ts` is **not** affected: it drives
`commitStageTransition` / `buildTransitionInput` directly and only routes
`requestStageChange` to the Under Contract gate, which this spec doesn't touch.

Existing `stageGates.test.ts` and `stageGates.lease.test.ts` must pass unchanged —
the gate rules and commit path don't move.

## Out of scope

- Modeling photos on `Listing`, upload, or per-listing curation. The Media tab
  gets the derived gallery, not a real library.
- Any change to which fields the publish gate requires.
- The Under Contract, Closed, Lost, and backward gates.
- Umbrella / child lease-space deals.
- Inline editing of listing content inside the preview.
