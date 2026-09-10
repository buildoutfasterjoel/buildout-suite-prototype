import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_AREAS,
  ROLES,
  resolvePermissions,
  roleUnionCount,
  summarize,
} from "#/data/permissions";
import { OFFICES, SEED_ROSTER } from "#/data/roster";

/** The permission a given role grants and the others don't, for override tests. */
const BROKER_ONLY = "delete-listings";

describe("permission registry", () => {
  it("carries the 32 from the reconciled inventory, split 25 record / 7 account", () => {
    // The mocks' 20 + the four contact permissions + the three voucher
    // permissions + the five the 2026-09-09 inventory pass added: Use Back
    // Office, Administrate Back Office, Edit Documents, Share Document Links
    // That Bypass the CA, Manage All Contacts & Lists.
    expect(PERMISSIONS).toHaveLength(32);
    expect(PERMISSIONS.filter((p) => p.scope === "record")).toHaveLength(25);
    expect(PERMISSIONS.filter((p) => p.scope === "account")).toHaveLength(7);
  });

  it("groups every permission into a known, non-empty product area", () => {
    const areaIds = new Set(PERMISSION_AREAS.map((a) => a.id));
    for (const p of PERMISSIONS) expect(areaIds, p.id).toContain(p.area);
    for (const area of PERMISSION_AREAS) {
      expect(
        PERMISSIONS.filter((p) => p.area === area.id).length,
        area.heading,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps each area's permissions contiguous, so the page order is the registry order", () => {
    // The page groups by area but renders rows in registry order within each
    // group. If an area's rows were scattered through the registry, the
    // registry would no longer read the way the page does.
    const seen = new Set<string>();
    let current: string | undefined;
    for (const p of PERMISSIONS) {
      if (p.area !== current) {
        expect(seen, `${p.area} appears twice`).not.toContain(p.area);
        seen.add(p.area);
        current = p.area;
      }
    }
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
  it("gives a Broker-only user 15 of 32", () => {
    // The mocks' 11, plus the two contact-ownership grants Broker carries,
    // plus Use Back Office (they raise vouchers on their own deals) and Edit
    // Documents (the base the mocks' document permissions assumed). The other
    // voucher permissions are none of a broker's business: they see their own
    // vouchers by being on the deal, not by holding anything.
    const resolved = resolvePermissions(["broker"], {});
    expect(summarize(resolved)).toMatchObject({
      onCount: 15,
      total: 32,
      customCount: 0,
    });
  });

  it("unions Broker + Managing Director to 25", () => {
    // The mocks' 16, plus the four contact permissions (both roles carry the
    // two grants; only MD adds see-through and assignment), plus the two
    // voucher permissions an MD holds — see the whole book, and sign off —
    // plus Use Back Office (both), Edit Documents (Broker) and Manage All
    // Contacts & Lists (MD).
    expect(roleUnionCount(["broker", "managing-director"])).toBe(25);
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
    expect(summarize(off)).toMatchObject({ onCount: 14, customCount: 1 });
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
    expect(summarize(redundant)).toMatchObject({ onCount: 15, customCount: 0 });
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
    // 14 from Managing Director (the mocks' 6 + the four contact permissions +
    // Use Back Office, View Other Users' Vouchers and Approve Vouchers + Manage
    // All Contacts & Lists), minus one removed, plus three granted — the third
    // being Own Listings, which a producing MD needs to be put on a deal as
    // its broker.
    expect(summary).toMatchObject({ onCount: 16, customCount: 4 });
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
