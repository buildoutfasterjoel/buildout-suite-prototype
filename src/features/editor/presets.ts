import type { Property } from "#/data/types";
import type { ColumnsBlock, Cell, ImageBlock, Page, TableBlock, TextStyle } from "./types";
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
