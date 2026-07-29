import type { Contact } from "#/data/types";
import { hash, oneIn, pickFor } from "#/components/properties/propertyDisplay";

/** Where a synthesized inquiry came in from — the demo's syndication mix. */
const CHANNELS = ["Buildout site", "LoopNet", "Crexi", "Brochure link"] as const;

/**
 * The two ways a lead registers themselves against a marketed listing. A
 * document request carries a CA, which makes it the warmer of the two — worth
 * distinguishing on the card.
 */
export type InquiryKind = "docs" | "form";

export interface InquiryFacts {
  kind: InquiryKind;
  /** How the inquiry reads on a badge — phrased as what they did. */
  label: string;
  /** Longer form for the badge's tooltip. */
  tooltip: string;
  /** Only meaningful for `docs` — a contact form needs no signature. */
  caSigned: boolean;
  channel: string;
  /** ISO date the inquiry landed — per inquiry, never the contact's created date. */
  date: string;
  /** The contact's own words, when the inquiry carried them. */
  message: string | null;
}

/**
 * What we know about one contact's inquiry on one listing.
 *
 * Real data comes off `Contact.inquiryDetails` (the demo's inbound leads carry
 * their exact words and channel); everything else is synthesized
 * deterministically from the pair of ids, the same way the Leads tab fills its
 * lead-only columns — so a given contact × listing reads identically on the
 * card, the Leads row, and both card styles.
 */
export function inquiryFacts(contact: Contact, listingId: string): InquiryFacts {
  const detail = contact.inquiryDetails?.[listingId];
  const pair = `${contact.id}:${listingId}`;
  const h = hash(pair);
  // A written message means they filled in the contact form; otherwise split
  // the synthesized inquiries between the two registration paths. Each
  // synthesized field carries its own salt so they vary independently — off one
  // shared hash, `h % 4` was a subset of `h % 2`, so no unsigned CA ever landed
  // on a `form` inquiry.
  const kind: InquiryKind = detail?.message
    ? "form"
    : oneIn(2, pair, "kind")
      ? "docs"
      : "form";
  return {
    kind,
    label: kind === "docs" ? "Requested Documents" : "Completed a Form",
    tooltip:
      kind === "docs"
        ? "Requested access to this listing's secure documents"
        : "Completed the listing's contact form",
    caSigned: !oneIn(4, pair, "ca-signed"),
    channel: detail?.channel ?? pickFor(CHANNELS, pair, "channel"),
    // The record's own date when it has one. The fallback varies by listing so a
    // contact's several inquiries don't stack on one day, and never predates the
    // contact — you can't inquire before you're in the book.
    date: detail?.date ?? fallbackDate(contact.createdAt, h),
    message: detail?.message ?? null,
  };
}

/** A per-inquiry date derived from the contact × listing pair. */
function fallbackDate(createdAt: string, h: number): string {
  const created = new Date(createdAt).getTime();
  const daysSince = Math.floor((Date.now() - created) / DAY);
  // Somewhere in the contact's lifetime, capped at ~90 days back so an inquiry
  // still reads as live interest on a long-standing record.
  const back = daysSince <= 0 ? 0 : (h % Math.min(daysSince, 90)) + 1;
  return new Date(Date.now() - back * DAY).toISOString();
}

const DAY = 86_400_000;
