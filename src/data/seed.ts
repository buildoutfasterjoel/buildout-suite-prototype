import { faker } from '@faker-js/faker'
import type {
  Property,
  Listing,
  ListingStage,
  DealBroker,
  DealHistoryEntry,
  FinancialDeduction,
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
} from './types'
import type { CallList } from './contactLists'
import type { SerializedContactFilters } from '#/components/contacts/contactFilterModel'
import { reconcileContactDealFields } from './contactStage'

const SEED = 20240101
const PROPERTY_COUNT = 50
const CONTACT_COUNT = 80

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

// Unified listing + deal lifecycle. Weighted toward the active middle.
const STAGE_WEIGHTS = [
  { weight: 12, value: 'proposal' as const },
  { weight: 40, value: 'active' as const },
  { weight: 22, value: 'under-contract' as const },
  { weight: 16, value: 'closed' as const },
  { weight: 10, value: 'inactive' as const },
]

const SPACE_LABELS = [
  'Suite 100',
  'Suite 200',
  'Suite 300',
  'Ground Floor Retail',
  'Pad A',
  'Pad B',
  'Mezzanine',
]

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
    subtypes: ['Warehouse', 'Flex', 'Distribution', 'Manufacturing', 'Cold Storage'],
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
    suffixes: ['Logistics Center', 'Distribution Center', 'Business Park', 'Industrial Park', 'Commerce Park'],
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

function generateProperty(): Property {
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

  return {
    id,
    name: baseName,
    slug,
    status: faker.helpers.weightedArrayElement(STAGE_WEIGHTS),

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
const ASSIGNEES = ['J. Whitfield', 'A. Mendez', 'R. Patel', 'S. Kim']

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
}

/** Likelihood a contact is tied to a deal, by relationship stage. */
const DEAL_PROBABILITY: Record<RelationshipStage, number> = {
  cold: 0.15,
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
  const role: ContactRole = faker.helpers.weightedArrayElement([
    { weight: 30, value: 'broker' as const },
    { weight: 25, value: 'owner' as const },
    { weight: 20, value: 'buyer' as const },
    { weight: 15, value: 'tenant' as const },
    { weight: 10, value: 'lender' as const },
  ])

  const relationship: RelationshipStage = faker.helpers.weightedArrayElement([
    { weight: 42, value: 'cold' as const },
    { weight: 20, value: 'nurturing' as const },
    { weight: 12, value: 'pitching' as const },
    { weight: 16, value: 'client' as const },
    { weight: 10, value: 'past_client' as const },
  ])

  const source: ContactSource = faker.helpers.weightedArrayElement([
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
    contactedBucket === 'never'
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

  // Inquiries come from the buy side actively searching.
  const inquiries =
    side === 'buyer'
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

  const propertyIds = faker.helpers.arrayElements(
    allPropertyIds,
    faker.number.int({ min: 1, max: 4 }),
  )

  return {
    id: faker.string.uuid(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    phone: faker.phone.number({ style: 'national' }),
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
    title: faker.helpers.arrayElement(TITLE_POOL),
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

function pickDealType(): DealType {
  return faker.helpers.weightedArrayElement([
    { weight: 65, value: 'Sale' as const },
    { weight: 35, value: 'Lease' as const },
  ])
}

const STAGE_CLOSE_PROBABILITY: Record<ListingStage, [number, number]> = {
  proposal: [5, 20],
  active: [25, 55],
  'under-contract': [65, 90],
  closed: [100, 100],
  inactive: [0, 15],
}

function generateBroker(side: 'internal' | 'outside', commissionAmount: number): DealBroker {
  const splitPct = side === 'internal' ? 100 : faker.helpers.arrayElement([40, 50, 60])
  return {
    id: faker.string.uuid(),
    name: `${faker.person.firstName()} ${faker.person.lastName()}`,
    role: side === 'internal' ? 'Primary Broker - Sell Side' : 'Outside Broker',
    email: faker.internet.email().toLowerCase(),
    side,
    commissionSplitPct: splitPct,
    grossCommission: Math.round(commissionAmount * (splitPct / 100)),
    commissionPlan: side === 'internal' ? 'No Plan' : undefined,
    personalSplitPct: side === 'internal' ? faker.helpers.arrayElement([45, 55, 60, 70]) : undefined,
  }
}

const DEDUCTION_CATEGORIES = [
  { category: 'Marketing', description: 'Billboard Fees' },
  { category: 'Marketing', description: 'Digital Ad Spend' },
  { category: 'Legal', description: 'Closing Review' },
  { category: 'Admin', description: 'Processing Fee' },
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
        todo('Upload executed listing agreement', 2, '2 days after listing executed'),
        todo('Order professional photography', 3, '3 days after listing executed'),
        todo('Order property signage', 5, '5 days after listing executed'),
        todo('Publish listing to website', 7, '7 days after listing executed'),
      ]
    case 'active':
      return [
        auto('Send marketing package', 'Sent to prospect list', 2),
        todo('Schedule property tours', 10, '10 days after listing went live'),
        todo('Review incoming offers', 20, null, 'overdue'),
        todo('Confirm due diligence dates', 30),
      ]
    case 'under-contract':
      return [
        todo('Schedule inspection', 5, null, 'complete'),
        todo('Order title and escrow', 10),
        todo('Confirm financing and appraisal', 15),
        todo('Review closing disclosures', 40, '5 days before target closing'),
      ]
    case 'closed':
      return [
        todo('Schedule inspection', 5, null, 'complete'),
        todo('Order title and escrow', 10, null, 'complete'),
        todo('Confirm financing and appraisal', 15, null, 'complete'),
        todo('Review closing disclosures', 40, null, 'complete'),
        todo('Send final commission statement', 50),
      ]
    case 'inactive':
      return [
        todo('Archive listing documents', 1, null, 'complete'),
        todo('Follow up with owner', 14),
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
): Listing[] {
  const count = faker.helpers.weightedArrayElement([
    { weight: 60, value: 1 },
    { weight: 28, value: 2 },
    { weight: 12, value: 3 },
  ])
  const spaceLabels = faker.helpers.arrayElements(SPACE_LABELS, count)
  const basePricePerSqFt = property.buildingSqFt > 0 ? property.askingPrice / property.buildingSqFt : 0

  return Array.from({ length: count }, (_, i): Listing => {
    const id = faker.string.uuid()
    const dealId = String(dealIdRef.n++)
    const availableSqFt = count === 1
      ? property.buildingSqFt
      : Math.max(500, Math.round((property.buildingSqFt / count) * faker.number.float({ min: 0.7, max: 1.2, fractionDigits: 2 })))
    const dealType = pickDealType()
    const name = count === 1 ? property.name : `${property.name} — ${spaceLabels[i]}`
    const status: ListingStage = i === 0
      ? property.status
      : faker.helpers.weightedArrayElement(STAGE_WEIGHTS)

    // Transaction — Lease deals carry no sale headline data (see marketing.spaceLeaseTerms).
    const salePrice = dealType === 'Sale' ? round(availableSqFt * basePricePerSqFt) : 0
    const pricePerSqFt = availableSqFt > 0 ? Math.round((salePrice / availableSqFt) * 100) / 100 : 0
    const commissionPct = faker.number.float({ min: 2, max: 4, fractionDigits: 1 })
    const commissionAmount = Math.round(salePrice * (commissionPct / 100))
    const [pMin, pMax] = STAGE_CLOSE_PROBABILITY[status]

    // Pre-split deductions come off the top before brokers are paid out.
    const deductionPick = faker.helpers.arrayElement(DEDUCTION_CATEGORIES)
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

    const internalBrokers = [generateBroker('internal', netCommission)]
    const outsideBrokers = faker.datatype.boolean({ probability: 0.4 })
      ? [generateBroker('outside', commissionAmount)]
      : []

    // Which side of the deal the broker represents.
    const dealSide: DealSide = faker.helpers.weightedArrayElement([
      { weight: 65, value: 'seller' },
      { weight: 35, value: 'buyer' },
    ])

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

    const tasks = generateTasks(status, stageStartedAt)
    const nextTask = tasks.find((t) => t.status !== 'complete' && t.date)
    const messages = Array.from(
      { length: faker.number.int({ min: 0, max: 2 }) },
      () => ({
        id: faker.string.uuid(),
        author: `${faker.person.firstName()} ${faker.person.lastName()}`,
        text: faker.lorem.sentence(),
        timestamp: faker.date.recent({ days: 30 }).toISOString(),
      }),
    )

    const voucherStatus = status === 'closed'
      ? ('Approved' as const)
      : faker.helpers.weightedArrayElement([
          { weight: 40, value: 'Approved' as const },
          { weight: 40, value: 'Pending' as const },
          { weight: 20, value: 'Draft' as const },
        ])

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
    const marketingUnitId = property.units.length > 0 ? property.units[i % property.units.length].id : null

    return {
      id,
      propertyId: property.id,
      name,
      slug: `${property.slug}-${i + 1}`,
      status,
      publishedAt,
      dealType,
      dealSide,
      unitId: marketingUnitId,
      parentDealId: null,

      // Deal (1:1)
      dealId,
      internalBrokers,
      outsideBrokers,
      sellerContactIds: sellerContacts.map((c) => c.id),
      buyerContactIds: buyerContacts.map((c) => c.id),
      tenantContactIds: [],
      otherContactIds: [],
      tasks,
      messages,
      activities: [],
      history,
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
          closeDate: status === 'closed' ? faker.date.recent({ days: 90 }).toISOString().slice(0, 10) : null,
          relatedContactsLabel: `${sellerName}${sellerContacts.length + buyerContacts.length > 1 ? ` & ${sellerContacts.length + buyerContacts.length - 1} more` : ''}`,
          preSplitDeductions,
          receivables: status === 'closed'
            ? [
                {
                  id: faker.string.uuid(),
                  payerName: `${(buyerContacts[0] ?? sellerContacts[0]).firstName} ${(buyerContacts[0] ?? sellerContacts[0]).lastName}`,
                  payerEmail: (buyerContacts[0] ?? sellerContacts[0]).email,
                  dueDate: faker.date.recent({ days: 30 }).toISOString().slice(0, 10),
                  billingDescription: 'Full Payment',
                  amount: commissionAmount,
                  credited: 0,
                },
              ]
            : [],
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
        marketingChannel: faker.helpers.arrayElement(['None', 'Buildout Buyer Network', 'My Brokerage Website', 'Buildout Syndication Network'] as const),
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
      id: 'seed-cold-prospects-revive',
      label: 'Cold Prospects to Revive',
      description:
        "Owners I haven't talked to in 3+ months with nothing scheduled. Time to reach back out before they forget about me.",
      color: '#3f86f2',
      createdOn: '2024-05-01',
      filters: listFilters({
        relationship: ['cold'],
        lastActivity: 'over90',
        openTasks: 'none',
      }),
    },
    {
      id: 'seed-active-buyers-no-touch',
      label: 'Active Buyers - No Recent Touch',
      description:
        "My active buyers I haven't checked in with in 1–3 months. Need to follow up before they go cold or buy somewhere else.",
      color: '#00bc7d',
      createdOn: '2024-05-14',
      filters: listFilters({
        side: ['buyer'],
        relationship: ['nurturing', 'client'],
        lastActivity: '30to90',
        openTasks: 'none',
      }),
    },
    {
      id: 'seed-pitching-needs-follow-up',
      label: 'Pitching - Needs Follow-Up',
      description:
        "Sellers I'm actively pitching with no next step on the calendar. These are slipping through the cracks - gotta follow up before momentum dies.",
      color: '#9f55f7',
      createdOn: '2024-06-02',
      filters: listFilters({
        relationship: ['pitching'],
        openTasks: 'none',
      }),
    },
    {
      id: 'seed-never-touched-first-outreach',
      label: 'Never Touched - Needs First Outreach',
      description:
        "Contacts in my book I've never actually reached out to. These came in from public records or imports and just sat there.",
      color: '#fd9a00',
      createdOn: '2024-06-18',
      filters: listFilters({
        source: ['Public records', 'Manual entry'],
        lastActivity: 'never',
        relationship: ['cold'],
      }),
    },
    {
      id: 'seed-past-seller-clients-no-touch',
      label: 'Past Seller Clients - No Recent Touch',
      description:
        "Sellers I've closed with who I haven't talked to in 3+ months. Good for portfolio check-ins and staying top of mind for the next deal.",
      color: '#00b8d8',
      createdOn: '2024-06-30',
      filters: listFilters({
        relationship: ['past_client'],
        side: ['seller'],
        lastActivity: 'over90',
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

  // Empty static lists — placeholders the user curates by hand.
  const staticLists: CallList[] = [
    {
      id: 'seed-a-list-owners',
      label: 'A-List Owners',
      description:
        'My best owner relationships. People with real portfolios who I expect to do business with again.',
      createdOn: '2024-05-08',
      contactIds: [],
      source: 'user',
      type: 'static',
      color: '#ff2630',
    },
    {
      id: 'seed-referral-sources',
      label: 'Referral Sources',
      description:
        'My attorneys, lenders, property managers, and other professionals who send me business. Not buyers or sellers themselves, just the people in my network who open doors.',
      createdOn: '2024-05-22',
      contactIds: [],
      source: 'user',
      type: 'static',
      color: '#ffd346',
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
  lastTouch: string
  openTaskCount: number
  /** The deal the hero's arc runs on — null for the no-deal-yet stages. */
  deal: { status: ListingStage; side: DealSide } | null
}

const HERO_FIXTURES: HeroFixture[] = [
  {
    heroKey: 'rosa',
    firstName: 'Rosa',
    lastName: 'Delgado',
    company: 'Delgado Family Properties LLC',
    title: 'Owner',
    role: 'owner',
    source: 'Cold outreach',
    relationship: 'nurturing',
    tags: ['Local', 'Longtime owner'],
    notes:
      'Lost her husband last year — the building was their first joint investment. Slow play: no ask until she asks.',
    createdDaysAgo: 160,
    lastContactedDaysAgo: 8,
    lastTouch: 'Logged a call',
    openTaskCount: 1,
    deal: null,
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
    lastTouch: 'Logged a call',
    openTaskCount: 1,
    deal: { status: 'proposal', side: 'seller' },
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
function applyHeroes(contacts: Contact[], listings: Listing[]): void {
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
    if (!h.deal) return

    const target =
      listings.find((l) => l.status === h.deal!.status && !claimed.has(l.id)) ??
      listings.find((l) => !claimed.has(l.id))!
    claimed.add(target.id)
    forceListingStage(target, h.deal.status)

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

  const properties = Array.from({ length: PROPERTY_COUNT }, () => generateProperty())

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

  const dealIdRef = { n: 100 }
  const listings = properties.flatMap((p) =>
    generateListings(p, contactsByProperty.get(p.id) ?? contacts, dealIdRef),
  )

  // Overwrite five generated contacts with the hand-authored hero personas and
  // wire their deals — before reconciliation so derived fields follow.
  applyHeroes(contacts, listings)

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

  const comps = properties.flatMap((p) => {
    const count = faker.number.int({ min: 1, max: 5 })
    return Array.from({ length: count }, () => generateComp(p.id, p.buildingSqFt, p.propertyType))
  })

  return { properties, listings, comps, contacts: finalContacts }
}
