import type { Contact } from "#/data/types";
import { listDealsForContact } from "#/data/selectors";
import { signalText } from "#/data/signal";
import { contactFullName } from "#/components/contacts/contactDisplay";

/** Stages where the broker already has a live relationship worth naming. */
const WARM = new Set(["active", "pitching", "client"]);

/**
 * Lower the first character of a clause so a headline written as a standalone
 * phrase reads correctly mid-sentence. Left alone when it starts with an
 * acronym (CMBS, LOI) or a proper noun already in caps.
 */
function asClause(text: string): string {
  if (!text) return "";
  const trimmed = text.replace(/\.$/, "");
  if (/^[A-Z]{2,}/.test(trimmed)) return trimmed;
  return trimmed[0].toLowerCase() + trimmed.slice(1);
}

/**
 * The spoken hand-off when the broker takes a call straight off the queue:
 * where they're being sent, the two or three facts worth having in their head
 * before the line connects, and that it's dialing.
 *
 * Every clause is read off the live record — the signal, their open deals, the
 * phone status — so the brief can't claim something the record doesn't say. When
 * there's nothing substantive to offer, the brief sentence is dropped rather
 * than padded.
 */
export function composeCallHandoff(contact: Contact): string {
  const name = contactFullName(contact).trim();
  const clauses: string[] = [];

  const signal = signalText(contact);
  if (signal) clauses.push(asClause(signal));

  const deals = listDealsForContact(contact.id);
  if (deals.length === 1) {
    clauses.push(`you're live with them on ${deals[0].name}`);
  } else if (deals.length > 1) {
    clauses.push(`you're live with them on ${deals.length} deals`);
  } else if (WARM.has(contact.relationship)) {
    clauses.push(`they're ${contact.relationship} but with no deal attached yet`);
  }

  if (contact.phoneStatus === "valid") clauses.push("their number's verified");

  const brief = clauses.length ? ` Quick brief before you dial: ${joinClauses(clauses)}.` : "";
  return `Taking you to ${name}.${brief} Connecting now…`;
}

/** "a, b, and c" — Oxford comma only once there are three or more. */
function joinClauses(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
