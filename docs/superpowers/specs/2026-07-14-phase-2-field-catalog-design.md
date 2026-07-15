# Phase 2 — Field Catalog & Source-of-Truth Model (Design)

**Status:** Design approved (2026-07-14). Implements the Phase 2 gating spec
(`2026-07-14-phase-2-field-catalog.md`) in the Unified Deal Lifecycle program
(`2026-07-14-deal-lifecycle-program.md`).
**Source docs:** `listing-field-audit.md` · `deal-flow-new-model-requirements.md`
**Gates:** Phase 3 (deal marketing) and Phase 4 (stage-gate workflow).

---

## 1. The organizing principle — the membrane

The **Property record is the single source of truth** for everything true about the physical
asset. A **Deal** (`= Listing`, 1:1) is a thin *engagement* object —
`propertyId + unitId? + contactIds + deal-only data` — that **duplicates zero property facts**.
When marketing or underwriting needs an asset fact (address, size, actual NOI, a unit's shell),
it **reads through the property/contact references**, not a copy on the deal.

**The test applied to every field:** *would this reset, differ, or cease to exist if you closed
this engagement and spun up a fresh one on the same asset?*

- **No** → it's a fact/measurement of the asset over time → **Property** (a record on the asset).
- **Yes** → it's this engagement's pitch, marketing, or transaction → **Deal**.

Two patterns fall out of this and recur throughout the catalog:

- **Actuals vs pro forma.** In-place performance (T-12 NOI, actual income/expense, current
  occupancy, the cap rate on actual NOI) is an **asset fact** → Property. The broker's
  **underwriting for this deal** (projected income, stabilized NOI, the cap rate on the *asking*
  price, named scenarios) is the **pitch** → Deal. They are not duplicates; they are two concepts
  that share a label. The deal **snapshots** the property's actuals at create/Active and may
  **override** them so the pitch moves independently without corrupting the source of truth.
- **Reference, don't copy.** The deal links to a property and to contacts by id. Views compose the
  two via a `selectDealWithProperty` resolver.

---

## 2. Resolved data model

### Property (source of truth — nested by concern)

```
Property
├─ location        // address, geo, market/submarket, county, road/parking context
├─ identity        // type/subtype, name/alias, zoning, lot, APN, amenities, utilities
├─ building        // size, class, floors, year, construction, systems, features
├─ tax             // assessor land/improvement/personal value, assessed value, legal desc.
├─ occupancyPct    // canonical headline fact (source of truth); deal snapshots it
├─ notes           // asset-level internal notes (about the building, across all deals)
├─ units:          PropertyUnit[]            // physical child shells only
│                                            // (condo unit / pad / suite / apartment)
└─ financialRecords: PropertyFinancialRecord[]   // dated actuals attached to the asset
```

- `PropertyUnit` = physical shell only: `{ id, label, unitType, sqft, beds?, baths?, suite?,
  floor?, ceilingHeight?, offices?, furnished? }`. **No lease/tenancy on the unit** (rent roll is
  deal-owned — see §3).
- `PropertyFinancialRecord` = a dated in-place snapshot: `{ id, asOf, source ('T-12 actuals' |
  'Assessor' | 'Owner-provided'), pgi, vacancyRate, egi, operatingExpenses, noi, capRate, grm,
  cashOnCashReturn, occupancyPct }`. Property **keeps its flat current-headline actuals**
  (`noi`, `capRate`, `vacancyRate`, `grm`, … — `types.ts` 125–134) as the current view;
  `financialRecords[]` **adds dated history**, with the **latest record mirroring the flat
  values**. (Amended 2026-07-14 from "migrate flat block into records": the document editor binds
  dynamic fields to flat Property keys by name — `dynamic.ts:34`, `presets.ts` `dynamicKey` —
  so keeping the flat fields avoids churning ~5 editor files, and mirrors the `occupancyPct`
  pattern, which is likewise flat-current + carried in each record.)

### Deal / Listing (engagement-only — nested by home)

```
Deal (= Listing, 1:1)
├─ propertyId      // the only link to asset facts
├─ unitId?         // optional — scopes the deal to one unit; dealType labels it
├─ contactIds      // sellerContactIds / buyerContactIds / otherContactIds
├─ dealType        // Sale | Lease | Sale / Lease  — also labels a scoped unit
├─ dealSide        // buyer | seller
├─ status          // its own 5-stage ladder (a Listing IS its deal)
├─ marketing:   DealMarketing
│     titles, descriptions, bullets, closing info, propertyUse, investmentType,
│     sale terms, lease terms, marketing channel + visibility tier,
│     per-item `public` flags, occupancy snapshot override
├─ financials:  DealPitchFinancials              // Proposal-era pro forma
│     income/expense line items, GSI/EGI, NOI, capRate, GRM, cash-on-cash,
│     named reorderable scenarios[], + rentRoll: RentRollRow[]
├─ transaction: DealTransaction                  // Under Contract → Close
│     buyer/seller refs, critical dates, transacted salePrice, pricePerSqFt,
│     commission % / $, backOffice { voucher, receivables, deductions, broker earnings }
└─ internalNotes   // engagement-level notes (about this pitch/transaction)
```

- **Denormalized property fields are removed** from `Listing`: `street, city, state, zip, lat, lng,
  propertyType, propertySubtype, location, propertyTypeLabel`. Views resolve them through
  `selectDealWithProperty(dealId) → { deal, property, unit? }`.
- `RentRollRow` = `{ unitId?, tenant, actualRent, marketRent, rentPerSf, securityDeposit,
  leaseStart, leaseEnd }`. **Stored on the deal** (matches production — the rent roll is presented
  in the listing); rows may reference a `Property.unit` for the physical shell.
- **"One property → many deals"** needs no special structure: each unit-engagement is its own deal
  scoped via `unitId`, and each deal already owns its own status ladder. The independent per-space
  statuses the audit observed are simply separate deals. Type + seed for units are added this phase;
  **no** multi-deal-per-unit workflow UI is built.

---

## 3. Ambiguity decisions (with rationale)

| Field / group | Decision | Rationale |
|---|---|---|
| **Occupancy %** | Canonical on **Property** (`occupancyPct`); deal-marketing carries an optional **snapshot override** | Physical fact of the building today, but a headline pitch number. Snapshot lets the pitch move without corrupting source of truth. |
| **In-place financials** (NOI, cap rate, income/expense, GRM, vacancy) | **Property** — flat current-headline actuals (kept) + dated `financialRecords[]` history (latest mirrors flat) | True about the asset over time, independent of marketing. Flat kept so the editor's flat-key dynamic fields keep resolving (see §2). |
| **Pro forma financials** (projected income, stabilized NOI, cap on asking, scenarios) | **Deal** (`financials`) | The broker's underwriting for *this* deal; resets per engagement. Snapshots + overrides property actuals. |
| **Back-office** (voucher, receivables, deductions, broker earnings) | **Deal** (`transaction.backOffice`), separate from pitch | Different lifecycle phase (Close) than the pitch (Proposal); keeping them apart keeps Timing legible. |
| **Rent Roll** | **Deal** (`financials.rentRoll`), rows referencing `Property.units` | Presented in the listing (production reality); curated per engagement. Physical shell stays on the unit. |
| **Internal / Admin Notes** | **Both** — `Property.notes` (asset) + `Deal.internalNotes` (engagement) | They serve different purposes under the membrane. |
| **Buyer / Seller** | **Deal** (`transaction`) as contact **references** | Mirror parties: Seller captured at Proposal, Buyer at Under Contract. |
| **Publish scope** | Per-item **`public` flag** on marketing items; Active publishes the flagged set | Reuses the existing listing visibility model; Phase 3 wires the flags, Phase 4 the publish gate. |
| **Sale Price "appears twice"** | Asking/pitch price → deal marketing/financials; **transacted** price → `transaction.salePrice` | Resolves the audit's flagged duplication (and the live `capRate`/`askingPrice` dup in `types.ts`). |
| **Units / lease spaces** | Generic **`PropertyUnit`** children of Property (not lease-only) | Generalizes to condo-unit sales, pads, apartments; a deal scopes to a unit and `dealType` labels it. |

### Duplicates removed from the current model
- `capRate` — currently on both `Property` (131, actual) and `Listing` (160, pitch). → **actual stays on Property** (flat current + records); pitch moves to `deal.financials`, **removed from `Listing`**.
- `askingPrice` — on both `Property` (84) and `Listing` (158). → asset target/list **stays on Property**; this deal's asking/pitch moves to `deal.financials`, **removed from `Listing`**.

The de-duplication is **Deal-side only**: Property keeps its financial fields; the `Listing` copies are what get removed/relocated into the nested deal homes.

---

## 4. The catalog

Columns: **Field** · **Home** · **Surface (record + tab)** · **Timing** · **Public-flaggable?** · **Notes**.
Homes: `property` · `property-unit` · `deal` (setup/status/notes) · `deal-marketing` · `deal-transaction`
· `deal-financials`. Timing values map to lifecycle stages (`Proposal · Active · Under Contract · Close`)
or `durable` (true regardless of stage). "Surface" names the record page + tab where the field is
edited/shown; `—` means not surfaced this phase (data-model only until P3/P4).

> **Deviation from the phase-2 spec's home list, on purpose:** the spec named a `lease-space` home.
> This design realizes it as **`property-unit`** (the physical shell, source of truth on Property) plus
> **`deal-marketing`** (the per-unit lease *terms*, which reset per engagement). Units are generic —
> condo unit / pad / suite / apartment — not lease-only. See §3.

### 4.1 Property — Location (`durable`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Address, Zip, City, State | property | Property · Overview | durable | yes | Denormalized off deal; read via resolver. |
| Lat/Long (+ override) | property | Property · Overview (map) | durable | no | |
| County, Market, Submarket | property | Property · Overview | durable | yes | |
| Cross Streets, Location Description | property | Property · Overview | durable | yes | Location Description feeds marketing copy. |
| Township, Range, Section | property | Property · Details | durable | no | Legal/PLSS descriptors. |
| Side of Street, Street Parking, Signal Intersection | property | Property · Details | durable | yes | Retail siting context. |
| Road Type, Market Type, Nearest Highway, Nearest Airport | property | Property · Details | durable | yes | |

### 4.2 Property — Identity (`durable`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Primary Property Type, Additional Property Type(s) | property | Property · Overview | durable | yes | Drives deal labeling + comps. |
| Property Name, Alias | property | Property · Overview | durable | yes | |
| Zoning | property | Property · Details | durable | yes | |
| Lot Size, Lot Frontage, Lot Depth, Corner Property | property | Property · Details | durable | yes | |
| APN# | property | Property · Details | durable | no | |
| Traffic Count (+ Street, + Frontage) | property | Property · Details | durable | yes | |
| Site Description, Amenities | property | Property · Details | durable | yes | Feeds marketing copy. |
| Waterfront | property | Property · Details | durable | yes | |
| MLS ID# | property | Property · Details | durable | no | |
| Power (+ Description), Gas/Propane (+ Description) | property | Property · Details | durable | yes | Utilities availability. |

### 4.3 Property — Building (`durable`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Building Size, Gross Leasable Area, Load Factor | property | Property · Overview | durable | yes | |
| Tenancy (single/multi) | property | Property · Overview | durable | yes | |
| Ceiling Height, Min Ceiling Height | property | Property · Details | durable | yes | Building-level; unit may override. |
| # Floors, Avg Floor Size, # Buildings | property | Property · Details | durable | yes | |
| Year Built, Year Renovated | property | Property · Overview | durable | yes | |
| Construction Status, Construction Description, Framing, Condition | property | Property · Details | durable | yes | |
| Parking Ratio, # Parking Spaces (building), Parking Type, Parking Description | property | Property · Details | durable | yes | Building-level; distinct from unit parking. |
| Central HVAC, HVAC, Broadband, Roof, Foundation | property | Property · Details | durable | yes | |
| Security Guard, Handicap Access, Freight Elevator, # Elevators, # Escalators | property | Property · Details | durable | yes | |
| Free Standing, LEED Certified, Mezzanine, Office Buildout | property | Property · Details | durable | yes | |
| Laundry/Plumbing/Exterior/Interior Description | property | Property · Details | durable | yes | |
| Walls, Ceilings, Floor Coverings, Restrooms, Landscaping, Corridors, Exterior Walls | property | Property · Details | durable | yes | |
| Utilities Description, Loading Description | property | Property · Details | durable | yes | |

### 4.4 Property — Units (physical shell) (`durable`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Number of Units | property | Property · Units | durable | yes | Derived from `units.length`. |
| Unit label, unit type | property-unit | Property · Units | durable | yes | `dealType` labels a unit when a deal scopes to it. |
| Beds, Baths, Size (SF) per unit | property-unit | Property · Units | durable | yes | Residential shell. |
| Suite, Floor, Ceiling Height, # Offices, # Conference Rooms, Furnished | property-unit | Property · Units | durable | yes | Commercial shell. Overrides building ceiling height. |

### 4.5 Property — County / Tax (`durable`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Tax Value Land, Improvements, Personal Property | property | Property · Tax | durable | no | Off the county record, not the deal. |
| Assessed Value, Assessed Year, Tax Amount, Tax Year | property | Property · Tax | durable | no | |
| Land Ownership, Land Legal Description | property | Property · Tax | durable | no | |

### 4.6 Property — In-place financials (dated actuals) (`durable`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| PGI, Vacancy %, EGI, Operating Expenses | property | Property · Financials (actuals) | durable | no | Flat current + mirrored in dated `financialRecords[]`. |
| NOI, Cap Rate, GRM, Cash-on-Cash | property | Property · Financials (actuals) | durable | no | Flat current (kept) + history in `financialRecords[]`; deal pro forma snapshots these. |
| Occupancy % | property | Property · Overview | durable | yes | Canonical headline; deal snapshots it. |
| asOf, source (per record) | property | Property · Financials | durable | no | Latest record = current source of truth. |

### 4.7 Deal — Setup & status

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Lease / Sale checkboxes → `dealType` | deal | Deal · Overview | Proposal | no | Both can be on (Sale / Lease). |
| Status ladder (Proposal · Active · Under Contract · Closed · Inactive) | deal | Deal · Overview | all | no | Per deal; replaces per-side/per-space ladders (now separate deals). |
| Primary Broker, additional brokers, split % | deal | Deal · Overview | Proposal | no | Deal-level assignment. |
| Listed On / Listing Expiration (Lease + Sale) | deal-transaction | Deal · Overview | Active | no | Captured at the approve-and-publish gate (P4). |

### 4.8 Deal — Marketing (`Proposal` → surfaced live at `Active`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Sale/Lease Title, Description, Bullets, Closing Info | deal-marketing | Deal · Marketing | Proposal | yes | Generated from property + contact refs (P3). |
| Property Use (Net Leased Investment / Investment / Owner-User / Business for Sale / Development) | deal-marketing | Deal · Marketing | Proposal | yes | |
| Investment Type (Core / Core Plus / Value Add / Opportunistic / Distressed) | deal-marketing | Deal · Marketing | Proposal | yes | |
| Includes Real Estate, Commission %, Auction | deal-marketing | Deal · Marketing | Proposal | yes | |
| Sale Terms, Reimbursement, Capital Costs, Loan Due, Loan Description, 1031 Exchange | deal-marketing | Deal · Marketing | Proposal | yes | |
| Marketing Channel + Visibility Tier (Fully Private → Fully Public) | deal-marketing | Deal · Marketing | Active | n/a | Drives the per-item publish gate. |
| Per-item `public` flag | deal-marketing | Deal · Marketing | Active | n/a | P3 wires; P4 publishes flagged set. |
| Occupancy snapshot override | deal-marketing | Deal · Marketing | Active | yes | Snapshot of `Property.occupancyPct`. |
| Lease Title, Description, Closing Info, Bullets, Commission Split % | deal-marketing | Deal · Marketing | Proposal | yes | Lease-side, above the unit. |
| **Lease terms per unit** (Lease Rate/Units/Override, Hide Rate, Flat/Range, Lease Type, Term, Sublease, Date Available, Min Divisible, Max Contiguous, TI Allowance, Free Rent, Signage, Escalators, Concession, Moving/Buyout Allowance, Net Lease Investment, Tax/SF, Tax Stops, Expenses, Expense Stops, CAM/SF, CAM Stops, Insurance/SF, % Procurement Fee, Tenants Pay Gas/Electric/Water, Sublease Allowed, Lease Terms text) | deal-marketing | Deal · Marketing | Proposal | yes | Terms for transacting a unit — reset per engagement. Reference `unitId` for the shell. |

### 4.9 Deal — Pitch financials (`Proposal`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Sale Price, Sale Price Units, Hide Price toggle, Display Financial Fields on Plugin | deal-financials | Deal · Financials | Proposal | yes | Asking/pitch price (distinct from transacted). |
| Income breakdown (line items + total), GSI, Other Income, Total Scheduled Income | deal-financials | Deal · Financials | Proposal | yes | Pro forma. |
| Vacancy %, Vacancy Cost, Gross Income | deal-financials | Deal · Financials | Proposal | yes | |
| Expense breakdown (line items + total), Operating Expenses | deal-financials | Deal · Financials | Proposal | yes | |
| NOI, Cap Rate | deal-financials | Deal · Financials | Proposal | yes | On asking price; snapshots property actuals. |
| Loan Amount, Down Payment, Debt Service, Cash Flow, Principal Reduction, Total Return, DCR, GRM, Cash-on-Cash | deal-financials | Deal · Financials | Proposal | yes | |
| Named reorderable scenarios (Worst/Best Case) | deal-financials | Deal · Financials | Proposal | yes | |
| Rent Roll (rows: unit ref, tenant, actual/market rent, rent/SF, deposit, lease start/end) | deal-financials | Deal · Financials | Proposal | partial | Stored on deal; rows reference `Property.units`. |

### 4.10 Deal — Transaction & back-office (`Under Contract` → `Close`)

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Seller (contact ref) | deal-transaction | Deal · Overview | Proposal | no | Required at Proposal→Active gate. |
| Buyer (contact ref) | deal-transaction | Deal · Overview | Under Contract | no | Required entering Under Contract. |
| Critical Dates: Contract Executed, Close Date | deal-transaction | Deal · Overview | Under Contract / Close | no | |
| Transacted Sale Price, Price/SF | deal-transaction | Deal · Overview | Under Contract | no | The real number (vs pitch asking). |
| Gross Commission % / $ | deal-transaction | Deal · Financials | Under Contract | no | |
| Dead Reason (+ Close Date) | deal-transaction | Deal · Overview | Dead | no | Dead reachable from any stage. |
| Back-office: Voucher, Receivables, Deductions, Broker Earnings | deal-transaction | Deal · Back Office | Close | no | `transaction.backOffice`; partly present today. |

### 4.11 Notes

| Field | Home | Surface | Timing | Public? | Notes |
|---|---|---|---|---|---|
| Asset notes | property | Property · Overview | durable | no | About the building, across all deals. |
| Engagement notes | deal | Deal · Overview | all | no | About this pitch/transaction. |

---

## 5. Model & code changes this phase makes

1. **`src/data/types.ts`** — full 1:1 mirror of the catalog:
   - `Property` changes are **purely additive** (flat fields untouched): add `occupancyPct`, `notes`,
     `units: PropertyUnit[]`, `financialRecords: PropertyFinancialRecord[]`; new `PropertyUnit`,
     `PropertyFinancialRecord`.
   - Restructure `Listing` into `marketing: DealMarketing`, `financials: DealPitchFinancials`
     (+ `RentRollRow[]`, scenarios), `transaction: DealTransaction` (+ `backOffice`). Keep
     `propertyId`, add `unitId?` and `internalNotes`. **Remove** the 10 denormalized property fields
     and relocate the moved scalars into their nested homes.
   - Distinguish the existing back-office `DealFinancials` (→ folded under `transaction.backOffice`)
     from the new `DealPitchFinancials`.
   - **No Property-CRE migration** and **no Group-6 consumer churn** (editor, `EditListingDialog`,
     `PropertyFactsCard`, `ai/tools`, `lib/properties` keep reading flat `property.noi`/`capRate`/…).
2. **Reconcile `DataStore` → `DataSlice`** — the stale legacy type (`types.ts:410`) is missing
   `dealFiles`/`emails`/`callLists`; its only consumer is `getStore()` in `src/data/store.ts:23`.
   Replace with `DataSlice` (or alias) and delete the stale type.
3. **`selectDealWithProperty(dealId) → { deal, property, unit? }`** resolver in `src/data/selectors.ts`;
   **migrate the ~10 consumers** that read denormalized property facts off a listing/deal:
   `EditListingDialog`, `ListingDemographics`, `ListingEmail`, `DealOverview`, `DealCard`,
   `DealContextRail`, `YourListingsSection`, `PropertyDetailHeader`, `PropertyCard`,
   `listingWebsiteSettings`.
4. **`src/data/seed.ts`** — plausible data for every new field (units, financial records, pro forma,
   scenarios, rent-roll rows, marketing terms, notes); **bump `SEED_VERSION` 4 → 5**
   (`src/data/persistence.ts:5`).
5. **No new UI surfaces.** Any newly-surfaced field on the Phase 1 Property page is folded in
   opportunistically; everything else is data-model-only until P3/P4.

---

## 6. Verification

- Catalog (§4) reviewed **field-by-field** with the user.
- `bun --bun run test` green after type/seed/selector changes (update existing tests for the nested
  shape + resolver).
- `reset()` reseeds cleanly under `SEED_VERSION = 5`; a snapshot written under v4 is ignored.
- No consumer still reads a denormalized property fact off a deal (grep clean).

---

## 7. Out of scope (deferred)

- **Multi-deal-per-unit workflow UI** — the "one property → many space-deals" case. Type + seed for
  units land now; the workflow is a future phase.
- **Rent-roll presentation / market-rent pitch layer** — the curated OM rent roll is Phase 3.
- **Marketing publish gate & AI-doc review** — Phase 4.
- **Property-record editing** — the Property page is read-first (Phase 1); editing later.
