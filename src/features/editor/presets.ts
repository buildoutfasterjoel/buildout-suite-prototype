import type { DealUnderwriting, Property } from "#/data/types";
import type { Block, Cell, DynamicKey, Page, TableBlock } from "./types";
import { uid } from "./blocks/blockFactory";
import { buildUnderwritingSection } from "./underwritingPages";
import {
  LOGO_SRC,
  addressOf,
  addressStyle,
  headerCell,
  headingStyle,
  heroImage,
  valueCell,
} from "./templates/helpers";
import { buildFinancialSummaryPage, buildPropertyOverviewPage } from "./templates/designer";

/**
 * Spec for a lightweight locked page in the sample proposal: a heading, address,
 * and hero image, plus (when `dynamicKey` is set) a one-row table binding a live
 * listing field — this is what makes the Pages panel's "has dynamic data" bolt
 * indicator light up for the page.
 */
interface StubPageSpec {
  name: string;
  /** Photo seed, for visual variety across pages. */
  seed: string;
  dynamicKey?: DynamicKey;
  dynamicLabel?: string;
  format?: Cell["format"];
}

function buildStubPage(property: Property | undefined, spec: StubPageSpec): Page {
  const blocks: Block[] = [
    { id: uid("block"), type: "heading", text: spec.name, style: headingStyle },
    { id: uid("block"), type: "text", text: addressOf(property), style: addressStyle },
    heroImage(spec.seed),
  ];

  if (spec.dynamicKey) {
    const table: TableBlock = {
      id: uid("block"),
      type: "table",
      title: spec.name,
      style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
      rows: [[headerCell(spec.dynamicLabel ?? "Detail"), valueCell("—", spec.dynamicKey, spec.format)]],
    };
    blocks.push(table);
  }

  return {
    id: uid("page"),
    name: spec.name,
    logoSrc: LOGO_SRC,
    locked: true,
    blocks,
  };
}

/** A plain section-divider page — just a big centered title, no dynamic content. */
function buildDividerPage(property: Property | undefined, name: string): Page {
  return {
    id: uid("page"),
    name,
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      { id: uid("block"), type: "heading", text: name, style: headingStyle },
      { id: uid("block"), type: "text", text: addressOf(property), style: addressStyle },
    ],
  };
}

/** Rename a built page (and its heading block, which always leads) in place. */
function withPageIdentity(page: Page, name: string): Page {
  const blocks = page.blocks.map((b, i) => (i === 0 && b.type === "heading" ? { ...b, text: name } : b));
  return { ...page, name, blocks };
}

/**
 * The sample "Proposal" document's full page list — a 25-page CRE offering
 * memorandum, matching the structure real proposal documents follow: a cover,
 * a table of contents, then content pages broken up by plain section-divider
 * pages (Property Information, Location Information, Financial Analysis, Sale
 * Comparables, Lease Comparables, Demographics, Advisor Bios). Every entry here
 * is a real, selectable page — two reuse the richer hand-built designer
 * templates, the rest are lightweight stubs.
 */
export function buildDocumentPages(
  property?: Property,
  underwriting?: DealUnderwriting,
): Page[] {
  const propertySummary = withPageIdentity(buildPropertyOverviewPage(property), "Property Summary");
  const financialSummary = withPageIdentity(buildFinancialSummaryPage(property), "Financial Summary");

  return [
    buildStubPage(property, { name: "Cover Page", seed: "editor-cover" }),
    buildStubPage(property, { name: "Table of Contents", seed: "editor-toc" }),
    // Once the AI has generated underwriting for this deal, it leads the body —
    // pages scale with the thoroughness the user chose. Empty otherwise.
    ...buildUnderwritingSection(property, underwriting),
    buildDividerPage(property, "Property Information"),
    propertySummary,
    buildStubPage(property, {
      name: "Property Description",
      seed: "editor-prop-desc",
      dynamicKey: "propertyType",
      dynamicLabel: "Property Type",
      format: "text",
    }),
    buildStubPage(property, {
      name: "Complete Highlights",
      seed: "editor-highlights",
      dynamicKey: "buildingSqFt",
      dynamicLabel: "Building Size",
      format: "text",
    }),
    buildStubPage(property, {
      name: "Additional Photos",
      seed: "editor-photos",
      dynamicKey: "numberOfBuildings",
      dynamicLabel: "Buildings",
      format: "text",
    }),
    buildDividerPage(property, "Location Information"),
    buildStubPage(property, {
      name: "Regional Map",
      seed: "editor-regional",
      dynamicKey: "submarket",
      dynamicLabel: "Submarket",
      format: "text",
    }),
    buildStubPage(property, {
      name: "Location Map",
      seed: "editor-location-map",
      dynamicKey: "city",
      dynamicLabel: "City",
      format: "text",
    }),
    buildStubPage(property, {
      name: "Aerial Map",
      seed: "editor-aerial",
      dynamicKey: "lotSqFt",
      dynamicLabel: "Lot Size",
      format: "text",
    }),
    buildStubPage(property, {
      name: "Site Plans",
      seed: "editor-site-plans",
      dynamicKey: "zoning",
      dynamicLabel: "Zoning",
      format: "text",
    }),
    buildDividerPage(property, "Financial Analysis"),
    financialSummary,
    buildStubPage(property, {
      name: "Income & Expenses",
      seed: "editor-income",
      dynamicKey: "noi",
      dynamicLabel: "Net Operating Income",
      format: "currency",
    }),
    buildDividerPage(property, "Sale Comparables"),
    buildStubPage(property, {
      name: "Sale Comps",
      seed: "editor-sale-comps",
      dynamicKey: "capRate",
      dynamicLabel: "Cap Rate",
      format: "percent",
    }),
    buildStubPage(property, {
      name: "Sale Comps Map & Summary",
      seed: "editor-sale-comps-map",
      dynamicKey: "askingPrice",
      dynamicLabel: "Asking Price",
      format: "currency",
    }),
    buildDividerPage(property, "Lease Comparables"),
    buildStubPage(property, {
      name: "Lease Comps",
      seed: "editor-lease-comps",
      dynamicKey: "vacancyRate",
      dynamicLabel: "Vacancy Rate",
      format: "percent",
    }),
    buildStubPage(property, {
      name: "Lease Comps Map & Summary",
      seed: "editor-lease-comps-map",
      dynamicKey: "grossRentMultiplier",
      dynamicLabel: "Gross Rent Multiplier",
      format: "text",
    }),
    buildDividerPage(property, "Demographics"),
    buildStubPage(property, {
      name: "Demographics Map & Report",
      seed: "editor-demographics",
      dynamicKey: "censusTract",
      dynamicLabel: "Census Tract",
      format: "text",
    }),
    buildDividerPage(property, "Advisor Bios"),
    buildStubPage(property, {
      name: "Advisor Bio 1",
      seed: "editor-advisor",
      dynamicKey: "name",
      dynamicLabel: "Prepared For",
      format: "text",
    }),
  ];
}
