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
  faFileInvoiceDollar,
  faReceipt,
  faNoteSticky,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealShape } from "#/data/dealShape";

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
    ],
  },
  {
    label: "Back Office",
    items: [
      // A shell's spaces each earn their own commission, so a shell gets this
      // index instead of the single Voucher/Invoices pair below. `visibleNavGroups`
      // picks one or the other by shape; they are never both shown.
      { label: "Vouchers", href: "vouchers", icon: faFileInvoiceDollar },
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

/**
 * The sections this deal actually shows, by shape. Lives beside NAV_GROUPS so a
 * rule and the item it governs cannot drift apart, and so the rules are testable
 * without rendering a sidebar.
 *
 * Groups that filter down to nothing are dropped, so no empty category renders.
 */
export function visibleNavGroups(
  shape: DealShape,
  opts: { leaseParent: boolean; showsUnderwriting: boolean },
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // A shell's spaces each earn their own commission, so it gets the Vouchers
      // index; every other shape keeps the single Voucher + Invoices pair. The
      // two are mutually exclusive — never show both.
      if (item.href === "vouchers") return shape === "shell";
      // Money is earned per space, so a shell has no voucher and no invoices.
      if (
        shape === "shell" &&
        (item.href === "financials" || item.href === "financial-documents")
      ) {
        return false;
      }
      if (item.href === "spaces") return opts.leaseParent;
      if (item.href === "underwriting") return opts.showsUnderwriting;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
