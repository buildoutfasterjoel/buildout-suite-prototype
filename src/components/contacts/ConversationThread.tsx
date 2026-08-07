import type { ReactNode } from "react";
import {
  exactTime,
  shortDateTime,
  type TimelineAttachment,
  type TimelineThread,
} from "#/components/contacts/timeline";
import { AttachmentChip } from "#/components/contacts/AttachmentChip";
import {
  ThreadMessageFab,
  type ActionDispatch,
} from "#/components/contacts/TimelineActions";

/**
 * One attributed message: sender + exact time, then the body, with its own reply
 * FAB on hover. Exported because a standalone inbound reply on a non-thread row
 * renders in exactly this shape — an email is an email, and giving a lone reply
 * its own card treatment made the same content look like a different kind of
 * thing depending on how many messages happened to be in the conversation.
 */
export function ThreadMessage({
  sender,
  timestamp,
  body,
  attachments,
  onAction,
  children,
}: {
  sender: string;
  timestamp: string;
  body: string;
  /** Files that arrived on this message. */
  attachments?: TimelineAttachment[];
  onAction: ActionDispatch;
  /** The inline reply editor, when this is the message being replied to. */
  children?: ReactNode;
}) {
  return (
    <div className="tl-thread__msg">
      <div className="tl-thread__msg-head">
        <span className="tl-thread__msg-sender">{sender}</span>
        <time
          className="tl-thread__msg-time"
          dateTime={timestamp}
          title={exactTime(timestamp)}
        >
          {shortDateTime(timestamp)}
        </time>
      </div>
      <p className="tl-thread__msg-body">{body}</p>
      {attachments?.length ? (
        <div className="tl-attach">
          {attachments.map((a) => (
            <AttachmentChip key={a.name} attachment={a} />
          ))}
        </div>
      ) : null}
      {!children && <ThreadMessageFab onAction={onAction} />}
      {children}
    </div>
  );
}

/**
 * The expanded email thread: the messages *behind* the latest one, stacked newest
 * → oldest to match the timeline's own ordering. The latest sits above as the
 * row's content, so this list starts one back from it.
 *
 * On hover a message reveals its own reply / reply all / forward FAB, because in a
 * thread you answer a specific message, not the thread.
 *
 * Every message carries an exact timestamp rather than a relative one: inside a
 * thread the gap between two messages is the point, and "3w ago" collapses
 * messages minutes apart into the same string. Bodies are deliberately not
 * clamped — the reader opened the thread to read it.
 */
export function ConversationThread({
  thread,
  onAction,
  replyingToId,
  replyEditor,
}: {
  thread: TimelineThread;
  onAction: ActionDispatch;
  /** Message the inline editor is attached to, so it renders in context. */
  replyingToId?: string | null;
  replyEditor?: ReactNode;
}) {
  // The newest message is the row's own content, above the toggle — repeating it
  // here made a two-message thread look like it held the same email twice.
  const older = thread.messages.slice(0, -1).reverse();
  return (
    <div className="tl-thread">
      {older.map((m) => (
        <ThreadMessage
          key={m.id}
          sender={m.direction === "out" ? "You" : m.sender}
          timestamp={m.timestamp}
          body={m.body}
          attachments={m.attachments}
          onAction={(id) => onAction(id, m.id)}
        >
          {replyingToId === m.id ? replyEditor : undefined}
        </ThreadMessage>
      ))}
    </div>
  );
}
