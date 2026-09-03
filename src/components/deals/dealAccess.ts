import {
  CURRENT_USER,
  findTeammate,
  teammateIdByName,
  type Teammate,
} from "#/data/teammates";
import type { DealBroker, Listing } from "#/data/types";
import {
  isPermissionOn,
  ROLE_BY_ID,
  type PermissionOverrides,
  type RoleId,
} from "#/data/permissions";
import { SHARE_SCOPES, type DealShare, type ShareScope } from "#/data/dealShares";

/**
 * Who can open a deal, for the header's access cluster and its Manage Access
 * modal.
 *
 * The deal team — the person who created it, plus its internal brokers — has it
 * all. Outside brokers are excluded: a co-broking agent is not on the firm's
 * books and has no seat in the app.
 *
 * Everyone else gets in by being shared in, which is the second half of this
 * file: `dealAccessFor` resolves a team membership, a share and a role into what
 * one person may do on one deal.
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

/* ------------------------------------------------------------------------- *
 * Resolution: what one person may do on one deal.
 * ------------------------------------------------------------------------- */

/** What a person may do in one half of a deal. */
export type AccessLevel = "none" | "view" | "contribute";

export interface DealAccess {
  marketing: AccessLevel;
  backOffice: AccessLevel;
}

/** Everything, both halves — the deal team's access, and a broker's by default. */
const FULL: DealAccess = { marketing: "contribute", backOffice: "contribute" };

/** The slice of a roster row this needs. Kept structural so tests can fake it. */
export interface AccessViewer {
  id: string;
  name: string;
  roleIds: RoleId[];
  overrides: PermissionOverrides;
}

/** True when the viewer created the deal or works it as an internal broker. */
function onDealTeam(listing: Listing, viewer: AccessViewer): boolean {
  if (listing.createdById === viewer.id) return true;
  return listing.internalBrokers.some((b) => b.name === viewer.name);
}

/**
 * Whether these roles bring their own book, or only see what is shared with them.
 *
 * The most open role wins, which matters only if the one-role-per-person rule in
 * `roster.ts` ever relaxes.
 */
function seesEveryDeal(roleIds: RoleId[]): boolean {
  return roleIds.some((id) => ROLE_BY_ID.get(id)?.accessKind !== "sharing");
}

/** A share's level, lowered to `view` when the viewer's role can't back it up. */
function cappedLevel(share: DealShare, viewer: AccessViewer): AccessLevel {
  if (share.level === "view") return "view";
  return canContribute(share.scope, viewer) ? "contribute" : "view";
}

/**
 * Whether this person's role lets them edit in a scope at all — the ceiling the
 * share cannot exceed. Exported because the share modal disables the option and
 * needs to say why before anything is granted.
 */
export function canContribute(scope: ShareScope, viewer: AccessViewer): boolean {
  const meta = SHARE_SCOPES.find((s) => s.value === scope);
  if (!meta) return false;
  return meta.contributePermissions.some((id) =>
    isPermissionOn(viewer.roleIds, viewer.overrides, id),
  );
}

/**
 * What this viewer may do on this deal — the one function the whole feature
 * rests on. Pure, so it is testable without a store or a browser.
 *
 * Rules, in order:
 *
 *  1. **On the deal team** — the creator or an internal broker — gets both
 *     halves. Team membership is still the full-access path; a share is for
 *     everyone else.
 *  2. **Shared in** gets exactly what the share says, capped by their role. A
 *     back office share also carries marketing at `view`: the money is
 *     unreadable without knowing what is being sold. A marketing share carries
 *     no back office at all — that asymmetry is the point of the feature.
 *  3. **No share, and a role that owns records or sees firm-wide** (Broker,
 *     Managing Director, Back Office Manager) gets both halves. This is the
 *     app's behaviour today, so nothing existing changes.
 *  4. **No share, and a role that works by sharing** gets nothing.
 *     `ROLE_ACCESS_DETAIL` has always said so in words — "they can only act on
 *     listings and deals that have been shared with them" — and this is the
 *     first place it becomes true.
 *
 * A viewer with no roster row falls through to full access rather than none: we
 * cannot resolve a ceiling for someone we can't find, and blanking the deal page
 * over a missing row is a worse failure than showing it.
 */
export function dealAccessFor(
  listing: Listing,
  viewer: AccessViewer | undefined,
  shares: DealShare[],
): DealAccess {
  if (!viewer) return FULL;
  if (onDealTeam(listing, viewer)) return FULL;

  const share = shares.find((s) => s.member.id === viewer.id);
  if (share) {
    const level = cappedLevel(share, viewer);
    return share.scope === "back-office"
      ? { marketing: "view", backOffice: level }
      : { marketing: level, backOffice: "none" };
  }

  return seesEveryDeal(viewer.roleIds) ? FULL : { marketing: "none", backOffice: "none" };
}

/** Whether the viewer can open the deal at all. */
export function canOpenDeal(access: DealAccess): boolean {
  return access.marketing !== "none" || access.backOffice !== "none";
}
