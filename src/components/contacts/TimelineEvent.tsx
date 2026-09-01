import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faThumbtack,
  faPaperclip,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import { AttachmentChip } from "#/components/contacts/AttachmentChip";
import { getListing } from "#/data/store";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { IconBadge } from "#/components/contacts/IconBadge";
import { ContactStageBadge } from "#/components/contacts/ContactStageBadge";
import { ClampText } from "#/components/contacts/ClampText";
import { ReplyComposer } from "#/components/contacts/ReplyComposer";
import {
  ConversationThread,
  ThreadMessage,
} from "#/components/contacts/ConversationThread";
import {
  TimelineActionBar,
  TimelineFab,
  type ActionDispatch,
} from "#/components/contacts/TimelineActions";
import {
  TYPE_CONFIG,
  relativeTime,
  exactTime,
  durationLabel,
  hiddenMessageCount,
  type TimelineEvent as TimelineEventData,
} from "#/components/contacts/timeline";

/**
 * What an inquiry's reply is *about*: the listing it came in on. The row's own
 * headline ("Inquired about Apex Commons via Brochure link") is how the inquiry
 * announces itself, not a subject line anyone would send — so the editor seeds
 * "Re: Apex Commons" from the associated deal, falling back to the headline only
 * if a row somehow carries no association.
 */
function inquirySubject(event: TimelineEventData): string {
  const deal = (event.associations ?? []).find((a) => a.type === "deal");
  return deal?.label ?? event.subject ?? event.title ?? TYPE_CONFIG[event.type].defaultTitle;
}

/**
 * A stage-change reason names the deal that caused it ("The associated deal
 * Sunridge Plaza has been updated to Active…"). Link that name in place rather
 * than repeating it as a separate association chip — the sentence is where it
 * belongs, and two copies of the same link on one row reads as a mistake.
 */
function linkifyDeal(
  text: string,
  assoc?: { label: string; id?: string },
): ReactNode {
  if (!assoc?.id || !text.includes(assoc.label)) return text;
  const deal = getListing(assoc.id);
  if (!deal) return text;
  const [before, ...rest] = text.split(assoc.label);
  return (
    <>
      {before}
      <Link {...dealCardLinkProps(deal)} className="tl-row__deal-link">
        {assoc.label}
      </Link>
      {rest.join(assoc.label)}
    </>
  );
}

/**
 * The single row that renders every timeline event type by composition.
 *
 * Anatomy (mirrors the Figma layer names): a Rail carrying the channel bubble
 * and the connector, then a Body of Head (actors + inline time, then the subject
 * line with its associations), Content (clamped body, attachments, thread), and
 * — only while the row still needs attention — the action bar. The hover FAB
 * floats above the row's top edge.
 *
 * State overlays are boolean props (pinned / replyOpen / threadOpen); every
 * action flows out through one `onAction` dispatch, so the row has no
 * side-effects of its own.
 */
export function TimelineEvent({
  event,
  attention,
  pinned,
  replyOpen,
  replyMessageId,
  threadOpen,
  replyTo,
  arriving = false,
  onAction,
  onReplySend,
  onReplyCancel,
}: {
  event: TimelineEventData;
  /** Row still needs action (missed call / unreplied email / open inquiry). */
  attention: boolean;
  pinned: boolean;
  replyOpen: boolean;
  /** Which thread message the editor hangs under, when the row is a thread. */
  replyMessageId?: string | null;
  threadOpen: boolean;
  /** Who a reply from this row would go to — fills the composer's To chip. */
  replyTo: { name: string; email?: string; initials: string };
  /** Just landed (simulated inbound) — plays a one-shot entrance highlight. */
  arriving?: boolean;
  onAction: ActionDispatch;
  /** `subject` is set only by an inquiry's editor, which owns an editable one. */
  onReplySend: (text: string, subject?: string) => void;
  onReplyCancel: () => void;
}) {
  const config = TYPE_CONFIG[event.type];
  const headline = event.subject ?? event.title ?? config.defaultTitle;

  // The action bar shows only while the row still needs attention (unreplied
  // email, missed call, open inquiry, live thread); resolving it removes the
  // reply/call-back options. Read-only system rows never get one. An event can
  // carry its own bar (e.g. "Start a Deal") over the type default.
  const actionBar = event.actionBar ?? config.actionBar;
  const isActionable = !config.readOnly && !!actionBar?.primary && attention;

  const isThread = event.type === "conversation" && !!event.thread;
  const latestMessage = event.thread?.messages.at(-1);
  // Everything the row has to say, as one clamped block. Bullet blocks, a plain
  // body and a thread's latest message all read as content, so they clamp
  // together rather than each growing the row on its own.
  const content = isThread ? null : (
    <>
      {event.blocks?.map((block, i) => (
        <div key={i} className="tl-block">
          {block.items.length === 1 ? (
            <p className="tl-row__text">{block.items[0]}</p>
          ) : (
            <ul className="tl-block__list">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {event.body && (
        <p className="tl-row__text">
          {linkifyDeal(event.body, event.associations?.[0])}
        </p>
      )}
    </>
  );
  const hasContent = isThread || !!event.body || !!event.blocks?.length;

  return (
    <article
      className={`tl-row${arriving ? " tl-row--arriving" : ""}`}
      data-type={event.type}
      data-pinned={pinned || undefined}
    >
      <div className="tl-row__rail">
        <span className="tl-row__icon-wrap">
          <IconBadge icon={config.icon} attention={attention} />
        </span>
        <span className="tl-row__connector" aria-hidden="true" />
      </div>

      <div className="tl-row__body">
        <div className="tl-row__head">
          {/* Actors and the timestamp share one line — the time is part of "who
              did what, when", not a right-aligned column of its own. */}
          <div className="tl-row__actors">
            <span className="tl-row__actor">{event.actor.name}</span>
            {event.contact && (
              <>
                <span className="tl-row__arrow">›</span>
                <span className="tl-row__recipient">{event.contact.name}</span>
              </>
            )}
            <span className="tl-row__meta">
              <Tooltip>
                <Tooltip.Trigger
                  render={<span className="tl-row__time">{relativeTime(event.timestamp)}</span>}
                />
                <Tooltip.Content>{exactTime(event.timestamp)}</Tooltip.Content>
              </Tooltip>
              {event.durationSecs != null && (
                <span className="tl-row__duration">
                  ({durationLabel(event.durationSecs)})
                </span>
              )}
              {pinned && (
                <FontAwesomeIcon
                  icon={faThumbtack}
                  className="tl-row__flag"
                  title="Pinned"
                />
              )}
            </span>
          </div>

          <div className="tl-row__context">
            {/* Truncates rather than wrapping (see the SCSS), so the full text
                has to stay reachable on hover. */}
            <span className="tl-row__subject" title={headline}>
              {event.hasAttachment && (
                <FontAwesomeIcon icon={faPaperclip} className="tl-row__clip" />
              )}
              <span>{headline}</span>
              {/* One badge = the stage a contact arrived as; two = what changed. */}
              {event.stageChange && (
                <span className="tl-row__stages">
                  {event.stageChange.from && (
                    <>
                      <ContactStageBadge relationship={event.stageChange.from} />
                      <span className="tl-row__stages-arrow">›</span>
                    </>
                  )}
                  <ContactStageBadge relationship={event.stageChange.to} />
                </span>
              )}
            </span>
            {/* Deal / property links, separated from the subject by a rule so the
                two read as one line without either claiming the other's weight. */}
            {event.associations && event.associations.length > 0 && !event.stageChange && (
              <span className="tl-row__assoc">
                <span className="tl-row__assoc-sep" aria-hidden="true">
                  |
                </span>
                {event.associations.map((a, i) => {
                  // A space opens its own page, nested under its building, so the
                  // destination has to be resolved from the deal rather than assumed.
                  const deal = a.id ? getListing(a.id) : undefined;
                  return deal ? (
                    <Link
                      key={i}
                      {...dealCardLinkProps(deal)}
                      className="tl-row__deal-link"
                    >
                      {a.label}
                    </Link>
                  ) : (
                    <span key={i} className="tl-row__deal-link">
                      {a.label}
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        </div>

        {(hasContent || !!event.attachments?.length) && (
          <div className="tl-row__content">
            {isThread && event.thread ? (
              <>
                {/* The latest message is the row's content and stays put whether
                    the thread is open or shut — expanding reveals what came
                    *before* it, so hiding it there took away the message the
                    reader was actually looking at. Clamped while collapsed; once
                    open, the whole exchange reads unclamped. */}
                {threadOpen ? (
                  <p className="tl-row__text">{event.thread.latestBody}</p>
                ) : (
                  <ClampText>{event.thread.latestBody}</ClampText>
                )}
                {/* Only the latest message's files — the row is that message.
                    Older attachments travel with their own message in the thread,
                    so you can tell which email something arrived on. */}
                {latestMessage?.attachments?.length ? (
                  <div className="tl-attach">
                    {latestMessage.attachments.map((a) => (
                      <AttachmentChip key={a.name} attachment={a} />
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="tl-link tl-link--toggle"
                  aria-expanded={threadOpen}
                  onClick={() => onAction("View full thread")}
                >
                  <FontAwesomeIcon
                    icon={threadOpen ? faChevronDown : faChevronRight}
                  />
                  {threadOpen
                    ? "Hide thread"
                    : `View full thread (${hiddenMessageCount(event.thread)})`}
                </button>
                {threadOpen && (
                  <ConversationThread
                    thread={event.thread}
                    onAction={onAction}
                    replyingToId={replyOpen ? replyMessageId : null}
                    replyEditor={
                      <ReplyComposer
                        subject={event.subject ?? event.title}
                        recipientName={replyTo.name}
                        recipientEmail={replyTo.email}
                        recipientInitials={replyTo.initials}
                        onSend={onReplySend}
                        onCancel={onReplyCancel}
                      />
                    }
                  />
                )}
              </>
            ) : (
              <>
                {hasContent && <ClampText>{content}</ClampText>}
                {/* A lone inbound reply reads as a thread of one, not as a
                    differently-shaped card. */}
                {event.reply && (
                  <div className="tl-thread">
                    <ThreadMessage
                      sender={event.reply.replier}
                      timestamp={event.reply.timestamp ?? event.timestamp}
                      body={event.reply.body}
                      onAction={onAction}
                    />
                  </div>
                )}
                {event.attachments && event.attachments.length > 0 && (
                  <div className="tl-attach">
                    {event.attachments.map((a) => (
                      <AttachmentChip key={a.name} attachment={a} />
                    ))}
                  </div>
                )}
              </>
            )}

          </div>
        )}

        {/* The editor replaces the action bar rather than stacking under it —
            once you're writing the reply, "Reply" is no longer an offer. Cancel
            brings the bar back. */}
        {isActionable && actionBar && !replyOpen && (
          <TimelineActionBar actionBar={actionBar} onAction={onAction} />
        )}

        {/* Anchored replies render under their message inside the thread (see
            ConversationThread); an un-anchored one — from the action bar or the
            row's FAB — sits at the end of the row, which puts it below the thread
            when that's expanded. Keying this on `threadOpen` instead made the
            editor vanish the moment you opened the thread you were replying to. */}
        {replyOpen && !replyMessageId && (
          <ReplyComposer
            // An inquiry is not a message to reply into — it arrived through a
            // form, and answering it means writing a new email about the listing.
            // So its editor gets an editable subject naming that listing, rather
            // than quoting a thread it doesn't belong to.
            {...(event.type === "inquiry"
              ? { defaultSubject: `Re: ${inquirySubject(event)}` }
              : { subject: event.subject ?? event.title })}
            recipientName={replyTo.name}
            recipientEmail={replyTo.email}
            recipientInitials={replyTo.initials}
            onSend={onReplySend}
            onCancel={onReplyCancel}
          />
        )}
      </div>

      <TimelineFab type={event.type} pinned={pinned} onAction={onAction} />
    </article>
  );
}
