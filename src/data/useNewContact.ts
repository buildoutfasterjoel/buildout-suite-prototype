import { create } from "zustand";

/**
 * Shared open-state for the New Contact modal, so any surface (the navbar +New
 * menu, the People page's Add Contacts button) can launch one globally-mounted
 * modal without prop-drilling. Mirrors the pattern used by `useCreateDeal`.
 */
interface NewContactState {
  open: boolean;
  openNew: () => void;
  close: () => void;
}

export const useNewContact = create<NewContactState>((set) => ({
  open: false,
  openNew: () => set({ open: true }),
  close: () => set({ open: false }),
}));
