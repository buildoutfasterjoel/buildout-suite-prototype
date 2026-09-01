/**
 * One Person, many Relationships — the middle-depth version.
 *
 * A Contact is one broker's relationship with a human. Two brokers can each
 * hold a record for the same human, and under a private book that is the
 * intended outcome, not a data error: Susan's fifteen-year Jim Halvorsen and
 * Tom's brand-new one are two relationships. `personId` says they're the same
 * person; nothing else moves off the records, and there is no Person table —
 * there's nothing to store on it yet that isn't already on the records, and a
 * second table is what makes merge feel mandatory.
 *
 * Everything here is resolved at read time over the book *as the viewer may
 * see it*. That ordering is the load-bearing rule: Tom never learns Susan has
 * Jim while her record is private and unshared, because her record isn't in
 * the list this runs over.
 */
import type { Contact } from "#/data/types";

export function normalizeEmail(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}

/** Digits only, so "(843) 555-0100" and "843.555.0100" agree. */
export function normalizePhone(phone: string | undefined | null): string {
  return (phone ?? "").replace(/\D/g, "");
}

export interface Siblings {
  /** Records already linked as the same person. */
  linked: Contact[];
  /** Records that look like the same person (same email or phone) but aren't linked. */
  suspected: Contact[];
}

function sameContactDetails(a: Contact, b: Contact): boolean {
  const ea = normalizeEmail(a.email);
  const pa = normalizePhone(a.phone);
  const emails = new Set([ea, ...(a.emails ?? []).map(normalizeEmail)].filter(Boolean));
  const phones = new Set([pa, ...(a.phones ?? []).map(normalizePhone)].filter((p) => p.length >= 7));
  const eb = [normalizeEmail(b.email), ...(b.emails ?? []).map(normalizeEmail)].filter(Boolean);
  const pb = [normalizePhone(b.phone), ...(b.phones ?? []).map(normalizePhone)].filter(
    (p) => p.length >= 7,
  );
  return eb.some((e) => emails.has(e)) || pb.some((p) => phones.has(p));
}

/**
 * The other relationships with this person, among the records the viewer may
 * see. Pass the visible book, never the whole store.
 */
export function siblingRelationships(contact: Contact, visibleBook: Contact[]): Siblings {
  const linked: Contact[] = [];
  const suspected: Contact[] = [];
  for (const other of visibleBook) {
    if (other.id === contact.id) continue;
    if (contact.personId && other.personId === contact.personId) {
      linked.push(other);
    } else if (!other.personId || !contact.personId) {
      // Either side unlinked: a match on contact details is a suspicion. Two
      // records already linked to *different* people are not.
      if (sameContactDetails(contact, other)) suspected.push(other);
    }
  }
  return { linked, suspected };
}

/**
 * For Create Contact: the visible record these details already belong to, if
 * any. A hidden match returns nothing — that's the intentional duplicate, and
 * it is what makes privacy real at creation.
 */
export function duplicateOf(
  details: { email?: string | null; phone?: string | null },
  visibleBook: Contact[],
): Contact | undefined {
  const email = normalizeEmail(details.email);
  const phone = normalizePhone(details.phone);
  if (!email && phone.length < 7) return undefined;
  return visibleBook.find((c) => {
    const emails = [c.email, ...(c.emails ?? [])].map(normalizeEmail).filter(Boolean);
    const phones = [c.phone, ...(c.phones ?? [])].map(normalizePhone).filter((p) => p.length >= 7);
    return (!!email && emails.includes(email)) || (phone.length >= 7 && phones.includes(phone));
  });
}

/**
 * contact id → how many visible relationships share its person (2 or more
 * only). For the People table's "2 relationships" chip.
 */
export function relationshipCounts(visibleBook: Contact[]): Map<string, number> {
  const byPerson = new Map<string, Contact[]>();
  for (const c of visibleBook) {
    if (!c.personId) continue;
    byPerson.set(c.personId, [...(byPerson.get(c.personId) ?? []), c]);
  }
  const out = new Map<string, number>();
  for (const group of byPerson.values()) {
    if (group.length < 2) continue;
    for (const c of group) out.set(c.id, group.length);
  }
  return out;
}
