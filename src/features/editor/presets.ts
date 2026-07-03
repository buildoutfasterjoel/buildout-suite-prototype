import type { Property } from "#/data/types";
import type {
  Block,
  ColumnsBlock,
  Cell,
  DynamicKey,
  ImageBlock,
  Page,
  TableBlock,
  TextStyle,
} from "./types";
import { pricePerSf } from "./dynamic";
import {
  DEFAULT_CELL_STYLE,
  DEFAULT_TEXT_STYLE,
  SERIF,
  uid,
} from "./blocks/blockFactory";

/** "Better Homes and Gardens"-style placeholder header logo. */
export const LOGO_SRC =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Better_Homes_and_Gardens_Real_Estate_logo.svg/320px-Better_Homes_and_Gardens_Real_Estate_logo.svg.png";

/** Preset (template) pages the user can add. Layout is fixed; content is editable. */
export type PresetKey = "financialSummary" | "propertyOverview";

/** Menu of addable presets, in display order. */
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "financialSummary", label: "Financial Summary" },
  { key: "propertyOverview", label: "Property Overview" },
];

function headerCell(value: string): Cell {
  return {
    id: uid("cell"),
    value,
    header: true,
    align: "left",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

function valueCell(
  value: string,
  dynamicKey?: Cell["dynamicKey"],
  format?: Cell["format"],
): Cell {
  return {
    id: uid("cell"),
    value,
    dynamicKey,
    format,
    align: "right",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

const headingStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontFamily: SERIF,
  fontSize: 32,
  align: "center",
};

const addressStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 13,
  align: "center",
  color: "#506079",
};

function addressOf(property: Property | undefined): string {
  return property
    ? `${property.street}, ${property.city}, ${property.state} ${property.zip}`
    : "123 Market Street, Dallas, TX 75201";
}

function heroImage(seed: string, w = 736, h = 300): ImageBlock {
  return {
    id: uid("block"),
    type: "image",
    src: `https://picsum.photos/seed/${seed}/${w}/${h}`,
    alt: "Property photo",
  };
}

/**
 * "Financial Summary" preset — a locked page showcasing the three fixed content
 * types (image, text, and a data-bound table) whose values remain editable.
 */
function buildFinancialSummaryPage(property: Property | undefined): Page {
  const financialTable: TableBlock = {
    id: uid("block"),
    type: "table",
    title: "Financial Summary",
    style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
    rows: [
      [headerCell("Price"), valueCell("$2,000,000", "askingPrice", "currency")],
      [headerCell("Price per SF"), valueCell(pricePerSf(property))],
      [headerCell("Cap Rate"), valueCell("—", "capRate", "percent")],
      [headerCell("Net Operating Income"), valueCell("—", "noi", "currency")],
      [headerCell("Building Size"), valueCell("—", "buildingSqFt", "text")],
    ],
  };

  return {
    id: uid("page"),
    name: "Financial Summary",
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      { id: uid("block"), type: "heading", text: "Financial Summary", style: headingStyle },
      { id: uid("block"), type: "text", text: addressOf(property), style: addressStyle },
      heroImage("editor-financial"),
      financialTable,
    ],
  };
}

/**
 * "Property Overview" preset — a locked page with a richer, magazine-style
 * layout: a full-width hero, then a two-column row pairing a photo + descriptive
 * copy on the left with a data-bound highlights table on the right. Content is
 * editable; the layout is fixed.
 */
function buildPropertyOverviewPage(property: Property | undefined): Page {
  const bodyStyle: TextStyle = { ...DEFAULT_TEXT_STYLE, fontSize: 13, lineHeight: 22 };

  const highlightsTable: TableBlock = {
    id: uid("block"),
    type: "table",
    title: "Property Highlights",
    style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
    rows: [
      [headerCell("Property Type"), valueCell("—", "propertyType", "text")],
      [headerCell("Building Class"), valueCell("—", "buildingClass", "text")],
      [headerCell("Building Size"), valueCell("—", "buildingSqFt", "text")],
      [headerCell("Lot Size"), valueCell("—", "lotSqFt", "text")],
      [headerCell("Stories"), valueCell("—", "stories", "text")],
    ],
  };

  const detailRow: ColumnsBlock = {
    id: uid("block"),
    type: "columns",
    columnCount: 2,
    columns: [
      [
        heroImage("editor-overview-detail", 640, 440),
        {
          id: uid("block"),
          type: "text",
          text:
            property?.name ??
            "A premier commercial opportunity in a high-growth submarket, offering strong in-place income and significant value-add upside.",
          style: bodyStyle,
        },
      ],
      [highlightsTable],
    ],
  };

  return {
    id: uid("page"),
    name: "Property Overview",
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      {
        id: uid("block"),
        type: "heading",
        text: "Property Overview",
        style: { ...headingStyle, fontSize: 28 },
      },
      heroImage("editor-overview-hero", 736, 380),
      detailRow,
    ],
  };
}

/** Build a locked preset page of the given kind, seeded with the listing. */
export function buildPresetPage(key: PresetKey, property?: Property): Page {
  return key === "financialSummary"
    ? buildFinancialSummaryPage(property)
    : buildPropertyOverviewPage(property);
}

/** An empty, fully freeform page the user builds up from the Blocks palette. */
export function buildBlankPage(): Page {
  return {
    id: uid("page"),
    name: "New Page",
    logoSrc: LOGO_SRC,
    locked: false,
    blocks: [],
  };
}

/**
 * Spec for a lightweight locked page in the sample proposal: a heading, address,
 * and hero image, plus (when `dynamicKey` is set) a one-row table binding a live
 * listing field — this is what makes the Pages panel's "has dynamic data" bolt
 * indicator light up for the page.
 */
interface StubPageSpec {
  name: string;
  /** Picsum seed, for visual variety across pages. */
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
 * is a real, selectable page — two reuse the richer hand-built presets above,
 * the rest are lightweight stubs.
 */
export function buildDocumentPages(property?: Property): Page[] {
  const propertySummary = withPageIdentity(buildPropertyOverviewPage(property), "Property Summary");
  const financialSummary = withPageIdentity(buildFinancialSummaryPage(property), "Financial Summary");

  return [
    buildStubPage(property, { name: "Cover Page", seed: "editor-cover" }),
    buildStubPage(property, { name: "Table of Contents", seed: "editor-toc" }),
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
