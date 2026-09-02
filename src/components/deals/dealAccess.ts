import {
  CURRENT_USER,
  findTeammate,
  teammateIdByName,
  type Teammate,
} from "#/data/teammates";
import type { DealBroker, Listing } from "#/data/types";

/**
 * Who can open a deal, for the header's access cluster and its Manage Access
 * modal.
 *
 * Access follows the deal team: the person who created it, plus its internal
 * brokers. Outside brokers are excluded — a co-broking agent is not on the
 * firm's books and has no seat in the app. There is no separate share list yet;
 * when other roles can be granted access, it lands here.
 */

/** The person who opened the deal. Falls back to the protagonist for an unknown id. */
export function dealCreator(listing: Listing): Teammate {
  return findTeammate(listing.createdById) ?? CURRENT_USER;
}

/**
 * The roster member behind a broker row, matched by name.
 *
 * Every internal broker is one of the firm's own — the seed draws them from
 * `BROKER_TEAMMATES` and `AddBrokerModal` allows nobody else — so this resolves
 * for them and gives the avatar its photo. An outside broker is a stranger by
 * definition and returns undefined.
 */
export function brokerTeammate(broker: DealBroker): Teammate | undefined {
  const id = teammateIdByName(broker.name);
  return id ? findTeammate(id) : undefined;
}

/** Initials for a broker: the roster's when we know them, else drawn from the name. */
export function brokerInitials(broker: DealBroker): string {
  const member = brokerTeammate(broker);
  if (member) return member.initials;
  return broker.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The deal team after the creator — the avatars that stack into the group.
 *
 * The creator is dropped when they also work the deal, which is the common
 * case for a deal created in Suite: the same face twice says nothing, and the
 * ring already credits them.
 */
export function dealTeamBrokers(listing: Listing): DealBroker[] {
  const creator = dealCreator(listing);
  return listing.internalBrokers.filter((b) => b.name !== creator.name);
}
