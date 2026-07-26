import type { Contact } from "./types";
import { useDataStore } from "./dataStore";

/** The string form of an owner's signal, used by the greeting's overnightSignal
 * and by generator `property.signal` payloads. Empty when there is no signal. */
export function signalText(contact: Pick<Contact, "signal">): string {
  return contact.signal?.headline ?? "";
}

/** The single overnight-signal owner that lights the greeting (the hero, Rosa).
 * Null when the seed hasn't placed one. */
export function getOvernightSignalContact(): Contact | null {
  for (const c of useDataStore.getState().contacts.values()) {
    if (c.heroKey === "rosa" && c.signal) return c;
  }
  return null;
}
