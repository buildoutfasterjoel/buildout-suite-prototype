import { hash } from "#/components/properties/propertyDisplay";
import type { Listing } from "#/data/types";

/**
 * How a listing reaches a channel. `direct` channels are real integrations with
 * confirmable state; `email` channels receive an email Buildout sends on the
 * broker's behalf — there is no connection to report on, so the most we can
 * honestly say is when we last sent.
 */
export type SyndicationDelivery = "direct" | "email";

/** Direct integrations report confirmable state. */
export type DirectChannelState =
  | "updated" // on, pushed, data current
  | "pending" // on, queued, not yet confirmed by the channel
  | "needs-attention" // credential or mapping problem
  | "off" // healthy connection, syndication turned off
  | "not-available"; // no connection configured for this account

/**
 * Email channels get no "connected" and no "error": Buildout sends an email and
 * the channel decides what to do with it.
 */
export type EmailChannelState = "update-sent" | "send-pending" | "off";

export type SyndicationChannelState = DirectChannelState | EmailChannelState;

interface ChannelDefinition {
  id: string;
  name: string;
  delivery: SyndicationDelivery;
}

/**
 * Fixed roster. Delivery method is a property of the channel, not something
 * derived per listing.
 */
const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  { id: "commercialedge-network", name: "CommercialEdge Network", delivery: "direct" },
  { id: "rcm1-marketplace", name: "RCM1 Marketplace", delivery: "direct" },
  { id: "apartmentbuildings-com", name: "apartmentbuildings.com", delivery: "direct" },
  { id: "brevitas", name: "Brevitas", delivery: "direct" },
  { id: "costar", name: "CoStar", delivery: "email" },
  { id: "loopnet", name: "LoopNet", delivery: "email" },
  { id: "crexi", name: "Crexi", delivery: "email" },
  { id: "ten-x", name: "Ten-X", delivery: "email" },
];

/**
 * Every channel name, flattened. Also consumed by `listingWebsiteActivity` as a
 * traffic-source pool, so it must stay exported.
 */
export const SYNDICATION_NETWORK_NAMES: string[] = CHANNEL_DEFINITIONS.map(
  (c) => c.name,
);

export interface SyndicationChannel {
  id: string;
  name: string;
  delivery: SyndicationDelivery;
  state: SyndicationChannelState;
  /** Whether syndication is currently turned on for this channel. */
  active: boolean;
  /** ISO timestamp the listing first reached this channel; null if it never has. */
  publishedAt: string | null;
  /** ISO timestamp of the most recent push (direct) or send (email). */
  lastUpdatedAt: string | null;
  /** Days until the channel drops the listing. Direct channels only. */
  expiresInDays: number | null;
  /** Deep link into the channel's admin console. Direct channels only. */
  adminUrl: string | null;
}

/** Deterministic per-listing syndication status. */
export interface ListingSyndication {
  /** Empty array means no channels are configured for this listing at all. */
  channels: SyndicationChannel[];
  /** Issues limiting syndication reach, e.g. missing syndicatable photos. */
  blockingIssues: string[];
}

/** The listing fields syndication needs — a full `Listing` satisfies this. */
export type SyndicationListing = Pick<
  Listing,
  "id" | "slug" | "publishedAt" | "dealType"
>;

const DAY_MS = 86_400_000;

const PHOTO_ISSUE =
  "Properties without syndicatable photos are not accepted by all partners and generate fewer leads. Check the appropriate boxes in the Media forms for any syndicatable photos you own.";

/**
 * A timestamp `days` and `minutes` after the listing went live. Returns null
 * when the listing was never published — a channel cannot have received a
 * listing that does not exist yet.
 */
function afterPublish(
  anchor: number | null,
  days: number,
  minutes: number,
): string | null {
  if (anchor == null) return null;
  return new Date(anchor + days * DAY_MS + minutes * 60_000).toISOString();
}

/**
 * Deterministic per-listing syndication status derived from the listing id, so
 * values stay stable across renders (same approach as `getListingTraffic`).
 * Dates are anchored to `listing.publishedAt` so no channel can claim it
 * published before the listing went live.
 */
export function getListingSyndication(
  listing: SyndicationListing,
): ListingSyndication {
  const h = hash(listing.id);

  if (h % 6 === 0) {
    return { channels: [], blockingIssues: [] };
  }

  const anchor = listing.publishedAt
    ? new Date(listing.publishedAt).getTime()
    : null;

  const channels: SyndicationChannel[] = CHANNEL_DEFINITIONS.map((def, i) => {
    const roll = (h >>> (i + 8)) % 5;
    const wantsActive = ((h >>> i) & 1) === 1;

    // Spread timestamps deterministically, always forward from the anchor.
    const firstDelay = (h >>> (i + 3)) % 3;
    const updateDelay = firstDelay + ((h >>> (i + 5)) % 5);
    const minutes = ((h >>> (i + 11)) % 96) * 15;

    if (def.delivery === "email") {
      const state: EmailChannelState = !wantsActive
        ? "off"
        : roll === 0
          ? "send-pending"
          : "update-sent";
      // An "off" channel may still have history from before it was paused.
      const everSent = state !== "off" || ((h >>> (i + 16)) & 1) === 1;
      return {
        ...def,
        state,
        active: wantsActive,
        publishedAt: everSent ? afterPublish(anchor, firstDelay, 0) : null,
        lastUpdatedAt: everSent
          ? afterPublish(anchor, updateDelay, minutes)
          : null,
        expiresInDays: null,
        adminUrl: null,
      };
    }

    const state: DirectChannelState =
      roll === 0
        ? "not-available"
        : !wantsActive
          ? "off"
          : roll === 1
            ? "needs-attention"
            : roll === 2
              ? "pending"
              : "updated";
    const active = state !== "not-available" && wantsActive;
    const everPublished =
      state !== "not-available" &&
      (state !== "off" || ((h >>> (i + 16)) & 1) === 1);
    const publishedAt = everPublished ? afterPublish(anchor, firstDelay, 0) : null;

    return {
      ...def,
      state,
      active,
      publishedAt,
      lastUpdatedAt: everPublished
        ? afterPublish(anchor, updateDelay, minutes)
        : null,
      // Nothing to expire until the listing actually reached the channel.
      expiresInDays: publishedAt ? 1 + ((h >>> (i + 20)) % 210) : null,
      adminUrl:
        state === "not-available"
          ? null
          : `https://admin.buildout.com/syndication/${def.id}/${listing.slug}`,
    };
  });

  const blockingIssues = h % 4 === 0 ? [PHOTO_ISSUE] : [];

  return { channels, blockingIssues };
}
