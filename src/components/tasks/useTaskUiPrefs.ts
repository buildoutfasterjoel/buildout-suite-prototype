import { create } from "zustand";
import {
  emptyTaskFilters,
  type TaskFilterState,
} from "#/components/tasks/taskFilterModel";

/**
 * Session-wide UI state for the Tasks page — search, filters, and the
 * grouped/list view choice. Held outside the route component (mirrors
 * `useContactUiPrefs`) so it survives navigating away and back within a
 * session. Filter Sets stay live in memory; a full page reload resets to
 * defaults, matching the rest of the app's filter behavior.
 */
interface TaskUiPrefs {
  search: string;
  filters: TaskFilterState;
  view: "grouped" | "list";
  setSearch: (search: string) => void;
  setFilters: (filters: TaskFilterState) => void;
  setView: (view: "grouped" | "list") => void;
}

export const useTaskUiPrefs = create<TaskUiPrefs>((set) => ({
  search: "",
  filters: emptyTaskFilters(),
  view: "grouped",
  setSearch: (search) => set({ search }),
  setFilters: (filters) => set({ filters }),
  setView: (view) => set({ view }),
}));
