/**
 * The global navbar's sections, and the rule for which one is lit.
 *
 * A section is either a **leaf** — clicking it navigates — or a **group**,
 * whose label opens a dropdown and whose children carry the destinations. The
 * two are a union rather than one shape with optional fields, so a section
 * can't be authored with both an `href` and `items`, or with neither.
 *
 * Kept free of React so the active-state rule stays testable in Vitest's node
 * environment; `GlobalNavbar` owns the markup.
 */
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBuilding,
  faUsers,
  faHandshake,
  faSignal,
} from "@fortawesome/pro-regular-svg-icons";

/** A destination inside a group's dropdown. */
export interface NavChild {
  label: string;
  href: string;
}

export interface NavLeaf {
  label: string;
  icon: IconDefinition;
  href: string;
}

export interface NavGroup {
  label: string;
  icon: IconDefinition;
  /** Non-empty: a group with no children would be a dead label. */
  items: NavChild[];
}

export type NavSection = NavLeaf | NavGroup;

/** Narrows a section to the dropdown case. */
export function isNavGroup(section: NavSection): section is NavGroup {
  return "items" in section;
}

// NOW is no longer a nav item — the logo links to /suite. Tasks moved to a
// footer icon button.
export const NAV_SECTIONS: NavSection[] = [
  { label: "Properties", href: "/properties", icon: faBuilding },
  { label: "Contacts", href: "/backoffice/contacts", icon: faUsers },
  {
    label: "Deals",
    icon: faHandshake,
    items: [
      { label: "All Deals", href: "/listings" },
      { label: "Campaigns", href: "/email" },
    ],
  },
  { label: "Reports", href: "/reports", icon: faSignal },
  // Hidden for the demo. To restore, re-add `faDoorOpen` to the icon import:
  // { label: "Back Office", href: "/backoffice", icon: faDoorOpen },
];

/**
 * Is `pathname` inside the section at `href`? A descendant counts, but only
 * across a `/` boundary — `/reports_/pipeline` is a different section from
 * `/reports`, even though one is a string prefix of the other.
 */
export function isPathActive(href: string, pathname: string): boolean {
  if (!href || href === "#") return false;
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * A leaf is lit on its own path; a group is lit on **any** of its children's,
 * so Deals stays lit on both `/listings/...` and `/email/...`. A group's label
 * is not itself a route, so it never matches on its own.
 */
export function isSectionActive(
  section: NavSection,
  pathname: string,
): boolean {
  return isNavGroup(section)
    ? section.items.some((item) => isPathActive(item.href, pathname))
    : isPathActive(section.href, pathname);
}
