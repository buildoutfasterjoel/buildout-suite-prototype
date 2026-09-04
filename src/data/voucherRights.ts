/**
 * Who may see, edit and sign off a commission voucher.
 *
 * Two questions, kept apart on purpose:
 *
 *   1. **Is this voucher mine?** A voucher belongs to the deal team — the person
 *      who opened the deal plus its internal brokers. That needs no permission:
 *      a broker sees their own book because they are on it.
 *   2. **May I reach past my own?** That is the three permissions below. They
 *      say what a person is *allowed* to do, in the model's usual sense — see
 *      the header of `permissions.ts`.
 *
 * Pure and React-free so it pins in Vitest's node environment. The hooks that
 * read the live viewer are `useCan` (settings/users/useViewer) at each call
 * site; nothing here touches the store or the DOM.
 */
import {
  isPermissionOn,
  type PermissionOverrides,
  type RoleId,
} from "#/data/permissions";
import { teammateIdByName } from "#/data/teammates";
import type { DealBroker, Listing } from "#/data/types";

/** See every voucher on the book, not only the ones you are on the team for. */
export const VIEW_OTHER_VOUCHERS = "view-other-vouchers";
/** Change a voucher that belongs to someone else — including while it is Pending. */
export const EDIT_OTHER_VOUCHERS = "edit-other-vouchers";
/** Move a Pending voucher to Approved. */
export const APPROVE_VOUCHERS = "approve-vouchers";

/**
 * The deal team, as teammate ids — the people whose voucher this is.
 *
 * Outside brokers are dropped: a co-broking agent is not on the firm's books
 * and has no seat in the app, so `teammateIdByName` finds nobody for them.
 * Mirrors the rule `components/deals/dealAccess.ts` draws the header avatars
 * from; that module answers "which faces", this one answers "which ids".
 */
export function voucherTeamIds(deal: Listing): string[] {
  const ids = new Set<string>([deal.createdById]);
  for (const broker of deal.internalBrokers) {
    const id = teammateIdByName(broker.name);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Whether a viewer may open one voucher.
 *
 * Team membership first, then the permission — so revoking View Other Users'
 * Vouchers never hides a person's own work from them.
 */
export function canSeeVoucher(
  teamIds: readonly string[],
  viewerId: string,
  canViewOthers: boolean,
): boolean {
  return canViewOthers || teamIds.includes(viewerId);
}

/** The shape `voucherApproverIds` needs — a roster row, minus everything else. */
export interface ApproverCandidate {
  id: string;
  roleIds: RoleId[];
  overrides: PermissionOverrides;
  status: "active" | "deactivated";
}

/**
 * Everyone who may sign a voucher off, in roster order.
 *
 * Derived rather than listed: a hardcoded roster of approvers and the
 * permissions page can disagree, and when they do the page is the one people
 * believe. Deactivated users are dropped — they cannot sign in to approve
 * anything.
 *
 * Note this is not gated on the deal: "a broker cannot approve their own deal"
 * falls out of the role defaults, since no role carrying Approve Vouchers also
 * owns listings.
 */
export function voucherApproverIds(users: readonly ApproverCandidate[]): string[] {
  return users
    .filter(
      (u) =>
        u.status === "active" &&
        isPermissionOn(u.roleIds, u.overrides, APPROVE_VOUCHERS),
    )
    .map((u) => u.id);
}

/**
 * Whether this viewer may see one broker's **payout** — their commission plan,
 * their personal split, and the net that falls out of the two.
 *
 * Narrower than `canSeeVoucher`, and deliberately so. A deal's gross commission
 * is the deal's business: every internal broker on it sees the pool, the
 * pre-split deductions, the outside brokers, and each internal broker's gross
 * slice. What a broker keeps *after* the house takes its share is not the deal's
 * business — it is the arrangement between that person and the brokerage. So it
 * is symmetric: a broker sees their own plan and nobody else's, the person who
 * opened the deal included.
 *
 * Two exemptions:
 *
 *  - `canViewOthers` — View Other Users' Vouchers. The back office cuts the
 *    cheques, so it has to see every payout. No new permission for this; the one
 *    that already governs reaching past your own voucher is the right one.
 *  - An **outside** broker. Their split is an arrangement between two firms,
 *    not a colleague's personal comp, and nobody in the app is them — so hiding
 *    it would hide it from everyone forever. They never appear in the internal
 *    commissions table anyway; only in Payables.
 */
export function canSeeBrokerPayout(
  broker: Pick<DealBroker, "name" | "side">,
  viewerId: string,
  canViewOthers: boolean,
): boolean {
  if (canViewOthers) return true;
  if (broker.side === "outside") return true;
  return teammateIdByName(broker.name) === viewerId;
}
