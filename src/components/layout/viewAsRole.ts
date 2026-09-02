/**
 * The role lens in the account menu: try the current seat's screens as a
 * different role.
 *
 * It rides on top of the person switch (`currentUser.ts`): the seat says *who*
 * is looking, and this optionally overrides *what role* that person holds for
 * the demo — written onto their roster row, so the roster badge, their
 * permissions page and every `can?` check read one source of truth. Nothing
 * stored means no override: the seat wears its real role. Changing seats clears
 * it, so Sarah shows up as herself and not as whatever Ethan was trying on.
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
export type ViewAsStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "dev_role";


/** localStorage when there is a document, null during SSR. */
function browserStore(): ViewAsStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isRoleId(value: string | null): value is RoleId {
  return value !== null && VIEW_AS_ORDER.includes(value as RoleId);
}

/** The persisted override, or null when absent, unrecognized, or on the server. */
export function readViewAsRole(
  store: ViewAsStore | null = browserStore(),
): RoleId | null {
  if (!store) return null;
  const stored = store.getItem(STORAGE_KEY);
  return isRoleId(stored) ? stored : null;
}

/** Drop the override — the seat goes back to its real role. */
export function clearViewAsRole(store: ViewAsStore | null = browserStore()): void {
  store?.removeItem(STORAGE_KEY);
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
