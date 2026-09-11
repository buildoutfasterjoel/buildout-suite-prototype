import { faGaugeHigh, faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import type { NavItem } from "./dealNav";

/**
 * The Property record's sections, in display order. The single source of a
 * section's name: `PropertyRecordTabs` renders these and the header's
 * breadcrumb looks its label up here, so a rename cannot leave them disagreeing.
 *
 * Same glyphs as the deal nav's Overview and Spaces on purpose — the concept is
 * the same, the record differs. `propertyNavRoutes.test.ts` pins that every
 * `href` has a route file and every route file is reachable from here.
 */
export const PROPERTY_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "overview", icon: faGaugeHigh },
  { label: "Spaces", href: "spaces", icon: faVectorSquare },
];

/**
 * The current section's label from the path — the segment after the property
 * id — or null on the record's root. Store-free, like `dealBreadcrumbTrail`.
 */
export function propertySectionLabel(pathname: string, propertyId: string): string | null {
  const marker = `/properties/${propertyId}/`;
  const at = pathname.indexOf(marker);
  if (at === -1) return null;
  const slug = pathname.slice(at + marker.length).split("/")[0];
  return PROPERTY_NAV_ITEMS.find((i) => i.href === slug)?.label ?? null;
}
