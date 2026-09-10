/**
 * The roles & permissions model.
 *
 * Replaces a flat list of per-user booleans with six system roles plus
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
 * Where a permission applies. Used to be the grouping on the permissions page,
 * which now groups by product area instead. Not shown per row at the moment
 * (`ScopeTag` in roleDisplay.tsx is kept for if it comes back); the model still
 * hangs on it — it says whether sharing is involved.
 */
export type PermissionScope = "record" | "account";

/**
 * The product area a permission belongs to. Drives the groups on the
 * permissions page and in the assign-role panel, in `PERMISSION_AREAS` order.
 *
 * Grouping moved from record-vs-account scope to product area (2026-09-09)
 * because scope is the model's rule but not how an admin thinks: they arrive
 * asking "can she build documents?" or "does he use Back Office?", and the
 * permissions inventory the product team maintains is already organised this
 * way. Scope still matters — it says whether sharing is involved — it is just
 * no longer a word on every row.
 */
export type PermissionArea =
  | "listings"
  | "back-office"
  | "documents"
  | "email"
  | "comps"
  | "contacts"
  | "company";

export interface PermissionAreaMeta {
  id: PermissionArea;
  heading: string;
  /** One line on what the group covers, revealed on hover beside the heading. */
  blurb: string;
}

export const PERMISSION_AREAS: PermissionAreaMeta[] = [
  {
    id: "listings",
    heading: "Listings & Deals",
    blurb:
      "Listings and deals are one record in Suite, so deleting, moving a deal's status and reaching other users' records cover both.",
  },
  {
    id: "back-office",
    heading: "Back Office",
    blurb:
      "Commission vouchers, payables and receivables. Use Back Office is the master switch for the voucher rows.",
  },
  {
    id: "documents",
    heading: "Documents",
    blurb:
      "OMs, flyers and saved pages. Edit Documents is the master switch for the rows beneath it.",
  },
  {
    id: "email",
    heading: "Email",
    blurb:
      "Marketing emails. Send Emails is the master switch; the other three do nothing without it.",
  },
  {
    id: "comps",
    heading: "Comps",
    blurb: "Sale and lease comps, their own and other users'.",
  },
  {
    id: "contacts",
    heading: "Contacts",
    blurb:
      "Ownership, privacy and assignment. Two of these are capped by Contact Ownership and Contact Privacy in Company settings.",
  },
  {
    id: "company",
    heading: "Company & Account",
    blurb: "Company administration and the person's own profile.",
  },
];

export const PERMISSION_AREA_BY_ID = new Map(
  PERMISSION_AREAS.map((a) => [a.id, a]),
);

/**
 * A company-level toggle that caps a permission. The account setting is the
 * ceiling, the permission is the grant: while the gate is closed the permission
 * is off for everyone and locked on the permissions page, with the role
 * defaults and overrides left intact underneath. Resolution lives in
 * `contactAccess.ts`, which also holds the settings themselves.
 */
export type CompanyGateId = "contact-ownership" | "contact-privacy";

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
  /** Product area, for grouping — see `PERMISSION_AREAS`. */
  area: PermissionArea;
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
  /** Company setting that caps this permission — see `CompanyGateId`. */
  gate?: CompanyGateId;
}

/**
 * The 32 customer-facing permissions, grouped by product area in
 * `PERMISSION_AREAS` order and, within an area, in the order the permissions
 * inventory lists them: the base ability first, then the "other users'"
 * extensions, then the admin-grade one.
 *
 * Reconciled against the product team's permissions inventory on 2026-09-09.
 * That pass added five (Use Back Office, Administrate Back Office, Edit
 * Documents, Share Document Links That Bypass the CA, Manage All Contacts &
 * Lists) and widened two labels to say "Listings & Deals", since a listing and
 * a deal are one record in Suite. Ids are stable across the relabel so seeded
 * overrides and enforcement keep working.
 *
 * Deliberately not here, from the same inventory: the SVN royalty-statement and
 * NAI shared-deals flags stay per-company customizations Buildout turns on;
 * "brokers can view receivables" and "manage document defaults" are company
 * settings, not user permissions; and `can_view_other_users_properties` is a
 * dead flag enforced nowhere.
 */
export const PERMISSIONS: Permission[] = [
  // ── Listings & Deals ─────────────────────────────────────────────────────
  // "& Deals" on Own and Create, not on Edit: a listing and its deal are one
  // record, and these two grant the whole of it — Own is what lets someone be
  // named a deal's broker, Create is the Create Deal button. Edit Listings stays
  // narrow because it gates only the listing (marketing) form; the deal half is
  // moved through Change Deal Statuses and reached through sharing.
  {
    id: "have-listings",
    label: "Own Listings & Deals",
    detail: "Be a primary or additional broker on listings and deals.",
    scope: "record",
    area: "listings",
  },
  {
    id: "create-listings",
    label: "Create Listings & Deals",
    scope: "record",
    area: "listings",
  },
  {
    id: "edit-listings",
    label: "Edit Listings",
    detail: "Change a listing through the listing edit form.",
    scope: "record",
    area: "listings",
  },
  {
    id: "delete-listings",
    label: "Delete Listings & Deals",
    detail:
      "A listing and its deal are one record, so this removes both. The inventory folds the old Delete Deals into it.",
    scope: "record",
    area: "listings",
  },
  {
    id: "edit-listing-website",
    label: "Edit Listing Websites",
    detail: "Publish buttons and the website settings tab.",
    scope: "record",
    area: "listings",
  },
  // With the listing rows rather than under Back Office: moving a deal along
  // the pipeline is how a broker works the record, the same act as editing it.
  // It still feeds commissions — the detail says so — but the voucher rows
  // below are the back-office job; this one is the broker's.
  {
    id: "change-deal-statuses",
    label: "Change Deal Statuses",
    detail:
      "Pipeline drag and the status fields on deals and vouchers, which feed commissions.",
    scope: "record",
    area: "listings",
  },
  {
    id: "access-other-listings",
    label: "Access Other Users' Listings & Deals",
    detail:
      "Open and edit records that belong to the selected users or offices. Absorbs the product's separate Edit Other Users' Deals.",
    scope: "record",
    area: "listings",
    blanket: true,
  },

  // ── Back Office ──────────────────────────────────────────────────────────
  // Use Back Office is the master switch: it says "this person uses Back
  // Office at all" and is the prerequisite for the voucher rows under it. The
  // three voucher permissions sit together because they are one job: a voucher
  // is the brokerage paying itself, and the back office reads, corrects and
  // signs off work that is never its own.
  {
    id: "use-back-office",
    label: "Use Back Office",
    detail:
      "Create and view their own commission vouchers. The prerequisite for every other Back Office permission.",
    scope: "record",
    area: "back-office",
  },
  {
    id: "view-other-vouchers",
    label: "View Other Users' Vouchers",
    detail: "See every voucher on the book, not only the deals they are on.",
    scope: "record",
    area: "back-office",
    blanket: true,
  },
  {
    id: "edit-other-vouchers",
    label: "Edit Other Users' Vouchers",
    detail:
      "Correct a voucher that belongs to someone else, including while it sits Pending and the broker who submitted it is locked out.",
    scope: "record",
    area: "back-office",
    blanket: true,
  },
  {
    id: "approve-vouchers",
    label: "Approve Vouchers",
    detail: "Sign off a Pending voucher. A broker cannot approve their own deal.",
    scope: "record",
    area: "back-office",
  },
  {
    id: "administrate-back-office",
    label: "Administrate Back Office",
    detail:
      "All of the company's vouchers, payables and receivables. Includes Use Back Office.",
    scope: "account",
    area: "back-office",
  },

  // ── Documents ────────────────────────────────────────────────────────────
  {
    id: "edit-documents",
    label: "Edit Documents",
    detail:
      "Create and edit OMs and flyers on their own listings. The base the other document permissions build on.",
    scope: "record",
    area: "documents",
  },
  {
    id: "view-other-documents",
    label: "View Other Users' Documents",
    detail: "Includes documents marked private.",
    scope: "record",
    area: "documents",
    blanket: true,
  },
  {
    id: "edit-other-documents",
    label: "Edit Other Users' Documents",
    scope: "record",
    area: "documents",
    blanket: true,
  },
  {
    id: "add-custom-content",
    label: "Add Custom Content To Documents",
    detail: "Add new pages and elements beyond the template.",
    scope: "record",
    area: "documents",
  },
  {
    id: "non-branded-changes",
    label: "Make Non-Branded Changes In Documents",
    detail: "Use colors and fonts that depart from the company brand.",
    scope: "record",
    area: "documents",
  },
  {
    id: "access-other-saved-pages",
    label: "Access Other Users' Saved Pages",
    detail: "Every saved page across the company, not just their own.",
    scope: "account",
    area: "documents",
    blanket: true,
  },
  {
    id: "bypass-ca-link",
    label: "Share Document Links That Bypass the CA",
    detail:
      "Generate an all-access public link that skips the confidentiality agreement.",
    scope: "record",
    area: "documents",
  },

  // ── Email ────────────────────────────────────────────────────────────────
  {
    id: "send-emails",
    label: "Send Emails",
    detail: "Marketing emails about their own listings.",
    scope: "record",
    area: "email",
  },
  {
    id: "send-emails-other-listings",
    label: "Send Emails For Other Users' Listings",
    scope: "record",
    area: "email",
    blanket: true,
  },
  {
    id: "company-credentials",
    label: "Send Emails With Company Credentials",
    detail: "Send from the company's shared identity.",
    scope: "account",
    area: "email",
  },
  {
    id: "other-user-credentials",
    label: "Send Emails With Other Users' Credentials",
    detail: "Sends as another person, with no audit trail of who actually sent it.",
    scope: "account",
    area: "email",
    blanket: true,
  },

  // ── Comps ────────────────────────────────────────────────────────────────
  {
    id: "edit-comps",
    label: "Edit Comps",
    detail: "Create and edit sale and lease comps.",
    scope: "record",
    area: "comps",
  },
  {
    id: "access-other-comps",
    label: "Access Other Users' Comps",
    detail: "Scoped to the selected users.",
    scope: "record",
    area: "comps",
    blanket: true,
  },

  // ── Contacts ─────────────────────────────────────────────────────────────
  {
    id: "own-contacts",
    label: "Own Contacts",
    detail:
      "Contacts they create or import belong to them rather than the company. The contacts analog of Own Listings.",
    scope: "record",
    area: "contacts",
    gate: "contact-ownership",
  },
  {
    id: "private-contacts",
    label: "Mark Contacts Private",
    detail:
      "Hide a contact they own from the rest of the firm — search included — until they share it.",
    scope: "record",
    area: "contacts",
    gate: "contact-privacy",
  },
  {
    id: "view-private-contacts",
    label: "View Private Contacts",
    detail:
      "See the contact behind a \u201cPrivate Contact\u201d placeholder. Never includes notes a teammate marked private — authorship governs those.",
    scope: "record",
    area: "contacts",
    gate: "contact-privacy",
  },
  {
    id: "assign-contacts",
    label: "Assign Contacts",
    detail:
      "Route a company-owned contact to the person who'll work it, or re-route it. The current assignee can hand off their own without this.",
    scope: "record",
    area: "contacts",
  },
  {
    id: "manage-all-contacts",
    label: "Manage All Contacts & Lists",
    detail:
      "View and manage every list and contact in the company. Marketing Admin in the product today.",
    scope: "account",
    area: "contacts",
  },

  // ── Company & Account ────────────────────────────────────────────────────
  {
    id: "manage-company",
    label: "Manage Company",
    detail: "Company info, users, permissions, and settings — including this page.",
    scope: "account",
    area: "company",
  },
  {
    id: "edit-profile-photo",
    label: "Edit Profile Photo",
    scope: "account",
    area: "company",
  },
];

export const PERMISSION_BY_ID = new Map(PERMISSIONS.map((p) => [p.id, p]));

export type RoleId =
  | "broker"
  | "back-office-manager"
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
 * The six system roles.
 *
 * Broker and Managing Director are derived from the mocks, which are internally
 * consistent: a Broker-only user shows 11 of 20 on, and Broker + Managing
 * Director unions to 16. Note the mocks and the engineering plan disagree on
 * two Managing Director defaults — the mocks give MD `view-other-documents` and
 * withhold `non-branded-changes`, the plan says the reverse. The mocks win here
 * because their counts reconcile.
 *
 * Back Office Manager is newer than the mocks: it exists because the voucher
 * approval flow needed an actor, and its defaults are the three voucher
 * permissions plus what signing off actually requires. Marketing Assistant,
 * Transaction Coordinator and Office Admin defaults are inferred from the plan's
 * per-permission notes rather than taken from a settled spec. That used to be flagged in the UI; it now lives here and in the PR,
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
      // A broker raises the voucher on their own deal, so they use Back Office
      // without seeing anyone else's book.
      "use-back-office",
      "edit-comps",
      "send-emails",
      "edit-listing-website",
      "edit-documents",
      "add-custom-content",
      // The two contact-ownership grants. On by default for the role that
      // brings its own book; the company ceilings in `contactAccess.ts` decide
      // whether the grant means anything, and the company's grant default can
      // suppress this so the grant is handed out per person instead.
      "own-contacts",
      "private-contacts",
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
      // Contacts differ from listings here: a Managing Director can own and
      // protect a book of their own (a producing MD is a normal person in
      // brokerage), and by default sees through "Private Contact" placeholders.
      // George's model lists all three as permissions an MD configures, with
      // nothing withholding ownership from the role itself; the earlier
      // Broker-only default was borrowed from Own Listings, not from the docs.
      "own-contacts",
      "private-contacts",
      "view-private-contacts",
      // Assignment is the Managing Director's verb under company ownership.
      "assign-contacts",
      // Every list and contact in the company — the product's Marketing Admin,
      // which sits naturally with firm-wide oversight.
      "manage-all-contacts",
      // Vouchers: an MD sees the whole book and signs off, but does not do the
      // typing. Edit Other Users' Vouchers is the Back Office Manager's, so a
      // Pending voucher stays frozen under an MD's eyes while they approve it.
      // Use Back Office is the prerequisite for both.
      "use-back-office",
      "view-other-vouchers",
      "approve-vouchers",
      "manage-company",
      "edit-profile-photo",
      "access-other-saved-pages",
    ],
  },
  {
    id: "back-office-manager",
    name: "Back Office Manager",
    description: "Approves vouchers and runs the back office.",
    accessKind: "firm-wide",
    defaults: [
      // The voucher trio, which is the whole reason the role exists: read the
      // firm's book, correct what a broker submitted, and sign it off — plus
      // the master switch they sit under and the admin-grade permission that
      // reaches payables and receivables.
      "use-back-office",
      "view-other-vouchers",
      "edit-other-vouchers",
      "approve-vouchers",
      "administrate-back-office",
      // Closing a deal is what raises the voucher, and the back office is who
      // finds out the stage was never moved.
      "change-deal-statuses",
      "edit-profile-photo",
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
      "edit-documents",
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
    // Commission is part of the close, so a coordinator raises vouchers on the
    // deals shared with them.
    defaults: ["change-deal-statuses", "use-back-office", "edit-profile-photo"],
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
 * Returns them in PERMISSIONS order, so callers grouping by area keep the
 * registry's sequence within each group.
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
  /** How many of the registry are effectively on. */
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
