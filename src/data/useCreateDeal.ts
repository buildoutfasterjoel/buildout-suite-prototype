import { create } from 'zustand'
import type { Contact, Property } from './types'

/**
 * Shared open-state for the create-deal modal, so any surface (property record
 * header, contact page, navbar +New, omni-search) can launch one globally-mounted
 * modal without prop-drilling. Mirrors the pattern used by `useOmniSearch`.
 */
interface CreateDealState {
  open: boolean
  /** When set, the deal is initiated for this contact (contact prefilled). */
  contact?: Contact
  /** When set, the deal is initiated for this property (property locked, owner suggested). */
  property?: Property
  /** Seed text for the property address field (e.g. an omni-search query). */
  initialAddress?: string
  /**
   * "Create deal from this space" on a property with no lease shell yet. The
   * modal opens on Lease with the whole building locked as the scope — what is
   * being created is the building's lease assignment — and, once the deal
   * exists, adds this unit to it as its first space and lands on that space.
   * Only meaningful with `property`.
   */
  spaceUnitId?: string
  /** Lock the deal type to Lease (Sale tab disabled). Set with `spaceUnitId`. */
  lockLease?: boolean
  openFor: (ctx?: {
    contact?: Contact
    property?: Property
    initialAddress?: string
    spaceUnitId?: string
    lockLease?: boolean
  }) => void
  close: () => void
}

export const useCreateDeal = create<CreateDealState>((set) => ({
  open: false,
  contact: undefined,
  property: undefined,
  initialAddress: undefined,
  spaceUnitId: undefined,
  lockLease: undefined,
  openFor: (ctx) =>
    set({
      open: true,
      contact: ctx?.contact,
      property: ctx?.property,
      initialAddress: ctx?.initialAddress,
      spaceUnitId: ctx?.spaceUnitId,
      lockLease: ctx?.lockLease,
    }),
  close: () =>
    set({
      open: false,
      contact: undefined,
      property: undefined,
      initialAddress: undefined,
      spaceUnitId: undefined,
      lockLease: undefined,
    }),
}))
