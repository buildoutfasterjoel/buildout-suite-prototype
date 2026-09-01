import { useMemo } from "react";
import { CURRENT_USER } from "#/data/teammates";
import { isPermissionOn, type RoleId } from "#/data/permissions";
import type { RosterUser } from "#/data/roster";
import { useRoster } from "./useRoster";
import { isEffectivelyOn } from "#/data/contactAccess";
import { useContactAccessSettings } from "#/components/settings/useContactAccessSettings";

/**
 * Zustand compares selector results with `Object.is`, so a selector that builds
 * a new array or object every call re-renders forever. Selectors here return
 * either a stable store reference or a primitive; anything derived is memoized
 * in the hook instead.
 */
const EMPTY_ROLES: RoleId[] = [];

/**
 * The signed-in user, as a roster row.
 *
 * Reactive, and the single source of truth for what the current viewer may do.
 * The "Viewing as" switcher writes the chosen role onto this row, so switching
 * seats and editing this person's roles are the same operation — there's no
 * parallel notion of a pretend identity that could drift from the data.
 */
export function useViewer(): RosterUser | undefined {
  return useRoster((s) => s.users.find((u) => u.id === CURRENT_USER.id));
}

/**
 * Whether the current viewer holds a permission — the UI's `can?`.
 *
 * Returns false when the viewer isn't on the roster, so a missing row locks
 * things down rather than opening them up.
 */
export function useCan(permissionId: string): boolean {
  const viewer = useViewer();
  const settings = useContactAccessSettings((s) => s.settings);
  if (!viewer) return false;
  // Company ceilings and grant defaults applied — see `contactAccess.ts`.
  // Most permissions have no gate and fall straight through to the roles.
  return isEffectivelyOn(viewer.roleIds, viewer.overrides, permissionId, settings);
}

/** The viewer's current role(s), for the account menu's checkmark. */
export function useViewerRoles(): RoleId[] {
  return useViewer()?.roleIds ?? EMPTY_ROLES;
}

/**
 * Active teammates who can manage the company — used to tell a locked-out
 * admin who to ask, which is more useful than naming the permission.
 */
export function useCompanyAdmins(): RosterUser[] {
  const users = useRoster((s) => s.users);
  return useMemo(
    () =>
      users.filter(
        (u) =>
          u.status === "active" &&
          isPermissionOn(u.roleIds, u.overrides, "manage-company"),
      ),
    [users],
  );
}
