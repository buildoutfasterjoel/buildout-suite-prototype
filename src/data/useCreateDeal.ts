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
  openFor: (ctx?: { contact?: Contact; property?: Property; initialAddress?: string }) => void
  close: () => void
}

export const useCreateDeal = create<CreateDealState>((set) => ({
  open: false,
  contact: undefined,
  property: undefined,
  initialAddress: undefined,
  openFor: (ctx) =>
    set({
      open: true,
      contact: ctx?.contact,
      property: ctx?.property,
      initialAddress: ctx?.initialAddress,
    }),
  close: () =>
    set({ open: false, contact: undefined, property: undefined, initialAddress: undefined }),
}))
