import { create } from "zustand";
import type { ContactFilterState } from "#/components/contacts/contactFilterModel";

/** Which contacts view the pager is stepping through, for the breadcrumb label. */
export type ContactListVariant = "all" | "filtered" | "list";

/**
 * A snapshot of the People page view a contact was opened from — enough to both
 * label/link the breadcrumb and restore the exact list/filter/search state when
 * the user clicks back into it.
 */
export interface ContactListSource {
  variant: ContactListVariant;
  /** Breadcrumb label: "Contacts", "Contacts (Filtered)", or the list name. */
  label: string;
  /** The People page's active list id (for restore). */
  listId: string;
  /** Working filter state at navigation time (for restore). */
  filters: ContactFilterState;
  /** Search box text at navigation time (for restore). */
  search: string;
}

interface ContactListNavState {
  /** Ordered contact ids in the list the user is currently navigating. */
  ids: string[];
  /** Where that list came from (null before the People page has run). */
  source: ContactListSource | null;
  /**
   * Set by a breadcrumb click to ask the People page to restore `source` on its
   * next mount (vs. a plain nav to People, which resets to All Contacts).
   */
  restorePending: boolean;

  /** Mirror the People page's current list + source (called as the view changes). */
  setList: (ids: string[], source: ContactListSource) => void;
  /** Flag that the next People mount should restore the stored source. */
  requestRestore: () => void;
  /** Consume the restore flag (called by the People page after it restores). */
  clearRestore: () => void;
}

export const useContactListNav = create<ContactListNavState>((set) => ({
  ids: [],
  source: null,
  restorePending: false,

  setList: (ids, source) => set({ ids, source }),
  requestRestore: () => set({ restorePending: true }),
  clearRestore: () => set({ restorePending: false }),
}));
