import { useEffect } from "react";
import { create } from "zustand";
import {
  DEFAULT_CONTACT_ACCESS_SETTINGS,
  type ContactAccessSettings,
  type GrantDefault,
} from "#/data/contactAccess";

/**
 * Store for the two contact-ownership ceilings on the Company settings card.
 *
 * Unlike the rest of `CompanyInfoForm`, which keeps its edits in component
 * state, these two have to be readable elsewhere — the permissions page locks
 * rows under a closed ceiling, and `useCan` refuses to grant past one.
 *
 * Persisted to localStorage under `contact_access_settings`, the same way the
 * "Viewing as" seat is (`dev_viewer`): a demo flips the company setting, then
 * walks to a broker's permissions page and the contact hero to watch it land,
 * and a full reload on the way must not quietly put the company back on Model
 * B. Restored in an effect (`useHydrateContactAccessSettings`) rather than at
 * module load so SSR and the first client render agree. `SEED_VERSION` doesn't
 * move — this isn't world data.
 */
interface ContactAccessState {
  settings: ContactAccessSettings;
  setSettings: (next: ContactAccessSettings) => void;
}

const STORAGE_KEY = "contact_access_settings";

function readStored(): ContactAccessSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.brokersCanOwnContacts !== "boolean" ||
      typeof parsed?.ownedContactsCanBePrivate !== "boolean"
    ) {
      return null;
    }
    const grantDefault = (v: unknown): GrantDefault =>
      v === "granted" ? "granted" : "brokers";
    return {
      brokersCanOwnContacts: parsed.brokersCanOwnContacts,
      ownDefault: grantDefault(parsed.ownDefault),
      ownedContactsCanBePrivate: parsed.ownedContactsCanBePrivate,
      privateDefault: grantDefault(parsed.privateDefault),
    };
  } catch {
    return null;
  }
}

export const useContactAccessSettings = create<ContactAccessState>((set) => ({
  settings: DEFAULT_CONTACT_ACCESS_SETTINGS,
  setSettings: (settings) => {
    set({ settings });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable — the session still works, it just won't survive a reload.
    }
  },
}));

/** Restore the persisted ceilings once the client is up. Mount once, in the shell. */
export function useHydrateContactAccessSettings(): void {
  useEffect(() => {
    const stored = readStored();
    if (stored) useContactAccessSettings.setState({ settings: stored });
  }, []);
}
