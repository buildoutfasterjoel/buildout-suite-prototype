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
}

/** Deterministic per-listing syndication status. */
export interface ListingSyndication {
  /** Empty array means no channels are configured for this listing at all. */
  channels: SyndicationChannel[];
  /** Media problems affecting syndication, worst first. */
  blockingIssues: string[];
  /**
   * True when at least one issue makes networks reject the listing outright
   * rather than merely reducing its reach — the difference between "fewer
   * leads" and "this will not publish at all".
   */
  blocksSyndication: boolean;
}

/** The listing fields syndication needs — a full `Listing` satisfies this. */
export type SyndicationListing = Pick<
  Listing,
  "id" | "slug" | "publishedAt" | "dealType"
>;

const DAY_MS = 86_400_000;

/**
 * Reach problem: the listing still syndicates, it just performs worse. Copy is
 * verbatim from the live product.
 */
const PHOTO_ISSUE =
  "Properties without syndicatable photos are not accepted by all partners and generate fewer leads. Check the appropriate boxes in the Media forms for any syndicatable photos you own.";

/**
 * Rejection problem: several networks require a primary photo and refuse the
 * listing without one, so the push fails rather than publishing degraded.
 */
const PRIMARY_MEDIA_ISSUE =
  "No photo is set as primary. Several networks require one and will reject this listing outright — syndication fails rather than publishing without it. Set a primary photo in the Media forms.";

/**
 * A timestamp `days` and `minutes` after the listing went live. Returns null
 * when the listing was never published — a channel cannot have received a
 * listing that does not exist yet. Clamped to now: the offset is a
 * deterministic hash roll, not a real event, so it must never land in the
 * future relative to the person viewing it.
 */
function afterPublish(
  anchor: number | null,
  days: number,
  minutes: number,
): string | null {
  if (anchor == null) return null;
  const raw = anchor + days * DAY_MS + minutes * 60_000;
  return new Date(Math.min(raw, Date.now())).toISOString();
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
    return { channels: [], blockingIssues: [], blocksSyndication: false };
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
      let state: EmailChannelState = !wantsActive
        ? "off"
        : roll === 0
          ? "send-pending"
          : "update-sent";
      // A listing that was never published can't have a confirmed-looking send
      // behind it — there is nothing to have sent yet.
      if (anchor == null && state === "update-sent") state = "send-pending";
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
      };
    }

    let state: DirectChannelState =
      roll === 0
        ? "not-available"
        : !wantsActive
          ? "off"
          : roll === 1
            ? "needs-attention"
            : roll === 2
              ? "pending"
              : "updated";
    // A listing that was never published can't have a live push, a confirmed
    // push, or a broken push behind it — nothing has been attempted yet.
    if (
      anchor == null &&
      (state === "updated" || state === "pending" || state === "needs-attention")
    ) {
      state = "pending";
    }
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
      // Nothing to expire until the listing has reached the channel, and a
      // paused channel has no live listing on the other end to expire.
      expiresInDays:
        publishedAt && state !== "off"
          ? 1 + ((h >>> (i + 20)) % 210)
          : null,
    };
  });

  // Each issue gets its own prefix-salted hash rather than a slice of `h`.
  // Two reasons, both learned the hard way:
  //   - `h % 3` and `h % 4` share factors with the `h % 6` empty-roster branch
  //     above, so the two issues could never co-occur at all.
  //   - `hash` multiplies by 31 per character, so late characters only reach the
  //     low bits. Ids sharing a prefix (`listing-1`, `listing-2`, …) have nearly
  //     identical high bits, making `h >>> 24` a near-constant. Salting as a
  //     prefix keeps the varying part of the id in the low bits where it counts.
  //
  // Rejection first: a broker who reads one line should read the one that stops
  // the listing publishing, not the one that costs it leads.
  const blocksSyndication = hash(`primary-media:${listing.id}`) % 3 === 0;
  const blockingIssues: string[] = [];
  if (blocksSyndication) blockingIssues.push(PRIMARY_MEDIA_ISSUE);
  if (hash(`syndicatable-photos:${listing.id}`) % 4 === 0) {
    blockingIssues.push(PHOTO_ISSUE);
  }

  return { channels, blockingIssues, blocksSyndication };
}

/**
 * Applies a user's on/off toggle to a channel, deriving the `state` that goes
 * with it so the badge and meta line never contradict the switch.
 *
 * - `not-available` has no connection to toggle; the switch is disabled and
 *   this is a no-op.
 * - `needs-attention` stays broken either way — flipping the switch doesn't
 *   fix or introduce a connection problem, it only changes whether the
 *   (still-broken) channel is asked to syndicate.
 * - Everything else reads honestly as "queued, not confirmed" the moment it's
 *   turned on: `pending` for a direct channel, `send-pending` for email.
 *   Turning it off is always `off`.
 *
 * This is the single place state is derived from a toggle — callers should
 * never re-implement this branching inline.
 */
export function withChannelActive(
  channel: SyndicationChannel,
  active: boolean,
): SyndicationChannel {
  if (channel.state === "not-available") return channel;
  if (channel.state === "needs-attention") return { ...channel, active };

  const state: SyndicationChannelState = active
    ? channel.delivery === "email"
      ? "send-pending"
      : "pending"
    : "off";
  return { ...channel, active, state };
}
