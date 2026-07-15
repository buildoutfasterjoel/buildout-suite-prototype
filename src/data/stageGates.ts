import type {
  DealMarketing,
  DealPitchFinancials,
  DealSide,
  DealTransaction,
  PropertyStatus,
} from './types'

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
  | 'websiteReviewed'
  | 'saleTitle'
  | 'saleDescription'
  | 'askingPrice'

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
  /** Broker attestation that the public listing website has been reviewed. */
  websiteReviewed: boolean
  /** Backward-out-of-Active only: also pull the listing off-market. Default true. */
  unpublishOnExit: boolean
  /** Contact chosen to link as buyer in this gate (Under Contract), if any. */
  buyerContactId: string | null
  /** Core listing content, editable inline in the publish gate. */
  saleTitle: string
  saleDescription: string
  askingPrice: number | null
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

export function resolveGate(from: PropertyStatus, target: PropertyStatus): GateConfig {
  const base = { fromStage: from, targetStage: target, leavesActive: from === 'active' }

  // Terminal: any stage → Lost.
  if (target === 'inactive') {
    return { ...base, kind: 'dead', title: 'Mark deal as Lost', required: ['deadReason', 'closeDate'], publishes: false }
  }

  const fi = LADDER.indexOf(from) // -1 when reopening from Lost
  const ti = LADDER.indexOf(target)
  const forward = fi === -1 || ti > fi

  if (!forward) {
    // Backward move — confirmation only.
    return { ...base, kind: 'confirm', title: `Move back to ${STAGE_LABEL[target]}`, required: [], publishes: false }
  }

  // Forward field gates, keyed by target stage.
  switch (target) {
    case 'active':
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
          'askingPrice',
          'aiDocsReviewed',
          'websiteReviewed',
          'listedOnDate',
          'listingExpirationDate',
        ],
        publishes: true,
      }
    case 'under-contract':
      return { ...base, kind: 'field', title: 'Move to Under Contract', required: ['buyerLinked', 'salePrice', 'commissionAmount'], publishes: false }
    case 'closed':
      return { ...base, kind: 'field', title: 'Move to Closed', required: ['closeDate'], publishes: false }
    case 'proposal':
    default:
      // Reopen from Lost into Pitching — no field requirements (behaves as a plain confirm).
      return { ...base, kind: 'field', title: `Reopen to ${STAGE_LABEL[target]}`, required: [], publishes: false }
  }
}

function fieldSatisfied(field: RequiredField, form: GateFormState): boolean {
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
    case 'websiteReviewed':
      return form.websiteReviewed
    case 'saleTitle':
      return form.saleTitle.trim().length > 0
    case 'saleDescription':
      return form.saleDescription.trim().length > 0
    case 'askingPrice':
      return form.askingPrice != null && form.askingPrice > 0
  }
}

export function canConfirm(config: GateConfig, form: GateFormState): boolean {
  if (config.kind === 'confirm') return true
  return config.required.every((f) => fieldSatisfied(f, form))
}

export function buildTransitionInput(
  config: GateConfig,
  form: GateFormState,
  dealId: string,
  actor: string,
): StageTransitionInput {
  const transaction: Partial<DealTransaction> = {}
  if (form.listedOnDate) transaction.listedOnDate = form.listedOnDate
  if (form.listingExpirationDate) transaction.listingExpirationDate = form.listingExpirationDate
  if (form.contractExecutedDate) transaction.contractExecutedDate = form.contractExecutedDate
  if (form.closeDate) transaction.closeDate = form.closeDate
  if (form.salePrice != null) transaction.salePrice = form.salePrice
  if (form.commissionAmount != null) transaction.commissionAmount = form.commissionAmount
  if (form.commissionPct != null) transaction.commissionPct = form.commissionPct
  if (form.deadReason) transaction.deadReason = form.deadReason

  const input: StageTransitionInput = {
    dealId,
    targetStage: config.targetStage,
    actor,
  }
  if (Object.keys(transaction).length > 0) input.transaction = transaction
  if (form.buyerContactId) input.buyerContactId = form.buyerContactId
  if (config.publishes) {
    input.publish = true
    // Persist any inline edits to the core listing content.
    const marketing: Partial<DealMarketing> = {}
    if (form.saleTitle) marketing.saleTitle = form.saleTitle
    if (form.saleDescription) marketing.saleDescription = form.saleDescription
    if (Object.keys(marketing).length > 0) input.marketing = marketing
    if (form.askingPrice != null) input.financials = { askingPrice: form.askingPrice }
  }
  if (config.leavesActive && form.unpublishOnExit) input.unpublish = true
  return input
}
