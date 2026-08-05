/**
 * The "Viewing as" role switcher in the account dropdown.
 *
 * This is prototype scaffolding, not product state: it decides which role the
 * demo presents as, so a stakeholder can see the same screens from a Broker's
 * seat and from a Managing Director's. It persists in localStorage under
 * `dev_role` so a reload keeps the chosen vantage point.
 *
 * It used to name three made-up personas (Principal / Broker / Marketing).
 * Now that roles are a real modelled thing, the switcher is just a role: the
 * chosen role is written onto the signed-in user's roster row, so every screen
 * — the roster badge, their permissions page, and the `can?` checks that gate
 * editing — reads one source of truth instead of a parallel notion of "who am
 * I pretending to be".
 *
 * Kept free of React and of a direct `window` reference so it stays testable in
 * Vitest's node environment.
 */
import { ROLES, ROLE_BY_ID, type RoleId } from "#/data/permissions";

/** Display order in the "Viewing as" submenu — same order as ROLES. */
export const VIEW_AS_ORDER: readonly RoleId[] = ROLES.map((role) => role.id);

export function viewAsLabel(roleId: RoleId): string {
  return ROLE_BY_ID.get(roleId)?.name ?? roleId;
}

/** The slice of the Storage API this module needs. */
export type ViewAsStore = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "dev_role";

/**
 * Tracks the signed-in user's seeded role (see `ASSIGNMENTS` in roster.ts).
 * Ethan is a Managing Director, so the admin screens are usable on arrival;
 * switch to any other role to see the same screens locked down.
 */
const DEFAULT_ROLE: RoleId = "managing-director";

/** localStorage when there is a document, null during SSR. */
function browserStore(): ViewAsStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isRoleId(value: string | null): value is RoleId {
  return value !== null && VIEW_AS_ORDER.includes(value as RoleId);
}

/** The persisted role, or the default when absent, unrecognized, or on the server. */
export function readViewAsRole(
  store: ViewAsStore | null = browserStore(),
): RoleId {
  if (!store) return DEFAULT_ROLE;
  const stored = store.getItem(STORAGE_KEY);
  return isRoleId(stored) ? stored : DEFAULT_ROLE;
}

export function writeViewAsRole(
  roleId: RoleId,
  store: ViewAsStore | null = browserStore(),
): void {
  store?.setItem(STORAGE_KEY, roleId);
}

/** The identity card's third line, e.g. "Managing Director · Buildout". */
export function identityLine(roleId: RoleId, company?: string): string {
  const label = viewAsLabel(roleId);
  return company ? `${label} · ${company}` : label;
}
