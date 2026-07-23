# Listing Edit Form — Deal + Listing Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the listing edit form into two tabs — **Deal** (money + deal management) and **Listing** (the comprehensive property/marketing listing form) — capturing the full PRD field set with prototype-scoped conditional rules.

**Architecture:** `DealMarketingEditor` becomes a two-tab shell holding one shared working-copy of state and one Save/Cancel bar. The Deal tab keeps Setup & Status, Brokers, Transaction Terms, and an expanded Financials section. A new `ListingFormEditor` (with per-section subcomponents) renders the Listing tab. Property facts persist via the existing `updateProperty`; listing/marketing/transaction/financials persist via `updateDeal`. Pure logic (conditional availability, financial calcs, empty-record builders) is extracted into testable helpers.

**Tech Stack:** React 19, TypeScript, TanStack Start, Blueprint React (`@buildoutinc/blueprint-react`), FontAwesome Pro, Zustand + IndexedDB store, Vitest.

## Global Constraints

- **Package manager:** always run scripts with `bun --bun run <script>` (e.g. `bun --bun run test`, `bun --bun run build`).
- **UI components:** use Blueprint React components (`@buildoutinc/blueprint-react/ui/*`) and Bootstrap 5 utility classes for spacing/layout. No Tailwind.
- **Icons:** FontAwesome Pro, default `pro-regular`. **Never** pass `fixedWidth` to `FontAwesomeIcon`.
- **No Playwright.** Verify logic with Vitest; verify UI with `bun --bun run build` (compile gate) and hand off to the user for manual testing.
- **Do not restructure existing visual design** beyond what this plan specifies.
- **New data-model fields are optional/nullable** and defaulted by the editor's working-copy initializer so persisted snapshots keep loading (mirror the existing `marketing.spaceLeaseTerms ?? []` guard).
- **Deal Type is fixed** (decided in Create Deal modal): shown read-only; never switchable on this form.
- **UI field convention (applies to every UI task):** each field is rendered with the existing wrappers (`TextField`, `NumberField`, `DateField`, `SelectField`, `SwitchRow`, `BulletsField`) inside `FieldGrid`/`Col`, wired to the state path named in the task's field table. Collapsible "Additional Fields" blocks use `Accordion variant="inline"`. Repeatable card lists follow the add/move/remove pattern in `ScenarioEditor` (`DealMarketingEditor.tsx:486-595`).
- **Spec reference:** `docs/superpowers/specs/2026-07-23-listing-edit-form-tabs-design.md`.

---

## File Structure

- `src/data/types.ts` — new types (`Lot`, `Condo`, `UnitMixRow`, `VisualMediaLink`, `YesNoNA`); field additions to `Property`, `DealMarketing`, `SpaceLeaseTerms`, `RentRollRow`.
- `src/data/createListing.ts` — extend `emptySpaceLeaseTerms`; add `emptyLot`, `emptyCondo`, `emptyUnitMixRow`, `emptyVisualMediaLink`.
- `src/data/listingFormLogic.ts` *(new)* — pure conditional-availability helpers.
- `src/data/listingFormLogic.test.ts` *(new)* — tests for the above.
- `src/data/listingFinancials.ts` *(new)* — pure financial calc + rent-roll auto-fill helpers.
- `src/data/listingFinancials.test.ts` *(new)* — tests for the above.
- `src/components/listings/edit/fieldWidgets.tsx` *(new)* — shared field wrappers extracted from `DealMarketingEditor`.
- `src/components/deals/DealMarketingEditor.tsx` — becomes the tab shell + Deal-tab content.
- `src/components/listings/edit/ListingFormEditor.tsx` *(new)* — Listing-tab container.
- `src/components/listings/edit/sections/*.tsx` *(new)* — one file per Listing section group.
- `src/data/seed.ts` — light seeding of a few new fields (optional demo polish).

---

## Task 1: Data model — new types and field additions

**Files:**
- Modify: `src/data/types.ts`
- Test: `src/data/types.test.ts` (create)

**Interfaces:**
- Produces: `YesNoNA`, `Lot`, `Condo`, `UnitMixRow`, `VisualMediaLink`; extended `Property`, `DealMarketing`, `SpaceLeaseTerms`, `RentRollRow`.

- [ ] **Step 1: Add the new standalone types and field additions to `types.ts`**

Add near the other listing types:

```ts
export type YesNoNA = 'Y' | 'N' | 'NA'

/** One subdivision lot on a Property (PRD §13). */
export interface Lot {
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

/** One condo unit on a Property (PRD §14). */
export interface Condo {
  id: string
  status: PropertyStatus
  closeDate: string | null
  addressUnit: string
  salePrice: number | null
  priceUnits: 'Total' | 'SF' | 'SqM'
  hidePrice: boolean
  hidePriceLabel: string | null
  size: number | null
  sizeUnits: 'Sq Ft' | 'Sq Meters'
  description: string
}

/** One unit-mix summary row (PRD §18). */
export interface UnitMixRow {
  id: string
  unitType: string
  bedrooms: number | null
  bathrooms: number | null
  count: number | null
  size: number | null
  rackRate: number | null
  rent: number | null
  minRent: number | null
  maxRent: number | null
  marketRent: number | null
  securityDeposit: number | null
  description: string
}

export type VisualMediaType =
  | 'Interactive Site Plan' | 'Aerial 360 Map' | 'Aerial 360 Rendering'
  | '360 Rendering' | 'Property Marketing Video' | 'Matterport Tour' | '360 Tour'

/** One visual-media / virtual-tour embed (PRD §24). */
export interface VisualMediaLink {
  id: string
  url: string
  mediaType: VisualMediaType
}
```

Add to `interface Property` (all new fields optional):

```ts
  // Listing-form: Location additional
  country?: string
  countryNameOverride?: string
  currency?: string
  currencyFormat?: string
  language?: string
  measurementSystem?: 'Imperial' | 'Metric'
  hideAddress?: boolean
  displayAddressAs?: string
  overrideMapLocation?: boolean
  market?: string
  crossStreets?: string
  township?: string
  range?: string
  section?: string
  sideOfStreet?: string
  streetParking?: YesNoNA
  signalIntersection?: YesNoNA
  roadType?: string
  marketType?: string
  nearestHighway?: string
  nearestAirport?: string
  // Listing-form: Property additional
  propertyTypeLabelOverride?: string
  additionalPropertyTypes?: { type: PropertyType; subtype: PropertySubtype }[]
  aliases?: string[]
  lotSizeUnit?: string
  lotFrontage?: number | null
  lotDepth?: number | null
  cornerProperty?: boolean
  trafficCount?: string
  siteDescription?: string
  amenities?: string
  waterfront?: boolean
  mlsId?: string
  thomasGuidePage?: string
  powerDescription?: string
  railAccess?: boolean
  gasPropaneDescription?: string
  // Listing-form: Building additional
  avgFloorSize?: number | null
  ceilingHeight?: number | null
  minCeilingHeight?: number | null
  officeSpaceSqFt?: number | null
  tenancy?: 'Single' | 'Multiple'
  gradeLevelDoors?: number | null
  dockHighDoors?: number | null
  driveInBays?: number | null
  numberOfCranes?: number | null
  dockDescription?: string
  craneDescription?: string
  sprinklerDescription?: string
  overheadDoorHeight?: number | null
  columnSpace?: string
  grossLeasableArea?: number | null
  loadFactor?: number | null
  constructionStatus?: string
  parkingRatio?: number | null
  parkingType?: string
  warehousePct?: number | null
  condition?: string
  freightElevator?: boolean
  numberOfElevators?: number | null
  centralHvac?: boolean
  roof?: string
  freeStanding?: boolean
  leedCertified?: boolean
  retailClientele?: string
  constructionDescription?: string
  parkingDescription?: string
  utilitiesDescription?: string
  loadingDescription?: string
  // Listing-form: Land
  numberOfLots?: number | null
  bestUse?: string
  irrigation?: YesNoNA
  irrigationDescription?: string
  water?: YesNoNA
  waterDescription?: string
  telephone?: YesNoNA
  telephoneDescription?: string
  cable?: YesNoNA
  cableDescription?: string
  sewer?: YesNoNA
  environmentalIssues?: string
  topography?: string
  soilType?: string
  easementsDescription?: string
  // Listing-form: repeatable child records
  lots?: Lot[]
  condos?: Condo[]
  unitMix?: UnitMixRow[]
```

Add to `interface DealMarketing` (all new fields optional except where a default is natural):

```ts
  displayLocationDescriptionForSyndication?: boolean
  // Sale extras
  yearsLeftOnLease?: string
  nnnLeaseExpiration?: string | null
  saleCommissionPct?: number | null
  auctionDate?: string | null
  auctionTime?: string
  auctionLocation?: string
  auctionStartingBid?: number | null
  auctionUrl?: string
  taxPerUnit?: number | null
  capitalCosts?: string
  loanDueDate?: string | null
  loanDescription?: string
  taxes?: string
  taxValueLand?: number | null
  taxValueImprovements?: number | null
  taxValuePersonal?: number | null
  assessedValue?: number | null
  exchange1031?: YesNoNA
  considerExchange?: YesNoNA
  landOwnership?: string
  landLegalDescription?: string
  // Lease extras
  leaseClosingInformation?: string
  availableSfTerm?: 'SF' | 'RSF'
  // Marketing visibility
  saleMarketingChannel?: MarketingChannel
  leaseMarketingChannel?: MarketingChannel
  hideFromNonListingBrokers?: boolean
  // Units toggles
  includeUnitMix?: boolean
  syndicateUnitMix?: boolean
  includeRentRoll?: boolean
  syndicateRentRoll?: boolean
  // Buyer (Under Contract)
  buyerContactId?: string | null
  referralSource?: string
  // Visual media + disclaimer/notes
  visualMedia?: VisualMediaLink[]
  overrideDisclaimer?: boolean
  customDisclaimer?: string
  adminNotes?: string
  externalId?: string
```

Add to `interface SpaceLeaseTerms`:

```ts
  status?: 'Active' | 'Under Contract' | 'Closed' | 'Inactive'
  closeDate?: string | null
  spaceType?: PropertySubtype | null
  spaceTypeLabelOverride?: string
  tenantName?: string
  majorTenant?: boolean
  spaceName?: string
  suite?: string
  floor?: number | null
  zipPlus4?: string
  leaseRateMode?: 'Flat' | 'Range' | 'Hidden'
  leaseRateTo?: number | null
  leaseRateUnitLabelOverride?: string
  spaceSize?: number | null
  spaceSizeUnits?: string
  leaseTypeLabelOverride?: string
  subleaseExpiration?: string | null
  ceilingHeight?: number | null
  // Industrial cluster
  previousUsage?: string
  officeSpace?: number | null
  gradeLevelDoors?: number | null
  dockHighDoors?: number | null
  driveInBays?: number | null
  numberOfCranes?: number | null
  powerDescription?: string
  // Additional-fields block
  warehouseAllotmentPct?: number | null
  parkingSpaces?: number | null
  conferenceRooms?: number | null
  offices?: number | null
  furnished?: boolean
  heating?: YesNoNA
  heatingDescription?: string
  cooling?: YesNoNA
  coolingDescription?: string
  lighting?: YesNoNA
  lightingDescription?: string
  hvacTonnage?: string
  rentConcession?: string
  leaseTermsText?: string
  salePrice?: number | null
```

Add to `interface RentRollRow`:

```ts
  suite?: string
  type?: PropertyType | null
  beds?: number | null
  baths?: number | null
  annualRent?: number | null
  rentEscalations?: { id: string; date: string | null; ratePerSf: number | null }[]
  comments?: string
  recoveryType?: string
```

- [ ] **Step 2: Write a construction test**

Create `src/data/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Lot, Condo, UnitMixRow, VisualMediaLink } from './types'

describe('listing-form record types', () => {
  it('constructs each new record type', () => {
    const lot: Lot = {
      id: 'l1', status: 'active', closeDate: null, buyerReferralSource: null,
      lotNumber: '1', address: '', apn: '', subtype: null, salePrice: null,
      priceUnits: 'Total', size: null, sizeUnits: 'Acre', description: '', zoning: '',
    }
    const condo: Condo = {
      id: 'c1', status: 'active', closeDate: null, addressUnit: '4B', salePrice: null,
      priceUnits: 'Total', hidePrice: false, hidePriceLabel: null, size: null,
      sizeUnits: 'Sq Ft', description: '',
    }
    const row: UnitMixRow = {
      id: 'u1', unitType: '1BR/1BA', bedrooms: 1, bathrooms: 1, count: 10, size: 750,
      rackRate: null, rent: 1800, minRent: null, maxRent: null, marketRent: 1850,
      securityDeposit: 1800, description: '',
    }
    const media: VisualMediaLink = { id: 'm1', url: 'https://x', mediaType: 'Matterport Tour' }
    expect([lot.id, condo.id, row.id, media.id]).toEqual(['l1', 'c1', 'u1', 'm1'])
  })
})
```

- [ ] **Step 3: Run the test**

Run: `bun --bun run test src/data/types.test.ts`
Expected: PASS (compiles against the new types).

- [ ] **Step 4: Commit**

```bash
git add src/data/types.ts src/data/types.test.ts
git commit -m "feat(data): add listing-form field set to Property/DealMarketing/SpaceLeaseTerms"
```

---

## Task 2: Empty-record builders

**Files:**
- Modify: `src/data/createListing.ts`
- Test: `src/data/emptyRecords.test.ts` (create)

**Interfaces:**
- Consumes: `Lot`, `Condo`, `UnitMixRow`, `VisualMediaLink` (Task 1).
- Produces: `emptyLot(): Lot`, `emptyCondo(): Condo`, `emptyUnitMixRow(): UnitMixRow`, `emptyVisualMediaLink(): VisualMediaLink`; extended `emptySpaceLeaseTerms` defaults for the new fields.

- [ ] **Step 1: Write failing tests**

Create `src/data/emptyRecords.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  emptyLot, emptyCondo, emptyUnitMixRow, emptyVisualMediaLink, emptySpaceLeaseTerms,
} from './createListing'

describe('empty-record builders', () => {
  it('emptyLot defaults', () => {
    const lot = emptyLot()
    expect(lot.status).toBe('active')
    expect(lot.priceUnits).toBe('Total')
    expect(lot.salePrice).toBeNull()
    expect(typeof lot.id).toBe('string')
  })
  it('emptyCondo defaults', () => {
    const c = emptyCondo()
    expect(c.hidePrice).toBe(false)
    expect(c.sizeUnits).toBe('Sq Ft')
  })
  it('emptyUnitMixRow defaults', () => {
    expect(emptyUnitMixRow().count).toBeNull()
  })
  it('emptyVisualMediaLink defaults', () => {
    expect(emptyVisualMediaLink().mediaType).toBe('Interactive Site Plan')
  })
  it('emptySpaceLeaseTerms defaults new fields', () => {
    const t = emptySpaceLeaseTerms('unit-1')
    expect(t.leaseRateMode).toBe('Flat')
    expect(t.majorTenant).toBe(false)
    expect(t.status).toBe('Active')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun --bun run test src/data/emptyRecords.test.ts`
Expected: FAIL (builders not exported / new defaults missing).

- [ ] **Step 3: Implement the builders**

In `src/data/createListing.ts`, extend the return of `emptySpaceLeaseTerms` with the new fields:

```ts
    status: 'Active',
    closeDate: null,
    spaceType: null,
    spaceTypeLabelOverride: '',
    tenantName: '',
    majorTenant: false,
    spaceName: '',
    suite: '',
    floor: null,
    zipPlus4: '',
    leaseRateMode: 'Flat',
    leaseRateTo: null,
    leaseRateUnitLabelOverride: '',
    spaceSize: null,
    spaceSizeUnits: 'SF',
    leaseTypeLabelOverride: '',
    subleaseExpiration: null,
    ceilingHeight: null,
    previousUsage: '',
    officeSpace: null,
    gradeLevelDoors: null,
    dockHighDoors: null,
    driveInBays: null,
    numberOfCranes: null,
    powerDescription: '',
    warehouseAllotmentPct: null,
    parkingSpaces: null,
    conferenceRooms: null,
    offices: null,
    furnished: false,
    heating: 'NA',
    heatingDescription: '',
    cooling: 'NA',
    coolingDescription: '',
    lighting: 'NA',
    lightingDescription: '',
    hvacTonnage: '',
    rentConcession: '',
    leaseTermsText: '',
    salePrice: null,
```

Add the new builders (import `Lot, Condo, UnitMixRow, VisualMediaLink` in the type import block):

```ts
export function emptyLot(): Lot {
  return {
    id: crypto.randomUUID(), status: 'active', closeDate: null, buyerReferralSource: null,
    lotNumber: '', address: '', apn: '', subtype: null, salePrice: null,
    priceUnits: 'Total', size: null, sizeUnits: 'Acre', description: '', zoning: '',
  }
}

export function emptyCondo(): Condo {
  return {
    id: crypto.randomUUID(), status: 'active', closeDate: null, addressUnit: '',
    salePrice: null, priceUnits: 'Total', hidePrice: false, hidePriceLabel: null,
    size: null, sizeUnits: 'Sq Ft', description: '',
  }
}

export function emptyUnitMixRow(): UnitMixRow {
  return {
    id: crypto.randomUUID(), unitType: '', bedrooms: null, bathrooms: null, count: null,
    size: null, rackRate: null, rent: null, minRent: null, maxRent: null,
    marketRent: null, securityDeposit: null, description: '',
  }
}

export function emptyVisualMediaLink(): VisualMediaLink {
  return { id: crypto.randomUUID(), url: '', mediaType: 'Interactive Site Plan' }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun --bun run test src/data/emptyRecords.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/createListing.ts src/data/emptyRecords.test.ts
git commit -m "feat(data): empty-record builders for lots/condos/unit-mix/media + space-terms defaults"
```

---

## Task 3: Conditional-availability logic helpers

**Files:**
- Create: `src/data/listingFormLogic.ts`
- Test: `src/data/listingFormLogic.test.ts`

**Interfaces:**
- Consumes: `PropertyType`, `PropertySubtype`, `PropertyStatus`, `MarketingChannel`, `DealType` (types.ts).
- Produces:
  - `saleChannelsFor(status: PropertyStatus): MarketingChannel[]`
  - `leaseChannelsFor(status: PropertyStatus): MarketingChannel[]`
  - `isLandLikeSubtype(subtype: PropertySubtype): boolean`
  - `propertyTypeEffects(type: PropertyType): { buildingClass: boolean; retailClientele: boolean; industrialCluster: boolean; landSections: boolean; unitsRequired: boolean; hidesLease: boolean }`
  - `buildingClassOptions(country: string | undefined): string[]`
  - `showBuyerSection(dealType: DealType, status: PropertyStatus): boolean`

- [ ] **Step 1: Write failing tests**

Create `src/data/listingFormLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  saleChannelsFor, leaseChannelsFor, isLandLikeSubtype, propertyTypeEffects,
  buildingClassOptions, showBuyerSection,
} from './listingFormLogic'

describe('marketing channel availability by status', () => {
  it('Active offers all four sale channels', () => {
    expect(saleChannelsFor('active')).toEqual([
      'None', 'Buildout Buyer Network', 'My Brokerage Website', 'Buildout Syndication Network',
    ])
  })
  it('Under Contract drops Syndication', () => {
    expect(saleChannelsFor('under-contract')).not.toContain('Buildout Syndication Network')
    expect(saleChannelsFor('under-contract')).toContain('My Brokerage Website')
  })
  it('Proposal/Inactive/Closed offer only None', () => {
    for (const s of ['proposal', 'inactive', 'closed'] as const) {
      expect(saleChannelsFor(s)).toEqual(['None'])
    }
  })
  it('lease Active offers Website + Syndication (no Buyer Network)', () => {
    expect(leaseChannelsFor('active')).toEqual([
      'None', 'My Brokerage Website', 'Buildout Syndication Network',
    ])
    expect(leaseChannelsFor('proposal')).toEqual(['None'])
  })
})

describe('property-type + subtype effects', () => {
  it('flags land-like subtypes', () => {
    expect(isLandLikeSubtype('Vacant Land')).toBe(true)
    expect(isLandLikeSubtype('Mid-Rise')).toBe(false)
  })
  it('office reveals building class', () => {
    expect(propertyTypeEffects('office').buildingClass).toBe(true)
  })
  it('industrial reveals the industrial cluster', () => {
    expect(propertyTypeEffects('industrial').industrialCluster).toBe(true)
  })
  it('multifamily requires units and hides lease', () => {
    const e = propertyTypeEffects('multifamily')
    expect(e.unitsRequired).toBe(true)
    expect(e.hidesLease).toBe(true)
  })
  it('land reveals land sections', () => {
    expect(propertyTypeEffects('land').landSections).toBe(true)
  })
})

describe('building class options by country', () => {
  it('offers A+ for US, not for others', () => {
    expect(buildingClassOptions('United States')).toContain('A+')
    expect(buildingClassOptions('Canada')).not.toContain('A+')
  })
})

describe('buyer section gating', () => {
  it('shows only for Sale + Under Contract', () => {
    expect(showBuyerSection('Sale', 'under-contract')).toBe(true)
    expect(showBuyerSection('Sale', 'active')).toBe(false)
    expect(showBuyerSection('Lease', 'under-contract')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun --bun run test src/data/listingFormLogic.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `listingFormLogic.ts`**

```ts
import type {
  DealType, MarketingChannel, PropertyStatus, PropertySubtype, PropertyType,
} from './types'

const ALL_SALE_CHANNELS: MarketingChannel[] = [
  'None', 'Buildout Buyer Network', 'My Brokerage Website', 'Buildout Syndication Network',
]

/** Sale marketing channels available at a given deal status (PRD §20). */
export function saleChannelsFor(status: PropertyStatus): MarketingChannel[] {
  switch (status) {
    case 'active': return ALL_SALE_CHANNELS
    case 'under-contract':
      return ALL_SALE_CHANNELS.filter((c) => c !== 'Buildout Syndication Network')
    default: return ['None'] // proposal | inactive | closed
  }
}

/** Lease marketing channels available at a given deal status (PRD §21). */
export function leaseChannelsFor(status: PropertyStatus): MarketingChannel[] {
  if (status === 'active') {
    return ['None', 'My Brokerage Website', 'Buildout Syndication Network']
  }
  return ['None']
}

const LAND_LIKE: PropertySubtype[] = ['Vacant Land', 'Industrial Outdoor Storage']

/** True when the subtype is land-like (auto-requires Lot Size, PRD §8). */
export function isLandLikeSubtype(subtype: PropertySubtype): boolean {
  return LAND_LIKE.includes(subtype)
}

/** Which downstream sections a primary property type reveals/requires (PRD §8 "Type effects"). */
export function propertyTypeEffects(type: PropertyType): {
  buildingClass: boolean; retailClientele: boolean; industrialCluster: boolean
  landSections: boolean; unitsRequired: boolean; hidesLease: boolean
} {
  return {
    buildingClass: type === 'office',
    retailClientele: type === 'retail',
    industrialCluster: type === 'industrial',
    landSections: type === 'land',
    unitsRequired: type === 'multifamily',
    hidesLease: type === 'multifamily' || type === 'hospitality',
  }
}

/** Building-class options; A+ only for eligible countries (PRD §6/§9). */
export function buildingClassOptions(country: string | undefined): string[] {
  const base = ['A', 'B', 'C']
  return !country || country === 'United States' ? ['A+', ...base] : base
}

/** Buyer section shows only for a Sale deal at Under Contract (PRD §23). */
export function showBuyerSection(dealType: DealType, status: PropertyStatus): boolean {
  return dealType === 'Sale' && status === 'under-contract'
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun --bun run test src/data/listingFormLogic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/listingFormLogic.ts src/data/listingFormLogic.test.ts
git commit -m "feat(data): conditional-availability helpers for the listing form"
```

---

## Task 4: Financial calc + rent-roll auto-fill helpers

**Files:**
- Create: `src/data/listingFinancials.ts`
- Test: `src/data/listingFinancials.test.ts`

**Interfaces:**
- Produces:
  - `totalScheduledIncome(gross: number | null, other: number | null): number | null`
  - `vacancyCost(gross: number | null, vacancyPct: number | null): number | null`
  - `grossIncome(totalScheduled: number | null, vacancy: number | null): number | null`
  - `noi(grossIncome: number | null, opex: number | null): number | null`
  - `capRate(noi: number | null, price: number | null): number | null`
  - `autoFillRentRow(size: number | null, ratePerSf: number | null, annualRent: number | null): { size: number | null; ratePerSf: number | null; annualRent: number | null }`
- **Blank-not-zero rule:** any calc returns `null` when a required input is missing/zero-denominator (PRD anomaly: no "0.00").

- [ ] **Step 1: Write failing tests**

Create `src/data/listingFinancials.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  totalScheduledIncome, vacancyCost, grossIncome, noi, capRate, autoFillRentRow,
} from './listingFinancials'

describe('financial calcs (blank-not-zero)', () => {
  it('sums scheduled income', () => {
    expect(totalScheduledIncome(100000, 5000)).toBe(105000)
    expect(totalScheduledIncome(null, null)).toBeNull()
  })
  it('vacancy cost = gross * pct', () => {
    expect(vacancyCost(100000, 5)).toBe(5000)
    expect(vacancyCost(100000, null)).toBeNull()
  })
  it('gross income = total scheduled - vacancy', () => {
    expect(grossIncome(105000, 5000)).toBe(100000)
  })
  it('noi = gross income - opex', () => {
    expect(noi(100000, 30000)).toBe(70000)
  })
  it('cap rate = noi / price, blank when price missing', () => {
    expect(capRate(70000, 1000000)).toBeCloseTo(7)
    expect(capRate(70000, null)).toBeNull()
    expect(capRate(70000, 0)).toBeNull()
  })
})

describe('rent-roll auto-fill (any two compute the third)', () => {
  it('computes annual rent from size + rate', () => {
    expect(autoFillRentRow(1000, 20, null).annualRent).toBe(20000)
  })
  it('computes rate from size + annual', () => {
    expect(autoFillRentRow(1000, null, 20000).ratePerSf).toBe(20)
  })
  it('computes size from rate + annual', () => {
    expect(autoFillRentRow(null, 20, 20000).size).toBe(1000)
  })
  it('leaves all as-is when fewer than two are known', () => {
    expect(autoFillRentRow(1000, null, null)).toEqual({ size: 1000, ratePerSf: null, annualRent: null })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun --bun run test src/data/listingFinancials.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `listingFinancials.ts`**

```ts
const has = (n: number | null | undefined): n is number => n != null && !Number.isNaN(n)

export function totalScheduledIncome(gross: number | null, other: number | null): number | null {
  if (!has(gross) && !has(other)) return null
  return (gross ?? 0) + (other ?? 0)
}

export function vacancyCost(gross: number | null, vacancyPct: number | null): number | null {
  if (!has(gross) || !has(vacancyPct)) return null
  return (gross * vacancyPct) / 100
}

export function grossIncome(totalScheduled: number | null, vacancy: number | null): number | null {
  if (!has(totalScheduled)) return null
  return totalScheduled - (vacancy ?? 0)
}

export function noi(gross: number | null, opex: number | null): number | null {
  if (!has(gross)) return null
  return gross - (opex ?? 0)
}

export function capRate(noiValue: number | null, price: number | null): number | null {
  if (!has(noiValue) || !has(price) || price === 0) return null
  return (noiValue / price) * 100
}

/** Given any two of {size, ratePerSf, annualRent}, compute the third (PRD §19). */
export function autoFillRentRow(
  size: number | null, ratePerSf: number | null, annualRent: number | null,
): { size: number | null; ratePerSf: number | null; annualRent: number | null } {
  const known = [has(size), has(ratePerSf), has(annualRent)].filter(Boolean).length
  if (known < 2) return { size, ratePerSf, annualRent }
  if (has(size) && has(ratePerSf)) return { size, ratePerSf, annualRent: size * ratePerSf }
  if (has(size) && has(annualRent)) return { size, ratePerSf: size === 0 ? null : annualRent / size, annualRent }
  if (has(ratePerSf) && has(annualRent)) return { size: ratePerSf === 0 ? null : annualRent / ratePerSf, ratePerSf, annualRent }
  return { size, ratePerSf, annualRent }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun --bun run test src/data/listingFinancials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/listingFinancials.ts src/data/listingFinancials.test.ts
git commit -m "feat(data): financial calc + rent-roll auto-fill helpers (blank-not-zero)"
```

---

## Task 5: Extract shared field widgets

**Files:**
- Create: `src/components/listings/edit/fieldWidgets.tsx`
- Modify: `src/components/deals/DealMarketingEditor.tsx`

**Interfaces:**
- Produces (moved verbatim from `DealMarketingEditor.tsx`): `TextField`, `NumberField`, `DateField`, `SelectField`, `SwitchRow`, `FieldGrid`, `Col`, `BulletsField`, plus the date helpers `parseDate`/`toISODate`. Same signatures as their current definitions (`DealMarketingEditor.tsx:100-338`).

- [ ] **Step 1: Move the wrappers into `fieldWidgets.tsx`**

Cut `TextField`, `NumberField`, `DateField` (+ `DATE_FORMAT`, `parseDate`, `toISODate`), `SelectField`, `SwitchRow`, `FieldGrid`, `Col`, `BulletsField` from `DealMarketingEditor.tsx` into a new `src/components/listings/edit/fieldWidgets.tsx`, `export`ing each. Keep their bodies identical. Preserve imports they need (`useState`, Blueprint `Field`/`Input`/`Textarea`/`Select`/`Switch`/`InputGroup`/`Popover`/`Calendar`, `FontAwesomeIcon`, `faTrashCan`, `faPlus`, `faCalendar`).

- [ ] **Step 2: Import them back into `DealMarketingEditor.tsx`**

Replace the removed definitions with:

```ts
import {
  TextField, NumberField, DateField, SelectField, SwitchRow,
  FieldGrid, Col, BulletsField,
} from "#/components/listings/edit/fieldWidgets";
```

- [ ] **Step 3: Compile gate**

Run: `bun --bun run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Run existing tests**

Run: `bun --bun run test`
Expected: PASS (no behavior change).

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/fieldWidgets.tsx src/components/deals/DealMarketingEditor.tsx
git commit -m "refactor(listings): extract shared field widgets for reuse across editors"
```

---

## Task 6: Two-tab shell + Deal tab (with expanded Financials)

**Files:**
- Modify: `src/components/deals/DealMarketingEditor.tsx`

**Interfaces:**
- Consumes: `fieldWidgets` (Task 5); `listingFinancials` calcs (Task 4); `updateProperty` (`#/data/store`); `updateDeal` (`#/data/actions`).
- Produces: the two-tab shell rendering `ListingFormEditor` (Task 7+) in the Listing tab. Until that exists, the Listing tab renders a placeholder `<div>Listing form…</div>` so this task is independently testable.

- [ ] **Step 1: Add tab state + property working-copy**

In `DealMarketingEditor`, after the existing `useState` hooks add:

```ts
const [tab, setTab] = useState<"deal" | "listing">("deal");
const [propertyDraft, setPropertyDraft] = useState<Property>(property);
const patchProperty = (patch: Partial<Property>) =>
  setPropertyDraft((p) => ({ ...p, ...patch }));
```

- [ ] **Step 2: Update `save` to persist both sides**

```ts
import { updateProperty } from "#/data/store";
// …
const save = () => {
  updateDeal(listing.id, {
    status, dealType, internalBrokers, outsideBrokers, transaction, financials, marketing,
  });
  updateProperty(property.id, propertyDraft);
  back();
};
```

- [ ] **Step 3: Wrap content in the Tabs shell**

Change the header title to `Edit Listing`. Below the header + actions row, render the `Tabs` control (pattern from `email/index.tsx:253-271`) and split the body:

```tsx
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { faHandshake, faBuildingColumns } from "@fortawesome/pro-regular-svg-icons";
// …
<Tabs value={tab} onValueChange={(v) => setTab(v as "deal" | "listing")}>
  <Tabs.List>
    <Tabs.Tab value="deal" icon={<FontAwesomeIcon icon={faHandshake} />}>Deal</Tabs.Tab>
    <Tabs.Tab value="listing" icon={<FontAwesomeIcon icon={faBuildingColumns} />}>Listing</Tabs.Tab>
  </Tabs.List>
</Tabs>

{tab === "deal" ? (
  <div className="d-flex flex-column gap-6">
    {/* existing Setup & Status, Brokers, Transaction Terms, Financials sections */}
  </div>
) : (
  <ListingFormEditor
    listing={listing}
    dealType={dealType}
    status={status}
    marketing={marketing}
    patchMarketing={patchMarketing}
    property={propertyDraft}
    patchProperty={patchProperty}
  />
)}
```

- [ ] **Step 4: Move marketing/per-space content out of the Deal tab**

Delete the "Sale Marketing & Terms", "Lease Marketing & Terms", and "Per-Space Terms" sections from `DealMarketingEditor` (they move to the Listing tab in later tasks). In the Deal tab's "Setup & Status" section, remove the **Marketing Channel** and **Visibility Tier** `SelectField`s (they move to Marketing Visibility on the Listing tab). Make **Deal Type** read-only — replace its `SelectField` with a static labeled value:

```tsx
<Field>
  <Field.Label>Deal Type</Field.Label>
  <Input readOnly value={dealType} />
</Field>
```

- [ ] **Step 5: Expand the Deal-tab Financials section**

In the existing `Section title="Sale Financials"`, keep the current fields and add the §15 fields already on `DealPitchFinancials`, using the Task-4 calcs for read-only computed displays. Add these `NumberField`s wired to `financials`: `grossScheduledIncome`, `otherIncome`, `vacancyPct`, `loanAmount`, `downPayment`, `debtService`, `cashFlow`, and show computed `totalScheduledIncome`, `vacancyCost`, `grossIncome`, `capRate` via the helpers (display blank when the helper returns `null`). Example computed display:

```tsx
<Field>
  <Field.Label>Gross Income (calc)</Field.Label>
  <Input readOnly value={
    grossIncome(
      totalScheduledIncome(financials.grossScheduledIncome, financials.otherIncome),
      vacancyCost(financials.grossScheduledIncome, financials.vacancyPct),
    ) ?? ""
  } />
</Field>
```

Rename the section title from "Sale Financials" to "Financials".

- [ ] **Step 6: Placeholder for the Listing tab**

Create `src/components/listings/edit/ListingFormEditor.tsx` returning a placeholder so this task compiles:

```tsx
import type { DealMarketing, DealType, Listing, Property, PropertyStatus } from "#/data/types";

export function ListingFormEditor(_props: {
  listing: Listing; dealType: DealType; status: PropertyStatus;
  marketing: DealMarketing; patchMarketing: (p: Partial<DealMarketing>) => void;
  property: Property; patchProperty: (p: Partial<Property>) => void;
}) {
  return <div className="text-muted p-2">Listing form — sections added in later tasks.</div>;
}
```

- [ ] **Step 7: Compile gate + manual note**

Run: `bun --bun run build`
Expected: build succeeds.
Manual: user opens `/listings/<id>/edit`, confirms two tabs render, Deal tab shows Setup/Brokers/Transaction/Financials with Deal Type read-only, Save persists and returns to overview.

- [ ] **Step 8: Commit**

```bash
git add src/components/deals/DealMarketingEditor.tsx src/components/listings/edit/ListingFormEditor.tsx
git commit -m "feat(listings): two-tab edit shell with Deal tab + expanded Financials"
```

---

## Task 7: Listing tab — Location & Transit sections

**Files:**
- Create: `src/components/listings/edit/sections/LocationSection.tsx`
- Create: `src/components/listings/edit/sections/TransitSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `fieldWidgets`; `buildingClassOptions` (unused here) — not needed. Uses `Section` (`#/components/listings/listingWidgets`), `Accordion`, `Separator`.
- Produces: `LocationSection`, `TransitSection`, each `({ property, patchProperty }) => JSX`.

**Field inventory — Location** (state path on `property`; wrapper):

| Field | Wrapper | Path | Conditional |
|---|---|---|---|
| Country | SelectField (country list constant) | `country` | always |
| Country Name Override | TextField | `countryNameOverride` | when `country` is non-standard (not in the standard list) |
| Currency / Currency Format / Language | SelectField ×3 | `currency`/`currencyFormat`/`language` | when `country !== 'United States'` |
| Measurement System | SelectField (`Imperial`/`Metric`) | `measurementSystem` | always |
| Address | TextField | `street` | always |
| City / State / Zip | TextField ×3 | `city`/`state`/`zip` | Zip hidden when country has no postal concept (constant set) |
| Hide Address | SwitchRow | `hideAddress` | always |
| Display Address As | TextField | `displayAddressAs` | when `hideAddress` |
| Override Map Location | SwitchRow | `overrideMapLocation` | always |
| Latitude / Longitude | NumberField ×2 | `lat`/`lng` | when `overrideMapLocation` |
| County / Market / Submarket / Cross Streets | TextField ×4 | `county`/`market`/`submarket`/`crossStreets` | County hidden for countries w/o counties |
| Location Description | TextField textarea | `locationDescription` (on **marketing**, not property) | always — *pass a marketing patch too* |
| Display Location Description for Syndication | SwitchRow | `marketing.displayLocationDescriptionForSyndication` | always |
| **Additional Fields** (Accordion) | — | — | always shown as collapsed accordion |
| Township / Range / Section | TextField ×3 | `township`/`range`/`section` | inside accordion |
| Side of Street | TextField | `sideOfStreet` | inside accordion |
| Street Parking / Signal Intersection | SelectField Y/N/NA ×2 | `streetParking`/`signalIntersection` | inside accordion |
| Road Type / Market Type / Nearest Highway / Nearest Airport | TextField ×4 | `roadType`/`marketType`/`nearestHighway`/`nearestAirport` | inside accordion |

> `locationDescription` + `displayLocationDescriptionForSyndication` live on `marketing`. Pass `marketing`/`patchMarketing` to `LocationSection` too.

- [ ] **Step 1: Implement `LocationSection.tsx`** using the field inventory. Country/currency/language use small local constant arrays. Example of the conditional reveal pattern (reuse for all reveals):

```tsx
{property.hideAddress && (
  <TextField label="Display Address As"
    value={property.displayAddressAs ?? ""}
    onChange={(v) => patchProperty({ displayAddressAs: v })} />
)}
```

Wrap the Additional Fields block:

```tsx
<Accordion variant="inline">
  <Accordion.Item value="location-more">
    <Accordion.Trigger><span className="fw-semibold">Show/Hide Additional Fields</span></Accordion.Trigger>
    <Accordion.Content>
      <FieldGrid>{/* township … nearestAirport */}</FieldGrid>
    </Accordion.Content>
  </Accordion.Item>
</Accordion>
```

- [ ] **Step 2: Implement `TransitSection.tsx`** — a static `Section title="Transit"` listing 3–4 representative lines as a read-only checklist (`Switch` disabled or plain list). No state.

- [ ] **Step 3: Wire into `ListingFormEditor`** — replace the placeholder with a `d-flex flex-column gap-6` column rendering `<LocationSection .../>` `<Separator/>` `<TransitSection/>`. Update `ListingFormEditor`'s props to forward `marketing`/`patchMarketing` to `LocationSection`.

- [ ] **Step 4: Compile gate + manual note**

Run: `bun --bun run build`
Expected: success. Manual: Listing tab shows Location (with conditional reveals working) + Transit.

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/sections/LocationSection.tsx src/components/listings/edit/sections/TransitSection.tsx src/components/listings/edit/ListingFormEditor.tsx
git commit -m "feat(listings): Location + Transit sections on the Listing tab"
```

---

## Task 8: Listing tab — Property & Building sections

**Files:**
- Create: `src/components/listings/edit/sections/PropertySection.tsx`
- Create: `src/components/listings/edit/sections/BuildingSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `fieldWidgets`; `isLandLikeSubtype`, `propertyTypeEffects`, `buildingClassOptions` (Task 3); `PROPERTY_TYPES`/subtype lists (see below).
- Produces: `PropertySection`, `BuildingSection`, each `({ property, patchProperty }) => JSX`.

Add local constants (or import if they already exist — grep `propertyDisplay` first):

```ts
const PROPERTY_TYPES: PropertyType[] = ['office','retail','industrial','multifamily','mixed-use','land','hospitality','special-purpose'];
```

**Field inventory — Property:**

| Field | Wrapper | Path | Conditional |
|---|---|---|---|
| Primary Property Type | SelectField(PROPERTY_TYPES) | `propertyType` | always |
| Property Type Label Override | TextField | `propertyTypeLabelOverride` | behind an "Override label" toggle |
| Primary Property Subtype | SelectField (all subtypes) | `propertySubtype` | always |
| Additional Property Type(s) | repeatable type+subtype rows | `additionalPropertyTypes` | always |
| Property Name / Zoning / APN# | TextField ×3 | `name`/`zoning`/`apn` | always |
| Alias(es) | repeatable TextField rows | `aliases` | always |
| Lot Size + unit | NumberField + SelectField | `lotSqFt` + `lotSizeUnit` | **required** when `isLandLikeSubtype(propertySubtype)` or `propertyType==='land'` |
| **Additional Fields** (Accordion) | — | — | — |
| Lot Frontage / Lot Depth | NumberField ×2 | `lotFrontage`/`lotDepth` | accordion |
| Corner Property | SwitchRow | `cornerProperty` | accordion |
| Traffic Count | TextField | `trafficCount` | accordion |
| Site Description / Amenities | TextField textarea ×2 | `siteDescription`/`amenities` | accordion |
| Waterfront | SwitchRow | `waterfront` | accordion |
| MLS ID# / Thomas Guide Page # | TextField ×2 | `mlsId`/`thomasGuidePage` | accordion |
| Power Description | TextField | `powerDescription` | accordion |
| Rail Access | SwitchRow | `railAccess` | accordion (also implied by Land type) |
| Gas/Propane Description | TextField | `gasPropaneDescription` | accordion |

**Field inventory — Building:**

| Field | Wrapper | Path | Conditional |
|---|---|---|---|
| Building Size / Occupancy % / Year Built / Year Renovated | NumberField ×4 | `buildingSqFt`/`occupancyPct`/`yearBuilt`/`yearRenovated` | always |
| Number of Floors / Average Floor Size / Ceiling Height / Min Ceiling Height / Office Space | NumberField ×5 | `stories`/`avgFloorSize`/`ceilingHeight`/`minCeilingHeight`/`officeSpaceSqFt` | always |
| Building Class | SelectField(`buildingClassOptions(property.country)`) | `buildingClass` | when `propertyTypeEffects(propertyType).buildingClass` (Office) — else still shown but optional |
| Tenancy | SelectField(`Single`/`Multiple`) | `tenancy` | always |
| Retail Clientele | TextField | `retailClientele` | when `propertyTypeEffects(propertyType).retailClientele` |
| Industrial cluster: Grade Level Doors / Dock High Doors / Drive-in Bays / Cranes / Dock desc / Crane desc / Sprinkler desc | Number ×4 + Text ×3 | `gradeLevelDoors`/`dockHighDoors`/`driveInBays`/`numberOfCranes`/`dockDescription`/`craneDescription`/`sprinklerDescription` | when `industrialCluster` |
| **Additional Fields** (Accordion) | Mixed | `overheadDoorHeight`,`columnSpace`,`grossLeasableArea`,`loadFactor`,`constructionStatus`,`parkingRatio`,`parkingType`,`warehousePct`,`condition`,`freightElevator`,`numberOfElevators`,`centralHvac`,`roof`,`freeStanding`,`leedCertified`,`constructionDescription`,`parkingDescription`,`utilitiesDescription`,`loadingDescription` | accordion |

- [ ] **Step 1: Implement the additional-property-types repeatable rows** (novel pattern — full code):

```tsx
function AdditionalTypesEditor({ rows, onChange }: {
  rows: { type: PropertyType; subtype: PropertySubtype }[];
  onChange: (v: { type: PropertyType; subtype: PropertySubtype }[]) => void;
}) {
  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between">
        <span className="fw-semibold">Additional Property Types</span>
        <Button variant="ghost" size="sm"
          onClick={() => onChange([...rows, { type: "office", subtype: "Multi-Tenant" }])}>
          <FontAwesomeIcon icon={faPlus} /> Add type
        </Button>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="row g-2 align-items-end">
          <div className="col-md-5"><SelectField label="Type" value={r.type} options={PROPERTY_TYPES}
            onChange={(v) => onChange(rows.map((x, j) => j === i ? { ...x, type: v } : x))} /></div>
          <div className="col-md-6"><SelectField label="Subtype" value={r.subtype} options={ALL_SUBTYPES}
            onChange={(v) => onChange(rows.map((x, j) => j === i ? { ...x, subtype: v } : x))} /></div>
          <div className="col-md-1 d-flex justify-content-end pb-1">
            <Button variant="ghost" size="icon-sm" aria-label="Remove type"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <FontAwesomeIcon icon={faTrashCan} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Define `ALL_SUBTYPES: PropertySubtype[]` from the union in `types.ts` (copy the full list). The Alias(es) editor reuses `BulletsField` (label "Alias").

- [ ] **Step 2: Implement `PropertySection.tsx`** per the Property field inventory, using `AdditionalTypesEditor`, the "Override label" reveal (a `Button variant="ghost"` toggling a local `useState` that shows the override `TextField`), and the Additional Fields accordion.

- [ ] **Step 3: Implement `BuildingSection.tsx`** per the Building field inventory, gating the industrial cluster and Retail Clientele on `propertyTypeEffects(property.propertyType)`, and Building Class options via `buildingClassOptions(property.country)`.

- [ ] **Step 4: Wire both into `ListingFormEditor`** after Transit, each preceded by `<Separator/>`.

- [ ] **Step 5: Compile gate + manual note**

Run: `bun --bun run build`
Expected: success. Manual: switching Primary Property Type reveals/hides Building Class (Office), industrial cluster (Industrial), Retail Clientele (Retail); land-like subtype flags Lot Size.

- [ ] **Step 6: Commit**

```bash
git add src/components/listings/edit/sections/PropertySection.tsx src/components/listings/edit/sections/BuildingSection.tsx src/components/listings/edit/ListingFormEditor.tsx
git commit -m "feat(listings): Property + Building sections with type-driven conditionals"
```

---

## Task 9: Listing tab — Units (Number of Units, Unit Mix, Rent Roll)

**Files:**
- Create: `src/components/listings/edit/sections/UnitsSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `emptyUnitMixRow` (Task 2); `autoFillRentRow` (Task 4); `propertyTypeEffects` (Task 3); `RentRollRow`, `UnitMixRow` types.
- Produces: `UnitsSection`, `({ property, patchProperty, marketing, patchMarketing, financials, patchFinancials }) => JSX`.

> Rent Roll rows live on `financials.rentRoll` (existing `DealPitchFinancials.rentRoll`). Unit Mix rows live on `property.unitMix`. Pass `financials`/`patchFinancials` from `DealMarketingEditor` down through `ListingFormEditor` to this section.

**Behavior:**
- **Number of Units** → `NumberField` on `property.residentialUnits` (required when `propertyTypeEffects(type).unitsRequired`).
- **Include Unit Mix** (`marketing.includeUnitMix`) reveals a Unit Mix table + **Syndicate Unit Mix** (`marketing.syndicateUnitMix`) switch. Hide the whole Unit Mix block when `propertyType === 'land'`.
- **Include Rent Roll** (`marketing.includeRentRoll`, hidden when `propertyType === 'hospitality'`) reveals a Rent Roll table + **Syndicate Rent Roll** switch.
- **Unit Mix columns by type** (use `propertyType`): Multifamily → Unit Type, Bedrooms, Bathrooms, Count, Size, Rent, Min/Max/Market Rent, Security Deposit; Hospitality → "Room Type", Count, Size, Rack Rate, Description; other → Unit Type, Count, Size, Rent, Market Rent.
- **Rent Roll auto-fill:** on edit of size/ratePerSf/annualRent, run `autoFillRentRow` and write the result back to the row.

- [ ] **Step 1: Implement the Unit Mix table** as a repeatable-row editor (reuse `LineItemEditor`'s add/remove shape). Full code for the row-add + per-cell edit; render only the columns for the active type via a small `columnsFor(type)` helper local to the file.

- [ ] **Step 2: Implement the Rent Roll table** with the same repeatable pattern, wiring size/rate/annual through `autoFillRentRow`:

```tsx
const editRow = (id: string, patch: Partial<RentRollRow>) => {
  const next = financials.rentRoll.map((r) => {
    if (r.id !== id) return r;
    const merged = { ...r, ...patch };
    const filled = autoFillRentRow(merged.size ?? null, merged.rentPerSf ?? null, merged.annualRent ?? null);
    return { ...merged, size: filled.size, rentPerSf: filled.ratePerSf, annualRent: filled.annualRent };
  });
  patchFinancials({ rentRoll: next });
};
```

- [ ] **Step 3: Implement `UnitsSection.tsx`** assembling Number of Units, the include-toggles + reveals, and both tables per the behavior above.

- [ ] **Step 4: Thread `financials`/`patchFinancials`** through `ListingFormEditor` props (add to its prop type and to the call site in `DealMarketingEditor`), and render `<UnitsSection/>` after Building.

- [ ] **Step 5: Compile gate + manual note**

Run: `bun --bun run build`
Expected: success. Manual: toggling Include Unit Mix / Rent Roll reveals tables; Rent Roll auto-fill computes the third value; Unit Mix columns change with property type.

- [ ] **Step 6: Commit**

```bash
git add src/components/listings/edit/sections/UnitsSection.tsx src/components/listings/edit/ListingFormEditor.tsx src/components/deals/DealMarketingEditor.tsx
git commit -m "feat(listings): Units section — number of units, unit mix, rent roll with auto-fill"
```

---

## Task 10: Listing tab — Land section

**Files:**
- Create: `src/components/listings/edit/sections/LandSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `fieldWidgets`; `propertyTypeEffects` (Task 3).
- Produces: `LandSection`, `({ property, patchProperty }) => JSX`. Renders only when `propertyTypeEffects(property.propertyType).landSections` is true.

**Field inventory — Land:** Number of Lots (`numberOfLots`), Best Use (`bestUse`). **Additional Fields** accordion: Irrigation/Water/Telephone/Cable each = SelectField Y/N/NA + TextField description (`irrigation`+`irrigationDescription`, etc.), Sewer (SelectField Y/N/NA, `sewer`), Environmental Issues (`environmentalIssues`), Topography (`topography`), Soil Type (`soilType`), Easements Description (`easementsDescription`).

- [ ] **Step 1: Implement `LandSection.tsx`** per the inventory (a small `YesNoNaField` local helper wrapping `SelectField` with options `['Y','N','NA']`).
- [ ] **Step 2: Wire into `ListingFormEditor`** after Units, guarded by the land conditional, preceded by `<Separator/>`.
- [ ] **Step 3: Compile gate + manual note** — `bun --bun run build`; Manual: Land section appears only for Land property type.
- [ ] **Step 4: Commit**

```bash
git add src/components/listings/edit/sections/LandSection.tsx src/components/listings/edit/ListingFormEditor.tsx
git commit -m "feat(listings): Land section (Land property type only)"
```

---

## Task 11: Listing tab — Sale Marketing & Terms

**Files:**
- Create: `src/components/listings/edit/sections/SaleSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `fieldWidgets`; `PROPERTY_USES`, `INVESTMENT_TYPES` (copy the constants from `DealMarketingEditor.tsx:63-76`).
- Produces: `SaleSection`, `({ marketing, patchMarketing }) => JSX`. Renders only when `dealType === "Sale"`.

**Field inventory — Sale** (all on `marketing`): Sale Title (`saleTitle`), Sale Description textarea (`saleDescription`), Sale Bullets (`saleBullets` via `BulletsField`), Property Use (`propertyUse`), Investment Type (`investmentType`), Sale Terms textarea (`saleTerms`), Reimbursement (`reimbursement`), Sale Closing Info (`saleClosingInfo`), Includes Real Estate (`includesRealEstate` SwitchRow), Years Left on Lease (`yearsLeftOnLease`), NNN Lease Expiration (`nnnLeaseExpiration` DateField), Commission % (`saleCommissionPct`), Auction (`auction` SwitchRow) → reveals Auction Date/Time/Location/Starting Bid/URL (`auctionDate`/`auctionTime`/`auctionLocation`/`auctionStartingBid`/`auctionUrl`), Tax per Unit (`taxPerUnit`). **Additional Fields** accordion: Capital Costs (`capitalCosts`), Loan Due Date (`loanDueDate` DateField), Loan Description (`loanDescription`), Taxes (`taxes`), Tax Value Land/Improvements/Personal (`taxValueLand`/`taxValueImprovements`/`taxValuePersonal`), Assessed Value (`assessedValue`), 1031 Exchange (`exchange1031` Y/N/NA), Consider Exchange (`considerExchange` Y/N/NA), Land Ownership (`landOwnership`), Land Legal Description (`landLegalDescription` textarea).

- [ ] **Step 1: Implement `SaleSection.tsx`** per the inventory, with the Auction reveal (`{marketing.auction && (…)}`).
- [ ] **Step 2: Wire into `ListingFormEditor`** after Land, guarded by `dealType === "Sale"`, preceded by `<Separator/>`. (Pass `dealType` — already a prop.)
- [ ] **Step 3: Compile gate + manual note** — `bun --bun run build`; Manual: Sale section shows for Sale deals; Auction toggle reveals its fields.
- [ ] **Step 4: Commit**

```bash
git add src/components/listings/edit/sections/SaleSection.tsx src/components/listings/edit/ListingFormEditor.tsx
git commit -m "feat(listings): Sale Marketing & Terms section (Sale deals)"
```

---

## Task 12: Listing tab — Lots & Condos repeatable cards

**Files:**
- Create: `src/components/listings/edit/sections/LotsSection.tsx`
- Create: `src/components/listings/edit/sections/CondosSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `emptyLot`, `emptyCondo` (Task 2); `fieldWidgets`; `PROPERTY_STATUSES`, `STATUS_LABELS` (`#/components/properties/propertyDisplay`).
- Produces: `LotsSection` (`{ property, patchProperty }`), `CondosSection` (`{ property, patchProperty }`). Lots always present; Condos always present (entitlement assumed on).

**Lot card fields** (per `property.lots[i]`): Status (SelectField `PROPERTY_STATUSES`/`STATUS_LABELS`) → Close Date + Buyer/Referral shown when `status === 'closed'`; Lot Number, Address, APN, Subtype (SelectField ALL_SUBTYPES nullable), Sale Price + Price Units (`Total/SF/SqM/Acre/Hectare`), Size + Units, Description textarea, Zoning.

**Condo card fields** (per `property.condos[i]`): Status → Close Date when closed; Address 2 (`addressUnit`), Sale Price + Price Units (`Total/SF/SqM`), Hide Price (SwitchRow) → `hidePriceLabel` when checked, Size + Units (`Sq Ft`/`Sq Meters`), Description.

- [ ] **Step 1: Implement a generic repeatable-card shell** in `LotsSection.tsx` (add/remove/duplicate, reuse the move buttons from `ScenarioEditor`); render each Lot's fields inside a bordered card.
- [ ] **Step 2: Implement `CondosSection.tsx`** with the same card shell for condos.
- [ ] **Step 3: Wire both into `ListingFormEditor`** after Sale, each preceded by `<Separator/>`.
- [ ] **Step 4: Compile gate + manual note** — `bun --bun run build`; Manual: add/remove lot & condo cards; Close Date reveals on Closed status.
- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/sections/LotsSection.tsx src/components/listings/edit/sections/CondosSection.tsx src/components/listings/edit/ListingFormEditor.tsx
git commit -m "feat(listings): Lots + Condos repeatable card sections"
```

---

## Task 13: Listing tab — Lease Marketing & Lease Spaces

**Files:**
- Create: `src/components/listings/edit/sections/LeaseSection.tsx`
- Create: `src/components/listings/edit/sections/LeaseSpacesSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `emptySpaceLeaseTerms` (extended, Task 2); `fieldWidgets`; the existing `UnitLeaseCard` logic (`DealMarketingEditor.tsx:597-814`) as the starting point for the per-space card; `LEASE_RATE_UNITS`, `LEASE_TYPES` constants.
- Produces: `LeaseSection` (`{ marketing, patchMarketing }`), `LeaseSpacesSection` (`{ property, marketing, patchMarketing }`). Both render only when `dealType === "Lease"`.

**Lease field inventory** (on `marketing`): Lease Title (`leaseTitle`), Lease Closing Information (`leaseClosingInformation`), Lease Description textarea (`leaseDescription`), Lease Bullets (`leaseBullets`), Commission Split % (`leaseCommissionSplitPct`), Available SF Term (`availableSfTerm` SelectField `SF`/`RSF`).

**Lease Spaces** — move `UnitLeaseCard` into `LeaseSpacesSection.tsx` and **extend it** with the new `SpaceLeaseTerms` fields:
- Header row: Status chips (SelectField Active/Under Contract/Closed/Inactive) + Close Date (when Closed).
- Space Type (SelectField ALL_SUBTYPES) + label override; Tenant Name (required when Major Tenant); Major Tenant SwitchRow; Space Name / Suite / Floor / Zip+4.
- Lease Rate Units + label override; Lease Rate mode (SelectField Flat/Range/Hidden) → Range reveals `leaseRateTo`, Hidden reveals `leaseRateUnitLabelOverride`.
- Space Size + Units; Lease Type + label override; Sublease SwitchRow → `subleaseExpiration`; Ceiling Height.
- Industrial cluster (when `property.propertyType === 'industrial'`): Previous Usage, Office Space, Grade Level/Dock High Doors, Drive-In Bays, Cranes, Power Description.
- **Additional Fields** accordion: Sale Price, Warehouse Allotment %, Parking Spaces, Conference Rooms, Offices, Furnished, Heating/Cooling/Lighting (Y/N/NA + desc), HVAC Tonnage, Rent Concession, Lease Terms text (plus the already-present tax/CAM/insurance/etc. fields).
- **Rule:** when `property.tenancy !== 'Single'`, Suite/Address is required per space (add a `required` visual hint — a red `*` in the label; no hard validation needed for the prototype).

- [ ] **Step 1: Implement `LeaseSection.tsx`** per the Lease inventory.
- [ ] **Step 2: Move + extend `UnitLeaseCard` into `LeaseSpacesSection.tsx`**, keeping the existing accordion-of-units structure (`property.units.map`), adding the new fields grouped as above. Keep the existing `patchUnitTerms`/`termsForUnit` logic (move it into this section, sourcing from `marketing.spaceLeaseTerms`).
- [ ] **Step 3: Wire both into `ListingFormEditor`** after Condos, guarded by `dealType === "Lease"`, each preceded by `<Separator/>`.
- [ ] **Step 4: Compile gate + manual note** — `bun --bun run build`; Manual: Lease sections show for Lease deals; Lease Rate mode reveals; industrial cluster shows for Industrial.
- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/sections/LeaseSection.tsx src/components/listings/edit/sections/LeaseSpacesSection.tsx src/components/listings/edit/ListingFormEditor.tsx src/components/deals/DealMarketingEditor.tsx
git commit -m "feat(listings): Lease Marketing + expanded Lease Spaces sections"
```

---

## Task 14: Listing tab — Marketing Visibility + Buyer

**Files:**
- Create: `src/components/listings/edit/sections/MarketingVisibilitySection.tsx`
- Create: `src/components/listings/edit/sections/BuyerSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `saleChannelsFor`, `leaseChannelsFor`, `showBuyerSection` (Task 3); `getStore`/contacts for the buyer lookup (`#/data/store`).
- Produces: `MarketingVisibilitySection` (`{ dealType, status, marketing, patchMarketing }`), `BuyerSection` (`{ dealType, status, marketing, patchMarketing }`).

**Marketing Visibility behavior:**
- For Sale deals: render channel options from `saleChannelsFor(status)` as selectable cards (radio-style; reuse `SelectField` or a simple button group) bound to `marketing.saleMarketingChannel`. Buyer Network ⇄ Syndication mutual exclusion (selecting one is inherent to single-select). Show a note that Investment Type becomes required when Buyer Network is selected.
- For Lease deals: options from `leaseChannelsFor(status)` bound to `marketing.leaseMarketingChannel`.
- Both: **Hide from Non-Listing Brokers** SwitchRow (`hideFromNonListingBrokers`); a read-only disconnect warning line shown when the current channel is Syndication or Buyer Network.
- On any change, also mirror into legacy `marketing.marketingChannel` (write the active track's channel) so downstream readers keep working.

**Buyer behavior:** render only when `showBuyerSection(dealType, status)`. Buyer = SelectField over contact options (`getStore().contacts`), bound to `marketing.buyerContactId`; Referral Source = TextField (`referralSource`).

- [ ] **Step 1: Implement `MarketingVisibilitySection.tsx`** per the behavior. Example channel group (single-select buttons):

```tsx
const channels = dealType === "Sale" ? saleChannelsFor(status) : leaseChannelsFor(status);
const current = dealType === "Sale" ? marketing.saleMarketingChannel : marketing.leaseMarketingChannel;
const pick = (c: MarketingChannel) =>
  patchMarketing(dealType === "Sale"
    ? { saleMarketingChannel: c, marketingChannel: c }
    : { leaseMarketingChannel: c, marketingChannel: c });
// render channels.map(c => <Button variant={c===current?'primary':'outline'} onClick={()=>pick(c)}>{c}</Button>)
```

- [ ] **Step 2: Implement `BuyerSection.tsx`** per the behavior.
- [ ] **Step 3: Wire both into `ListingFormEditor`** after the Lease sections, each preceded by `<Separator/>`.
- [ ] **Step 4: Compile gate + manual note** — `bun --bun run build`; Manual: channel options change with status; Buyer section appears only at Sale + Under Contract.
- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/sections/MarketingVisibilitySection.tsx src/components/listings/edit/sections/BuyerSection.tsx src/components/listings/edit/ListingFormEditor.tsx
git commit -m "feat(listings): Marketing Visibility (status-gated channels) + Buyer section"
```

---

## Task 15: Listing tab — Visual Media + Disclaimer & Notes

**Files:**
- Create: `src/components/listings/edit/sections/VisualMediaSection.tsx`
- Create: `src/components/listings/edit/sections/DisclaimerNotesSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `emptyVisualMediaLink` (Task 2); `fieldWidgets`.
- Produces: `VisualMediaSection` (`{ marketing, patchMarketing }`), `DisclaimerNotesSection` (`{ listing, marketing, patchMarketing }`).

**Visual Media:** repeatable rows on `marketing.visualMedia`: Public URL (TextField) + Media Type (SelectField over the 7 `VisualMediaType` options, default "Interactive Site Plan"); add/remove.

**Disclaimer & Notes:** Override Disclaimer (SwitchRow `overrideDisclaimer`) → reveals Custom Disclaimer textarea (`customDisclaimer`); Internal Notes textarea (bound to `listing.internalNotes` — thread an `internalNotes`/`setInternalNotes` state from `DealMarketingEditor`, or add `internalNotes` to the save patch); Admin Notes textarea (`marketing.adminNotes`); External ID (read-only `Input`, `marketing.externalId`).

> Internal Notes lives on `Listing`, not `marketing`. Add `internalNotes` to `DealMarketingEditor`'s working state and include it in the `updateDeal` save patch; pass it + its setter down.

- [ ] **Step 1: Implement `VisualMediaSection.tsx`** (repeatable rows).
- [ ] **Step 2: Add `internalNotes` working state** to `DealMarketingEditor` and include it in `save`'s `updateDeal` patch.
- [ ] **Step 3: Implement `DisclaimerNotesSection.tsx`** per the inventory.
- [ ] **Step 4: Wire both into `ListingFormEditor`** at the end, each preceded by `<Separator/>`; thread `internalNotes`/`setInternalNotes` props through.
- [ ] **Step 5: Compile gate + manual note** — `bun --bun run build`; Manual: add media rows; Override Disclaimer reveals the textarea; Internal Notes persists on Save.
- [ ] **Step 6: Commit**

```bash
git add src/components/listings/edit/sections/VisualMediaSection.tsx src/components/listings/edit/sections/DisclaimerNotesSection.tsx src/components/listings/edit/ListingFormEditor.tsx src/components/deals/DealMarketingEditor.tsx
git commit -m "feat(listings): Visual Media + Disclaimer & Notes sections"
```

---

## Task 16: Seed a few new fields + full verification pass

**Files:**
- Modify: `src/data/seed.ts` (light touch)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Seed representative values** — in `seed.ts`, set a handful of new fields on one or two seeded properties/listings so the form isn't entirely blank on demo (e.g. `country: 'United States'`, `measurementSystem: 'Imperial'`, `tenancy: 'Multiple'`, one `lots`/`condos`/`unitMix`/`visualMedia` entry). Keep it minimal; all fields are optional so this is purely demo polish.

- [ ] **Step 2: Run the full test suite**

Run: `bun --bun run test`
Expected: PASS (all data-layer tests green).

- [ ] **Step 3: Full build**

Run: `bun --bun run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Manual walkthrough (hand off to user)**

Ask the user to open `/listings/<id>/edit` for a Sale deal and a Lease deal and confirm: two tabs; Deal tab (status/brokers/transaction/financials, Deal Type read-only); Listing tab renders every section with the right Sale-vs-Lease gating and type/status-driven conditionals; Save persists both property and listing changes and returns to overview.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed.ts
git commit -m "chore(data): seed representative listing-form fields for demo"
```

---

## Self-Review

**Spec coverage** — every design-doc section maps to a task:
- Page structure / two-tab shell → Task 6. Shared field widgets → Task 5.
- Data model (Property/DealMarketing/SpaceLeaseTerms/RentRollRow + new types) → Task 1; builders → Task 2.
- Conditional logic → Task 3; financial calcs / auto-fill → Task 4.
- Deal tab + expanded Financials → Task 6.
- Listing sections: Location/Transit → 7; Property/Building → 8; Units (Unit Mix + Rent Roll) → 9; Land → 10; Sale → 11; Lots/Condos → 12; Lease + Lease Spaces → 13; Marketing Visibility + Buyer → 14; Visual Media + Disclaimer & Notes → 15.
- Seeding + verification → Task 16.
- Prototype simplifications (entitlements on, currency/measurement selectors only, static transit, inline disclaimer, skipped invite/address-correction) → honored across Tasks 7–15 (no company-toggle or relabeling code written).

**Placeholder scan** — data/logic tasks carry complete code + tests; UI tasks carry exact field tables + concrete code for each novel pattern (repeatable type rows, rent-roll auto-fill wiring, channel group), with the shared field-wrapper convention stated in Global Constraints. No "TBD"/"handle edge cases"/"similar to Task N".

**Type consistency** — record shapes in Task 1 match the builders in Task 2 and every field path referenced in Tasks 7–15; helper signatures in Tasks 3–4 match their call sites in Tasks 6, 9, 14. `marketingChannel` legacy mirroring is written in Task 14 and preserved in the Task 6 save patch.
