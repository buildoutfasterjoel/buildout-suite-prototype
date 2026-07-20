import type {
  Listing,
  Property,
  PropertyType,
  PropertySubtype,
  PropertyStatus,
  DealType,
  DealSide,
  DealBroker,
  DealDocument,
  DealTask,
  DealUnderwriting,
  SpaceLeaseTerms,
} from './types'

/** A blank per-unit lease-terms record — used as a default for units without terms yet. */
export function emptySpaceLeaseTerms(unitId: string): SpaceLeaseTerms {
  return {
    unitId,
    leaseRate: null,
    leaseRateUnits: 'SF/Yr',
    hideLeaseRate: false,
    leaseType: 'NNN',
    leaseTermMonths: null,
    dateAvailable: null,
    minDivisibleSqFt: null,
    maxContiguousSqFt: null,
    tiAllowance: null,
    freeRentMonths: null,
    signageAvailable: false,
    rentEscalators: null,
    sublease: false,
    description: null,
    taxPerSf: null,
    taxStops: null,
    camPerSf: null,
    camStops: null,
    insurancePerSf: null,
    expenseStops: null,
    procurementFeePct: null,
    tenantsPayGas: false,
    tenantsPayElectric: false,
    tenantsPayWater: false,
    movingAllowance: null,
    buyoutAllowance: null,
    concession: null,
    netLeaseInvestment: false,
  }
}
import {
  addListing,
  addProperty,
  getProperty,
  getListingsForProperty,
  getContact,
  contactLabel,
} from './store'

/**
 * The editable subset of a listing the New Listing modal collects — just the
 * listing-level essentials. Property/building facts come from the linked CRM
 * property, not this flow; everything else on a proposal is defaulted/blank.
 */
export interface NewListingDraft {
  /** Defaults to the address when left blank. */
  name: string
  address: string
  /** Links to an existing CRM property when one is chosen/matched. */
  propertyId: string
  /**
   * Whether this listing markets the whole building or is a new space (suite/unit)
   * within the linked property. Only meaningful when `propertyId` is set — a
   * brand-new property is always a whole building.
   */
  attachAs: 'building' | 'space'
  /** Suite/unit/floor label for a space (e.g. "Suite 300", "Pad B"). */
  spaceLabel: string
  /**
   * When the deal is scoped to a single existing `Property.units` shell, its id.
   * Null/omitted for a whole-building deal. Only meaningful alongside `attachAs: 'space'`.
   */
  unitId?: string | null
  propertyType: PropertyType
  dealType: DealType
  listingPrice: number
  commissionPct: number
  availableSqFt: number
  description: string
  locationDescription: string
  /** Whether the broker represents the seller (sell-side) or the buyer (buy-side). */
  dealSide: DealSide
  /** The CRM contact who owns the property and is selling — empty until chosen. */
  sellerContactId: string
  /** The CRM contact the broker represents on a buy-side deal — empty until chosen. */
  buyerContactId: string
  /** Lifecycle stage to create the deal in. Defaults to `proposal` (Pitching). */
  initialStage: PropertyStatus
  /** Context files the broker uploaded in the create-deal flow. */
  documents: DealDocument[]
  /**
   * The documents chosen from the suggested catalog (each `aiGenerated`). When
   * omitted (non-modal callers/tests), the default suggested set is generated.
   */
  suggestedDocuments?: DealDocument[]
  /** The underwriting scope chosen at creation. */
  underwriting?: DealUnderwriting
}

/** A candidate document Buildout suggests when a deal is created. */
export interface SuggestedDocument {
  key: string
  name: string
  /** Grouping used to organize the catalog (e.g. "Financials", "Legal"). */
  category: string
  /** Pre-checked by default in the create-deal flow. */
  defaultOn: boolean
}

/**
 * The imagined "firm playbook" of documents Buildout suggests for a new deal.
 * A real company can have hundreds of preset templates; this stands in for that
 * catalog — a handful recommended by default, the rest searchable. In production
 * this would be driven by company defaults and similar past deals.
 */
export const SUGGESTED_DOCUMENTS: SuggestedDocument[] = [
  // Marketing collateral
  { key: 'om', name: 'Offering Memorandum', category: 'Marketing', defaultOn: true },
  { key: 'bov', name: "Broker's Opinion of Value", category: 'Marketing', defaultOn: true },
  { key: 'flyer', name: 'Property Flyer', category: 'Marketing', defaultOn: false },
  { key: 'teaser', name: 'Deal Teaser', category: 'Marketing', defaultOn: false },
  { key: 'email-blast', name: 'Email Blast Template', category: 'Marketing', defaultOn: false },
  { key: 'aerial', name: 'Aerial & Site Map', category: 'Marketing', defaultOn: false },
  { key: 'brochure', name: 'Investment Brochure', category: 'Marketing', defaultOn: false },

  // Financials
  { key: 'rent-roll', name: 'Rent Roll 2026', category: 'Financials', defaultOn: true },
  { key: 't12', name: 'T-12 Operating Statement', category: 'Financials', defaultOn: false },
  { key: 'proforma', name: 'Pro Forma Cash Flow', category: 'Financials', defaultOn: false },
  { key: 'noi', name: 'NOI Statement', category: 'Financials', defaultOn: false },
  { key: 'sensitivity', name: 'Sensitivity Analysis', category: 'Financials', defaultOn: false },
  { key: 'debt-summary', name: 'Debt Summary', category: 'Financials', defaultOn: false },
  { key: 'cap-ex', name: 'Capital Expenditure Budget', category: 'Financials', defaultOn: false },
  { key: 'tax-summary', name: 'Property Tax Summary', category: 'Financials', defaultOn: false },

  // Comparables & market
  { key: 'sales-comps', name: 'Sales Comparables', category: 'Market', defaultOn: false },
  { key: 'rent-comps', name: 'Rent Comparables', category: 'Market', defaultOn: false },
  { key: 'market-report', name: 'Submarket Report', category: 'Market', defaultOn: false },
  { key: 'demographics', name: 'Demographics Report', category: 'Market', defaultOn: false },
  { key: 'traffic', name: 'Traffic Count Study', category: 'Market', defaultOn: false },

  // Due diligence
  { key: 'phase-1', name: 'Environmental Phase I', category: 'Due Diligence', defaultOn: false },
  { key: 'pca', name: 'Property Condition Assessment', category: 'Due Diligence', defaultOn: false },
  { key: 'survey', name: 'ALTA Survey', category: 'Due Diligence', defaultOn: false },
  { key: 'zoning', name: 'Zoning Report', category: 'Due Diligence', defaultOn: false },
  { key: 'title', name: 'Title Commitment', category: 'Due Diligence', defaultOn: false },
  { key: 'appraisal', name: 'Appraisal Report', category: 'Due Diligence', defaultOn: false },

  // Legal
  { key: 'listing-agreement', name: 'Listing Agreement', category: 'Legal', defaultOn: false },
  { key: 'nda', name: 'Non-Disclosure Agreement', category: 'Legal', defaultOn: false },
  { key: 'loi', name: 'Letter of Intent', category: 'Legal', defaultOn: false },
  { key: 'psa', name: 'Purchase & Sale Agreement', category: 'Legal', defaultOn: false },
  { key: 'lease-abstract', name: 'Lease Abstract', category: 'Legal', defaultOn: false },
  { key: 'estoppel', name: 'Estoppel Certificate', category: 'Legal', defaultOn: false },
]

/** A sensible blank draft to seed the manual-entry form. */
export function emptyDraft(): NewListingDraft {
  return {
    name: '',
    address: '',
    propertyId: '',
    attachAs: 'building',
    spaceLabel: '',
    propertyType: 'office',
    dealType: 'Sale',
    listingPrice: 0,
    commissionPct: 0,
    availableSqFt: 0,
    description: '',
    locationDescription: '',
    dealSide: 'seller',
    sellerContactId: '',
    buyerContactId: '',
    initialStage: 'proposal',
    documents: [],
  }
}

/** Default subtype per property type for a stub property. */
const DEFAULT_SUBTYPE: Record<PropertyType, PropertySubtype> = {
  office: 'Multi-Tenant',
  retail: 'Storefront',
  industrial: 'Warehouse',
  multifamily: 'Mid-Rise',
  'mixed-use': 'Mixed-Use',
  land: 'Vacant Land',
  hospitality: 'Hotel',
  'special-purpose': 'Self-Storage',
}

/** The signed-in broker — a proposal is created under whoever starts it. */
function currentUserBroker(commissionAmount: number): DealBroker {
  return {
    id: crypto.randomUUID(),
    name: 'You (Listing Broker)',
    role: 'Primary Broker - Sell Side',
    email: 'me@buildout.com',
    side: 'internal',
    commissionSplitPct: 100,
    grossCommission: commissionAmount,
  }
}

/**
 * Build a stub Property from the draft. A listing denormalizes its location/type
 * for display, but deal sub-tabs (Transaction/Overview) read the parent Property
 * for building facts — so a new listing needs a matching property to point at.
 * In production this property would already exist in the broker's CRM.
 */
function buildStubProperty(draft: NewListingDraft, now: string): Property {
  const id = crypto.randomUUID()
  const slug = `${slugify(draft.name || draft.address || 'new-listing')}-${id.slice(0, 6)}`
  return {
    id,
    name: draft.name || draft.address,
    slug,
    status: draft.initialStage,

    propertyType: draft.propertyType,
    propertySubtype: DEFAULT_SUBTYPE[draft.propertyType],
    yearBuilt: 0,
    yearRenovated: null,
    residentialUnits: null,
    fullBathrooms: null,
    partialBathrooms: null,
    totalBathrooms: null,
    buildingSqFt: draft.availableSqFt,
    lotSqFt: 0,
    numberOfBuildings: 1,
    stories: 0,
    basementSqFt: null,

    askingPrice: draft.listingPrice,
    lastPurchasePrice: 0,
    lastPurchaseDate: '',
    assessedMarketValue: 0,
    numberOfOpenLiens: 0,
    amountOfOpenLiens: 0,

    buildingClass: 'B',
    basementType: null,
    exteriorWallType: 'N/A',
    heatingType: 'N/A',
    airConditioning: 'None',
    buildingStyle: 'N/A',

    apn: '',
    lat: 0,
    lng: 0,
    street: draft.address,
    city: '',
    state: '',
    zip: '',
    county: '',
    submarket: '',
    zoning: '',
    censusTract: '',
    schoolDistrict: null,
    legalDescription: '',
    district: '',
    useCode: '',
    municipality: '',

    assessedTaxValue: 0,
    landAssessedValue: 0,
    improvementAssessedValue: 0,
    assessedYear: 0,
    taxAmount: 0,
    taxYear: 0,

    potentialGrossIncome: 0,
    vacancyRate: 0,
    effectiveGrossIncome: 0,
    operatingExpenses: 0,
    noi: 0,
    capRate: 0,
    cashOnCashReturn: 0,
    grossRentMultiplier: 0,
    parkingSpaces: 0,

    occupancyPct: 0,
    notes: '',
    units: [
      {
        id: crypto.randomUUID(),
        label: 'Whole Property',
        unitType:
          draft.propertyType === 'multifamily'
            ? 'residential'
            : draft.propertyType === 'office' ||
                draft.propertyType === 'retail' ||
                draft.propertyType === 'industrial'
              ? draft.propertyType
              : 'other',
        sqft: Math.max(1, draft.availableSqFt),
        beds: null,
        baths: null,
        suite: null,
        floor: null,
        ceilingHeight: null,
        offices: null,
        conferenceRooms: null,
        furnished: false,
        saleHistory: [],
      },
    ],
    financialRecords: [
      {
        id: crypto.randomUUID(),
        asOf: now.slice(0, 10),
        source: 'Broker estimate',
        potentialGrossIncome: 0,
        vacancyRate: 0,
        effectiveGrossIncome: 0,
        operatingExpenses: 0,
        noi: 0,
        capRate: 0,
        grossRentMultiplier: 0,
        cashOnCashReturn: 0,
        occupancyPct: 0,
      },
    ],

    createdAt: now,
    updatedAt: now,
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'listing'
}

/** Short, human-ish deal id for a new proposal. */
function generateDealId(): string {
  return `D-${String(Math.floor(Date.now() % 100000)).padStart(5, '0')}`
}

/** `now` (ISO) shifted by `days`, as a `YYYY-MM-DD` string (matches seed convention). */
function shiftDate(now: string, days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The starter listing plan Buildout auto-generates the moment a deal is created:
 * the underwrite, proposal, and BOV come back done for the broker to review, and
 * the operational tasks that move the listing to market are queued up with dates.
 * This is what gives a brand-new proposal an immediate sense of momentum.
 */
function seedProposalPlan(
  now: string,
  opts: { underwritingTier?: string; includeBov: boolean },
): DealTask[] {
  const auto = (label: string, detail: string): DealTask => ({
    id: crypto.randomUUID(),
    label,
    date: shiftDate(now, 0),
    relativeDue: null,
    assigneeInitials: 'JW',
    status: 'complete',
    hasAttachment: false,
    detail,
    autoGenerated: true,
  })

  const todo = (
    label: string,
    days: number,
    assigneeInitials: string,
  ): DealTask => ({
    id: crypto.randomUUID(),
    label,
    date: shiftDate(now, days),
    relativeDue: `${days} day${days === 1 ? '' : 's'} after listing executed`,
    assigneeInitials,
    status: 'open',
    hasAttachment: false,
  })

  const underwriteDetail =
    opts.underwritingTier && opts.underwritingTier !== 'None'
      ? `${opts.underwritingTier} underwrite complete`
      : 'First-pass underwrite complete'

  return [
    auto('Underwriting', underwriteDetail),
    auto('Listing proposal', 'Generated automatically'),
    // The BOV auto-task only appears when the broker kept the BOV document.
    ...(opts.includeBov
      ? [auto("Broker's Opinion of Value", 'Generated automatically')]
      : []),
    todo('Upload executed listing agreement', 2, 'RP'),
    todo('Order professional photography', 3, 'MB'),
    todo('Order property signage', 5, 'RP'),
    todo('Publish listing to website', 7, 'MB'),
  ]
}

/** The default suggested documents — the catalog's `defaultOn` entries. */
function seedProposalDocuments(now: string): DealDocument[] {
  return SUGGESTED_DOCUMENTS.filter((d) => d.defaultOn).map((d) => ({
    id: crypto.randomUUID(),
    name: d.name,
    uploadedAt: now,
    aiGenerated: true,
  }))
}

/**
 * Create a new listing in proposal mode (plus its stub property) and insert both
 * into the in-memory store. Returns the created listing so callers can navigate
 * to it. Transaction/contact/task data starts empty — this is a fresh proposal.
 */
export function createProposalListing(draft: NewListingDraft): Listing {
  const now = new Date().toISOString()

  // Link to the chosen CRM property; only fabricate a stub if none was picked.
  const linked = draft.propertyId ? getProperty(draft.propertyId) : undefined
  const property = linked ?? buildStubProperty(draft, now)
  if (!linked) addProperty(property)

  const addressLabel = linked
    ? [property.street, property.city, property.state].filter(Boolean).join(', ')
    : draft.address

  const id = crypto.randomUUID()
  const dealId = generateDealId()

  // A space attaches to an existing property as a sibling listing; default its name
  // and slug off the parent so it reads like "123 Main St — Suite 300".
  const isSpace = Boolean(linked) && draft.attachAs === 'space'
  const spaceName =
    isSpace && draft.spaceLabel.trim()
      ? `${property.name} — ${draft.spaceLabel.trim()}`
      : ''
  const name =
    draft.name || spaceName || addressLabel || property.name || 'Untitled Listing'
  const slug = isSpace
    ? `${property.slug}-${getListingsForProperty(property.id).length + 1}`
    : `${property.slug}-1`

  const commissionAmount =
    draft.listingPrice > 0
      ? Math.round(draft.listingPrice * (draft.commissionPct / 100))
      : 0

  // Resolve the deal's primary contact and place them on the represented side.
  const seller =
    draft.dealSide === 'seller' && draft.sellerContactId
      ? getContact(draft.sellerContactId)
      : undefined
  const buyer =
    draft.dealSide === 'buyer' && draft.buyerContactId
      ? getContact(draft.buyerContactId)
      : undefined
  const primaryContact = seller ?? buyer

  // Buildout generates the docs the broker chose (falling back to the default
  // suggested set for non-modal callers) plus a starter plan, so there's
  // something to act on the instant the deal is created.
  const suggested = draft.suggestedDocuments ?? seedProposalDocuments(now)
  const documents = [...suggested, ...draft.documents]
  const includeBov = suggested.some((d) => /opinion.of.value/i.test(d.name))
  const tasks = seedProposalPlan(now, {
    underwritingTier: draft.underwriting?.tier,
    includeBov,
  })
  const nextCriticalDate =
    tasks.find((t) => t.status !== 'complete' && t.date)?.date ?? null

  const listing: Listing = {
    id,
    propertyId: property.id,
    name,
    slug,
    status: draft.initialStage,
    // A directly-created deal is never published — even when started past
    // Pitching, publishing happens only through the Approve & Publish gate.
    publishedAt: null,
    dealType: draft.dealType,
    dealSide: draft.dealSide,
    unitId: isSpace ? (draft.unitId ?? null) : null,
    parentDealId: null,

    // Deal (1:1) — empty/zeroed for a brand-new proposal
    dealId,
    internalBrokers: [currentUserBroker(commissionAmount)],
    outsideBrokers: [],
    sellerContactIds: seller ? [seller.id] : [],
    buyerContactIds: buyer ? [buyer.id] : [],
    tenantContactIds: [],
    otherContactIds: [],
    tasks,
    messages: [],
    activities: [],
    history: [
      {
        id: crypto.randomUUID(),
        label: 'Created under',
        fromStage: null,
        toStage: draft.initialStage,
        actor: 'You (Listing Broker)',
        timestamp: now,
      },
    ],
    documents,
    underwriting: draft.underwriting,
    financials: {
      askingPrice: draft.listingPrice,
      askingPriceUnits: 'total',
      hidePrice: false,
      pricePerSqFt:
        draft.availableSqFt > 0
          ? Math.round((draft.listingPrice / draft.availableSqFt) * 100) / 100
          : 0,
      capRate: 0,
      income: [],
      grossScheduledIncome: 0,
      otherIncome: 0,
      totalScheduledIncome: 0,
      vacancyPct: 0,
      vacancyCost: 0,
      grossIncome: 0,
      expenses: [],
      operatingExpenses: 0,
      noi: 0,
      loanAmount: 0,
      downPayment: 0,
      debtService: 0,
      cashFlow: 0,
      debtCoverageRatio: 0,
      grossRentMultiplier: 0,
      cashOnCash: 0,
      scenarios: [],
      rentRoll: [],
    },
    transaction: {
      salePrice: draft.listingPrice,
      pricePerSqFt:
        draft.availableSqFt > 0
          ? Math.round((draft.listingPrice / draft.availableSqFt) * 100) / 100
          : 0,
      commissionPct: draft.commissionPct,
      commissionAmount,
      closeProbability: 0,
      contractExecutedDate: null,
      closeDate: null,
      listedOnDate: null,
      listingExpirationDate: null,
      leaseCommencementDate: null,
      deadReason: null,
      nextCriticalDate,
      backOffice: {
        name,
        identifier: dealId,
        status: 'Draft',
        closeDate: null,
        relatedContactsLabel: primaryContact ? contactLabel(primaryContact) : '—',
        preSplitDeductions: [],
        receivables: [],
      },
    },
    marketing: {
      saleTitle: draft.name || name,
      saleDescription: draft.description,
      saleBullets: [],
      saleClosingInfo: '',
      leaseTitle: '',
      leaseDescription: '',
      leaseBullets: [],
      leaseCommissionSplitPct: null,
      propertyUse: 'Investment',
      investmentType: 'Core',
      includesRealEstate: true,
      auction: false,
      saleTerms: '',
      reimbursement: '',
      marketingChannel: 'None',
      visibilityTier: 'Fully Private',
      publishFlags: { title: false, description: false, bullets: false, financials: false, photos: false },
      occupancySnapshot: null,
      availableSqFt: draft.availableSqFt,
      locationDescription: draft.locationDescription,
      spaceLeaseTerms: [],
    },
    internalNotes: '',

    createdAt: now,
    updatedAt: now,
  }

  addListing(listing)
  return listing
}
