import { useCallback } from "react";
import { useDataStore } from "#/data/dataStore";
import {
  changeContactShareTier,
  grantContactShares,
  revokeContactShare,
} from "#/data/store";
import { DEFAULT_CONTACT_SHARES } from "#/data/teammates";
import type { AccessTier, ContactShare } from "#/data/teammates";

export interface ContactSharesApi {
  shares: ContactShare[];
  /** Grant access to the given members at a tier (skips duplicates). */
  grant: (memberIds: string[], tier: AccessTier) => void;
  /** Change an existing member's tier. */
  changeTier: (memberId: string, tier: AccessTier) => void;
  /** Revoke a member's access. */
  revoke: (memberId: string) => void;
}

/**
 * Sharing state for a single contact, backed by the persisted data store so it
 * survives navigation and reloads. Reads reactively (avatar clusters + modal
 * stay in sync); writes go through the store's share actions.
 */
export function useContactShares(contactId: string): ContactSharesApi {
  const shares = useDataStore(
    (s) => s.contactShares.get(contactId) ?? DEFAULT_CONTACT_SHARES,
  );

  const grant = useCallback(
    (memberIds: string[], tier: AccessTier) =>
      grantContactShares(contactId, memberIds, tier),
    [contactId],
  );
  const changeTier = useCallback(
    (memberId: string, tier: AccessTier) =>
      changeContactShareTier(contactId, memberId, tier),
    [contactId],
  );
  const revoke = useCallback(
    (memberId: string) => revokeContactShare(contactId, memberId),
    [contactId],
  );

  return { shares, grant, changeTier, revoke };
}
