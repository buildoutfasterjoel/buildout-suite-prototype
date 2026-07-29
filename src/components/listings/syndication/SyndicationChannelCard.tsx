import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCircleExclamation,
} from "@fortawesome/pro-regular-svg-icons";
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
  onToggle,
}: {
  channel: SyndicationChannel;
  websiteUrl: string;
  websiteLabel: string;
  onToggle: (active: boolean) => void;
}) {
  const badge = channelBadge(channel.state);
  const segments = channelMetaSegments(channel);
  const unavailable = channel.state === "not-available";

  return (
    <div
      className={`border rounded bg-body px-3 py-2${unavailable ? " opacity-75" : ""}`}
    >
      <div className="d-flex align-items-center justify-content-between gap-2">
        <div
          className="d-flex align-items-center gap-2"
          style={{ minWidth: 0 }}
        >
          <span className="fw-semibold text-truncate">{channel.name}</span>
          <Badge variant="secondary" appearance="muted">
            <FontAwesomeIcon icon={badge.icon} style={{ color: badge.color }} />
            {badge.label}
          </Badge>
          {channel.state === "needs-attention" && (
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span
                    className="text-warning"
                    tabIndex={0}
                    role="button"
                    aria-label="Why this connection needs attention"
                  >
                    <FontAwesomeIcon icon={faCircleExclamation} />
                  </span>
                }
              />
              <Tooltip.Content side="top">
                This connection needs attention before it can syndicate
                reliably.
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
        <Switch
          checked={channel.active}
          disabled={unavailable}
          onCheckedChange={onToggle}
          aria-label={`Toggle syndication to ${channel.name}`}
        />
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

      {!unavailable && (
        <div className="d-flex flex-wrap gap-3 fs-small mt-1">
          <ChannelLink href={websiteUrl}>{websiteLabel}</ChannelLink>
          {channel.adminUrl && (
            <ChannelLink href={channel.adminUrl}>Admin Dash</ChannelLink>
          )}
        </div>
      )}
    </div>
  );
}
