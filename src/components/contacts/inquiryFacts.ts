import type { Contact } from "#/data/types";
import { hash } from "#/components/properties/propertyDisplay";

/** Where a synthesized inquiry came in from — the demo's syndication mix. */
const CHANNELS = ["Buildout site", "LoopNet", "Crexi"] as const;

/**
 * The two ways a lead registers themselves against a marketed listing. A
 * document request carries a CA, which makes it the warmer of the two — worth
 * distinguishing on the card.
 */
export type InquiryKind = "docs" | "form";

export interface InquiryFacts {
  kind: InquiryKind;
  /** Only meaningful for `docs` — a contact form needs no signature. */
  caSigned: boolean;
  channel: string;
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
  const h = hash(`${contact.id}:${listingId}`);
  return {
    // A written message means they filled in the contact form; otherwise split
    // the synthesized inquiries between the two registration paths.
    kind: detail?.message ? "form" : h % 2 === 0 ? "docs" : "form",
    caSigned: h % 4 !== 0,
    channel: detail?.channel ?? CHANNELS[h % CHANNELS.length],
    message: detail?.message ?? null,
  };
}
