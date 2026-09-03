import { useCallback, useMemo } from "react";
import { useDataStore } from "#/data/dataStore";
import {
  changeDealShare,
  grantDealShares,
  revokeDealShare,
} from "#/data/store";
import {
  DEFAULT_DEAL_SHARES,
  type DealShare,
  type ShareLevel,
  type ShareScope,
} from "#/data/dealShares";
import type { Listing } from "#/data/types";
import { useViewer } from "#/components/settings/users/useViewer";
import { dealAccessFor, type AccessViewer, type DealAccess } from "./dealAccess";

export interface DealSharesApi {
  shares: DealShare[];
  /** Share the deal with the given members at one scope and level. */
  grant: (memberIds: string[], scope: ShareScope, level: ShareLevel) => void;
  /** Move an existing share to another scope or level. */
  change: (memberId: string, scope: ShareScope, level: ShareLevel) => void;
  revoke: (memberId: string) => void;
}

/**
 * Sharing state for one deal, backed by the persisted data store so it survives
 * navigation and reloads. Mirrors `useContactShares`.
 */
export function useDealShares(listingId: string): DealSharesApi {
  const shares = useDataStore(
    (s) => s.dealShares.get(listingId) ?? DEFAULT_DEAL_SHARES,
  );

  const grant = useCallback(
    (memberIds: string[], scope: ShareScope, level: ShareLevel) =>
      grantDealShares(listingId, memberIds, scope, level),
    [listingId],
  );
  const change = useCallback(
    (memberId: string, scope: ShareScope, level: ShareLevel) =>
      changeDealShare(listingId, memberId, scope, level),
    [listingId],
  );
  const revoke = useCallback(
    (memberId: string) => revokeDealShare(listingId, memberId),
    [listingId],
  );

  return { shares, grant, change, revoke };
}

/**
 * The roster row the resolver needs, narrowed to the fields it reads so a
 * roster edit elsewhere doesn't churn every deal page.
 */
export function useAccessViewer(): AccessViewer | undefined {
  const viewer = useViewer();
  return useMemo(
    () =>
      viewer
        ? {
            id: viewer.id,
            name: viewer.name,
            roleIds: viewer.roleIds,
            overrides: viewer.overrides,
          }
        : undefined,
    [viewer],
  );
}

/**
 * What the signed-in person may do on this deal. Reactive to both the seat
 * switch and the share list, so granting access in the modal updates the page
 * behind it.
 */
export function useDealAccess(listing: Listing): DealAccess {
  const { shares } = useDealShares(listing.id);
  const viewer = useAccessViewer();
  return useMemo(
    () => dealAccessFor(listing, viewer, shares),
    [listing, viewer, shares],
  );
}
