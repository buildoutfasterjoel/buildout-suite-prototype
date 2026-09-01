/**
 * Who owns a contact, who works it, and whether it's hidden — resolved from the
 * record, the roster, and the company's contact-ownership settings.
 *
 * Every contact has exactly one accountable person: the assignee. Whether that
 * person *owns* the record depends on the company ceiling and their own grant
 * (see `contactAccess.ts`). When they don't, the company owns it and the
 * assignee is working it on the company's behalf — George's Model A, where
 * assignment is responsibility, not access.
 *
 * Ownership is derived at read time rather than stamped on the record so the
 * trickle-down is visible: flip the company switch and the hero changes. A real
 * migration would stamp `ownerId` at creation ("settings only change the
 * starting state"); the prototype trades that fidelity for a live demo.
 */
import type { Contact } from "#/data/types";
import { viewerId } from "#/data/currentUser";
import type { RosterUser } from "#/data/roster";
import { CURRENT_USER } from "#/data/teammates";
import {
  OWN_CONTACTS,
  PRIVATE_CONTACTS,
  isEffectivelyOn,
  type ContactAccessSettings,
} from "#/data/contactAccess";

export type ContactOwner =
  | { kind: "company"; name: string }
  | { kind: "person"; user: RosterUser };

export interface ContactOwnership {
  /** The roster row for `contact.assignedTo`, when the name resolves to one. */
  assignee?: RosterUser;
  owner: ContactOwner;
  /**
   * The owner may hide this record: it's broker-owned, the company allows
   * privacy, and the owner holds Mark Contacts Private. Also decides whether the
   * hero shows the Visible / Private badge at all — a record that could never
   * be hidden has nothing to say about it.
   */
  canMarkPrivate: boolean;
  /**
   * Hidden from the firm right now. A record marked private stays marked, but
   * reads visible the moment privacy is no longer allowed for its owner — the
   * flag is kept so re-opening the ceiling restores it.
   */
  isPrivate: boolean;
}

/**
 * The roster row a contact's `assignedTo` names. New contacts are stamped "You"
 * (see `createContact`); seeded ones carry a roster member's full name. Anything
 * else — a fixture like "J. Whitfield" — resolves to nobody, and the contact
 * reads as company-owned with a text-only assignee.
 */
export function assigneeFor(
  contact: Pick<Contact, "assignedTo">,
  roster: RosterUser[],
): RosterUser | undefined {
  // Tolerates a partial record (test fixtures, ad-hoc objects): no assignee is
  // simply nobody, and the contact reads as company-owned.
  const name = (contact.assignedTo ?? "").trim();
  if (name === "You") return roster.find((u) => u.id === CURRENT_USER.id);
  return roster.find((u) => u.name === name);
}

export function resolveContactOwnership(
  contact: Pick<Contact, "assignedTo" | "isPrivate">,
  roster: RosterUser[],
  settings: ContactAccessSettings,
  companyName: string,
): ContactOwnership {
  const assignee = assigneeFor(contact, roster);
  const owns =
    assignee !== undefined &&
    isEffectivelyOn(assignee.roleIds, assignee.overrides, OWN_CONTACTS, settings);
  if (!assignee || !owns) {
    return {
      assignee,
      owner: { kind: "company", name: companyName },
      canMarkPrivate: false,
      isPrivate: false,
    };
  }
  const canMarkPrivate = isEffectivelyOn(
    assignee.roleIds,
    assignee.overrides,
    PRIVATE_CONTACTS,
    settings,
  );
  return {
    assignee,
    owner: { kind: "person", user: assignee },
    canMarkPrivate,
    isPrivate: canMarkPrivate && contact.isPrivate === true,
  };
}

/** Whether the signed-in user is this contact's owner — the one who may lock it. */
export function viewerOwns(ownership: ContactOwnership): boolean {
  return ownership.owner.kind === "person" && ownership.owner.user.id === viewerId();
}

/** Display name for the owner, for tooltips and the share modal. */
export function ownerName(owner: ContactOwner): string {
  return owner.kind === "company" ? owner.name : owner.user.name;
}
