/**
 * Deal sharing: the vocabulary, and the record of who has been shared in.
 *
 * A deal is two halves that different people are trusted with. Marketing is the
 * listing, the website, the documents — the public face. Back office is the
 * voucher, the invoices and the underwriting — the money. Sharing a deal says
 * which half opens and what the person may do there.
 *
 * Deliberately *not* the three contact tiers (View / Contributor / Outreach).
 * Those name abilities, and `permissions.ts` already owns abilities: a role says
 * what a person may do, a share says which records they may do it on. Two
 * systems answering that question would eventually disagree. So a deal share
 * grants reach — a scope and a level — and the role decides what the level
 * amounts to. See `dealAccessFor` in `components/deals/dealAccess.ts`.
 *
 * React-free so it stays usable from `seed.ts` and testable under Vitest's node
 * environment.
 */
import type { Teammate } from "./teammates";

/** Which half of the deal a share opens. */
export type ShareScope = "marketing" | "back-office";

/** What the person may do inside the scope they were given. */
export type ShareLevel = "view" | "contribute";

export interface DealShare {
  member: Teammate;
  scope: ShareScope;
  level: ShareLevel;
}

export interface ShareScopeMeta {
  value: ShareScope;
  label: string;
  /** One-line summary shown beside the radio option. */
  description: string;
  /**
   * Permissions that qualify a role to `contribute` in this scope — any one of
   * them is enough. A role holding none is capped at `view`, and the modal shows
   * the option disabled rather than granting something the role takes back.
   *
   * Note what is deliberately absent from the back office list:
   * `edit-other-vouchers`. That is a blanket permission — "every voucher on the
   * book" — and `permissions.ts` marks the blanket group as the thing
   * record-level sharing replaces. Gating a *share* on it would mean you can
   * only be shared a deal if you could already see all of them.
   */
  contributePermissions: string[];
}

/**
 * The two scopes, in ascending exposure.
 *
 * The asymmetry between them is the whole feature and is enforced in
 * `dealAccessFor`, not here: back office carries marketing at `view` (the money
 * makes no sense without knowing what is being sold), while marketing hides the
 * back office outright.
 */
export const SHARE_SCOPES: ShareScopeMeta[] = [
  {
    value: "marketing",
    label: "Marketing",
    description:
      "The listing, website, documents and media. The back office — voucher, invoices, commissions — stays hidden.",
    contributePermissions: [
      "edit-listings",
      "edit-listing-website",
      "add-custom-content",
    ],
  },
  {
    value: "back-office",
    label: "Back office",
    description:
      "The voucher, invoices and underwriting, plus read-only marketing so they can see what is being sold.",
    contributePermissions: ["change-deal-statuses"],
  },
];

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

export function shareScopeLabel(scope: ShareScope): string {
  return SHARE_SCOPES.find((s) => s.value === scope)?.label ?? scope;
}

export function shareLevelLabel(level: ShareLevel): string {
  return SHARE_LEVELS.find((l) => l.value === level)?.label ?? level;
}

/** The trailing label on a shared row, e.g. "Marketing · View only". */
export function shareSummary(share: DealShare): string {
  return `${shareScopeLabel(share.scope)} · ${shareLevelLabel(share.level)}`;
}

/**
 * A deal nobody has been shared into. Reused by reference so the store selector
 * stays referentially stable and unshared deals don't re-render forever.
 */
export const DEFAULT_DEAL_SHARES: DealShare[] = [];

/**
 * Where the share modal opens for a given role — the sharer confirms rather than
 * decides. Chosen per role rather than derived from permissions, because a
 * permission answers "could they?" and this asks "what is this person for?": a
 * Transaction Coordinator who happens to hold `edit-listings` is still here for
 * the close, not for the flyer.
 *
 * Roles absent from the map fall back to `marketing`, the lower exposure of the
 * two — the safe direction to be wrong in.
 */
export const DEFAULT_SCOPE_BY_ROLE: Record<string, ShareScope> = {
  "transaction-coordinator": "back-office",
  "back-office-manager": "back-office",
};

export function defaultScopeForRoles(roleIds: readonly string[]): ShareScope {
  for (const id of roleIds) {
    const scope = DEFAULT_SCOPE_BY_ROLE[id];
    if (scope) return scope;
  }
  return "marketing";
}
