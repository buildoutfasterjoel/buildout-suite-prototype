/**
 * The company's people, plus the access tiers used by the contact-sharing flow.
 *
 * This is prototype seed data: a fixed roster, and the sharing spec's tiers.
 * Share state has no persistence — it lives in component state for the length of
 * a session.
 *
 * The roster started out serving contact-sharing alone. It is now also where a
 * voucher's approver comes from (see `VOUCHER_APPROVER_IDS`), because a second
 * roster of internal names would let the same company have two sets of staff.
 */

/** Access levels a contact can be shared at, per the sharing rules table. */
export type AccessTier = "view" | "contributor" | "outreach";

export interface Teammate {
  id: string;
  name: string;
  email: string;
  /** Org role, shown as muted secondary text in pickers. */
  role: string;
  /** Two-letter avatar fallback (shown when there's no photo, or it fails to load). */
  initials: string;
  /** Profile photo URL. Absent for a couple of members so the fallback still shows. */
  avatarUrl?: string;
  /** Employer, shown on the account dropdown's identity card. Only set for the current user. */
  company?: string;
}

/** A teammate granted access to a contact at a specific tier. */
export interface ContactShare {
  member: Teammate;
  tier: AccessTier;
}

/**
 * The signed-in user — always the owner of the records they share. Framed as
 * "(you)" in the access list.
 */
export const CURRENT_USER: Teammate = {
  id: "you",
  name: "Ethan Thompson",
  email: "ethan.thompson@buildout.com",
  role: "Broker",
  company: "Buildout",
  initials: "ET",
  avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
};

/**
 * The signed-in user's first name — how correspondence addresses and signs them.
 * Story emails and drafted sign-offs used to hardcode "John", which is nobody in
 * this app: the call script, the timeline actors, and every activity record are
 * Ethan Thompson.
 */
export const CURRENT_USER_FIRST_NAME = CURRENT_USER.name.split(" ")[0];

/** Roster available to share with (excludes the current user). */
export const TEAMMATES: Teammate[] = [
  { id: "sarah-chen", name: "Sarah Chen", email: "sarah.chen@buildout.com", role: "Broker", initials: "SC", avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg" },
  { id: "marcus-patel", name: "Marcus Patel", email: "marcus.patel@buildout.com", role: "Broker", initials: "MP", avatarUrl: "https://randomuser.me/api/portraits/men/45.jpg" },
  { id: "diana-reyes", name: "Diana Reyes", email: "diana.reyes@buildout.com", role: "Broker", initials: "DR", avatarUrl: "https://randomuser.me/api/portraits/women/65.jpg" },
  { id: "riley-park", name: "Riley Park", email: "riley.park@buildout.com", role: "Assistant", initials: "RP" },
  { id: "maya-brooks", name: "Maya Brooks", email: "maya.brooks@buildout.com", role: "Marketing", initials: "MB", avatarUrl: "https://randomuser.me/api/portraits/women/90.jpg" },
  { id: "omar-haddad", name: "Omar Haddad", email: "omar.haddad@buildout.com", role: "Transaction Coordinator", initials: "OH", avatarUrl: "https://randomuser.me/api/portraits/men/76.jpg" },
  { id: "nina-alvarez", name: "Nina Alvarez", email: "nina.alvarez@buildout.com", role: "Broker", initials: "NA", avatarUrl: "https://randomuser.me/api/portraits/women/12.jpg" },
  { id: "priya-nair", name: "Priya Nair", email: "priya.nair@buildout.com", role: "Analyst", initials: "PN" },
];

/**
 * Everyone who can carry a deal: the protagonist plus the roster's brokers.
 *
 * A deal's internal broker and its creator are drawn from here, not from the
 * whole roster — an Assistant or an Analyst works deals, they don't hold them.
 * The protagonist leads the list so a hash over it lands on him as often as on
 * anyone else, which is what puts "you" on a share of the seeded deals.
 */
export const BROKER_TEAMMATES: Teammate[] = [
  CURRENT_USER,
  ...TEAMMATES.filter((t) => t.role === "Broker"),
];

/**
 * Who can sign off a commission voucher, as `TEAMMATES` ids.
 *
 * The back-office roles only — a voucher is the brokerage paying itself, so the
 * broker who closed the deal is the one person who should not be approving it.
 * That leaves the Transaction Coordinator, the Analyst, and the Assistant.
 */
export const VOUCHER_APPROVER_IDS = [
  "omar-haddad",
  "priya-nair",
  "riley-park",
] as const;

/** A roster member's id by full name — the current user included. Names are unique on this roster. */
export function teammateIdByName(name: string): string | undefined {
  if (name === CURRENT_USER.name || name === "You") return CURRENT_USER.id;
  return TEAMMATES.find((t) => t.name === name)?.id;
}

/** A roster member by id — the current user included. Undefined if the id is unknown. */
export function findTeammate(id: string): Teammate | undefined {
  return id === CURRENT_USER.id
    ? CURRENT_USER
    : TEAMMATES.find((t) => t.id === id);
}

export interface AccessTierMeta {
  value: AccessTier;
  label: string;
  /** One-line summary shown beside the radio option. */
  description: string;
  /** Compact capability summary, keyed to the sharing rules table. */
  capabilities: {
    read: boolean;
    logActivity: boolean;
    sendEmail: boolean;
    editFields: boolean;
    reshare: boolean;
  };
}

/**
 * The three sharing tiers, in ascending exposure. Descriptions and capabilities
 * mirror the sharing rules table (View → Contributor → Outreach). No tier can
 * reshare — only the owner can.
 */
export const ACCESS_TIERS: AccessTierMeta[] = [
  {
    value: "view",
    label: "View",
    description: "Read-only. Sees the full record but can't log activity or edit fields.",
    capabilities: { read: true, logActivity: false, sendEmail: false, editFields: false, reshare: false },
  },
  {
    value: "contributor",
    label: "Contributor",
    description: "Can read, log activity, and edit fields — but can't send emails.",
    capabilities: { read: true, logActivity: true, sendEmail: false, editFields: true, reshare: false },
  },
  {
    value: "outreach",
    label: "Outreach",
    description: "Can read, edit fields, and log activity including calls and email.",
    capabilities: { read: true, logActivity: true, sendEmail: true, editFields: true, reshare: false },
  },
];

/** Human label for a tier value. */
export function accessTierLabel(tier: AccessTier): string {
  return ACCESS_TIERS.find((t) => t.value === tier)?.label ?? tier;
}

/**
 * Access a contact has before it's shared explicitly: none — owner-only. Most
 * contacts start private; the seed grants a realistic subset to teammates (see
 * `seedContactShares`). Reused by reference (a single, never-mutated module-level
 * constant) so the store selector stays referentially stable for unshared
 * contacts and avoids spurious re-renders.
 */
export const DEFAULT_CONTACT_SHARES: ContactShare[] = [];
