import { create } from "zustand";
import {
  emptyTaskFilters,
  type TaskFilterState,
} from "#/components/tasks/taskFilterModel";

/**
 * Session-wide UI state for the Tasks page — search, filters, the grouped/list
 * view choice, and which grouped sections are collapsed. Held outside the route
 * component (mirrors `useContactUiPrefs`) so it survives navigating away and
 * back within a session. Filter Sets stay live in memory; a full page reload
 * resets to defaults, matching the rest of the app's filter behavior.
 *
 * Deliberately NOT persisted: the "show all" reveal on the truncated Overdue /
 * Future sections. That resets each time you land on the page so the default
 * view stays short.
 */
interface TaskUiPrefs {
  search: string;
  filters: TaskFilterState;
  view: "grouped" | "list";
  /** Section key → collapsed. Absent means open (the default). */
  collapsedSections: Record<string, boolean>;
  setSearch: (search: string) => void;
  setFilters: (filters: TaskFilterState) => void;
  setView: (view: "grouped" | "list") => void;
  setSectionOpen: (key: string, open: boolean) => void;
}

export const useTaskUiPrefs = create<TaskUiPrefs>((set) => ({
  search: "",
  filters: emptyTaskFilters(),
  view: "grouped",
  collapsedSections: {},
  setSearch: (search) => set({ search }),
  setFilters: (filters) => set({ filters }),
  setView: (view) => set({ view }),
  setSectionOpen: (key, open) =>
    set((s) => ({
      collapsedSections: { ...s.collapsedSections, [key]: !open },
    })),
}));
