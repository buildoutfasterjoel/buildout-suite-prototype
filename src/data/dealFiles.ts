import type { DealFileItem, Listing } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAfter(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()
}

/**
 * Seeds a listing's Files workspace: the deal-creation-time uploads (offering
 * memorandum, financials, notes) plus a couple of standard folders so the page
 * isn't empty on first visit. Deterministic — no Date.now()/Math.random() — so
 * server and client render the same initial state.
 */
export function buildInitialFiles(listing: Listing): DealFileItem[] {
  const { id: listingId, createdAt, documents } = listing
  const items: DealFileItem[] = []

  for (const doc of documents ?? []) {
    items.push({
      id: doc.id,
      name: doc.name,
      kind: 'file',
      parentId: null,
      createdAt: doc.uploadedAt,
      sizeBytes: parseSizeLabel(doc.size),
    })
  }

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
