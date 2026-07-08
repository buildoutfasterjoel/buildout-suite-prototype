import type {
  Listing,
  Property,
  PropertyType,
  PropertySubtype,
  DealType,
  DealSide,
  DealBroker,
  DealDocument,
  DealTask,
} from './types'
import {
  addListing,
  addProperty,
  getProperty,
  getListingsForProperty,
  getContact,
  contactLabel,
} from './store'
import { TYPE_LABELS } from '#/components/properties/propertyDisplay'

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
  /** Context files attached in the create-deal flow. */
  documents: DealDocument[]
}

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
    status: 'proposal',

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
function seedProposalPlan(now: string): DealTask[] {
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

  return [
    auto('Underwriting', 'First-pass underwrite complete'),
    auto('Listing proposal', 'Generated automatically'),
    auto("Broker's Opinion of Value", 'Generated automatically'),
    todo('Upload executed listing agreement', 2, 'RP'),
    todo('Order professional photography', 3, 'MB'),
    todo('Order property signage', 5, 'RP'),
    todo('Publish listing to website', 7, 'MB'),
  ]
}

/** Draft documents Buildout generates alongside the starter plan. */
function seedProposalDocuments(now: string): DealDocument[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Offering-Memorandum.pdf',
      uploadedAt: now,
      size: '2.3 MB',
    },
    {
      id: crypto.randomUUID(),
      name: 'Rent-Roll-2026.xlsx',
      uploadedAt: now,
      size: '86 KB',
    },
  ]
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

  // Buildout auto-generates a starter plan + draft docs so the broker has
  // something to act on the instant the deal is created.
  const tasks = seedProposalPlan(now)
  const documents = [...seedProposalDocuments(now), ...draft.documents]
  const nextCriticalDate =
    tasks.find((t) => t.status !== 'complete' && t.date)?.date ?? null

  const listing: Listing = {
    id,
    propertyId: property.id,
    name,
    slug,
    status: 'proposal',
    dealType: draft.dealType,
    dealSide: draft.dealSide,

    availableSqFt: draft.availableSqFt,
    askingPrice: draft.listingPrice,
    leaseRate: null,
    capRate: 0,
    description: draft.description,
    locationDescription: draft.locationDescription,

    propertyType: property.propertyType,
    propertySubtype: property.propertySubtype,
    street: property.street,
    city: property.city,
    state: property.state,
    zip: property.zip,
    lat: property.lat,
    lng: property.lng,

    // Deal (1:1) — empty/zeroed for a brand-new proposal
    dealId,
    location: linked
      ? [property.city, property.state].filter(Boolean).join(', ')
      : addressLabel,
    propertyTypeLabel: TYPE_LABELS[property.propertyType],
    salePrice: draft.listingPrice,
    pricePerSqFt:
      draft.availableSqFt > 0
        ? Math.round((draft.listingPrice / draft.availableSqFt) * 100) / 100
        : 0,
    commissionPct: draft.commissionPct,
    commissionAmount,
    closeProbability: 0,
    internalBrokers: [currentUserBroker(commissionAmount)],
    outsideBrokers: [],
    sellerContactIds: seller ? [seller.id] : [],
    buyerContactIds: buyer ? [buyer.id] : [],
    otherContactIds: [],
    tasks,
    messages: [],
    activities: [],
    history: [
      {
        id: crypto.randomUUID(),
        label: 'Created under',
        fromStage: null,
        toStage: 'proposal',
        actor: 'You (Listing Broker)',
        timestamp: now,
      },
    ],
    documents,
    voucher: {
      name,
      identifier: dealId,
      status: 'Draft',
      closeDate: null,
      transactionValue: draft.listingPrice,
      grossCommission: commissionAmount,
      relatedContactsLabel: primaryContact ? contactLabel(primaryContact) : '—',
    },
    nextCriticalDate,

    createdAt: now,
    updatedAt: now,
  }

  addListing(listing)
  return listing
}
