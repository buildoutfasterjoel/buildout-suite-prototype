import type { PropertyStatus } from './types'
import { getListing, getProperty, getContact } from './store'
import { getChildDeals } from './leaseSpaces'

export interface SpaceVoucherRow {
  dealId: string
  /** The suite's label, falling back to the child deal's name. */
  label: string
  /** The first accepted tenant, or null before one is captured. */
  tenantName: string | null
  /** Null until the space transacts — an index row shows an em-dash for it. */
  commissionAmount: number | null
  /** Raw status. Render through `dealStageLabel(stage, 'space')`. */
  stage: PropertyStatus
}

/**
 * Every space's money, for the shell's Vouchers index. Mirrors
 * `buildingAvailability`: same source (the shell's child deals), same shape, so
 * the two derivations stay recognisable as siblings.
 *
 * Sorted by suite label. `getChildDeals` returns store-insertion order, which is
 * arbitrary to a broker, and the roster applies the same sort — the two pages
 * must not disagree about ordering.
 */
export function spaceVouchers(shellDealId: string): SpaceVoucherRow[] {
  const shell = getListing(shellDealId)
  if (!shell) return []
  const property = getProperty(shell.propertyId)

  return getChildDeals(shellDealId)
    .map((child) => {
      const unit = property?.units.find((u) => u.id === child.unitId)
      const tenantId = child.tenantContactIds[0]
      const tenant = tenantId ? getContact(tenantId) : undefined
      const commission = child.transaction.commissionAmount
      return {
        dealId: child.id,
        label: unit?.label ?? child.name,
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : null,
        // `createProposalListing` seeds commissionAmount to 0 and the type is
        // `number`, so 0 — not null — is what "has not transacted yet" looks
        // like. Hence a positive test rather than a null check. The prototype
        // records no genuine $0 commission, and the index prints this row's
        // stage right beside the figure, so "—" is never ambiguous in practice.
        // Do NOT widen DealTransaction.commissionAmount to make this nullable:
        // that taxes every call site app-wide for a distinction nothing makes.
        commissionAmount: commission > 0 ? commission : null,
        stage: child.status,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
}
