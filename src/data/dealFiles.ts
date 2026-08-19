import type { DealFileItem, Listing } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAfter(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()
}

/**
 * Seeds a listing's Files workspace: the deal-creation-time uploads (offering
 * memorandum, financials, notes), a set of source files the document generator
 * can act on (one per kind it maps to a section), plus a couple of standard
 * folders so the page isn't empty on first visit. Deterministic — no Date.now()/Math.random() — so
 * server and client render the same initial state.
 *
 * Only the broker's own uploaded files seed the Files workspace — Buildout's
 * AI-generated documents live on the Documents page, not here.
 */
export function buildInitialFiles(listing: Listing): DealFileItem[] {
  const { id: listingId, createdAt, documents } = listing
  const items: DealFileItem[] = []

  for (const doc of documents ?? []) {
    if (doc.aiGenerated) continue
    items.push({
      id: doc.id,
      name: doc.name,
      kind: 'file',
      parentId: null,
      createdAt: doc.uploadedAt,
      sizeBytes: parseSizeLabel(doc.size),
    })
  }

  // Source files the document generator can act on — one per kind it maps to a
  // section, so a fresh deal can produce an interesting document. Sizes are
  // literal byte counts; formatBytes renders them in the picker.
  items.push(
    {
      id: `${listingId}-file-t12`,
      name: 'T-12 Operating Statement 2025.pdf',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 1),
      sizeBytes: 1_468_006,
    },
    {
      id: `${listingId}-file-rent-roll`,
      name: 'Rent Roll 2026.xlsx',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 1),
      sizeBytes: 245_760,
    },
    {
      id: `${listingId}-file-submarket`,
      name: 'Submarket Report.pdf',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 4),
      sizeBytes: 3_250_586,
    },
    {
      id: `${listingId}-file-sale-comps`,
      name: 'Sale Comparables.xlsx',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 6),
      sizeBytes: 98_304,
    },
    {
      id: `${listingId}-file-site-photos`,
      name: 'Site Photos.zip',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 5),
      sizeBytes: 18_874_368,
    },
  )

  const leasesId = `${listingId}-folder-leases`
  const correspondenceId = `${listingId}-folder-correspondence`

  items.push(
    { id: leasesId, name: 'Leases', kind: 'folder', parentId: null, createdAt: daysAfter(createdAt, 2) },
    {
      id: correspondenceId,
      name: 'Correspondence',
      kind: 'folder',
      parentId: null,
      createdAt: daysAfter(createdAt, 3),
    },
    {
      id: `${listingId}-file-lease-1`,
      name: 'Tenant Estoppel - Suite 100.pdf',
      kind: 'file',
      parentId: leasesId,
      createdAt: daysAfter(createdAt, 12),
      sizeBytes: 412_000,
    },
    {
      id: `${listingId}-file-lease-2`,
      name: 'Master Lease Agreement.docx',
      kind: 'file',
      parentId: leasesId,
      createdAt: daysAfter(createdAt, 14),
      sizeBytes: 88_000,
    },
    {
      id: `${listingId}-file-corr-1`,
      name: 'Buyer Q&A Thread.pdf',
      kind: 'file',
      parentId: correspondenceId,
      createdAt: daysAfter(createdAt, 20),
      sizeBytes: 156_000,
    },
  )

  return items
}

/** Parses a human size label like "2.3 MB" back into bytes for the Size column. */
function parseSizeLabel(label: string | undefined): number | undefined {
  if (!label) return undefined
  const match = /^([\d.]+)\s*(B|KB|MB|GB)$/i.exec(label.trim())
  if (!match) return undefined
  const value = Number(match[1])
  const unit = match[2].toUpperCase()
  const exponent = { B: 0, KB: 1, MB: 2, GB: 3 }[unit] ?? 0
  return Math.round(value * 1024 ** exponent)
}
