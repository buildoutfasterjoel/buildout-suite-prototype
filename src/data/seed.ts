import { faker } from '@faker-js/faker'
import type {
  Property,
  Comp,
  Contact,
  PropertyType,
  PropertySubtype,
  BuildingClass,
  CompType,
  CompSource,
  ContactRole,
} from './types'

const SEED = 20240101
const PROPERTY_COUNT = 50
const CONTACT_COUNT = 80

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

  return {
    id,
    name: baseName,
    slug,
    status: faker.helpers.weightedArrayElement([
      { weight: 60, value: 'active' as const },
      { weight: 15, value: 'under-contract' as const },
      { weight: 10, value: 'sold' as const },
      { weight: 10, value: 'off-market' as const },
      { weight: 5, value: 'coming-soon' as const },
    ]),

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
    cashOnCashReturn: faker.number.float({ min: capRate * 0.7, max: capRate * 1.1, fractionDigits: 4 }),
    grossRentMultiplier: grm,
    parkingSpaces,

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

function generateContact(allPropertyIds: string[]): Contact {
  const role: ContactRole = faker.helpers.weightedArrayElement([
    { weight: 30, value: 'broker' as const },
    { weight: 25, value: 'owner' as const },
    { weight: 20, value: 'buyer' as const },
    { weight: 15, value: 'tenant' as const },
    { weight: 10, value: 'lender' as const },
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
  }
}

// ── Top-level export ──────────────────────────────────────────────────────────

export function generateDataset() {
  faker.seed(SEED)

  const properties = Array.from({ length: PROPERTY_COUNT }, () => generateProperty())

  const allPropertyIds = properties.map((p) => p.id)

  const comps = properties.flatMap((p) => {
    const count = faker.number.int({ min: 1, max: 5 })
    return Array.from({ length: count }, () => generateComp(p.id, p.buildingSqFt, p.propertyType))
  })

  const contacts = Array.from({ length: CONTACT_COUNT }, () => generateContact(allPropertyIds))

  return { properties, comps, contacts }
}
