/**
 * The roles & permissions model.
 *
 * Replaces a flat list of per-user booleans with five system roles plus
 * per-user overrides. Two rules govern everything below:
 *
 *   1. Effective permission = union of the assigned roles' defaults, with the
 *      user's overrides applied last. Improving a role's defaults therefore
 *      propagates to everyone who hasn't customized that permission.
 *   2. A record-scoped permission says what a person is *allowed* to do; it
 *      does not grant access to any record. Sharing decides which listings and
 *      deals they can open. Account-wide permissions need no record shared with
 *      them, so they take effect everywhere immediately.
 *
 * Prototype data: the roster, assignments, and overrides are seeded here and
 * mutated in a session-scoped store (see `useRoster`), not persisted.
 */

/**
 * Where a permission applies. Drives the two groups on the permissions page.
 */
export type PermissionScope = "record" | "account";

export interface Permission {
  id: string;
  /**
   * Short, verb-first label. Deliberately without the "Can " prefix every one
   * of these carries in the product today: twenty rows all starting with the
   * same word is twenty words of noise, and the page already says these are
   * things the person can do.
   */
  label: string;
  /**
   * Extra detail, revealed on hover — set only where the label genuinely leaves
   * something out. Most permissions say all they need to in their label, and
   * restating it under every row was the bulk of the page's text.
   */
  detail?: string;
  scope: PermissionScope;
  /**
   * "Group C" in the engineering plan: blanket toggles that reach into other
   * users' records, slated for replacement by record-level sharing.
   *
   * Deliberately not surfaced in the UI. These screens represent the model
   * we're moving to, and Group C is on its way out — badging them here would
   * ask admins to learn a distinction that's being deleted. Kept on the data so
   * the mapping to the plan survives; delete the field with the permissions if
   * they go away entirely.
   */
  blanket?: boolean;
}

/**
 * The 20 customer-facing permissions, in the order the mocks list them.
 * Record-scoped first, then account-wide.
 */
export const PERMISSIONS: Permission[] = [
  {
    id: "have-listings",
    label: "Own Listings",
    detail: "Be a primary or additional broker on listings.",
    scope: "record",
  },
  {
    id: "create-listings",
    label: "Create Listings",
    scope: "record",
  },
  {
    id: "edit-listings",
    label: "Edit Listings",
    detail: "Change a listing through the listing edit form.",
    scope: "record",
  },
  {
    id: "delete-listings",
    label: "Delete Listings",
    scope: "record",
  },
  {
    id: "change-deal-statuses",
    label: "Change Deal Statuses",
    detail: "Proposal and deal statuses, which feed vouchers and commissions.",
    scope: "record",
  },
  {
    id: "edit-comps",
    label: "Edit Comps",
    scope: "record",
  },
  {
    id: "access-other-listings",
    label: "Access Other Users' Listings",
    scope: "record",
    blanket: true,
  },
  {
    id: "access-other-comps",
    label: "Access Other Users' Comps",
    scope: "record",
    blanket: true,
  },
  {
    id: "view-other-documents",
    label: "View Other Users' Documents",
    detail: "Includes documents marked private.",
    scope: "record",
    blanket: true,
  },
  {
    id: "edit-other-documents",
    label: "Edit Other Users' Documents",
    scope: "record",
    blanket: true,
  },
  {
    id: "send-emails",
    label: "Send Emails",
    detail: "About their own listings.",
    scope: "record",
  },
  {
    id: "send-emails-other-listings",
    label: "Send Emails For Other Users' Listings",
    scope: "record",
    blanket: true,
  },
  {
    id: "edit-listing-website",
    label: "Edit Listing Websites",
    scope: "record",
  },
  {
    id: "add-custom-content",
    label: "Add Custom Content To Documents",
    detail: "Add new pages and elements beyond the template.",
    scope: "record",
  },
  {
    id: "non-branded-changes",
    label: "Make Non-Branded Changes In Documents",
    detail: "Use colors and fonts that depart from the company brand.",
    scope: "record",
  },
  {
    id: "manage-company",
    label: "Manage Company",
    detail: "Company info, users, permissions, and settings — including this page.",
    scope: "account",
  },
  {
    id: "edit-profile-photo",
    label: "Edit Profile Photo",
    scope: "account",
  },
  {
    id: "company-credentials",
    label: "Send Emails With Company Credentials",
    scope: "account",
  },
  {
    id: "other-user-credentials",
    label: "Send Emails With Other Users' Credentials",
    detail: "Sends as another person, with no audit trail of who actually sent it.",
    scope: "account",
    blanket: true,
  },
  {
    id: "access-other-saved-pages",
    label: "Access Other Users' Saved Pages",
    scope: "account",
    blanket: true,
  },
];

export const PERMISSION_BY_ID = new Map(PERMISSIONS.map((p) => [p.id, p]));

export type RoleId =
  | "broker"
  | "marketing-assistant"
  | "transaction-coordinator"
  | "office-admin"
  | "managing-director";

/**
 * How a role relates to records — shown as a tag beside the role in the
 * assign-roles picker, because it answers the question the permission list
 * can't: does this role bring its own records, or does it work by sharing?
 */
export type RoleAccessKind = "owns" | "firm-wide" | "sharing";

export const ROLE_ACCESS_LABELS: Record<RoleAccessKind, string> = {
  owns: "Owns records",
  "firm-wide": "Firm-wide view",
  sharing: "Works by sharing",
};

/**
 * What each access kind actually means, revealed on hover beside its badge.
 *
 * The `sharing` one is the load-bearing sentence in the whole panel: assigning
 * one of those roles grants abilities but opens nothing, so an admin who expects
 * it to give someone access to a deal needs to know to share the record too.
 */
export const ROLE_ACCESS_DETAIL: Record<RoleAccessKind, string> = {
  owns: "Can be the primary or an additional broker on listings, so they have a book of their own.",
  "firm-wide":
    "Sees across the whole company by default, rather than one record at a time.",
  sharing:
    "No records of their own. They can only act on listings and deals that have been shared with them.",
};

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  accessKind: RoleAccessKind;
  /** Permission ids this role turns on by default. */
  defaults: string[];
}

/**
 * The five system roles.
 *
 * Broker and Managing Director are derived from the mocks, which are internally
 * consistent: a Broker-only user shows 11 of 20 on, and Broker + Managing
 * Director unions to 16. Note the mocks and the engineering plan disagree on
 * two Managing Director defaults — the mocks give MD `view-other-documents` and
 * withhold `non-branded-changes`, the plan says the reverse. The mocks win here
 * because their counts reconcile.
 *
 * Marketing Assistant, Transaction Coordinator and Office Admin defaults are
 * inferred from the plan's per-permission notes rather than taken from a settled
 * spec. That used to be flagged in the UI; it now lives here and in the PR,
 * since the assign-role panel lists each role's exact defaults for review.
 */
export const ROLES: Role[] = [
  {
    id: "broker",
    name: "Broker",
    description: "Owns listings & deals; carries client relationships.",
    accessKind: "owns",
    defaults: [
      "have-listings",
      "create-listings",
      "edit-listings",
      "delete-listings",
      "change-deal-statuses",
      "edit-comps",
      "send-emails",
      "edit-listing-website",
      "add-custom-content",
      "edit-profile-photo",
      "company-credentials",
    ],
  },
  {
    id: "managing-director",
    name: "Managing Director",
    description: "Firm-wide oversight for compliance & governance.",
    accessKind: "firm-wide",
    defaults: [
      "access-other-listings",
      "access-other-comps",
      "view-other-documents",
      "manage-company",
      "edit-profile-photo",
      "access-other-saved-pages",
    ],
  },
  {
    id: "marketing-assistant",
    name: "Marketing Assistant",
    description: "Builds OMs, flyers, listing sites, email blasts.",
    accessKind: "sharing",
    defaults: [
      "edit-comps",
      "send-emails",
      "edit-listing-website",
      "add-custom-content",
      "edit-profile-photo",
      "company-credentials",
    ],
  },
  {
    id: "transaction-coordinator",
    name: "Transaction Coordinator",
    description: "Runs the close: escrow, title, wire, commission.",
    accessKind: "sharing",
    defaults: ["change-deal-statuses", "edit-profile-photo"],
  },
  {
    id: "office-admin",
    name: "Office Admin",
    description: "General admin, scheduling, data entry.",
    accessKind: "sharing",
    defaults: ["create-listings", "edit-profile-photo"],
  },
];

export const ROLE_BY_ID = new Map(ROLES.map((r) => [r.id, r]));

export function roleName(id: RoleId): string {
  return ROLE_BY_ID.get(id)?.name ?? id;
}

/** A per-user delta from the role defaults. Only differences are stored. */
export type PermissionOverrides = Record<string, boolean>;

/** How a permission ended up at its current value, for one user. */
export interface ResolvedPermission {
  permission: Permission;
  /** The effective answer to `can?`. */
  on: boolean;
  /** True when an override decided it, rather than the role defaults. */
  custom: boolean;
  /** What the roles alone would have said — the "reset to default" target. */
  roleDefault: boolean;
  /** Roles granting this permission, in ROLES order. Empty when none do. */
  grantedBy: RoleId[];
}

/** Union of the given roles' defaults — the value before overrides. */
export function roleDefaultFor(roleIds: RoleId[], permissionId: string): boolean {
  return roleIds.some((id) => ROLE_BY_ID.get(id)?.defaults.includes(permissionId));
}

/**
 * Whether one permission is effectively on — the same rule as
 * `resolvePermissions`, for callers that only need to ask about one thing.
 * This is the `can?` check enforcement reads.
 */
export function isPermissionOn(
  roleIds: RoleId[],
  overrides: PermissionOverrides,
  permissionId: string,
): boolean {
  const override = overrides[permissionId];
  if (override !== undefined) return override;
  return roleDefaultFor(roleIds, permissionId);
}

/** Which of the assigned roles grant a permission, for the "from Broker" line. */
export function grantingRoles(roleIds: RoleId[], permissionId: string): RoleId[] {
  return ROLES.filter(
    (role) => roleIds.includes(role.id) && role.defaults.includes(permissionId),
  ).map((role) => role.id);
}

/**
 * Resolve every permission for one user: role union first, override last.
 * Returns them in PERMISSIONS order so both groups keep the mocks' sequence.
 */
export function resolvePermissions(
  roleIds: RoleId[],
  overrides: PermissionOverrides,
): ResolvedPermission[] {
  return PERMISSIONS.map((permission) => {
    const roleDefault = roleDefaultFor(roleIds, permission.id);
    const override = overrides[permission.id];
    // An override matching the role default is not a customization — it's
    // redundant, so it must not light up the Custom chip or the changed count.
    const custom = override !== undefined && override !== roleDefault;
    return {
      permission,
      on: custom ? override : roleDefault,
      custom,
      roleDefault,
      grantedBy: grantingRoles(roleIds, permission.id),
    };
  });
}

export interface PermissionSummary {
  /** How many of the 20 are effectively on. */
  onCount: number;
  total: number;
  /** How many differ from what the roles alone would allow. */
  customCount: number;
}

export function summarize(resolved: ResolvedPermission[]): PermissionSummary {
  return {
    onCount: resolved.filter((r) => r.on).length,
    total: resolved.length,
    customCount: resolved.filter((r) => r.custom).length,
  };
}

/** How many permissions the roles alone allow — the assign-roles union count. */
export function roleUnionCount(roleIds: RoleId[]): number {
  return PERMISSIONS.filter((p) => roleDefaultFor(roleIds, p.id)).length;
}
