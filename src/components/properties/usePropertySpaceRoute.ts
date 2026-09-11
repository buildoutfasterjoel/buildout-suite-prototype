import { useDataStore } from "#/data/dataStore";
import { resolvePropertySpaceRoute, type PropertySpaceRouteRecord } from "#/data/propertySpaceRoute";

/**
 * `resolvePropertySpaceRoute`, subscribed to the store. Whole maps, not
 * `.get()`: the row joins a unit to a child deal, and a stage change on the deal
 * leaves the property object referentially equal.
 */
export function usePropertySpaceRoute(propertyId: string, unitId: string): PropertySpaceRouteRecord | null {
  void useDataStore((s) => s.properties);
  void useDataStore((s) => s.listings);
  // The rail lists the space's contacts, and adding one must repaint it.
  void useDataStore((s) => s.contacts);
  return resolvePropertySpaceRoute(propertyId, unitId);
}
