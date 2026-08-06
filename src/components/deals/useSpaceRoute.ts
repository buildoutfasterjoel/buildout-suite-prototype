import { useDataStore } from "#/data/dataStore";
import { resolveSpaceRoute, type SpaceRouteRecord } from "#/data/spaceRoute";

/**
 * `resolveSpaceRoute`, subscribed to the store.
 *
 * Subscribes to the whole `listings` map rather than `.get(spaceId)`: the guard
 * reads the *parent*, and a space's shape is derived from its siblings, so a
 * `.get()` selector would compare referentially equal and skip re-rendering
 * after a change that matters.
 */
export function useSpaceRoute(shellId: string, spaceId: string): SpaceRouteRecord | null {
  const listings = useDataStore((s) => s.listings);
  const properties = useDataStore((s) => s.properties);
  void listings;
  void properties;
  return resolveSpaceRoute(shellId, spaceId);
}
