import { describe, expect, it } from "vitest";
import {
  NAV_SECTIONS,
  isPathActive,
  isSectionActive,
  type NavSection,
} from "./navSections";

const LEAF: NavSection = {
  label: "Reports",
  href: "/reports",
  icon: {} as NavSection["icon"],
};

const GROUP: NavSection = {
  label: "Deals",
  icon: {} as NavSection["icon"],
  items: [
    { label: "All Deals", href: "/listings" },
    { label: "Email Campaigns", href: "/email" },
  ],
};

describe("isPathActive", () => {
  it("matches the path exactly", () => {
    expect(isPathActive("/reports", "/reports")).toBe(true);
  });

  it("matches a descendant path", () => {
    expect(isPathActive("/reports", "/reports/pipeline")).toBe(true);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    // "/reports_" and "/reportsomething" both start with "/reports" as a
    // string; only a `/` boundary counts as being inside the section.
    expect(isPathActive("/reports", "/reports_/pipeline")).toBe(false);
    expect(isPathActive("/email", "/emails")).toBe(false);
  });

  it("treats a placeholder href as never active", () => {
    expect(isPathActive("#", "#")).toBe(false);
    expect(isPathActive("", "/")).toBe(false);
  });
});

describe("isSectionActive", () => {
  it("lights a leaf on its own path", () => {
    expect(isSectionActive(LEAF, "/reports/pipeline")).toBe(true);
    expect(isSectionActive(LEAF, "/listings")).toBe(false);
  });

  it("lights a group on any of its children's paths", () => {
    // The whole point of the group: Deals stays lit on both destinations.
    expect(isSectionActive(GROUP, "/listings")).toBe(true);
    expect(isSectionActive(GROUP, "/email")).toBe(true);
    expect(isSectionActive(GROUP, "/email/camp-1")).toBe(true);
  });

  it("leaves a group dark when no child matches", () => {
    expect(isSectionActive(GROUP, "/properties")).toBe(false);
    // The group's own label is not a route — nothing navigates to "/deals".
    expect(isSectionActive(GROUP, "/deals")).toBe(false);
  });
});

describe("NAV_SECTIONS", () => {
  it("puts the email campaign page in the Deals dropdown", () => {
    const deals = NAV_SECTIONS.find((s) => s.label === "Deals");
    expect(deals && "items" in deals && deals.items.map((i) => i.href)).toEqual([
      "/listings",
      "/email",
    ]);
  });

  it("puts Vouchers and Receivables in the Back Office dropdown", () => {
    const backOffice = NAV_SECTIONS.find((s) => s.label === "Back Office");
    expect(
      backOffice && "items" in backOffice && backOffice.items.map((i) => i.href),
    ).toEqual(["/backoffice/vouchers", "/backoffice/receivables"]);
  });

  it("keeps Contacts from lighting Back Office", () => {
    // Both live under /backoffice, but Contacts is its own leaf — a group is
    // lit from its children's hrefs, and /backoffice/contacts is not one.
    const backOffice = NAV_SECTIONS.find((s) => s.label === "Back Office")!;
    expect(isSectionActive(backOffice, "/backoffice/contacts")).toBe(false);
    expect(isSectionActive(backOffice, "/backoffice/vouchers")).toBe(true);
  });

  it("gives every section a destination — a leaf href or at least one child", () => {
    for (const section of NAV_SECTIONS) {
      if ("items" in section) {
        expect(section.items.length).toBeGreaterThan(0);
      } else {
        expect(section.href).toBeTruthy();
      }
    }
  });
});
