import { create } from "zustand";
import type { RoleId } from "#/data/permissions";
import {
  SEED_ROSTER,
  withIdentity,
  withOverride,
  withViewer,
  withRoles,
  withoutOverrides,
  type IdentityPatch,
  type RosterUser,
} from "#/data/roster";

/**
 * Session-scoped roster state for Company settings → Users.
 *
 * Role assignments and permission overrides are edited in a panel and read back
 * on the roster and the permissions page, so they need to outlive a component —
 * but nothing here is persisted, matching the other prototype settings screens.
 * A reload returns to `SEED_ROSTER`.
 */
interface RosterState {
  users: RosterUser[];
  setRoles: (userId: string, roleIds: RoleId[]) => void;
  setOverride: (
    userId: string,
    permissionId: string,
    value: boolean | undefined,
  ) => void;
  clearOverrides: (userId: string) => void;
  /** Identity fields owned by the Profile tab — see `withIdentity`. */
  setIdentity: (userId: string, patch: IdentityPatch) => void;
  /** Move the YOU badge to whoever the viewer is now. */
  setViewer: (viewerId: string) => void;
}

export const useRoster = create<RosterState>((set) => ({
  users: SEED_ROSTER,
  setRoles: (userId, roleIds) =>
    set((s) => ({ users: withRoles(s.users, userId, roleIds) })),
  setOverride: (userId, permissionId, value) =>
    set((s) => ({
      users: withOverride(s.users, userId, permissionId, value),
    })),
  clearOverrides: (userId) =>
    set((s) => ({ users: withoutOverrides(s.users, userId) })),
  setIdentity: (userId, patch) =>
    set((s) => ({ users: withIdentity(s.users, userId, patch) })),
  setViewer: (viewerId) => set((s) => ({ users: withViewer(s.users, viewerId) })),
}));
