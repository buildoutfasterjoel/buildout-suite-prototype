import { describe, expect, it } from "vitest";
import type { Contact } from "#/data/types";
import { caFileNameFor, toInquiry } from "./inquiryRow";

function contact(patch: Partial<Contact> = {}): Contact {
  return {
    id: "contact-fixture-1",
    firstName: "Dana",
    lastName: "Reyes",
    email: "dana@example.com",
    phone: "(555) 010-0000",
    company: "Reyes Holdings",
    role: "buyer",
    propertyIds: [],
    assignedTo: "J. Lopez",
    source: "Listing inquiry",
    relationship: "inquired",
    side: null,
    dealStage: null,
    inquiries: 1,
    phoneStatus: "unknown",
    doNotCall: false,
    title: "Principal",
    createdAt: "2026-01-05T00:00:00.000Z",
    lastTouch: "Inquired",
    lastContactedAt: "2026-02-01T00:00:00.000Z",
    openTaskCount: 0,
    street: "",
    city: "",
    state: "",
    zip: "",
    tags: [],
    ...patch,
  } as Contact;
}

describe("toInquiry — synthesized values", () => {
  it("is stable for one contact and keyed to the listing it is read under", () => {
    const c = contact();
    expect(toInquiry(c, "L1")).toEqual(toInquiry(c, "L1"));
    expect(toInquiry(c, "L1").listingId).toBe("L1");
    expect(toInquiry(c, "L2").listingId).toBe("L2");
  });

  it("always reads a verified lead as having created a profile", () => {
    // Otherwise the funnel caps them at stage 0 while the panel's Account
    // Status row two inches below says Verified.
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const row = toInquiry(contact({ id }), "L1");
      if (row.verified) expect(row.createdProfile).toBe(true);
    }
  });
});

describe("toInquiry — broker overrides", () => {
  const withEdit = (edit: Record<string, unknown>) =>
    contact({
      inquiryDetails: { L1: edit },
    } as Partial<Contact>);

  it("prefers a stored value over the synthesized one", () => {
    const row = toInquiry(
      withEdit({
        accessLevel: "High",
        referralSource: "Referral",
        status: "Qualified",
      }),
      "L1",
    );
    expect(row.accessLevel).toBe("High");
    expect(row.referralSource).toBe("Referral");
    expect(row.status).toBe("Qualified");
  });

  it("keeps an override scoped to its own listing", () => {
    // The reason edits live per listing: granting High on one deal must not
    // grant it on every other deal the same person inquired about. L2 has to
    // read exactly as it would with no edit anywhere on the record.
    const edited = withEdit({ accessLevel: "High" });
    const untouched = contact();
    expect(toInquiry(edited, "L1").accessLevel).toBe("High");
    expect(toInquiry(edited, "L2").accessLevel).toBe(
      toInquiry(untouched, "L2").accessLevel,
    );
  });

  it("names the uploaded file once a CA is uploaded", () => {
    const row = toInquiry(
      withEdit({
        caSigned: true,
        caFileName: caFileNameFor("Dana Reyes"),
        caSignedAt: "03/04/2026",
      }),
      "L1",
    );
    expect(row.caSigned).toBe(true);
    expect(row.caFileName).toBe("CA — Dana Reyes.pdf");
    expect(row.caSignedAt).toBe("03/04/2026");
  });

  it("shows no file when the CA was marked signed by hand", () => {
    // The switch stores a date and no file on purpose — the broker took the
    // agreement outside the app. Falling back to the synthesized name here
    // would show a document nobody uploaded.
    const row = toInquiry(
      withEdit({ caSigned: true, caSignedAt: "03/04/2026" }),
      "L1",
    );
    expect(row.caSigned).toBe(true);
    expect(row.caFileName).toBeNull();
  });

  it("clears the file when the CA is removed", () => {
    const row = toInquiry(withEdit({ caSigned: false }), "L1");
    expect(row.caSigned).toBe(false);
    expect(row.caFileName).toBeNull();
    expect(row.caSignedAt).toBeNull();
  });
});
