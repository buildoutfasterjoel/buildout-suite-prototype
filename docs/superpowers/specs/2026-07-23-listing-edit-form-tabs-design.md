# Listing Edit Form — Deal + Listing Tabs

> Design spec. Restructures the deal/listing edit form (`src/routes/_shell/listings/$listingId/edit.tsx` → `DealMarketingEditor`) into two tabs — **Deal** and **Listing** — and builds a comprehensive listing-form field set into the Listing tab, capturing everything a user can fill out today per the Buildout listing form. Source material: `docs/superpowers/specs/property-listing-form-prd-reference.md`.

## Goals

- Split the single edit form into two tabs: **Deal** (money + deal management) and **Listing** (the full property/marketing listing form).
- Capture **all** listing-form fields from the PRD reference so the data is in place, respecting the conditional show/hide rules that apply in the prototype.
- Keep one shared working-copy + one Save/Cancel bar across both tabs.

## Non-goals (this session)

- **No changes to the Create Deal modal.** Deal Type (Sale/Lease) is decided there; the edit form treats it as fixed.
- **No left-hand section navigation.** The Listing tab is a long single-page form for now; navigation improvements are a later session.
- No new store plumbing — `updateDeal`, `updateDealMarketing`, and `updateProperty` already exist and cover persistence.

## Prototype simplifications (approved)

1. **Company entitlements assumed standard** — Database, Branding, Custom Fields, syndication entitlement all treated as available; **streamlined-sync mode is off** (full form always). No company-settings toggles.
2. **Currency / Measurement** — Country/Currency/Measurement selectors render as fields, but live relabeling of every currency/length field across the form is **deferred**.
3. **Transit** — a static "nearby lines" checklist, not a live lookup.
4. **On-Market Disclaimer** — inline Disclaimer & Notes fields only; the enforced sign-off modal is skipped.
5. **Outside-broker invite / Address Correction / Pending Invites** — skipped (broker assignment lives on the Deal tab).

---

## Page structure

`DealMarketingEditor` becomes a two-tab shell:

- Local `tab` state (`"deal" | "listing"`), using the `Tabs` / `Tabs.List` / `Tabs.Tab` pattern from `src/routes/_shell/email/index.tsx`. Panels render conditionally on `tab` (that codebase renders content outside `<Tabs>` keyed off state — follow it).
- **One working-copy of state** for the whole form (status, dealType, brokers, transaction, financials, marketing, plus a property working-copy). Both tabs read/write the same state object.
- **One Save/Cancel bar**, shown at top and bottom regardless of active tab. Save commits listing/marketing fields via `updateDeal` and property facts via `updateProperty` in one action, then navigates back to the overview. Cancel discards.
- Deal Type is displayed **read-only** on the Deal tab (a labeled static value, not a `Select`).

The header title changes from "Edit Deal" to a neutral "Edit Listing" (the page now spans both).

---

## Tab responsibilities

### Deal tab (money + deal management)
Essentially today's editor minus the marketing/per-space sections:

- **Setup & Status** — Deal Type (read-only), Status, Listed On / Listing Expiration dates. (Marketing Channel + Visibility move to the Listing tab's Marketing Visibility sections.)
- **Brokers** — internal + outside broker editors (unchanged).
- **Transaction Terms** — sale price, gross commission %/$ (bi-directional math preserved), close probability, contract executed / close dates.
- **Financials** — today's Sale Financials section, expanded toward PRD §15: named statements with Scheduled Income, Expenses, Returns, and Financing. See "Financials (Deal tab)" below.

### Listing tab (the full listing form)
Everything else from PRD Part 2, in this order (single page, `Section` per group, "Additional Fields" as collapsible `Accordion` blocks):

Location · Transit · Property · Building · Units (Number of Units, Unit Mix, Rent Roll) · Land · Sale Marketing & Terms · Lots · Condos · Lease Marketing & Terms · Lease Spaces · Sale Marketing Visibility · Lease Marketing Visibility · Buyer (Under Contract) · Visual Media · Disclaimer & Notes.

Sale-only sections render only when `dealType === "Sale"`; Lease-only sections only when `dealType === "Lease"`.

---

## Data model changes (`src/data/types.ts`)

All new fields are optional/nullable so existing seeded records and persisted snapshots keep loading. Defaults are supplied by the working-copy initializer in the editor (tolerating older snapshots, same pattern as `marketing.spaceLeaseTerms ?? []`).

### Additions to `Property` (property facts — Location / Property / Building / Land)

- **Location:** `country`, `countryNameOverride`, `currency`, `currencyFormat`, `language`, `measurementSystem` (`'Imperial' | 'Metric'`), `hideAddress` (bool) + `displayAddressAs`, `overrideMapLocation` (bool), `market`, `crossStreets`. Additional-fields block: `township`, `range`, `section`, `sideOfStreet`, `streetParking` (`Y/N/NA`), `signalIntersection` (`Y/N/NA`), `roadType`, `marketType`, `nearestHighway`, `nearestAirport`. (`street/city/state/zip/county/submarket/lat/lng/zoning/legalDescription` already exist.)
- **Property:** `propertyTypeLabelOverride`, `additionalPropertyTypes` (`{type, subtype}[]`), `aliases` (`string[]`), `lotSizeUnit`. Additional-fields block: `lotFrontage`, `lotDepth`, `cornerProperty` (bool), `trafficCount`, `siteDescription`, `amenities`, `waterfront` (bool), `mlsId`, `thomasGuidePage`, `powerDescription`, `railAccess` (bool), `gasPropaneDescription`. (`name/zoning/apn/lotSqFt` exist.)
- **Building:** `avgFloorSize`, `ceilingHeight`, `minCeilingHeight`, `officeSpaceSqFt`, `tenancy` (`'Single' | 'Multiple'`). Industrial cluster: `gradeLevelDoors`, `dockHighDoors`, `driveInBays`, `numberOfCranes`, `dockDescription`, `craneDescription`, `sprinklerDescription`. Additional-fields block (a curated, representative subset of PRD §9's ~40 fields — see note): `overheadDoorHeight`, `columnSpace`, `grossLeasableArea`, `loadFactor`, `constructionStatus`, `parkingRatio`, `parkingType`, `warehousePct`, `condition`, `freightElevator` (bool), `numberOfElevators`, `centralHvac` (bool), `roof`, `freeStanding` (bool), `leedCertified` (bool), `retailClientele`, `constructionDescription`, `parkingDescription`, `utilitiesDescription`, `loadingDescription`. (`buildingSqFt/occupancyPct/yearBuilt/yearRenovated/stories/buildingClass/parkingSpaces` exist.)
- **Land:** `numberOfLots`, `bestUse`. Additional-fields block: `irrigation`/`water`/`telephone`/`cable` (each `Y/N/NA` + description), `sewer` (`Y/N/NA`), `environmentalIssues`, `topography`, `soilType`, `easementsDescription`.
- **New repeatable arrays on `Property`:** `lots: Lot[]`, `condos: Condo[]`, `unitMix: UnitMixRow[]`.

> Note on the Building "Additional Fields" block: PRD §9 lists ~40 rarely-used fields. We implement the representative subset above (the commonly-populated ones); the remainder are out of scope for this pass and can be appended later without structural change. Flag if the full 40 are required.

### Additions to `DealMarketing` (listing/marketing content)

- **Location:** `displayLocationDescriptionForSyndication` (bool). (`locationDescription` exists.)
- **Sale:** `yearsLeftOnLease`, `nnnLeaseExpiration` (date), `saleCommissionPct`, `auctionDate`/`auctionTime`/`auctionLocation`/`auctionStartingBid`/`auctionUrl`, `taxPerUnit`, and an additional-fields block: `capitalCosts`, `loanDueDate`, `loanDescription`, `taxes`, `taxValueLand`/`taxValueImprovements`/`taxValuePersonal`, `assessedValue`, `exchange1031` (`Y/N/NA`), `considerExchange` (`Y/N/NA`), `landOwnership`, `landLegalDescription`. (`saleTitle/saleDescription/saleBullets/saleClosingInfo/propertyUse/investmentType/includesRealEstate/auction/saleTerms/reimbursement` exist.)
- **Lease:** `leaseClosingInformation`, `availableSfTerm` (`'SF' | 'RSF'`). (`leaseTitle/leaseDescription/leaseBullets/leaseCommissionSplitPct` exist.)
- **Marketing Visibility:** split the single `marketingChannel`/`visibilityTier` into sale + lease context via `saleMarketingChannel`, `leaseMarketingChannel`, and `hideFromNonListingBrokers` (bool). Keep the existing `marketingChannel`/`visibilityTier` for back-compat mirroring (Save writes the active track's channel into them). Channel availability is computed from Deal Status.
- **Units:** `includeUnitMix` (bool), `syndicateUnitMix` (bool), `includeRentRoll` (bool), `syndicateRentRoll` (bool). (`spaceLeaseTerms`, `availableSqFt` exist; `rentRoll` lives on `financials`.)
- **Buyer:** `buyerContactId` (string | null), `referralSource`. (Shown only at status = Under Contract; buyer contact can also use the existing `buyerContactIds`.)
- **Visual Media:** `visualMedia: VisualMediaLink[]`.
- **Disclaimer & Notes:** `overrideDisclaimer` (bool), `customDisclaimer`, `adminNotes`, `externalId`. (`internalNotes` exists on `Listing`.)

### New types

```ts
type YesNoNA = 'Y' | 'N' | 'NA'

interface Lot {
  id: string
  status: PropertyStatus
  closeDate: string | null
  buyerReferralSource: string | null
  lotNumber: string
  address: string
  apn: string
  subtype: PropertySubtype | null
  salePrice: number | null
  priceUnits: 'Total' | 'SF' | 'SqM' | 'Acre' | 'Hectare'
  size: number | null
  sizeUnits: string
  description: string
  zoning: string
}

interface Condo {
  id: string
  status: PropertyStatus
  closeDate: string | null
  addressUnit: string          // "Address 2" / unit identifier
  salePrice: number | null
  priceUnits: 'Total' | 'SF' | 'SqM'   // no Acre/Hectare for condos
  hidePrice: boolean
  hidePriceLabel: string | null
  size: number | null
  sizeUnits: 'Sq Ft' | 'Sq Meters'
  description: string
}

interface UnitMixRow {
  id: string
  unitType: string             // relabeled "Room Type" for Hospitality
  bedrooms: number | null
  bathrooms: number | null
  count: number | null
  size: number | null
  rackRate: number | null      // Hospitality
  rent: number | null
  minRent: number | null
  maxRent: number | null
  marketRent: number | null
  securityDeposit: number | null
  description: string
}

interface VisualMediaLink {
  id: string
  url: string
  mediaType:
    | 'Interactive Site Plan' | 'Aerial 360 Map' | 'Aerial 360 Rendering'
    | '360 Rendering' | 'Property Marketing Video' | 'Matterport Tour' | '360 Tour'
}
```

### Expansions to existing sub-types

- **`SpaceLeaseTerms`** (PRD §17 — most field-heavy sub-form) gains: `status` (`Active/Under Contract/Closed/Inactive`), `closeDate`, `spaceType` (subtype) + `spaceTypeLabelOverride`, `tenantName`, `majorTenant` (bool, requires `tenantName`), `spaceName`/`suite`/`floor`/`zipPlus4`, `leaseRateMode` (`'Flat' | 'Range' | 'Hidden'`) + `leaseRateTo` (range upper), `leaseRateUnitLabelOverride`, `spaceSize` + `spaceSizeUnits`, `leaseTypeLabelOverride`, `subleaseExpiration`, `ceilingHeight`, industrial cluster (`previousUsage`, `officeSpace`, `gradeLevelDoors`, `dockHighDoors`, `driveInBays`, `numberOfCranes`, `powerDescription`), and additional-fields block (`salePrice`, `warehouseAllotmentPct`, `parkingSpaces`, `conferenceRooms`, `offices`, `furnished`, `heating`/`cooling`/`lighting` (each `Y/N/NA` + description), `hvacTonnage`, `rentConcession`, `leaseTerms`). Existing fields are retained.
- **`RentRollRow`** gains: `suite`, `type` (property-type of the row), `beds`/`baths` (Multifamily), `sizePct` (calculated), `rentPerSf`, `annualRent` (calculated), plus the per-row expandable panel fields `rentEscalations` (`{date, ratePerSf}[]`), `comments`, `recoveryType`. Auto-fill rule: given any two of {size, $/area/yr, annual rent}, compute the third.

---

## Listing tab — section-by-section field inventory & conditionals

Field types map to the existing wrappers in `DealMarketingEditor` (`TextField`, `NumberField`, `DateField`, `SelectField`, `SwitchRow`, `BulletsField`, `FieldGrid`/`Col`). Repeatable cards reuse the reorder/remove pattern from `ScenarioEditor`/`BrokerEditor`.

### Location
Country, Country Name Override (visible only for non-standard/international country), Currency / Currency Format / Language (international only), Measurement System (selector only; relabeling deferred), Address (autocomplete not required — plain text), City, State/Province, Zip (State/Zip presence & labels keyed off Country), Hide Address → reveals Display Address As, Override Map Location → reveals Latitude/Longitude, County (country-dependent) / Market / Submarket / Cross Streets, Location Description (textarea), Display Location Description for Syndication. **Additional Fields** (collapsible): Township, Range, Section, Side of Street, Street Parking (Y/N/NA), Signal Intersection (Y/N/NA), Road Type, Market Type, Nearest Highway, Nearest Airport.

### Transit
Static checklist of representative nearby lines (prototype constant); no field state.

### Property
Primary Property Type (drives cascades below), "Override label" link → Property Type Label Override, Primary Property Subtype (filtered to type), Additional Property Type(s) (repeatable type+subtype rows), Property Name / Zoning / APN#, Alias(es) (repeatable text), Lot Size + unit (auto-required when land-like: Land type / Mobile Home Park / Retail Pad subtype). **Additional Fields** (collapsible): Lot Frontage, Lot Depth, Corner Property, Traffic Count, Site Description, Amenities, Waterfront, MLS ID#, Thomas Guide Page #, Power Description, Rail Access, Gas/Propane Description.

### Building
Building Size, Occupancy %, Year Built, Year Last Renovated, Number of Floors, Average Floor Size, Ceiling Height, Minimum Ceiling Height, Office Space (industrial), Building Class (A/B/C; **A+** offered only for eligible countries), Tenancy (Single/Multiple — drives Lease Spaces address-required rule). Industrial cluster (shown when property type = Industrial): Grade Level Doors, Dock High Doors (always in cluster), Drive-in Bays, Number of Cranes, Dock/Crane/Sprinkler descriptions. **Additional Fields** (collapsible): the representative subset listed in the data-model note.

### Units
Number of Units (required when Multifamily). Include Unit Mix → reveals Unit Mix table + Syndicate Unit Mix toggle (Unit Mix hidden entirely for Land). Include Rent Roll (hidden for Hospitality) → reveals Rent Roll table + Syndicate Rent Roll toggle.
- **Unit Mix columns by type:** Multifamily → Bedrooms/Bathrooms/Count/Size/Rent/Min-Max-Market Rent/Security Deposit; Hospitality → Room Type (relabel)/Count/Size/Rack Rate/Description; all others → Unit Type/Count/Size/$per-area/Annual Rent. % of Total + calculated columns shown as computed.
- **Rent Roll columns:** Suite (→ "Unit" if exclusively Multifamily), Type (only if >1 property type), Beds/Baths (Multifamily only), Tenant (hidden if exclusively Multifamily), Size, %-of-Building (calc), $/area/yr, Rent, Market Rent, Rent/area (calc), Annual Rent (calc), Security Deposit, Lease Start/End. Annual/Monthly display toggle in header. Per-row expand: Rent Escalations, Comments, Recovery Type.

### Land *(shown when property type = Land)*
Number of Lots, Best Use. **Additional Fields** (collapsible): Irrigation/Water/Telephone/Cable (each Y/N/NA + description), Sewer (Y/N/NA), Environmental Issues, Topography, Soil Type, Easements Description.

### Sale Marketing & Terms *(dealType = Sale)*
Sale Title, Sale Description, Sale Bullets, Property Use, Investment Type (required when Buyer Network on or pushing to syndication), Sale Terms, Reimbursement, Sale Closing Info, Includes Real Estate, Years Left on Lease (NNN) + NNN Lease Expiration, Commission % (confirm prompt >10%), Auction → reveals Auction Date/Time/Location/Starting Bid/URL, Tax per Unit. **Additional Fields** (collapsible): Sale Terms extras, Capital Costs, Loan Due Date, Loan Description, Taxes, Tax Value (Land/Improvements/Personal), Assessed Value, 1031 Exchange (Y/N/NA), Consider Exchange (Y/N/NA), Land Ownership, Land Legal Description.

### Lots *(always present; land-style subdivision breakdown)*
Repeatable cards: Deal Status chips, Close Date + Buyer/Referral (shown when status = Closed), Lot Number, Address, APN, Subtype, Sale Price + Price Units (Total/SF/SqM/Acre/Hectare), Size + Units, Description, Zoning. Add / reorder / duplicate / remove.

### Condos *(entitlement assumed on)*
Repeatable cards: Deal Status chips, Close Date, Address 2 (unit id), Sale Price + Price Units (Total/SF/SqM), Hide Price → label override, Size + Units, Description. Same add/reorder/duplicate/remove.

### Lease Marketing & Terms *(dealType = Lease)*
Lease Title, Lease Closing Information, Lease Description, Lease Bullets, Commission Split %, Available SF Term (SF/RSF).

### Lease Spaces *(dealType = Lease; one card per Property unit)*
Expanded `UnitLeaseCard` using the enriched `SpaceLeaseTerms`. Base fields (existing) plus: Deal Status chips + Close Date, Space Type + label override, Tenant Name (required if Major Tenant), Major Tenant, Space Name/Suite/Floor/Zip+4, Lease Rate Units + label override, Lease Rate mode Flat/Range/Hidden (Range adds "to"; Hidden adds label override), Space Size + Units, Lease Type + label override, Sublease → Sublease Expiration, Ceiling Height. Industrial cluster (property = Industrial): Previous Usage, Office Space, Grade Level/Dock High Doors, Drive-In Bays, Cranes, Power Description. **Additional Fields** (collapsible): the extended block on `SpaceLeaseTerms`. Rule: if Tenancy ≠ Single, Address/Suite required per space.

### Sale Marketing Visibility *(dealType = Sale)*
Channel cards: None / Buildout Buyer Network / My Brokerage Website / Buildout Syndication Network. Availability by Deal Status: Active → all four; Under Contract → all but Syndication; Inactive/Proposal → None only; Closed → None only. Buyer Network ⇄ Syndication mutually exclusive. Turning on Buyer Network marks Investment Type required. Hide from Non-Listing Brokers checkbox. Read-only disconnect warning when connected.

### Lease Marketing Visibility *(dealType = Lease)*
None / My Brokerage Website / Buildout Syndication Network (no Buyer Network). Active → Website + Syndication; Proposal → None. Same Hide-from-Non-Listing-Brokers + disconnect warning.

### Buyer *(dealType = Sale AND status = Under Contract)*
Buyer (contact lookup among existing contacts + reuse `buyerContactIds`), Referral Source (auto-fills from the buyer when known).

### Visual Media
Repeatable link rows: Public URL + Media Type dropdown (defaults to "Interactive Site Plan"). Add / remove.

### Disclaimer & Notes
Override Disclaimer checkbox → Custom Disclaimer textarea, Internal Notes (existing `Listing.internalNotes`), Admin Notes, External ID (read-only display).

---

## Financials (Deal tab)

Expand the existing Sale Financials section toward PRD §15 while keeping it on the Deal tab:

- Keep current fields: Asking Price, Cap Rate, NOI, Operating Expenses, Hide Price, Income line items, Expense line items, Scenarios.
- Surface the fuller `DealPitchFinancials` fields already in the model: Sale Price Units, Gross Scheduled Income, Other Income, Total Scheduled Income (calc), Vacancy % + Vacancy Cost (calc), Gross Income (calc), Loan Amount, Down Payment, Debt Service, Cash Flow, Debt Coverage Ratio, GRM (Multifamily only), Cash-on-Cash.
- Calculated-with-manual-override behavior: show the computed value, let a manual entry win (per PRD cross-cutting rule 7).
- **Known "0.00 vs blank" edge case** (PRD §15 / anomaly): the prototype **keeps values blank** when inputs are missing rather than showing "0.00".

Rent Roll and Unit Mix do **not** live here — they're on the Listing tab under Units.

---

## Conditional rules summary

| Driver | Effects |
|---|---|
| **Deal Type** (fixed) | Sale sections vs Lease sections; read-only on Deal tab |
| **Property Type / Subtype** | Building Class (Office); Retail Clientele (Retail); Industrial cluster (Building + Lease Spaces); Land + Lots sections & Rail Access (Land); Number of Units required (Multifamily); condo financials (Condo subtype); Unit Mix / Rent Roll column sets; auto-required Lot Size (land-like) |
| **Deal Status** | Marketing Visibility channel availability; Buyer section (Under Contract); Close Date/Buyer on Lot/Condo/Space cards |
| **Country** | State/Zip presence & labels; Building Class "A+" eligibility; County visibility; Country Name Override |
| **Tenancy** | Address/Suite required per Lease Space when not Single |
| **"Show/Hide Additional Fields"** | Collapsible blocks on Location, Property, Building, Sale, Land, Lease Spaces |

---

## Persistence & save behavior

- The editor holds two working copies: the deal/listing side (status, dealType, brokers, transaction, financials, marketing) and a property side (all Property facts).
- **Save** performs `updateDeal(listing.id, {...})` for listing/marketing/transaction/financials AND `updateProperty(property.id, {...})` for property facts, then navigates back to `/listings/$listingId/overview`. **Cancel** discards and navigates back.
- Working-copy initializers tolerate older snapshots by defaulting any missing new field (mirroring the existing `marketing.spaceLeaseTerms ?? []` guard).

---

## Component / file plan

- **`src/data/types.ts`** — add the new fields/types above.
- **`src/data/createListing.ts`** — extend `emptySpaceLeaseTerms` and any default-record builders with the new fields; add empty-record helpers `emptyLot`, `emptyCondo`, `emptyUnitMixRow`, `emptyVisualMediaLink`.
- **`src/data/seed.ts`** — ensure seeded properties/listings populate representative values for a few new fields so the form isn't empty on demo (light touch).
- **`DealMarketingEditor.tsx`** — becomes the tab shell + Deal-tab content; extract the growing Listing-tab content into a new **`ListingFormEditor.tsx`** (and, if it grows large, per-section sub-components under `src/components/listings/edit/`). Keeps files focused per the isolation principle.
- Reuse the existing small field wrappers; promote them to a shared module if both editors need them.

## Open questions / flags

- Building "Additional Fields" implements a representative subset of PRD §9's ~40 fields (see note). Confirm if the exhaustive list is required.
- Currency/measurement live relabeling is deferred; selectors persist the chosen values only.
