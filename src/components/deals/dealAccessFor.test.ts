import { describe, it, expect } from "vitest";
import { TEAMMATES } from "#/data/teammates";
import type { DealShare, ShareScope } from "#/data/dealShares";
import type { RoleId } from "#/data/permissions";
import type { Listing } from "#/data/types";
import { canContribute, canOpenDeal, dealAccessFor, type AccessViewer } from "./dealAccess";

/** A deal Ethan created, worked by Sarah Chen. Only the fields the resolver reads. */
const deal = {
  id: "L1",
  createdById: "you",
  internalBrokers: [{ id: "b1", name: "Sarah Chen", email: "sarah.chen@buildout.com" }],
} as unknown as Listing;

function viewer(id: string, roleIds: RoleId[], overrides = {}): AccessViewer {
  const member = TEAMMATES.find((t) => t.id === id);
  return { id, name: member?.name ?? id, roleIds, overrides };
}

function share(id: string, scope: ShareScope, level: "view" | "contribute"): DealShare {
  const member = TEAMMATES.find((t) => t.id === id);
  if (!member) throw new Error(`no teammate ${id}`);
  return { member, scope, level };
}

describe("dealAccessFor", () => {
  it("gives the creator both halves", () => {
    expect(dealAccessFor(deal, viewer("you", ["managing-director"]), [])).toEqual({
      marketing: "contribute",
      backOffice: "contribute",
    });
  });

  it("gives an internal broker both halves, matched by name", () => {
    expect(dealAccessFor(deal, viewer("sarah-chen", ["broker"]), [])).toEqual({
      marketing: "contribute",
      backOffice: "contribute",
    });
  });

  it("gives an unshared broker both halves — they own records", () => {
    const access = dealAccessFor(deal, viewer("nina-alvarez", ["broker"]), []);
    expect(access).toEqual({ marketing: "contribute", backOffice: "contribute" });
  });

  it("gives an unshared Back Office Manager both halves — firm-wide view", () => {
    const access = dealAccessFor(deal, viewer("tessa-nakamura", ["back-office-manager"]), []);
    expect(access).toEqual({ marketing: "contribute", backOffice: "contribute" });
  });

  it("gives an unshared sharing-role nothing at all", () => {
    const access = dealAccessFor(deal, viewer("maya-brooks", ["marketing-assistant"]), []);
    expect(access).toEqual({ marketing: "none", backOffice: "none" });
    expect(canOpenDeal(access)).toBe(false);
  });

  it("a marketing share hides the back office outright", () => {
    const access = dealAccessFor(deal, viewer("maya-brooks", ["marketing-assistant"]), [
      share("maya-brooks", "marketing", "contribute"),
    ]);
    expect(access).toEqual({ marketing: "contribute", backOffice: "none" });
  });

  it("a back office share carries marketing at view", () => {
    const access = dealAccessFor(
      deal,
      viewer("omar-haddad", ["transaction-coordinator"]),
      [share("omar-haddad", "back-office", "contribute")],
    );
    expect(access).toEqual({ marketing: "view", backOffice: "contribute" });
  });

  it("caps a contribute share at view when the role cannot back it", () => {
    // Office Admin has create-listings only — none of the marketing edit
    // permissions, and no change-deal-statuses.
    const riley = viewer("riley-park", ["office-admin"]);
    expect(dealAccessFor(deal, riley, [share("riley-park", "marketing", "contribute")])).toEqual({
      marketing: "view",
      backOffice: "none",
    });
    expect(dealAccessFor(deal, riley, [share("riley-park", "back-office", "contribute")])).toEqual({
      marketing: "view",
      backOffice: "view",
    });
  });

  it("lets a per-user override lift the cap", () => {
    const riley = viewer("riley-park", ["office-admin"], { "edit-listings": true });
    expect(dealAccessFor(deal, riley, [share("riley-park", "marketing", "contribute")])).toEqual({
      marketing: "contribute",
      backOffice: "none",
    });
  });

  it("a view share stays view even for a role that could edit", () => {
    const access = dealAccessFor(deal, viewer("maya-brooks", ["marketing-assistant"]), [
      share("maya-brooks", "marketing", "view"),
    ]);
    expect(access).toEqual({ marketing: "view", backOffice: "none" });
  });

  it("the share wins over the role's own reach", () => {
    // Nina is a Broker — unshared she would see everything. Shared into
    // marketing only, the share is what she gets.
    const access = dealAccessFor(deal, viewer("nina-alvarez", ["broker"]), [
      share("nina-alvarez", "marketing", "contribute"),
    ]);
    expect(access).toEqual({ marketing: "contribute", backOffice: "none" });
  });

  it("falls open, not shut, for a viewer with no roster row", () => {
    expect(dealAccessFor(deal, undefined, [])).toEqual({
      marketing: "contribute",
      backOffice: "contribute",
    });
  });
});

describe("canContribute", () => {
  it("reads the role's permissions per scope", () => {
    const maya = viewer("maya-brooks", ["marketing-assistant"]);
    expect(canContribute("marketing", maya)).toBe(true);
    expect(canContribute("back-office", maya)).toBe(false);

    const omar = viewer("omar-haddad", ["transaction-coordinator"]);
    expect(canContribute("back-office", omar)).toBe(true);
  });
});
