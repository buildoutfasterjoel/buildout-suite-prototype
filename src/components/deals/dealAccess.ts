import {
  CURRENT_USER,
  findTeammate,
  teammateIdByName,
  type Teammate,
} from "#/data/teammates";
import type { DealBroker, Listing } from "#/data/types";
import {
  isPermissionOn,
  type PermissionOverrides,
  type RoleId,
} from "#/data/permissions";
import {
  BACK_OFFICE_EDIT_PERMISSION,
  BACK_OFFICE_VIEW_PERMISSION,
  MARKETING_EDIT_PERMISSIONS,
  MARKETING_VIEW_PERMISSION,
  type DealShare,
} from "#/data/dealShares";

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

/** Everything, both halves — the deal team's access. */
const FULL: DealAccess = { marketing: "contribute", backOffice: "contribute" };

const RANK: Record<AccessLevel, number> = { none: 0, view: 1, contribute: 2 };

/** The more open of two levels. A share raises what a role already granted. */
function higher(a: AccessLevel, b: AccessLevel): AccessLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

/** The slice of a roster row this needs. Kept structural so tests can fake it. */
export interface AccessViewer {
  id: string;
  name: string;
  roleIds: RoleId[];
  overrides: PermissionOverrides;
}

const can = (viewer: AccessViewer, permissionId: string) =>
  isPermissionOn(viewer.roleIds, viewer.overrides, permissionId);

/** True when the viewer created the deal or works it as an internal broker. */
function onDealTeam(listing: Listing, viewer: AccessViewer): boolean {
  if (listing.createdById === viewer.id) return true;
  return listing.internalBrokers.some((b) => b.name === viewer.name);
}

/**
 * Whether this person's role lets them edit marketing at all — the ceiling a
 * share cannot exceed. Exported because the share modal disables "Can edit" and
 * needs to say why before anything is granted.
 */
export function canEditMarketing(viewer: AccessViewer): boolean {
  return MARKETING_EDIT_PERMISSIONS.some((id) => can(viewer, id));
}

/**
 * What a role alone opens on a deal its holder is not on — read straight from
 * the two permissions that name it, rather than from `accessKind`.
 *
 * That distinction is the whole reason a Back Office Manager works: they hold
 * `view-other-vouchers` and not `access-other-listings`, so they get the
 * voucher on every deal in the firm and none of the marketing — which is
 * exactly what the back office is for. A Managing Director holds both and keeps
 * seeing everything. A Broker holds neither, which is what `accessKind: "owns"`
 * has always claimed: a book of their own, not a window onto everyone else's.
 *
 * Editing follows the same split. `edit-other-vouchers` is the Back Office
 * Manager's alone, so a Managing Director reaches a voucher at `view` — they
 * sign work off, they do not type it.
 */
function roleAccess(viewer: AccessViewer): DealAccess {
  return {
    marketing: can(viewer, MARKETING_VIEW_PERMISSION)
      ? canEditMarketing(viewer)
        ? "contribute"
        : "view"
      : "none",
    backOffice: can(viewer, BACK_OFFICE_VIEW_PERMISSION)
      ? can(viewer, BACK_OFFICE_EDIT_PERMISSION)
        ? "contribute"
        : "view"
      : "none",
  };
}

/**
 * What this viewer may do on this deal — the one function the whole feature
 * rests on. Pure, so it is testable without a store or a browser.
 *
 * Rules, in order:
 *
 *  1. **On the deal team** — the creator or an internal broker — gets both
 *     halves. (What the *voucher* then shows them of a colleague's payout is a
 *     narrower question, answered by `canSeeBrokerPayout`.)
 *  2. **Everyone else** starts from what their role opens firm-wide, and a
 *     share raises the marketing half on top of it — capped by the same role.
 *     A share never touches the back office: sharing a deal shares its
 *     marketing, and the voucher is not a broker's to hand out.
 *
 * The share is a floor, not a replacement, so sharing a deal's marketing with a
 * Back Office Manager cannot take away the voucher their role already reaches.
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

  const role = roleAccess(viewer);
  const share = shares.find((s) => s.member.id === viewer.id);
  if (!share) return role;

  const shared: AccessLevel =
    share.level === "contribute" && canEditMarketing(viewer) ? "contribute" : "view";
  return { marketing: higher(role.marketing, shared), backOffice: role.backOffice };
}

/** Whether the viewer can open the deal at all. */
export function canOpenDeal(access: DealAccess): boolean {
  return access.marketing !== "none" || access.backOffice !== "none";
}
