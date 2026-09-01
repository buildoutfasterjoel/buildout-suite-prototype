/**
 * The viewer's rights on a contact, resolvable from anywhere — not just the
 * contact page. The page resolves rights through hooks; the global entry points
 * (the call flow, the task modal, the assistant's tools, the People page's bulk
 * actions) run outside React or outside the record, so they read the stores
 * directly here and ask the same question the page does.
 *
 * A contact the store doesn't know (a test fixture, an ad-hoc record) has
 * nothing to judge and passes — the rule is about records, not about strings.
 */
import { useDataStore } from "#/data/dataStore";
import { useRoster } from "#/components/settings/users/useRoster";
import { useContactAccessSettings } from "#/components/settings/useContactAccessSettings";
import { COMPANY_SETTINGS } from "#/data/companySettings";
import { resolveContactOwnership, type ContactOwnership } from "#/data/contactOwnership";
import {
  accountableName,
  canSeeContact,
  resolveViewerRights,
  type ContactRights,
} from "#/data/contactViewerAccess";
import {
  VIEW_PRIVATE_CONTACTS,
  isEffectivelyOn,
  type ContactAccessSettings,
} from "#/data/contactAccess";
import type { RosterUser } from "#/data/roster";
import { CURRENT_USER } from "#/data/teammates";
import { DEFAULT_CONTACT_SHARES } from "#/data/teammates";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { notify } from "#/lib/notify";
import type { Contact } from "#/data/types";

export type ContactRight = "canLog" | "canEdit" | "canReachOut" | "canShare";

const VERB: Record<ContactRight, string> = {
  canLog: "log activity on",
  canEdit: "make changes to",
  canReachOut: "call or email",
  canShare: "share",
};

export function rightsForContactId(
  contactId: string,
): { contact: Contact; ownership: ContactOwnership; rights: ContactRights } | null {
  const contact = useDataStore.getState().contacts.get(contactId);
  if (!contact) return null;
  const shares = useDataStore.getState().contactShares.get(contactId) ?? DEFAULT_CONTACT_SHARES;
  const ownership = resolveContactOwnership(
    contact,
    useRoster.getState().users,
    useContactAccessSettings.getState().settings,
    COMPANY_SETTINGS.name,
  );
  return { contact, ownership, rights: resolveViewerRights(ownership, shares) };
}

/** Whether the viewer holds a right on a contact, with the sentence to show if not. */
export function checkContactRight(
  contactId: string,
  right: ContactRight,
): { ok: true } | { ok: false; message: string } {
  const r = rightsForContactId(contactId);
  if (!r || r.rights[right]) return { ok: true };
  const who = accountableName(r.ownership);
  const holds =
    r.ownership.owner.kind === "company" ? "is assigned to this contact" : "owns this contact";
  return {
    ok: false,
    message: `You can't ${VERB[right]} ${contactFullName(r.contact)}. ${who} ${holds} — request access from the contact's page.`,
  };
}

/** `checkContactRight` for UI entry points: toasts the reason and returns false when denied. */
export function guardContactRight(contactId: string, right: ContactRight): boolean {
  const r = checkContactRight(contactId, right);
  if (r.ok) return true;
  notify({ title: "You don't have access", description: r.message });
  return false;
}

// ── Visibility ───────────────────────────────────────────────────────────────

/** Whether the signed-in user holds View Private Contacts right now. */
export function viewerSeesPrivate(
  roster: RosterUser[] = useRoster.getState().users,
  settings: ContactAccessSettings = useContactAccessSettings.getState().settings,
): boolean {
  const viewer = roster.find((u) => u.id === CURRENT_USER.id);
  return !!viewer && isEffectivelyOn(viewer.roleIds, viewer.overrides, VIEW_PRIVATE_CONTACTS, settings);
}

/**
 * Split a contact list into what the viewer may see, plus which of those are
 * private (so a list can mark them). Resolves the roster and settings once.
 */
export function describeVisibility(contacts: Contact[]): {
  contacts: Contact[];
  privateIds: Set<string>;
} {
  const roster = useRoster.getState().users;
  const settings = useContactAccessSettings.getState().settings;
  const seesPrivate = viewerSeesPrivate(roster, settings);
  // A store slice built by hand may carry contacts without a shares map.
  const allShares = useDataStore.getState().contactShares ?? new Map();
  const visible: Contact[] = [];
  const privateIds = new Set<string>();
  for (const c of contacts) {
    const ownership = resolveContactOwnership(c, roster, settings, COMPANY_SETTINGS.name);
    if (!ownership.isPrivate) {
      visible.push(c);
      continue;
    }
    if (canSeeContact(ownership, allShares.get(c.id) ?? DEFAULT_CONTACT_SHARES, seesPrivate)) {
      visible.push(c);
      privateIds.add(c.id);
    }
  }
  return { contacts: visible, privateIds };
}

/** The contacts the viewer may know exist. Every enumeration of the book goes through here. */
export function visibleContacts(contacts: Contact[] = [...useDataStore.getState().contacts.values()]): Contact[] {
  return describeVisibility(contacts).contacts;
}

/** Whether one contact exists, as far as the viewer is concerned. Unknown ids do. */
export function isContactVisible(contactId: string): boolean {
  const c = useDataStore.getState().contacts.get(contactId);
  if (!c) return true;
  return describeVisibility([c]).contacts.length === 1;
}

/** The subset of contacts the viewer may change — for bulk actions. */
export function editableContactIds(ids: string[]): { allowed: string[]; skipped: number } {
  const allowed = ids.filter((id) => checkContactRight(id, "canEdit").ok);
  return { allowed, skipped: ids.length - allowed.length };
}
