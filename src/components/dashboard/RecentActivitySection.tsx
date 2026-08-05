import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { IconBadge } from "#/components/contacts/IconBadge";
import {
  TYPE_CONFIG,
  durationLabel,
  exactTime,
  relativeTime,
} from "#/components/contacts/timeline";
import {
  DASHBOARD_TODAY,
  RECENT_ACTIVITY,
  type ActivityItem,
} from "./dashboardData";

/** The dashboard persona (matches the navbar avatar and the greeting). */
const ACTOR_NAME = "Ethan Thompson";

/** Relative times are anchored to the dashboard's fictional "today". */
const DASHBOARD_NOW = DASHBOARD_TODAY.getTime();

/**
 * A recent-activity row rendered with the contact detail timeline's `.tl-row`
 * styles: channel bubble + connector rail, "actor › contact" header with a
 * relative timestamp, then the event title and summary text.
 */
function ActivityRow({ item }: { item: ActivityItem }) {
  const config = TYPE_CONFIG[item.kind];

  return (
    <article className="tl-row" data-type={item.kind}>
      <div className="tl-row__rail">
        <IconBadge icon={config.icon} attention={false} />
        <span className="tl-row__connector" aria-hidden="true" />
      </div>

      <div className="tl-row__body">
        <div className="tl-row__head">
          {/* Same head shape as the contact timeline: actors and the timestamp on
              one line, then the event's own line below. */}
          <div className="tl-row__actors">
            <span className="tl-row__actor">{ACTOR_NAME}</span>
            <span className="tl-row__arrow">›</span>
            <span className="tl-row__recipient">{item.contactName}</span>
            <span className="tl-row__meta">
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <span className="tl-row__time">
                      {relativeTime(item.timestamp, DASHBOARD_NOW)}
                    </span>
                  }
                />
                <Tooltip.Content>{exactTime(item.timestamp)}</Tooltip.Content>
              </Tooltip>
              {item.durationSecs != null && (
                <span className="tl-row__duration">
                  ({durationLabel(item.durationSecs)})
                </span>
              )}
            </span>
          </div>

          <div className="tl-row__context">
            <span className="tl-row__subject">
              <span>{config.defaultTitle}</span>
            </span>
          </div>
        </div>

        {item.body && (
          <div className="tl-row__content">
            <p className="tl-row__text">{item.body}</p>
          </div>
        )}
      </div>
    </article>
  );
}

export function RecentActivitySection() {
  return (
    <Card className="panel-card">
      <Card.Header>
        <Card.Title className="fs-large">Recent activity</Card.Title>
      </Card.Header>

      <CardBody>
        <div className="tl-feed">
          <div>
            {RECENT_ACTIVITY.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
