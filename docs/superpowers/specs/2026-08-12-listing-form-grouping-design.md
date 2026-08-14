# Listing form: grouping, spacing, and field removal

**Status:** in flight
**Surface:** `/listings/:id/listing` — `ListingEditor` → `ListingFormEditor` → `sections/*`

## Problem

The Listing form renders 14 sections in one flat scroll: 5.2 screens, 87 visible
controls with "Additional Fields" collapsed, ~170 fields expanded on a Sale
listing. It reads as an undifferentiated wall.

Measured causes, not guesses:

1. **The type scale is fully allocated and nearly flat.** 24px deal name / 20px
   page title / 17px section / 14px field label — every one at weight 600. A
   section title is 3px larger than a field label at the same weight, so only a
   small purple icon marks a section break. There is no free step to add a tier.

2. **Cluster spacing equals field spacing.** Sections already chunk their fields
   into multiple `<FieldGrid>` blocks — Building 5, Sale 7, Location 5, Property
   5, ~30 in total. `FieldGrid` is `row g-3` (16px) and consecutive grids are
   separated by the parent's `gap-3` (16px). The authored grouping renders as one
   continuous column. **The groups exist in the code and are not drawn.**

3. **`Show/Hide Additional Fields` is an `<h3>`.** 14 `<h3>`s on the page, 4 of
   them that string, styled 14px/600 — heavier than the section titles it sits
   among and identical to the field labels it sits between.

4. **Uniform column width.** Every field is `col-md-6`. "Zip" is as wide as
   "Location Description"; orphans like "Office Space" leave a dead half-column.

5. **Two switches split the address block.** Hide Address and Override Map
   Location render between State/Zip and County/Market.

6. **Locale fields lead the page.** Country, Measurement System, Currency,
   Currency Format, and Language are the first fields a broker sees, ahead of the
   street address.

## Non-goal: changing the type scale

Rejected during design. Raising sections to 20px collides with the page title
("Listing", 20px), and there is no gap between 17px and 14px to insert a
subsection tier. The scale stays 24/20/17/14. **Hierarchy comes from spacing,
alignment, and field width.**

## Design

### 1. Spacing rhythm

|                   | now  | after |
| ----------------- | ---- | ----- |
| field → field     | 16px | 16px  |
| cluster → cluster | 16px | 40px  |
| group → group     | 48px | 72px  |

Drop every `<Separator />` between groups (13 of them). A rule between each pair
of items tiles the page; it does not group it. The 72px gap does that job.

Scoped under a `.listing-form` class so no other form in the app is affected.

### 2. Field width

Replace uniform `col-md-6` with intrinsic widths. This shortens the page and
chunks it without a single type change — a row of three short numeric fields
reads as a group on its own.

- Address / City / State / Zip on one row, not two.
- Latitude / Longitude, Year Built / Year Renovated: narrow pairs.
- Grade Level Doors / Dock High Doors / Drive-in Bays / Cranes: 4-up.
- Tax Value Land / Improvements / Personal: 3-up.
- Descriptions and textareas: full width.
- No orphan in a half-column beside dead space.

Switches move to the end of their cluster rather than interrupting a grid.

### 3. Group map — 14 sections down to ~5 rendered groups

Two sections are deleted outright (Transit, Visual Media). The remaining 12
collapse into 5 top-level groups, three of which (Units, Lots, Condos) are
conditional and near-exclusive, so a given listing renders about five.

| Group                             | Absorbs                    | Subgroups                                                                        |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| **Location**                      | Location                   | Address · Map · Market · *Additional*                                            |
| **The Asset**                     | Property, Building, Land   | Identity · Size & Age · Structure · Site · Industrial · Systems & Condition · Land† |
| **Units** / **Lots** / **Condos** | Units, Lots, Condos        | own group each, rendered only when applicable                                    |
| **Marketing**                     | Sale/Lease, Visibility, Buyer | Headline · Terms · Auction · Financing & Taxes · Exchange & Ownership · Visibility · Buyer |
| **Disclaimer & Notes**            | Disclaimer & Notes         | —                                                                                |

† Land subgroup renders for land property types only, per `propertyTypeEffects`;
Lots for land types, Condos for Sale, Units for multi-unit.

Locale fields (Country, Measurement System, Currency, Currency Format, Language,
Country Name Override) move into Location → *Additional*.

**Why Units / Lots / Condos are not one "Inventory" group:** they are
near-mutually-exclusive — Lots renders for land types, Condos for Sale, Units for
multi-unit. A wrapper would almost always stand over a single subgroup, and
"Inventory" is vocabulary no other surface uses. Each is its own top-level group
instead; a listing shows one, occasionally two, so the effective group count
stays about five.

### 4. Disclosure

`Show/Hide Additional Fields` stops being an `<h3>`. It becomes a muted ghost
toggle at the end of its group, named for its contents with a count — "Show 14
more building fields" — so it neither impersonates a section title nor reads as a
field label.

### 5. Field removal

Two sections are removed. Each was checked against the type definitions and
every other edit surface in the app:

| Removed                              | Why                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Transit section** (whole file)     | A hardcoded array of 4 fake transit lines, identical on every listing, with no editable state. A read-only fiction in an edit form. |
| **Visual Media section** (whole file) | `Marketing → Media` already owns `marketing.visualMedia` through `VisualMediaGallery`. This section is 3 raw fields on the same array. |

### Two candidate removals, rejected on inspection

Both were proposed during design and withdrawn after reading the types. Recorded
here so they are not re-proposed.

**Lots / Condos: Status, Close Date, Sale Price, Buyer / Referral Source.**
These are per-record fields on `Lot` (`types.ts:66`) and `Condo` (`types.ts:84`),
cited to PRD §13 and §14. Each lot in a subdivision sells individually — its own
status, close date, buyer, and price. They are not duplicates of the deal's
status or sale price, and removing them would gut the lot/condo tables.

**Sale `Commission %` and Lease `Commission Split %`.** Three distinct numbers
exist, not one:

- `marketing.saleCommissionPct` / `marketing.leaseCommissionSplitPct` — the
  co-broke commission *published on the listing*. Edited on this form and
  nowhere else in the app (verified by grep; the only other references are
  `seed.ts` and `createListing.ts`).
- `transaction.commissionPct` / `commissionAmount` — the commission actually
  *transacted*, owned by the Deal editor and the stage gate.
- `DealBroker.commissionSplitPct` — how that gross *splits among brokers*.

The published commission is marketing data on the marketing form. It stays.

Removal is presentational only — no `Listing`, `Property`, or `DealMarketing`
type changes, no `SEED_VERSION` move. The underlying fields stay in the data
model; the form stops offering them. `savePatches.ts` already preserves stored
keys a draft does not carry, so a removed field retains its stored value.

## Constraints preserved

- **Ingestion conflicts.** `NumberField`'s `fieldKey` arbitration rows, the
  `?review=ingestion` scroll-to-first-conflict, and `conflictKeysOn("listing")`
  must keep working. No conflict-carrying field may be removed or moved behind a
  collapsed disclosure without the scroll target still resolving.
- **Draft/re-seed.** `ListingEditor`'s dirty tracking, `useBlocker` guard, and the
  ingestion re-seed effect are untouched. Regrouping is inside
  `ListingFormEditor` and below.
- **`propertyTypeEffects` / `showBuyerSection`** gating carries over to the new
  subgroups unchanged.
- **Space Details** (`SpaceDetails.tsx` → `SpaceTermsSection`) is a different
  surface and is out of scope. `LeaseSection` imports from `SpaceTermsSection`,
  so the Lease commission removal must not break that import.

## Verification

- `bunx tsc --noEmit` clean (`vite build` does not type-check).
- `bun --bun run test` — `savePatches` and `reseedDraft` suites unchanged.
- Playwright: load a Sale listing, a Lease listing, and a land Sale; confirm no
  console errors, every group renders, and `?review=ingestion` still scrolls to
  the first conflict.
