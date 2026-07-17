import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faUsers,
  faStar,
  faThumbtack,
  faPaperclip,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import { IconBadge } from "#/components/contacts/IconBadge";
import { TimelineBadge } from "#/components/contacts/TimelineBadge";
import {
  TYPE_CONFIG,
  relativeTime,
  exactTime,
  durationLabel,
  type TimelineEvent as TimelineEventData,
} from "#/components/contacts/timeline";

/**
 * The single row that renders every timeline event type via composition. The
 * `type` drives the icon/tone; the rest of the surface (title, blocks, body,
 * badges, associations, thread, visibility) renders only when present. State
 * overlays (action bar, reply composer, hover toolbar, overflow, thread expand)
 * arrive in PR2 — this pass establishes the structure and all 16 type paths.
 */
export function TimelineEvent({ event }: { event: TimelineEventData }) {
  const config = TYPE_CONFIG[event.type];
  const filled = event.attempted ? false : config.filled;

  const names = event.contact
    ? `${event.actor.name} › ${event.contact.name}`
    : event.actor.name;

  const headline = event.subject ?? event.title ?? config.defaultTitle;

  return (
    <article
      className="tl-row"
      data-type={event.type}
      data-starred={event.starred || undefined}
      data-pinned={event.pinned || undefined}
    >
      <div className="tl-row__rail">
        <IconBadge icon={config.icon} tone={config.tone} filled={filled} />
        <span className="tl-row__connector" aria-hidden="true" />
      </div>

      <div className="tl-row__body">
        <div className="tl-row__head">
          <span className="tl-row__actors">
            {names}
            {event.durationSecs != null && (
              <span className="tl-row__duration">
                {" "}
                ({durationLabel(event.durationSecs)})
              </span>
            )}
          </span>

          <span className="tl-row__head-right">
            {event.pinned && (
              <FontAwesomeIcon icon={faThumbtack} className="tl-row__flag" title="Pinned" />
            )}
            {event.starred && (
              <FontAwesomeIcon icon={faStar} className="tl-row__flag is-star" title="Starred" />
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

        {headline && <div className="tl-row__subject">{headline}</div>}

        {event.type === "conversation" && event.thread ? (
          <ConversationPreview event={event} />
        ) : (
          <>
            {event.blocks?.map((block, i) => (
              <div key={i} className="tl-block">
                <div className="tl-block__kicker">{block.kicker}</div>
                <ul className="tl-block__list">
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            {event.body && <p className="tl-row__text">{event.body}</p>}
          </>
        )}

        {event.badges && event.badges.length > 0 && (
          <div className="tl-row__badges">
            {event.badges.map((b, i) => (
              <TimelineBadge key={i} badge={b} />
            ))}
          </div>
        )}

        {event.associations && event.associations.length > 0 && (
          <div className="tl-row__assoc">
            {event.associations.map((a, i) => (
              <span key={i} className="tl-chip">
                {a.label}
              </span>
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
      </div>
    </article>
  );
}

/** Collapsed conversation card: subject + count + latest-message preview only. */
function ConversationPreview({ event }: { event: TimelineEventData }) {
  const thread = event.thread!;
  return (
    <div className="tl-convo">
      <p className="tl-convo__latest">
        <span className="tl-convo__latest-label">LATEST · {thread.latestSender}</span>
        {thread.latestBody}
      </p>
      <span className="tl-convo__more">
        View full thread ({thread.count})
        <FontAwesomeIcon icon={faChevronRight} />
      </span>
    </div>
  );
}
