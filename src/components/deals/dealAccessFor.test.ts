import { describe, it, expect } from "vitest";
import { TEAMMATES } from "#/data/teammates";
import type { DealShare, ShareLevel } from "#/data/dealShares";
import type { RoleId } from "#/data/permissions";
import type { Listing } from "#/data/types";
import {
  canEditMarketing,
  canOpenDeal,
  dealAccessFor,
  type AccessViewer,
} from "./dealAccess";

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

function share(id: string, level: ShareLevel): DealShare {
  const member = TEAMMATES.find((t) => t.id === id);
  if (!member) throw new Error(`no teammate ${id}`);
  return { member, level };
}

describe("dealAccessFor — the deal team", () => {
  it("gives the creator both halves", () => {
    expect(dealAccessFor(deal, viewer("you", ["managing-director"]), [])).toEqual({
      marketing: "contribute",
      backOffice: "contribute",
    });
  });

  it("gives an internal broker both halves, matched by name", () => {
    // Sarah holds neither cross-deal permission, so this is team membership
    // alone doing the work.
    expect(dealAccessFor(deal, viewer("sarah-chen", ["broker"]), [])).toEqual({
      marketing: "contribute",
      backOffice: "contribute",
    });
  });
});

describe("dealAccessFor — what a role alone opens", () => {
  it("gives a Broker nothing on someone else's deal", () => {
    // accessKind "owns" means a book of their own, not a window onto everyone
    // else's: a Broker holds neither access-other-listings nor
    // view-other-vouchers.
    const access = dealAccessFor(deal, viewer("nina-alvarez", ["broker"]), []);
    expect(access).toEqual({ marketing: "none", backOffice: "none" });
    expect(canOpenDeal(access)).toBe(false);
  });

  it("gives a Back Office Manager the voucher and no marketing", () => {
    // The whole point of the role: vouchers from every deal, nothing else.
    expect(
      dealAccessFor(deal, viewer("tessa-nakamura", ["back-office-manager"]), []),
    ).toEqual({ marketing: "none", backOffice: "contribute" });
  });

  it("gives a Managing Director both halves, and both only to read", () => {
    // Access, not edit, in each half — and the role's defaults say so twice.
    // `access-other-listings` opens a listing without `edit-listings` opening
    // the form, and `edit-other-vouchers` is the Back Office Manager's alone:
    // an MD signs work off, they do not type it. A producing MD gets the edit
    // rights by override, which the next test covers.
    expect(
      dealAccessFor(deal, viewer("priya-nair", ["managing-director"]), []),
    ).toEqual({ marketing: "view", backOffice: "view" });
  });

  it("lets an override lift a Managing Director to editing marketing", () => {
    // Diana is the roster's customized row: a Managing Director granted
    // edit-listings beyond her role.
    expect(
      dealAccessFor(deal, viewer("diana-reyes", ["managing-director"], {
        "edit-listings": true,
      }), []),
    ).toEqual({ marketing: "contribute", backOffice: "view" });
  });

  it("gives an unshared sharing-role nothing at all", () => {
    const access = dealAccessFor(deal, viewer("maya-brooks", ["marketing-assistant"]), []);
    expect(access).toEqual({ marketing: "none", backOffice: "none" });
    expect(canOpenDeal(access)).toBe(false);
  });
});

describe("dealAccessFor — a share", () => {
  it("opens marketing and never the back office", () => {
    expect(
      dealAccessFor(deal, viewer("maya-brooks", ["marketing-assistant"]), [
        share("maya-brooks", "contribute"),
      ]),
    ).toEqual({ marketing: "contribute", backOffice: "none" });
  });

  it("caps contribute at view when the role cannot edit marketing", () => {
    // Office Admin holds create-listings and none of the three edit permissions.
    expect(
      dealAccessFor(deal, viewer("riley-park", ["office-admin"]), [
        share("riley-park", "contribute"),
      ]),
    ).toEqual({ marketing: "view", backOffice: "none" });
  });

  it("lets a per-user override lift the cap", () => {
    const riley = viewer("riley-park", ["office-admin"], { "edit-listings": true });
    expect(dealAccessFor(deal, riley, [share("riley-park", "contribute")])).toEqual({
      marketing: "contribute",
      backOffice: "none",
    });
  });

  it("stays view when the share says view, even for a role that could edit", () => {
    expect(
      dealAccessFor(deal, viewer("maya-brooks", ["marketing-assistant"]), [
        share("maya-brooks", "view"),
      ]),
    ).toEqual({ marketing: "view", backOffice: "none" });
  });

  it("raises what a role granted rather than replacing it", () => {
    // Sharing marketing with the back office must not cost them the voucher
    // their role reaches on every deal in the firm.
    expect(
      dealAccessFor(deal, viewer("tessa-nakamura", ["back-office-manager"]), [
        share("tessa-nakamura", "view"),
      ]),
    ).toEqual({ marketing: "view", backOffice: "contribute" });
  });

  it("never lowers a role that already opened more", () => {
    // Diana's role plus her override already reaches contribute. A view share
    // on top of that leaves the higher of the two, rather than demoting her.
    expect(
      dealAccessFor(
        deal,
        viewer("diana-reyes", ["managing-director"], { "edit-listings": true }),
        [share("diana-reyes", "view")],
      ),
    ).toEqual({ marketing: "contribute", backOffice: "view" });
  });
});

describe("dealAccessFor — the fallback", () => {
  it("falls open, not shut, for a viewer with no roster row", () => {
    expect(dealAccessFor(deal, undefined, [])).toEqual({
      marketing: "contribute",
      backOffice: "contribute",
    });
  });
});

describe("canEditMarketing", () => {
  it("reads the three marketing permissions, not edit-listings alone", () => {
    // A Marketing Assistant builds sites and documents without holding the
    // listing form.
    expect(canEditMarketing(viewer("maya-brooks", ["marketing-assistant"]))).toBe(true);
    expect(canEditMarketing(viewer("riley-park", ["office-admin"]))).toBe(false);
  });
});
