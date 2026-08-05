# Splitting the deal edit form: a Listing page under Marketing

**Date:** 2026-08-05
**Branch:** `joel/listing-form`
**Status:** approved design, not yet implemented

## Problem

`/listings/:id/edit` is one form wearing two hats. A tab bar splits it into a
**Listing** tab (14 sections of property and marketing fields) and a **Deal** tab
(Setup & Status, Brokers, Transaction Terms, Financials), behind a single shared
draft and a single Save. The two halves have different owners, different audiences,
and different lifetimes — the listing fields are marketing content that feeds the
website editor and syndication, the deal fields are pipeline and commission data —
and the tab bar is the only thing suggesting they belong together.

The listing fields also have no home in the deal's navigation. A broker looking for
"where do I edit what goes out to the market" has to find a pencil icon in the
header and then pick the right tab.

## What we're building

A **Marketing → Listing** page that holds the listing form directly, and a `/edit`
route reduced to the deal fields alone.

The Listing page is *not* a rendered preview of the public listing. It is where the
listing's field data is viewed and edited; the website editor is a separate section
that consumes the same data. The page's job is to be the listing form's home.

## 1. Routing and navigation

| | before | after |
| --- | --- | --- |
| Deal fields | `/listings/:id/edit` — Deal tab | `/listings/:id/edit`, no tabs, titled **Edit Deal** |
| Listing fields | `/listings/:id/edit` — Listing tab | **`/listings/:id/listing`** — a Marketing section |

`NAV_GROUPS` in `src/components/properties/dealNav.ts` gains
`{ label: "Listing", href: "listing", icon: faSign }` as the **first** item of the
Marketing group, ahead of Leads. `faSign` is the icon the Listing tab uses today,
so the association carries over.

No change to `visibleNavGroups`: the Listing section shows for every deal shape
that has a page at all. A space deal has no page (see
`2026-08-04-space-deals-without-a-page-design.md`), so the question doesn't arise
for spaces.

The new route file is `src/routes/_shell/listings/$listingId/listing.tsx`. It
follows the sibling routes' convention — reactive `useDataStore` selectors for the
listing and property, `null` when either is missing — and validates
`?review=ingestion` the way `edit.tsx` does today.

The header pencil in `PropertyDetailHeader` still points at `/edit`; its tooltip
already reads "Edit Deal".

## 2. Component split

`src/components/deals/DealMarketingEditor.tsx` (926 lines) is retired. It is split
along the seam its tab bar already draws, and its inline sub-editors — currently
three module-level components inside the same file — move out to their own files:

```
src/components/deals/edit/
  DealEditor.tsx             deal draft + Save/Cancel, Setup & Status, Transaction Terms
  BrokerEditor.tsx           moved as-is
  DealFinancialsSection.tsx  financial fields, read-only calc rows, line items, scenarios
  LineItemEditor.tsx         moved as-is
  ScenarioEditor.tsx         moved as-is
  PendingPublishBanner.tsx   the "Finish up, then publish" alert — both pages render it
  reseedDraft.ts             the ingestion re-seed merge helper — both pages need it

src/components/listings/edit/
  ListingEditor.tsx          page shell: listing draft + Save, wraps ListingFormEditor
```

`formatCalcAmount` / `formatCalcPercent` move with `DealFinancialsSection`, their
only consumer. `ListingFormEditor` and its 14 section components are unchanged
apart from the prop narrowing in §3.

Both new shells render `PendingPublishBanner`, which keeps its current behavior:
visible when `pendingPublishDealId` matches this deal, with a "Review & publish"
button calling `requestStageChange` or `requestSetupCompletion` by stage.

## 3. Field ownership

| draft state | owned by |
| --- | --- |
| `status`, `dealType`, `internalBrokers`, `outsideBrokers`, `transaction`, `financials` | Deal page |
| `marketing`, the `Property` draft, `internalNotes`, `financials.rentRoll` | Listing page |

`financials` is the one object both sides touch. Today that's invisible because a
single draft backs both tabs. Split in two, each page would hold its own whole
`financials` snapshot and each would pass it to `updateDeal` — so whichever page
saved second would silently revert the other's numbers.

Two changes prevent it:

1. **Narrow the props.** `ListingFormEditor` and `UnitsSection` take
   `rentRoll: RentRollRow[]` + `setRentRoll` instead of `financials` +
   `patchFinancials`. `UnitsSection` is the only section that touches financials
   at all, and it touches only `financials.rentRoll` — so the listing side never
   holds the rest of the object.
2. **Read-modify-write at save time.** Neither save writes its mount-time
   snapshot of the shared object. The Listing page's save merges its `rentRoll`
   into the store's current `financials`; the Deal page's save preserves the
   store's current `rentRoll` over its own snapshot. Each page writes only the
   keys it owns.

`status` stays a read-only input to the listing form — `MarketingVisibilitySection`
narrows its channel options by stage, and `showBuyerSection` gates the Buyer
section on it. The Deal page remains the only place `status` is set.

The existing ingestion re-seed effect (the one that merges a mid-edit ingestion
run into untouched draft keys) splits by ownership too: the Listing page re-seeds
`marketing`, the Deal page re-seeds `transaction` and `financials`. Both keep the
"only on the transition out of `processing`, only for keys untouched since mount"
rule, via the shared `reseedDraft`.

## 4. Save and Cancel

The two pages are deliberately *not* symmetric, because they are reached
differently.

**Listing page — Save only, no Cancel.** It's a nav section you live on, so Cancel
has nowhere to return to, and "reset every field to its stored value" is a
destructive action nobody asks for. Navigating away already discards. Save commits
and you stay on the page, with `notify({ title: "Listing saved" })` for feedback.
Save is disabled until something changes — one `dirty` flag set in the existing
patch helpers and cleared on save — so the bar reads as "nothing to save" rather
than a dead button. Buttons stay in the two places the form already puts them
(page header and the bottom `border-top` row), so a 14-section scroll never leaves
the broker hunting for Save.

**Deal page — unchanged.** It's a pencil-icon destination, not a nav section, so
Cancel is meaningful: both buttons return to Overview, and Cancel still calls
`clearPendingPublish()` because leaving the editor still means abandoning the
publish flow. It gains a `notify({ title: "Deal saved" })` on save for consistency.

This settles the pending-publish question: the Listing page has no Cancel and so
never clears the flag, and the gate clears it on commit as it does today.

## 5. Ingestion conflicts

`CONFLICT_TAB` — the `Record<IngestionFieldKey, "deal" | "listing">` inside the
retired editor — becomes `CONFLICT_PAGE` in a new
`src/components/deals/ingestionRouting.ts`, beside `ingestionConflictContext`.
That module exports:

- `CONFLICT_PAGE` — `askingPrice` → deal, `noi` → deal, `occupancyPct` → listing.
- `conflictKeysOn(page)` — the keys a page owns, read off `CONFLICT_PAGE` so
  membership is stated once.
- `ingestionReviewTarget(conflicts)` — the page holding the first *unresolved*
  conflict, defaulting to `"listing"` when there is none.

`IngestionBanner`'s "Review fields" button uses `ingestionReviewTarget` to choose
between `/listings/$listingId/edit` and `/listings/$listingId/listing`, keeping
`search={{ review: "ingestion" }}`.

Both routes accept `?review=ingestion`. Each wraps its form in
`IngestionConflictProvider` with the full conflict list — the arbitration rows are
rendered by the field widgets keyed on `fieldKey`, so a row appears wherever its
field lives, with no per-page filtering needed. Each page keeps the
scroll-into-view-on-mount behavior, scoped to the first unresolved conflict *it*
owns via `conflictKeysOn`.

The tab conflict badges die with the tab bar. To keep the signal, each page's
header shows a `Badge` with its own unresolved count when non-zero, using the
existing `countConflictsFor`.

## 6. Other inbound links

- `StageGate`'s "Back to editing" (the publish escape hatch) navigates to
  `/listings/$listingId/listing` for a non-space deal. Publish gaps are listing
  content — photos, description, required marketing fields — so that's the page
  the broker wants. The space branch, which routes to the parent's roster with
  `search: { space: deal.id }`, is unchanged.
- `dealCardLink.invariant.test.ts` needs its allowlist updated, and will fail
  loudly if it isn't: `DealMarketingEditor.tsx` must be dropped from `ALLOWED`
  (its "no allowlist entry that has stopped needing one" assertion catches the
  removed file), `DealEditor.tsx` added with the same reason, and the `StageGate`
  entry's reason text corrected — it currently says "deal → /edit". The new route
  file needs no entry: route files under `src/routes/` are allowed wholesale.
- `PropertyDetailHeader`'s pencil is unchanged.

## 7. Testing

- `dealNav.test.ts` — the Marketing group leads with Listing, and the item
  survives shape filtering for every shape that has a page.
- New `ingestionRouting.test.ts` — each field key maps to its page;
  `ingestionReviewTarget` picks the first *unresolved* conflict's page and ignores
  resolved ones.
- New save-isolation test — saving the Listing page leaves deal-side `financials`
  untouched, and saving the Deal page leaves `financials.rentRoll` untouched. This
  is the regression the §3 read-modify-write exists to prevent, so it gets a test
  rather than a comment.
- Gates: `bunx tsc --noEmit` and `bun --bun run test`. `vite build` does not
  type-check, so it is not the gate.
- No Playwright. Manual verification in the dev server for the visual result:
  the sidebar item, the form rendering on its own page, Save + toast, the pencil
  landing on a deal-only form, the ingestion banner routing per field, and the
  publish gate's escape hatch landing on the Listing page.
