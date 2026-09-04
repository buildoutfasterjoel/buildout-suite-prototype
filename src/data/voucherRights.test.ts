import { describe, expect, it } from "vitest";
import {
  APPROVE_VOUCHERS,
  canSeeBrokerPayout,
  canSeeVoucher,
  voucherApproverIds,
  voucherTeamIds,
  type ApproverCandidate,
} from "#/data/voucherRights";
import { SEED_ROSTER } from "#/data/roster";
import { CURRENT_USER, findTeammate } from "#/data/teammates";
import type { DealBroker, Listing } from "#/data/types";

/** A broker row with only the fields `voucherTeamIds` reads. */
function broker(name: string, side: DealBroker["side"] = "internal"): DealBroker {
  return {
    id: `b-${name}`,
    name,
    role: "Broker",
    email: "",
    side,
    commissionSplitPct: 0,
    grossCommission: 0,
  };
}

/** A deal with only the fields `voucherTeamIds` reads. */
function deal(createdById: string, internalBrokers: DealBroker[]): Listing {
  return { createdById, internalBrokers } as unknown as Listing;
}

describe("voucherTeamIds", () => {
  it("includes the creator even when they work no broker row", () => {
    expect(voucherTeamIds(deal("sarah-chen", []))).toEqual(["sarah-chen"]);
  });

  it("adds the internal brokers, matched by name", () => {
    const ids = voucherTeamIds(
      deal("sarah-chen", [broker("Marcus Patel"), broker("Nina Alvarez")]),
    );
    expect(ids).toEqual(["sarah-chen", "marcus-patel", "nina-alvarez"]);
  });

  it("does not repeat the creator when they are also on a broker row", () => {
    const ids = voucherTeamIds(deal(CURRENT_USER.id, [broker(CURRENT_USER.name)]));
    expect(ids).toEqual([CURRENT_USER.id]);
  });

  it("drops an outside broker, who is nobody on the roster", () => {
    // A co-broking agent has no seat in the app, so no id resolves for them.
    const ids = voucherTeamIds(
      deal("sarah-chen", [broker("Dale Fenwick", "outside")]),
    );
    expect(ids).toEqual(["sarah-chen"]);
  });
});

describe("canSeeVoucher", () => {
  const team = ["sarah-chen", "marcus-patel"];

  it("shows a team member their own voucher without the permission", () => {
    expect(canSeeVoucher(team, "marcus-patel", false)).toBe(true);
  });

  it("hides someone else's voucher without the permission", () => {
    expect(canSeeVoucher(team, "riley-park", false)).toBe(false);
  });

  it("shows everything with the permission", () => {
    expect(canSeeVoucher(team, "riley-park", true)).toBe(true);
  });

  it("never hides a person's own work, permission or not", () => {
    // Team membership is checked first for exactly this reason: revoking View
    // Other Users' Vouchers must not lock a broker out of their own book.
    for (const canViewOthers of [true, false]) {
      expect(canSeeVoucher(team, "sarah-chen", canViewOthers)).toBe(true);
    }
  });
});

describe("voucherApproverIds", () => {
  const candidate = (over: Partial<ApproverCandidate>): ApproverCandidate => ({
    id: "x",
    roleIds: [],
    overrides: {},
    status: "active",
    ...over,
  });

  it("picks up the role default", () => {
    const users = [
      candidate({ id: "tessa", roleIds: ["back-office-manager"] }),
      candidate({ id: "sarah", roleIds: ["broker"] }),
    ];
    expect(voucherApproverIds(users)).toEqual(["tessa"]);
  });

  it("honours a per-user grant beyond the role", () => {
    const users = [
      candidate({
        id: "omar",
        roleIds: ["transaction-coordinator"],
        overrides: { [APPROVE_VOUCHERS]: true },
      }),
    ];
    expect(voucherApproverIds(users)).toEqual(["omar"]);
  });

  it("honours a per-user revoke", () => {
    const users = [
      candidate({
        id: "tessa",
        roleIds: ["back-office-manager"],
        overrides: { [APPROVE_VOUCHERS]: false },
      }),
    ];
    expect(voucherApproverIds(users)).toEqual([]);
  });

  it("drops a deactivated user, who cannot sign in to approve", () => {
    const users = [
      candidate({
        id: "tessa",
        roleIds: ["back-office-manager"],
        status: "deactivated",
      }),
    ];
    expect(voucherApproverIds(users)).toEqual([]);
  });

  describe("against the seeded roster", () => {
    const approvers = voucherApproverIds(SEED_ROSTER);

    it("names the Back Office Manager and the Managing Directors", () => {
      // The roster's three MDs — the protagonist, Diana and Priya — plus Tessa.
      expect(approvers).toEqual([
        "you",
        "diana-reyes",
        "priya-nair",
        "tessa-nakamura",
      ]);
    });

    it("resolves every one of them to a real person", () => {
      for (const id of approvers) {
        expect(findTeammate(id), id).toBeDefined();
      }
    });

    it("excludes the Transaction Coordinator and the Office Admin", () => {
      // They were two of the three hardcoded approvers before the permission
      // existed. Deriving the list from the roster is what moved them out.
      expect(approvers).not.toContain("omar-haddad");
      expect(approvers).not.toContain("riley-park");
    });
  });
});

describe("canSeeBrokerPayout", () => {
  const sarah = broker("Sarah Chen");
  const marcus = broker("Marcus Patel");
  const co = broker("Dale Whitmore", "outside");

  it("shows a broker their own plan and net", () => {
    expect(canSeeBrokerPayout(sarah, "sarah-chen", false)).toBe(true);
  });

  it("hides a colleague's from another broker", () => {
    expect(canSeeBrokerPayout(marcus, "sarah-chen", false)).toBe(false);
  });

  it("hides it from the deal's creator too — the rule is symmetric", () => {
    // Ethan opens most of the seeded deals. Opening a deal does not buy him a
    // look at what the house pays somebody else.
    expect(canSeeBrokerPayout(sarah, CURRENT_USER.id, false)).toBe(false);
  });

  it("shows every payout to the back office", () => {
    expect(canSeeBrokerPayout(sarah, "tessa-nakamura", true)).toBe(true);
    expect(canSeeBrokerPayout(marcus, "tessa-nakamura", true)).toBe(true);
  });

  it("hides an outside broker's too — it is still somebody else's cheque", () => {
    expect(canSeeBrokerPayout(co, "sarah-chen", false)).toBe(false);
    expect(canSeeBrokerPayout(co, "tessa-nakamura", true)).toBe(true);
  });

  it("hides a name that matches nobody on the roster", () => {
    expect(canSeeBrokerPayout(broker("Nobody At All"), "sarah-chen", false)).toBe(
      false,
    );
  });
});
