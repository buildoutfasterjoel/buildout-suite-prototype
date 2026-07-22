/**
 * People and access-tier definitions for the contact-sharing flow.
 *
 * This is prototype seed data: a fixed roster of teammates the current user can
 * share a contact with, plus the access tiers from the sharing spec. There is no
 * persistence — share state lives in component state for the length of a session.
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
  name: "John Whitfield",
  email: "john@buildout.com",
  role: "Broker",
  initials: "JW",
  avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
};

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
