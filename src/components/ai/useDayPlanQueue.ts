import { create } from "zustand";
import type { DayPlanItem } from "#/ai/dayPlan";

/**
 * A move the broker finished, kept so the transcript carries a history of their
 * progress through the queue (Figma 262:19694 / 265:19858).
 *
 * Holds a copy of the `DayPlanItem` rather than its id: the log outlives the
 * queue it came from, and a later `plan_my_day` replaces `items` wholesale.
 */
export interface CompletedAction {
  taskId: string;
  item: DayPlanItem;
  /**
   * When the work happened — stamped where the move is finished, NOT where it is
   * committed. The commit deliberately waits out the turn (see `pending`), and a
   * call logged behind a modal can wait minutes; stamping there would report the
   * time the broker read about it rather than the time they made the call.
   *
   * Not rendered: the block dropped its activity line, which was the only thing
   * that showed a time. Kept because it is this record's identity — the same
   * move can be worked again under a later queue, and the pair (task, instant)
   * is what tells the two apart in a list.
   */
  at: string;
  /**
   * The transcript message this landed under, `null` when it landed before
   * anything had been said. Same scheme as `useTranscriptAnchor` in the rail —
   * a completed move is a record of a moment, so it stays at that moment instead
   * of sliding to the bottom behind every later turn.
   */
  anchorId: string | null;
}

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
   * Who matters, because the two sides are not symmetric.
   *
   * **The card is open when it has news, and folded once attention moves on.**
   * The rail folds it whenever the broker sends a message, starts a call, or gets
   * a draft — a reply is arriving and the reply is the thing to read, not a
   * pinned card with a primary button sitting above the composer. Automatic
   * folding is therefore the ONLY automatic move: nothing opens this card except
   * news, so `autoFold` has no unfolding counterpart to argue with.
   *
   * What counts as news, and opens it even over a hand fold:
   * - a move completing, by any route (Done, a call, an email);
   * - a fresh queue arming;
   * - the broker asking for next actions again (`revive`).
   *
   * A hand fold outranks an automatic one, so `autoFold` leaves it alone rather
   * than re-stamping it. One field rather than two booleans, so the two can never
   * contradict each other.
   */
  collapsedBy: "user" | "auto" | null;
  /** Closed outright. A later `plan_my_day` arms a fresh queue and brings it back. */
  dismissed: boolean;
  /**
   * A finished move waiting to be shown as finished.
   *
   * The queue advances and reopens the moment a move completes, which put it
   * ahead of the story: the card announced the next move while the assistant was
   * still reporting the last one — a recap card and an expanding queue arriving
   * together, in the wrong order. So completion is recorded here and the rail
   * commits it once the turn has finished speaking (see `commitPending`).
   *
   * The queue's own state does NOT advance until then: the count in the header
   * and the move in the body change together, at the moment the broker is ready
   * to read them.
   */
  pending: { taskId: string; note: string; at: string } | null;
  /**
   * Every move already worked, oldest first — the broker's progress through the
   * queue, drawn into the transcript as folded "Completed next action" sections.
   *
   * Deliberately NOT reset by `arm`. The queue is a working surface and a fresh
   * `plan_my_day` replaces it; the log is history, and it belongs to the
   * transcript it is anchored into, which the new queue does not clear.
   */
  completed: CompletedAction[];

  arm: (key: string, items: DayPlanItem[]) => void;
  /**
   * Move the cursor by `delta`, wrapping at both ends. This is the card's
   * prev/next nav — pure browsing, so unlike `clear` it changes nothing about
   * the queue itself and leaves no note behind.
   */
  step: (delta: number) => void;
  /** Record a move as finished. Shown once {@link commitPending} runs. */
  clear: (taskId: string, note: string) => void;
  /**
   * Apply the finished move. `reveal` says whether the broker is still on the
   * turn it belongs to: true announces it and opens the card, false advances the
   * queue silently because the news has been overtaken.
   *
   * `anchorId` is the transcript message the completed record hangs under — the
   * rail's business, since it is the only caller that can see the messages.
   */
  commitPending: (reveal: boolean, anchorId?: string | null) => void;
  park: (taskId: string) => void;
  /** The call happened: release the park and finish the move. */
  resume: (note: string) => void;
  /** The call was abandoned: release the park and KEEP the move. */
  release: (note: string) => void;
  /** The broker's own fold/unfold, from the card's chevron. */
  setCollapsed: (collapsed: boolean) => void;
  /**
   * The rail's fold. Fold-ONLY, deliberately: nothing automatic opens this card
   * except news (see `collapsedBy`). No-op when the broker has folded it.
   */
  autoFold: () => void;
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
  pending: null as DayPlanQueueState["pending"],
};

export const useDayPlanQueue = create<DayPlanQueueState>((set, get) => ({
  ...EMPTY,
  completed: [],

  // `completed` is carried across deliberately — see the field's own note. It is
  // not in EMPTY, so the spread cannot silently take it with the rest.
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
    set((s) =>
      s.cleared.includes(taskId) ? s : { pending: { taskId, note, at: new Date().toISOString() } },
    ),

  commitPending: (reveal, anchorId = null) =>
    set((s) => {
      if (!s.pending) return s;
      const { taskId, note, at } = s.pending;
      const already = s.cleared.includes(taskId);
      const item = s.items.find((i) => i.taskId === taskId);
      const advanced = {
        cleared: already ? s.cleared : [...s.cleared, taskId],
        index: 0,
        pending: null,
        // Logged on the commit rather than on the completion, so the record
        // enters the transcript at the point the broker is actually shown it —
        // which is also the only point where the anchor message is known.
        // Guarded on `already` so a double commit can't log the same move twice.
        completed:
          already || !item
            ? s.completed
            : [...s.completed, { taskId, item, at, anchorId }],
      };
      // Overtaken: the broker has said something else since, so this is no longer
      // the answer to what they are looking at. The count catches up quietly and
      // the note is dropped rather than saved up to surprise them later — a card
      // reopening two turns on to report a move they finished before last asking
      // a question reads as the rail losing its place.
      if (!reveal) return { ...advanced, note: null };
      // Still their turn, so it is news: say what happened and open the card.
      return { ...advanced, note, collapsedBy: null };
    }),

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

  /**
   * The broker hung up before placing the call, so the move was never worked and
   * stays exactly where it was — same item, same cursor, nothing cleared.
   *
   * The card reopens even so: they clicked Call and came back, and a queue folded
   * behind a call that never happened leaves them with a stale header and a note
   * they cannot read. Returning from an abandoned call is a return to the queue.
   *
   * `index` is deliberately untouched: `remaining` has not changed, so the cursor
   * still points at the move they were about to make. Resetting it to 0 would
   * move them off it — the opposite of returning to the same move.
   */
  release: (note) => set({ parkedFor: null, note, collapsedBy: null }),

  resume: (note) => {
    const { parkedFor } = get();
    // `parkedFor` clears now — the call is over, so the card must stop standing
    // aside for it. Only the *visible* advance waits for `commitPending`.
    set((s) => ({
      parkedFor: null,
      pending:
        parkedFor && !s.cleared.includes(parkedFor)
          ? { taskId: parkedFor, note, at: new Date().toISOString() }
          : s.pending,
    }));
  },

  setCollapsed: (collapsed) => set({ collapsedBy: collapsed ? "user" : null }),

  autoFold: () =>
    set((s) => {
      // A hand fold is already stronger than ours, and re-stamping it as "auto"
      // would quietly demote it.
      if (s.collapsedBy !== null) return s;
      return { collapsedBy: "auto" };
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
      return { pending: { taskId: match.taskId, note, at: new Date().toISOString() } };
    }),
}));

/** Stable identity for a set of queue items. */
export function dayPlanKey(items: DayPlanItem[]): string {
  return items.map((i) => i.taskId).join("|");
}
