import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faReply } from "@fortawesome/pro-regular-svg-icons";
import type { TimelineReply } from "#/components/contacts/timeline";

/**
 * An inbound reply nested under a sent email — replier + delay, an AI sentiment
 * tag (color-coded by tone), and the reply body. The sentiment write-back and
 * one-click commitment affordances are left for a later pass.
 */
export function ReplyCard({ reply }: { reply: TimelineReply }) {
  return (
    <div className="tl-replycard">
      <div className="tl-replycard__head">
        <FontAwesomeIcon icon={faReply} className="tl-replycard__icon" />
        <span className="fw-semibold">{reply.replier} replied</span>
        {reply.delay && <span className="tl-replycard__delay">· {reply.delay}</span>}
        {reply.sentiment && (
          <span
            className={`tl-sentiment tl-sentiment--${reply.sentimentTone ?? "neutral"}`}
          >
            {reply.sentiment}
          </span>
        )}
      </div>
      <p className="tl-replycard__body">{reply.body}</p>
    </div>
  );
}
