/**
 * Deal sharing: the vocabulary, and the record of who has been shared in.
 *
 * **Sharing a deal shares its marketing.** There is no back-office share and no
 * scope to choose: a broker hands someone the listing, the website, the
 * documents and the media, and the voucher is never part of that gift. Who sees
 * the money is a question about a person's role, not about one deal — the back
 * office sees vouchers across the firm, and gets there through
 * `view-other-vouchers` rather than through anyone's invitation.
 *
 * That leaves a share with one dimension, the level. Deliberately not the three
 * contact tiers (View / Contributor / Outreach): those name abilities, and
 * `permissions.ts` already owns abilities — a role says what a person may do, a
 * share says which records they may do it on. So `contribute` here means "edit
 * what your role already lets you edit", capped by the permissions below rather
 * than granting past them. See `dealAccessFor` in
 * `components/deals/dealAccess.ts`.
 *
 * React-free so it stays usable from `seed.ts` and testable under Vitest's node
 * environment.
 */
import type { Teammate } from "./teammates";

/** What the person may do with the marketing they were given. */
export type ShareLevel = "view" | "contribute";

export interface DealShare {
  member: Teammate;
  level: ShareLevel;
}

/**
 * Permissions that qualify a role to edit marketing — any one is enough. A role
 * holding none is capped at `view`, and the share modal disables "Can edit" with
 * the reason on it rather than granting something the page takes back.
 *
 * Three rather than `edit-listings` alone because marketing is not one surface:
 * a Marketing Assistant builds the listing site and the documents without
 * holding the listing form, and capping them at view would make the role's own
 * job impossible on a deal shared with them.
 */
export const MARKETING_EDIT_PERMISSIONS = [
  "edit-listings",
  "edit-listing-website",
  "add-custom-content",
];

/**
 * Reaching another deal's voucher. Not a share — no share grants it — but the
 * counterpart the resolver reads beside the marketing permissions, kept here so
 * the two halves of a deal name their permissions in one place.
 */
export const BACK_OFFICE_VIEW_PERMISSION = "view-other-vouchers";
export const BACK_OFFICE_EDIT_PERMISSION = "edit-other-vouchers";

/** Reaching another user's listing — what opens a deal's marketing without a share. */
export const MARKETING_VIEW_PERMISSION = "access-other-listings";

export interface ShareLevelMeta {
  value: ShareLevel;
  label: string;
  description: string;
}

export const SHARE_LEVELS: ShareLevelMeta[] = [
  { value: "view", label: "View only", description: "Can read, but change nothing." },
  {
    value: "contribute",
    label: "Can edit",
    description: "Can change what their role already allows them to change.",
  },
];

export function shareLevelLabel(level: ShareLevel): string {
  return SHARE_LEVELS.find((l) => l.value === level)?.label ?? level;
}

/**
 * A deal nobody has been shared into. Reused by reference so the store selector
 * stays referentially stable and unshared deals don't re-render forever.
 */
export const DEFAULT_DEAL_SHARES: DealShare[] = [];
