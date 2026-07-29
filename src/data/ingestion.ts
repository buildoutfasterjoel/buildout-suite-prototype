import type {
  DealIngestion,
  IngestionConflict,
  IngestionFieldKey,
  Listing,
  Property,
} from './types'
import { buildPublishReadyPatch, type PublishReadyPatch } from './uploadIntelligence'

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
 * The faked extraction: derive three two-sided conflicts a T-12 and rent roll
 * would plausibly raise. When a property record exists the comparison is
 * doc-vs-record; without one (a typed-in address) it is doc-vs-doc — the rent
 * roll disagreeing with the T-12 — so both sides always carry a value and
 * whichever the broker picks leaves the field populated.
 */
export function deriveConflicts(
  deal: Listing,
  property: Property | undefined,
): IngestionConflict[] {
  const recordPrice = property && property.askingPrice > 0 ? property.askingPrice : deal.financials.askingPrice
  const basePrice = recordPrice > 0 ? recordPrice : 7_900_000
  const recordNoi = deal.financials.noi > 0 ? deal.financials.noi : 520_000
  const recordOcc = property && property.occupancyPct > 0 ? property.occupancyPct : 96

  // The documents read higher on price/NOI and lower on occupancy — the classic
  // "the T-12 doesn't support the pitch" shape.
  const docPrice = Math.round((basePrice * 1.063) / 10_000) * 10_000
  const docNoi = Math.round((recordNoi * 1.085) / 1_000) * 1_000
  const docOcc = Math.max(1, recordOcc - 8)

  const hasRecord = property !== undefined
  const currentSource = hasRecord ? 'Property record' : 'Rent Roll.xlsx'
  const priceCurrentSource = hasRecord ? 'Property record' : 'Listing Agreement.pdf'

  return [
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
      currentSource,
      docRaw: docNoi,
      currentRaw: recordNoi,
    },
    {
      fieldKey: 'occupancyPct',
      label: 'Occupancy',
      docValue: percent(docOcc),
      currentValue: percent(recordOcc),
      docSource: 'Rent Roll.xlsx',
      currentSource: hasRecord ? 'Property record' : 'T-12.pdf',
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

/** The value a resolved conflict commits — the side the broker picked. */
function resolvedRaw(c: IngestionConflict): number | undefined {
  if (!c.resolution) return undefined
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
 * produces, minus any field still in conflict, plus resolved conflicts at the
 * picked value. Withholding a gate-required field (asking price on a Sale) is
 * what makes an unresolved conflict block publishing — no separate gate logic.
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
    const raw = resolvedRaw(price)
    if (raw === undefined) {
      delete financials.askingPrice
      delete financials.pricePerSqFt
    } else {
      financials.askingPrice = raw
    }
  }

  const noi = conflictFor(ing, 'noi')
  if (noi) {
    const raw = resolvedRaw(noi)
    if (raw === undefined) delete financials.noi
    else financials.noi = raw
  }

  return { marketing: base.marketing, transaction: base.transaction, financials }
}

/** Property-side values to commit — occupancy is a Property field, not a deal one. */
export function resolvedPropertyPatch(ing: DealIngestion): { occupancyPct?: number } {
  const occ = conflictFor(ing, 'occupancyPct')
  const raw = occ ? resolvedRaw(occ) : undefined
  return raw === undefined ? {} : { occupancyPct: raw }
}

/** How many fields a patch actually sets — the banner's "filled N fields" count. */
export function countFilledFields(patch: PublishReadyPatch): number {
  const sections = [patch.marketing, patch.transaction, patch.financials]
  return sections.reduce(
    (n, section) => n + Object.values(section).filter((v) => v !== undefined).length,
    0,
  )
}
