import type { Contact } from "#/data/types";
import { OWNER_VOICES } from "./ttsConfig";

/**
 * Small curated first-name → gender map plus a suffix heuristic. This only
 * chooses a voice for the simulated owner in a call; it never affects data.
 * Unknown names default to male so a voice is always produced.
 */
const FEMALE_NAMES = new Set([
  "sarah", "emily", "jessica", "ashley", "amanda", "jennifer", "elizabeth",
  "linda", "susan", "karen", "nancy", "lisa", "margaret", "sandra", "patricia",
  "mary", "barbara", "carol", "diane", "grace", "rachel", "anna", "laura",
]);
const MALE_NAMES = new Set([
  "marcus", "john", "james", "robert", "michael", "william", "david", "richard",
  "joseph", "thomas", "charles", "daniel", "matthew", "anthony", "mark", "paul",
  "steven", "andrew", "kenneth", "george", "edward", "frank", "carl", "henry",
]);

export function genderFromFirstName(firstName: string): "female" | "male" {
  const name = firstName.trim().toLowerCase();
  if (FEMALE_NAMES.has(name)) return "female";
  if (MALE_NAMES.has(name)) return "male";
  if (name.endsWith("a") || name.endsWith("ie") || name.endsWith("elle")) return "female";
  return "male";
}

/** Stable non-negative hash of a string (djb2). */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export function ownerVoiceFor(contact: Pick<Contact, "id" | "firstName">): string {
  const pool = OWNER_VOICES[genderFromFirstName(contact.firstName)];
  return pool[hashString(contact.id) % pool.length];
}
