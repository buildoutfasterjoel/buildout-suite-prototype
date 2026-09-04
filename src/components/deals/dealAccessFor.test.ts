import { describe, it, expect } from "vitest";
import { TEAMMATES } from "#/data/teammates";
import type { DealShare, ShareLevel } from "#/data/dealShares";
import type { RoleId } from "#/data/permissions";
import type { Listing } from "#/data/types";
import {
  canEditMarketing,
  canOpenDeal,
  dealAccessFor,
  visibleDeals,
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
  it("gives the creator nothing when they work no broker row", () => {
    // Ethan opened this one but Sarah works it. Creating a deal is an audit
    // fact; the broker list is the team. A marketing person with Create
    // Listings depends on this — the deal they typed in is not their voucher.
    // (Ethan is a Managing Director, so he still reaches it firm-wide at view;
    // the point is that `createdById` bought him nothing.)
    expect(dealAccessFor(deal, viewer("you", ["managing-director"]), [])).toEqual({
      marketing: "view",
      backOffice: "view",
    });
  });

  it("gives a marketing creator nothing at all without a share", () => {
    const opened = {
      id: "L2",
      createdById: "maya-brooks",
      internalBrokers: [{ id: "b1", name: "Sarah Chen", email: "" }],
    } as unknown as Listing;
    expect(
      dealAccessFor(opened, viewer("maya-brooks", ["marketing-assistant"]), []),
    ).toEqual({ marketing: "none", backOffice: "none" });
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

describe("visibleDeals", () => {
  // Three deals: one Sarah works, one Marcus works, one nobody on the roster
  // has been given.
  const hers = {
    id: "hers",
    createdById: "sarah-chen",
    internalBrokers: [{ id: "b0", name: "Sarah Chen", email: "" }],
  } as unknown as Listing;
  const his = {
    id: "his",
    createdById: "marcus-patel",
    internalBrokers: [],
  } as unknown as Listing;
  const shared = {
    id: "shared",
    createdById: "marcus-patel",
    internalBrokers: [],
  } as unknown as Listing;
  const all = [hers, his, shared];
  const shares = new Map<string, DealShare[]>([
    ["shared", [share("sarah-chen", "view")]],
  ]);

  it("gives a Broker their own book plus what is shared with them", () => {
    const seen = visibleDeals(all, viewer("sarah-chen", ["broker"]), shares);
    expect(seen.map((l) => l.id)).toEqual(["hers", "shared"]);
  });

  it("does not count a deal she merely opened as her own", () => {
    // `hers` is hers because she is its broker, not because she created it.
    const typedIn = {
      id: "typed",
      createdById: "sarah-chen",
      internalBrokers: [{ id: "b9", name: "Marcus Patel", email: "" }],
    } as unknown as Listing;
    const seen = visibleDeals([typedIn], viewer("sarah-chen", ["broker"]), new Map());
    expect(seen).toEqual([]);
  });

  it("gives a Back Office Manager every deal — the voucher is on all of them", () => {
    const seen = visibleDeals(
      all,
      viewer("tessa-nakamura", ["back-office-manager"]),
      shares,
    );
    expect(seen.map((l) => l.id)).toEqual(["hers", "his", "shared"]);
  });

  it("gives an unshared sharing-role an empty book", () => {
    const seen = visibleDeals(
      all,
      viewer("maya-brooks", ["marketing-assistant"]),
      new Map(),
    );
    expect(seen).toEqual([]);
  });

  it("hides nothing when there is no roster row to judge by", () => {
    expect(visibleDeals(all, undefined, shares)).toHaveLength(3);
  });
});

/* ------------------------------------------------------------------------- *
 * Lease families: a shell and its spaces.
 * ------------------------------------------------------------------------- */

/** A lease building. Sarah works the assignment; nobody else is on it. */
const shell = {
  id: "SH1",
  parentDealId: null,
  createdById: "sarah-chen",
  internalBrokers: [{ id: "b1", name: "Sarah Chen", email: "" }],
} as unknown as Listing;

/** Suite 100, worked by Marcus. */
const spaceA = {
  id: "SP-A",
  parentDealId: "SH1",
  createdById: "marcus-patel",
  internalBrokers: [{ id: "b2", name: "Marcus Patel", email: "" }],
} as unknown as Listing;

/** Suite 200, worked by Nina. Marcus must never reach it. */
const spaceB = {
  id: "SP-B",
  parentDealId: "SH1",
  createdById: "nina-alvarez",
  internalBrokers: [{ id: "b3", name: "Nina Alvarez", email: "" }],
} as unknown as Listing;

const shellFamily = { spaces: [spaceA, spaceB] };
const spaceFamily = (shellShares: DealShare[] = []) => ({ shell, shellShares });

describe("dealAccessFor — marketing resolves on the shell", () => {
  it("gives a suite broker the building's marketing and no shell voucher", () => {
    // Marcus works Suite 100. The media, website and documents he needs live on
    // the building, so working any suite has to open it.
    expect(dealAccessFor(shell, viewer("marcus-patel", ["broker"]), [], shellFamily)).toEqual({
      marketing: "contribute",
      backOffice: "view",
    });
  });

  it("gives a shell broker no Vouchers index when they work none of its spaces", () => {
    // Sarah owns the assignment, not the transactions. An index of nothing is a
    // worse page than no index.
    expect(dealAccessFor(shell, viewer("sarah-chen", ["broker"]), [], shellFamily)).toEqual({
      marketing: "contribute",
      backOffice: "none",
    });
  });

  it("gives a suite broker nothing at all on a sibling suite", () => {
    // The whole point: two brokers, one building, separate suites. Marketing is
    // one wall across the *building*, never across its suites.
    expect(
      dealAccessFor(spaceB, viewer("marcus-patel", ["broker"]), [], spaceFamily()),
    ).toEqual({ marketing: "none", backOffice: "none" });
  });

  it("gives a suite broker both halves on their own suite", () => {
    expect(
      dealAccessFor(spaceA, viewer("marcus-patel", ["broker"]), [], spaceFamily()),
    ).toEqual({ marketing: "contribute", backOffice: "contribute" });
  });

  it("gives the shell's broker every suite's marketing and no suite's money", () => {
    expect(
      dealAccessFor(spaceB, viewer("sarah-chen", ["broker"]), [], spaceFamily()),
    ).toEqual({ marketing: "contribute", backOffice: "none" });
  });

  it("reads a space's marketing share off the shell, not off the space", () => {
    // Maya is shared into the building at contribute. She holds
    // edit-listing-website, so the cap leaves her at contribute.
    expect(
      dealAccessFor(
        spaceB,
        viewer("maya-brooks", ["marketing-assistant"]),
        [],
        spaceFamily([share("maya-brooks", "contribute")]),
      ),
    ).toEqual({ marketing: "contribute", backOffice: "none" });
  });

  it("ignores a share written on the space itself", () => {
    // Sharing moved to the building. A share on a space is unreachable data,
    // and must not quietly keep working.
    expect(
      dealAccessFor(
        spaceB,
        viewer("maya-brooks", ["marketing-assistant"]),
        [share("maya-brooks", "contribute")],
        spaceFamily(),
      ),
    ).toEqual({ marketing: "none", backOffice: "none" });
  });

  it("still gives a Back Office Manager every suite's voucher", () => {
    expect(
      dealAccessFor(spaceB, viewer("tessa-nakamura", ["back-office-manager"]), [], spaceFamily()),
    ).toEqual({ marketing: "none", backOffice: "contribute" });
  });
});

describe("visibleDeals — a lease building", () => {
  const all = [shell, spaceA, spaceB];
  const noShares = new Map<string, DealShare[]>();

  it("gives a suite broker their building and their own suite only", () => {
    const seen = visibleDeals(all, viewer("marcus-patel", ["broker"]), noShares);
    expect(seen.map((l) => l.id)).toEqual(["SH1", "SP-A"]);
  });

  it("gives a building's guest every suite in it", () => {
    const shares = new Map<string, DealShare[]>([
      ["SH1", [share("maya-brooks", "view")]],
    ]);
    const seen = visibleDeals(all, viewer("maya-brooks", ["marketing-assistant"]), shares);
    expect(seen.map((l) => l.id)).toEqual(["SH1", "SP-A", "SP-B"]);
  });
});
