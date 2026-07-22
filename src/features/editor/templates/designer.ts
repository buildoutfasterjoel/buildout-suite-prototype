import type { Property } from "#/data/types";
import type {
  Cell,
  ColumnsBlock,
  ContentBlock,
  DynamicKey,
  Page,
  SectionBlock,
  TableBlock,
  TextStyle,
} from "../types";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { DEFAULT_CELL_STYLE, DEFAULT_TEXT_STYLE, uid } from "../blocks/blockFactory";
import { BRAND } from "../brand";
import {
  LOGO_SRC,
  addressOf,
  addressStyle,
  brandBody,
  brandHeading,
  buildFinancialSummaryTable,
  headerCell,
  headingStyle,
  heroImage,
  valueCell,
} from "./helpers";

/**
 * "Financial Summary" preset — a locked page showcasing the three fixed content
 * types (image, text, and a data-bound table) whose values remain editable.
 */
export function buildFinancialSummaryPage(property: Property | undefined): Page {
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
export function buildPropertyOverviewPage(property: Property | undefined): Page {
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
export function buildCoverPage(property?: Property): Page {
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
export function buildFinancialHeroPage(property?: Property): Page {
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
export function buildLocationMapPage(property?: Property): Page {
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
export function buildComparablesPage(property?: Property): Page {
  const comp = (i: number): ContentBlock[] => [
    { id: uid("block"), type: "image", src: getPhotoUrl((property?.id ?? "comp") + "-" + i, 240, 160), alt: "Comparable property" },
    brandBody(`Comparable ${i}`, 12),
  ];
  const grid: ColumnsBlock = { id: uid("block"), type: "columns", columnCount: 3, columns: [comp(1), comp(2), comp(3)] };
  return { id: uid("page"), name: "Sale Comparables", logoSrc: BRAND.logoSrc, locked: true, blocks: [brandHeading("Sale Comparables"), grid] };
}

/** Advisor Bios — two-advisor team layout: photo + name + role + blurb. */
export function buildAdvisorBiosPage(_property?: Property): Page {
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
export function buildBrandDividerPage(name = "Section"): Page {
  const band: SectionBlock = {
    id: uid("block"), type: "section", padding: 48, background: BRAND.palette.primary,
    blocks: [{ id: uid("block"), type: "heading", text: name,
      style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.heading, fontSize: 34, align: "center", color: "#ffffff" } }],
  };
  return { id: uid("page"), name, logoSrc: BRAND.logoSrc, locked: true, blocks: [band] };
}
