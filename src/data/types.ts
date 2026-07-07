/**
 * Unified listing + deal lifecycle. Since a listing IS its deal (1:1), one stage
 * drives both the listing status and the deal stage.
 */
export type PropertyStatus =
  | 'proposal'
  | 'active'
  | 'under-contract'
  | 'closed'
  | 'inactive'

/** Alias for readers that think in deal terms — same unified lifecycle. */
export type ListingStage = PropertyStatus

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

/** A marketed offering — sale, lease, or both. */
export type DealType = 'Sale' | 'Lease' | 'Sale / Lease'

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

/**
 * A Listing is a marketable space/offering that belongs to a Property (a building
 * can have several — e.g. retail pads or office suites). It IS its deal (1:1), so it
 * also carries the deal's transaction, brokers, contacts, planner, and back-office
 * data. Display fields (location, type) are denormalized from the parent Property so
 * listing views render without a join; building/tax/physical facts live on `Property`.
 */
export interface Listing {
  id: string
  propertyId: string
  name: string
  slug: string
  status: PropertyStatus // unified listing + deal stage
  dealType: DealType
  dealSide: DealSide // whether the broker represents the seller or the buyer

  // Offering-specific
  availableSqFt: number
  askingPrice: number
  leaseRate: number | null
  capRate: number

  // Listing marketing copy (optional — surfaced in the New Listing flow)
  description?: string
  locationDescription?: string

  // Denormalized from parent Property for display
  propertyType: PropertyType
  propertySubtype: PropertySubtype
  street: string
  city: string
  state: string
  zip: string
  lat: number
  lng: number

  // ── Deal data (1:1) ──────────────────────────────────────────────
  dealId: string
  location: string
  propertyTypeLabel: string

  // Transaction
  salePrice: number
  pricePerSqFt: number
  commissionPct: number
  commissionAmount: number
  closeProbability: number

  internalBrokers: DealBroker[]
  outsideBrokers: DealBroker[]

  sellerContactIds: string[]
  buyerContactIds: string[]
  otherContactIds: string[]

  tasks: DealTask[]
  messages: DealMessage[]
  activities: DealActivity[]
  history: DealHistoryEntry[]
  voucher: DealVoucher

  nextCriticalDate: string | null

  createdAt: string
  updatedAt: string
}

/** A broker on a deal, internal (own brokerage) or an outside co-broker. */
export interface DealBroker {
  id: string
  name: string
  role: string
  email: string
  side: 'internal' | 'outside'
  commissionSplitPct: number
  grossCommission: number
}

export type DealTaskStatus = 'open' | 'complete' | 'overdue'

/** A planner task — either a fixed date or a relative due ("5 days after Listing Executed"). */
export interface DealTask {
  id: string
  label: string
  date: string | null
  relativeDue: string | null
  assigneeInitials: string
  status: DealTaskStatus
  hasAttachment: boolean
}

export interface DealMessage {
  id: string
  author: string
  text: string
  timestamp: string
}

export interface DealActivity {
  id: string
  type: string
  note: string
  actor: string
  timestamp: string
}

export interface DealHistoryEntry {
  id: string
  label: string
  fromStage: ListingStage | null
  toStage: ListingStage | null
  actor: string
  timestamp: string
}

export interface DealVoucher {
  name: string
  identifier: string
  status: 'Approved' | 'Pending' | 'Draft'
  closeDate: string | null
  transactionValue: number
  grossCommission: number
  relatedContactsLabel: string
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

/** Where a contact entered the book of business. */
export type ContactSource =
  | 'Public records'
  | 'Cold outreach'
  | 'Prospect by Buildout'
  | 'Referral'
  | 'Networking event'

/** Relationship lifecycle — "from cold to client." */
export type RelationshipStage =
  | 'cold'
  | 'nurturing'
  | 'active'
  | 'pitching'
  | 'client'
  | 'past_client'

/** Which side of a deal the contact sits on (distinct from `role`). */
export type DealSide = 'buyer' | 'seller'

/** Stage of the deal a contact is currently engaged in. */
export type ContactDealStage =
  | 'active_search'
  | 'active_listing'
  | 'pitching'
  | 'under_contract'
  | 'closed'
  | 'lost'

/** Quality of the contact's phone number. */
export type PhoneStatus = 'valid' | 'invalid' | 'unknown'

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  role: ContactRole
  propertyIds: string[]
  /** Team member who owns this relationship, e.g. "J. Whitfield". */
  assignedTo: string
  source: ContactSource
  relationship: RelationshipStage
  /** Deal side, or null when the contact isn't on an active deal. */
  side: DealSide | null
  /** Current deal stage, or null when not engaged in a deal. */
  dealStage: ContactDealStage | null
  /** Count of open inquiries from this contact. */
  inquiries: number
  phoneStatus: PhoneStatus
  doNotCall: boolean
  /** Job title / position, e.g. "Managing Member". */
  title: string
  /** ISO timestamp the contact was added to the book of business. */
  createdAt: string
  /** Human label for the most recent touch, e.g. "Enriched from public records". */
  lastTouch: string
  street: string
  city: string
  state: string
  zip: string
  /** Firm-shared tags used to segment People. */
  tags: string[]
}

export interface DataStore {
  properties: Map<string, Property>
  listings: Map<string, Listing>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
}

/** A linked deal, summarized for the contact detail page's Deals panel. */
export interface DealSummary {
  id: string
  name: string
  city: string
  state: string
  status: PropertyStatus
  dealType: DealType
  planTotal: number
  planDone: number
  leadName: string
}

/** Everything the contact detail page needs, assembled server-side. */
export interface ContactDetail {
  contact: Contact
  deals: DealSummary[]
  openTaskCount: number
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
