import {
  exactTime,
  groupThreadMessages,
  shortDateTime,
  type TimelineThread,
} from "#/components/contacts/timeline";

/**
 * The expanded email thread — stacked newest → oldest (most recent on top, to
 * match the timeline's ordering), each run marked by direction (You vs the
 * contact). Rendered inline (accordion) beneath the Conversation card; never a
 * modal.
 *
 * Consecutive messages from one sender share a single bubble and attribution, so
 * a follow-up reads as a continuation rather than a second exchange, and every
 * message carries its own exact timestamp — inside a thread the gap between two
 * messages is the point, and a relative label ("3w ago") flattens it away.
 */
export function ConversationThread({ thread }: { thread: TimelineThread }) {
  // Reverse first, then group: adjacency has to be computed in display order.
  const groups = groupThreadMessages([...thread.messages].reverse());
  return (
    <div className="tl-thread">
      {groups.map((group) => (
        <div
          key={group.messages[0].id}
          className={`tl-thread__group tl-thread__group--${group.direction}`}
        >
          <div className="tl-thread__group-head fw-semibold">
            {group.direction === "out" ? "You" : group.sender}
          </div>
          {group.messages.map((m) => (
            <div key={m.id} className="tl-thread__msg">
              <p className="tl-thread__msg-body">{m.body}</p>
              <time
                className="tl-thread__msg-time"
                dateTime={m.timestamp}
                title={exactTime(m.timestamp)}
              >
                {shortDateTime(m.timestamp)}
              </time>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
