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
} from "#/data/dealShares";
import type { Listing } from "#/data/types";
import { useViewer } from "#/components/settings/users/useViewer";
import { dealAccessFor, type AccessViewer, type DealAccess } from "./dealAccess";

export interface DealSharesApi {
  shares: DealShare[];
  /** Share the deal's marketing with the given members at a level. */
  grant: (memberIds: string[], level: ShareLevel) => void;
  /** Move an existing share to another level. */
  change: (memberId: string, level: ShareLevel) => void;
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
    (memberIds: string[], level: ShareLevel) =>
      grantDealShares(listingId, memberIds, level),
    [listingId],
  );
  const change = useCallback(
    (memberId: string, level: ShareLevel) =>
      changeDealShare(listingId, memberId, level),
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
