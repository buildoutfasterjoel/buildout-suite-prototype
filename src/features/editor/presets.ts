import type { DealUnderwriting, Property } from "#/data/types";
import type {
  Block,
  Cell,
  ColumnsBlock,
  ContentBlock,
  DynamicKey,
  HeadingBlock,
  ImageBlock,
  Page,
  SectionBlock,
  TableBlock,
  TextBlock,
  TextStyle,
} from "./types";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { pricePerSf } from "./dynamic";
import { buildUnderwritingSection } from "./underwritingPages";
import {
  DEFAULT_CELL_STYLE,
  DEFAULT_TEXT_STYLE,
  SERIF,
  uid,
} from "./blocks/blockFactory";
import { BRAND } from "./brand";

/** Brand header logo shown at the top of document pages (served from /public). */
export const LOGO_SRC = BRAND.logoSrc;

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
    src: getPhotoUrl(seed, w, h),
    alt: "Property photo",
  };
}

/** A heading block in the brand heading font + ink. */
export function brandHeading(text: string, size = 28): HeadingBlock {
  return {
    id: uid("block"),
    type: "heading",
    text,
    style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.heading, fontSize: size, color: BRAND.palette.ink },
  };
}

/** A body-copy text block in the brand body font. */
export function brandBody(text: string, size = 13): TextBlock {
  return {
    id: uid("block"),
    type: "text",
    text,
    style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.body, fontSize: size, lineHeight: 22, color: BRAND.palette.ink },
  };
}

/** The data-bound "Financial Summary" table, shared by the Financial Summary and Financial Hero templates. */
function buildFinancialSummaryTable(property?: Property): TableBlock {
  return {
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
}

/**
 * "Financial Summary" preset — a locked page showcasing the three fixed content
 * types (image, text, and a data-bound table) whose values remain editable.
 */
function buildFinancialSummaryPage(property: Property | undefined): Page {
  return {
    id: uid("page"),
    name: "Financial Summary",
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      { id: uid("block"), type: "heading", text: "Financial Summary", style: headingStyle },
      { id: uid("block"), type: "text", text: addressOf(property), style: addressStyle },
      heroImage("editor-financial"),
      buildFinancialSummaryTable(property),
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

/** Cover — full-width hero, logo, large serif title, address, deal-stat strip. */
function buildCoverPage(property?: Property): Page {
  const statCell = (key: DynamicKey, format?: Cell["format"]): Cell => ({
    ...valueCell("—", key, format),
    style: { ...DEFAULT_CELL_STYLE, fontFamily: BRAND.fonts.heading, fontSize: 18, color: BRAND.palette.primary, align: "center" },
    align: "center",
  });
  const statStrip: TableBlock = {
    id: uid("block"),
    type: "table",
    style: { borderWidth: 0, borderStyle: "none", borderColor: null },
    rows: [
      [headerCell("Asking Price"), headerCell("Building Size"), headerCell("Cap Rate")],
      [statCell("askingPrice", "currency"), statCell("buildingSqFt", "text"), statCell("capRate", "percent")],
    ],
  };
  return {
    id: uid("page"),
    name: "Cover Page",
    logoSrc: BRAND.logoSrc,
    locked: true,
    blocks: [
      { id: uid("block"), type: "image", src: getPhotoUrl(property?.id ?? "cover", 736, 340), alt: "Property photo" },
      brandHeading(property?.name ?? "Offering Memorandum", 40),
      brandBody(addressOf(property)),
      statStrip,
    ],
  };
}

/** Financial Hero — three metric callouts above the financial summary table. */
function buildFinancialHeroPage(property?: Property): Page {
  // Each metric is a soft-background label + dynamic value, not a `SectionBlock`:
  // `ColumnsBlock.columns` is `ContentBlock[][]` and can't nest a `ContainerBlock`
  // like `section` inside a column, so the "card" look comes from
  // `TextStyle.background` on the leaf blocks instead.
  const metric = (label: string, key: DynamicKey, format?: Cell["format"]): ContentBlock[] => [
    {
      id: uid("block"),
      type: "text",
      text: label,
      style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.body, fontSize: 11, color: BRAND.palette.ink, background: BRAND.palette.surface },
    },
    {
      id: uid("block"),
      type: "dynamic",
      dynamicKey: key,
      format,
      style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.heading, fontSize: 22, color: BRAND.palette.primary, background: BRAND.palette.surface },
    },
  ];
  const callouts: ColumnsBlock = {
    id: uid("block"), type: "columns", columnCount: 3,
    columns: [metric("Asking Price", "askingPrice", "currency"), metric("NOI", "noi", "currency"), metric("Cap Rate", "capRate", "percent")],
  };
  return {
    id: uid("page"), name: "Financial Highlights", logoSrc: BRAND.logoSrc, locked: true,
    blocks: [brandHeading("Financial Highlights"), callouts, buildFinancialSummaryTable(property)],
  };
}

/** Location & Map — map image left, submarket/city narrative right. */
function buildLocationMapPage(property?: Property): Page {
  const row: ColumnsBlock = {
    id: uid("block"), type: "columns", columnCount: 2,
    columns: [
      [{ id: uid("block"), type: "image", src: getPhotoUrl((property?.id ?? "loc") + "-map", 380, 300), alt: "Location map" }],
      [brandHeading("Location", 22), brandBody(property?.city ? `Located in ${property.city}, ${property.state}.` : "A well-connected submarket with strong fundamentals."),
       { id: uid("block"), type: "dynamic", dynamicKey: "submarket", style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.body, fontSize: 13 } }],
    ],
  };
  return { id: uid("page"), name: "Location", logoSrc: BRAND.logoSrc, locked: true, blocks: [brandHeading("Location Information"), row] };
}

/** Comparables Grid — three comps, each a photo + label. */
function buildComparablesPage(property?: Property): Page {
  const comp = (i: number): ContentBlock[] => [
    { id: uid("block"), type: "image", src: getPhotoUrl((property?.id ?? "comp") + "-" + i, 240, 160), alt: "Comparable property" },
    brandBody(`Comparable ${i}`, 12),
  ];
  const grid: ColumnsBlock = { id: uid("block"), type: "columns", columnCount: 3, columns: [comp(1), comp(2), comp(3)] };
  return { id: uid("page"), name: "Sale Comparables", logoSrc: BRAND.logoSrc, locked: true, blocks: [brandHeading("Sale Comparables"), grid] };
}

/** Advisor Bios — two-advisor team layout: photo + name + role + blurb. */
function buildAdvisorBiosPage(_property?: Property): Page {
  const advisor = (seed: string, name: string, role: string): ContentBlock[] => [
    { id: uid("block"), type: "image", src: getPhotoUrl(seed, 200, 200), alt: "Advisor" },
    brandHeading(name, 18),
    brandBody(role, 12),
    brandBody("Senior advisor with deep experience across the submarket, representing owners and investors on institutional-quality assets."),
  ];
  const row: ColumnsBlock = { id: uid("block"), type: "columns", columnCount: 2, columns: [advisor("advisor-1", "Jordan Avery", "Managing Director"), advisor("advisor-2", "Sam Ellis", "Vice President")] };
  return { id: uid("page"), name: "Advisor Bios", logoSrc: BRAND.logoSrc, locked: true, blocks: [brandHeading("Meet the Team"), row] };
}

/** Section Divider — a big centered title on a brand-color band. */
function buildBrandDividerPage(name = "Section"): Page {
  const band: SectionBlock = {
    id: uid("block"), type: "section", padding: 48, background: BRAND.palette.primary,
    blocks: [{ id: uid("block"), type: "heading", text: name,
      style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.heading, fontSize: 34, align: "center", color: "#ffffff" } }],
  };
  return { id: uid("page"), name, logoSrc: BRAND.logoSrc, locked: true, blocks: [band] };
}

export type TemplateCategory =
  | "Cover" | "Financials" | "Property" | "Location" | "Comparables" | "Team";

export interface TemplateDef {
  key: string;
  name: string;
  category: TemplateCategory;
  description: string;
  build: (property?: Property) => Page;
}

/** All designer templates, in gallery display order. */
export const TEMPLATES: TemplateDef[] = [
  { key: "cover", name: "Cover Page", category: "Cover", description: "Full-bleed hero, logo, title, and a deal-stat strip.", build: buildCoverPage },
  { key: "financialHero", name: "Financial Highlights", category: "Financials", description: "Headline metric callouts above the financial summary.", build: buildFinancialHeroPage },
  { key: "financialSummary", name: "Financial Summary", category: "Financials", description: "Address header with a data-bound financial summary table.", build: buildFinancialSummaryPage },
  { key: "propertyOverview", name: "Property Overview", category: "Property", description: "Magazine-style two-column overview with a highlights table.", build: buildPropertyOverviewPage },
  { key: "locationMap", name: "Location & Map", category: "Location", description: "Map image with submarket and city narrative.", build: buildLocationMapPage },
  { key: "comparables", name: "Sale Comparables", category: "Comparables", description: "A three-up grid of comparable properties with photos.", build: buildComparablesPage },
  { key: "advisorBios", name: "Advisor Bios", category: "Team", description: "Team layout: advisor photo, name, role, and blurb.", build: buildAdvisorBiosPage },
  { key: "brandDivider", name: "Section Divider", category: "Property", description: "A branded full-band section divider.", build: () => buildBrandDividerPage() },
];

/** Build a template page by key (falls back to the first template). */
export function buildTemplatePage(key: string, property?: Property): Page {
  const def = TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
  return def.build(property);
}

// --- Back-compat shims (existing callers) ---
export type PresetKey = string;
export const PRESETS: { key: string; label: string }[] = TEMPLATES.map((t) => ({ key: t.key, label: t.name }));
export function buildPresetPage(key: string, property?: Property): Page {
  return buildTemplatePage(key, property);
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
 * On-brand blank page — freeform (fully editable/rearrangeable), but seeded so
 * it never starts as an off-brand white void: brand logo header, a brand title,
 * and a faint two-column guide. Everything here is deletable.
 */
export function buildOnBrandBlankPage(): Page {
  const scaffold: ColumnsBlock = {
    id: uid("block"),
    type: "columns",
    columnCount: 2,
    columns: [
      [brandBody("Drag blocks here, or type to start.")],
      [brandBody("Your brand fonts and colors are already applied.")],
    ],
  };
  return {
    id: uid("page"),
    name: "New Page",
    logoSrc: BRAND.logoSrc,
    locked: false,
    blocks: [brandHeading("Untitled Section"), scaffold],
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
 * is a real, selectable page — two reuse the richer hand-built presets above,
 * the rest are lightweight stubs.
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
