import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";
import { ChatSection } from "#/components/ai/chat/ChatSection";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { getListing } from "#/data/store";
import type { CompletedAction } from "#/components/ai/useDayPlanQueue";

/**
 * A move the broker worked, folded into the transcript where they worked it
 * (Figma 262:19694 collapsed, 265:19858 open).
 *
 * The Next Actions card is a working surface — one move at a time, and a move
 * that is done leaves it. That left no trace of a day's progress anywhere: the
 * count in the header went down and the work itself vanished. This is the other
 * half: each completion drops a folded line into the conversation, so scrolling
 * back through the transcript reads as a record of the day.
 *
 * Folded by default, deliberately. It is a receipt, not news — the queue's own
 * note ("Marked done. Next up…") already says it happened, and eight of these
 * open would bury the turns between them.
 *
 * NO activity line. The design (265:19858) opens with the work that closed the
 * move — "EMAIL TO ROSA ➤ Sent Aug 26, 3:22 PM" — and directly under a sent-email
 * receipt that is the same sentence twice, in the same words, at the same
 * minute. Absorbing the receipt into this block was tried and reverted: standing
 * the receipt down cost the transcript its steadiest element and left the rail
 * jumping in height as sections opened and closed. Dropping the line instead
 * keeps the receipt doing that work, and leaves this block saying the one thing
 * nothing else does — *which queued move* the work finished.
 *
 * Styled as past work rather than as a card, the same treatment as the
 * sent-email receipt: a hairline down the left edge, no fill and no gradient.
 * The gradient ground in this rail means "Otto's answer, act on it", and a
 * record of work already finished is the opposite of that.
 */
export function CompletedActionCard({ entry }: { entry: CompletedAction }) {
  const router = useRouter();
  const { item } = entry;
  const first = item.contactName?.split(" ")[0] ?? null;

  /**
   * The way back to the record. The contact first — the move was outreach to a
   * person, and that is where it now sits on a timeline. A move that named no
   * contact falls back to its deal, routed through `dealCardLinkProps` because a
   * space deal lives nested under its building.
   */
  const deal = !item.contactId && item.dealId ? getListing(item.dealId) : undefined;

  return (
    <ChatSection label="Completed next action" defaultOpen={false}>
      <div className="assistant-completed">
        <div className="assistant-completed__headline">{item.headline}</div>
        <div className="assistant-completed__reason">{item.reason}</div>

        {item.contactId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.navigate({
                to: "/backoffice/contacts/$contactId",
                params: { contactId: item.contactId as string },
              })
            }
          >
            View {first ?? "contact"}
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </Button>
        ) : deal ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.navigate(dealCardLinkProps(deal) as never)}
          >
            View deal
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </Button>
        ) : null}
      </div>
    </ChatSection>
  );
}
