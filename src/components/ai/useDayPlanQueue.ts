import { create } from "zustand";
import type { DayPlanItem } from "#/ai/dayPlan";

/**
 * The day queue's live position, held outside the transcript.
 *
 * The queue is pinned above the composer from the moment it is armed: asking for
 * next actions *is* the broker saying they intend to work them, so the card
 * belongs where the hands are rather than scrolling away up the transcript with
 * the message that produced it. It earlier lived inline until a call detached it,
 * which meant the surface being worked drifted into history — and a call started
 * from the chat rather than the card's own button never detached it at all.
 *
 * The card is still *mounted* twice: once at the tool result, which owns arming
 * (see the `arm` slot in `DayPlanCard`), and once pinned, which is the only one
 * that draws anything.
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
  /**
   * The item whose call is in flight. `resume` clears it when the call wraps.
   * The card stays pinned and visible throughout — folded to its header, not
   * hidden, since it moved out of the transcript.
   */
  parkedFor: string | null;
  /** Transient italic line above the headline ("Skipped, let me look again…"). */
  note: string | null;
  /**
   * Folded down to just its header, and BY WHOM.
   *
   * Who matters: the rail folds the queue on its own while another card with its
   * own actions is live (an email draft's Send/Edit/Delete competing with the
   * queue's Call/Done is the busyness this avoids), and unfolds it when that card
   * resolves. That unfold must never override a fold the broker made by hand — an
   * automatic gesture may undo an automatic gesture, never an explicit one. One
   * field rather than two booleans so the two can't contradict each other.
   *
   * **Finishing a move is the one exception**, and every path that clears an item
   * takes it. A hand fold says "not now"; completing a move is the broker turning
   * back to the queue, and the move that replaces it is news they earned by
   * finishing the last one — so it opens even if they had folded it. Without this
   * a fold made early in a session silently swallowed every later hand-off, which
   * read as the card being broken.
   */
  collapsedBy: "user" | "auto" | null;
  /** Closed outright. A later `plan_my_day` arms a fresh queue and brings it back. */
  dismissed: boolean;

  arm: (key: string, items: DayPlanItem[]) => void;
  /**
   * Move the cursor by `delta`, wrapping at both ends. This is the card's
   * prev/next nav — pure browsing, so unlike `clear` it changes nothing about
   * the queue itself and leaves no note behind.
   */
  step: (delta: number) => void;
  clear: (taskId: string, note: string) => void;
  park: (taskId: string) => void;
  resume: (note: string) => void;
  /** The broker's own fold/unfold, from the card's chevron. */
  setCollapsed: (collapsed: boolean) => void;
  /** The rail's fold. No-op when the broker has already folded it themselves. */
  autoCollapse: (collapsed: boolean) => void;
  dismiss: () => void;
  revive: () => void;
  /**
   * Drop the queued move for a contact, worked through some other channel.
   * No-op when nothing in the queue points at them.
   */
  clearForContact: (contactId: string, note: string) => void;
}

const EMPTY = {
  key: null,
  items: [] as DayPlanItem[],
  index: 0,
  cleared: [] as string[],
  parkedFor: null as string | null,
  note: null as string | null,
  collapsedBy: null as "user" | "auto" | null,
  dismissed: false,
};

export const useDayPlanQueue = create<DayPlanQueueState>((set, get) => ({
  ...EMPTY,

  arm: (key, items) => set({ ...EMPTY, key, items }),

  step: (delta) =>
    set((s) => {
      const remaining = s.items.filter((i) => !s.cleared.includes(i.taskId));
      if (remaining.length === 0) return { index: 0, note: null };
      // Modulo twice: JS's `%` keeps the sign of the dividend, so a step back
      // from the first item would land on -1 rather than wrapping to the end.
      const next = ((s.index + delta) % remaining.length + remaining.length) % remaining.length;
      // Browsing clears the transient note — it belonged to the move you just
      // stepped away from.
      return { index: next, note: null };
    }),

  clear: (taskId, note) =>
    set((s) => ({
      cleared: s.cleared.includes(taskId) ? s.cleared : [...s.cleared, taskId],
      index: 0,
      note,
      // Finishing a move reveals the next one — see `collapsedBy`.
      collapsedBy: null,
    })),

  /**
   * A call is in flight on this item — the card steps aside until it wraps up,
   * and `resume` then clears the item.
   *
   * Called from the card's own Call button AND, so that "call rosa" typed into
   * the chat counts the same, from the card's effect that adopts a live call
   * matching the queued contact. Without that second path the move stayed on the
   * queue after the broker had actually made the call.
   */
  park: (taskId) => set({ parkedFor: taskId }),

  resume: (note) => {
    const { parkedFor } = get();
    set((s) => ({
      parkedFor: null,
      index: 0,
      note,
      cleared:
        parkedFor && !s.cleared.includes(parkedFor) ? [...s.cleared, parkedFor] : s.cleared,
      collapsedBy: null,
    }));
  },

  setCollapsed: (collapsed) => set({ collapsedBy: collapsed ? "user" : null }),

  autoCollapse: (collapsed) =>
    set((s) => {
      // Their fold outranks ours in both directions: we neither fold over a
      // deliberate unfold nor unfold over a deliberate fold.
      if (s.collapsedBy === "user") return s;
      const next = collapsed ? "auto" : null;
      return s.collapsedBy === next ? s : { collapsedBy: next };
    }),

  dismiss: () => set({ dismissed: true }),

  /**
   * Bring a queue the broker closed (or folded) back, without touching what they
   * have already worked.
   *
   * `arm` deliberately no-ops when the same queue is asked for twice, so it keeps
   * the broker's progress instead of resetting it. That guard turned a dismissal
   * into a dead end: close the card, ask "what's next" again, get the same eight
   * items, same key — no re-arm, `dismissed` still true, and no way back to it.
   * An explicit ask is a request to see the queue, so it reopens and returns to
   * the top, which is also what the reply says it does.
   */
  revive: () => set({ dismissed: false, collapsedBy: null, index: 0 }),

  clearForContact: (contactId, note) =>
    set((s) => {
      const match = s.items.find(
        (i) => i.contactId === contactId && !s.cleared.includes(i.taskId),
      );
      if (!match) return s;
      // Clears it from the queue WITHOUT completing the underlying task record.
      // Emailing someone about a move is not the same as the move being done —
      // the same line the call path draws, where `resume` clears and leaves the
      // task alone.
      return { cleared: [...s.cleared, match.taskId], index: 0, note, collapsedBy: null };
    }),
}));

/** Stable identity for a set of queue items. */
export function dayPlanKey(items: DayPlanItem[]): string {
  return items.map((i) => i.taskId).join("|");
}
