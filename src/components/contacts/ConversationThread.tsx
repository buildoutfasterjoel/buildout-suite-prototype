import {
  exactTime,
  shortDateTime,
  type TimelineThread,
} from "#/components/contacts/timeline";
import {
  ThreadMessageFab,
  type ActionDispatch,
} from "#/components/contacts/TimelineActions";

/**
 * The expanded email thread — stacked newest → oldest, matching the timeline's
 * own ordering. Each message is a plain attributed block (sender + exact time,
 * then the body); on hover it reveals its own reply / reply all / forward FAB,
 * because in a thread you answer a specific message, not the thread.
 *
 * Every message carries an exact timestamp rather than a relative one: inside a
 * thread the gap between two messages is the point, and "3w ago" collapses
 * messages minutes apart into the same string. Bodies are deliberately not
 * clamped — the reader opened the thread to read it.
 */
export function ConversationThread({
  thread,
  onAction,
}: {
  thread: TimelineThread;
  onAction: ActionDispatch;
}) {
  return (
    <div className="tl-thread">
      {[...thread.messages].reverse().map((m) => (
        <div key={m.id} className="tl-thread__msg">
          <div className="tl-thread__msg-head">
            <span className="tl-thread__msg-sender">
              {m.direction === "out" ? "You" : m.sender}
            </span>
            <time
              className="tl-thread__msg-time"
              dateTime={m.timestamp}
              title={exactTime(m.timestamp)}
            >
              {shortDateTime(m.timestamp)}
            </time>
          </div>
          <p className="tl-thread__msg-body">{m.body}</p>
          <ThreadMessageFab onAction={onAction} />
        </div>
      ))}
    </div>
  );
}
