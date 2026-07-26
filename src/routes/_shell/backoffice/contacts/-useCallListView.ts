import { create } from "zustand";

/**
 * Bridge between the `build_call_list` agent tool and the People grid. When the
 * assistant builds an AI call list, it stashes the new list's id + the ranked
 * contactId order here and navigates to `/backoffice/contacts`; the page picks
 * it up via a `useEffect` (see `contacts/index.tsx`), opens that list, and
 * shows it in ranked order — the same result the old on-page "Build call list
 * with AI" button produced, now driven from chat.
 */
export interface CallListView {
  listId: string;
  rankedContactIds: string[];
}

interface CallListViewState {
  pending: CallListView | null;
  activate: (view: CallListView) => void;
  clear: () => void;
}

export const useCallListView = create<CallListViewState>((set) => ({
  pending: null,
  activate: (view) => set({ pending: view }),
  clear: () => set({ pending: null }),
}));
