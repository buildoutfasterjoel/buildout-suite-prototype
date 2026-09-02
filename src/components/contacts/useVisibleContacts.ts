import { useMemo } from "react";
import type { Contact } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { useRoster } from "#/components/settings/users/useRoster";
import { useCurrentUser } from "#/data/currentUser";
import { useContactAccessSettings } from "#/components/settings/useContactAccessSettings";
import {
  describeVisibility,
  viewContact,
  type ContactView,
} from "#/components/contacts/contactRights";

/**
 * The contacts the signed-in user may know exist, reactive to everything that
 * decides it: the records and their shares, the roster (roles, overrides, the
 * "Viewing as" seat) and the company's contact-ownership settings.
 *
 * `privateIds` are the visible ones that are private — for a Managing Director
 * with View Private Contacts, or a collaborator shared into a private record —
 * so a list can mark them without re-resolving per row.
 */
export function useVisibleContacts(): {
  contacts: Contact[];
  privateIds: Set<string>;
  previewIds: Set<string>;
} {
  const contacts = useDataStore((s) => s.contacts);
  const shares = useDataStore((s) => s.contactShares);
  const roster = useRoster((s) => s.users);
  const viewer = useCurrentUser((s) => s.id);
  const settings = useContactAccessSettings((s) => s.settings);
  return useMemo(
    () => describeVisibility([...contacts.values()]),
    // `shares`, `roster` and `settings` are read inside `describeVisibility`
    // from the stores; they're here so the memo tracks them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contacts, shares, roster, settings, viewer],
  );
}

/**
 * A contact as the viewer may see it on a shared object — whole, or masked as a
 * "Private Contact" — reactive to the seat, the settings and the shares. Deal
 * surfaces read the store without subscribing, so without this a row rendered
 * before the "Viewing as" seat hydrated would keep the name it shouldn't show.
 */
export function useContactView(contact: Contact): ContactView {
  const shares = useDataStore((s) => s.contactShares);
  const roster = useRoster((s) => s.users);
  const viewer = useCurrentUser((s) => s.id);
  const settings = useContactAccessSettings((s) => s.settings);
  return useMemo(
    () => viewContact(contact),
    // Read inside `viewContact` from the stores; listed so the memo tracks them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contact, shares, roster, settings, viewer],
  );
}
