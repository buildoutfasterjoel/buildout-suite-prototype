import type { Contact } from "#/data/types";
import { leadStatusFor } from "#/data/leadFacts";
import { oneIn, pickFor } from "./propertyDisplay";

export const ACCESS_LEVELS = ["Low", "Medium", "High"] as const;

export const REFERRAL_SOURCES = [
  "Website",
  "Email",
  "Direct",
  "Referral",
  "Syndication",
];

export const ADDED_BY = ["AE", "MK", "JL", "RS", "TC", "DP"];

export const ROLE_LABELS: Record<Contact["role"], string> = {
  owner: "Owner",
  broker: "Broker",
  buyer: "Buyer",
  tenant: "Tenant",
  lender: "Lender",
};

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/**
 * One row of the deal's Inquiries table — a contact's interest in this deal,
 * projected into the fields the table and the detail panel both read.
 */
export type Inquiry = {
  id: string;
  /**
   * The listing this inquiry is *about* — the key every edit is written under.
   * Not necessarily the deal whose page you are on: a suite's inquiry seen from
   * the building's list is still the suite's inquiry, and must not be stored
   * twice under two different ids.
   */
  listingId: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  addedBy: string;
  accessLevel: AccessLevel;
  verified: boolean;
  status: string;
  referralSource: string;
  company: string;
  role: string;
  dateAdded: string;
  lastUpdated: string;
  exchange1031: string;
  expiration1031: string;
  /** Journey stage 1 — whether they made an account after inquiring. */
  createdProfile: boolean;
  caSigned: boolean;
  caFileName: string | null;
  /** Display date the CA was marked signed, or null. */
  caSignedAt: string | null;
};

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Two days, in ms — the window in which an inquiry still reads as brand new. */
const NEW_INQUIRY_MS = 2 * 86_400_000;

/** `caFileName` for a CA nobody actually uploaded — and for the ones they do. */
export function caFileNameFor(name: string): string {
  return `CA — ${name}.pdf`;
}

/**
 * Project a contact into one row of the Inquiries table.
 *
 * The dates and status come off the real record — an inquiry that just landed
 * has to read as new, not as one we've had on file for four months — and the
 * rest of the inquiry-only columns (access level, referral source, 1031, CA)
 * are deterministic filler off the id.
 *
 * Each filler column gets its own field salt via `pickFor`/`oneIn`: derived off
 * one shared `hash(contact.id)` these columns moved in lockstep, so the table
 * showed Verified on exactly the "Low" access rows and one referral source per
 * inquiry status.
 *
 * **Anything a broker edited in the panel then overrides the filler.** Storing
 * only what someone touched — rather than seeding every field for real — is
 * what lets this change leave `SEED_VERSION` alone: a snapshot written before
 * these fields existed still loads, and simply has none of them.
 */
export function toInquiry(contact: Contact, listingId: string): Inquiry {
  const added = new Date(contact.createdAt);
  const updated = new Date(
    contact.lastActivityAt ?? contact.lastContactedAt ?? contact.createdAt,
  );
  const has1031 = oneIn(5, contact.id, "1031-exchange");
  // Never contacted and only just added → New. Otherwise keep the spread of
  // statuses the table is built to show.
  const fresh =
    contact.lastContactedAt == null &&
    Date.now() - added.getTime() < NEW_INQUIRY_MS;
  const name = `${contact.firstName} ${contact.lastName}`;
  const edited = contact.inquiryDetails?.[listingId];

  const verified = edited?.verified ?? oneIn(3, contact.id, "verified");

  // Once a broker has touched the CA at all, its file and date are exactly what
  // they left — never the synthesized ones. Otherwise flipping the "mark signed"
  // switch, which deliberately stores no file, would fall through to the filler
  // and show a document nobody uploaded.
  const caTouched = edited?.caSigned !== undefined;
  const caSigned = edited?.caSigned ?? oneIn(3, contact.id, "ca-signed");
  const caFileName = caTouched
    ? (edited.caFileName ?? null)
    : caSigned
      ? caFileNameFor(name)
      : null;
  const caSignedAt = caTouched
    ? (edited.caSignedAt ?? null)
    : caSigned
      ? fmtDate(updated)
      : null;

  return {
    id: contact.id,
    listingId,
    name,
    initials: `${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`,
    email: contact.email,
    phone: contact.phone,
    addedBy: pickFor(ADDED_BY, contact.id, "added-by"),
    accessLevel:
      edited?.accessLevel ?? pickFor(ACCESS_LEVELS, contact.id, "access-level"),
    verified,
    status: fresh ? "New" : leadStatusFor(contact.id),
    referralSource:
      edited?.referralSource ??
      pickFor(REFERRAL_SOURCES, contact.id, "referral-source"),
    company: contact.company,
    role: ROLE_LABELS[contact.role],
    dateAdded: fmtDate(added),
    lastUpdated: fmtDate(updated),
    exchange1031: has1031 ? "Yes" : "--",
    expiration1031: has1031
      ? fmtDate(
          new Date(added.getFullYear() + 1, added.getMonth(), added.getDate()),
        )
      : "--",
    // Verifying an email means they made an account first, so a verified lead
    // always reads as having created a profile. Without that, the funnel would
    // cap a verified lead at stage 0 and the bar would contradict the Account
    // Status shown beside it.
    createdProfile: verified || oneIn(2, contact.id, "created-profile"),
    caSigned,
    caFileName,
    caSignedAt,
  };
}
