/**
 * What the signed-in user may *do* on a contact — the second half of the
 * ownership model. `contactOwnership.ts` says whose the record is and whether
 * it's hidden; this says what the viewer's relationship to it lets them do.
 *
 * Visibility and rights are separate. Under an open-book firm anyone can open
 * the record and read its history, but only the accountable person and the
 * people they've shared it with can act on it: log activity, edit fields, add
 * tasks or deals, reach out. A share carries a tier (View / Contributor /
 * Outreach) that decides how far those rights go. Everyone else is a reader who
 * can ask for a grant.
 */
import {
  ACCESS_TIERS,
  accessTierLabel,
  type AccessTier,
  type ContactShare,
} from "#/data/teammates";
import { viewerOwns, type ContactOwnership } from "#/data/contactOwnership";
import { viewerId } from "#/data/currentUser";

export type ContactRelationship = "owner" | "assignee" | "collaborator" | "none";

export interface ContactRights {
  relationship: ContactRelationship;
  /** The share tier, when the viewer is a collaborator. */
  tier?: AccessTier;
  /** Log notes, meetings, tours; complete tasks; act on timeline rows. */
  canLog: boolean;
  /** Edit fields, tags, Do Not Call; add tasks, deals, properties, lists. */
  canEdit: boolean;
  /** Call and email from the record — the crown jewel, so Outreach only. */
  canReachOut: boolean;
  /**
   * Grant access to others. The accountable person only, for now — George's
   * doc says anyone with access can share; DJ's rule says no tier reshares.
   * Open with both of them; the prototype keeps the narrower reading.
   */
  canShare: boolean;
  /** Short label for the viewer's standing, e.g. "Owner", "Contributor", "View only". */
  label: string;
  /**
   * Route a company-owned record to someone (or nobody). The Managing
   * Director's verb — Assign Contacts — plus the current assignee handing off
   * their own. Never true on a broker-owned record: there it's a transfer.
   */
  canAssign: boolean;
  /** Move a broker-owned record into another book. The owner's alone. */
  canTransfer: boolean;
}

type Working = Omit<ContactRights, "relationship" | "label" | "canAssign" | "canTransfer">;

const FULL: Working = {
  canLog: true,
  canEdit: true,
  canReachOut: true,
  canShare: true,
};

const NONE: Working = {
  canLog: false,
  canEdit: false,
  canReachOut: false,
  canShare: false,
};

export function resolveViewerRights(
  ownership: ContactOwnership,
  shares: ContactShare[],
  /** Whether the viewer holds Assign Contacts. */
  viewerCanAssign = false,
): ContactRights {
  const companyOwned = ownership.owner.kind === "company";
  // Assign exists only where the company owns; transfer only where a person does.
  const canAssign =
    companyOwned && (viewerCanAssign || ownership.assignee?.id === viewerId());
  if (viewerOwns(ownership)) {
    return { relationship: "owner", label: "Owner", ...FULL, canAssign: false, canTransfer: true };
  }
  // Company-owned and assigned to the viewer: the full working set, minus
  // ownership itself (they can't transfer it or take it with them).
  if (companyOwned && ownership.assignee?.id === viewerId()) {
    return { relationship: "assignee", label: "Assigned", ...FULL, canAssign, canTransfer: false };
  }
  const share = shares.find((s) => s.member.id === viewerId());
  if (share) {
    const caps = ACCESS_TIERS.find((t) => t.value === share.tier)?.capabilities;
    return {
      relationship: "collaborator",
      tier: share.tier,
      label: accessTierLabel(share.tier),
      canLog: caps?.logActivity ?? false,
      canEdit: caps?.editFields ?? false,
      canReachOut: caps?.sendEmail ?? false,
      canShare: caps?.reshare ?? false,
      canAssign,
      canTransfer: false,
    };
  }
  return { relationship: "none", label: "View only", ...NONE, canAssign, canTransfer: false };
}

/**
 * Whether the viewer may know this record exists. Privacy includes existence:
 * a private contact is invisible — search, lists, duplicate checks, the
 * assistant — to everyone but its owner, the people it's shared with (any
 * tier), and a viewer holding View Private Contacts. A visible record is
 * visible to the whole firm; rights decide what they can do with it.
 */
export function canSeeContact(
  ownership: ContactOwnership,
  shares: ContactShare[],
  seesPrivate: boolean,
): boolean {
  if (!ownership.isPrivate) return true;
  if (seesPrivate || viewerOwns(ownership)) return true;
  return shares.some((s) => s.member.id === viewerId());
}

/**
 * Who a reader asks for access: the owner when a person owns it, the assignee
 * when the company does, and leadership when nobody's been assigned yet.
 */
export function accountableName(ownership: ContactOwnership): string {
  if (ownership.owner.kind === "person") return ownership.owner.user.name;
  return ownership.assignee?.name ?? "a Managing Director";
}
