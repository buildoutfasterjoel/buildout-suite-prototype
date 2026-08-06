import { Link } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faUsers,
  faThumbtack,
  faPaperclip,
  faChevronDown,
  faChevronRight,
  faDownload,
  faFile,
  faFilePdf,
  faFileSpreadsheet,
} from "@fortawesome/pro-regular-svg-icons";
import { getListing } from "#/data/store";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { IconBadge } from "#/components/contacts/IconBadge";
import { ClampText } from "#/components/contacts/ClampText";
import { ReplyCard } from "#/components/contacts/ReplyCard";
import { ReplyComposer } from "#/components/contacts/ReplyComposer";
import { ConversationThread } from "#/components/contacts/ConversationThread";
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
  type TimelineAttachment,
  type TimelineEvent as TimelineEventData,
} from "#/components/contacts/timeline";

/** Pick a file-type icon from the attachment's extension. */
function attachmentIcon(name: string) {
  if (/\.pdf$/i.test(name)) return faFilePdf;
  if (/\.(xlsx?|csv)$/i.test(name)) return faFileSpreadsheet;
  return faFile;
}

/**
 * One attached document: type glyph, name over a size/format line, and a
 * download affordance. A deal-linked attachment (e.g. a sent BOV) opens that
 * deal's document editor instead.
 */
function AttachmentChip({ attachment }: { attachment: TimelineAttachment }) {
  const inner = (
    <>
      <FontAwesomeIcon
        icon={attachmentIcon(attachment.name)}
        className="tl-attach__icon"
      />
      <span className="tl-attach__label">
        <span className="tl-attach__name">{attachment.name}</span>
        {attachment.meta && <span className="tl-attach__meta">{attachment.meta}</span>}
      </span>
      <FontAwesomeIcon icon={faDownload} className="tl-attach__end" />
    </>
  );
  return attachment.dealId ? (
    <Link
      to="/editor/$listingId"
      params={{ listingId: attachment.dealId }}
      search={{ focus: "underwriting" }}
      className="tl-attach__chip tl-attach__chip--link"
    >
      {inner}
    </Link>
  ) : (
    <div className="tl-attach__chip">{inner}</div>
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
  threadOpen,
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
  threadOpen: boolean;
  /** Just landed (simulated inbound) — plays a one-shot entrance highlight. */
  arriving?: boolean;
  onAction: ActionDispatch;
  onReplySend: (text: string) => void;
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
  // Everything the row has to say, as one clamped block. Bullet blocks, a plain
  // body and a thread's latest message all read as content, so they clamp
  // together rather than each growing the row on its own.
  const content = isThread ? null : (
    <>
      {event.blocks?.map((block, i) => (
        <div key={i} className="tl-block">
          {block.kicker && <div className="tl-block__kicker">{block.kicker}</div>}
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
      {event.body && <p className="tl-row__text">{event.body}</p>}
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
            </span>
            {/* Deal / property links, separated from the subject by a rule so the
                two read as one line without either claiming the other's weight. */}
            {event.associations && event.associations.length > 0 && (
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
                {/* Collapsed, the thread shows only its latest message — the same
                    two-line clamp every other row gets. */}
                {!threadOpen && <ClampText>{event.thread.latestBody}</ClampText>}
                {event.attachments && event.attachments.length > 0 && (
                  <div className="tl-attach">
                    {event.attachments.map((a) => (
                      <AttachmentChip key={a.name} attachment={a} />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="tl-link tl-link--toggle"
                  aria-expanded={threadOpen}
                  onClick={() => onAction("View full thread")}
                >
                  <FontAwesomeIcon
                    icon={threadOpen ? faChevronDown : faChevronRight}
                  />
                  {threadOpen ? "Hide thread" : `View full thread (${event.thread.count})`}
                </button>
                {threadOpen && (
                  <ConversationThread thread={event.thread} onAction={onAction} />
                )}
              </>
            ) : (
              <>
                {hasContent && <ClampText>{content}</ClampText>}
                {event.reply && <ReplyCard reply={event.reply} />}
                {event.attachments && event.attachments.length > 0 && (
                  <div className="tl-attach">
                    {event.attachments.map((a) => (
                      <AttachmentChip key={a.name} attachment={a} />
                    ))}
                  </div>
                )}
              </>
            )}

            {event.visibility && (
              <div className="tl-row__visibility">
                <FontAwesomeIcon
                  icon={event.visibility === "private" ? faLock : faUsers}
                />
                {event.visibility === "private"
                  ? "Private to you"
                  : event.visibility === "team"
                    ? "Visible to your team"
                    : "Private to you and anyone you're sharing with"}
              </div>
            )}
          </div>
        )}

        {isActionable && actionBar && (
          <TimelineActionBar actionBar={actionBar} onAction={onAction} />
        )}

        {replyOpen && (
          <ReplyComposer
            subject={event.subject ?? event.title}
            onSend={onReplySend}
            onCancel={onReplyCancel}
          />
        )}
      </div>

      <TimelineFab type={event.type} pinned={pinned} onAction={onAction} />
    </article>
  );
}
