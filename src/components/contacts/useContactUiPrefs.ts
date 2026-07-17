import { create } from "zustand";

/**
 * Session-wide UI preferences for the contact detail page's collapsible
 * sections. These live outside the per-contact component tree so a section the
 * user collapses (or expands) while viewing one contact stays that way when
 * they navigate to another contact — the collapse state is a viewing
 * preference, not per-contact data.
 */
interface ContactUiPrefs {
  /** Open accordion sections in the left overview column. */
  overviewSections: string[];
  /** Whether the "Show Contact Details" panel is expanded. */
  showDetails: boolean;
  /** Whether past deals are revealed in the Deals section. */
  showPastDeals: boolean;
  /** Whether completed tasks are revealed in the Tasks column. */
  showCompletedTasks: boolean;
  /** Whether the Tasks section (right column) is expanded. */
  tasksOpen: boolean;
  /** Whether the AI Briefing section (top of the middle column) is expanded. */
  briefingOpen: boolean;

  setOverviewSections: (sections: string[]) => void;
  setShowDetails: (open: boolean) => void;
  setShowPastDeals: (open: boolean) => void;
  setShowCompletedTasks: (open: boolean) => void;
  setTasksOpen: (open: boolean) => void;
  setBriefingOpen: (open: boolean) => void;
}

export const useContactUiPrefs = create<ContactUiPrefs>((set) => ({
  overviewSections: ["deals", "properties"],
  showDetails: false,
  showPastDeals: false,
  showCompletedTasks: false,
  tasksOpen: true,
  briefingOpen: true,

  setOverviewSections: (overviewSections) => set({ overviewSections }),
  setShowDetails: (showDetails) => set({ showDetails }),
  setShowPastDeals: (showPastDeals) => set({ showPastDeals }),
  setShowCompletedTasks: (showCompletedTasks) => set({ showCompletedTasks }),
  setTasksOpen: (tasksOpen) => set({ tasksOpen }),
  setBriefingOpen: (briefingOpen) => set({ briefingOpen }),
}));
