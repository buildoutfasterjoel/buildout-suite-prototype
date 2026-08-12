import { create } from 'zustand'

/**
 * The owner-unlock credit ledger.
 *
 * Reading a Buildout Insights record is free; reaching the people behind it
 * costs a credit. The rule that makes the meter feel fair — and the one the
 * Add Property dialog's copy promises — is that a property is only ever
 * charged once: re-opening an owner you've already unlocked is free, so
 * browsing back to a record can't quietly bill you again.
 *
 * Deliberately outside the persisted `DataSlice`: a credit balance is billing
 * state, not the book of business, and keeping it in session memory means a
 * reload hands the demo a fresh meter instead of a spent one.
 */

/** Credits included in the billing cycle — the number the CTA advertises. */
const CYCLE_CREDITS = 493

/**
 * How far a lookup went. `quick` returns the owner of record and their phone;
 * `in-depth` returns the researched roster, emails, and related companies.
 * Depth is recorded because deepening a lookup you already paid for is free —
 * the credit buys the property, not the tier.
 */
export type LookupDepth = 'quick' | 'in-depth'

interface OwnerCreditsState {
  balance: number
  /** Property id → the deepest lookup run against it this session. */
  unlocked: Map<string, LookupDepth>
  depthFor: (propertyId: string) => LookupDepth | null
  isUnlocked: (propertyId: string) => boolean
  /**
   * Unlock (or deepen) a property's owner contacts. Returns whether a credit
   * was spent — `false` means this property was already paid for, or the
   * balance is exhausted; check `depthFor` afterwards to tell those apart.
   */
  unlock: (propertyId: string, depth: LookupDepth) => boolean
  reset: () => void
}

export const useOwnerCredits = create<OwnerCreditsState>((set, get) => ({
  balance: CYCLE_CREDITS,
  unlocked: new Map<string, LookupDepth>(),

  depthFor: (propertyId) => get().unlocked.get(propertyId) ?? null,
  isUnlocked: (propertyId) => get().unlocked.has(propertyId),

  unlock: (propertyId, depth) => {
    const { unlocked, balance } = get()
    const current = unlocked.get(propertyId)

    // Already paid for. Deepening quick → in-depth is free; the reverse is a
    // no-op, since a shallower lookup reveals nothing new.
    if (current) {
      if (current !== depth && depth === 'in-depth') {
        set({ unlocked: new Map(unlocked).set(propertyId, depth) })
      }
      return false
    }

    if (balance <= 0) return false
    set({
      balance: balance - 1,
      unlocked: new Map(unlocked).set(propertyId, depth),
    })
    return true
  },

  reset: () => set({ balance: CYCLE_CREDITS, unlocked: new Map() }),
}))
