# AI Document Ingestion — Background Processing Flow

**Date:** 2026-07-29
**Status:** Approved, ready for implementation planning

## Problem

When a broker attaches files in the create-deal modal and hits **Create deal with AI**, the
prototype fills every deal field synchronously and lands them on a deal that is instantly
publish-ready. That hides the thing we actually want to show: document ingestion is real work
that takes time, and its output sometimes disagrees with what we already know.

We want to demonstrate the flow — processing runs in the background while the broker uses the
deal, and it lands in one of two outcomes:

1. **Clean** — everything extracted, all fields filled, deal is ready to publish.
2. **Needs review** — some extracted values conflict with what's on record. The broker
   arbitrates them in the edit form before the deal can publish.

## Non-goals

- Real document parsing. Every extracted value is faked from the property record or fixtures.
- Changing the Rosa hero arc. Its `AiDealProgressModal` (blocking, ~5.4s) stays exactly as is;
  the email-sourced documents are assumed to process cleanly.
- A new publish-blocking mechanism. Publish readiness continues to be decided solely by
  `publishReadiness` in `stageGates.ts`.

## Outcome routing

| Entry point | Documents | Outcome |
| --- | --- | --- |
| Rosa email arc (`createRosaProposalDeal`) | `ROSA_FINANCIAL_DOCS` | Untouched — blocking modal, clean |
| Create-deal modal upload | Hand-attached files | Background run, always ends in `needs-review` |

Hand-uploaded documents always conflict. This is a deliberate demo rule, not a heuristic: it
means either outcome can be shown on demand by choosing an entry point, and it never depends on
which property happened to be selected.

## Data model

Added to `Listing` in `src/data/types.ts`, persisted through the existing Zustand + IndexedDB
store so a run survives navigation and reload. Mirrors the precedent set by
`DealUnderwriting.status`, where a stored status is the signal a UI component reads on mount.

```ts
/** An AI document-ingestion run on a deal. Absent means no run has happened. */
export interface DealIngestion {
  status: 'processing' | 'needs-review' | 'complete'
  /** File names being read — shown in the banner while processing. */
  documents: string[]
  /** Which stage the run is on: 0 scanning, 1 extracting, 2 filling. */
  stage: 0 | 1 | 2
  /** How many fields were filled without disagreement. Shown on completion. */
  filledCount: number
  /** Values needing broker arbitration. Empty on the clean path. */
  conflicts: IngestionConflict[]
  startedAt: string
}

/**
 * One value the run could not settle on its own. Always two-sided: `docValue` vs
 * `currentValue`. Unresolved conflicts are NOT written to the deal.
 */
export interface IngestionConflict {
  /** Which editor field this lands on. */
  fieldKey: IngestionFieldKey
  label: string
  /** What the documents say. Display-formatted. */
  docValue: string
  /** What the deal/property record says today. Display-formatted. */
  currentValue: string
  /** Where each side came from, e.g. "T-12.pdf" vs "Property record". */
  docSource: string
  currentSource: string
  /** The raw value to write for each side, keyed by the field's own type. */
  docRaw: number | string
  currentRaw: number | string
  /** Set once the broker picks a side. */
  resolution?: 'doc' | 'current'
}

export type IngestionFieldKey = 'askingPrice' | 'noi' | 'occupancyPct'
```

### Conflict fields

Three fields, chosen because a T-12 and a rent roll would plausibly disagree with the record about
exactly these, and because whichever deal type is in play, at least one of them is gate-required —
so an unresolved conflict has real consequences instead of being decoration.

| Field | Doc side | Record side | Editor location | Gate-required |
| --- | --- | --- | --- | --- |
| Asking price | T-12-derived value | `financials.askingPrice` | Deal tab → Financials | Sale only |
| NOI | T-12 net operating income | `financials.noi` | Deal tab → Financials | Never |
| Occupancy | Rent roll occupancy | `property.occupancyPct` | Listing tab → Building | Never |

Every one of these is genuinely editable in the form today, which is a hard requirement — a
conflict the broker cannot resolve where it lives would be a dead end. `marketing.availableSqFt` was
considered and rejected for exactly that reason: it is gate-required for a Lease but is not exposed
anywhere in the edit form.

Per `resolveGate('proposal', 'active', dealType)`, a Sale publish gate requires `askingPrice`;
NOI and occupancy are required by neither deal type.

**Known limitation:** publish-blocking therefore applies to **Sale** deals only — the flow the
create-deal modal defaults to and the one this demo drives. On a Lease, whose gate requires
`leaseRate` + `availableSqFt`, none of the three conflicts are gate-required, so they are
informational and the deal can publish with them unresolved. We are accepting that rather than
inventing a synthetic requirement or surfacing a new field just to make Lease blocking.

Every conflict is two-sided by construction. When the deal has no property record behind it (a
typed-in address), the two sides are **doc vs doc** — the rent roll and the T-12 disagreeing with
each other — rather than doc vs record. Either way both sides carry a value, so whichever the
broker picks leaves the field populated.

## Components

### `src/data/ingestion.ts` — pure logic

No React, no timers. Unit-tested.

- `deriveConflicts(deal, property): IngestionConflict[]` — builds the conflict list, choosing
  doc-vs-record or doc-vs-doc based on whether a property record exists.
- `advanceStage(ingestion): DealIngestion` — bumps `stage`, no side effects.
- `resolveConflict(ingestion, fieldKey, side): DealIngestion` — records a pick.
- `allResolved(ingestion): boolean` — true when every conflict has a `resolution`.
- `ingestionPatch(ingestion): PublishReadyPatch` — the field values to commit, comprising the
  clean fields plus any resolved conflicts. Unresolved conflicts are excluded.

### `IngestionWatcher` — the background runner

Mounted once in `AppShell` alongside `BovWatcher` and `RosaLeadsWatcher`, following that
established pattern. Living in the shell rather than on the overview page is what makes the run
genuinely background: it keeps advancing if the broker navigates away mid-run.

Finds any listing with `ingestion.status === 'processing'` and walks the stages on ~1.6s timers
(~5s total). On the last stage it commits: applies the non-conflicting field values via the
existing `updateDealMarketing` / `updateDealTransaction` / `updateDealFinancials` actions, sets
`filledCount`, attaches conflicts from `deriveConflicts`, and sets `status` to `needs-review`
when there are conflicts or `complete` when there are none.

### Ingestion banner — above the planner

New component rendered in `overview.tsx` in the same slot as `SetupIncompleteBanner`, reading
`listing.ingestion`. A pure reader — it never drives the run.

| Status | Treatment |
| --- | --- |
| `processing` | Info Alert, spinner, "Reading your documents…", current stage label, file names |
| `needs-review` | Warning Alert, "Buildout filled N fields. M need your confirmation." + **Review fields** button → `/listings/$listingId/edit?review=ingestion` |
| `complete` | Success Alert, "Buildout filled N fields from your documents." + dismiss |

`SetupIncompleteBanner` is suppressed while `status === 'processing'`, so a deal started in a
live stage doesn't show "Setup incomplete" next to "Processing" for the ~5s the run takes. Once
the run resolves, the two banners are consistent with each other by construction: the fields the
setup banner names as missing are exactly the unresolved conflicts.

### Conflict highlighting in the edit form

Every field in the edit form flows through the shared wrappers in
`src/components/listings/edit/fieldWidgets.tsx` (`TextField`, `NumberField`, `DateField`,
`SelectField`), so the highlight is added in one place rather than at each call site.

- A new `IngestionConflictContext` carries `{ conflicts, onResolve }`.
- The wrappers take an optional `fieldKey`. When a matching unresolved conflict exists, the field
  renders a warning ring plus a compact arbitration row beneath the input:

```
Asking Price  ⚠
┌────────────────────────┐
│ 7900000                │
└────────────────────────┘
From T-12.pdf: $8,400,000   [Use this]  [Keep current]
```

- Picking a side writes the raw value into `DealMarketingEditor`'s existing shared working copy
  and marks the conflict resolved. Save commits through the editor's normal path — no separate
  write path for conflict resolution.
- `DealMarketingEditor` provides the context when the route carries `?review=ingestion`.
- When the last conflict resolves, ingestion flips to `complete`.

**Conflicts span both editor tabs.** Asking price and NOI sit on the Deal tab's Financials section;
occupancy is on the Listing tab, inside `ListingFormEditor` → `BuildingSection`. Review mode
therefore cannot simply scroll to one field:

- Each tab label carries a count badge for its unresolved conflicts, so nothing is hidden behind an
  unselected tab.
- On mount, review mode selects the tab holding the first unresolved conflict and scrolls it into
  view within that tab.
- Resolving the last conflict on one tab does not navigate; the remaining badge is the affordance.

## Publish readiness

Deliberately **not** a new concept. The rule falls out of the existing gate:

- Nothing is marked publish-ready at create time. The synchronous
  `buildPublishReadyPatch` call in `CreateDealModal.handleCreate` is removed.
- A clean run writes every gate-required field, leaving the deal in the same end state it reaches
  today — one `aiDocsReviewed` click from publishing — just ~5s later.
- A conflicting run does not write the disputed fields. On a Sale, `askingPrice` is therefore
  missing, so `publishReadiness` reports it and the Approve & Publish gate blocks on its own.
- Resolving the conflicts writes the values, and the gate clears. No bespoke blocking logic.

NOI and occupancy are not gate-required, so leaving them unresolved does not block publishing. They
still show in the banner count and the tab badge. We are not adding synthetic requirements to make
them blocking — see the Lease limitation above.

## Testing

`src/data/ingestion.test.ts` covers the pure logic, matching the convention of
`uploadIntelligence` and `occupancyMismatch`:

- `deriveConflicts` produces doc-vs-record conflicts when a property record exists, and
  doc-vs-doc conflicts when it does not.
- Every derived conflict has a non-empty value on both sides.
- `ingestionPatch` excludes unresolved conflicts and includes resolved ones with the picked side's
  value.
- `allResolved` is false until every conflict has a resolution.
- A Sale with all conflicts resolved passes `publishReadiness` except for `aiDocsReviewed`; a Sale
  with an unresolved asking-price conflict reports `askingPrice` missing.

The banner, watcher, and timer choreography stay untested — presentational theater, consistent
with how `AiDealProgressModal` and `UnderwritingProgress` are treated.

## Files touched

| File | Change |
| --- | --- |
| `src/data/types.ts` | Add `DealIngestion`, `IngestionConflict`, `IngestionFieldKey`; `ingestion?` on `Listing` |
| `src/data/ingestion.ts` | New — pure logic |
| `src/data/ingestion.test.ts` | New — unit tests |
| `src/data/actions.ts` | Add `startIngestion`, `advanceIngestion`, `resolveIngestionConflict`, `completeIngestion` |
| `src/data/createListing.ts` | `NewListingDraft` carries the initial ingestion state |
| `src/components/deals/CreateDealModal.tsx` | Drop the synchronous patch; seed `ingestion` when files are attached |
| `src/components/deals/IngestionWatcher.tsx` | New — the background runner |
| `src/components/deals/IngestionBanner.tsx` | New — the three-state banner |
| `src/components/layout/AppShell.tsx` | Mount `IngestionWatcher` |
| `src/routes/_shell/listings/$listingId/overview.tsx` | Render the banner; suppress setup banner while processing |
| `src/routes/_shell/listings/$listingId/edit.tsx` | Read the `review` search param |
| `src/components/deals/DealMarketingEditor.tsx` | Provide the conflict context; tab badges; select + scroll to first conflict |
| `src/components/listings/edit/sections/BuildingSection.tsx` | Pass `fieldKey` on occupancy |
| `src/components/listings/edit/fieldWidgets.tsx` | Optional `fieldKey`; render the arbitration row |
| `src/main.scss` | Conflict-field ring styling |
