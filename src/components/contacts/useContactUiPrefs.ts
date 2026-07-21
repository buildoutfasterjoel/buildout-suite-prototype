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
  /**
   * Design-comparison toggle: when true, the contact detail accordions render
   * the legacy style (chevrons on the LEFT, white content backgrounds) instead
   * of the current style (right chevrons, tinted content). Flipped via the
   * floating toggle on the contact detail page.
   */
  legacyAccordions: boolean;
  /**
   * Design-comparison toggle for the middle-column tab tracks (Log Activity +
   * Timeline): "system" uses the Blueprint pill variant (grey track, white
   * active pill + shadow); "ghost" uses the transparent-track purple-accent
   * treatment. Flipped via a floating toggle on the contact detail page.
   */
  tabTrack: "system" | "ghost";
  /**
   * Design-comparison toggle for the timeline filter control: "dropdown" uses a
   * type Select + a "Needs Reply" checkbox; "tabs" uses the original pill track.
   */
  timelineFilter: "dropdown" | "tabs";

  setOverviewSections: (sections: string[]) => void;
  setShowDetails: (open: boolean) => void;
  setShowPastDeals: (open: boolean) => void;
  setShowCompletedTasks: (open: boolean) => void;
  setTasksOpen: (open: boolean) => void;
  setBriefingOpen: (open: boolean) => void;
  setLegacyAccordions: (legacy: boolean) => void;
  setTabTrack: (track: "system" | "ghost") => void;
  setTimelineFilter: (style: "dropdown" | "tabs") => void;
}

export const useContactUiPrefs = create<ContactUiPrefs>((set) => ({
  // The AI Briefing, contact Details, and Tasks section start open; everything
  // else collapsed. State persists across contact navigation (in-memory store)
  // but resets to these defaults on a fresh page load.
  overviewSections: [],
  showDetails: true,
  showPastDeals: false,
  showCompletedTasks: false,
  tasksOpen: true,
  briefingOpen: true,
  // Default to the "New" accordion treatment (chevron on the left, white body).
  // The flag name is historical; `true` renders that style. See the toggle.
  legacyAccordions: true,
  tabTrack: "system",
  timelineFilter: "dropdown",

  setOverviewSections: (overviewSections) => set({ overviewSections }),
  setShowDetails: (showDetails) => set({ showDetails }),
  setShowPastDeals: (showPastDeals) => set({ showPastDeals }),
  setShowCompletedTasks: (showCompletedTasks) => set({ showCompletedTasks }),
  setTasksOpen: (tasksOpen) => set({ tasksOpen }),
  setBriefingOpen: (briefingOpen) => set({ briefingOpen }),
  setLegacyAccordions: (legacyAccordions) => set({ legacyAccordions }),
  setTabTrack: (tabTrack) => set({ tabTrack }),
  setTimelineFilter: (timelineFilter) => set({ timelineFilter }),
}));
