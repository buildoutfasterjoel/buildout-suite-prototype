import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSparkles,
  faPhone,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
// Solid: the same finished-work check the task list uses (see ActionPlanChecklist).
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";
import type { DayPlanItem } from "#/ai/dayPlan";
import { listAllTasks } from "#/data/selectors";
import { getContact } from "#/data/store";
import { callFlow } from "#/components/call/callFlow";
import { useCallStore } from "#/components/call/useCallStore";
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
 * Rendered in two slots, with {@link useDayPlanQueue} deciding which is live:
 * `inline` sits under its checklist in the transcript, and `bottom` sits at the
 * end of the chat. Taking a call switches to `bottom`, so the queue comes back
 * below the hand-off and the recap instead of back up in the history.
 */
export function DayPlanCard({
  items,
  slot,
}: {
  /** Required for the inline slot, which arms the queue. */
  items?: DayPlanItem[];
  slot: "inline" | "bottom";
}) {
  const router = useRouter();
  const q = useDayPlanQueue();
  const { index, cleared, parkedFor, note, detached } = q;

  // The inline card owns arming: it is rendered from the tool result that
  // produced the queue. A later ask arms a new key and this one stands down.
  const myKey = items ? dayPlanKey(items) : null;
  useEffect(() => {
    if (slot !== "inline" || !items || !myKey) return;
    if (useDayPlanQueue.getState().key === myKey) return;
    useDayPlanQueue.getState().arm(myKey, items);
  }, [slot, items, myKey]);

  const callPhase = useCallStore((s) => s.phase);
  const recap = useCallStore((s) => s.recap);
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
    useDayPlanQueue
      .getState()
      .resume(recap ? "Call logged. Next up…" : "Back to your queue. Next up…");
  }, [parkedFor, callPhase, recap]);

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

  // Only one slot renders: inline until a call detaches the queue, bottom after.
  if (slot === "inline" && (detached || (myKey !== null && q.key !== myKey))) return null;
  if (slot === "bottom" && (!detached || !q.key)) return null;

  // On the phone — the queue steps aside until the call wraps up.
  if (parkedFor) return null;

  // Every item worked — the queue is done.
  if (!item) {
    return (
      // No card: an empty queue is finished work, and finished work in this rail
      // reads as a line of prose (see `ChatSection`).
      <div className="d-flex align-items-start gap-2">
        <FontAwesomeIcon icon={faCircleCheck} className="text-success mt-1" />
        <div>
          <span className="fw-semibold">That's your day cleared.</span>{" "}
          <span className="text-body">Want me to build a call list next?</span>
        </div>
      </div>
    );
  }

  const firstName = item.contactName?.split(" ")[0];
  const canCall = item.isCall && !!item.contactId;
  const position = Math.min(index, remaining.length - 1) + 1;

  return (
    <div className="assistant-next-actions">
      {/* Header (Figma 193:4698): the gradient mark and wordmark on the left, the
          queue's position on the right. The nav browses the queue *without*
          touching it — "Done" is the only control that removes a move. */}
      <div className="assistant-next-actions__header">
        <FontAwesomeIcon icon={faSparkles} className="assistant-next-actions__mark" />
        <span className="assistant-next-actions__title">Next Actions</span>
        <div className="assistant-next-actions__nav">
          <button
            type="button"
            className="assistant-next-actions__arrow"
            aria-label="Previous action"
            onClick={() => q.step(-1)}
            disabled={remaining.length < 2}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span className="assistant-next-actions__count">
            {position} of {remaining.length}
          </span>
          <button
            type="button"
            className="assistant-next-actions__arrow"
            aria-label="Next action"
            onClick={() => q.step(1)}
            disabled={remaining.length < 2}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>

      <div className="assistant-next-actions__body">
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
      </div>
    </div>
  );
}
