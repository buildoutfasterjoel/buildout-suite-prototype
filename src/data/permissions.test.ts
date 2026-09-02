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
  it("carries the mocks' 20 plus the contact and voucher permissions, split 22 / 5", () => {
    // 15 record-scoped from the mocks + Own Contacts, Mark Contacts Private,
    // View Private Contacts, Assign Contacts + View / Edit Other Users'
    // Vouchers and Approve Vouchers.
    expect(PERMISSIONS).toHaveLength(27);
    expect(PERMISSIONS.filter((p) => p.scope === "record")).toHaveLength(22);
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
  it("gives a Broker-only user 13 of 27", () => {
    // The mocks' 11, plus the two contact-ownership grants Broker carries. The
    // three voucher permissions are none of a broker's business: they see their
    // own vouchers by being on the deal, not by holding anything.
    const resolved = resolvePermissions(["broker"], {});
    expect(summarize(resolved)).toMatchObject({
      onCount: 13,
      total: 27,
      customCount: 0,
    });
  });

  it("unions Broker + Managing Director to 22", () => {
    // The mocks' 16, plus the four contact permissions (both roles carry the
    // two grants; only MD adds see-through and assignment), plus the two
    // voucher permissions an MD holds — see the whole book, and sign off.
    expect(roleUnionCount(["broker", "managing-director"])).toBe(22);
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
    expect(summarize(off)).toMatchObject({ onCount: 12, customCount: 1 });
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
    expect(summarize(redundant)).toMatchObject({ onCount: 13, customCount: 0 });
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
    // 12 from Managing Director (the mocks' 6 + the four contact permissions +
    // View Other Users' Vouchers and Approve Vouchers), minus one removed, plus
    // two granted.
    expect(summary).toMatchObject({ onCount: 13, customCount: 3 });
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
