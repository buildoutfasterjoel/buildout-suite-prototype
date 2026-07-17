import { relativeTime, type TimelineThread } from "#/components/contacts/timeline";

/**
 * The expanded email thread — stacked messages oldest → newest, each marked by
 * direction (You vs the contact). Rendered inline (accordion) beneath the
 * Conversation card; never a blocking modal.
 */
export function ConversationThread({ thread }: { thread: TimelineThread }) {
  return (
    <div className="tl-thread">
      {thread.messages.map((m) => (
        <div key={m.id} className={`tl-thread__msg tl-thread__msg--${m.direction}`}>
          <div className="tl-thread__msg-head">
            <span className="fw-semibold">{m.direction === "out" ? "You" : m.sender}</span>
            <span className="tl-thread__msg-time">{relativeTime(m.timestamp)}</span>
          </div>
          <p className="tl-thread__msg-body">{m.body}</p>
        </div>
      ))}
    </div>
  );
}
