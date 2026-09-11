import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";
import type { SyndicationChannel } from "#/data/listingSyndication";
import { channelBadge, channelMetaSegments } from "./syndicationDisplay";

function ChannelLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="d-inline-flex align-items-center gap-1"
    >
      {children}
      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
    </a>
  );
}

/**
 * One syndication channel: identity and status on the first line, the dates
 * that matter on the second, and where to go next on the third.
 */
export function SyndicationChannelCard({
  channel,
  websiteUrl,
  websiteLabel,
}: {
  channel: SyndicationChannel;
  websiteUrl: string;
  websiteLabel: string;
}) {
  const badge = channelBadge(channel.state);
  const segments = channelMetaSegments(channel);

  // The badge is a status readout, not content — nothing here is worth
  // selecting, and an I-beam over it reads as "this text is the point".
  // Focusable only when it carries an explanation, since that makes it the
  // tooltip's trigger.
  const statusBadge = (
    <Badge
      variant="secondary"
      appearance="muted"
      className="user-select-none"
      tabIndex={badge.explanation ? 0 : undefined}
    >
      <FontAwesomeIcon icon={badge.icon} style={{ color: badge.color }} />
      {badge.label}
    </Badge>
  );

  return (
    <div className="border rounded bg-body px-3 py-2">
      <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
        <span className="fw-semibold text-truncate">{channel.name}</span>
        {badge.explanation ? (
          <Tooltip>
            <Tooltip.Trigger render={statusBadge} />
            <Tooltip.Content side="top">{badge.explanation}</Tooltip.Content>
          </Tooltip>
        ) : (
          statusBadge
        )}
      </div>

      <div className="fs-small text-muted mt-1">
        {segments.map((segment, i) => (
          <span key={segment.text}>
            {i > 0 && <span className="mx-1">·</span>}
            {segment.info ? (
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <span
                      className={segment.tone === "warning" ? "text-warning" : undefined}
                      tabIndex={0}
                    >
                      {segment.text}
                    </span>
                  }
                />
                <Tooltip.Content side="top">{segment.info}</Tooltip.Content>
              </Tooltip>
            ) : (
              <span className={segment.tone === "warning" ? "text-warning" : undefined}>
                {segment.text}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="d-flex flex-wrap gap-3 fs-small mt-1">
        <ChannelLink href={websiteUrl}>{websiteLabel}</ChannelLink>
      </div>
    </div>
  );
}
