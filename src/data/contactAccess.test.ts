import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTACT_ACCESS_SETTINGS,
  OWN_CONTACTS,
  PRIVATE_CONTACTS,
  VIEW_PRIVATE_CONTACTS,
  applyCompanyCeilings,
  gateFor,
  isEffectivelyOn,
  resolveCompanyDefault,
  resolveContactAccess,
  type ContactAccessSettings,
} from "#/data/contactAccess";
import { PERMISSION_BY_ID, resolvePermissions } from "#/data/permissions";

const BOTH_ON: ContactAccessSettings = {
  brokersCanOwnContacts: true,
  ownDefault: "brokers",
  ownedContactsCanBePrivate: true,
  privateDefault: "brokers",
};
const OWN_ONLY: ContactAccessSettings = { ...BOTH_ON, ownedContactsCanBePrivate: false };
const COMPANY_OWNED: ContactAccessSettings = { ...BOTH_ON, brokersCanOwnContacts: false };
/** Summit Realty: open database, privacy as a privilege handed out per person. */
const PER_PERSON: ContactAccessSettings = {
  ...BOTH_ON,
  ownDefault: "granted",
  privateDefault: "granted",
};

const GRANTS = [OWN_CONTACTS, PRIVATE_CONTACTS];

describe("the contact permissions", () => {
  it("exist, are record-scoped, and carry their gates", () => {
    expect(PERMISSION_BY_ID.get(OWN_CONTACTS)).toMatchObject({
      scope: "record",
      gate: "contact-ownership",
    });
    expect(PERMISSION_BY_ID.get(PRIVATE_CONTACTS)).toMatchObject({
      scope: "record",
      gate: "contact-privacy",
    });
    expect(PERMISSION_BY_ID.get(VIEW_PRIVATE_CONTACTS)).toMatchObject({
      scope: "record",
      gate: "contact-privacy",
    });
  });

  it("hand the two grants to Broker and Managing Director, and see-through to MD only", () => {
    const broker = resolvePermissions(["broker"], {});
    const md = resolvePermissions(["managing-director"], {});
    const tc = resolvePermissions(["transaction-coordinator"], {});
    const on = (rows: typeof broker, id: string) =>
      rows.find((r) => r.permission.id === id)?.on;
    for (const id of GRANTS) {
      expect(on(broker, id), id).toBe(true);
      // Unlike Own Listings, an MD can own a book: a producing Managing
      // Director is a normal person in brokerage, and George's model withholds
      // nothing from the role.
      expect(on(md, id), id).toBe(true);
      // Sharing-only roles bring no book of their own.
      expect(on(tc, id), id).toBe(false);
    }
    expect(on(broker, VIEW_PRIVATE_CONTACTS)).toBe(false);
    expect(on(md, VIEW_PRIVATE_CONTACTS)).toBe(true);
  });
});

describe("gateFor", () => {
  it("leaves ungated permissions alone", () => {
    expect(gateFor("have-listings", BOTH_ON)).toBeUndefined();
  });

  it("opens both gates when both company switches are on", () => {
    expect(gateFor(OWN_CONTACTS, BOTH_ON)?.open).toBe(true);
    expect(gateFor(PRIVATE_CONTACTS, BOTH_ON)?.open).toBe(true);
  });

  it("closes only privacy when ownership is allowed but privacy is not", () => {
    expect(gateFor(OWN_CONTACTS, OWN_ONLY)?.open).toBe(true);
    expect(gateFor(PRIVATE_CONTACTS, OWN_ONLY)?.open).toBe(false);
    expect(gateFor(VIEW_PRIVATE_CONTACTS, OWN_ONLY)?.open).toBe(false);
  });

  it("closes privacy too when brokers can't own contacts at all", () => {
    // Privacy of broker-owned contacts has nothing to apply to.
    expect(gateFor(OWN_CONTACTS, COMPANY_OWNED)?.open).toBe(false);
    expect(gateFor(PRIVATE_CONTACTS, COMPANY_OWNED)?.open).toBe(false);
  });

  it("names the company setting an admin has to change", () => {
    expect(gateFor(OWN_CONTACTS, COMPANY_OWNED)?.settingLabel).toBe(
      "Brokers can own contacts",
    );
  });
});

describe("applyCompanyCeilings", () => {
  const broker = resolvePermissions(["broker"], {});
  const find = (rows: ReturnType<typeof applyCompanyCeilings>, id: string) =>
    rows.find((r) => r.permission.id === id)!;

  it("passes ungated rows through untouched", () => {
    const rows = applyCompanyCeilings(broker, {}, COMPANY_OWNED);
    expect(find(rows, "have-listings")).toMatchObject({
      on: true,
      locked: false,
      perPerson: false,
    });
  });

  it("locks gated rows Off under a closed ceiling and keeps the override underneath", () => {
    const overrides = { [OWN_CONTACTS]: true };
    const rows = applyCompanyCeilings(
      resolvePermissions(["office-admin"], overrides),
      overrides,
      COMPANY_OWNED,
    );
    expect(find(rows, OWN_CONTACTS)).toMatchObject({
      on: false,
      custom: false,
      locked: true,
    });
    // Re-open the ceiling: the grant is back exactly as it was.
    const reopened = applyCompanyCeilings(
      resolvePermissions(["office-admin"], overrides),
      overrides,
      BOTH_ON,
    );
    expect(find(reopened, OWN_CONTACTS)).toMatchObject({ on: true, custom: true });
  });

  it("with 'every Broker' the role default stands", () => {
    const rows = applyCompanyCeilings(broker, {}, BOTH_ON);
    for (const id of GRANTS) {
      expect(find(rows, id), id).toMatchObject({
        on: true,
        custom: false,
        perPerson: false,
      });
    }
  });

  it("with 'only people you grant it to' a Broker reads Off until granted", () => {
    const rows = applyCompanyCeilings(broker, {}, PER_PERSON);
    // The suppression is by permission, not by role — an MD reads Off here too.
    const md = applyCompanyCeilings(
      resolvePermissions(["managing-director"], {}),
      {},
      PER_PERSON,
    );
    expect(find(md, OWN_CONTACTS)).toMatchObject({ on: false, perPerson: true });
    for (const id of GRANTS) {
      expect(find(rows, id), id).toMatchObject({
        on: false,
        custom: false,
        roleDefault: false,
        perPerson: true,
      });
    }
  });

  it("counts the per-person grant as the customization it is (Bob at Summit)", () => {
    const overrides = { [OWN_CONTACTS]: true, [PRIVATE_CONTACTS]: true };
    const rows = applyCompanyCeilings(
      resolvePermissions(["broker"], overrides),
      overrides,
      PER_PERSON,
    );
    for (const id of GRANTS) {
      expect(find(rows, id), id).toMatchObject({ on: true, custom: true, perPerson: true });
    }
  });

  it("leaves the MD see-through permission on its role default either way", () => {
    // Oversight isn't handed out per person; only the two grants are.
    const md = resolvePermissions(["managing-director"], {});
    expect(find(applyCompanyCeilings(md, {}, PER_PERSON), VIEW_PRIVATE_CONTACTS))
      .toMatchObject({ on: true, perPerson: false });
  });
});

describe("isEffectivelyOn", () => {
  it("agrees with applyCompanyCeilings", () => {
    const overrides = { [PRIVATE_CONTACTS]: true };
    expect(isEffectivelyOn(["broker"], {}, OWN_CONTACTS, BOTH_ON)).toBe(true);
    expect(isEffectivelyOn(["broker"], {}, OWN_CONTACTS, COMPANY_OWNED)).toBe(false);
    expect(isEffectivelyOn(["broker"], {}, OWN_CONTACTS, PER_PERSON)).toBe(false);
    expect(isEffectivelyOn(["broker"], overrides, PRIVATE_CONTACTS, PER_PERSON)).toBe(true);
    expect(isEffectivelyOn(["broker"], overrides, PRIVATE_CONTACTS, OWN_ONLY)).toBe(false);
    // Ungated: plain role resolution.
    expect(isEffectivelyOn(["broker"], {}, "have-listings", COMPANY_OWNED)).toBe(true);
  });
});

describe("resolveContactAccess — George's table", () => {
  it("Row 1: ownership off is Model A regardless of the person", () => {
    for (const own of [true, false]) {
      for (const priv of [true, false]) {
        expect(
          resolveContactAccess(COMPANY_OWNED, { own, private: priv }),
        ).toMatchObject({ row: 1, owner: "company", canMarkPrivate: false });
      }
    }
  });

  it("Row 4: ownership allowed but not granted is Model A for this person", () => {
    expect(
      resolveContactAccess(BOTH_ON, { own: false, private: true }),
    ).toMatchObject({ row: 4, owner: "company", canMarkPrivate: false });
  });

  it("Row 2: own but transparent when privacy is off at the company", () => {
    expect(
      resolveContactAccess(OWN_ONLY, { own: true, private: true }),
    ).toMatchObject({ row: 2, owner: "broker", canMarkPrivate: false });
  });

  it("Row 3: full Model B when everything is on", () => {
    expect(
      resolveContactAccess(BOTH_ON, { own: true, private: true }),
    ).toMatchObject({ row: 3, owner: "broker", canMarkPrivate: true });
  });

  it("resolves the row George's table never spelled out to Row 2 for that person", () => {
    const r = resolveContactAccess(BOTH_ON, { own: true, private: false });
    expect(r.row).toBe("undefined");
    expect(r).toMatchObject({ owner: "broker", canMarkPrivate: false });
  });

  it("defaults the prototype to Model B, so nothing changes for anyone who never opens the card", () => {
    expect(resolveCompanyDefault(DEFAULT_CONTACT_ACCESS_SETTINGS).row).toBe(3);
  });

  it("reads the company defaults, not just the switches (Summit is Model A for a default Broker)", () => {
    expect(resolveCompanyDefault(PER_PERSON).row).toBe(4);
    expect(resolveCompanyDefault({ ...BOTH_ON, privateDefault: "granted" }).row).toBe(
      "undefined",
    );
  });
});
