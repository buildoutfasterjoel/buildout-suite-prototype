import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faArrowLeft,
  faArrowRight,
  faChevronDown,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
// Solid: the same finished-work check the task list uses (see ActionPlanChecklist).
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";
import type { DayPlanItem } from "#/ai/dayPlan";
import { listAllTasks } from "#/data/selectors";
import { getContact } from "#/data/store";
import { callFlow } from "#/components/call/callFlow";
import { useCallStore } from "#/components/call/useCallStore";
import { usePendingCallLog } from "#/components/call/usePendingCallLog";
import { composeCallHandoff } from "#/components/call/callHandoff";
import { toggleTaskCompleted } from "#/components/tasks/taskCompletion";
import { useAssistant } from "#/ai/useAssistant";
import { useDayPlanQueue, dayPlanKey } from "#/components/ai/useDayPlanQueue";

/**
 * The co-pilot queue: one move at a time from `plan_my_day`, with a running
 * "N to clear" count. The broker works the top item (call / open the record),
 * marks it done, or skips to the next — so "what should I do today" walks the
 * day instead of printing a list they then have to act on themselves.
 *
 * Mounted twice, and only one of them draws:
 * - `arm` sits at the tool result that produced the queue and renders NOTHING.
 *   Its whole job is to arm the store, which has to happen from the transcript
 *   because that is where the items arrive.
 * - `pinned` sits above the composer and is the card the broker actually sees.
 *
 * Pinned from the moment it is armed, not just after a call detaches it: asking
 * for next actions is the broker saying they mean to work them, so the surface
 * belongs by the composer rather than scrolling away with the message that
 * produced it.
 *
 * Three states, per Figma 259:19103 (open) and 259:19166 (collapsed): open,
 * folded to its header, or closed outright. Collapse and dismissal live in the
 * store rather than in local state, so neither is undone by a re-render — and
 * both reset when a later `plan_my_day` arms a fresh queue.
 */
export function DayPlanCard({
  items,
  slot,
}: {
  /** Required for the `arm` slot, which is the only thing that uses them. */
  items?: DayPlanItem[];
  slot: "arm" | "pinned";
}) {
  const router = useRouter();
  const q = useDayPlanQueue();
  const { index, cleared, parkedFor, note, collapsedBy, dismissed } = q;
  const collapsed = collapsedBy !== null;

  /**
   * The `arm` slot owns arming, and ONLY arming.
   *
   * Keyed on `myKey` — a string derived from the items — rather than on `items`
   * itself, whose identity changes whenever the transcript is rebuilt. It used to
   * also `revive()` here when the key already matched, to honour a re-ask; that
   * turned every incidental re-render into an unfold, so the card sprang open
   * again the moment anything was sent. Reviving belongs to the rail, which
   * recognises a deliberate re-ask from the broker's own words and is
   * edge-triggered on the message id, so it cannot misfire on a re-render.
   */
  const myKey = items ? dayPlanKey(items) : null;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (slot !== "arm" || !myKey) return;
    const state = useDayPlanQueue.getState();
    // Same queue asked for again: keep the progress. Re-arming would throw away
    // everything already worked.
    if (state.key === myKey) return;
    if (itemsRef.current) state.arm(myKey, itemsRef.current);
  }, [slot, myKey]);

  const callPhase = useCallStore((s) => s.phase);
  const recap = useCallStore((s) => s.recap);
  const callTarget = useCallStore((s) => s.target);
  const wrapping = useCallStore((s) => s.wrapping);
  const pendingLog = usePendingCallLog((s) => s.pending !== null);
  /**
   * Guards the resume against firing on the same tick the call starts: `phase` is
   * still whatever it was until `callFlow.open` lands, so "idle means finished"
   * is only true once we've actually seen the call go live.
   */
  const sawLiveCallRef = useRef(false);

  useEffect(() => {
    if (!parkedFor) {
      sawLiveCallRef.current = false;
      return;
    }
    if (callPhase !== "idle") {
      sawLiveCallRef.current = true;
      return;
    }
    // A recap means the call happened and was logged; falling back to "the call
    // flow went idle again" keeps a cancelled call from stranding the queue.
    if (!recap && !sawLiveCallRef.current) return;
    /**
     * Did the call actually happen? Four ways of saying yes, because none of them
     * is available at every moment this runs:
     * - a recap is on the store (the log is confirmed);
     * - a log is pending (including a No Answer, which is a placed call);
     * - the recap is still being written (`wrapping`);
     * - `callTarget` survives `endCall` and is cleared by `hangUp`.
     *
     * Only a hang-up before the call was placed leaves all four false, and that
     * move was never worked — so it goes back on the queue untouched rather than
     * being cleared as though it had been done.
     */
    const happened = !!recap || !!callTarget || wrapping || pendingLog;
    const q = useDayPlanQueue.getState();
    if (happened) q.resume("Call logged. Next up…");
    else q.release("No call placed — still on your list.");
  }, [parkedFor, callPhase, recap, callTarget, wrapping, pendingLog]);

  /**
   * Adopt a call the broker started somewhere else.
   *
   * The card's own Call button parks the item before dialing, which is what
   * eventually clears it. Typing "call rosa" goes through `start_call` instead
   * and never touched the queue — so the broker made the call and the move
   * stayed on the list, asking to be done again. Parking on any live call whose
   * contact matches a queued item routes both paths through the same finish.
   *
   * Only while nothing is parked, so this can't hijack a call the card itself
   * started, and only for the matching item — a call to someone who isn't in the
   * queue leaves it alone.
   */
  useEffect(() => {
    if (parkedFor || callPhase === "idle" || !callTarget) return;
    const state = useDayPlanQueue.getState();
    const match = state.items.find(
      (i) => i.contactId === callTarget.contactId && !state.cleared.includes(i.taskId),
    );
    if (match) state.park(match.taskId);
  }, [parkedFor, callPhase, callTarget]);

  /**
   * True for one beat after a new queue arms, which is what plays the card's
   * entry animation. Keyed off the queue's identity rather than mount, because
   * the pinned card never unmounts between queues — it would otherwise animate
   * once per session and never again.
   */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!q.key) return;
    setArmed(true);
    const t = setTimeout(() => setArmed(false), 400);
    return () => clearTimeout(t);
  }, [q.key]);

  const remaining = q.items.filter((i) => !cleared.includes(i.taskId));
  const item = remaining[Math.min(index, remaining.length - 1)];
  /** Only the top of the queue is what the broker should "start with". */
  const isFirstItem = !!item && item.taskId === q.items[0]?.taskId;

  const onDone = () => {
    if (!item) return;
    // The pinned signal has no task record, so it only leaves the queue.
    if (item.kind === "task") {
      // Go through the Tasks page's own helper so deal tasks and standalone
      // tasks both complete correctly — and the broker gets the same undo toast.
      const task = listAllTasks().find((t) => t.id === item.taskId);
      if (task && !task.completed) toggleTaskCompleted(task);
    }
    q.clear(item.taskId, "Marked done. Next up…");
  };

  const onCall = () => {
    if (!item?.contactId) return;
    const contact = getContact(item.contactId);
    if (!contact) return;
    // Narrate the hand-off, then step out of the way: while the broker is on the
    // call, the queue is not what they're looking at.
    useAssistant.getState().say(composeCallHandoff(contact));
    q.park(item.taskId);
    callFlow.open(contact);
    router.navigate({ to: `/backoffice/contacts/${item.contactId}` as never });
  };

  /** Work the move: the task list, which is where a non-call move gets done. */
  const onOpenTask = () => {
    if (!item) return;
    router.navigate({ to: "/tasks" as never });
  };

  /**
   * The record the move hangs off — the secondary action, and the broker's
   * reflex before acting: read the person before you ring them.
   */
  const onViewRecord = () => {
    if (!item?.contactId) return onOpenTask();
    router.navigate({ to: `/backoffice/contacts/${item.contactId}` as never });
  };

  // The `arm` slot exists only for the effect above — it never draws.
  if (slot === "arm") return null;
  if (!q.key || dismissed) return null;

  // NOT hidden during a call any more. It used to vanish while `parkedFor` was
  // set, which made sense when the card sat in the transcript and a call scrolled
  // it away regardless. Pinned above the composer it should stay put — the rail
  // folds it to its header for the duration instead (a live call is another
  // surface holding the floor, see `competingCardLive`), so the queue keeps its
  // place and its count without offering to call someone the broker is already
  // talking to.

  const firstName = item?.contactName?.split(" ")[0];
  const canCall = !!item?.isCall && !!item.contactId;
  const position = Math.min(index, remaining.length - 1) + 1;

  /**
   * The header, which is all there is when collapsed (Figma 259:19166): the fold
   * toggle and the wordmark, the queue's position, then browse and close. The
   * arrows browse *without* touching the queue — "Done" is the only control that
   * removes a move, and the × puts the whole card away.
   */
  const header = (
    <div className="assistant-next-actions__header">
      <button
        type="button"
        className="assistant-next-actions__toggle"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand next actions" : "Collapse next actions"}
        onClick={() => q.setCollapsed(!collapsed)}
      >
        {/* One icon rotated rather than two swapped, so the fold can animate —
            the same convention (and timing) as the overview accordions. */}
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`assistant-next-actions__chevron${collapsed ? "" : " assistant-next-actions__chevron--open"}`}
        />
        <span className="assistant-next-actions__title">Next Actions</span>
      </button>
      {item && (
        <span className="assistant-next-actions__count">
          {position} of {remaining.length}
        </span>
      )}
      <div className="assistant-next-actions__nav">
        {item && (
          <>
            <button
              type="button"
              className="assistant-next-actions__arrow"
              aria-label="Previous action"
              onClick={() => q.step(-1)}
              disabled={remaining.length < 2}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <button
              type="button"
              className="assistant-next-actions__arrow"
              aria-label="Next action"
              onClick={() => q.step(1)}
              disabled={remaining.length < 2}
            >
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </>
        )}
        <button
          type="button"
          className="assistant-next-actions__arrow"
          aria-label="Close next actions"
          onClick={() => q.dismiss()}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    </div>
  );

  /**
   * The fold. The body stays mounted and is clipped to nothing rather than
   * unmounted, because a height transition needs something to transition — see
   * `__fold` in the stylesheet.
   */
  const fold = (children: ReactNode) => (
    <div className="assistant-next-actions" data-armed={armed || undefined}>
      {header}
      {/* `inert` as well as `aria-hidden`: the body is clipped rather than
          unmounted so the fold can animate, and clipping alone leaves its
          buttons reachable by keyboard — a folded card would otherwise hand a
          "Call" button to anyone tabbing through, mid-call included. */}
      <div
        className="assistant-next-actions__fold"
        data-open={!collapsed}
        aria-hidden={collapsed}
        inert={collapsed}
      >
        <div>
          <div className="assistant-next-actions__body">{children}</div>
        </div>
      </div>
    </div>
  );

  // Every item worked. The card stays until the broker closes it — pinned above
  // the composer, "that's your day cleared" is the surface reporting itself
  // finished, and the × in the header is how they put it away.
  if (!item) {
    return fold(
      <div className="d-flex align-items-start gap-2">
        <FontAwesomeIcon icon={faCircleCheck} className="text-success mt-1" />
        <div>
          <span className="fw-semibold">That's your day cleared.</span>{" "}
          <span className="text-body">Want me to build a call list next?</span>
        </div>
      </div>,
    );
  }

  return fold(
    <>
      {note && <div className="small text-muted fst-italic">{note}</div>}
        <div className="assistant-next-actions__headline">
          {isFirstItem ? `Start with ${item.headline}` : item.headline}
        </div>
        <div className="assistant-next-actions__reason">{item.reason}</div>

        {/* Three slots, always: work the move, look at what it hangs off, or
            declare it handled. The middle one is the record — the broker's
            reflex before acting is to check who they're about to call. */}
        <div className="assistant-next-actions__actions">
          {canCall ? (
            <Button size="sm" variant="primary" onClick={onCall}>
              <FontAwesomeIcon icon={faPhone} />
              Call {firstName ?? "now"}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={onOpenTask}>
              Open task
            </Button>
          )}
          {/* Only when there's actually a record behind the move — a standalone
              task has nothing to view that "Open task" hasn't already opened. */}
          {item.contactId && (
            <Button size="sm" variant="outline" onClick={onViewRecord}>
              View {firstName ?? "record"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDone}>
            Done
          </Button>
        </div>
    </>,
  );
}
