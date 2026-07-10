import { hash } from "#/components/properties/propertyDisplay";

/**
 * Fixed set of third-party listing sites a listing's data can be pushed to via
 * API. These are API connections, not business partnerships.
 */
export const SYNDICATION_NETWORK_NAMES = [
  "LoopNet",
  "Crexi",
  "CoStar",
  "Ten-X",
  "Brevitas",
  "RCM1",
] as const;

/**
 * Health of a network's connection, independent of whether syndication is
 * currently toggled on — a network can be connected but paused, or need
 * attention (e.g. a credential/mapping issue) before it can be turned on.
 */
export type SyndicationConnectionStatus =
  | "connected"
  | "needs-attention"
  | "not-available";

export interface SyndicationNetwork {
  id: string;
  name: string;
  status: SyndicationConnectionStatus;
  /** Whether syndication is currently turned on for this network. */
  active: boolean;
}

/** Deterministic per-listing syndication status. */
export interface ListingSyndication {
  /** Empty array means no networks are configured for this listing at all. */
  networks: SyndicationNetwork[];
  /** Issues blocking syndication to one or more networks, e.g. missing photos. */
  blockingIssues: string[];
}

/**
 * Deterministic per-listing syndication status derived from the listing id, so
 * values stay stable across renders (same approach as `getListingTraffic`).
 */
export function getListingSyndication(listingId: string): ListingSyndication {
  const h = hash(listingId);

  if (h % 6 === 0) {
    return { networks: [], blockingIssues: [] };
  }

  const networks: SyndicationNetwork[] = SYNDICATION_NETWORK_NAMES.map(
    (name, i) => {
      const statusRoll = (h >>> (i + 8)) % 5;
      const status: SyndicationConnectionStatus =
        statusRoll === 0
          ? "not-available"
          : statusRoll === 1
            ? "needs-attention"
            : "connected";
      return {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        status,
        // Can't be actively syndicating to a network that isn't available.
        active: status !== "not-available" && ((h >>> i) & 1) === 1,
      };
    },
  );

  const blockingIssues =
    h % 4 === 0
      ? [
          "Missing syndicatable photos — at least 4 high-resolution photos are required by most networks.",
        ]
      : [];

  return { networks, blockingIssues };
}
