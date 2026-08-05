import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  resolvePermissions,
  roleUnionCount,
  summarize,
} from "#/data/permissions";
import { OFFICES, SEED_ROSTER } from "#/data/roster";

/** The permission a given role grants and the others don't, for override tests. */
const BROKER_ONLY = "delete-listings";

describe("permission registry", () => {
  it("carries the 20 permissions from the mocks, split 15 / 5", () => {
    expect(PERMISSIONS).toHaveLength(20);
    expect(PERMISSIONS.filter((p) => p.scope === "record")).toHaveLength(15);
    expect(PERMISSIONS.filter((p) => p.scope === "account")).toHaveLength(5);
  });

  it("has no duplicate permission ids", () => {
    expect(new Set(PERMISSIONS.map((p) => p.id)).size).toBe(PERMISSIONS.length);
  });

  it("only references real permission ids in role defaults", () => {
    const ids = new Set(PERMISSIONS.map((p) => p.id));
    for (const role of ROLES) {
      for (const id of role.defaults) {
        expect(ids, `${role.name} → ${id}`).toContain(id);
      }
    }
  });
});

describe("role defaults match the mocks", () => {
  it("gives a Broker-only user 11 of 20", () => {
    const resolved = resolvePermissions(["broker"], {});
    expect(summarize(resolved)).toMatchObject({
      onCount: 11,
      total: 20,
      customCount: 0,
    });
  });

  it("unions Broker + Managing Director to 16", () => {
    expect(roleUnionCount(["broker", "managing-director"])).toBe(16);
  });

  it("grants nothing without a role", () => {
    expect(roleUnionCount([])).toBe(0);
  });
});

describe("resolvePermissions", () => {
  it("applies overrides after the role union", () => {
    const off = resolvePermissions(["broker"], { [BROKER_ONLY]: false });
    const row = off.find((r) => r.permission.id === BROKER_ONLY);
    expect(row).toMatchObject({ on: false, custom: true, roleDefault: true });
    expect(summarize(off)).toMatchObject({ onCount: 10, customCount: 1 });
  });

  it("can grant a permission no assigned role allows", () => {
    const on = resolvePermissions(["transaction-coordinator"], {
      [BROKER_ONLY]: true,
    });
    const row = on.find((r) => r.permission.id === BROKER_ONLY);
    expect(row).toMatchObject({ on: true, custom: true, roleDefault: false });
    expect(row?.grantedBy).toEqual([]);
  });

  it("does not count an override that agrees with the role as custom", () => {
    const redundant = resolvePermissions(["broker"], { [BROKER_ONLY]: true });
    expect(summarize(redundant)).toMatchObject({ onCount: 11, customCount: 0 });
  });

  it("attributes a permission to every role granting it", () => {
    const resolved = resolvePermissions(["broker", "managing-director"], {});
    const photo = resolved.find(
      (r) => r.permission.id === "edit-profile-photo",
    );
    expect(photo?.grantedBy).toEqual(["broker", "managing-director"]);
  });

  it("keeps a union at or above either role alone", () => {
    const broker = roleUnionCount(["broker"]);
    const md = roleUnionCount(["managing-director"]);
    expect(roleUnionCount(["broker", "managing-director"])).toBeGreaterThanOrEqual(
      Math.max(broker, md),
    );
  });

  it("returns rows in registry order", () => {
    const ids = resolvePermissions(["broker"], {}).map((r) => r.permission.id);
    expect(ids).toEqual(PERMISSIONS.map((p) => p.id));
  });
});

describe("seed roster", () => {
  it("carries a customized user for the Custom chips to render", () => {
    const diana = SEED_ROSTER.find((u) => u.id === "diana-reyes");
    expect(diana?.roleIds).toEqual(["managing-director"]);
    const summary = summarize(
      resolvePermissions(diana!.roleIds, diana!.overrides),
    );
    // 6 from Managing Director, minus one removed, plus two granted.
    expect(summary).toMatchObject({ onCount: 7, customCount: 3 });
  });

  it("gives every person exactly one real role", () => {
    const roleIds = new Set(ROLES.map((r) => r.id));
    for (const user of SEED_ROSTER) {
      // The product rule the assign-role panel enforces. The resolver still
      // unions a list, so this is a seed guard rather than an engine limit.
      expect(user.roleIds, user.name).toHaveLength(1);
      for (const id of user.roleIds) expect(roleIds).toContain(id);
    }
  });

  it("seats the signed-in user as a Managing Director", () => {
    // The default demo seat: admin screens are usable on arrival, and switching
    // to any other role shows them locked.
    const you = SEED_ROSTER.find((u) => u.isYou);
    expect(you?.roleIds).toEqual(["managing-director"]);
  });

  it("puts every person in a known office, so the filter can't miss anyone", () => {
    for (const user of SEED_ROSTER) {
      expect(OFFICES, user.name).toContain(user.office);
    }
  });

  it("spreads people across more than one office", () => {
    expect(new Set(SEED_ROSTER.map((u) => u.office)).size).toBeGreaterThan(1);
  });

  it("keeps at least one active user who can manage the company", () => {
    const admins = SEED_ROSTER.filter(
      (u) =>
        u.status === "active" &&
        resolvePermissions(u.roleIds, u.overrides).some(
          (r) => r.permission.id === "manage-company" && r.on,
        ),
    );
    expect(admins.length).toBeGreaterThan(0);
  });
});
