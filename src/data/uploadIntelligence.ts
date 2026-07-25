import { SUGGESTED_DOCUMENTS } from './createListing'
import type { DealDocument } from './types'

/**
 * The documents Buildout "extracts" from a broker's uploaded files. Uploads in
 * the demo are mostly T-12s, rent rolls, and listing agreements; each maps to
 * the catalog docs the AI can now produce. When any financial file is present,
 * the AI also drafts the core marketing deliverables (OM + BOV). Returned in
 * catalog order so the Selected list stays stable.
 */
export function recommendDocsFromUploads(files: DealDocument[]): string[] {
  const names = files.map((f) => f.name.toLowerCase())
  const has = (re: RegExp) => names.some((n) => re.test(n))

  const keys = new Set<string>()
  const hasRentRoll = has(/rent\s*roll/)
  const hasT12 = has(/t-?12|operating statement/)
  const hasListingAgreement = has(/listing agreement/)

  if (hasRentRoll) keys.add('rent-roll')
  if (hasT12) {
    keys.add('t12')
    keys.add('proforma')
    keys.add('noi')
  }
  if (hasListingAgreement) keys.add('listing-agreement')
  if (hasRentRoll || hasT12) {
    keys.add('om')
    keys.add('bov')
  }

  return SUGGESTED_DOCUMENTS.filter((d) => keys.has(d.key)).map((d) => d.key)
}
