import { create } from "zustand";

/**
 * Shared open-state for the Add Task modal, so any surface (the navbar +New
 * menu, a contact's Tasks panel) can launch one globally-mounted modal without
 * prop-drilling. Mirrors the pattern used by `useNewContact` / `useCreateDeal`.
 */
interface AddTaskState {
  open: boolean;
  /** Contact to pre-select, when launched from a contact's Tasks panel. */
  contactId: string | null;
  openFor: (contactId?: string | null) => void;
  close: () => void;
}

export const useAddTask = create<AddTaskState>((set) => ({
  open: false,
  contactId: null,
  openFor: (contactId = null) => set({ open: true, contactId }),
  close: () => set({ open: false, contactId: null }),
}));
