import { faker } from '@faker-js/faker'
import type {
  Property,
  Listing,
  ListingStage,
  DealBroker,
  DealHistoryEntry,
  DealInvoice,
  FinancialDeduction,
  FinancialReceivable,
  VoucherDeposit,
  VoucherPayable,
  VoucherPayment,
  DealTask,
  DealTaskStatus,
  DealType,
  Comp,
  Contact,
  PropertyType,
  PropertySubtype,
  BuildingClass,
  CompType,
  CompSource,
  ContactRole,
  ContactSource,
  RelationshipStage,
  DealSide,
  ContactDealStage,
  PhoneStatus,
  PropertyUnit,
  UnitType,
  UnitSaleEvent,
  PropertyFinancialRecord,
  FinancialRecordSource,
  RentRollRow,
  HeroKey,
  OwnerSignal,
  PropertyStatus,
  Lot,
  Condo,
  UnitMixRow,
  VisualMediaLink,
  VoucherApproval,
} from './types'
import type { CallList } from './contactLists'
import type { SerializedContactFilters } from '#/components/contacts/contactFilterModel'
import { reconcileContactDealFields } from './contactStage'
import {
  CURRENT_USER,
  TEAMMATES,
  VOUCHER_APPROVER_IDS,
  type AccessTier,
  type ContactShare,
} from './teammates'
import {
  DEFAULT_PERSONAL_SPLIT_PCT,
  STAGE_CLOSE_PROBABILITY,
  splitNetCommission,
} from './commission'
import type { CommissionPlan, DeductionCategory, VoucherStatus } from './vouchers'
import {
  invoiceDueDate,
  invoiceFileName,
  invoiceLineItems,
  invoicePayerFileLabel,
} from './invoices'
import { generateDepositReference } from './deposits'
import { payablesForDeposit } from './payables'
import { isQuickbooksSynced } from './quickbooks'
import { applyLeaseSpaces } from './leaseSpaceFixtures'

const SEED = 20240101
/** Properties that carry a deal — must stay equal to `DEAL_PIPELINE.length`. */
const PROPERTY_COUNT = 24
/**
 * Properties with no deal on them at all. A brokerage's database is mostly
 * these: buildings it tracks, owns a relationship on, or picked up from
 * prospecting. They exist so "no deal" is a visible, ordinary state in the
 * Properties list rather than an edge case you only reach by adding a prospect.
 */
const TRACKED_PROPERTY_COUNT = 8
const CONTACT_COUNT = 80

/**
 * The seeded deal pipeline — one deal per property, at an explicit stage, so
 * the Deals table reads like a real brokerage book rather than a random spread.
 * ~24 deals weighted toward the top of the funnel: several pitching, a few
 * active, a couple under contract, and a handful each closed and lost.
 *
 * Order and length are load-bearing: `PROPERTY_COUNT` matches this list, each
 * property is assigned `DEAL_PIPELINE[i]`, and the hero personas (see
 * `applyHeroes`) claim a deal by stage — Earl→proposal(Sale), Victor→active,
 * Margaret→under-contract, Patricia→closed — so every hero-required stage/type
 * must appear here. Deal types are explicit (not random) so Earl always lands
 * a Sale and the mix stays believable.
 */
type DealPipelineEntry = (
  | { stage: Exclude<ListingStage, 'closed'>; dealType: DealType }
  /**
   * Closed is the one stage whose voucher can be anywhere in its lifecycle, so
   * it is the one stage that names the state. A union rather than an optional
   * field: the compiler then refuses a closed row that forgot to say.
   */
  | { stage: 'closed'; dealType: DealType; voucherStatus: VoucherStatus }
) & {
  /**
   * Renders this deal in classic mode. Set on the pipeline row rather than drawn
   * per deal so which deal is classic is readable here and identical every run —
   * a faker draw would also reshuffle every seeded value after it.
   */
  isClassic?: true
}

const DEAL_PIPELINE: DealPipelineEntry[] = [
  // Pitching — several (Earl claims a Sale here)
  // The first row is the one classic deal in the book — see `isClassic` on
  // DealPipelineEntry. Exactly one, and it is first so it is easy to find.
  { stage: 'proposal', dealType: 'Sale', isClassic: true },
  { stage: 'proposal', dealType: 'Sale' },
  { stage: 'proposal', dealType: 'Lease' },
  { stage: 'proposal', dealType: 'Sale' },
  { stage: 'proposal', dealType: 'Lease' },
  { stage: 'proposal', dealType: 'Sale' },
  // Active — a few (Victor claims one)
  { stage: 'active', dealType: 'Sale' },
  { stage: 'active', dealType: 'Lease' },
  { stage: 'active', dealType: 'Sale' },
  { stage: 'active', dealType: 'Sale' },
  // Under contract — a couple (Margaret claims one, buy-side)
  { stage: 'under-contract', dealType: 'Sale' },
  { stage: 'under-contract', dealType: 'Sale' },
  // Closed — eight, each naming the voucher state it lands in (Patricia claims
  // the first). Named per row rather than drawn or cycled on a modulus: at this
  // sample size a draw leaves whole states unreachable on some runs, and a
  // modulus makes you run the seed to find out what the book looks like.
  //
  // Eight rather than the four this used to hold, because only Closed deals can
  // be Pending or Approved now — at four, two of the three states had a single
  // voucher behind them and the Back Office index read as a rounding error
  // rather than a queue. The mix is 3 Approved / 3 Pending / 2 Draft.
  //
  // Approved sits first so Patricia's closed deal reads as finished.
  //
  // Exactly one closed Lease, and it is a Draft. A Lease carries `salePrice` 0,
  // so its commission is 0 and the receivables block skips it — which makes an
  // empty voucher. Empty is a fine thing for a Draft to be and a wrong thing for
  // a Pending or an Approved one: nothing but invoices is supposed to be
  // outstanding by the time a broker submits. So every Pending and Approved row
  // here is a Sale, with money on it. The Lease stays because a closed lease deal
  // is a shape the app has to keep handling.
  { stage: 'closed', dealType: 'Sale', voucherStatus: 'Approved' },
  { stage: 'closed', dealType: 'Lease', voucherStatus: 'Draft' },
  { stage: 'closed', dealType: 'Sale', voucherStatus: 'Pending' },
  { stage: 'closed', dealType: 'Sale', voucherStatus: 'Approved' },
  { stage: 'closed', dealType: 'Sale', voucherStatus: 'Pending' },
  { stage: 'closed', dealType: 'Sale', voucherStatus: 'Approved' },
  { stage: 'closed', dealType: 'Sale', voucherStatus: 'Pending' },
  { stage: 'closed', dealType: 'Sale', voucherStatus: 'Draft' },
  // Lost — some
  { stage: 'inactive', dealType: 'Sale' },
  { stage: 'inactive', dealType: 'Sale' },
  { stage: 'inactive', dealType: 'Lease' },
  { stage: 'inactive', dealType: 'Sale' },
]

/** Human label per property type — kept local so the seed stays display-layer free. */
const TYPE_LABEL: Record<PropertyType, string> = {
  office: 'Office',
  retail: 'Retail',
  industrial: 'Industrial',
  multifamily: 'Multifamily',
  'mixed-use': 'Mixed-Use',
  land: 'Land',
  hospitality: 'Hospitality',
  'special-purpose': 'Special Purpose',
}

// ── Market lookup tables ──────────────────────────────────────────────────────

const CRE_MARKETS = [
  {
    city: 'Dallas', state: 'TX', county: 'Dallas',
    schoolDistrict: 'Dallas ISD',
    submarkets: ['Uptown', 'CBD', 'Frisco', 'Las Colinas', 'Deep Ellum'],
    municipalities: ['Dallas', 'Frisco', 'Plano', 'Irving', 'Addison'],
    latMin: 32.68, latMax: 33.10, lngMin: -97.00, lngMax: -96.55,
  },
  {
    city: 'Houston', state: 'TX', county: 'Harris',
    schoolDistrict: 'Houston ISD',
    submarkets: ['Galleria', 'Greenway Plaza', 'Energy Corridor', 'Medical Center'],
    municipalities: ['Houston', 'Sugar Land', 'Katy', 'The Woodlands', 'Pearland'],
    latMin: 29.60, latMax: 30.10, lngMin: -95.70, lngMax: -95.15,
  },
  {
    city: 'Austin', state: 'TX', county: 'Travis',
    schoolDistrict: 'Austin ISD',
    submarkets: ['CBD', 'Domain', 'South Congress', 'East Austin'],
    municipalities: ['Austin', 'Round Rock', 'Cedar Park', 'Pflugerville', 'Buda'],
    latMin: 30.15, latMax: 30.55, lngMin: -97.90, lngMax: -97.55,
  },
  {
    city: 'Chicago', state: 'IL', county: 'Cook',
    schoolDistrict: 'Chicago Public Schools',
    submarkets: ['Loop', 'River North', 'West Loop', 'Fulton Market', 'Suburban'],
    municipalities: ['Chicago', 'Naperville', 'Schaumburg', 'Oak Brook', 'Rosemont'],
    latMin: 41.73, latMax: 42.05, lngMin: -87.90, lngMax: -87.55,
  },
  {
    city: 'Phoenix', state: 'AZ', county: 'Maricopa',
    schoolDistrict: 'Phoenix Union High School District',
    submarkets: ['Tempe', 'Scottsdale', 'Chandler', 'CBD', 'Camelback Corridor'],
    municipalities: ['Phoenix', 'Scottsdale', 'Tempe', 'Chandler', 'Mesa'],
    latMin: 33.35, latMax: 33.65, lngMin: -112.30, lngMax: -111.80,
  },
  {
    city: 'Denver', state: 'CO', county: 'Denver',
    schoolDistrict: 'Denver Public Schools',
    submarkets: ['LoDo', 'Cherry Creek', 'Platte Valley', 'Tech Center'],
    municipalities: ['Denver', 'Aurora', 'Lakewood', 'Englewood', 'Centennial'],
    latMin: 39.65, latMax: 39.90, lngMin: -105.10, lngMax: -104.80,
  },
  {
    city: 'Atlanta', state: 'GA', county: 'Fulton',
    schoolDistrict: 'Atlanta Public Schools',
    submarkets: ['Buckhead', 'Midtown', 'Cumberland/Galleria', 'Perimeter'],
    municipalities: ['Atlanta', 'Sandy Springs', 'Marietta', 'Dunwoody', 'Alpharetta'],
    latMin: 33.68, latMax: 33.92, lngMin: -84.55, lngMax: -84.25,
  },
  {
    city: 'Nashville', state: 'TN', county: 'Davidson',
    schoolDistrict: 'Metro Nashville Public Schools',
    submarkets: ['CBD', 'Brentwood', 'Cool Springs', 'Germantown'],
    municipalities: ['Nashville', 'Brentwood', 'Franklin', 'Murfreesboro', 'Hendersonville'],
    latMin: 36.05, latMax: 36.25, lngMin: -86.95, lngMax: -86.65,
  },
  {
    city: 'Charlotte', state: 'NC', county: 'Mecklenburg',
    schoolDistrict: 'Charlotte-Mecklenburg Schools',
    submarkets: ['Uptown', 'SouthPark', 'Ballantyne', 'Airport'],
    municipalities: ['Charlotte', 'Concord', 'Gastonia', 'Mooresville', 'Matthews'],
    latMin: 35.10, latMax: 35.35, lngMin: -80.95, lngMax: -80.70,
  },
  {
    city: 'Raleigh', state: 'NC', county: 'Wake',
    schoolDistrict: 'Wake County Schools',
    submarkets: ['CBD', 'North Hills', 'Research Triangle', 'Brier Creek'],
    municipalities: ['Raleigh', 'Cary', 'Durham', 'Chapel Hill', 'Apex'],
    latMin: 35.70, latMax: 35.90, lngMin: -78.75, lngMax: -78.55,
  },
]

// ── Property type configuration ───────────────────────────────────────────────

type PropertyConfig = {
  subtypes: PropertySubtype[]
  sqFtRange: [number, number]
  storiesRange: [number, number]
  pricePerSqFt: [number, number]
  capRateRange: [number, number]
  expenseRatio: [number, number]
  vacancyRange: [number, number]
  zoningOptions: string[]
  exteriorWalls: string[]
  buildingStyles: string[]
  heatingTypes: string[]
  useCodes: string[]
  basementProbability: number
}

const PROPERTY_CONFIGS: Record<PropertyType, PropertyConfig> = {
  office: {
    subtypes: ['Single Tenant', 'Multi-Tenant', 'Medical', 'Creative/Loft'],
    sqFtRange: [5000, 300000],
    storiesRange: [1, 20],
    pricePerSqFt: [150, 500],
    capRateRange: [0.05, 0.085],
    expenseRatio: [0.35, 0.50],
    vacancyRange: [0.05, 0.20],
    zoningOptions: ['O-1', 'O-2', 'C-2', 'MU', 'B-2'],
    exteriorWalls: ['Brick', 'Glass Curtain Wall', 'Concrete Panel', 'Metal Panel', 'Stucco'],
    buildingStyles: ['Contemporary', 'Modern', 'Class A Tower', 'Garden Office', 'Campus'],
    heatingTypes: ['Central HVAC', 'Heat pump', 'Variable Air Volume (VAV)', 'Rooftop Unit'],
    useCodes: ['OFFIC', 'MEDOF', 'CREOF'],
    basementProbability: 0.3,
  },
  retail: {
    subtypes: ['Strip Center', 'Power Center', 'Neighborhood Center', 'Freestanding', 'Storefront'],
    sqFtRange: [1200, 80000],
    storiesRange: [1, 3],
    pricePerSqFt: [200, 700],
    capRateRange: [0.045, 0.075],
    expenseRatio: [0.20, 0.40],
    vacancyRange: [0.03, 0.12],
    zoningOptions: ['C-1', 'C-2', 'C-3', 'NMU', 'B-3'],
    exteriorWalls: ['Brick', 'Stucco', 'EIFS', 'Glass Storefront', 'Concrete Block'],
    buildingStyles: ['Conventional', 'Strip Mall', 'Pad Site', 'Power Center', 'Big Box'],
    heatingTypes: ['Forced air unit', 'Rooftop Unit', 'Heat pump', 'Split System'],
    useCodes: ['RETL', 'COMM', 'SHOP'],
    basementProbability: 0.1,
  },
  industrial: {
    subtypes: ['Warehouse', 'Flex', 'Distribution', 'Manufacturing', 'Cold Storage', 'Industrial Outdoor Storage'],
    sqFtRange: [10000, 500000],
    storiesRange: [1, 3],
    pricePerSqFt: [80, 200],
    capRateRange: [0.04, 0.065],
    expenseRatio: [0.15, 0.30],
    vacancyRange: [0.02, 0.08],
    zoningOptions: ['M-1', 'M-2', 'LI', 'HI', 'I-1'],
    exteriorWalls: ['Metal Panel', 'Concrete Block', 'Tilt-Up Concrete', 'Masonry', 'Pre-Cast Concrete'],
    buildingStyles: ['Tilt-Up', 'Metal Building', 'Masonry', 'Clear Span', 'Multi-Tenant Flex'],
    heatingTypes: ['Unit heater', 'Forced air unit', 'Radiant heat', 'None'],
    useCodes: ['INDUS', 'WRHSE', 'MFGNG', 'FLEX'],
    basementProbability: 0.05,
  },
  multifamily: {
    subtypes: ['Low-Rise/Garden', 'Mid-Rise', 'High-Rise', 'Townhouse', 'Duplex', 'Triplex', 'Fourplex'],
    sqFtRange: [2000, 400000],
    storiesRange: [1, 20],
    pricePerSqFt: [100, 350],
    capRateRange: [0.04, 0.065],
    expenseRatio: [0.35, 0.55],
    vacancyRange: [0.03, 0.10],
    zoningOptions: ['R-3', 'R-4', 'MF', 'MU', 'RM-2'],
    exteriorWalls: ['Brick', 'Siding (Alum/Vinyl)', 'Stucco', 'Fiber Cement', 'Wood Frame'],
    buildingStyles: ['Conventional', 'Garden Style', 'Wrap', 'Podium', 'Townhome'],
    heatingTypes: ['Forced air unit', 'Heat pump', 'Baseboard', 'Radiant floor'],
    useCodes: ['FOURFAM', 'MULTIFAM', 'APTS', 'DUPLEX', 'TRIPLEX'],
    basementProbability: 0.45,
  },
  'mixed-use': {
    subtypes: ['Mixed-Use'],
    sqFtRange: [3000, 150000],
    storiesRange: [2, 12],
    pricePerSqFt: [175, 500],
    capRateRange: [0.045, 0.075],
    expenseRatio: [0.30, 0.48],
    vacancyRange: [0.04, 0.15],
    zoningOptions: ['MU', 'MU-2', 'C-MU', 'T5', 'MXD'],
    exteriorWalls: ['Brick', 'Glass Curtain Wall', 'Stucco', 'Metal Panel', 'Concrete'],
    buildingStyles: ['Contemporary', 'Urban Mixed-Use', 'Live-Work', 'Transit-Oriented'],
    heatingTypes: ['Central HVAC', 'Heat pump', 'Variable Air Volume (VAV)'],
    useCodes: ['MIXDU', 'COMM'],
    basementProbability: 0.25,
  },
  land: {
    subtypes: ['Vacant Land'],
    sqFtRange: [5000, 2000000],
    storiesRange: [0, 0],
    pricePerSqFt: [5, 150],
    capRateRange: [0, 0],
    expenseRatio: [0, 0.05],
    vacancyRange: [1, 1],
    zoningOptions: ['A-1', 'C-1', 'R-2', 'PUD', 'AG'],
    exteriorWalls: [],
    buildingStyles: ['Vacant'],
    heatingTypes: [],
    useCodes: ['VACL', 'AGLAND'],
    basementProbability: 0,
  },
  hospitality: {
    subtypes: ['Hotel', 'Motel'],
    sqFtRange: [10000, 250000],
    storiesRange: [2, 20],
    pricePerSqFt: [100, 400],
    capRateRange: [0.06, 0.10],
    expenseRatio: [0.50, 0.70],
    vacancyRange: [0.20, 0.40],
    zoningOptions: ['C-2', 'C-3', 'PUD', 'H-1'],
    exteriorWalls: ['Brick', 'Stucco', 'EIFS', 'Glass Curtain Wall', 'Concrete'],
    buildingStyles: ['Contemporary', 'Conventional', 'Boutique', 'Extended Stay'],
    heatingTypes: ['Central HVAC', 'PTAC Units', 'Heat pump'],
    useCodes: ['HOTEL', 'MOTEL'],
    basementProbability: 0.15,
  },
  'special-purpose': {
    subtypes: ['Self-Storage', 'Medical'],
    sqFtRange: [2000, 100000],
    storiesRange: [1, 5],
    pricePerSqFt: [80, 300],
    capRateRange: [0.055, 0.09],
    expenseRatio: [0.35, 0.55],
    vacancyRange: [0.05, 0.15],
    zoningOptions: ['P', 'SP', 'PUD', 'I'],
    exteriorWalls: ['Metal Panel', 'Concrete Block', 'Brick', 'Stucco'],
    buildingStyles: ['Conventional', 'Metal Building', 'Medical Campus', 'Flex'],
    heatingTypes: ['Forced air unit', 'Heat pump', 'Unit heater', 'None'],
    useCodes: ['SPECL', 'MEDCL', 'STOR'],
    basementProbability: 0.1,
  },
}

// ── Property name generation ──────────────────────────────────────────────────

const NAME_PARTS: Record<PropertyType, { prefixes: string[]; suffixes: string[] }> = {
  office: {
    prefixes: ['Meridian', 'Summit', 'Pinnacle', 'Vantage', 'Liberty', 'Cascade', 'Apex', 'Horizon'],
    suffixes: ['Business Park', 'Office Park', 'Corporate Center', 'Plaza', 'Tower', 'Centre', 'Commons'],
  },
  retail: {
    prefixes: ['Shoppes at', 'The', 'Village at', 'Market at', 'Gateway', 'Heritage'],
    suffixes: ['Crossing', 'Commons', 'Square', 'Center', 'Plaza', 'Marketplace'],
  },
  industrial: {
    prefixes: ['Northgate', 'Westport', 'Ironwood', 'Summit', 'Commerce', 'Gateway', 'Patriot'],
    suffixes: ['Logistics Center', 'Distribution Center', 'Business Park', 'Industrial Park', 'Commerce Park', 'Storage Yard'],
  },
  multifamily: {
    prefixes: ['The', 'Park at', 'Residences at', 'Villas at', 'Heights at', 'Reserve at'],
    suffixes: ['Apartments', 'Lofts', 'Residences', 'Villas', 'Commons', 'Place'],
  },
  'mixed-use': {
    prefixes: ['The', 'Urban', 'District', 'Central', 'Metro', 'City'],
    suffixes: ['District', 'Quarter', 'Exchange', 'Commons', 'Works'],
  },
  land: {
    prefixes: ['North', 'South', 'East', 'West', 'Heritage'],
    suffixes: ['Tract', 'Acreage', 'Development Site', 'Land', 'Parcel'],
  },
  hospitality: {
    prefixes: ['Grand', 'Marquee', 'Heritage', 'Premier', 'Signature', 'Prestige'],
    suffixes: ['Hotel', 'Suites', 'Inn & Suites', 'Conference Center', 'Lodging'],
  },
  'special-purpose': {
    prefixes: ['Metro', 'Central', 'Regional', 'Premier', 'Advanced', 'National'],
    suffixes: ['Medical Plaza', 'Flex Center', 'Self-Storage', 'Event Center', 'Campus'],
  },
}

// ── Plat/subdivision names for legal descriptions ─────────────────────────────

const SUBDIVISION_NAMES = [
  'BEACON LAKE', 'RIVERSIDE COMMONS', 'OAK GROVE', 'PINEHURST', 'LAKEWOOD HEIGHTS',
  'COMMERCE PARK', 'HERITAGE SQUARE', 'SUMMIT RIDGE', 'WILLOW CREEK', 'NORTHGATE',
  'EASTFIELD', 'WESTVIEW', 'SOUTHPARK', 'CEDAR HOLLOW', 'MAPLE RIDGE', 'STONE BRIDGE',
]

// ── Generator helpers ─────────────────────────────────────────────────────────

function round(n: number, to = 1000): number {
  return Math.round(n / to) * to
}

function generatePropertyName(type: PropertyType): string {
  const { prefixes, suffixes } = NAME_PARTS[type]
  return `${faker.helpers.arrayElement(prefixes)} ${faker.helpers.arrayElement(suffixes)}`
}

function generateLegalDescription(): string {
  const lot = faker.number.int({ min: 1, max: 999 })
  const sub = faker.helpers.arrayElement(SUBDIVISION_NAMES)
  const year = faker.number.int({ min: 1990, max: 2023 })
  const seq = String(faker.number.int({ min: 1, max: 999 })).padStart(5, '0')
  return `LO${lot} ${sub} SUB BM${year}-${seq}`
}

// ── Property children (units + financial records) ─────────────────────────────

function generateUnits(
  propertyType: PropertyType,
  buildingSqFt: number,
  residentialUnits: number | null,
  pricePerSf: number,
): PropertyUnit[] {
  const unitType: UnitType =
    propertyType === 'multifamily'
      ? 'residential'
      : propertyType === 'office' || propertyType === 'retail' || propertyType === 'industrial'
        ? propertyType
        : 'other'

  // Multifamily: a handful of residential shells. Everything else: 1–3 commercial suites.
  const count =
    propertyType === 'multifamily'
      ? Math.min(residentialUnits ?? 4, 6)
      : faker.helpers.weightedArrayElement([
          { weight: 60, value: 1 },
          { weight: 28, value: 2 },
          { weight: 12, value: 3 },
        ])
  const per = Math.max(400, Math.round(buildingSqFt / count))

  return Array.from({ length: count }, (_, i): PropertyUnit => {
    const residential = unitType === 'residential'
    return {
      id: faker.string.uuid(),
      label: residential ? `Unit ${i + 1}` : `Suite ${(i + 1) * 100}`,
      unitType,
      sqft: per,
      beds: residential ? faker.number.int({ min: 1, max: 3 }) : null,
      baths: residential ? faker.number.int({ min: 1, max: 2 }) : null,
      suite: residential ? null : `${(i + 1) * 100}`,
      floor: residential ? null : faker.number.int({ min: 1, max: 5 }),
      ceilingHeight: residential ? null : faker.number.int({ min: 9, max: 16 }),
      offices: residential ? null : faker.number.int({ min: 0, max: 6 }),
      conferenceRooms: residential ? null : faker.number.int({ min: 0, max: 2 }),
      furnished: !residential && faker.datatype.boolean({ probability: 0.25 }),
      occupancy: 'vacant',
      tenantName: null,
      leaseExpiration: null,
      saleHistory: generateUnitSaleHistory(per, pricePerSf),
    }
  })
}

/**
 * A unit's prior sales, newest first. Each older sale is a couple of years further
 * back and priced a little lower, so the ownership history trends up toward today.
 * Some units have never traded separately (empty history).
 */
function generateUnitSaleHistory(sqft: number, pricePerSf: number): UnitSaleEvent[] {
  const count = faker.helpers.weightedArrayElement([
    { weight: 25, value: 0 },
    { weight: 35, value: 1 },
    { weight: 25, value: 2 },
    { weight: 15, value: 3 },
  ])
  let year = 2026
  const pad = (n: number) => String(n).padStart(2, '0')
  return Array.from({ length: count }, (_, i): UnitSaleEvent => {
    year -= faker.number.int({ min: 2, max: 5 })
    const recencyFactor = 1 - i * faker.number.float({ min: 0.05, max: 0.12, fractionDigits: 3 })
    const price = Math.max(1, Math.round(sqft * pricePerSf * recencyFactor))
    return {
      id: faker.string.uuid(),
      date: `${year}-${pad(faker.number.int({ min: 1, max: 12 }))}-${pad(faker.number.int({ min: 1, max: 28 }))}`,
      price,
      pricePerSf: sqft > 0 ? Math.round((price / sqft) * 100) / 100 : 0,
      buyer: faker.company.name(),
      seller: faker.company.name(),
      capRateAtSale: faker.number.float({ min: 0.045, max: 0.085, fractionDigits: 4 }),
    }
  })
}

function generateFinancialRecords(current: {
  pgi: number
  vacancyRate: number
  egi: number
  operatingExpenses: number
  noi: number
  capRate: number
  grm: number
  cashOnCashReturn: number
  occupancyPct: number
  /** Asset value (asking price) — held constant across years so cap rate/GRM move with the figures. */
  value: number
  /** Operating expense ratio (opex / EGI) — carried across years. */
  expenseRatio: number
}): PropertyFinancialRecord[] {
  // Newest first. Year 0 is the flat current fields verbatim (the seed test pins
  // record[0] to them). Prior years are VACANCY-DRIVEN and internally consistent:
  // vacancy drifts (occupancy was a little lower back then), income was a little
  // lower, and EGI/NOI/occupancy/cap rate/GRM are all DERIVED from that year's
  // vacancy + income against a constant asset value — so a rendered multi-year
  // table reads like a real T-12 series, not the same numbers copied down.
  const currentYear = 2026
  const sources: FinancialRecordSource[] = ['T-12 actuals', 'Owner-provided', 'Broker estimate']

  return [0, 1, 2].map((back): PropertyFinancialRecord => {
    if (back === 0) {
      return {
        id: faker.string.uuid(),
        asOf: `${currentYear}-12-31`,
        source: sources[0],
        potentialGrossIncome: current.pgi,
        vacancyRate: current.vacancyRate,
        effectiveGrossIncome: current.egi,
        operatingExpenses: current.operatingExpenses,
        noi: current.noi,
        capRate: current.capRate,
        grossRentMultiplier: current.grm,
        cashOnCashReturn: current.cashOnCashReturn,
        occupancyPct: current.occupancyPct,
      }
    }

    // Older years: higher vacancy, lower income. Everything else derives from these.
    const vacancyRate = Math.min(
      0.4,
      Math.round((current.vacancyRate + back * faker.number.float({ min: 0.005, max: 0.02, fractionDigits: 4 })) * 10000) / 10000,
    )
    const pgi = Math.round(current.pgi * (1 - back * faker.number.float({ min: 0.02, max: 0.05, fractionDigits: 3 })))
    const egi = Math.round(pgi * (1 - vacancyRate))
    const operatingExpenses = Math.round(egi * current.expenseRatio)
    const noi = egi - operatingExpenses
    const capRate = current.value > 0 ? Math.round((noi / current.value) * 10000) / 10000 : current.capRate
    const grm = pgi > 0 ? Math.round((current.value / pgi) * 10) / 10 : current.grm
    const cashOnCashReturn = Math.round(capRate * faker.number.float({ min: 0.7, max: 1.1, fractionDigits: 4 }) * 10000) / 10000
    const occupancyPct = Math.round((1 - vacancyRate) * 1000) / 10

    return {
      id: faker.string.uuid(),
      asOf: `${currentYear - back}-12-31`,
      source: sources[back],
      potentialGrossIncome: pgi,
      vacancyRate,
      effectiveGrossIncome: egi,
      operatingExpenses,
      noi,
      capRate,
      grossRentMultiplier: grm,
      cashOnCashReturn,
      occupancyPct,
    }
  })
}

// ── Property generator ────────────────────────────────────────────────────────

/**
 * Exported so `prospects.ts` can mint Buildout Insights records off the same
 * generator the seed uses. A prospect is a full `Property` that simply hasn't
 * been added to the store yet — which is what makes "Add Property" a plain
 * `addProperty(record)` instead of a thin-record → full-record conversion.
 * Callers must `faker.seed(...)` first; this reads the module-global faker.
 */
export function generateProperty(): Property {
  const id = faker.string.uuid()
  const market = faker.helpers.arrayElement(CRE_MARKETS)
  const propertyType = faker.helpers.arrayElement(Object.keys(PROPERTY_CONFIGS) as PropertyType[])
  const config = PROPERTY_CONFIGS[propertyType]

  const buildingSqFt = faker.number.int({ min: config.sqFtRange[0], max: config.sqFtRange[1] })
  const lotSqFt = propertyType === 'land'
    ? buildingSqFt
    : Math.round(buildingSqFt * faker.number.float({ min: 1.0, max: 4.0, fractionDigits: 2 }))
  const stories = config.storiesRange[1] === 0
    ? 0
    : faker.number.int({ min: config.storiesRange[0], max: config.storiesRange[1] })

  const pricePerSqFt = faker.number.float({ min: config.pricePerSqFt[0], max: config.pricePerSqFt[1], fractionDigits: 0 })
  const askingPrice = round(buildingSqFt * pricePerSqFt)

  const capRate = faker.number.float({ min: config.capRateRange[0], max: config.capRateRange[1], fractionDigits: 4 })
  const vacancyRate = faker.number.float({ min: config.vacancyRange[0], max: config.vacancyRange[1], fractionDigits: 4 })
  const expenseRatio = faker.number.float({ min: config.expenseRatio[0], max: config.expenseRatio[1], fractionDigits: 4 })

  const noi = Math.round(askingPrice * capRate)
  const egi = expenseRatio > 0 ? Math.round(noi / (1 - expenseRatio)) : 0
  const pgi = vacancyRate < 1 ? Math.round(egi / (1 - vacancyRate)) : 0
  const operatingExpenses = egi - noi
  const grm = pgi > 0 ? Math.round((askingPrice / pgi) * 10) / 10 : 0

  const yearBuilt = faker.number.int({ min: 1950, max: 2023 })
  const doReno = faker.datatype.boolean({ probability: 0.35 })
  const yearRenovated = doReno && yearBuilt < 2018
    ? faker.number.int({ min: yearBuilt + 5, max: 2024 })
    : null

  const assessedTaxValue = Math.round(askingPrice * faker.number.float({ min: 0.55, max: 0.85, fractionDigits: 2 }))
  const landPct = faker.number.float({ min: 0.12, max: 0.30, fractionDigits: 2 })
  const landAssessedValue = Math.round(assessedTaxValue * landPct)
  const improvementAssessedValue = assessedTaxValue - landAssessedValue
  const taxRate = faker.number.float({ min: 0.008, max: 0.025, fractionDigits: 4 })
  const taxAmount = Math.round(assessedTaxValue * taxRate)
  const taxYear = faker.helpers.arrayElement([2024, 2025])

  const lastPurchasePrice = round(askingPrice * faker.number.float({ min: 0.55, max: 0.98, fractionDigits: 2 }))
  const lastPurchaseDate = faker.date.past({ years: 10 }).toISOString().slice(0, 10)

  const liensCount = faker.helpers.weightedArrayElement([
    { weight: 60, value: 0 },
    { weight: 25, value: 1 },
    { weight: 10, value: 2 },
    { weight: 5, value: 3 },
  ])
  const amountOfOpenLiens = liensCount > 0
    ? round(faker.number.int({ min: 10000, max: 500000 }), 100)
    : 0

  const basementSqFt = faker.datatype.boolean({ probability: config.basementProbability })
    ? faker.number.int({ min: 400, max: Math.min(buildingSqFt * 0.5, 10000) })
    : null
  const basementType = basementSqFt != null
    ? faker.helpers.arrayElement(['Full Basement', 'Partial Basement', 'Crawl Space'] as const)
    : null

  const isMultifamily = propertyType === 'multifamily'
  const residentialUnits = isMultifamily
    ? Math.max(2, Math.round(buildingSqFt / faker.number.int({ min: 650, max: 1200 })))
    : null
  const fullBathrooms = isMultifamily ? faker.number.int({ min: 1, max: 4 }) : null
  const partialBathrooms = isMultifamily ? faker.number.int({ min: 0, max: 2 }) : null
  const totalBathrooms = (fullBathrooms != null && partialBathrooms != null)
    ? fullBathrooms + partialBathrooms * 0.5
    : null

  const parkingSpaces = propertyType === 'land'
    ? 0
    : Math.round(buildingSqFt / faker.number.int({ min: 200, max: 500 }))

  const lat = faker.number.float({ min: market.latMin, max: market.latMax, fractionDigits: 6 })
  const lng = faker.number.float({ min: market.lngMin, max: market.lngMax, fractionDigits: 6 })

  const buildingClass: BuildingClass = faker.helpers.weightedArrayElement([
    { weight: 25, value: 'A' as const },
    { weight: 50, value: 'B' as const },
    { weight: 25, value: 'C' as const },
  ])

  const baseName = generatePropertyName(propertyType)
  const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + id.slice(0, 6)

  const cashOnCashReturn = faker.number.float({ min: capRate * 0.7, max: capRate * 1.1, fractionDigits: 4 })
  const occupancyPct = Math.round((1 - vacancyRate) * 1000) / 10
  const units = generateUnits(propertyType, buildingSqFt, residentialUnits, pricePerSqFt)
  const financialRecords = generateFinancialRecords({
    pgi, vacancyRate, egi, operatingExpenses, noi, capRate, grm, cashOnCashReturn, occupancyPct,
    value: askingPrice, expenseRatio,
  })

  const property: Property = {
    id,
    name: baseName,
    slug,
    // A bare property record has no deal on it, so it has no stage. Stage is
    // conferred by `generateDataset` on the properties that get a deal, and by
    // the deal pipeline at runtime thereafter.
    status: null,

    propertyType,
    propertySubtype: faker.helpers.arrayElement(config.subtypes),
    yearBuilt,
    yearRenovated,
    residentialUnits,
    fullBathrooms,
    partialBathrooms,
    totalBathrooms,
    buildingSqFt,
    lotSqFt,
    numberOfBuildings: faker.helpers.weightedArrayElement([
      { weight: 75, value: 1 },
      { weight: 15, value: 2 },
      { weight: 7, value: 3 },
      { weight: 3, value: 4 },
    ]),
    stories,
    basementSqFt,

    askingPrice,
    lastPurchasePrice,
    lastPurchaseDate,
    assessedMarketValue: assessedTaxValue,
    numberOfOpenLiens: liensCount,
    amountOfOpenLiens,

    buildingClass,
    basementType,
    exteriorWallType: config.exteriorWalls.length > 0
      ? faker.helpers.arrayElement(config.exteriorWalls)
      : 'N/A',
    heatingType: config.heatingTypes.length > 0
      ? faker.helpers.arrayElement(config.heatingTypes)
      : 'N/A',
    airConditioning: faker.helpers.weightedArrayElement([
      { weight: 60, value: 'Central' },
      { weight: 20, value: 'Window/Wall' },
      { weight: 15, value: 'None' },
      { weight: 5, value: 'Evaporative' },
    ]),
    buildingStyle: faker.helpers.arrayElement(config.buildingStyles),

    apn: faker.string.numeric(10),
    lat,
    lng,
    street: faker.location.streetAddress(),
    city: market.city,
    state: market.state,
    zip: faker.location.zipCode('#####'),
    county: market.county,
    submarket: faker.helpers.arrayElement(market.submarkets),
    zoning: faker.helpers.arrayElement(config.zoningOptions),
    censusTract: faker.string.numeric(11),
    schoolDistrict: market.schoolDistrict,
    legalDescription: generateLegalDescription(),
    district: String(faker.number.int({ min: 1, max: 30 })).padStart(2, '0'),
    useCode: faker.helpers.arrayElement(config.useCodes),
    municipality: faker.helpers.arrayElement(market.municipalities),

    assessedTaxValue,
    landAssessedValue,
    improvementAssessedValue,
    assessedYear: taxYear,
    taxAmount,
    taxYear,

    potentialGrossIncome: pgi,
    vacancyRate,
    effectiveGrossIncome: egi,
    operatingExpenses,
    noi,
    capRate,
    cashOnCashReturn,
    grossRentMultiplier: grm,
    parkingSpaces,

    occupancyPct,
    notes: faker.helpers.arrayElement([
      'Well-maintained asset; roof replaced within the last 5 years.',
      'Value-add opportunity — below-market rents on renewal.',
      'Stabilized; long-term credit tenancy in place.',
      'Deferred maintenance noted on the last inspection.',
    ]),
    units,
    financialRecords,

    createdAt: faker.date.past({ years: 3 }).toISOString(),
    updatedAt: faker.date.recent({ days: 90 }).toISOString(),
  }

  // After the literal on purpose — see typeSpecificFacts' doc comment.
  return Object.assign(property, typeSpecificFacts(propertyType, buildingSqFt))
}

/**
 * Physical facts that only exist for one asset class — dock doors on a
 * warehouse, elevators on an office tower, soil type on a parcel. Off-type
 * fields stay `undefined` rather than null so the document editor's row rules
 * prune them, which is what makes a generated Property Summary look authored
 * for that specific asset rather than a generic form dump.
 *
 * Called AFTER the base property literal is built: faker draws from one
 * shared deterministic stream, so running these afterward only guarantees
 * that a property's own base fields are unaffected by its own type-specific
 * draws. The shared stream still advances here, so every later property's
 * fields shift too — that's why SEED_VERSION moved when this was added.
 */
function typeSpecificFacts(
  propertyType: PropertyType,
  buildingSqFt: number,
): Partial<Property> {
  switch (propertyType) {
    case 'industrial':
      return {
        ceilingHeight: faker.number.int({ min: 18, max: 36 }),
        dockHighDoors: faker.number.int({ min: 2, max: 24 }),
        gradeLevelDoors: faker.number.int({ min: 1, max: 6 }),
        driveInBays: faker.number.int({ min: 0, max: 4 }),
        warehousePct: faker.number.int({ min: 55, max: 95 }),
        numberOfCranes: faker.helpers.weightedArrayElement([
          { weight: 70, value: 0 },
          { weight: 20, value: 1 },
          { weight: 10, value: 2 },
        ]),
      }
    case 'office':
      return {
        officeSpaceSqFt: Math.round(buildingSqFt * faker.number.float({ min: 0.7, max: 0.95 })),
        numberOfElevators: faker.number.int({ min: 1, max: 8 }),
        loadFactor: faker.number.float({ min: 1.05, max: 1.2, fractionDigits: 2 }),
        tenancy: faker.helpers.arrayElement(['Single', 'Multiple'] as const),
      }
    case 'retail':
      return {
        trafficCount: `${faker.number.int({ min: 8, max: 60 })},000 vehicles/day`,
        retailClientele: faker.helpers.arrayElement([
          'Neighborhood',
          'Regional draw',
          'Commuter',
          'Destination',
        ]),
        freeStanding: faker.datatype.boolean(),
      }
    case 'land':
      return {
        numberOfLots: faker.number.int({ min: 1, max: 12 }),
        bestUse: faker.helpers.arrayElement([
          'Mixed-use redevelopment',
          'Industrial park',
          'Retail pad',
          'Multifamily development',
        ]),
        topography: faker.helpers.arrayElement(['Level', 'Gently sloping', 'Rolling', 'Terraced']),
        soilType: faker.helpers.arrayElement(['Sandy loam', 'Clay', 'Silt loam', 'Rocky']),
      }
    default:
      return {}
  }
}

// ── Comp generator ────────────────────────────────────────────────────────────

function generateComp(propertyId: string, buildingSqFt: number, propertyType: PropertyType): Comp {
  const config = PROPERTY_CONFIGS[propertyType]
  const compType: CompType = faker.helpers.arrayElement(['sale', 'lease'])
  const date = faker.date.past({ years: 5 })
  const closingDaysOffset = faker.number.int({ min: 14, max: 90 }) * 86400000
  const closingDate = new Date(date.getTime() + closingDaysOffset)

  const compSqFt = faker.number.int({ min: Math.max(500, Math.round(buildingSqFt * 0.05)), max: buildingSqFt })

  const isSale = compType === 'sale'
  const salePrice = isSale
    ? round(compSqFt * faker.number.float({ min: config.pricePerSqFt[0] * 0.7, max: config.pricePerSqFt[1] * 1.1, fractionDigits: 0 }))
    : null
  const pricePerSqFt = (isSale && salePrice)
    ? Math.round((salePrice / compSqFt) * 100) / 100
    : null
  const capRateAtSale = isSale
    ? faker.number.float({ min: config.capRateRange[0], max: config.capRateRange[1], fractionDigits: 4 })
    : null

  const leaseRate = !isSale ? faker.number.float({ min: 8, max: 55, fractionDigits: 2 }) : null
  const leaseType = !isSale ? faker.helpers.arrayElement(['NNN', 'Gross', 'MG'] as const) : null
  const leaseTerm = !isSale ? faker.helpers.arrayElement([12, 24, 36, 48, 60, 84, 120]) : null

  const source: CompSource = faker.helpers.arrayElement(['CoStar', 'LoopNet', 'Public Records', 'MLS', 'Internal'])
  const notes = faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.55 }) ?? ''

  return {
    id: faker.string.uuid(),
    propertyId,
    compType,
    date: date.toISOString().slice(0, 10),
    closingDate: closingDate.toISOString().slice(0, 10),
    salePrice,
    pricePerSqFt,
    capRateAtSale,
    leaseRate,
    leaseType,
    leaseTerm,
    sqFt: compSqFt,
    daysOnMarket: faker.number.int({ min: 10, max: 420 }),
    buyerOrTenantName: faker.company.name(),
    sellerOrLandlordName: faker.company.name(),
    source,
    notes,
  }
}

// ── Contact generator ─────────────────────────────────────────────────────────

/** Team members a contact can be assigned to — weighted to a single lead broker. */
const ASSIGNEES = ['E. Thompson', 'A. Mendez', 'R. Patel', 'S. Kim']

/** CRE-flavored job titles for the contact's position line. */
const TITLE_POOL = [
  'Managing Member',
  'Principal',
  'Managing Partner',
  'Owner',
  'Acquisitions Lead',
  'VP of Acquisitions',
  'Asset Manager',
  'Portfolio Manager',
  'Director of Real Estate',
  'CFO',
]

/** Firm-shared tags used to segment People. */
const TAG_POOL = [
  'Out-of-state',
  'Investor',
  'VIP',
  'Local',
  'Repeat client',
  '1031 exchange',
  'Developer',
  'Institutional',
  'Family office',
]

/** Most-recent-touch label, derived from how the contact entered the book. */
const LAST_TOUCH_BY_SOURCE: Record<ContactSource, string> = {
  'Public records': 'Enriched from public records',
  'Manual entry': 'Added manually',
  'Cold outreach': 'Logged a cold call',
  'Prospect by Buildout': 'Imported from Prospect',
  Referral: 'Intro email sent',
  'Networking event': 'Met at a networking event',
  'Listing inquiry': 'Inquired on a listing',
}

/** Likelihood a contact is tied to a deal, by relationship stage. */
const DEAL_PROBABILITY: Record<RelationshipStage, number> = {
  cold: 0.15,
  // An inquiry that has already produced a deal isn't Inquired any more — the
  // reconciler would move them onto the deal ladder.
  inquired: 0,
  nurturing: 0.25,
  pitching: 1,
  client: 1,
  past_client: 1,
}

/** Picks a deal stage consistent with the relationship. */
function pickDealStage(relationship: RelationshipStage): ContactDealStage {
  switch (relationship) {
    case 'pitching':
      return 'pitching'
    case 'client':
      return faker.helpers.weightedArrayElement([
        { weight: 35, value: 'active' as const },
        { weight: 40, value: 'under_contract' as const },
        { weight: 25, value: 'closed' as const },
      ])
    case 'past_client':
      return 'closed'
    default: // cold / nurturing with an occasional early-stage deal
      return 'active'
  }
}

function generateContact(allPropertyIds: string[]): Contact {
  const relationship: RelationshipStage = faker.helpers.weightedArrayElement([
    { weight: 34, value: 'cold' as const },
    { weight: 10, value: 'inquired' as const },
    { weight: 18, value: 'nurturing' as const },
    { weight: 12, value: 'pitching' as const },
    { weight: 16, value: 'client' as const },
    { weight: 10, value: 'past_client' as const },
  ])

  /**
   * Leads who arrived through a listing inquiry. Everyone on the Inquired stage
   * did by definition; a slice of the Nurturing book got there the same way and
   * has since been engaged, so the "Inquired → Nurturing" graduation has real
   * examples in the seed rather than only in the rules.
   */
  const fromListingInquiry =
    relationship === 'inquired' ||
    (relationship === 'nurturing' && faker.datatype.boolean(0.3))

  const role: ContactRole = fromListingInquiry
    ? // An inquiry on a marketed listing comes from the demand side.
      faker.helpers.weightedArrayElement([
        { weight: 65, value: 'buyer' as const },
        { weight: 25, value: 'tenant' as const },
        { weight: 10, value: 'broker' as const },
      ])
    : faker.helpers.weightedArrayElement([
        { weight: 30, value: 'broker' as const },
        { weight: 25, value: 'owner' as const },
        { weight: 20, value: 'buyer' as const },
        { weight: 15, value: 'tenant' as const },
        { weight: 10, value: 'lender' as const },
      ])

  const source: ContactSource = fromListingInquiry
    ? 'Listing inquiry'
    : faker.helpers.weightedArrayElement([
        { weight: 40, value: 'Public records' as const },
        { weight: 12, value: 'Manual entry' as const },
        { weight: 18, value: 'Referral' as const },
        { weight: 13, value: 'Cold outreach' as const },
        { weight: 10, value: 'Networking event' as const },
        { weight: 7, value: 'Prospect by Buildout' as const },
      ])

  // Real last-contacted timestamp (or null = never contacted), spread across
  // recency buckets so the pre-defined lists return meaningful results.
  const DAY_MS = 86_400_000
  const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)
  const contactedBucket = faker.helpers.weightedArrayElement([
    { weight: 15, value: 'never' as const },
    { weight: 20, value: 'recent' as const }, // < 30 days
    { weight: 25, value: 'mid' as const }, // 30–90 days
    { weight: 25, value: 'stale' as const }, // 90 days – 1 year
    { weight: 15, value: 'old' as const }, // > 1 year
  ])
  const lastContactedAt: string | null =
    // Never engaged is what *makes* them Inquired — one logged touch and the
    // reconciler graduates them to Nurturing.
    relationship === 'inquired' || contactedBucket === 'never'
      ? null
      : faker.date
          .between(
            contactedBucket === 'recent'
              ? { from: daysAgo(29), to: daysAgo(0) }
              : contactedBucket === 'mid'
                ? { from: daysAgo(90), to: daysAgo(31) }
                : contactedBucket === 'stale'
                  ? { from: daysAgo(365), to: daysAgo(91) }
                  : { from: daysAgo(730), to: daysAgo(366) },
          )
          .toISOString()

  const openTaskCount = faker.helpers.weightedArrayElement([
    { weight: 60, value: 0 },
    { weight: 25, value: 1 },
    { weight: 10, value: 2 },
    { weight: 5, value: 3 },
  ])

  const hasDeal = faker.datatype.boolean(DEAL_PROBABILITY[relationship])
  const side: DealSide | null = hasDeal
    ? faker.helpers.arrayElement(['buyer', 'seller'] as const)
    : null
  const dealStage: ContactDealStage | null =
    side !== null ? pickDealStage(relationship) : null

  // Inquiries come from the buy side actively searching — and an inquiry-sourced
  // lead always has at least one, since that inquiry is why the record exists.
  const inquiries = fromListingInquiry
    ? faker.helpers.weightedArrayElement([
        { weight: 70, value: 1 },
        { weight: 30, value: 2 },
      ])
    : side === 'buyer'
      ? faker.helpers.weightedArrayElement([
          { weight: 55, value: 0 },
          { weight: 30, value: 1 },
          { weight: 15, value: 2 },
        ])
      : 0

  const phoneStatus: PhoneStatus = faker.helpers.weightedArrayElement([
    { weight: 75, value: 'valid' as const },
    { weight: 15, value: 'unknown' as const },
    { weight: 10, value: 'invalid' as const },
  ])

  // Secondary numbers / addresses beyond the primary — a desk line, a personal
  // email. Most people in the book have one of each; the minority who have
  // several are what the hero's Show/Hide records exist for, so the mix has to
  // exist in the seed or that control never appears.
  const extraPhones = Array.from(
    {
      length: faker.helpers.weightedArrayElement([
        { weight: 62, value: 0 },
        { weight: 26, value: 1 },
        { weight: 12, value: 2 },
      ]),
    },
    () => faker.phone.number({ style: 'national' }),
  )
  const extraEmails = Array.from(
    {
      length: faker.helpers.weightedArrayElement([
        { weight: 68, value: 0 },
        { weight: 24, value: 1 },
        { weight: 8, value: 2 },
      ]),
    },
    () => faker.internet.email(),
  )

  const propertyIds = faker.helpers.arrayElements(
    allPropertyIds,
    faker.number.int({ min: 1, max: 4 }),
  )

  // Drawn here rather than inline in the literal below, so the sync flag can
  // hash it. Immediately before the return, which is what keeps the ORDER of
  // faker draws — and therefore every value downstream of them — identical to
  // what it was; hoisting this to the top of the function would re-address the
  // whole contact book.
  const id = faker.string.uuid()

  return {
    id,
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    emails: extraEmails.length ? extraEmails : undefined,
    phone: faker.phone.number({ style: 'national' }),
    phones: extraPhones.length ? extraPhones : undefined,
    company: faker.company.name(),
    role,
    propertyIds,
    assignedTo: faker.helpers.weightedArrayElement([
      { weight: 70, value: ASSIGNEES[0] },
      { weight: 12, value: ASSIGNEES[1] },
      { weight: 10, value: ASSIGNEES[2] },
      { weight: 8, value: ASSIGNEES[3] },
    ]),
    source,
    relationship,
    side,
    dealStage,
    inquiries,
    phoneStatus,
    doNotCall: faker.datatype.boolean(0.04),
    quickbooksSynced: isQuickbooksSynced(id),
    title: faker.helpers.arrayElement(TITLE_POOL),
    // Drawn here, but repaired in `generateDataset` — a record can't predate its
    // own history, and this draw knows nothing about `lastContactedAt`.
    createdAt: faker.date.past({ years: 1 }).toISOString(),
    lastTouch: LAST_TOUCH_BY_SOURCE[source],
    lastContactedAt,
    openTaskCount,
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip: faker.location.zipCode(),
    tags: faker.helpers.arrayElements(
      TAG_POOL,
      faker.number.int({ min: 0, max: 3 }),
    ),
  }
}

// ── Listing (+ its 1:1 deal) generator ────────────────────────────────────────

/**
 * The plans a seeded internal broker is put on.
 *
 * Spelled out here rather than filtered from `COMMISSION_PLANS`, which would
 * need a runtime import of `vouchers.ts` — and that module reads the store, so
 * importing it from the seed closes a cycle (`seed` → `vouchers` → `store` →
 * `dataStore` → `seed`) that fails at module load with "Cannot access 'SEED'
 * before initialization". `seed.test.ts` holds this list inside
 * `COMMISSION_PLANS`, which is the check the duplication buys.
 *
 * `'No Plan'` is deliberately absent. It stays in the dropdown, because it is a
 * real answer and it is what a hand-added broker starts on; it is just not one
 * the seed hands out, since a Commission Plan column reading "No Plan" on every
 * row carries no information and the payables table shows that column.
 */
const SEEDED_COMMISSION_PLANS: CommissionPlan[] = [
  'Standard Commission Plan',
  'Custom Plan',
  'House Split Plan',
]

/**
 * Which plan a seeded broker is on, spelled from their id.
 *
 * **Hashed, not drawn from faker**, for the reason `hashCode` below gives.
 * Deterministic, so a reseed puts every broker back on the same plan.
 *
 * The plan is a LABEL. It does not decide what the broker takes home — that is
 * `personalSplitPct`, which the seed holds flat so the pipeline's "You" forecast
 * stays predictable across the demo. Coupling the two would move money on every
 * seeded deal to make a column read better.
 */
function commissionPlanFor(seed: string): CommissionPlan {
  return SEEDED_COMMISSION_PLANS[hashCode(seed) % SEEDED_COMMISSION_PLANS.length]!
}

/**
 * A stable number from a string the seed has already drawn.
 *
 * Used where a value has to vary across rows but must NOT cost the faker
 * stream anything — a new `faker` call shifts every property, contact and deal
 * generated after it, and the flagship demo is pinned to positions in that
 * stream. Same shape as the hashes in `quickbooks.ts` and `deposits.ts`; those
 * two keep their own so neither module depends on the seed.
 */
function hashCode(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1_000_003
  }
  return hash
}

/**
 * One broker and their share.
 *
 * `commissionAmount` is the pool this broker is drawn from, which for both
 * sides is the commission NET of pre-split deductions — those come off the
 * gross before any broker splits it.
 *
 * The internal broker's 100% is provisional. A co-broked deal takes the outside
 * broker's share off the top afterwards and rescales this one; see the
 * reconciliation at the call site, which is where it has to happen because the
 * coin-flip for an outside broker is drawn after this.
 */
function generateBroker(side: 'internal' | 'outside', commissionAmount: number): DealBroker {
  const splitPct = side === 'internal' ? 100 : faker.helpers.arrayElement([40, 50, 60])
  const id = faker.string.uuid()
  return {
    id,
    name: `${faker.person.firstName()} ${faker.person.lastName()}`,
    role: side === 'internal' ? 'Primary Broker - Sell Side' : 'Outside Broker',
    email: faker.internet.email().toLowerCase(),
    side,
    commissionSplitPct: splitPct,
    grossCommission: Math.round(commissionAmount * (splitPct / 100)),
    // Hashed from the id rather than drawn, so adding this cost the faker
    // stream nothing — see `commissionPlanFor`. Outside brokers get none: they
    // are not on the house's books, and the payables table renders the gap as
    // "No Plan".
    commissionPlan: side === 'internal' ? commissionPlanFor(id) : undefined,
    // Flat house split for internal brokers — the pipeline commission forecast
    // reads this, so a single rate keeps "You" predictable across the demo.
    personalSplitPct: side === 'internal' ? DEFAULT_PERSONAL_SPLIT_PCT : undefined,
  }
}

// Category is drawn from DEDUCTION_CATEGORIES — the same list the voucher's
// Category dropdown offers — so a seeded row's category is always one the
// dropdown can show as selected. Description is the free-text line beside it.
const DEDUCTION_FIXTURES: { category: DeductionCategory; description: string }[] = [
  { category: 'Outside Referral', description: 'Referral Fee' },
  { category: 'Royalties', description: 'Franchise Royalty' },
  { category: 'Internal Referrals', description: 'Internal Referral Fee' },
  { category: 'Broker of Record', description: 'Broker of Record Fee' },
]

const TASK_ASSIGNEE_INITIALS = ['OW', 'MT', 'KN', 'SP', 'JR']

/** `stageStartedAt` shifted by `days`, as a `YYYY-MM-DD` string (matches seed convention). */
function shiftTaskDate(stageStartedAt: string, days: number): string {
  const d = new Date(stageStartedAt)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The planner's task list for a listing, curated per stage so "Today" shows
 * items that actually match what's happening right now — a proposal gets
 * setup tasks, an under-contract deal gets a closing checklist, and so on.
 * Dates are offsets from `stageStartedAt` (when the listing entered its
 * current stage), matching the convention `createListing.ts`'s
 * `seedProposalPlan` already uses for brand-new proposals.
 *
 * A deal task has no explicit type — the Tasks page derives one from the label
 * (`deriveTaskType`). The stage plans below are worded so that every task type
 * shows up somewhere in the open work: call (proposal), email + showing
 * (active), meeting (under-contract), follow-up (inactive), and to-do
 * throughout. `seed.test.ts` holds that coverage in place.
 */
export function generateTasks(stage: ListingStage, stageStartedAt: string): DealTask[] {
  const assignee = () => faker.helpers.arrayElement(TASK_ASSIGNEE_INITIALS)

  const auto = (label: string, detail: string, days: number): DealTask => ({
    id: faker.string.uuid(),
    label,
    date: shiftTaskDate(stageStartedAt, days),
    relativeDue: null,
    assigneeInitials: assignee(),
    status: 'complete',
    hasAttachment: faker.datatype.boolean({ probability: 0.3 }),
    detail,
    autoGenerated: true,
  })

  const todo = (
    label: string,
    days: number,
    relativeDue: string | null = null,
    status: DealTaskStatus = 'open',
  ): DealTask => ({
    id: faker.string.uuid(),
    label,
    date: shiftTaskDate(stageStartedAt, days),
    relativeDue,
    assigneeInitials: assignee(),
    status,
    hasAttachment: faker.datatype.boolean({ probability: 0.2 }),
  })

  switch (stage) {
    case 'proposal':
      return [
        auto('Underwriting', 'First-pass underwrite complete', 0),
        auto('Listing proposal', 'Generated automatically', 0),
        auto("Broker's Opinion of Value", 'Generated automatically', 0),
        // Queued by the assistant after the last touch — the sparkle badge is
        // reserved for exactly this, never for the `auto()` deliverables above.
        { ...todo('Call owner to confirm pricing strategy', 1), createdByAi: true },
        todo('Upload executed listing agreement', 2, '2 days after listing executed'),
        todo('Order professional photography', 3, '3 days after listing executed'),
        todo('Order property signage', 5, '5 days after listing executed'),
        todo('Publish listing to website', 7, '7 days after listing executed'),
      ]
    case 'active':
      return [
        auto('Send marketing package', 'Sent to prospect list', 2),
        todo('Email updated marketing package to prospects', 6),
        todo('Schedule property tours', 10, '10 days after listing went live'),
        todo('Review incoming offers', 20, null, 'overdue'),
        todo('Confirm due diligence dates', 30),
      ]
    case 'under-contract':
      // The contract-to-close checklist: every item is work that has to clear
      // before the deal can move to Closed, so they all start open.
      return [
        todo('Execute purchase agreement (PSA)', 2),
        todo('Collect earnest money', 5),
        todo('Meeting with title company on closing logistics', 12),
        todo('Complete due diligence', 21),
        todo('Finalize buyer financing', 30),
        todo('Clear closing contingencies', 35),
        todo('Prepare closing documents', 40),
        todo('Set agreed closing date', 45),
      ]
    case 'closed':
      // Deal execution is finished by the time a deal lands here — the
      // contract-to-close checklist cleared to get it closed. What's left is
      // brokerage back-office work against the voucher.
      return [
        todo('Review voucher', 2),
        todo('Set up pre-split deductions', 5),
      ]
    case 'inactive':
      return [
        todo('Archive listing documents', 1, null, 'complete'),
        { ...todo('Follow up with owner', 14), createdByAi: true },
      ]
  }
}

/**
 * A property contains 1–3 listings (spaces). Each listing IS its deal (1:1), so it
 * carries the deal's transaction, brokers, contacts, planner, history, and voucher.
 */
function generateListings(
  property: Property,
  propertyContacts: Contact[],
  dealIdRef: { n: number },
  spec: DealPipelineEntry,
  /**
   * How many deposits the book has written so far, shared across every deal.
   *
   * A counter rather than a hash, and a shared one rather than a per-voucher
   * index. The whole seeded book carries only a handful of deposits, spread one
   * per voucher — at that sample size a 50/50 hash draws all-or-nothing (it
   * first drew nothing), and a per-voucher index gives every deposit position 0
   * and so the same answer. Only a counter that spans vouchers alternates. The
   * same trap the payment hold-back below and the receivable `variant` cycling
   * above both exist to avoid.
   */
  depositRef: { n: number },
): Listing[] {
  // One deal per property — the pipeline shape is controlled by DEAL_PIPELINE,
  // not random per-property counts (see generateDataset).
  const count = 1
  const basePricePerSqFt = property.buildingSqFt > 0 ? property.askingPrice / property.buildingSqFt : 0

  return Array.from({ length: count }, (): Listing => {
    const id = faker.string.uuid()
    const dealId = String(dealIdRef.n++)
    const availableSqFt = property.buildingSqFt
    const dealType = spec.dealType
    const name = property.name
    const status: ListingStage = spec.stage

    // Transaction — Lease deals carry no sale headline data (see marketing.spaceLeaseTerms).
    const salePrice = dealType === 'Sale' ? round(availableSqFt * basePricePerSqFt) : 0
    const pricePerSqFt = availableSqFt > 0 ? Math.round((salePrice / availableSqFt) * 100) / 100 : 0
    const commissionPct = faker.number.float({ min: 2, max: 4, fractionDigits: 1 })
    const commissionAmount = Math.round(salePrice * (commissionPct / 100))
    const [pMin, pMax] = STAGE_CLOSE_PROBABILITY[status]

    // Pre-split deductions come off the top before brokers are paid out.
    const deductionPick = faker.helpers.arrayElement(DEDUCTION_FIXTURES)
    const deductionPct = faker.number.float({ min: 3, max: 8, fractionDigits: 1 })
    const deductionAmount = Math.round(commissionAmount * (deductionPct / 100))
    const preSplitDeductions: FinancialDeduction[] = [
      {
        id: faker.string.uuid(),
        category: deductionPick.category,
        description: deductionPick.description,
        pct: deductionPct,
        amount: deductionAmount,
        covered: null,
      },
    ]
    const netCommission = commissionAmount - deductionAmount

    const drawnInternalBrokers = [generateBroker('internal', netCommission)]
    const drawnOutsideBrokers = faker.datatype.boolean({ probability: 0.4 })
      ? [generateBroker('outside', netCommission)]
      : []

    // The co-broke comes off the top, and the house's own people divide what is
    // left — see `splitNetCommission` for why paying both sides a share of the
    // same net is a bug rather than a rounding difference.
    //
    // Reconciled HERE rather than inside `generateBroker` because the internal
    // broker is drawn BEFORE the coin-flip that decides whether there is an
    // outside broker at all, and reordering those two faker calls would reshuffle
    // every seeded value downstream. The same constraint `brokersWithSide` below
    // works around, for the same reason.
    const coBrokePct = drawnOutsideBrokers.reduce(
      (t, b) => t + b.commissionSplitPct,
      0,
    )
    const { internal: internalBrokers, outside: outsideBrokers } =
      splitNetCommission({
        internal: drawnInternalBrokers.map((b) => ({
          ...b,
          // The provisional 100% becomes what the co-broke left behind.
          commissionSplitPct: Math.round(
            b.commissionSplitPct * ((100 - coBrokePct) / 100),
          ),
        })),
        outside: drawnOutsideBrokers,
        netCommission,
      })

    // Which side of the deal the broker represents.
    const dealSide: DealSide = faker.helpers.weightedArrayElement([
      { weight: 65, value: 'seller' },
      { weight: 35, value: 'buyer' },
    ])

    // Transaction Side belongs to the deal, not to the person who worked it, so
    // every internal broker starts on the deal's own side; the voucher can move
    // one of them afterwards (a dual-side deal splits Buy and Sell across two).
    // Applied here rather than inside `generateBroker` because `dealSide` is
    // drawn after the brokers are, and reordering the faker calls would reshuffle
    // every seeded value downstream.
    const brokersWithSide: DealBroker[] = internalBrokers.map((b) => ({
      ...b,
      transactionSide: dealSide === 'buyer' ? 'Buy Side' : 'Sell Side',
    }))

    // Parties are drawn from THIS property's associated contacts so the graph
    // stays reciprocal (a deal's contacts are linked to the deal's property).
    const sellerContacts = faker.helpers.arrayElements(
      propertyContacts,
      Math.min(faker.number.int({ min: 1, max: 2 }), propertyContacts.length),
    )
    // Buyer-side deals always have a buyer; sell-side gains one once it's
    // progressed. Buyer is a different party than the seller(s).
    const buyerPool = propertyContacts.filter((c) => !sellerContacts.includes(c))
    const buyerContacts =
      (dealSide === 'buyer' || status !== 'proposal') && buyerPool.length > 0
        ? faker.helpers.arrayElements(buyerPool, 1)
        : []
    const sellerName = `${sellerContacts[0].firstName} ${sellerContacts[0].lastName}`

    const createdAt = property.createdAt
    const actor = internalBrokers[0].name
    const stageStartedAt =
      status === 'proposal' ? createdAt : faker.date.recent({ days: 120 }).toISOString()

    // Published once the deal has gone live (Active or beyond); Pitching/Lost are not published.
    const publishedAt =
      status === 'active' || status === 'under-contract' || status === 'closed'
        ? stageStartedAt
        : null

    const history: DealHistoryEntry[] = [
      {
        id: faker.string.uuid(),
        label: 'Created under',
        fromStage: null,
        toStage: 'proposal',
        actor,
        timestamp: createdAt,
      },
    ]
    if (status !== 'proposal') {
      history.push({
        id: faker.string.uuid(),
        label: 'Stage updated from',
        fromStage: 'proposal',
        toStage: status,
        actor,
        timestamp: stageStartedAt,
      })
    }

    // Task due dates get their own recent anchor (not stageStartedAt, which can
    // be up to 120 days old) so the planner stays relevant to "now": completed
    // items sit in the recent past and open items are mostly upcoming, with only
    // a few genuinely overdue. Chosen per stage to offset generateTasks's fixed
    // day-offsets, plus a little jitter so deals don't share identical dates.
    const TASK_ANCHOR_DAYS_AGO: Record<PropertyStatus, number> = {
      proposal: 4,
      active: 14,
      'under-contract': 14,
      closed: 45,
      inactive: 7,
    }
    const taskAnchor = new Date(
      Date.now() -
        (TASK_ANCHOR_DAYS_AGO[status] + faker.number.int({ min: -2, max: 2 })) *
          86_400_000,
    ).toISOString()
    const tasks = generateTasks(status, taskAnchor)
    const nextTask = tasks.find((t) => t.status !== 'complete' && t.date)
    const MESSAGE_LINES = [
      'Sent the OM over to the buyer’s counsel this morning.',
      'Any update on the estoppel certificates?',
      'Confirmed the tour for Thursday at 2pm.',
      'Seller countered at asking minus 3%. Discussing internally.',
      'Loan commitment letter is in — uploading to Files now.',
      'Can we get the T-12 refreshed before the call?',
      'Buyer’s inspection is scheduled for next week.',
      'Title came back clean, no surprises.',
      'Pushing the LOI deadline to Friday per their request.',
      'Great meeting today — momentum is good on this one.',
    ]
    const messageAuthors = [CURRENT_USER, ...TEAMMATES]
    const messageCount = faker.number.int({ min: 2, max: 5 })
    const messages = Array.from({ length: messageCount }, () => {
      const author = faker.helpers.arrayElement(messageAuthors)
      return {
        id: faker.string.uuid(),
        author: author.name,
        text: faker.helpers.arrayElement(MESSAGE_LINES),
        timestamp: faker.date.recent({ days: 30 }).toISOString(),
      }
    }).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    // The deal's stage decides the voucher's state, and nothing else does.
    //
    // A voucher is the broker's working copy while the deal is live — they fill
    // it in as the deal moves — so there is nothing to submit or sign off until
    // the deal settles. Every stage short of Closed is therefore Draft, with no
    // draw involved. A Closed deal carries its state on `DEAL_PIPELINE`; see the
    // note there for why it is named per row.
    //
    // This replaced the reverse rule: Closed was always Approved and every open
    // deal drew from a weighted mix that could hand a proposal an approved
    // voucher. It put money through approval on deals nobody had closed.
    const voucherStatus: VoucherStatus =
      spec.stage === 'closed' ? spec.voucherStatus : 'Draft'

    const voucherCloseDate = status === 'closed'
      ? faker.date.recent({ days: 90 }).toISOString().slice(0, 10)
      : null

    // Who signed the voucher off, and when — a few days after the close.
    //
    // Only a Closed deal can be Approved now, and a Closed deal always has a
    // close date, so the sign-off always has something to date itself from.
    // This used to carry a second branch for an Approved voucher with no close
    // date, dating it from "recently" instead; the stage rule above makes that
    // state unreachable, so the branch is gone. The `&& voucherCloseDate` here
    // is only narrowing the type — no deal can fail it.
    const voucherApproval: VoucherApproval | null =
      voucherStatus === 'Approved' && voucherCloseDate
        ? {
            reviewerId: faker.helpers.arrayElement(VOUCHER_APPROVER_IDS),
            approvedOn: new Date(
              Date.parse(`${voucherCloseDate}T00:00:00`) +
                faker.number.int({ min: 1, max: 10 }) * 86_400_000,
            )
              .toISOString()
              .slice(0, 10),
          }
        : null

    // What the brokerage billed out on a closed deal. Most deals bill the
    // commission in one line to one party; some split it across two, the second
    // billed to the other side, and a split's first line is often part-paid.
    //
    // The variety is the point: the Receivables table's Credited column and its
    // bulk actions both need rows that differ from each other. A single
    // uniform line per deal left the column reading $0.00 everywhere and made
    // "these rows share a payer" a question with only one possible answer.
    const receivables: FinancialReceivable[] = []
    // `commissionAmount > 0`, not just closed: a zero-dollar receivable is not a
    // bill anybody sent, and it reads as fully paid to anything comparing
    // credited against amount.
    if (status === 'closed' && commissionAmount > 0) {
      const primaryPayer = buyerContacts[0] ?? sellerContacts[0]
      const otherPayer = sellerContacts.find((c) => c.id !== primaryPayer.id)
      // Some closed deals bill a party that is on neither side — the corporate
      // AP department or holding company that actually cuts the cheque. The
      // Payers section is built for exactly this, and a seed where every payer
      // is also the buyer would make it look redundant.
      //
      // Cycled on the deal number rather than drawn, for the same reason
      // `variant` is: only a handful of deals reach Closed, and at that sample
      // size a probability leaves the case unreachable in some runs.
      //
      // `% 2 === 0`, not `% 3`: keying this on the same modulus as `variant`
      // landed on a closed deal that is a zero-commission Lease, so the
      // condition was true but the surrounding `commissionAmount > 0` guard
      // never let it run — verified empirically against the generated data,
      // not just reasoned about. `% 2` does land on commission-bearing deals,
      // at the cost of tying "billed to an outsider" to `split`'s modulus, so
      // the two end up mutually exclusive. That coupling is still accepted: the
      // closed group grew from four deals to eight when the voucher lifecycle
      // moved onto the stage, which gives each modulus more deals to land on
      // but does not un-share them.
      const thirdPartyPayer =
        Number(dealId) % 2 === 0
          ? propertyContacts.find(
              (c) =>
                !buyerContacts.some((b) => b.id === c.id) &&
                !sellerContacts.some((s) => s.id === c.id),
            )
          : undefined
      // Falls back to the buyer when this property has no spare contact, so a
      // small contact list degrades to today's behaviour instead of throwing.
      const billTo = thirdPartyPayer ?? primaryPayer
      // Cycled on the deal number rather than drawn, so the three states below
      // are all guaranteed to appear. Only a handful of deals ever reach Closed,
      // and at that sample size a probability left whole states unreachable —
      // no receivable was ever fully paid, so nothing exercised the rule that a
      // settled receivable has nothing left to apply a deposit against. Note
      // that a Closed deal's voucher may itself be a Draft now, so some of these
      // credited states sit on a voucher the broker has not submitted yet — a
      // real state, not a contradiction.
      const variant = Number(dealId) % 3
      // Split on a different modulus than `variant`, so the two vary
      // independently. Sharing one would have tied "billed to two parties" to a
      // single credited state, and with only a few closed deals that left one
      // of the two conditions with no deal that could show it.
      const split = otherPayer !== undefined && Number(dealId) % 2 === 1
      const firstAmount = split
        ? Math.round(commissionAmount * 0.6)
        : commissionAmount

      receivables.push({
        id: faker.string.uuid(),
        payerContactId: billTo.id,
        // The third-party payer is an entity that pays on someone's behalf, so
        // it reads as a company; an ordinary buyer or seller is billed by name.
        billToCompany: thirdPartyPayer !== undefined && billTo.company !== '',
        dueDate: faker.date.recent({ days: 30 }).toISOString().slice(0, 10),
        billingDescription: split ? 'Initial Payment' : 'Full Payment',
        amount: firstAmount,
        // Settled / part-paid / untouched, in that order — the Credited column
        // has nothing to show until these differ from each other.
        credited:
          variant === 0 ? firstAmount : variant === 1 ? Math.round(firstAmount / 2) : 0,
      })

      if (split && otherPayer) {
        receivables.push({
          id: faker.string.uuid(),
          payerContactId: otherPayer.id,
          billToCompany: false,
          dueDate: faker.date.soon({ days: 45 }).toISOString().slice(0, 10),
          billingDescription: 'Balance Due',
          amount: commissionAmount - firstAmount,
          credited: 0,
        })
      }
    }

    // A deal under contract is already billed. The buyer has been accepted, so
    // the broker names them and drafts the line while the deal is still open —
    // which is the whole reason an open deal's voucher is a Draft and not an
    // empty form.
    //
    // One line, nothing credited, due date ahead: that is what separates a
    // voucher being worked from one being settled. The closed block above is the
    // one that varies its credited states, because only a settled receivable has
    // anything to have received.
    //
    // Not `else if`: the two conditions are exclusive by stage already, and a
    // separate statement keeps each stage's rule readable on its own.
    if (status === 'under-contract' && commissionAmount > 0) {
      // Falls back to the seller exactly as the closed block does, and for the
      // same reason: `buyerContacts` is empty when the property had only the two
      // contacts `generateDataset` guarantees and both went to the seller side.
      // A seller-payer is a real case, so nothing needs to be repaired — and
      // `applyHeroes`' buyer repair runs later anyway, too late to be read here.
      const billTo = buyerContacts[0] ?? sellerContacts[0]
      receivables.push({
        id: faker.string.uuid(),
        payerContactId: billTo.id,
        billToCompany: false,
        dueDate: faker.date.soon({ days: 45 }).toISOString().slice(0, 10),
        billingDescription: 'Full Payment',
        amount: commissionAmount,
        credited: 0,
      })
    }

    // Sync status, applied in one pass rather than repeated on each push above.
    // Hashed from the id the push already drew, so this costs the faker stream
    // nothing (see `isQuickbooksSynced`) — and every voucher gets a mix of
    // connected and unconnected lines, whatever stage its deal is at.
    //
    // Gated on the payer as well as the line: QuickBooks holds no A/R record
    // against a customer it has never heard of, so a synced receivable under an
    // unsynced payer is a pair that cannot happen. Now that the unsynced state
    // is visible on both, that contradiction would be on screen side by side.
    // Looked up in `propertyContacts` rather than through `getContact`, which
    // the seed cannot call — it is what builds the store.
    const contactsById = new Map(propertyContacts.map((c) => [c.id, c]))
    for (const receivable of receivables) {
      const payer = contactsById.get(receivable.payerContactId)
      receivable.quickbooksSynced =
        payer?.quickbooksSynced === true && isQuickbooksSynced(receivable.id)
    }

    // Derived from the receivables rather than assembled separately: the two
    // must agree, and one of them has to be the source. A voucher with no
    // receivables has no payers yet, which is a real state — every voucher
    // starts there, and one stays there until the deal is under contract.
    const payerContactIds = [...new Set(receivables.map((r) => r.payerContactId))]

    // Invoices the broker has already sent against this voucher.
    //
    // Only a Pending or an Approved voucher has any. Adding invoices is the last
    // thing a broker does before submitting — and the one thing a back-office
    // admin may still do after — so a Draft voucher having none is what makes
    // the Invoices page's empty state a real state rather than a bug. (Draft is
    // also the only status where a broker can add one, which is why every
    // seeded invoice sits on a voucher that has moved past it.)
    //
    // Grouped by payer, not one per receivable: one invoice bills one party,
    // which is the rule `createInvoiceFromReceivables` enforces. At the current
    // seed every group is a single row — a split commission bills the OTHER side,
    // so two receivables on one voucher never share a payer — but grouping is
    // what the rule actually is, and it follows the seed if that changes.
    const invoices: DealInvoice[] = []
    if (voucherStatus !== 'Draft') {
      for (const payerId of payerContactIds) {
        const billed = receivables.filter((r) => r.payerContactId === payerId)
        const lineItems = invoiceLineItems(billed)
        // Named from the contact in hand, not looked up. `invoices.ts` takes a
        // name rather than a contact id precisely because this runs while
        // `generateDataset` is still building the store, so there is nothing to
        // look up in yet. Every payer is drawn from `propertyContacts`.
        const payer = propertyContacts.find((c) => c.id === payerId)
        // Sent in the days after the close, so it lands before the sign-off that
        // `voucherApproval` dates from one to ten days out.
        const sentAt = voucherCloseDate
          ? new Date(
              Date.parse(`${voucherCloseDate}T00:00:00`) +
                faker.number.int({ min: 1, max: 3 }) * 86_400_000,
            ).toISOString()
          : createdAt
        // Drawn from the roster rather than from `internalBrokers`, whose ids are
        // faker uuids that `findTeammate` cannot resolve — the same reason
        // `messageAuthors` above draws from here.
        const author = faker.helpers.arrayElement([CURRENT_USER, ...TEAMMATES])
        invoices.push({
          id: faker.string.uuid(),
          name: invoiceFileName(
            invoicePayerFileLabel(
              {
                name: payer ? `${payer.firstName} ${payer.lastName}`.trim() : '',
                company: payer?.company ?? '',
              },
              billed[0].billToCompany,
            ),
            invoices.length + 1,
          ),
          createdAt: sentAt,
          createdById: author.id,
          payerContactId: payerId,
          billToCompany: billed[0].billToCompany,
          dueDate: invoiceDueDate(lineItems),
          lineItems,
        })
      }
    }

    // The deposits behind the credited receivables above.
    //
    // The seed sets `credited` directly — it is the running total, and every
    // reader from `invoiceLineItems` to the AI tools takes it from there — but a
    // credited row with no deposit under it would expand to an empty child table
    // and read as money that arrived from nowhere. So each credited line gets the
    // one deposit that paid it.
    //
    // Nothing here draws from faker, deliberately. Hashed from the receivable id
    // the way `isQuickbooksSynced` is, so adding deposits costs the faker stream
    // nothing and every property, contact and deal downstream stays exactly where
    // it was. The alternative — a `faker.number.int` for the reference — would
    // have shifted the entire generated dataset for a four-digit string nobody
    // reads.
    //
    // Deductions are deliberately left uncovered. `preSplitDeductions` seeds
    // `covered: null`, and crediting them here would mean splitting each seeded
    // deposit across two tables to keep the two consistent — arithmetic in the
    // seed standing in for a deposit nobody applied through the modal. An
    // uncovered deduction is a real state, and it is the one the Pre-Split
    // Deductions table already renders.
    const deposits: VoucherDeposit[] = []
    for (const receivable of receivables) {
      if (receivable.credited <= 0) continue
      // Paid a little after it was billed, which is the ordinary way round.
      const paidAt = new Date(
        Date.parse(`${receivable.dueDate}T00:00:00`) + 2 * 86_400_000,
      )
      deposits.push({
        id: `deposit-${receivable.id}`,
        date: paidAt.toISOString().slice(0, 10),
        amount: receivable.credited,
        // A wire reference, spelled from the id so it is stable across reseeds
        // and unique within the voucher. The same generator the save path uses
        // when a broker leaves the field blank, so a seeded reference and a
        // generated one are the same kind of thing.
        referenceNumber: generateDepositReference(
          receivable.id,
          deposits.map((d) => d.referenceNumber),
        ),
        // Every other deposit arrived as a cheque; the rest are wires and ACH
        // transfers, which carry no cheque number at all. Both states have to be
        // in the book or the Check # column is either uniformly empty or
        // uniformly filled, and in neither case does it show that the field is
        // optional. See `depositRef` for why this alternates rather than hashes.
        //
        // The number itself is hashed, not drawn: a `faker` call here would move
        // the shared stream and shift every property, contact and deal generated
        // after it. The key is spread in rather than set to `''`, so a wire
        // matches the shape `applyDeposit` writes for one.
        //
        // Hashed from a DIFFERENT string than the reference above, and into a
        // different range. Both were first hashed from the bare receivable id,
        // which made every cheque row read "Ref 1898 / Check 1898" — two fields
        // whose whole point is that they are not the same fact, printed as if
        // they were.
        ...(depositRef.n++ % 2 === 0
          ? {
              checkNumber: String(
                10_000 + (hashCode(`check-${receivable.id}`) % 90_000),
              ),
            }
          : {}),
        createdAt: paidAt.toISOString(),
        createdById: CURRENT_USER.id,
        receivableAllocations: [
          { targetId: receivable.id, amount: receivable.credited },
        ],
        deductionAllocations: [],
      })
    }

    // What the brokerage owes its brokers out of the deposits above.
    //
    // **Approved vouchers only**, which is the rule the whole record turns on:
    // there is nothing to pay out of a commission nobody has signed off. A Draft
    // voucher carrying deposits is a real and common state here, and its
    // Payables section renders the note saying they arrive at approval.
    //
    // Built through the same `payablesForDeposit` the write path uses, so a
    // seeded payable and one raised by the Apply Deposit modal are the same
    // arithmetic rather than two implementations that can drift.
    //
    // Nothing here draws from faker, for the reason the deposits block above
    // gives: ids are spelled from their parents and the one variable — whether a
    // payable has been part-paid — is hashed, so every property, contact and
    // deal downstream stays exactly where it was.
    const payables: VoucherPayable[] = []
    // Set once the voucher's first cheque has been written, so exactly one of
    // them carries a hold-back. A probability was the first version and it drew
    // nothing: only a handful of vouchers reach Approved with money against
    // them, and at that sample size a one-in-six rule leaves the deduction row
    // unreachable in a whole dataset — the same trap the `variant` cycling in
    // the receivables block above exists to avoid.
    let deducted = false
    if (voucherStatus === 'Approved') {
      for (const deposit of deposits) {
        for (const row of payablesForDeposit({
          deposit,
          brokers: [...outsideBrokers, ...brokersWithSide],
          allReceivables: receivables,
        })) {
          const id = `payable-${deposit.id}-${row.brokerId}`
          // Roughly half the payables carry one cheque, so Gross Paid and Net
          // Paid are not $0.00 down the whole column. A table where nothing has
          // been paid cannot show that the two differ, which is the one thing
          // those columns are there to say.
          const payments: VoucherPayment[] = []
          if (hashCode(id) % 2 === 0) {
            const paidAt = new Date(
              Date.parse(`${row.date}T00:00:00`) + 9 * 86_400_000,
            )
            payments.push({
              id: `payment-${id}`,
              date: paidAt.toISOString().slice(0, 10),
              grossAmount: Math.round(row.grossAmount * 50) / 100,
              // The voucher's first cheque carries a hold-back, so the payment
              // row's deduction summary has something to render.
              deductions: deducted
                ? []
                : [
                    {
                      id: `payment-deduction-${id}`,
                      description: 'Marketing Advance',
                      amount: 250,
                    },
                  ],
              createdAt: paidAt.toISOString(),
              createdById: CURRENT_USER.id,
            })
            deducted = true
          }
          payables.push({ ...row, id, payments })
        }
      }
    }

    const grossScheduledIncome = Math.round(salePrice * 0.09)
    const otherIncome = Math.round(grossScheduledIncome * 0.04)
    const totalScheduledIncome = grossScheduledIncome + otherIncome
    const vacancyPct = faker.number.float({ min: 3, max: 9, fractionDigits: 1 })
    const vacancyCost = Math.round(totalScheduledIncome * (vacancyPct / 100))
    const grossIncome = totalScheduledIncome - vacancyCost
    const pitchOpEx = Math.round(grossIncome * 0.38)
    const pitchNoi = grossIncome - pitchOpEx
    const loanAmount = Math.round(salePrice * 0.65)
    const downPayment = salePrice - loanAmount
    const debtService = Math.round(loanAmount * 0.07)
    const pitchCapRate = Math.max(0, property.capRate + faker.number.float({ min: -0.005, max: 0.005, fractionDigits: 4 }))
    const rentRoll: RentRollRow[] = property.units.map((u): RentRollRow => {
      const rent = Math.round(u.sqft * faker.number.float({ min: 1.2, max: 3.5, fractionDigits: 2 }))
      return {
        id: faker.string.uuid(),
        unitId: u.id,
        tenant: faker.company.name(),
        actualRent: rent,
        marketRent: Math.round(rent * faker.number.float({ min: 1.0, max: 1.15, fractionDigits: 2 })),
        rentPerSf: u.sqft > 0 ? Math.round((rent / u.sqft) * 100) / 100 : 0,
        securityDeposit: rent,
        leaseStart: faker.date.past({ years: 3 }).toISOString().slice(0, 10),
        leaseEnd: faker.date.future({ years: 3 }).toISOString().slice(0, 10),
      }
    })

    const isLease = dealType !== 'Sale'
    const marketingUnitId = property.units.length > 0 ? property.units[0].id : null

    return {
      id,
      propertyId: property.id,
      name,
      slug: `${property.slug}-1`,
      status,
      publishedAt,
      dealType,
      dealSide,
      isClassic: spec.isClassic ?? false,
      unitId: marketingUnitId,
      parentDealId: null,

      // Deal (1:1)
      dealId,
      internalBrokers: brokersWithSide,
      outsideBrokers,
      sellerContactIds: sellerContacts.map((c) => c.id),
      buyerContactIds: buyerContacts.map((c) => c.id),
      tenantContactIds: [],
      otherContactIds: [],
      tasks,
      messages,
      activities: [],
      history,
      invoices,
      financials: {
        askingPrice: salePrice,
        askingPriceUnits: 'total',
        hidePrice: false,
        pricePerSqFt,
        capRate: pitchCapRate,
        income: [
          { id: faker.string.uuid(), label: 'Base Rent', amount: grossScheduledIncome },
          { id: faker.string.uuid(), label: 'Other Income', amount: otherIncome },
        ],
        grossScheduledIncome,
        otherIncome,
        totalScheduledIncome,
        vacancyPct,
        vacancyCost,
        grossIncome,
        expenses: [
          { id: faker.string.uuid(), label: 'Operating Expenses', amount: pitchOpEx },
        ],
        operatingExpenses: pitchOpEx,
        noi: pitchNoi,
        loanAmount,
        downPayment,
        debtService,
        cashFlow: pitchNoi - debtService,
        debtCoverageRatio: debtService > 0 ? Math.round((pitchNoi / debtService) * 100) / 100 : 0,
        grossRentMultiplier: grossScheduledIncome > 0 ? Math.round((salePrice / grossScheduledIncome) * 10) / 10 : 0,
        cashOnCash: downPayment > 0 ? Math.round(((pitchNoi - debtService) / downPayment) * 1000) / 10 : 0,
        scenarios: [
          { id: faker.string.uuid(), name: 'Worst Case', noi: Math.round(pitchNoi * 0.85), capRate: pitchCapRate + 0.005, cashFlow: Math.round((pitchNoi - debtService) * 0.7) },
          { id: faker.string.uuid(), name: 'Best Case', noi: Math.round(pitchNoi * 1.12), capRate: Math.max(0, pitchCapRate - 0.005), cashFlow: Math.round((pitchNoi - debtService) * 1.3) },
        ],
        rentRoll,
      },
      transaction: {
        salePrice,
        pricePerSqFt,
        commissionPct,
        commissionAmount,
        closeProbability: faker.number.int({ min: pMin, max: pMax }),
        contractExecutedDate: status === 'under-contract' || status === 'closed'
          ? faker.date.recent({ days: 120 }).toISOString().slice(0, 10) : null,
        closeDate: status === 'closed' ? faker.date.recent({ days: 90 }).toISOString().slice(0, 10) : null,
        listedOnDate: status !== 'proposal' ? faker.date.recent({ days: 200 }).toISOString().slice(0, 10) : null,
        listingExpirationDate: status !== 'proposal' ? faker.date.future({ years: 1 }).toISOString().slice(0, 10) : null,
        leaseCommencementDate: null,
        deadReason: null,
        nextCriticalDate: nextTask?.date ?? null,
        backOffice: {
          name,
          identifier: dealId,
          status: voucherStatus,
          closeDate: voucherCloseDate,
          approval: voucherApproval,
          relatedContactsLabel: `${sellerName}${sellerContacts.length + buyerContacts.length > 1 ? ` & ${sellerContacts.length + buyerContacts.length - 1} more` : ''}`,
          payerContactIds,
          preSplitDeductions,
          receivables,
          deposits,
          payables,
        },
      },
      marketing: {
        saleTitle: `${property.name} — ${TYPE_LABEL[property.propertyType]} Offering`,
        saleDescription: faker.lorem.paragraph(),
        saleBullets: faker.helpers.arrayElements(
          ['Prime location', 'Below-market rents', 'Recent capital improvements', 'Strong tenancy', 'Value-add upside'],
          faker.number.int({ min: 2, max: 4 }),
        ),
        saleClosingInfo: 'Offers due by the date noted in the OM.',
        leaseTitle: isLease ? `${property.name} — Space Available` : '',
        leaseDescription: isLease ? faker.lorem.sentence() : '',
        leaseBullets: isLease ? ['Flexible terms', 'Move-in ready'] : [],
        leaseCommissionSplitPct: isLease ? faker.helpers.arrayElement([null, 50, 60]) : null,
        propertyUse: faker.helpers.arrayElement(['Net Leased Investment', 'Investment', 'Owner/User', 'Business for Sale', 'Development'] as const),
        investmentType: faker.helpers.arrayElement(['Core', 'Core Plus', 'Value Add', 'Opportunistic', 'Distressed'] as const),
        includesRealEstate: true,
        auction: false,
        saleTerms: 'All cash or conventional financing.',
        reimbursement: 'NNN',
        marketingChannel: faker.helpers.arrayElement(['None', 'My Brokerage Website', 'Buildout Syndication Network'] as const),
        visibilityTier: faker.helpers.arrayElement(['Fully Private', 'Private', 'Semi-Public', 'Fully Public'] as const),
        publishFlags: { title: true, description: true, bullets: true, financials: false, photos: true },
        occupancySnapshot: status === 'proposal' ? null : property.occupancyPct,
        availableSqFt,
        locationDescription: `Located in ${property.submarket}, ${property.city}.`,
        spaceLeaseTerms: isLease
          ? property.units.map((u) => ({
              unitId: u.id,
              leaseRate: faker.number.float({ min: 8, max: 55, fractionDigits: 2 }),
              leaseRateUnits: 'SF/Yr' as const,
              hideLeaseRate: false,
              leaseType: faker.helpers.arrayElement(['Gross', 'Modified Gross', 'NNN', 'Modified Net', 'Full Service', 'Ground Lease'] as const),
              leaseTermMonths: faker.number.int({ min: 12, max: 120 }),
              dateAvailable: faker.date.soon({ days: 90 }).toISOString().slice(0, 10),
              minDivisibleSqFt: faker.helpers.arrayElement([null, Math.round(u.sqft / 2)]),
              maxContiguousSqFt: u.sqft,
              tiAllowance: faker.number.int({ min: 0, max: 60 }),
              freeRentMonths: faker.number.int({ min: 0, max: 6 }),
              signageAvailable: true,
              rentEscalators: '3% annual',
              sublease: faker.datatype.boolean(0.2),
              description: faker.lorem.sentence(),
              taxPerSf: faker.number.float({ min: 1, max: 6, fractionDigits: 2 }),
              taxStops: faker.helpers.arrayElement([null, 'Base year']),
              camPerSf: faker.number.float({ min: 2, max: 8, fractionDigits: 2 }),
              camStops: faker.helpers.arrayElement([null, 'Base year']),
              insurancePerSf: faker.number.float({ min: 0.5, max: 2, fractionDigits: 2 }),
              expenseStops: faker.helpers.arrayElement([null, 'Base year']),
              procurementFeePct: faker.helpers.arrayElement([null, 2, 3]),
              tenantsPayGas: faker.datatype.boolean(),
              tenantsPayElectric: true,
              tenantsPayWater: faker.datatype.boolean(),
              movingAllowance: faker.helpers.arrayElement([null, 5000, 10000]),
              buyoutAllowance: null,
              concession: faker.helpers.arrayElement([null, '1 month free per year']),
              netLeaseInvestment: false,
            }))
          : [],
      },
      internalNotes: faker.helpers.arrayElement(['', '', 'Seller motivated — wants to close before year-end.', 'Waiting on estoppels.']),

      createdAt,
      updatedAt: faker.date.recent({ days: 60 }).toISOString(),
    }
  })
}

// ── Pre-defined dynamic lists ─────────────────────────────────────────────────

/** Build a fully-specified serialized filter set (empty defaults + overrides). */
function listFilters(
  overrides: Partial<SerializedContactFilters>,
): SerializedContactFilters {
  return {
    assignedTo: 'all',
    source: [],
    side: [],
    relationship: [],
    dealStage: [],
    propertyTypes: [],
    tags: [],
    lastActivity: 'any',
    openTasks: 'any',
    listingInquiries: 'none',
    inquiryListingId: null,
    excludeDoNotCall: false,
    ...overrides,
  }
}

/**
 * The pre-defined dynamic lists shipped with the demo. Seeded into the call-list
 * store (deterministic ids) so they behave exactly like user-created dynamic
 * lists — editable filters, Save/Revert, delete.
 */
export function seedCallLists(): CallList[] {
  const defs: {
    id: string
    label: string
    description: string
    color: string
    createdOn: string
    filters: SerializedContactFilters
  }[] = [
    {
      id: 'seed-past-clients-no-touch',
      label: 'Past Clients - No Recent Touch',
      description:
        "Everyone I've closed with who I haven't talked to in 3+ months. Good for portfolio check-ins and staying top of mind for the next deal.",
      color: '#00b8d8',
      createdOn: '2024-05-08',
      filters: listFilters({
        relationship: ['past_client'],
        lastActivity: 'over90',
      }),
    },
    {
      id: 'seed-listing-leads-never-contacted',
      label: 'Listing Leads - Never Contacted',
      description:
        "Buyers who inquired on one of my listings and have never been called. The freshest interest in the book — and the fastest thing to lose.",
      color: '#fd9a00',
      createdOn: '2024-06-18',
      filters: listFilters({
        lastActivity: 'never',
        listingInquiries: 'any',
      }),
    },
  ]

  const dynamicLists: CallList[] = defs.map((d) => ({
    id: d.id,
    label: d.label,
    description: d.description,
    createdOn: d.createdOn,
    contactIds: [],
    source: 'user',
    type: 'dynamic',
    filters: d.filters,
    color: d.color,
  }))

  // Empty static list — a placeholder the user curates by hand. No filter rule
  // to write: "A-List" is the broker's own judgment, not a query.
  const staticLists: CallList[] = [
    {
      id: 'seed-a-list-owners',
      label: 'A-List Owners',
      description:
        'My best owner relationships. People with real portfolios who I expect to do business with again.',
      createdOn: '2024-05-22',
      contactIds: [],
      source: 'user',
      type: 'static',
      color: '#ff2630',
    },
  ]

  return [...dynamicLists, ...staticLists]
}

// ── Hero personas ─────────────────────────────────────────────────────────────
//
// Five hand-authored demo contacts — one per lifecycle stage — with fully
// hand-written activity arcs (see timelineHeroes.ts). Each hero overwrites a
// deterministic generated contact's identity and is wired to a listing at the
// stage/side their story requires, so the derived relationship/dealStage land
// exactly where the arc says they are. `createdAt`/`lastContactedAt` are pinned
// to the arc's hand-picked beat dates so the People table and feed agree.

interface HeroFixture {
  heroKey: HeroKey
  firstName: string
  lastName: string
  company: string
  title: string
  role: ContactRole
  source: ContactSource
  relationship: RelationshipStage
  tags: string[]
  notes: string
  /** Days ago the contact entered the book / was last really touched. */
  createdDaysAgo: number
  lastContactedDaysAgo: number
  /**
   * Days ago of the hero's newest timeline beat, when it's more recent than the
   * last contact — e.g. Rosa's inbound voicemail yesterday vs. the call we made
   * eight days ago. Feeds `lastActivityAt`; defaults to `lastContactedDaysAgo`.
   * Keep in step with the arc in timelineHeroes.ts (pinned by seed.test.ts).
   */
  lastActivityDaysAgo?: number
  lastTouch: string
  openTaskCount: number
  /** The deal the hero's arc runs on — null for the no-deal-yet stages. */
  deal: { status: ListingStage; side: DealSide; dealType?: DealType } | null
  /**
   * A property the hero owns outright with no deal on it yet — generated
   * fresh (so it carries no listings) and named on-story. It becomes the
   * hero's only linked property and shows under "Properties Owned".
   * `photoId` pins its imagery to a matching asset-class photo.
   */
  ownedProperty?: { name: string; propertyType: PropertyType; photoId?: string }
  /**
   * Story-specific name for the hero's property + deal (e.g. Earl's
   * "The Thompson Block"). Renames the claimed listing's property and every
   * listing on it so the whole Contact → Deal → Property path reads on-story.
   */
  dealName?: string
  /** An overnight market signal on this owner (Phase 4A hero). Owners with a
   * signal but `deal: null` get a coerced multifamily "hero property" so the
   * arc's opportunity + underwriting land on a real building. */
  signal?: OwnerSignal
}

const HERO_FIXTURES: HeroFixture[] = [
  {
    heroKey: 'rosa',
    firstName: 'Rosa',
    lastName: 'Delgado',
    company: 'Delgado Properties LLC',
    title: 'Owner',
    role: 'owner',
    source: 'Cold outreach',
    relationship: 'nurturing',
    tags: ['Local', 'Longtime owner'],
    notes:
      'Lost her husband last year — the building was their first joint investment. Slow play: no ask until she asks.',
    createdDaysAgo: 160,
    lastContactedDaysAgo: 8,
    // Her missed call + voicemail landed yesterday — that's the newest activity,
    // even though the last time we actually spoke was eight days ago.
    lastActivityDaysAgo: 1,
    lastTouch: 'Logged a call',
    openTaskCount: 1,
    deal: null,
    // The corner building she and Miguel bought together — owned, not listed.
    // Multifamily so the Cactus underwriting flow's supported-asset-class gate
    // (see eligibility.ts) naturally applies to her deal; the pinned photo is
    // the pool's multifamily building so imagery matches the asset class.
    ownedProperty: {
      name: 'The Delgado Building',
      propertyType: 'multifamily',
      photoId: 'photo-1515263487990-61b07816b324',
    },
    // Miguel's balloon note surfaces overnight — the loan-docs voicemail she left
    // is this signal made concrete (see timelineHeroes.ts rosa()).
    signal: {
      kind: 'loan-maturity',
      headline: "a maturing loan on Rosa Delgado's Delgado Building",
      detail:
        'The Delgado Building carries a balloon note maturing soon — the loan documents Rosa found in Miguel’s papers. Refinancing at today’s rates is tight, which is why she’s finally weighing her options.',
      observedAt: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    },
  },
  {
    heroKey: 'earl',
    firstName: 'Earl',
    lastName: 'Pettigrew',
    company: 'Pettigrew Holdings',
    title: 'Owner',
    role: 'owner',
    source: 'Referral',
    relationship: 'pitching',
    tags: ['Local', 'VIP'],
    notes:
      'Owned the storefront since 1979. Will only list with a broker who commits to a preservation-minded buyer.',
    createdDaysAgo: 40,
    lastContactedDaysAgo: 2,
    lastActivityDaysAgo: 1,
    lastTouch: 'Logged a call',
    openTaskCount: 1,
    deal: { status: 'proposal', side: 'seller', dealType: 'Sale' },
    dealName: 'The Thompson Block',
  },
  {
    heroKey: 'victor',
    firstName: 'Victor',
    lastName: 'Osei',
    company: 'Osei Capital Partners',
    title: 'Managing Principal',
    role: 'owner',
    source: 'Networking event',
    relationship: 'client',
    tags: ['Investor', 'Repeat client'],
    notes:
      'Numbers guy, not a story guy. Signed-lease pro formas only; report interest in writing.',
    createdDaysAgo: 120,
    lastContactedDaysAgo: 1,
    lastActivityDaysAgo: 0,
    lastTouch: 'Logged a call',
    openTaskCount: 1,
    deal: { status: 'active', side: 'seller' },
  },
  {
    heroKey: 'margaret',
    firstName: 'Margaret',
    lastName: 'Kwan',
    company: 'Kwan Family Trust',
    title: 'Trustee',
    role: 'buyer',
    source: 'Referral',
    relationship: 'client',
    tags: ['Out-of-state', '1031 exchange'],
    notes:
      'Out-of-state heir on a 1031 clock. Never tours in person — proxy video, same day. Her CPA re-runs every number.',
    createdDaysAgo: 100,
    lastContactedDaysAgo: 2,
    lastActivityDaysAgo: 1,
    lastTouch: 'Logged a call',
    openTaskCount: 1,
    deal: { status: 'under-contract', side: 'buyer' },
  },
  {
    heroKey: 'patricia',
    firstName: 'Patricia',
    lastName: 'Vance',
    company: 'Meridian Realty Trust',
    title: 'VP of Acquisitions',
    role: 'owner',
    source: 'Manual entry',
    relationship: 'past_client',
    tags: ['Institutional'],
    notes:
      'Institutional, data-driven, board approves the final buyer. Closed at value — next asset teed up for next year.',
    createdDaysAgo: 210,
    lastContactedDaysAgo: 5,
    lastActivityDaysAgo: 2,
    lastTouch: 'Logged a call',
    openTaskCount: 0,
    deal: { status: 'closed', side: 'seller' },
  },
]

/** Force a listing to the stage a hero's story requires, keeping history sane. */
function forceListingStage(l: Listing, status: ListingStage): void {
  if (l.status === status) return
  const stageStartedAt = new Date(Date.now() - 30 * 86_400_000).toISOString()
  l.history.push({
    id: faker.string.uuid(),
    label: 'Stage updated from',
    fromStage: l.status,
    toStage: status,
    actor: l.internalBrokers[0]?.name ?? 'System',
    timestamp: stageStartedAt,
  })
  l.status = status
  if (status === 'active' || status === 'under-contract' || status === 'closed') {
    l.publishedAt = l.publishedAt ?? stageStartedAt
  }
}

/**
 * Overwrite five deterministic generated contacts with the hero personas and
 * wire each to a listing at their story's stage/side. Mutates in place; runs
 * before `reconcileContactDealFields` so the derived fields follow the wiring.
 */
function applyHeroes(
  contacts: Contact[],
  listings: Listing[],
  properties: Property[],
): void {
  const DAY_MS = 86_400_000
  const daysAgoIso = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString()
  const claimed = new Set<string>()

  HERO_FIXTURES.forEach((h, i) => {
    // A stable host well past the front of the directory sort.
    const host = contacts[10 + i]

    Object.assign(host, {
      heroKey: h.heroKey,
      firstName: h.firstName,
      lastName: h.lastName,
      email: `${h.firstName.toLowerCase()}@${h.company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
      company: h.company,
      title: h.title,
      role: h.role,
      assignedTo: ASSIGNEES[0],
      source: h.source,
      relationship: h.relationship,
      tags: h.tags,
      notes: h.notes,
      createdAt: daysAgoIso(h.createdDaysAgo),
      lastContactedAt: daysAgoIso(h.lastContactedDaysAgo),
      lastActivityAt: daysAgoIso(h.lastActivityDaysAgo ?? h.lastContactedDaysAgo),
      lastTouch: h.lastTouch,
      openTaskCount: h.openTaskCount,
      inquiries: 0,
      phoneStatus: 'valid',
      doNotCall: false,
    } satisfies Partial<Contact>)

    // Detach the host from every deal, then wire the story's deal (if any).
    for (const l of listings) {
      l.sellerContactIds = l.sellerContactIds.filter((id) => id !== host.id)
      l.buyerContactIds = l.buyerContactIds.filter((id) => id !== host.id)
      l.otherContactIds = l.otherContactIds.filter((id) => id !== host.id)
    }

    // Story-owned property: generate a fresh one (added after listing
    // generation, so it carries no deals) and make it the hero's only linked
    // property. Regenerate until the type matches so all the type-derived
    // numbers (size, price, units) stay internally coherent.
    if (h.ownedProperty) {
      let p = generateProperty()
      while (p.propertyType !== h.ownedProperty.propertyType) {
        p = generateProperty()
      }
      p.name = h.ownedProperty.name
      p.slug =
        p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + p.id.slice(0, 6)
      p.photoId = h.ownedProperty.photoId
      // Owned, not on the market — no listing exists for it, so no stage
      // either. `generateProperty` already leaves `status` null; this is the
      // case that used to say `inactive` and read as "Lost".
      properties.push(p)
      host.propertyIds = [p.id]
      host.ownedPropertyIds = [p.id]
      // A contact's address matches the property they own, so the contact
      // record and its owned building read as one place (e.g. Rosa Delgado's
      // address is The Delgado Building's).
      host.street = p.street
      host.city = p.city
      host.state = p.state
      host.zip = p.zip
    }

    // Phase 4A hero: an owner carrying a signal but no deal yet. Give them a
    // multifamily "hero property" (coerced if needed) so the arc's opportunity
    // and its underwriting land on a real, eligible building.
    if (h.signal) {
      host.signal = h.signal
      // Prefer the hero's own building (Rosa's Delgado Building) so the signal,
      // opportunity, and underwriting all land on one place. Fall back to the
      // old coerced-listing behavior only if the hero has no owned property.
      let heroProp = properties.find((p) => p.id === host.ownedPropertyIds?.[0])
      if (!heroProp) {
        const usedPropIds = new Set(
          listings.filter((l) => claimed.has(l.id)).map((l) => l.propertyId),
        )
        const fallbackProp =
          properties.find((p) => p.propertyType === 'multifamily' && !usedPropIds.has(p.id)) ??
          properties.find((p) => !usedPropIds.has(p.id))!
        host.propertyIds = [fallbackProp.id, ...host.propertyIds.filter((id) => id !== fallbackProp.id)]
        heroProp = fallbackProp
      }
      heroProp.propertyType = 'multifamily'
      heroProp.propertySubtype = 'Mid-Rise'
      if (h.dealName) heroProp.name = h.dealName

      // Phase 4C: make the hero property read like a real 48-unit workforce building
      // with a STATED (marketing) vs ACTUAL (T-12) occupancy gap the underwrite flags.
      heroProp.residentialUnits = 48
      heroProp.buildingSqFt = 41_000
      heroProp.askingPrice = 6_200_000
      heroProp.capRate = 0.058
      heroProp.occupancyPct = 94 // stated
      if (heroProp.financialRecords[0]) {
        heroProp.financialRecords[0].source = 'T-12 actuals'
        heroProp.financialRecords[0].occupancyPct = 78 // actual
        heroProp.financialRecords[0].vacancyRate = 0.22
        // Keep the latest record's capRate mirroring the property's (existing seed
        // invariant, seed.test.ts:92) — only occupancy is meant to diverge here.
        heroProp.financialRecords[0].capRate = heroProp.capRate
      }
    }

    if (!h.deal) return

    // Prefer a listing matching both stage and deal type (when the story pins
    // one), degrading to stage-only, then to anything unclaimed.
    const target =
      listings.find(
        (l) =>
          l.status === h.deal!.status &&
          (!h.deal!.dealType || l.dealType === h.deal!.dealType) &&
          !claimed.has(l.id),
      ) ??
      listings.find((l) => l.status === h.deal!.status && !claimed.has(l.id)) ??
      listings.find((l) => !claimed.has(l.id))!
    claimed.add(target.id)
    forceListingStage(target, h.deal.status)

    // Story-specific rename: the claimed property and every listing on it, so
    // the name reads on-story from the contact page through deal and property.
    if (h.dealName) {
      const property = properties.find((p) => p.id === target.propertyId)
      if (property) {
        const oldName = property.name
        property.name = h.dealName
        for (const l of listings) {
          if (l.propertyId !== property.id) continue
          l.name = l.name.replace(oldName, h.dealName)
          l.transaction.backOffice.name = l.name
          l.marketing.saleTitle = l.marketing.saleTitle.replace(oldName, h.dealName)
          if (l.marketing.leaseTitle) {
            l.marketing.leaseTitle = l.marketing.leaseTitle.replace(oldName, h.dealName)
          }
        }
      }
    }

    if (h.deal.side === 'seller') {
      target.sellerContactIds = [host.id, ...target.sellerContactIds]
      target.transaction.backOffice.relatedContactsLabel = `${h.firstName} ${h.lastName}`
    } else {
      target.buyerContactIds = [host.id, ...target.buyerContactIds]
    }
    if (!host.propertyIds.includes(target.propertyId)) {
      host.propertyIds.push(target.propertyId)
    }
  })

  // Detaching heroes can leave a listing without a seller — and progressed
  // deals (under contract / closed) must also keep a buyer, per the stage-gate
  // rules (`buyerLinked`, see stageGates.ts). Repair with another non-hero
  // contact linked to the same property (any non-hero contact as a last
  // resort), never double-casting a contact on both sides of one deal.
  const heroIds = new Set(
    HERO_FIXTURES.map((_, i) => contacts[10 + i].id),
  )
  const repair = (l: Listing, exclude: string[]): string => {
    const ok = (c: Contact) =>
      !heroIds.has(c.id) && !exclude.includes(c.id)
    const fallback =
      contacts.find((c) => ok(c) && c.propertyIds.includes(l.propertyId)) ??
      contacts.find(ok)!
    if (!fallback.propertyIds.includes(l.propertyId)) {
      fallback.propertyIds.push(l.propertyId)
    }
    return fallback.id
  }
  for (const l of listings) {
    if (l.sellerContactIds.length === 0) {
      l.sellerContactIds = [repair(l, l.buyerContactIds)]
    }
    const progressed = l.status === 'under-contract' || l.status === 'closed'
    if (progressed && l.buyerContactIds.length === 0) {
      l.buyerContactIds = [repair(l, l.sellerContactIds)]
    }
  }
}

// ── Top-level export ──────────────────────────────────────────────────────────

export function generateDataset() {
  faker.seed(SEED)

  // Two populations, and the split is the point: `dealProperties` are the ones
  // the pipeline transacts on, `trackedProperties` are records the company
  // simply keeps — no deal, no stage. Only the first list is handed to
  // `generateListings`, which is what keeps "a property doesn't need a deal"
  // true in the data rather than just in the types.
  const dealProperties = Array.from({ length: PROPERTY_COUNT }, () => generateProperty())
  const trackedProperties = Array.from({ length: TRACKED_PROPERTY_COUNT }, () =>
    generateProperty(),
  )
  const properties = [...dealProperties, ...trackedProperties]

  const allPropertyIds = properties.map((p) => p.id)

  const contacts = Array.from({ length: CONTACT_COUNT }, () => generateContact(allPropertyIds))

  // Reconcile the Contact↔Property graph so every property has associated
  // contacts, then draw each deal's parties from its own property's contacts.
  // This keeps the graph reciprocal: a contact's deals are deals they're a
  // party to, and those deals sit on a property the contact is linked to — so
  // clicking through Contact → Deal → Property "feels like one system".
  const contactsByProperty = new Map<string, Contact[]>()
  for (const c of contacts) {
    for (const pid of c.propertyIds) {
      const arr = contactsByProperty.get(pid) ?? []
      arr.push(c)
      contactsByProperty.set(pid, arr)
    }
  }
  // Guarantee at least two associated contacts per property (so a deal can have
  // a distinct seller and buyer), adding links deterministically where short.
  for (const p of properties) {
    const linked = contactsByProperty.get(p.id) ?? []
    for (const c of contacts) {
      if (linked.length >= 2) break
      if (!c.propertyIds.includes(p.id)) {
        c.propertyIds.push(p.id)
        linked.push(c)
      }
    }
    contactsByProperty.set(p.id, linked)
  }

  // One deal per deal-property, at the stage assigned by DEAL_PIPELINE. The
  // property's own status is aligned to its deal so property cards and the deal
  // read the same stage (PROPERTY_COUNT matches DEAL_PIPELINE.length). The
  // tracked properties are deliberately not in this list — they keep the null
  // status `generateProperty` gave them.
  const dealIdRef = { n: 100 }
  // Shared across every deal, so the cheque / wire alternation actually
  // alternates — see `depositRef` on `generateListings`.
  const depositRef = { n: 0 }
  const listings = dealProperties.flatMap((p, i) => {
    const spec = DEAL_PIPELINE[i % DEAL_PIPELINE.length]
    p.status = spec.stage
    return generateListings(
      p,
      contactsByProperty.get(p.id) ?? contacts,
      dealIdRef,
      spec,
      depositRef,
    )
  })

  // Overwrite five generated contacts with the hand-authored hero personas and
  // wire their deals — before reconciliation so derived fields follow.
  applyHeroes(contacts, listings, properties)

  // Turn two seeded lease deals into umbrella shells with child space deals.
  // After applyHeroes so the heroes have already claimed their listings; before
  // reconciliation so the children's tenants get their contact fields resolved.
  applyLeaseSpaces(listings, properties, contacts, dealIdRef)

  // Reconcile each contact's deal-derived fields with the deals they're actually
  // a party to. The listings are the source of truth for the contact↔deal graph,
  // so `dealStage` (the furthest-along stage), `relationship` (per the lifecycle
  // rules), and `side` must follow them rather than the random values picked at
  // contact generation — otherwise the People table shows a stage the contact's
  // deals don't support. The live store re-runs this same pass on every deal
  // mutation (see `reconcileContactStages`).
  const reconciled = new Map(
    reconcileContactDealFields(contacts, listings).map((c) => [c.id, c]),
  )
  const finalContacts = contacts.map((c) => reconciled.get(c.id) ?? c)

  // Syndication sources and a pool of things a lead actually writes when they
  // reach out on a marketed listing — short, specific, and mostly asking for
  // the numbers or a tour. Kept blunt on purpose: real inquiries are.
  const INQUIRY_CHANNELS = ['Buildout site', 'LoopNet', 'Crexi', 'Brochure link']
  const INQUIRY_MESSAGES = [
    'Interested in the offering memorandum and current rent roll. We buy in this submarket and can close quickly.',
    'Is this still available? Looking for something in this size range for a 1031 that closes in the next 60 days.',
    'Please send the OM. What are the seller\'s expectations on price, and is there any flexibility on timing?',
    'My client is expanding and needs space in this corridor. Can we schedule a walkthrough this week?',
    'Requesting document access. We are an owner-operator with four assets nearby and pay all cash.',
    'What are the actual T-12 numbers versus what is marketed? Occupancy is the thing I need to understand.',
    'Saw this on the site. Are you taking backup offers, and what does the current debt look like?',
    'Interested but the asking price looks ahead of the comps I have. Happy to talk if the seller is realistic.',
  ]

  // Give every open inquiry a concrete listing behind it, so the Listing
  // Inquiries filter has real data. Searchers inquire about actively marketed
  // listings; one distinct listing per inquiry keeps the count honest.
  const marketedListingIds = listings
    .filter((l) => l.status === 'active')
    .map((l) => l.id)
  for (const c of finalContacts) {
    // A record cannot predate its own history. `createdAt` is drawn from the
    // last year while the contacted buckets reach back two, so drawing them
    // independently produced contacts created months *after* the last time we
    // spoke to them — and since the arc is anchored on that touch, every beat
    // ran before the record existed and "Contact created" sorted to the TOP of
    // the timeline as the newest thing that had happened (16 of 80 contacts).
    //
    // The touch keeps its bucket, because the pre-defined lists are built on it;
    // creation is what moves back behind it. The gap is derived from the drawn
    // date rather than redrawn, so repairing this leaves every other seeded
    // value — names, companies, comps — exactly where it was.
    if (c.lastContactedAt && c.createdAt > c.lastContactedAt) {
      const gap = 30 + (Date.parse(c.createdAt) % 150)
      c.createdAt = new Date(
        Date.parse(c.lastContactedAt) - gap * 86_400_000,
      ).toISOString()
    }
    if (c.inquiries > 0 && marketedListingIds.length > 0) {
      c.inquiredListingIds = faker.helpers.arrayElements(
        marketedListingIds,
        Math.min(c.inquiries, marketedListingIds.length),
      )
      // Each inquiry gets its own date and channel — a contact with two
      // inquiries didn't make them both on the same afternoon. Roughly half
      // carry the note they typed, so the book has real examples of a lead's
      // own words without having to run a demo arc first.
      const details: NonNullable<Contact['inquiryDetails']> = {}
      for (const listingId of c.inquiredListingIds) {
        const wroteSomething = faker.datatype.boolean(0.55)
        details[listingId] = {
          channel: faker.helpers.arrayElement(INQUIRY_CHANNELS),
          date: faker.date
            .recent({ days: 75, refDate: new Date() })
            .toISOString(),
          ...(wroteSomething
            ? { message: faker.helpers.arrayElement(INQUIRY_MESSAGES) }
            : {}),
        }
      }
      c.inquiryDetails = details

      // A lead the inquiry *created* begins at that inquiry: the record starts on
      // the earliest thing that happened to it, so `createdAt` moves to the first
      // inquiry (or to an even earlier conversation, for one we've since worked).
      // Otherwise a lead sourced "Listing inquiry" reads as having sat in the
      // book for months before the inquiry that put them there.
      //
      // The newest inquiry is also genuine inbound activity, so it feeds
      // `lastActivityAt` the way Rosa's voicemail does: the Last Active column
      // shows the inquiry even though we've never contacted them back.
      const dates = Object.values(details)
        .map((d) => d.date)
        .filter((d): d is string => !!d)
        .sort()
      const first = dates[0]
      const newest = dates[dates.length - 1]
      if (c.source === 'Listing inquiry') {
        if (first) {
          c.createdAt =
            c.lastContactedAt && c.lastContactedAt < first
              ? c.lastContactedAt
              : first
        }
        const current = c.lastActivityAt ?? c.lastContactedAt
        if (newest && (!current || newest > current)) c.lastActivityAt = newest
      } else if (first && first < c.createdAt) {
        // An owner we already knew who has since inquired keeps their older
        // creation date — but if the inquiry landed first, the inquiry is when
        // the record began, whatever the source says. An inquiry attached to a
        // contact who didn't exist yet is the same contradiction the arc clock
        // has to clamp away downstream.
        c.createdAt = first
      }
    }
  }

  const comps = properties.flatMap((p) => {
    const count = faker.number.int({ min: 1, max: 5 })
    return Array.from({ length: count }, () => generateComp(p.id, p.buildingSqFt, p.propertyType))
  })

  // Light-touch demo seeding for the new listing-form fields (Task 16). All of
  // these fields are optional, so the other 49 properties are left untouched —
  // this is purely demo polish on one property + its first listing.
  //
  // Note: these mirror the shape of `emptyLot()`/`emptyCondo()`/`emptyUnitMixRow()`/
  // `emptyVisualMediaLink()` in `createListing.ts` (with a couple of fields
  // overridden below) rather than importing those builders, because
  // `createListing.ts` imports from `store.ts` → `dataStore.ts` → `seed.ts`,
  // and importing it here would close that cycle and break module init order
  // (`generateDataset` is invoked from `dataStore.ts` at module load).
  const demoProperty = properties[0]
  demoProperty.country = 'United States'
  demoProperty.measurementSystem = 'Imperial'
  demoProperty.tenancy = 'Multiple'
  demoProperty.lots = [
    {
      id: faker.string.uuid(),
      status: 'active',
      closeDate: null,
      buyerReferralSource: null,
      lotNumber: 'Lot 4',
      address: demoProperty.street,
      apn: '',
      subtype: null,
      salePrice: 185000,
      priceUnits: 'Total',
      size: 0.42,
      sizeUnits: 'Acre',
      description: 'Level, cleared parcel with utilities stubbed to the lot line.',
      zoning: '',
    } satisfies Lot,
  ]
  demoProperty.condos = [
    {
      id: faker.string.uuid(),
      status: 'active',
      closeDate: null,
      addressUnit: 'Unit 210',
      salePrice: 425000,
      priceUnits: 'Total',
      hidePrice: false,
      hidePriceLabel: null,
      size: 1150,
      sizeUnits: 'Sq Ft',
      description: 'Corner unit with private entrance and reserved parking.',
    } satisfies Condo,
  ]
  demoProperty.unitMix = [
    {
      id: faker.string.uuid(),
      unitType: '1BR/1BA',
      bedrooms: 1,
      bathrooms: 1,
      count: 12,
      size: 650,
      rackRate: null,
      rent: 1450,
      minRent: null,
      maxRent: null,
      marketRent: 1500,
      securityDeposit: null,
      description: 'Renovated units with in-unit laundry.',
    } satisfies UnitMixRow,
  ]
  const demoListing = listings.find((l) => l.propertyId === demoProperty.id)
  if (demoListing) {
    demoListing.marketing.visualMedia = [
      {
        id: faker.string.uuid(),
        url: 'https://tours.example.com/matterport/demo-listing',
        mediaType: 'Matterport Tour',
        unitId: null,
      } satisfies VisualMediaLink,
    ]
    demoListing.marketing.overrideDisclaimer = false
  }

  return { properties, listings, comps, contacts: finalContacts }
}

/**
 * Seed a realistic subset of contacts with teammate access. Most contacts stay
 * private (owner-only); roughly one in four is shared — usually with a single
 * collaborator, occasionally two — drawing varied teammates and tiers. Keyed off
 * the contact's index so the assignment is deterministic and stable across runs.
 */
export function seedContactShares(
  contacts: Contact[],
): Map<string, ContactShare[]> {
  const tiers: AccessTier[] = ['view', 'contributor', 'outreach']
  const map = new Map<string, ContactShare[]>()
  contacts.forEach((c, i) => {
    // ~1 in 4 contacts is shared; the rest stay owner-only.
    if (i % 4 !== 1) return
    const shares: ContactShare[] = [
      { member: TEAMMATES[i % TEAMMATES.length], tier: tiers[i % tiers.length] },
    ]
    // A minority also carry a second collaborator.
    if (i % 12 === 1) {
      shares.push({
        member: TEAMMATES[(i + 3) % TEAMMATES.length],
        tier: tiers[(i + 2) % tiers.length],
      })
    }
    map.set(c.id, shares)
  })
  return map
}
