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
  | 'Industrial Outdoor Storage'
  | 'Mixed-Use'

export type BuildingClass = 'A+' | 'A' | 'B' | 'C'
export type CompType = 'sale' | 'lease'
export type LeaseType = 'NNN' | 'Gross' | 'MG'
export type CompSource = 'CoStar' | 'LoopNet' | 'Public Records' | 'MLS' | 'Internal'
export type ContactRole = 'owner' | 'broker' | 'buyer' | 'tenant' | 'lender'

/** A marketed offering — a deal is either a sale or a lease, never both. */
export type DealType = 'Sale' | 'Lease'

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

  // Occupancy + notes + child records (source of truth for the asset)
  occupancyPct: number
  notes: string
  units: PropertyUnit[]
  /** Dated in-place financial actuals, newest first; [0] mirrors the flat current fields above. */
  financialRecords: PropertyFinancialRecord[]

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

  createdAt: string
  updatedAt: string
}

export type UnitType = 'residential' | 'office' | 'retail' | 'industrial' | 'other'

/** A physical child shell of a Property (condo unit, pad, suite, apartment). Source of truth on the asset. */
export interface PropertyUnit {
  id: string
  /** Display label, e.g. "Unit 4B" or "Suite 200". */
  label: string
  unitType: UnitType
  sqft: number
  // Residential shell
  beds: number | null
  baths: number | null
  // Commercial shell
  suite: string | null
  floor: number | null
  /** Overrides the building-level ceiling height when set. */
  ceilingHeight: number | null
  offices: number | null
  conferenceRooms: number | null
  furnished: boolean
  /** Prior sale transactions on this unit, newest first — the asset's ownership history. */
  saleHistory: UnitSaleEvent[]
}

/** One prior sale of a unit — a transaction fact on the asset (surfaced by Sale-side deals). */
export interface UnitSaleEvent {
  id: string
  /** ISO date (YYYY-MM-DD) of the sale. */
  date: string
  price: number
  pricePerSf: number
  buyer: string
  seller: string
  capRateAtSale: number
}

export type FinancialRecordSource = 'T-12 actuals' | 'Assessor' | 'Owner-provided' | 'Broker estimate'

/** A dated snapshot of the asset's in-place operating performance. Newest record = current. */
export interface PropertyFinancialRecord {
  id: string
  /** ISO date (YYYY-MM-DD) the figures are as-of. */
  asOf: string
  source: FinancialRecordSource
  potentialGrossIncome: number
  vacancyRate: number
  effectiveGrossIncome: number
  operatingExpenses: number
  noi: number
  capRate: number
  grossRentMultiplier: number
  cashOnCashReturn: number
  occupancyPct: number
}

import type { UnderwritingStrategyId } from '#/components/deals/underwriting/strategies'

/**
 * A Listing is a marketable space/offering that belongs to a Property (a building
 * can have several — e.g. retail pads or office suites). It IS its deal (1:1), so it
 * also carries the deal's transaction, brokers, contacts, planner, and back-office
 * data. Display/property fields (location, type, physical facts) are not denormalized
 * here — they're resolved from the parent `Property` via `selectDealWithProperty`.
 */
export interface Listing {
  id: string
  propertyId: string
  name: string
  slug: string
  status: PropertyStatus // unified listing + deal stage
  /** ISO timestamp when the listing was published (went live), or null when not published. Diverges from `status` so a backward move can keep the listing live. */
  publishedAt: string | null
  dealType: DealType
  dealSide: DealSide // whether the broker represents the seller or the buyer
  /** The Property unit this deal is scoped to, or null when it covers the whole property. */
  unitId: string | null

  /** Parent umbrella deal id when this is a child space deal; null for top-level deals. */
  parentDealId: string | null

  // ── Deal data (1:1) ──────────────────────────────────────────────
  dealId: string

  internalBrokers: DealBroker[]
  outsideBrokers: DealBroker[]

  sellerContactIds: string[]
  buyerContactIds: string[]
  /** Tenant(s) entering the lease — dedicated dataset, distinct from buyerContactIds. */
  tenantContactIds: string[]
  otherContactIds: string[]

  tasks: DealTask[]
  messages: DealMessage[]
  activities: DealActivity[]
  history: DealHistoryEntry[]
  financials: DealPitchFinancials
  transaction: DealTransaction
  marketing: DealMarketing

  /** Context files attached when the deal was created (OMs, financials, notes). */
  documents?: DealDocument[]

  /** The underwriting scope chosen at deal creation — a heads-up of what's coming. */
  underwriting?: DealUnderwriting

  /** Broker-only notes on this engagement — never published. */
  internalNotes: string

  createdAt: string
  updatedAt: string
}

/** A file attached to a deal (e.g. uploaded in the create-deal flow). */
export interface DealDocument {
  id: string
  name: string
  uploadedAt: string
  /** Human-readable file size for display (e.g. "2.3 MB"). */
  size?: string
  /** True when Buildout auto-generated this document — the publish gate requires review of these. */
  aiGenerated?: boolean
}

/** The underwriting scope chosen for a deal — which strategy, its checks, and progress. */
export interface DealUnderwriting {
  /** Which underwriting strategy this deal uses. Drives the check list end to end. */
  strategy: UnderwritingStrategyId
  /** Display label for the depth badge / document subtitle — the strategy's label. */
  tier: string
  /** Indices into THIS strategy's checks list (see `checksFor`). Read with `strategy`. */
  selectedChecks: number[]
  /**
   * Where the underwriting is in the AI generation flow. Absent is treated
   * as 'not-started'. 'generating' is the auto-start signal the deal-overview
   * planner reads on mount (set when a deal is created with underwriting on).
   * 'generated' means the page is built but not yet filed — the planner shows a
   * "Choose document" action so the broker files it on their own schedule.
   */
  status?: 'not-started' | 'generating' | 'generated' | 'ready'
  /** Once generated, where the underwriting page was filed. */
  placement?: { documentId?: string; documentName: string }

  /** The stored, structured output — computed once at generation, read by the tab + document + future dynamic fields. */
  result?: UnderwritingResult
  /** ISO timestamp of the last generation. Stamped by the store/UI layer, never the pure builder. */
  generatedAt?: string
}

/** A single addressable metric — the unit a future dynamic field references. */
export interface UnderwritingMetric {
  key: string
  label: string
  value: number
  display: string
  format: 'money' | 'percent' | 'number' | 'ratio' | 'sqft' | 'text'
}

/** One row of a breakdown section. `emphasis` marks a total/summary row. */
export interface UnderwritingResultRow {
  cells: string[]
  emphasis?: boolean
}

/** A plain-data breakdown table. `keyValue` = label/value pairs (no header row); `matrix` = a header row + data rows. */
export interface UnderwritingResultSection {
  key: string
  name: string
  kind: 'keyValue' | 'matrix'
  columns?: string[]
  rows: UnderwritingResultRow[]
}

export interface UnderwritingResult {
  strategy: UnderwritingStrategyId
  metrics: UnderwritingMetric[]
  sections: UnderwritingResultSection[]
  inputs: { address: string; askingPrice: number; buildingSqFt: number; capRate: number }
}

/** A folder or file in a deal's internal Files workspace (the "lite Dropbox" page). */
export interface DealFileItem {
  id: string
  name: string
  kind: 'folder' | 'file'
  /** Parent folder id, or null for items at the root. */
  parentId: string | null
  createdAt: string
  /** Files only. */
  sizeBytes?: number
  /** Set when soft-deleted; powers the Recycle Bin. */
  deletedAt?: string | null
  /** Files only — the real Blob for files uploaded/dropped in this session, enabling a real download. Seed files have none. */
  blob?: File
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
  /** This broker's personal payout plan, e.g. "No Plan" — used on the Financials tab. */
  commissionPlan?: string
  /** This broker's personal split % of their own grossCommission — used on the Financials tab. */
  personalSplitPct?: number
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
  /** Optional sub-line under the label (e.g. "First-pass underwrite complete"). */
  detail?: string
  /** Auto-generated by the system — surfaces a "Review" affordance when complete. */
  autoGenerated?: boolean
}

/**
 * A standalone task created via the Add Task modal. Unlike the embedded planner
 * {@link DealTask} (which lives inside a deal's `tasks` array), a `Task` is a
 * first-class record in its own store slice and can stand alone or be linked to
 * a contact and/or deal via its `source`.
 */
export interface Task {
  id: string
  name: string
  /** Teammate id the task is assigned to (see teammates.ts). */
  assigneeId: string
  /** Two-letter avatar fallback for the assignee, resolved at create time. */
  assigneeInitials: string
  /** Due date as ISO `YYYY-MM-DD`, or null if unscheduled. */
  dueDate: string | null
  /** Task type key (call, email, meeting, …), or null if unset. */
  type: string | null
  /** What the task is attached to: 'contact' | 'deal' | 'listing' | 'property'. */
  source: string
  /** Linked contact id, when relevant. */
  contactId: string | null
  /** Linked deal/listing id, when relevant. */
  dealId: string | null
  notes: string
  /** Reminder dates as ISO `YYYY-MM-DD`. */
  reminders: string[]
  /** Optional follow-up date as ISO `YYYY-MM-DD`. */
  followUpDate: string | null
  requireAttachments: boolean
  status: DealTaskStatus
  /** ISO timestamp of creation. */
  createdAt: string
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

export interface DealFinancials {
  name: string
  identifier: string
  status: 'Approved' | 'Pending' | 'Draft'
  closeDate: string | null
  relatedContactsLabel: string
  preSplitDeductions: FinancialDeduction[]
  receivables: FinancialReceivable[]
}

/**
 * The transaction facts of a deal — the accepted parties (via the deal's contact-id
 * arrays), critical dates, the transacted price/commission, and the back-office
 * settlement records. Populated across Under Contract → Close.
 */
export interface DealTransaction {
  /** The transacted sale price (distinct from the pitch/asking price on `financials`). */
  salePrice: number
  pricePerSqFt: number
  commissionPct: number
  commissionAmount: number
  closeProbability: number
  contractExecutedDate: string | null
  closeDate: string | null
  listedOnDate: string | null
  listingExpirationDate: string | null
  /** Tenancy start date, captured entering Closed on a lease deal. */
  leaseCommencementDate: string | null
  deadReason: string | null
  nextCriticalDate: string | null
  /** Voucher / receivables / deductions — the Close-phase settlement records. */
  backOffice: DealFinancials
}

export interface IncomeLineItem { id: string; label: string; amount: number }
export interface ExpenseLineItem { id: string; label: string; amount: number }

/** A named, reorderable underwriting scenario (e.g. Worst Case / Best Case). */
export interface FinancialScenario {
  id: string
  name: string
  noi: number
  capRate: number
  cashFlow: number
}

/** One row of the deal's presented rent roll — a lease on a property unit. */
export interface RentRollRow {
  id: string
  /** References a `Property.units` shell, or null for an unassigned row. */
  unitId: string | null
  tenant: string
  actualRent: number
  marketRent: number
  rentPerSf: number | null
  securityDeposit: number
  leaseStart: string | null
  leaseEnd: string | null
  suite?: string
  type?: PropertyType | null
  beds?: number | null
  baths?: number | null
  /** Leasable area for the row — feeds the size/rate/annual auto-fill (PRD §19). */
  size?: number | null
  annualRent?: number | null
  rentEscalations?: { id: string; date: string | null; ratePerSf: number | null }[]
  comments?: string
  recoveryType?: string
}

/**
 * The broker's pro-forma pitch financials for this deal — the underwriting shown
 * in marketing. Snapshots the property's actuals and can move independently.
 */
export interface DealPitchFinancials {
  askingPrice: number
  askingPriceUnits: string
  hidePrice: boolean
  pricePerSqFt: number
  capRate: number
  income: IncomeLineItem[]
  grossScheduledIncome: number
  otherIncome: number
  totalScheduledIncome: number
  vacancyPct: number
  vacancyCost: number
  grossIncome: number
  expenses: ExpenseLineItem[]
  operatingExpenses: number
  noi: number
  loanAmount: number
  downPayment: number
  debtService: number
  cashFlow: number
  debtCoverageRatio: number
  grossRentMultiplier: number
  cashOnCash: number
  scenarios: FinancialScenario[]
  rentRoll: RentRollRow[]
}

export type PropertyUse = 'Net Leased Investment' | 'Investment' | 'Owner/User' | 'Business for Sale' | 'Development'
export type InvestmentType = 'Core' | 'Core Plus' | 'Value Add' | 'Opportunistic' | 'Distressed'
export type MarketingChannel = 'None' | 'Buildout Buyer Network' | 'My Brokerage Website' | 'Buildout Syndication Network'
export type VisibilityTier = 'Fully Private' | 'Private' | 'Semi-Public' | 'Fully Public'
export type LeaseRateUnits = 'SF/Yr' | 'SF/Mo' | 'Monthly'
export type SpaceLeaseType = 'Gross' | 'Modified Gross' | 'NNN' | 'Modified Net' | 'Full Service' | 'Ground Lease'

/**
 * Lease terms for one marketed space, keyed to a `Property.units` shell (reset per
 * engagement). A lease-side deal carries one record per unit it markets.
 */
export interface SpaceLeaseTerms {
  /** References the `Property.units` shell these terms apply to. */
  unitId: string
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  hideLeaseRate: boolean
  leaseType: SpaceLeaseType
  leaseTermMonths: number | null
  dateAvailable: string | null
  minDivisibleSqFt: number | null
  maxContiguousSqFt: number | null
  tiAllowance: number | null
  freeRentMonths: number | null
  signageAvailable: boolean
  rentEscalators: string | null
  sublease: boolean
  description: string | null
  // ── Expanded catalog fields ──────────────────────────────────────
  taxPerSf: number | null
  taxStops: string | null
  camPerSf: number | null
  camStops: string | null
  insurancePerSf: number | null
  expenseStops: string | null
  procurementFeePct: number | null
  tenantsPayGas: boolean
  tenantsPayElectric: boolean
  tenantsPayWater: boolean
  movingAllowance: number | null
  buyoutAllowance: number | null
  concession: string | null
  netLeaseInvestment: boolean
  // ── Listing-form additions ───────────────────────────────────────
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
}

/** Per-item public/private flags — Active publishes the flagged set (wired in Phase 3/4). */
export interface PublishFlags {
  title: boolean
  description: boolean
  bullets: boolean
  financials: boolean
  photos: boolean
}

/** The deal's marketing content — copy, terms, channel/visibility, publish flags. */
export interface DealMarketing {
  saleTitle: string
  saleDescription: string
  saleBullets: string[]
  saleClosingInfo: string
  leaseTitle: string
  leaseDescription: string
  leaseBullets: string[]
  /** Deal-level lease commission split %, or null when unset. */
  leaseCommissionSplitPct: number | null
  propertyUse: PropertyUse
  investmentType: InvestmentType
  includesRealEstate: boolean
  auction: boolean
  saleTerms: string
  reimbursement: string
  marketingChannel: MarketingChannel
  visibilityTier: VisibilityTier
  publishFlags: PublishFlags
  /** Snapshot of `Property.occupancyPct` taken at Active, or null before publish. */
  occupancySnapshot: number | null
  availableSqFt: number
  locationDescription: string
  /** Per-unit lease terms — one record per marketed `Property.units` shell. */
  spaceLeaseTerms: SpaceLeaseTerms[]

  // ── Listing-form additions ───────────────────────────────────────
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
}

/** A line item deducted from gross commission before broker splits, e.g. a marketing fee. */
export interface FinancialDeduction {
  id: string
  category: string
  description: string
  pct: number
  amount: number
  /** Amount already covered/reimbursed, or null when none. */
  covered: number | null
}

/** Money owed to the brokerage on a deal — shown on the Financials tab. */
export interface FinancialReceivable {
  id: string
  payerName: string
  payerEmail: string
  dueDate: string
  billingDescription: string
  amount: number
  credited: number
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
  | 'Manual entry'
  | 'Cold outreach'
  | 'Prospect by Buildout'
  | 'Referral'
  | 'Networking event'

/** Relationship lifecycle — "from cold to client." */
export type RelationshipStage =
  | 'cold'
  | 'nurturing'
  | 'pitching'
  | 'client'
  | 'past_client'

/** Which side of a deal the contact sits on (distinct from `role`). */
export type DealSide = 'buyer' | 'seller'

/** Stage of the deal a contact is currently engaged in. */
export type ContactDealStage =
  | 'pitching'
  | 'active'
  | 'under_contract'
  | 'closed'

/** Quality of the contact's phone number. */
export type PhoneStatus = 'valid' | 'invalid' | 'unknown'

/**
 * Hand-authored demo personas. A contact carrying a `heroKey` gets a fully
 * hand-written activity arc (see timelineHeroes.ts) instead of the
 * parameterized stage arc — one guaranteed-great contact per lifecycle stage.
 */
export type HeroKey = 'rosa' | 'earl' | 'victor' | 'margaret' | 'patricia'

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  /** Additional phone numbers beyond the primary `phone`, if any. */
  phones?: string[]
  /** Additional email addresses beyond the primary `email`, if any. */
  emails?: string[]
  company: string
  role: ContactRole
  propertyIds: string[]
  /**
   * Properties the contact owns outright, with or without a deal on them.
   * Shown in the contact page's "Properties Owned" panel even when no deal
   * links them (deal-linked properties surface there on their own).
   */
  ownedPropertyIds?: string[]
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
  /** ISO timestamp of the last real contact, or null if never contacted. */
  lastContactedAt: string | null
  /** Number of open tasks on this contact (0 = none). */
  openTaskCount: number
  street: string
  city: string
  state: string
  zip: string
  /** Firm-shared tags used to segment People. */
  tags: string[]
  /** Freeform notes captured when the contact was created (optional). */
  notes?: string
  /** Set on the hand-authored demo personas — selects their hero arc. */
  heroKey?: HeroKey
}

/**
 * The four core entity maps, as returned by `getStore()`. This is the subset of
 * the live `DataSlice` (`src/data/dataStore.ts`) that read-side helpers need —
 * `dealFiles`/`emails`/`callLists` are accessed through their own helpers.
 */
export interface EntityMaps {
  properties: Map<string, Property>
  listings: Map<string, Listing>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
}

/** A linked deal, summarized for the contact detail page's Deals panel. */
export interface DealSummary {
  id: string
  /** The property this deal sits on — used to group deals by property. */
  propertyId: string
  name: string
  city: string
  state: string
  status: PropertyStatus
  dealType: DealType
  planTotal: number
  planDone: number
  leadName: string
}

/**
 * A single open task surfaced in the contact detail page's Tasks column. Tasks
 * are deal-level ({@link DealTask}), so each one is paired here with the deal it
 * belongs to (its "source") for display.
 */
export interface ContactTask {
  id: string
  label: string
  date: string | null
  status: DealTaskStatus
  assigneeInitials: string
  /** Assignee display name (for the avatar tooltip/alt). */
  assigneeName?: string
  /** Assignee profile photo; falls back to initials when absent. */
  assigneeAvatarUrl?: string
  /** Show the assignee avatar — only when the contact is shared with others. */
  showAssignee?: boolean
  autoGenerated: boolean
  /**
   * The deal this task belongs to — shown as the task's source chip. Absent for
   * standalone {@link Task}s that aren't linked to a deal.
   */
  dealId?: string
  dealName?: string
  /** True for standalone {@link Task}s (editable/deletable via the Edit Task modal). */
  editable?: boolean
  /** Explicit task type key (from a standalone {@link Task}); deal tasks infer it from the label. */
  type?: string | null
}

/**
 * A unified task row for the standalone Tasks page — the union of standalone
 * {@link Task}s and deal-embedded {@link DealTask}s, normalized for display,
 * filtering, and grouping.
 */
export interface TaskView {
  id: string
  /** Where the underlying record lives (routes edits + completion toggles). */
  kind: 'standalone' | 'deal'
  /** The deal a deal-task belongs to (also the source for its badge). */
  dealId?: string
  title: string
  /** Scoped type key (call/email/meeting/to-do/follow-up/showing) or null. */
  type: string | null
  assigneeId: string
  assigneeName: string
  assigneeInitials: string
  assigneeAvatarUrl?: string
  /** Due date as ISO `YYYY-MM-DD`, or null. */
  dueDate: string | null
  completed: boolean
  autoGenerated: boolean
  /** What the task hangs off — drives the source badge and the Source filter. */
  sourceKind: 'deal' | 'contact' | 'none'
  sourceLabel: string
  /** Linked contact id (when sourceKind is 'contact'), for navigation. */
  contactId?: string
}

/** Everything the contact detail page needs, assembled server-side. */
export interface ContactDetail {
  contact: Contact
  deals: DealSummary[]
  openTaskCount: number
  /** The contact's open/overdue tasks, aggregated across their deals. */
  tasks: ContactTask[]
  /** The contact's already-completed tasks, aggregated across their deals. */
  completedTasks: ContactTask[]
}

/** Everything the property record page needs, assembled client-side from the live store. */
export interface PropertyDetail {
  property: Property
  deals: Listing[]
  owners: Contact[]
  contacts: Contact[]
  comps: Comp[]
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
