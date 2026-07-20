import { Link } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faUsers,
  faThumbtack,
  faPaperclip,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import { faStar as faStarSolid } from "@fortawesome/pro-solid-svg-icons";
import { IconBadge } from "#/components/contacts/IconBadge";
import { TimelineBadge } from "#/components/contacts/TimelineBadge";
import { ClampText } from "#/components/contacts/ClampText";
import { ReplyCard } from "#/components/contacts/ReplyCard";
import { ReplyComposer } from "#/components/contacts/ReplyComposer";
import { ConversationThread } from "#/components/contacts/ConversationThread";
import {
  TimelineActionBar,
  TimelineHoverToolbar,
  type ActionDispatch,
} from "#/components/contacts/TimelineActions";
import {
  TYPE_CONFIG,
  relativeTime,
  exactTime,
  durationLabel,
  type TimelineEvent as TimelineEventData,
} from "#/components/contacts/timeline";

/**
 * The single row that renders every timeline event type via composition. State
 * overlays are boolean props (starred / pinned / replyOpen / threadOpen); every
 * action flows out through one `onAction` dispatch, so the row itself has no
 * side-effects.
 */
export function TimelineEvent({
  event,
  attention,
  starred,
  pinned,
  replyOpen,
  threadOpen,
  onAction,
  onReplySend,
  onReplyCancel,
}: {
  event: TimelineEventData;
  /** Row still needs action (missed call / unreplied email / open inquiry). */
  attention: boolean;
  starred: boolean;
  pinned: boolean;
  replyOpen: boolean;
  threadOpen: boolean;
  onAction: ActionDispatch;
  onReplySend: (text: string) => void;
  onReplyCancel: () => void;
}) {
  const config = TYPE_CONFIG[event.type];

  const headline = event.subject ?? event.title ?? config.defaultTitle;

  // Tier-1 action bar shows only while the row still needs attention (unreplied
  // email, missed call, open inquiry, live thread); resolving it removes the
  // reply/respond/call-back options. Read-only system rows never get it.
  const isActionable = !config.readOnly && !!config.actionBar?.primary && attention;

  return (
    <article
      className="tl-row"
      data-type={event.type}
      data-starred={starred || undefined}
      data-pinned={pinned || undefined}
    >
      <div className="tl-row__rail">
        <IconBadge icon={config.icon} tone={config.tone} attention={attention} />
        <span className="tl-row__connector" aria-hidden="true" />
      </div>

      <div className="tl-row__body">
        <div className="tl-row__head">
          <span className="tl-row__actors">
            {event.actor.name}
            {event.contact && (
              <>
                {" › "}
                <span className="tl-row__contact-name">{event.contact.name}</span>
              </>
            )}
            {event.durationSecs != null && (
              <span className="tl-row__duration"> ({durationLabel(event.durationSecs)})</span>
            )}
          </span>

          <span className="tl-row__head-right">
            {pinned && (
              <FontAwesomeIcon icon={faThumbtack} className="tl-row__flag" title="Pinned" />
            )}
            {starred && (
              <FontAwesomeIcon icon={faStarSolid} className="tl-row__flag is-star" title="Starred" />
            )}
            {event.hasAttachment && (
              <FontAwesomeIcon icon={faPaperclip} className="tl-row__flag" title="Has attachment" />
            )}
            <Tooltip>
              <Tooltip.Trigger
                render={<span className="tl-row__time">{relativeTime(event.timestamp)}</span>}
              />
              <Tooltip.Content>{exactTime(event.timestamp)}</Tooltip.Content>
            </Tooltip>
          </span>
        </div>

        {headline && (
          <div className="tl-row__subject">
            <span>{headline}</span>
            {event.sourceTag && (
              <TimelineBadge badge={{ label: event.sourceTag, tone: "system" }} />
            )}
          </div>
        )}

        {/* Deal / property links — plain hyperlinked text on their own line
            directly under the subject. */}
        {event.associations && event.associations.length > 0 && (
          <div className="tl-row__deals">
            {event.associations.map((a, i) =>
              a.id ? (
                <Link
                  key={i}
                  to="/listings/$listingId"
                  params={{ listingId: a.id }}
                  className="tl-row__deal-link"
                >
                  {a.label}
                </Link>
              ) : (
                <span key={i} className="tl-row__deal-link">
                  {a.label}
                </span>
              ),
            )}
          </div>
        )}

        {event.type === "conversation" && event.thread ? (
          <>
            <div className="tl-convo">
              <p className="tl-convo__latest">
                <span className="tl-convo__latest-label">
                  LATEST · {event.thread.latestSender}
                </span>
                {event.thread.latestBody}
              </p>
              <button
                type="button"
                className={`tl-convo__more ${threadOpen ? "is-open" : ""}`}
                onClick={() => onAction("View full thread")}
              >
                {threadOpen ? "Hide thread" : `View full thread (${event.thread.count})`}
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
            {threadOpen && <ConversationThread thread={event.thread} />}
          </>
        ) : (
          <>
            {event.blocks?.map((block, i) => (
              <div key={i} className="tl-block">
                {block.kicker && (
                  <div className="tl-block__kicker">{block.kicker}</div>
                )}
                {block.clamp ? (
                  block.items.map((item, j) => <ClampText key={j} text={item} />)
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
            {event.reply && <ReplyCard reply={event.reply} />}
          </>
        )}

        {event.badges && event.badges.length > 0 && (
          <div className="tl-row__badges">
            {event.badges.map((b, i) => (
              <TimelineBadge key={i} badge={b} />
            ))}
          </div>
        )}

        {event.visibility && (
          <div className="tl-row__visibility">
            <FontAwesomeIcon icon={event.visibility === "private" ? faLock : faUsers} />
            {event.visibility === "private"
              ? "Private to you"
              : event.visibility === "team"
                ? "Visible to your team"
                : "Private to you and anyone you're sharing with"}
          </div>
        )}

        {isActionable && config.actionBar && (
          <TimelineActionBar actionBar={config.actionBar} onAction={onAction} />
        )}

        {replyOpen && (
          <ReplyComposer
            subject={event.subject ?? event.title}
            onSend={onReplySend}
            onCancel={onReplyCancel}
          />
        )}
      </div>

      <TimelineHoverToolbar
        type={event.type}
        starred={starred}
        pinned={pinned}
        onAction={onAction}
      />
    </article>
  );
}
