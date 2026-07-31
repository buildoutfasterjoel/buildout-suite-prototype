import { create } from "zustand";
import { oneIn } from "#/components/properties/propertyDisplay";

/**
 * Whether one phone number or email address on a contact is verified.
 *
 * The seed data carries no per-record verification flag, so the baseline is
 * derived deterministically from the contact × value pair (see
 * {@link seededVerified}) and the broker's toggles are held here as overrides.
 * Prototype-local: keyed by contact + value so it survives stepping between
 * contacts in a call session, and resets on a hard refresh.
 */
interface ContactVerification {
  overrides: Record<string, boolean>;
  /** Flips one record. `current` is the value being displayed, seed included. */
  toggle: (key: string, current: boolean) => void;
}

export const useContactVerification = create<ContactVerification>((set) => ({
  overrides: {},
  toggle: (key, current) =>
    set((s) => ({ overrides: { ...s.overrides, [key]: !current } })),
}));

/** Store key for one record. Values are unique per contact, so the pair is enough. */
export function verificationKey(contactId: string, value: string): string {
  return `${contactId}:${value}`;
}

/**
 * Baseline verification for one record: the primary is verified — it's the
 * number or address the broker has actually been reaching them on — and extras
 * split evenly, so a contact with several records shows a realistic mix rather
 * than a uniformly green (or uniformly grey) block.
 */
export function seededVerified(key: string, isPrimary: boolean): boolean {
  return isPrimary || oneIn(2, key, "verified");
}
