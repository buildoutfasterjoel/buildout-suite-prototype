import { useMemo } from "react";
import type { Contact } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { useRoster } from "#/components/settings/users/useRoster";
import { useContactAccessSettings } from "#/components/settings/useContactAccessSettings";
import { describeVisibility } from "#/components/contacts/contactRights";

/**
 * The contacts the signed-in user may know exist, reactive to everything that
 * decides it: the records and their shares, the roster (roles, overrides, the
 * "Viewing as" seat) and the company's contact-ownership settings.
 *
 * `privateIds` are the visible ones that are private — for a Managing Director
 * with View Private Contacts, or a collaborator shared into a private record —
 * so a list can mark them without re-resolving per row.
 */
export function useVisibleContacts(): { contacts: Contact[]; privateIds: Set<string> } {
  const contacts = useDataStore((s) => s.contacts);
  const shares = useDataStore((s) => s.contactShares);
  const roster = useRoster((s) => s.users);
  const settings = useContactAccessSettings((s) => s.settings);
  return useMemo(
    () => describeVisibility([...contacts.values()]),
    // `shares`, `roster` and `settings` are read inside `describeVisibility`
    // from the stores; they're here so the memo tracks them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contacts, shares, roster, settings],
  );
}
