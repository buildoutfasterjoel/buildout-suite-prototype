/**
 * The company roster for Company settings → Users.
 *
 * Built on the prototype's existing people (`teammates.ts`) so this screen shows
 * the same faces as contact sharing and the avatars elsewhere in the app, rather
 * than a second fictional cast. Each person gains what the roles & permissions
 * model needs: assigned roles, per-user overrides, a status, and an office.
 *
 * Edits live in `useRoster` (components/settings/users) for the length of a
 * session — nothing is persisted, so a reload returns to this seed. The store
 * lives elsewhere so this module stays React-free and testable in Vitest's node
 * environment.
 */
import { CURRENT_USER, TEAMMATES, type Teammate } from "#/data/teammates";
import { readStoredViewer } from "#/data/currentUser";
import type { PermissionOverrides, RoleId } from "#/data/permissions";

export type UserStatus = "active" | "deactivated";

/**
 * Offices are display-only for now: a column and a filter on the roster, with no
 * bearing on permissions. Real office configuration is its own settings section
 * (and the engineering plan keeps `office_admin` out of role defaults in v1), so
 * this is deliberately just a label to filter by.
 */
export const OFFICES = [
  "Chicago — West Loop",
  "Chicago — River North",
  "Denver",
  "Austin",
  "Atlanta",
];

export interface RosterUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  /** Job title, shown under the name on the permissions page. */
  title: string;
  /** One of OFFICES. Display-only — see the note above. */
  office: string;
  roleIds: RoleId[];
  overrides: PermissionOverrides;
  status: UserStatus;
  /** True for the signed-in user — gets the YOU badge. */
  isYou?: boolean;
}

/** Everyone the roster draws from, current user first. */
const PEOPLE: Teammate[] = [CURRENT_USER, ...TEAMMATES];

type Assignment = {
  title: string;
  office: string;
  roleIds: RoleId[];
  overrides?: PermissionOverrides;
  status?: UserStatus;
};

/**
 * Role assignments per person — exactly one role each, which is the product rule
 * the assign-roles panel enforces. (The resolver still unions a list, so the
 * engine is ready if that rule ever relaxes; see `resolvePermissions`.)
 *
 * Diana Reyes carries the customized case: a Managing Director with three
 * overrides — one removed that her role allows, two granted beyond it — so the
 * Custom chips, the "changed from the role default" count, and the per-row
 * override controls all have something real to render. Maya Brooks is the
 * deactivated row.
 *
 * Offices are spread across the list so the filter has more than one bucket to
 * show, with the two Chicago offices carrying most people.
 */
const ASSIGNMENTS: Record<string, Assignment> = {
  you: {
    title: "Managing Director",
    office: "Chicago — West Loop",
    roleIds: ["managing-director"],
  },
  "sarah-chen": {
    title: "Broker",
    office: "Chicago — West Loop",
    roleIds: ["broker"],
  },
  "marcus-patel": {
    title: "Broker",
    office: "Chicago — River North",
    roleIds: ["broker"],
  },
  "diana-reyes": {
    title: "Principal",
    office: "Chicago — West Loop",
    roleIds: ["managing-director"],
    overrides: {
      // Removed even though Managing Director would allow it.
      "view-other-documents": false,
      // Granted beyond the role.
      "edit-listings": true,
      "other-user-credentials": true,
    },
  },
  "riley-park": {
    title: "Office Admin",
    office: "Chicago — West Loop",
    roleIds: ["office-admin"],
  },
  "maya-brooks": {
    title: "Marketing Assistant",
    office: "Denver",
    roleIds: ["marketing-assistant"],
    status: "deactivated",
  },
  "omar-haddad": {
    title: "Transaction Coordinator",
    office: "Chicago — River North",
    roleIds: ["transaction-coordinator"],
    // Vouchers are the TC's job, but the close often needs the listing edited too.
    overrides: { "edit-listings": true },
  },
  "nina-alvarez": {
    title: "Broker",
    office: "Austin",
    roleIds: ["broker"],
  },
  "priya-nair": {
    title: "Managing Director",
    office: "Atlanta",
    roleIds: ["managing-director"],
  },
};

export const SEED_ROSTER: RosterUser[] = PEOPLE.map((person) => {
  const assignment = ASSIGNMENTS[person.id] ?? {
    title: person.role,
    office: OFFICES[0],
    roleIds: ["broker" as RoleId],
  };
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    initials: person.initials,
    avatarUrl: person.avatarUrl,
    title: assignment.title,
    office: assignment.office,
    roleIds: assignment.roleIds,
    overrides: assignment.overrides ?? {},
    status: assignment.status ?? "active",
    isYou: person.id === readStoredViewer(),
  };
});

/**
 * Patch the identity fields the Profile tab owns. Kept narrow on purpose: only
 * the fields shown in the header and the Users table write back, so a profile
 * edit can't quietly reshape a user's roles or overrides.
 */
export type IdentityPatch = Partial<
  Pick<RosterUser, "name" | "email" | "title" | "office">
>;

export function withIdentity(
  users: RosterUser[],
  userId: string,
  patch: IdentityPatch,
): RosterUser[] {
  return users.map((u) => (u.id === userId ? { ...u, ...patch } : u));
}

/** Re-point the YOU badge when the viewer changes seats. */
export function withViewer(users: RosterUser[], viewerId: string): RosterUser[] {
  return users.map((u) => (u.isYou === (u.id === viewerId) ? u : { ...u, isYou: u.id === viewerId }));
}

/** Apply one role change to a roster list. */
export function withRoles(
  users: RosterUser[],
  userId: string,
  roleIds: RoleId[],
): RosterUser[] {
  return users.map((u) => (u.id === userId ? { ...u, roleIds } : u));
}

/**
 * Apply one override to a roster list. `undefined` clears it, returning the
 * permission to whatever the roles say — the "use role default" action.
 */
export function withOverride(
  users: RosterUser[],
  userId: string,
  permissionId: string,
  value: boolean | undefined,
): RosterUser[] {
  return users.map((u) => {
    if (u.id !== userId) return u;
    const overrides = { ...u.overrides };
    if (value === undefined) delete overrides[permissionId];
    else overrides[permissionId] = value;
    return { ...u, overrides };
  });
}

/** Drop every override, returning one user to pure role defaults. */
export function withoutOverrides(
  users: RosterUser[],
  userId: string,
): RosterUser[] {
  return users.map((u) => (u.id === userId ? { ...u, overrides: {} } : u));
}

/** Roster counts for the table footer. */
export function rosterCounts(users: RosterUser[]) {
  const active = users.filter((u) => u.status === "active").length;
  return { total: users.length, active, deactivated: users.length - active };
}
