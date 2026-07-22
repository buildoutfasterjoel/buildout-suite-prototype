import { create } from "zustand";

/**
 * Shared open-state for the Task modal, so any surface (the navbar +New menu, a
 * contact's Tasks panel, a task tile) can launch one globally-mounted modal
 * without prop-drilling. Mirrors `useNewContact` / `useCreateDeal`.
 *
 * The modal does double duty: create (no `taskId`) and edit (`taskId` set).
 */
interface AddTaskState {
  open: boolean;
  /** Contact to pre-select, when creating from a contact's Tasks panel. */
  contactId: string | null;
  /** Task being edited; null in create mode. */
  taskId: string | null;
  /**
   * When editing a deal-derived task, the deal it lives on. null for standalone
   * store tasks and for create mode.
   */
  dealId: string | null;
  /** Open in create mode, optionally pre-selecting a contact. */
  openFor: (contactId?: string | null) => void;
  /** Open in edit mode for an existing standalone task. */
  openEdit: (taskId: string) => void;
  /** Open in edit mode for a deal-embedded planner task. */
  openEditDeal: (dealId: string, taskId: string) => void;
  close: () => void;
}

export const useAddTask = create<AddTaskState>((set) => ({
  open: false,
  contactId: null,
  taskId: null,
  dealId: null,
  openFor: (contactId = null) =>
    set({ open: true, contactId, taskId: null, dealId: null }),
  openEdit: (taskId) =>
    set({ open: true, taskId, dealId: null, contactId: null }),
  openEditDeal: (dealId, taskId) =>
    set({ open: true, taskId, dealId, contactId: null }),
  close: () =>
    set({ open: false, contactId: null, taskId: null, dealId: null }),
}));
