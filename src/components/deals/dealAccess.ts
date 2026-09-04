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
 * The deal team is its internal brokers, and they have it all. Outside brokers are excluded: a co-broking agent is not on the firm's
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

/**
 * The lease family around a listing, when it has one.
 *
 * Marketing belongs to the building and money belongs to the space, so
 * resolving either half needs a record the listing itself does not carry: a
 * space needs its shell, a shell needs its spaces. Passed in rather than read,
 * because this module stays pure — `useDealAccess` does the store work.
 *
 * Never both at once: a listing is a shell or a space, never the two.
 */
export interface DealFamily {
  /** The shell this space hangs under. Undefined for a top-level deal. */
  shell?: Listing;
  /** Shares granted on that shell — the only share list a space ever reads. */
  shellShares?: DealShare[];
  /** A shell's child space deals. Set only when `listing` is the shell. */
  spaces?: Listing[];
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

/**
 * True when the viewer works this deal as one of its internal brokers.
 *
 * `createdById` is deliberately *not* consulted. It used to be, on the
 * assumption that whoever opened a deal works it — which held while only
 * brokers could create one. A marketing person with Create Listings opens deals
 * they must never see the voucher of, so the creator field is an audit fact and
 * the broker list is the team. A marketing creator keeps the deal they built
 * through the marketing share the create flow grants them, not through having
 * typed it in.
 */
function onDealTeam(listing: Listing, viewer: AccessViewer): boolean {
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
 * What a share opens for this viewer, capped by what their role may edit.
 *
 * Lifted out of `dealAccessFor` because a space resolves its share against its
 * shell's list rather than its own, so the cap now runs on one of two lists.
 */
function sharedLevel(shares: DealShare[], viewer: AccessViewer): AccessLevel {
  const share = shares.find((s) => s.member.id === viewer.id);
  if (!share) return "none";
  return share.level === "contribute" && canEditMarketing(viewer) ? "contribute" : "view";
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

/** Stable empty list, so the filter above allocates nothing per unshared deal. */
const NO_SHARES: DealShare[] = [];

/**
 * What this viewer may do on this deal — the one function the whole feature
 * rests on. Pure, so it is testable without a store or a browser.
 *
 * **Marketing resolves on the shell. Money resolves on the space.** A lease
 * building is a shell deal and each rented suite is its own child deal, so the
 * two halves of one page answer to two different records:
 *
 *  1. **Marketing** is the building's — the website, documents, email and
 *     demographics only exist there. Working any suite in a building therefore
 *     opens the building, and being on the building's team opens every suite's
 *     marketing. It stops at the building: a broker on Suite 3 reaches nothing
 *     on Suite 4, or a large building would fill every one of its brokers'
 *     deal indexes with suites they do not work.
 *  2. **Money** is the suite's. Only its own broker team reaches its voucher —
 *     the shell's team does not, because the shell owns the assignment and the
 *     suite owns the transaction. A shell has no voucher at all: `backOffice`
 *     there means "may open the Vouchers index", and the index filters per row.
 *
 * A share is unchanged and still never touches the back office. It now always
 * hangs on the building, so a space reads `family.shellShares`.
 *
 * A deal with no family — every sale deal and every unsplit lease deal —
 * resolves exactly as it did before this argument existed.
 *
 * A viewer with no roster row falls through to full access rather than none: we
 * cannot resolve a ceiling for someone we can't find, and blanking the deal page
 * over a missing row is a worse failure than showing it.
 */
export function dealAccessFor(
  listing: Listing,
  viewer: AccessViewer | undefined,
  shares: DealShare[],
  family: DealFamily = {},
): DealAccess {
  if (!viewer) return FULL;

  const onThis = onDealTeam(listing, viewer);
  const onShell = family.shell ? onDealTeam(family.shell, viewer) : false;
  const onAnySpace = (family.spaces ?? []).some((s) => onDealTeam(s, viewer));
  // A lease deal is a shell only once it has children — before that it is a
  // normal deal and resolves as one. This mirrors `dealShape`'s rule but isn't
  // literally it: `dealShape` also requires `dealType === 'Lease'`, and the two
  // converge today only because `addSpaceToDeal` is the sole writer of
  // `parentDealId`. This file stays pure and React-free, so it doesn't import
  // `dealShape`, which reads the store.
  const isShell = listing.parentDealId == null && (family.spaces?.length ?? 0) > 0;

  const role = roleAccess(viewer);
  // Marketing is the building's, so a space reads its shell's share list and
  // never its own. Every other shape reads the list it was handed.
  const marketingShares = family.shell ? (family.shellShares ?? NO_SHARES) : shares;

  return {
    marketing:
      onThis || onShell || (isShell && onAnySpace)
        ? "contribute"
        : higher(role.marketing, sharedLevel(marketingShares, viewer)),
    backOffice: isShell
      ? higher(onAnySpace ? "view" : "none", role.backOffice)
      : onThis
        ? "contribute"
        : role.backOffice,
  };
}

/** Whether the viewer can open the deal at all. */
export function canOpenDeal(access: DealAccess): boolean {
  return access.marketing !== "none" || access.backOffice !== "none";
}

/**
 * The deals this viewer may know exist — every enumeration of the book goes
 * through here, the way `visibleContacts` gates the contact book.
 *
 * It asks exactly the question the deal page asks, family included: a suite
 * broker's index is their building plus the suites they work, and a
 * neighbouring suite's card does not appear. The two lookup maps are built once
 * rather than per row — a book of 27 listings scanned per listing is 27 scans
 * to answer one question.
 *
 * Listing a deal the viewer cannot open would be a row that goes nowhere, and
 * on a book of business the row itself is the leak — the address and the price
 * are on the card.
 */
export function visibleDeals(
  listings: Listing[],
  viewer: AccessViewer | undefined,
  shares: ReadonlyMap<string, DealShare[]>,
): Listing[] {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const spacesByShell = new Map<string, Listing[]>();
  for (const l of listings) {
    if (l.parentDealId == null) continue;
    const kids = spacesByShell.get(l.parentDealId);
    if (kids) kids.push(l);
    else spacesByShell.set(l.parentDealId, [l]);
  }

  return listings.filter((l) => {
    const shell = l.parentDealId ? byId.get(l.parentDealId) : undefined;
    const family: DealFamily = shell
      ? { shell, shellShares: shares.get(shell.id) ?? NO_SHARES }
      : { spaces: spacesByShell.get(l.id) };
    return canOpenDeal(dealAccessFor(l, viewer, shares.get(l.id) ?? NO_SHARES, family));
  });
}
