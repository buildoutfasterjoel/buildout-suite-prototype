import { useDataStore } from "#/data/dataStore";
import { getPropertyDetailClient } from "#/data/selectors";
import { propertyAvailability, type PropertyAvailability } from "#/data/propertySpaces";
import type { PropertyDetail } from "#/data/types";

/**
 * `getPropertyDetailClient`, subscribed to the store, plus the property's
 * derived availability.
 *
 * The record page used to call the selector once via `getState()`, which is why
 * it never repainted after a mutation. A space is a join of a unit (properties)
 * and its child deal (listings), and the rail reads contacts and comps, so all
 * four maps are subscribed. Whole maps rather than `.get(id)`: a child deal
 * changing stage does not touch the property object, and a `.get()` selector
 * would compare referentially equal and skip the re-render.
 */
export function usePropertyDetail(
  propertyId: string,
): (PropertyDetail & { availability: PropertyAvailability | null }) | null {
  void useDataStore((s) => s.properties);
  void useDataStore((s) => s.listings);
  void useDataStore((s) => s.contacts);
  void useDataStore((s) => s.comps);
  const detail = getPropertyDetailClient(propertyId);
  if (!detail) return null;
  return { ...detail, availability: propertyAvailability(propertyId) };
}
