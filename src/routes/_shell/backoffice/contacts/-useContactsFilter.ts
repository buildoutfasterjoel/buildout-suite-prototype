import { create } from "zustand";
import type { ContactsFilterPayload } from "#/ai/resultNav";

/**
 * Bridge between the assistant's result summary cards and the People grid. A
 * "View in People" button (shown when a tool returns more than one contact)
 * stashes a filter here and navigates to `/backoffice/contacts`; the page picks
 * it up via a `useEffect`, applies it to the directory's filter state, and
 * lands the broker on the matching, pre-filtered contact list (see
 * `contacts/index.tsx`).
 */
interface ContactsFilterState {
  pending: ContactsFilterPayload | null;
  apply: (filter: ContactsFilterPayload) => void;
  clear: () => void;
}

export const useContactsFilter = create<ContactsFilterState>((set) => ({
  pending: null,
  apply: (filter) => set({ pending: filter }),
  clear: () => set({ pending: null }),
}));
