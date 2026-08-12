import { create } from "zustand";
import type { DayPlanItem } from "#/ai/dayPlan";

/**
 * The day queue's live position, held outside the transcript.
 *
 * It starts life rendered inline under its checklist, but once the broker takes
 * a call it has to come back at the *bottom* of the chat — below the hand-off and
 * the recap — rather than back up in the history where it was. A component's
 * position is fixed by where it's mounted, so the queue is rendered in two places
 * and this store decides which one is live (see `detached`).
 */
interface DayPlanQueueState {
  /**
   * Identity of the armed queue (the item ids joined). A later `plan_my_day`
   * arms a new queue rather than resuming this one, and the older inline card
   * stands down once its key no longer matches.
   */
  key: string | null;
  items: DayPlanItem[];
  /** Cursor into the *remaining* items. */
  index: number;
  /** Ids already worked or called, so they drop out of the queue. */
  cleared: string[];
  /** The item whose call is in flight; the card hides entirely while set. */
  parkedFor: string | null;
  /** Transient italic line above the headline ("Skipped, let me look again…"). */
  note: string | null;
  /** True once a call moved the queue to the bottom of the chat. */
  detached: boolean;

  arm: (key: string, items: DayPlanItem[]) => void;
  skip: (note: string) => void;
  clear: (taskId: string, note: string) => void;
  park: (taskId: string) => void;
  resume: (note: string) => void;
}

const EMPTY = {
  key: null,
  items: [] as DayPlanItem[],
  index: 0,
  cleared: [] as string[],
  parkedFor: null as string | null,
  note: null as string | null,
  detached: false,
};

export const useDayPlanQueue = create<DayPlanQueueState>((set, get) => ({
  ...EMPTY,

  arm: (key, items) => set({ ...EMPTY, key, items }),

  skip: (note) =>
    set((s) => {
      const remaining = s.items.filter((i) => !s.cleared.includes(i.taskId));
      return { note, index: s.index + 1 >= remaining.length ? 0 : s.index + 1 };
    }),

  clear: (taskId, note) =>
    set((s) => ({
      cleared: s.cleared.includes(taskId) ? s.cleared : [...s.cleared, taskId],
      index: 0,
      note,
    })),

  // Taking a call both hides the queue and moves it to the bottom for its return.
  park: (taskId) => set({ parkedFor: taskId, detached: true }),

  resume: (note) => {
    const { parkedFor } = get();
    set((s) => ({
      parkedFor: null,
      index: 0,
      note,
      cleared:
        parkedFor && !s.cleared.includes(parkedFor) ? [...s.cleared, parkedFor] : s.cleared,
    }));
  },
}));

/** Stable identity for a set of queue items. */
export function dayPlanKey(items: DayPlanItem[]): string {
  return items.map((i) => i.taskId).join("|");
}
