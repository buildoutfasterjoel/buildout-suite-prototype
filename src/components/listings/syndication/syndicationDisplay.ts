import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowsRotate,
  faCircleCheck,
  faCircleExclamation,
  faCircleMinus,
  faEnvelope,
} from "@fortawesome/pro-regular-svg-icons";
import { formatDate } from "#/components/deals/dealDisplay";
import type {
  SyndicationChannel,
  SyndicationChannelState,
} from "#/data/listingSyndication";

export interface ChannelBadge {
  icon: IconDefinition;
  /** CSS color for the icon only — badge text keeps its inherited color. */
  color: string;
  label: string;
}

/**
 * Blueprint's Badge has no semantic success/warning variant, so the chrome
 * stays neutral and a colored icon carries the meaning. In-flight states use
 * the Seagull `--channel-info` token rather than `--bp-primary`: primary is the
 * action color the card's links and switch already use, and a state badge
 * wearing it would read as clickable.
 */
const BADGES: Record<SyndicationChannelState, ChannelBadge> = {
  updated: {
    icon: faCircleCheck,
    color: "var(--bp-success)",
    label: "Updated",
  },
  pending: {
    icon: faArrowsRotate,
    color: "var(--channel-info)",
    label: "Pending",
  },
  "needs-attention": {
    icon: faCircleExclamation,
    color: "var(--bp-warning)",
    label: "Needs attention",
  },
  off: { icon: faCircleMinus, color: "var(--stage-inactive)", label: "Off" },
  "not-available": {
    icon: faCircleMinus,
    color: "var(--stage-inactive)",
    label: "Not available",
  },
  // Grey, not green: a sent email is not a confirmed posting.
  "update-sent": {
    icon: faEnvelope,
    color: "var(--stage-inactive)",
    label: "Update sent",
  },
  "send-pending": {
    icon: faEnvelope,
    color: "var(--channel-info)",
    label: "Send queued",
  },
};

export function channelBadge(state: SyndicationChannelState): ChannelBadge {
  return BADGES[state];
}

/** One clause of a card's meta line. The card joins these with a separator. */
export interface MetaSegment {
  text: string;
  /** "warning" renders in `text-warning`; muted is the default. */
  tone?: "warning";
}

/** An expiration this close deserves to be noticed, not just counted. */
const EXPIRING_SOON_DAYS = 30;

/** "07/22/2026 12:21 PM PDT" — date, time, and the viewer's zone. */
export function formatChannelTimestamp(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${formatDate(iso)} ${time}`;
}

function expirationSegment(days: number): MetaSegment {
  const text = `Expires in ${days} ${days === 1 ? "day" : "days"}`;
  return days <= EXPIRING_SOON_DAYS ? { text, tone: "warning" } : { text };
}

/**
 * The meta line for one channel. Branches on delivery method first: an email
 * channel has no expiration and no confirmed posting, so it must never borrow
 * a direct channel's phrasing.
 */
export function channelMetaSegments(channel: SyndicationChannel): MetaSegment[] {
  if (channel.state === "not-available") {
    return [{ text: "No connection configured for this account" }];
  }

  if (channel.delivery === "email") {
    if (channel.state === "send-pending") {
      return [{ text: "Update queued to send" }];
    }
    if (channel.state === "off") {
      return [
        { text: "Not sending" },
        {
          text: channel.lastUpdatedAt
            ? `Last sent ${formatChannelTimestamp(channel.lastUpdatedAt)}`
            : "No updates sent",
        },
      ];
    }
    // update-sent
    return [
      {
        text: channel.lastUpdatedAt
          ? `Last sent ${formatChannelTimestamp(channel.lastUpdatedAt)}`
          : "No updates sent",
      },
      { text: "Posting not confirmed" },
    ];
  }

  if (channel.state === "off") {
    return [
      { text: "Not syndicating" },
      {
        text: channel.publishedAt
          ? `Last published ${formatDate(channel.publishedAt)}`
          : "Never published",
      },
    ];
  }

  const segments: MetaSegment[] = [];
  segments.push({
    text: channel.publishedAt
      ? `Published ${formatDate(channel.publishedAt)}`
      : "Not yet published",
  });
  if (channel.lastUpdatedAt) {
    segments.push({
      text: `Updated ${formatChannelTimestamp(channel.lastUpdatedAt)}`,
    });
  }
  if (channel.expiresInDays != null) {
    segments.push(expirationSegment(channel.expiresInDays));
  }
  return segments;
}
