import type { DealSide, DealType } from '#/data/types'
import type { PropertyOption } from '#/data/store'

/** The role label for the contact field, given the chosen side + deal type. */
export function contactRoleLabel(side: DealSide | null, dealType: DealType): string {
  if (!side) return 'Contact'
  if (side === 'seller') return dealType === 'Lease' ? 'Landlord' : 'Seller'
  return dealType === 'Lease' ? 'Tenant' : 'Buyer'
}

/** Placeholder for the contact search input, matching the role label. */
export function contactSearchPlaceholder(side: DealSide | null, dealType: DealType): string {
  const role = contactRoleLabel(side, dealType)
  return role === 'Contact' ? 'Search contacts…' : `Search ${role.toLowerCase()}s…`
}

/** A section in the property dropdown. `label` null = render no header. */
export interface PropertyGroup {
  value: string
  label: string | null
  items: PropertyOption[]
}

/**
 * Split property options into "Owned by {name}" first, then "All properties".
 * Falls back to one unlabeled group holding everything when there's no owner
 * name or the owner has none of the listed properties — so the caller's render
 * path is uniform whether or not grouping applies.
 */
export function buildPropertyGroups(
  options: PropertyOption[],
  ownedIds: readonly string[],
  ownerName: string | null,
): PropertyGroup[] {
  const owned = new Set(ownedIds)
  const ownedOpts = options.filter((o) => owned.has(o.value))
  if (!ownerName || ownedOpts.length === 0) {
    return [{ value: 'all', label: null, items: options }]
  }
  const rest = options.filter((o) => !owned.has(o.value))
  return [
    { value: 'owned', label: `Owned by ${ownerName}`, items: ownedOpts },
    { value: 'all', label: 'All properties', items: rest },
  ]
}
