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
import {
  canOpenDeal,
  dealAccessFor,
  type AccessViewer,
  type DealAccess,
  type DealFamily,
} from "./dealAccess";

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
 * The lease family around one listing, resolved from the store.
 *
 * A space gets its shell and the shell's shares; a shell gets its spaces. Never
 * both — a listing is one or the other, and `dealAccessFor` reads whichever it
 * was given.
 *
 * The spaces are filtered out of the live `listings` map rather than read
 * through `getChildDeals`, so the hook re-runs when a space is added or a
 * broker changes hands. `getChildDeals` reads the store outside React and would
 * leave this stale.
 */
export function useDealFamily(listing: Listing): DealFamily {
  const shellId = listing.parentDealId;
  const listings = useDataStore((s) => s.listings);
  const shellShares = useDataStore((s) =>
    shellId ? (s.dealShares.get(shellId) ?? DEFAULT_DEAL_SHARES) : DEFAULT_DEAL_SHARES,
  );

  return useMemo(() => {
    if (shellId) {
      const shell = listings.get(shellId);
      return shell ? { shell, shellShares } : {};
    }
    const spaces = [...listings.values()].filter((l) => l.parentDealId === listing.id);
    return spaces.length > 0 ? { spaces } : {};
  }, [shellId, listing.id, listings, shellShares]);
}

/**
 * What the signed-in person may do on this deal. Reactive to both the seat
 * switch and the share list, so granting access in the modal updates the page
 * behind it.
 */
export function useDealAccess(listing: Listing): DealAccess {
  const { shares } = useDealShares(listing.id);
  const viewer = useAccessViewer();
  const family = useDealFamily(listing);
  return useMemo(
    () => dealAccessFor(listing, viewer, shares, family),
    [listing, viewer, shares, family],
  );
}

/**
 * Which of a shell's spaces this viewer may actually open.
 *
 * The Spaces roster needs it per row: a suite the viewer cannot open still
 * shows — a broker should know the rest of the building is in flight — but it
 * stops being a link. Returned as a Set so a roster of twenty rows asks twenty
 * O(1) questions rather than re-resolving access per render.
 */
export function useOpenableSpaces(shellId: string): ReadonlySet<string> {
  const viewer = useAccessViewer();
  const listings = useDataStore((s) => s.listings);
  const shellShares = useDataStore(
    (s) => s.dealShares.get(shellId) ?? DEFAULT_DEAL_SHARES,
  );

  return useMemo(() => {
    const open = new Set<string>();
    const shell = listings.get(shellId);
    if (!shell) return open;
    for (const child of listings.values()) {
      if (child.parentDealId !== shellId) continue;
      // A space carries no shares of its own, so the third argument is empty by
      // construction — the shell's list is what `dealAccessFor` will read.
      const access = dealAccessFor(child, viewer, DEFAULT_DEAL_SHARES, {
        shell,
        shellShares,
      });
      if (canOpenDeal(access)) open.add(child.id);
    }
    return open;
  }, [shellId, listings, shellShares, viewer]);
}
