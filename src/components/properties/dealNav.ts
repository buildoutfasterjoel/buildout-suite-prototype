import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGaugeHigh,
  faFileChartColumn,
  faBolt,
  faClockRotateLeft,
  faVectorSquare,
  faHardDrive,
  faCalculator,
  faAddressBook,
  faFileLines,
  faGlobe,
  faEnvelope,
  faImage,
  faMapLocationDot,
  faTableCells,
  faRulerCombined,
  faBuildingFlag,
  faFileInvoiceDollar,
  faReceipt,
  faNoteSticky,
} from "@fortawesome/pro-regular-svg-icons";

export type NavItem = { label: string; href: string; icon: IconDefinition };
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * Every section a deal can have, in display order. The single source of truth for
 * a section's name: the sidebar renders these, and the breadcrumb looks its label
 * up here, so a rename cannot leave the two disagreeing.
 *
 * This is the full set — `PropertyDetailSidebar` filters it by deal shape.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Deal",
    items: [
      { label: "Overview", href: "overview", icon: faGaugeHigh },
      { label: "Client Report", href: "client-report", icon: faFileChartColumn },
      { label: "Activity", href: "activities", icon: faBolt },
      { label: "History", href: "history", icon: faClockRotateLeft },
      { label: "Spaces", href: "spaces", icon: faVectorSquare },
      { label: "Files", href: "files", icon: faHardDrive },
      { label: "Underwriting", href: "underwriting", icon: faCalculator },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Leads", href: "leads", icon: faAddressBook },
      { label: "Documents", href: "documents", icon: faFileLines },
      { label: "Website", href: "website", icon: faGlobe },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Media", href: "media", icon: faImage },
      { label: "Demographics", href: "demographics", icon: faMapLocationDot },
      { label: "Grids", href: "grids", icon: faTableCells },
      { label: "Plans", href: "plans", icon: faRulerCombined },
      { label: "Property Marketing", href: "property-marketing", icon: faBuildingFlag },
    ],
  },
  {
    label: "Back Office",
    items: [
      { label: "Voucher", href: "financials", icon: faFileInvoiceDollar },
      { label: "Invoices", href: "financial-documents", icon: faReceipt },
      { label: "Notes", href: "notes", icon: faNoteSticky },
    ],
  },
];

/**
 * Which section — and, on a drill-down, which record — the current URL is on.
 *
 * Returns the section's *label* (from the static NAV_GROUPS) and the detail's
 * *id* (a route param). Resolving that id to a human name needs the store, so
 * the caller does it and this stays pure and testable.
 *
 * The section is the first segment after the listing id, never the last: a
 * drill-down appends its own segment, and matching the last one would report
 * the record as the section.
 */
export function dealBreadcrumbTrail(
  pathname: string,
  listingId: string,
): { sectionLabel: string | null; detailId: string | null } {
  const none = { sectionLabel: null, detailId: null };
  const prefix = `/listings/${listingId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return none;

  const [section, detail] = pathname.slice(prefix.length).replace(/^\//, "").split("/");
  if (!section) return none;

  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === section);
  if (!item) return none;

  return { sectionLabel: item.label, detailId: detail ?? null };
}
