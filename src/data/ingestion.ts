import type {
  DealIngestion,
  IngestionConflict,
  IngestionFieldKey,
  Listing,
  Property,
} from './types'
import {
  buildPublishReadyPatch,
  draftSqFt,
  type PublishReadyPatch,
  pricePerSqFtFor,
} from './uploadIntelligence'

/** The three stages the banner walks through while a run is processing. */
export const INGESTION_STAGES = [
  { label: 'Scanning documents', detail: 'Reading the files you attached' },
  { label: 'Extracting details', detail: 'Price, size, income, and property facts' },
  { label: 'Filling deal fields', detail: 'Writing what we found to the deal' },
] as const

/** A fresh run: processing, nothing filled, no conflicts yet. */
export function startIngestionState(documents: string[]): DealIngestion {
  return {
    status: 'processing',
    documents,
    stage: 0,
    filledCount: 0,
    conflicts: [],
    startedAt: new Date().toISOString(),
  }
}

/** Bump to the next stage, clamped to the last. Pure. */
export function advanceStage(ing: DealIngestion): DealIngestion {
  const last = (INGESTION_STAGES.length - 1) as DealIngestion['stage']
  return { ...ing, stage: (ing.stage < last ? ing.stage + 1 : last) as DealIngestion['stage'] }
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const percent = (n: number) => `${Math.round(n)}%`

/**
 * The faked extraction: derive the two-sided conflicts a T-12 and rent roll
 * would plausibly raise.
 *
 * The framing is decided **per field**, on whether the record actually carries a
 * value for it — NOT on whether a property object exists. A deal created from a
 * typed-in address still gets a stub property (`createProposalListing`), and that
 * stub has a zeroed asking price and occupancy; crediting a fabricated figure to
 * the "Property record" would be a lie about data that isn't there. So:
 *
 * - record has a value → doc-vs-record, current side labelled "Property record"
 * - record is empty → doc-vs-doc (the rent roll disagreeing with the T-12), each
 *   side labelled with the document it came from
 *
 * Either way both sides always carry a value and the two differ, so whichever
 * the broker picks leaves the field populated.
 *
 * A Sale raises all three (asking price, NOI, occupancy). A **Lease** raises
 * occupancy only: the editor hides its Financials section on a Lease, so an
 * asking-price or NOI conflict would show a tab badge with no arbitration row
 * behind it — unresolvable, which would strand the run in `needs-review`
 * forever. Neither field is gate-required on a Lease, so they are dropped
 * rather than surfaced as a dead end.
 */
export function deriveConflicts(
  deal: Listing,
  property: Property | undefined,
): IngestionConflict[] {
  const recordPrice =
    property && property.askingPrice > 0 ? property.askingPrice : deal.financials.askingPrice
  const hasPriceOnRecord = recordPrice > 0
  const basePrice = hasPriceOnRecord ? recordPrice : 7_900_000

  const hasNoiOnRecord = deal.financials.noi > 0
  const recordNoi = hasNoiOnRecord ? deal.financials.noi : 520_000

  const hasOccOnRecord = property !== undefined && property.occupancyPct > 0
  const recordOcc = hasOccOnRecord ? property.occupancyPct : 96

  // The documents read higher on price/NOI and lower on occupancy — the classic
  // "the T-12 doesn't support the pitch" shape. Each is floored (or, for
  // occupancy, flipped) away from the current figure so a small record value
  // can't round onto it: `docRaw !== currentRaw` is an invariant the arbitration
  // row depends on.
  const docPrice = Math.max(Math.round((basePrice * 1.063) / 10_000) * 10_000, basePrice + 10_000)
  const docNoi = Math.max(Math.round((recordNoi * 1.085) / 1_000) * 1_000, recordNoi + 1_000)
  const docOcc = recordOcc > 9 ? recordOcc - 8 : recordOcc + 8

  const priceCurrentSource = hasPriceOnRecord ? 'Property record' : 'Listing Agreement.pdf'
  const noiCurrentSource = hasNoiOnRecord ? 'Property record' : 'Rent Roll.xlsx'
  const occCurrentSource = hasOccOnRecord ? 'Property record' : 'T-12.pdf'

  // Same predicate the editor gates its Financials section on.
  const isSale = deal.dealType !== 'Lease'

  const financialConflicts: IngestionConflict[] = [
    {
      fieldKey: 'askingPrice',
      label: 'Asking price',
      docValue: money(docPrice),
      currentValue: money(basePrice),
      docSource: 'T-12.pdf',
      currentSource: priceCurrentSource,
      docRaw: docPrice,
      currentRaw: basePrice,
    },
    {
      fieldKey: 'noi',
      label: 'NOI',
      docValue: money(docNoi),
      currentValue: money(recordNoi),
      docSource: 'T-12.pdf',
      currentSource: noiCurrentSource,
      docRaw: docNoi,
      currentRaw: recordNoi,
    },
  ]

  return [
    ...(isSale ? financialConflicts : []),
    {
      fieldKey: 'occupancyPct',
      label: 'Occupancy',
      docValue: percent(docOcc),
      currentValue: percent(recordOcc),
      docSource: 'Rent Roll.xlsx',
      currentSource: occCurrentSource,
      docRaw: docOcc,
      currentRaw: recordOcc,
    },
  ]
}

/** Record which side the broker picked for one conflict. Pure. */
export function resolveConflict(
  ing: DealIngestion,
  fieldKey: IngestionFieldKey,
  side: 'doc' | 'current',
): DealIngestion {
  return {
    ...ing,
    conflicts: ing.conflicts.map((c) =>
      c.fieldKey === fieldKey ? { ...c, resolution: side } : c,
    ),
  }
}

export function unresolvedCount(ing: DealIngestion): number {
  return ing.conflicts.filter((c) => !c.resolution).length
}

export function allResolved(ing: DealIngestion): boolean {
  return unresolvedCount(ing) === 0
}

/**
 * The value a conflict commits. Once resolved that's the side the broker picked;
 * while unresolved it's the value already on record — the deal keeps reading
 * what it knows, and the document's figure stays an offer the broker can take.
 * (Publish stays blocked via `seedGateForm`, not by leaving the field empty.)
 */
function committedRaw(c: IngestionConflict): number {
  return c.resolution === 'doc' ? c.docRaw : c.currentRaw
}

function conflictFor(
  ing: DealIngestion,
  fieldKey: IngestionFieldKey,
): IngestionConflict | undefined {
  return ing.conflicts.find((c) => c.fieldKey === fieldKey)
}

/**
 * The deal-side field values to commit: everything `buildPublishReadyPatch`
 * produces, with each conflicted field set to its committed value — the picked
 * side once resolved, the on-record value until then. A conflicted field is
 * never left empty, so the editor shows the figure the broker would be keeping
 * rather than a bare 0. Publish blocking lives in `seedGateForm`, which treats
 * an unresolved asking-price conflict as an unmet requirement.
 */
export function ingestionPatch(
  deal: Listing,
  property: Property | undefined,
  ing: DealIngestion,
): PublishReadyPatch {
  const base = buildPublishReadyPatch(deal, property)
  const financials = { ...base.financials }

  const price = conflictFor(ing, 'askingPrice')
  if (price) {
    const raw = committedRaw(price)
    financials.askingPrice = raw
    // Price/SF is derived from the asking price, so it has to track whichever
    // figure is committed — otherwise the deal shows one price beside a Price/SF
    // computed from the other.
    financials.pricePerSqFt = pricePerSqFtFor(raw, draftSqFt(deal, property))
  }

  const noi = conflictFor(ing, 'noi')
  if (noi) financials.noi = committedRaw(noi)

  return { marketing: base.marketing, transaction: base.transaction, financials }
}

/**
 * Property-side values to commit — occupancy is a Property field, not a deal one.
 * Unresolved, this writes back the value already on record (a no-op), which keeps
 * the occupancy field showing what the broker would be keeping.
 */
export function resolvedPropertyPatch(ing: DealIngestion): { occupancyPct?: number } {
  const occ = conflictFor(ing, 'occupancyPct')
  return occ ? { occupancyPct: committedRaw(occ) } : {}
}

/** How many fields a patch actually sets — the banner's "filled N fields" count. */
export function countFilledFields(patch: PublishReadyPatch): number {
  const sections = [patch.marketing, patch.transaction, patch.financials]
  return sections.reduce(
    (n, section) => n + Object.values(section).filter((v) => v !== undefined).length,
    0,
  )
}

/**
 * Every field the run has actually settled: the deal-side patch plus any
 * property-side value, MINUS the conflicts still awaiting the broker. A
 * conflicted field holds the on-record value until it's confirmed, so counting it
 * would have the banner claim the documents filled something they didn't.
 * Recomputed on each resolution (not frozen at commit) so the count climbs as
 * the broker settles them.
 */
export function countCommittedFields(
  patch: PublishReadyPatch,
  propertyPatch: { occupancyPct?: number },
  ing: DealIngestion,
): number {
  const written =
    countFilledFields(patch) +
    Object.values(propertyPatch).filter((v) => v !== undefined).length
  // Clamped: a partial patch with more open conflicts than written fields would
  // otherwise put a negative number in the banner copy.
  return Math.max(0, written - unresolvedCount(ing))
}
