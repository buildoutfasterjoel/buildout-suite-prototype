export type PropertyStatus = 'active' | 'under-contract' | 'sold' | 'off-market' | 'coming-soon'

export type PropertyType =
  | 'office'
  | 'retail'
  | 'industrial'
  | 'multifamily'
  | 'mixed-use'
  | 'land'
  | 'hospitality'
  | 'special-purpose'

export type PropertySubtype =
  | 'Low-Rise/Garden'
  | 'Mid-Rise'
  | 'High-Rise'
  | 'Townhouse'
  | 'Duplex'
  | 'Triplex'
  | 'Fourplex'
  | 'Single Tenant'
  | 'Multi-Tenant'
  | 'Medical'
  | 'Creative/Loft'
  | 'Strip Center'
  | 'Power Center'
  | 'Neighborhood Center'
  | 'Freestanding'
  | 'Storefront'
  | 'Warehouse'
  | 'Flex'
  | 'Distribution'
  | 'Manufacturing'
  | 'Cold Storage'
  | 'Vacant Land'
  | 'Hotel'
  | 'Motel'
  | 'Self-Storage'
  | 'Mixed-Use'

export type BuildingClass = 'A' | 'B' | 'C'
export type CompType = 'sale' | 'lease'
export type LeaseType = 'NNN' | 'Gross' | 'MG'
export type CompSource = 'CoStar' | 'LoopNet' | 'Public Records' | 'MLS' | 'Internal'
export type ContactRole = 'owner' | 'broker' | 'buyer' | 'tenant' | 'lender'

export interface Property {
  id: string
  name: string
  slug: string
  status: PropertyStatus

  // Property Information
  propertyType: PropertyType
  propertySubtype: PropertySubtype
  yearBuilt: number
  yearRenovated: number | null
  residentialUnits: number | null
  fullBathrooms: number | null
  partialBathrooms: number | null
  totalBathrooms: number | null
  buildingSqFt: number
  lotSqFt: number
  numberOfBuildings: number
  stories: number
  basementSqFt: number | null

  // Financial Information
  askingPrice: number
  lastPurchasePrice: number
  lastPurchaseDate: string
  assessedMarketValue: number
  numberOfOpenLiens: number
  amountOfOpenLiens: number

  // Building Features
  buildingClass: BuildingClass
  basementType: 'Full Basement' | 'Partial Basement' | 'Crawl Space' | 'Slab' | null
  exteriorWallType: string
  heatingType: string
  airConditioning: string
  buildingStyle: string

  // Location Information
  apn: string
  lat: number
  lng: number
  street: string
  city: string
  state: string
  zip: string
  county: string
  submarket: string
  zoning: string
  censusTract: string
  schoolDistrict: string | null
  legalDescription: string
  district: string
  useCode: string
  municipality: string

  // Tax Information
  assessedTaxValue: number
  landAssessedValue: number
  improvementAssessedValue: number
  assessedYear: number
  taxAmount: number
  taxYear: number

  // CRE Investment Metrics
  potentialGrossIncome: number
  vacancyRate: number
  effectiveGrossIncome: number
  operatingExpenses: number
  noi: number
  capRate: number
  cashOnCashReturn: number
  grossRentMultiplier: number
  parkingSpaces: number

  createdAt: string
  updatedAt: string
}

export interface Comp {
  id: string
  propertyId: string
  compType: CompType
  date: string
  closingDate: string
  salePrice: number | null
  pricePerSqFt: number | null
  capRateAtSale: number | null
  leaseRate: number | null
  leaseType: LeaseType | null
  leaseTerm: number | null
  sqFt: number
  daysOnMarket: number
  buyerOrTenantName: string
  sellerOrLandlordName: string
  source: CompSource
  notes: string
}

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  role: ContactRole
  propertyIds: string[]
}

export interface DataStore {
  properties: Map<string, Property>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
}

export interface ListPropertiesInput {
  status?: PropertyStatus
  propertyType?: PropertyType
  buildingClass?: BuildingClass
  city?: string
  state?: string
  submarket?: string
  county?: string
  minAskingPrice?: number
  maxAskingPrice?: number
  minCapRate?: number
  maxCapRate?: number
  minBuildingSqFt?: number
  maxBuildingSqFt?: number
}

export interface ListCompsInput {
  propertyId?: string
  compType?: CompType
  minDate?: string
  maxDate?: string
}

export interface ListContactsInput {
  role?: ContactRole
  propertyId?: string
}
