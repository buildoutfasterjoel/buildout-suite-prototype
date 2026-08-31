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

/**
 * One row of the deal's Inquiries table — a contact's interest in this deal,
 * projected into the columns the table and the detail flyout both read.
 */
export type Inquiry = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  addedBy: string;
  accessLevel: (typeof ACCESS_LEVELS)[number];
  verified: boolean;
  status: string;
  referralSource: string;
  company: string;
  role: string;
  dateAdded: string;
  lastUpdated: string;
  exchange1031: string;
  expiration1031: string;
};

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Two days, in ms — the window in which an inquiry still reads as brand new. */
const NEW_INQUIRY_MS = 2 * 86_400_000;

/**
 * Synthesize the inquiry-only columns from a contact. The dates and status come
 * off the real record — an inquiry that just landed has to read as new, not as
 * one we've had on file for four months — and the rest of the inquiry-only
 * columns (access level, referral source, 1031) are deterministic filler off
 * the id.
 *
 * Each filler column gets its own field salt via `pickFor`/`oneIn`: derived off
 * one shared `hash(contact.id)` these columns moved in lockstep, so the table
 * showed Verified on exactly the "Low" access rows and one referral source per
 * inquiry status.
 */
export function toInquiry(contact: Contact): Inquiry {
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
  return {
    id: contact.id,
    name: `${contact.firstName} ${contact.lastName}`,
    initials: `${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`,
    email: contact.email,
    phone: contact.phone,
    addedBy: pickFor(ADDED_BY, contact.id, "added-by"),
    accessLevel: pickFor(ACCESS_LEVELS, contact.id, "access-level"),
    verified: oneIn(3, contact.id, "verified"),
    status: fresh ? "New" : leadStatusFor(contact.id),
    referralSource: pickFor(REFERRAL_SOURCES, contact.id, "referral-source"),
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
  };
}
