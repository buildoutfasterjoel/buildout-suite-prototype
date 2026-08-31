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
  faSign,
  faPaperclip,
  faListCheck,
  faChartLine,
  faSatelliteDish,
  faHandshake,
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
      // A space's own form. It occupies the Listing slot rather than sitting
      // beside it: a parent deal's own marketing form is Listing, a space's is
      // Details, and `visibleNavGroups` shows exactly one of the two.
      //
      // Shares `faSign` with Listing on purpose, for the same reason Vouchers and
      // Voucher share theirs below: a swap pair is never rendered together, so one
      // icon for one slot is right. (No collision risk with `Plans` either: Plans
      // is building-owned now, so it never renders for a space alongside Details.)
      { label: "Details", href: "details", icon: faSign },
      // The listing's own field data — the form that used to be the Listing tab
      // of `/edit`. It is the content every other Marketing section (Website,
      // Documents, syndication) reads from.
      { label: "Listing", href: "listing", icon: faSign },
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
 * The sidebar of a classic deal — the same deal, laid out the way Buildout
 * Classic laid it out (see `Listing.isClassic`).
 *
 * Three departures from the legacy nav, all deliberate:
 *
 * - Legacy's first group is PROJECT. We call the record a deal everywhere else,
 *   so the group is **Deal**. Renaming the group, not the record, is the whole
 *   point: classic changes the shape of the page, never the vocabulary.
 * - Legacy's third group is DEAL and holds a Deals index. That name collides
 *   with the record itself, so the group takes our **Financials** name (what
 *   the modern sidebar calls Back Office) and keeps the Deals page inside it.
 * - **Attachments** is our Files section under legacy's name.
 *
 * Two items point at a page that is not theirs alone yet, on purpose — the
 * sections are meant to stay as they are for now:
 *
 * - **Tasks** opens the Overview, where a deal's tasks live in `TodayPlanner`.
 *   It has no page of its own.
 * - **Web Activity** opens `web-activity`, which is the Website section's own
 *   Analytics tab. Website itself opens on Settings for a classic deal, so the
 *   two items land on different halves of the same page rather than the same one.
 *
 * Nothing here filters by deal shape. A classic deal is a plain top-level deal;
 * the shell / space rules in `visibleNavGroups` do not apply, and a classic
 * space is not a combination the app makes yet.
 */
export const CLASSIC_NAV_GROUPS: NavGroup[] = [
  {
    label: "Deal",
    items: [
      { label: "Leads", href: "leads", icon: faAddressBook },
      { label: "Client Report", href: "client-report", icon: faFileChartColumn },
      { label: "Attachments", href: "files", icon: faPaperclip },
      { label: "Tasks", href: "overview", icon: faListCheck },
      { label: "Activities", href: "activities", icon: faBolt },
    ],
  },
  {
    label: "Listing",
    items: [
      { label: "Documents", href: "documents", icon: faFileLines },
      { label: "Web Activity", href: "web-activity", icon: faChartLine },
      { label: "Website", href: "website", icon: faGlobe },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Syndication", href: "syndication", icon: faSatelliteDish },
      { label: "Grids", href: "grids", icon: faTableCells },
      { label: "Plans", href: "plans", icon: faRulerCombined },
      { label: "Media", href: "media", icon: faImage },
      { label: "Demographics", href: "demographics", icon: faMapLocationDot },
    ],
  },
  {
    label: "Financials",
    items: [{ label: "Deals", href: "deals", icon: faHandshake }],
  },
];

/** Where a classic deal opens, since its sidebar has no Overview. */
export const CLASSIC_LANDING_HREF = "leads";

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
  /**
   * True on a classic deal, whose sections carry different names — Files is
   * Attachments, Activity is Activities, and Overview is Tasks. Read from the
   * classic set rather than NAV_GROUPS, or the crumb names a section the sidebar
   * beside it does not show.
   */
  isClassic = false,
): {
  sectionLabel: string | null;
  detailId: string | null;
  subsectionLabel: string | null;
} {
  const none = { sectionLabel: null, detailId: null, subsectionLabel: null };
  const prefix = `/listings/${listingId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return none;

  const [section, detail, subsection] = pathname
    .slice(prefix.length)
    .replace(/^\//, "")
    .split("/");
  if (!section) return none;

  const items = (isClassic ? CLASSIC_NAV_GROUPS : NAV_GROUPS).flatMap(
    (g) => g.items,
  );
  const item = items.find((i) => i.href === section);
  if (!item) return none;

  // `||`, not `??`: a trailing slash splits to an empty string, which is no more
  // a detail id or a subsection than a missing segment is.
  return {
    sectionLabel: item.label,
    detailId: detail || null,
    // The third segment is a section of the *drilled-into record* — a space's own
    // nav — so it is looked up in the same NAV_GROUPS rather than a second list.
    // An unknown slug yields null rather than inventing a label from it.
    subsectionLabel: items.find((i) => i.href === (subsection || null))?.label ?? null,
  };
}

/**
 * Every section a building owns outright — never shown on a space, regardless of
 * which nav group the section lives in.
 *
 * This spans two of NAV_GROUPS' groups, for two different reasons:
 *
 * - Six are Marketing sections (Documents, Website, Email, Demographics, Grids,
 *   Plans). A leased space is marketed as part of its building, so these are
 *   edited on the building and nowhere else. Showing them on a space was not
 *   merely redundant: a space holds a *clone* of its parent's `marketing` (see
 *   `addSpaceToDeal`), so a suite's copy of these sections presented the
 *   building's cloned data as though it were the suite's own, with nothing
 *   indicating which copy a public surface reads.
 * - Two are Deal-group sections that are building-owned for reasons that have
 *   nothing to do with marketing:
 *   - Client Report reports on the *building's* listing performance — leads,
 *     views, syndication reach — not a single suite's, so a space has no report
 *     of its own to show.
 *   - Underwriting's payoff is a document, and `documents` is a top-level
 *     `Listing` field rather than part of `DealMarketing`; `addSpaceToDeal` sets
 *     a space's `documents` to `[]`. Underwriting is gated further still — see
 *     the dedicated branch below — but its presence in this list is the same
 *     "documents are building-only" rule the other six sections follow.
 *
 * A space's sidebar points at the building instead for the marketing six — see
 * `buildingLink` in `PropertyDetailSidebar`.
 *
 * Consolidated into one list on purpose: this used to be expressed as three
 * separate rules (this constant, a standalone `underwriting` check, and no rule
 * at all for `client-report`), and three copies of "not on a space" is exactly
 * how a reviewer misses the case that isn't covered.
 *
 * Typed `readonly string[]` rather than a `const` tuple so `.includes(item.href)`
 * accepts an arbitrary href without a cast.
 */
export const BUILDING_OWNED_HREFS: readonly string[] = [
  "documents",
  "website",
  "email",
  "demographics",
  "grids",
  "plans",
  "underwriting",
  "client-report",
];

/**
 * The sections this deal actually shows, by shape. Lives beside NAV_GROUPS so a
 * rule and the item it governs cannot drift apart, and so the rules are testable
 * without rendering a sidebar.
 *
 * Groups that filter down to nothing are dropped, so no empty category renders.
 */
export function visibleNavGroups(
  shape: DealShape,
  opts: {
    leaseParent: boolean;
    showsUnderwriting: boolean;
    /**
     * A classic deal swaps the whole set rather than filtering it — see
     * CLASSIC_NAV_GROUPS. None of the shape rules below apply, so this returns
     * before them rather than threading `isClassic` through each one.
     */
    isClassic?: boolean;
  },
): NavGroup[] {
  if (opts.isClassic) return CLASSIC_NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // A space's own marketing form is Details; every other shape's is Listing.
      // Exactly one of the two is ever shown — the same swap the Vouchers /
      // Voucher pair below uses.
      if (item.href === "details") return shape === "space";
      if (item.href === "listing") return shape !== "space";
      // These sections are the building's alone — see BUILDING_OWNED_HREFS for
      // why each one qualifies.
      if (shape === "space" && BUILDING_OWNED_HREFS.includes(item.href)) return false;
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
      // Underwriting is building-owned (see BUILDING_OWNED_HREFS above, which
      // already excludes it for a space) but it carries a second, independent
      // gate on top: even on a shape that's allowed to have it, it only shows
      // once the property qualifies. The `shape === "space"` exclusion is
      // covered by the BUILDING_OWNED_HREFS branch above; this branch only adds
      // the qualification gate for every other shape.
      if (item.href === "underwriting") return opts.showsUnderwriting;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
