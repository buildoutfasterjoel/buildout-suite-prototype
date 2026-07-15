# Phase 3 — Deal Marketing Editor

**Status:** Approved design (2026-07-14). Part of the Unified Deal Lifecycle program
(`2026-07-14-deal-lifecycle-program.md`).
**Dependencies:** Phase 2 (the canonical field catalog — already implemented in the type layer
and seed at `SEED_VERSION = 5`).

---

## Goal

Give a broker one place to edit a deal's **marketing content** — the sale/lease copy, terms,
financials, and per-unit lease terms that feed the marketing outputs (Website / Email /
syndication). Today no such surface exists: the Marketing nav group in
`PropertyDetailSidebar.tsx` holds only *outputs* (Leads / Documents / Website / etc.), not an
editor for the content behind them. Phase 3 adds that editor.

## Design

- **A single-page, full-page editor** at a new route `src/routes/listings/$listingId/edit.tsx`,
  launched by the existing (currently unwired) **"Edit Deal"** button in
  `PropertyDetailHeader.tsx`. View and edit are separate URLs.
- The editor holds a **working copy in local state**; a sticky footer **Save** commits through
  the data layer and navigates back, **Cancel** discards.
- Sections **adapt to `dealType`** (`'Sale' | 'Lease' | 'Sale / Lease'`); the Setup section
  always shows:
  - **Setup / status** *(always)* — deal type, status ladder, primary + additional brokers with
    split %, Listed-on / Expiration dates, marketing channel + visibility tier.
  - **Sale-side marketing + terms** *(sale deals)* — title, description, bullets (add/remove),
    property use, investment type, includes-real-estate, auction, sale terms, reimbursement,
    closing info.
  - **Sale-side financials** *(sale deals)* — asking price + hide-price, income/expense line
    items, NOI, cap rate, and named **reorderable scenarios** (Worst/Best case) via up/down
    controls (no drag-and-drop library).
  - **Lease-side terms** *(lease deals)* — deal-level copy (title / description / bullets /
    commission split %) plus **per-unit lease terms**: one editable card per `PropertyUnit`.
- Reuse Blueprint `Field`, `Input`, `Textarea`, `Select`, `Switch`, `Button`, and the local
  `Section` helper (`listingWidgets.tsx`).

## Data model changes (`src/data/types.ts`, bump `SEED_VERSION` 5 → 6)

- Rename `LeaseTerms` → **`SpaceLeaseTerms`** and make it **per-unit**: add `unitId: string` and
  the missing catalog fields (tax/SF, tax stops, CAM/SF, CAM stops, insurance/SF, expense stops,
  % procurement fee, tenants-pay gas/electric/water, moving/buyout allowance, concession,
  net-lease-investment) alongside the existing ~14 (rate, units, hide-rate, type, term, date
  available, min divisible, max contiguous, TI, free rent, signage, escalators, sublease,
  description).
- On `DealMarketing`, replace `leaseTerms: LeaseTerms` with `spaceLeaseTerms: SpaceLeaseTerms[]`
  and add `leaseCommissionSplitPct: number | null`.
- Update `seed.ts` (one `SpaceLeaseTerms` per property unit for lease deals; `[]` otherwise),
  `createListing.ts` (default `spaceLeaseTerms: []`, `leaseCommissionSplitPct: null`), and
  `persistence.ts` (`SEED_VERSION = 6`).

## Actions (`src/data/actions.ts`)

Add, built on the existing private `patchListing()` + `persist()` pattern, setting `updatedAt`:
- `updateDeal(dealId, patch: Partial<Listing>)` — top-level fields (status, dealType, brokers,
  financials, transaction). The editor commits once with this.
- `updateDealMarketing(dealId, patch: Partial<DealMarketing>)` — focused marketing merge-patch.

## Scope note

The audit's per-item **public/private ("mark to go public") flags are deferred.** `PublishFlags`
stays in the model untouched; wiring the flags (and the "will publish" set) moves to Phase 4's
approve-and-publish gate.

## Verification

Run `bun --bun run dev`:
- Open a **sale** deal → "Edit Deal" → change title / price / scenario order → Save → values
  reflect on the deal and survive a reload (IndexedDB persist).
- Open a **lease** deal → Lease section renders one card per property unit; per-unit edits
  persist.
- **Sale-only** deal shows no Lease section; **lease-only** shows no Sale sections; Setup always
  shows.
- `bun --bun run test` passes (extended `actions.test.ts`).
