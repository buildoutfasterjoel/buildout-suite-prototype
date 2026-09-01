import { useMemo } from "react";
import type { Contact } from "#/data/types";
import { COMPANY_SETTINGS } from "#/data/companySettings";
import {
  resolveContactOwnership,
  type ContactOwnership,
} from "#/data/contactOwnership";
import { useRoster } from "#/components/settings/users/useRoster";
import { useContactAccessSettings } from "#/components/settings/useContactAccessSettings";

/**
 * A contact's resolved ownership, reactive to the three things that decide it:
 * the record's private flag, the roster (roles, overrides, and the "Viewing as"
 * seat), and the company's contact-ownership settings.
 */
export function useContactOwnership(contact: Contact): ContactOwnership {
  const roster = useRoster((s) => s.users);
  const settings = useContactAccessSettings((s) => s.settings);
  return useMemo(
    () =>
      resolveContactOwnership(contact, roster, settings, COMPANY_SETTINGS.name),
    [contact, roster, settings],
  );
}
