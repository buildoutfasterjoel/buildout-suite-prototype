# Phase 2 — Field & Data-Model Audit (Standalone Gating Spec)

**Status:** Approved design (2026-07-14). Part of the Unified Deal Lifecycle program
(`2026-07-14-deal-lifecycle-program.md`).
**Dependencies:** none — this phase *gates* Phase 3 and Phase 4.
**Source docs:** `listing-field-audit.md` · `deal-flow-new-model-requirements.md`

---

## Goal

Produce the **canonical field catalog** — the single source of truth for where every field lives and
where/when it surfaces — so Phases 3 and 4 build on decided ground. Mostly a doc + `src/data/types.ts`
changes; minimal UI.

## Deliverable: the field catalog

Walk every field in `listing-field-audit.md` **and** the deal requirements, and classify each into a
home + surface + timing. Catalog columns:

| Field | Home | Surface (record + tab) | Timing | Public-flaggable? | Notes |
|---|---|---|---|---|---|

- **Homes:** `property` · `deal-marketing` · `deal-transaction` · `deal-financials` · `lease-space`.
- **Resolve the flagged ambiguities** from the audit and record the decision + rationale per field:
  - **Occupancy %** — recommend store on Property, snapshot onto the deal at Active so the pitch number
    can move independently without corrupting the source of truth.
  - **Rent Roll** — decide property-level "current rent roll" that deals read from, vs. deal-owned.
  - **Internal / Admin Notes** — decide which record owns them (defaults to deal today by omission).
- **Resolve open questions** from the deal-flow doc that are field-shaped: publish scope (which fields
  carry a public/private flag), Proposal field-set confirmation, Buyer/Seller mirror fields.
- **Flag the lease-space model:** each space already carries its own status ladder in production — the
  real "one property → many deals" case. Document it as the reference for a future
  "one property → many space-deals" phase; do **not** build it here.

## Model changes this phase MAY make

- Reconcile the stale legacy `DataStore` type vs the live `DataSlice` (`src/data/dataStore.ts` — the
  legacy type is missing `dealFiles`/`emails`/`callLists`).
- Add/rename `Property` and `Listing`/deal fields so the catalog's homes are representable, and extend
  the deterministic **seed** (`src/data/seed.ts`, bump `SEED_VERSION`) so new fields have plausible data.
- No new UI surfaces required; changes are type + seed + the catalog doc. Any field newly surfaced on the
  **Property page** (Phase 1) can be folded in opportunistically.

## Verification

Catalog doc reviewed field-by-field with the user; `bun --bun run test` green after type/seed changes;
`reset()` reseeds cleanly with the bumped `SEED_VERSION`.
