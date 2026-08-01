import type {
  DealMarketing,
  DealPitchFinancials,
  DealSide,
  DealTransaction,
  DealType,
  IngestionFieldKey,
  LeaseRateUnits,
  Listing,
  PropertyStatus,
} from './types'
import type { DealShape } from './dealShape'

export type GateKind = 'field' | 'confirm' | 'dead'

export type RequiredField =
  | 'buyerLinked'
  | 'listedOnDate'
  | 'listingExpirationDate'
  | 'closeDate'
  | 'salePrice'
  | 'commissionAmount'
  | 'deadReason'
  | 'aiDocsReviewed'
  | 'saleTitle'
  | 'saleDescription'
  | 'askingPrice'
  | 'tenantLinked'
  | 'leaseRate'
  | 'availableSqFt'
  | 'leaseTermMonths'
  | 'leaseCommencementDate'
  | 'shellActive'

/** The editable state the StageGate modal collects. Fields not relevant to a gate are ignored. */
export interface GateFormState {
  buyerLinked: boolean
  listedOnDate: string | null
  listingExpirationDate: string | null
  contractExecutedDate: string | null
  closeDate: string | null
  salePrice: number | null
  commissionAmount: number | null
  commissionPct: number | null
  deadReason: string | null
  /** True when every AI-generated doc is checked (or there are none). */
  aiDocsAllReviewed: boolean
  /** Backward-out-of-Active only: also pull the listing off-market. Default true. */
  unpublishOnExit: boolean
  /** Contact chosen to link as buyer in this gate (Under Contract), if any. */
  buyerContactId: string | null
  /** Core listing content, editable inline in the publish gate. */
  saleTitle: string
  saleDescription: string
  askingPrice: number | null
  /** Under Contract (lease): tenant linked. */
  tenantLinked: boolean
  tenantContactId: string | null
  /** Approve & Publish (lease): rate + units + available SF, seeded from spaceLeaseTerms[0]. */
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  availableSqFt: number | null
  /** Under Contract (lease): lease term in months. */
  leaseTermMonths: number | null
  /** Closed (lease): tenancy start. */
  leaseCommencementDate: string | null
  /** Approve & Publish (space deal): the building's marketing is live. */
  shellActive: boolean
}

export interface GateConfig {
  kind: GateKind
  fromStage: PropertyStatus
  targetStage: PropertyStatus
  title: string
  required: RequiredField[]
  /** Whether the transition leaves the Active stage (drives the unpublish option). */
  leavesActive: boolean
  /** True for a forward move into Active (drives the publish side-effect + toast). */
  publishes: boolean
}

/** Input consumed by the `commitStageTransition` action (Task 3). */
export interface StageTransitionInput {
  dealId: string
  targetStage: PropertyStatus
  actor: string
  transaction?: Partial<DealTransaction>
  marketing?: Partial<DealMarketing>
  financials?: Partial<DealPitchFinancials>
  dealSide?: DealSide
  sellerContactId?: string
  buyerContactId?: string
  /** Set publishedAt to now (Pitching → Active). */
  publish?: boolean
  /** Clear publishedAt (backward out of Active with unpublish selected). */
  unpublish?: boolean
  tenantContactId?: string
  leaseRate?: number | null
  leaseRateUnits?: LeaseRateUnits
  availableSqFt?: number | null
  leaseTermMonths?: number | null
}

/** Forward ladder; `inactive` (Lost) is intentionally off-ladder. */
const LADDER: PropertyStatus[] = ['proposal', 'active', 'under-contract', 'closed']

export const STAGE_LABEL: Record<PropertyStatus, string> = {
  proposal: 'Pitching',
  active: 'Active',
  'under-contract': 'Under Contract',
  closed: 'Closed',
  inactive: 'Lost',
}

/** Short human labels for each required field — used by the setup-incomplete indicator. */
export const REQUIRED_FIELD_LABEL: Record<RequiredField, string> = {
  buyerLinked: 'Buyer',
  listedOnDate: 'Listing start date',
  listingExpirationDate: 'Listing expiration date',
  closeDate: 'Close date',
  salePrice: 'Sale price',
  commissionAmount: 'Commission',
  deadReason: 'Lost reason',
  aiDocsReviewed: 'Document review',
  saleTitle: 'Listing title',
  saleDescription: 'Listing description',
  askingPrice: 'Asking price',
  tenantLinked: 'Tenant',
  leaseRate: 'Lease rate',
  availableSqFt: 'Available SF',
  leaseTermMonths: 'Lease term',
  leaseCommencementDate: 'Commencement date',
  shellActive: 'Building marketing published',
}

/** A blank working form — fields not relevant to a given gate are ignored. */
export const EMPTY_GATE_FORM: GateFormState = {
  buyerLinked: false,
  listedOnDate: null,
  listingExpirationDate: null,
  contractExecutedDate: null,
  closeDate: null,
  salePrice: null,
  commissionAmount: null,
  commissionPct: null,
  deadReason: null,
  aiDocsAllReviewed: true,
  unpublishOnExit: true,
  buyerContactId: null,
  saleTitle: '',
  saleDescription: '',
  askingPrice: null,
  tenantLinked: false,
  tenantContactId: null,
  leaseRate: null,
  leaseRateUnits: 'SF/Yr',
  availableSqFt: null,
  leaseTermMonths: null,
  leaseCommencementDate: null,
  shellActive: false,
}

/**
 * Seed a working gate form from a deal — the shared starting point for both the
 * StageGate modal and the publish-readiness check. Review attestations start
 * unsatisfied when there are AI docs to review / a website to check.
 */
/**
 * The signed listing agreement on the deal, if one has been received (e.g.
 * Rosa's story beat files "… Listing Agreement — Signed.pdf" onto the deal).
 * Its presence lets the publish gate AI-prefill the listing dates.
 */
export function signedListingAgreementDoc(deal: Listing) {
  return (deal.documents ?? []).find(
    (d) => /listing agreement/i.test(d.name) && /signed/i.test(d.name),
  )
}

/** Local `YYYY-MM-DD` (no timezone drift), matching stored date convention. */
function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** True when the deal has a document-ingestion conflict on `fieldKey` the broker hasn't settled. */
function hasUnresolvedConflict(deal: Listing, fieldKey: IngestionFieldKey): boolean {
  return (deal.ingestion?.conflicts ?? []).some(
    (c) => c.fieldKey === fieldKey && !c.resolution,
  )
}

export function seedGateForm(deal: Listing, ctx?: { shellActive?: boolean }): GateFormState {
  const aiDocs = (deal.documents ?? []).filter((d) => d.aiGenerated)
  const isLease = deal.dealType === 'Lease'
  const space = deal.marketing.spaceLeaseTerms[0]

  // When a signed listing agreement is on file and no listing dates are stored
  // yet, the AI reads them off the document: executed today, a standard
  // six-month term. The gate labels these as AI-extracted for review.
  const agreement = signedListingAgreementDoc(deal)
  const now = new Date()
  const aiListedOn = agreement ? localISO(now) : null
  const aiExpires = agreement
    ? localISO(new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()))
    : null

  return {
    ...EMPTY_GATE_FORM,
    buyerLinked: deal.buyerContactIds.length > 0,
    // Preselect a buyer already linked to the deal (Under Contract gate).
    buyerContactId: deal.buyerContactIds[0] ?? null,
    tenantLinked: deal.tenantContactIds.length > 0,
    tenantContactId: deal.tenantContactIds[0] ?? null,
    listedOnDate: deal.transaction.listedOnDate ?? aiListedOn,
    listingExpirationDate: deal.transaction.listingExpirationDate ?? aiExpires,
    contractExecutedDate: deal.transaction.contractExecutedDate,
    closeDate: deal.transaction.closeDate,
    salePrice: deal.transaction.salePrice || null,
    commissionAmount: deal.transaction.commissionAmount || null,
    commissionPct: deal.transaction.commissionPct || null,
    deadReason: deal.transaction.deadReason,
    // Title/description: lease deals read the lease copy, sale deals the sale copy.
    saleTitle: isLease ? deal.marketing.leaseTitle : deal.marketing.saleTitle,
    saleDescription: isLease ? deal.marketing.leaseDescription : deal.marketing.saleDescription,
    // An unresolved document conflict on the asking price reads as unmet, even
    // though the field holds the on-record figure. The stored value is what the
    // broker would be KEEPING, not a number they've confirmed — so the deal
    // can't publish until they take the document's figure or keep this one.
    askingPrice: hasUnresolvedConflict(deal, 'askingPrice')
      ? null
      : deal.financials.askingPrice || null,
    leaseRate: space?.leaseRate ?? null,
    leaseRateUnits: space?.leaseRateUnits ?? 'SF/Yr',
    availableSqFt: deal.marketing.availableSqFt || null,
    leaseTermMonths: space?.leaseTermMonths ?? null,
    leaseCommencementDate: deal.transaction.leaseCommencementDate,
    aiDocsAllReviewed: aiDocs.length === 0,
    shellActive: ctx?.shellActive ?? false,
  }
}

/**
 * Which Approve & Publish requirements a deal has not yet satisfied. Used to warn
 * on deals created directly in a live stage (Active/Under Contract) without
 * having gone through the publish gate.
 */
export function publishReadiness(
  deal: Listing,
  ctx?: { shape?: DealShape; shellActive?: boolean },
): { ready: boolean; missing: RequiredField[] } {
  const config = resolveGate('proposal', 'active', deal.dealType, ctx?.shape)
  const form = seedGateForm(deal, { shellActive: ctx?.shellActive })
  const missing = config.required.filter((f) => !fieldSatisfied(f, form))
  return { ready: missing.length === 0, missing }
}

export function resolveGate(
  from: PropertyStatus,
  target: PropertyStatus,
  dealType: DealType,
  shape: DealShape = dealType === 'Lease' ? 'flat-lease' : 'sale',
): GateConfig {
  const isLease = dealType === 'Lease'
  const fi = LADDER.indexOf(from) // -1 when reopening from Lost
  const ti = LADDER.indexOf(target) // -1 for Lost, which isn't on the ladder
  const forward = fi === -1 || ti > fi

  // `leavesActive` drives the "also unpublish this listing" option, which clears
  // publishedAt. Only offer it when the deal is genuinely coming off market:
  // moving backward out of Active, or to Lost. Forward progress out of Active
  // (→ Under Contract) must NOT unpublish — publishedAt doubles as the marker
  // that the deal cleared Approve & Publish, and clearing it makes an advanced
  // deal look unconfigured (see the Setup incomplete banner in overview.tsx).
  const base = {
    fromStage: from,
    targetStage: target,
    leavesActive: from === 'active' && !forward,
  }

  // Terminal: any stage → Lost.
  if (target === 'inactive') {
    return { ...base, kind: 'dead', title: 'Mark deal as Lost', required: ['deadReason', 'closeDate'], publishes: false }
  }

  if (!forward) {
    // Backward move — confirmation only.
    return { ...base, kind: 'confirm', title: `Move back to ${STAGE_LABEL[target]}`, required: [], publishes: false }
  }

  // Forward field gates, keyed by target stage.
  switch (target) {
    case 'active':
      // A space deal's publish gate is the moment the suite enters the building's
      // marketing. It gates on the space's own numbers only — title, description,
      // doc review, and the listing-agreement dates are property-level and belong
      // to the shell, which must itself already be live.
      if (shape === 'space') {
        return {
          ...base,
          kind: 'field',
          title: 'Publish space to the building listing',
          required: ['leaseRate', 'availableSqFt', 'leaseTermMonths', 'shellActive'],
          publishes: true,
        }
      }
      return {
        ...base,
        kind: 'field',
        title: 'Approve & Publish',
        // Seller and Side are already captured at deal creation — the publish
        // gate shows them read-only. It gates on the core listing content
        // (editable inline so the broker never has to leave the modal), the
        // review attestations, and the listing-agreement dates.
        required: [
          'saleTitle',
          'saleDescription',
          // Sale gates on asking price; lease gates on rate + available SF.
          ...(isLease
            ? (['leaseRate', 'availableSqFt'] as const)
            : (['askingPrice'] as const)),
          'aiDocsReviewed',
          'listedOnDate',
          'listingExpirationDate',
        ],
        publishes: true,
      }
    case 'under-contract':
      return {
        ...base,
        kind: 'field',
        title: 'Move to Under Contract',
        required: isLease
          ? ['tenantLinked', 'leaseTermMonths', 'commissionAmount']
          : ['buyerLinked', 'salePrice', 'commissionAmount'],
        publishes: false,
      }
    case 'closed':
      return {
        ...base,
        kind: 'field',
        title: 'Move to Closed',
        required: isLease ? ['leaseCommencementDate'] : ['closeDate'],
        publishes: false,
      }
    case 'proposal':
    default:
      // Reopen from Lost into Pitching — no field requirements (behaves as a plain confirm).
      return { ...base, kind: 'field', title: `Reopen to ${STAGE_LABEL[target]}`, required: [], publishes: false }
  }
}

/**
 * The Approve & Publish gate for a deal created directly in a live stage: same
 * required fields as the publish gate, but pinned to the deal's current stage so
 * it publishes in place without changing the stage.
 */
export function completeSetupGate(
  deal: Listing,
  shape: DealShape = deal.dealType === 'Lease' ? 'flat-lease' : 'sale',
): GateConfig {
  const publishGate = resolveGate('proposal', 'active', deal.dealType, shape)
  return {
    ...publishGate,
    fromStage: deal.status,
    targetStage: deal.status,
    leavesActive: false,
  }
}

export function fieldSatisfied(field: RequiredField, form: GateFormState): boolean {
  switch (field) {
    case 'buyerLinked':
      return form.buyerLinked
    case 'listedOnDate':
      return !!form.listedOnDate
    case 'listingExpirationDate':
      return !!form.listingExpirationDate
    case 'closeDate':
      return !!form.closeDate
    case 'salePrice':
      return form.salePrice != null && form.salePrice > 0
    case 'commissionAmount':
      return form.commissionAmount != null && form.commissionAmount > 0
    case 'deadReason':
      return !!form.deadReason && form.deadReason.trim().length > 0
    case 'aiDocsReviewed':
      return form.aiDocsAllReviewed
    case 'saleTitle':
      return form.saleTitle.trim().length > 0
    case 'saleDescription':
      return form.saleDescription.trim().length > 0
    case 'askingPrice':
      return form.askingPrice != null && form.askingPrice > 0
    case 'tenantLinked':
      return form.tenantLinked
    case 'leaseRate':
      return form.leaseRate != null && form.leaseRate > 0
    case 'availableSqFt':
      return form.availableSqFt != null && form.availableSqFt > 0
    case 'leaseTermMonths':
      return form.leaseTermMonths != null && form.leaseTermMonths > 0
    case 'leaseCommencementDate':
      return !!form.leaseCommencementDate
    case 'shellActive':
      return form.shellActive
  }
}

export function canConfirm(config: GateConfig, form: GateFormState): boolean {
  if (config.kind === 'confirm') return true
  return config.required.every((f) => fieldSatisfied(f, form))
}

/** The required fields a form has NOT yet satisfied — the gaps the gate must surface. */
export function unsatisfiedRequired(
  config: GateConfig,
  form: GateFormState,
): RequiredField[] {
  return config.required.filter((f) => !fieldSatisfied(f, form))
}

export function buildTransitionInput(
  config: GateConfig,
  form: GateFormState,
  dealId: string,
  actor: string,
  dealType: DealType,
): StageTransitionInput {
  const isLease = dealType === 'Lease'
  const transaction: Partial<DealTransaction> = {}
  if (form.listedOnDate) transaction.listedOnDate = form.listedOnDate
  if (form.listingExpirationDate) transaction.listingExpirationDate = form.listingExpirationDate
  if (form.contractExecutedDate) transaction.contractExecutedDate = form.contractExecutedDate
  if (form.closeDate) transaction.closeDate = form.closeDate
  if (form.salePrice != null) transaction.salePrice = form.salePrice
  if (form.commissionAmount != null) transaction.commissionAmount = form.commissionAmount
  if (form.commissionPct != null) transaction.commissionPct = form.commissionPct
  if (form.deadReason) transaction.deadReason = form.deadReason
  if (form.leaseCommencementDate) transaction.leaseCommencementDate = form.leaseCommencementDate

  const input: StageTransitionInput = { dealId, targetStage: config.targetStage, actor }
  if (Object.keys(transaction).length > 0) input.transaction = transaction
  if (form.buyerContactId) input.buyerContactId = form.buyerContactId
  if (form.tenantContactId) input.tenantContactId = form.tenantContactId
  if (form.leaseTermMonths != null) input.leaseTermMonths = form.leaseTermMonths

  if (config.publishes) {
    input.publish = true
    // Persist any inline edits to the core listing content.
    const marketing: Partial<DealMarketing> = {}
    // Route title/description to the right marketing copy for the deal type.
    if (form.saleTitle) {
      if (isLease) marketing.leaseTitle = form.saleTitle
      else marketing.saleTitle = form.saleTitle
    }
    if (form.saleDescription) {
      if (isLease) marketing.leaseDescription = form.saleDescription
      else marketing.saleDescription = form.saleDescription
    }
    if (Object.keys(marketing).length > 0) input.marketing = marketing
    if (isLease) {
      if (form.leaseRate != null) input.leaseRate = form.leaseRate
      input.leaseRateUnits = form.leaseRateUnits
      if (form.availableSqFt != null) input.availableSqFt = form.availableSqFt
    } else if (form.askingPrice != null) {
      input.financials = { askingPrice: form.askingPrice }
    }
  }
  if (config.leavesActive && form.unpublishOnExit) input.unpublish = true
  return input
}
