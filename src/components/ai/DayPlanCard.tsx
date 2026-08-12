import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkles, faCheck, faPhone } from "@fortawesome/pro-regular-svg-icons";
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

  const onOpenRecord = () => {
    if (!item) return;
    if (item.contactId) {
      router.navigate({ to: `/backoffice/contacts/${item.contactId}` as never });
    } else {
      router.navigate({ to: "/tasks" as never });
    }
  };

  // Only one slot renders: inline until a call detaches the queue, bottom after.
  if (slot === "inline" && (detached || (myKey !== null && q.key !== myKey))) return null;
  if (slot === "bottom" && (!detached || !q.key)) return null;

  // On the phone — the queue steps aside until the call wraps up.
  if (parkedFor) return null;

  // Every item worked — the queue is done.
  if (!item) {
    return (
      <div className="border rounded p-3 bg-white d-flex flex-column gap-2">
        <div className="d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faCheck} className="text-success" />
          <span className="fw-semibold">That's your day cleared.</span>
        </div>
        <div className="small text-muted">
          Nothing left in the queue. Want me to build a call list next?
        </div>
      </div>
    );
  }

  const firstName = item.contactName?.split(" ")[0];
  const canCall = item.isCall && !!item.contactId;

  return (
    <div className="border border-primary rounded p-3 bg-purple-heart-50 d-flex flex-column gap-2">
      {note && <div className="small text-muted fst-italic">{note}</div>}

      <div className="d-flex align-items-center gap-2">
        <FontAwesomeIcon icon={faSparkles} className="text-purple-heart-600" />
        <span className="fw-semibold small text-uppercase text-muted">Next Actions</span>
        {/* A step darker than the card's purple-heart-50 ground, so the count
            reads as a badge without introducing a second accent colour. */}
        <Badge variant="secondary" className="bg-purple-heart-200 text-purple-heart-800">
          {remaining.length} to clear
        </Badge>
      </div>

      <div className="fw-semibold">
        {isFirstItem ? `Start with ${item.headline}` : item.headline}
      </div>
      <div className="small text-body">{item.reason}</div>

      {/* Three slots, always: primary lead action, outline confirm, ghost defer.
          When the move is a call, `onCall` also lands on the contact's record —
          so folding "open record" into the primary loses nothing. */}
      <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
        {canCall ? (
          <Button size="sm" variant="primary" onClick={onCall}>
            <FontAwesomeIcon icon={faPhone} className="me-1" />
            Call {firstName ?? "now"}
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={onOpenRecord}>
            {firstName ? `Open ${firstName}'s record` : "Open task"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onDone}>
          <FontAwesomeIcon icon={faCheck} className="me-1" />
          Done
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => q.skip("Skipped, let me look again…")}
          disabled={remaining.length < 2}
        >
          Skip → next
        </Button>
      </div>
    </div>
  );
}
