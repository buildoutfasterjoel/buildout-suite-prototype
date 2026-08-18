import type { Property, PropertyType } from "#/data/types";
import type {
  Cell,
  ColumnsBlock,
  ContentBlock,
  DynamicKey,
  Page,
  RowVisibility,
  SectionBlock,
  TableBlock,
  TextBlock,
} from "../types";
import { PAGE_HEIGHT, PAGE_PADDING, PAGE_WIDTH } from "../types";
import { TYPE_LABELS, getPhotoUrl } from "#/components/properties/propertyDisplay";
import { DEFAULT_TEXT_STYLE, uid } from "../blocks/blockFactory";
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

/** Every type that has a building — land is the exception. */
const BUILT_TYPES: PropertyType[] = [
  "office", "retail", "industrial", "multifamily", "mixed-use", "hospitality", "special-purpose",
];

/**
 * Property Summary — a full-bleed hero over the deal's sale copy and a fact
 * table whose rows follow the asset class, so an industrial listing and a
 * multifamily one produce visibly different pages from one template.
 */
export function buildPropertySummaryPage(property?: Property): Page {
  const rows: Cell[][] = [];
  const rowRules: Record<string, RowVisibility> = {};

  const metaRow = (
    label: string,
    key: DynamicKey,
    format: Cell["format"] = "text",
    rule?: RowVisibility,
  ) => {
    const head = headerCell(label);
    rows.push([head, valueCell("—", key, format)]);
    if (rule) rowRules[head.id] = rule;
  };

  const built: RowVisibility = { types: BUILT_TYPES };

  metaRow("Building Size", "buildingSqFt", "text", built);
  metaRow("Lot Size", "lotSqFt");
  metaRow("Year Built", "yearBuilt", "year", built);
  metaRow("Building Class", "buildingClass", "text", built);
  metaRow("Stories", "stories", "text", built);
  metaRow("Buildings", "numberOfBuildings", "text", built);

  metaRow("Units", "residentialUnits", "text", { types: ["multifamily", "mixed-use"] });
  metaRow("Total Bathrooms", "totalBathrooms", "text", { types: ["multifamily", "mixed-use"] });

  metaRow("Clear Height", "ceilingHeight", "text", { types: ["industrial"] });
  metaRow("Dock-High Doors", "dockHighDoors", "text", { types: ["industrial"] });
  metaRow("Grade-Level Doors", "gradeLevelDoors", "text", { types: ["industrial"] });
  metaRow("Drive-In Bays", "driveInBays", "text", { types: ["industrial"] });
  metaRow("Warehouse %", "warehousePct", "percent", { types: ["industrial"] });
  metaRow("Cranes", "numberOfCranes", "text", { types: ["industrial"] });

  metaRow("Office SF", "officeSpaceSqFt", "text", { types: ["office"] });
  metaRow("Elevators", "numberOfElevators", "text", { types: ["office"] });
  metaRow("Load Factor", "loadFactor", "text", { types: ["office"] });
  metaRow("Tenancy", "tenancy", "text", { types: ["office"] });

  metaRow("Traffic Count", "trafficCount", "text", { types: ["retail"] });
  metaRow("Clientele", "retailClientele", "text", { types: ["retail"] });
  metaRow("Free Standing", "freeStanding", "boolean", { types: ["retail"] });

  metaRow("Number of Lots", "numberOfLots", "text", { types: ["land"] });
  metaRow("Best Use", "bestUse", "text", { types: ["land"] });
  metaRow("Topography", "topography", "text", { types: ["land"] });
  metaRow("Soil Type", "soilType", "text", { types: ["land"] });

  metaRow("Zoning", "zoning");
  metaRow("Parking Spaces", "parkingSpaces");

  const facts: TableBlock = {
    id: uid("block"),
    type: "table",
    title: "Building Information",
    style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
    rows,
    rowRules,
  };

  const body: ColumnsBlock = {
    id: uid("block"),
    type: "columns",
    columnCount: 2,
    columns: [
      [
        brandHeading("Property Description", 18),
        {
          id: uid("block"),
          type: "dynamic",
          dynamicKey: "marketing.saleDescription",
          format: "text",
          style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.body, fontSize: 13, lineHeight: 22 },
        },
        {
          id: uid("block"),
          type: "list",
          items: [],
          dynamicKey: "marketing.saleBullets",
          marker: "bullet",
          style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.body, fontSize: 13, lineHeight: 22 },
        },
      ],
      [facts],
    ],
  };

  return {
    id: uid("page"),
    name: "Property Summary",
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      { ...heroImage("editor-property-summary", PAGE_WIDTH + PAGE_PADDING * 2, 340), fullBleed: true },
      { id: uid("block"), type: "heading", text: "Property Summary", style: { ...headingStyle, fontSize: 28 } },
      { id: uid("block"), type: "text", text: addressOf(property), style: addressStyle },
      body,
    ],
  };
}

/* ── Cover ─────────────────────────────────────────────────────────────── */

/**
 * The cover's palette and typography mirror the BOV preview a broker sees
 * before sending (`.bov-cover` in main.scss) — the document they open is the
 * same artifact they approved, not a lookalike.
 */
const COVER_NAVY = "#1d3a5f";
const COVER_GOLD = "#d3b475";
const COVER_RULE = "rgba(255, 255, 255, 0.25)";
/** Band height: 32px padding top and bottom around 139px of stacked line-boxes. */
const COVER_BAND_HEIGHT = 203;

/** One line of band copy — uppercase and letterspaced, sized to its role. */
function coverLine(
  text: string,
  o: { size: number; tracking: number; leading: number; color: string; bold?: boolean },
): TextBlock {
  return {
    id: uid("block"),
    type: "text",
    text,
    style: {
      ...DEFAULT_TEXT_STYLE,
      fontFamily: BRAND.fonts.body,
      fontSize: o.size,
      bold: o.bold ?? false,
      letterSpacing: o.tracking,
      lineHeight: o.leading,
      transform: "uppercase",
      color: o.color,
    },
  };
}

/** `Multifamily Property | 24,000 SF` — the band's closing line. */
function coverMetaLine(property?: Property): string {
  return property
    ? `${TYPE_LABELS[property.propertyType]} Property | ${property.buildingSqFt.toLocaleString()} SF`
    : "Commercial Property | 24,000 SF";
}

/**
 * Cover — a full-bleed hero photo above a navy band carrying the kicker,
 * property name, address, rule, and type/size line. The hero is sized so the
 * band lands flush on the bottom edge of the page; `chrome: "none"` drops the
 * logo header and company footer, and `bleed` drops the margins, so the
 * artwork owns the whole sheet.
 */
export function buildCoverPage(property?: Property): Page {
  const band: SectionBlock = {
    id: uid("block"),
    type: "section",
    padding: 32,
    background: COVER_NAVY,
    blocks: [
      coverLine("Broker Opinion of Value", {
        size: 12, tracking: 4.2, leading: 32, color: COVER_GOLD, bold: true,
      }),
      {
        id: uid("block"),
        type: "heading",
        text: property?.name ?? "Offering Memorandum",
        style: {
          ...DEFAULT_TEXT_STYLE,
          fontFamily: BRAND.fonts.body,
          fontSize: 30,
          bold: true,
          letterSpacing: 1.2,
          lineHeight: 40,
          transform: "uppercase",
          color: "#ffffff",
        },
      },
      coverLine(addressOf(property), {
        size: 13, tracking: 2.3, leading: 30, color: "rgba(255, 255, 255, 0.75)",
      }),
      { id: uid("block"), type: "divider", thickness: 1, color: COVER_RULE, style: "solid" },
      coverLine(coverMetaLine(property), {
        size: 12, tracking: 2.6, leading: 28, color: COVER_GOLD, bold: true,
      }),
    ],
  };

  return {
    id: uid("page"),
    name: "Cover Page",
    locked: true,
    chrome: "none",
    bleed: true,
    // Front matter, not a section: a contents block never lists the cover.
    omitFromContents: true,
    blocks: [
      {
        id: uid("block"),
        type: "image",
        src: getPhotoUrl(property?.id ?? "cover", PAGE_WIDTH, PAGE_HEIGHT - COVER_BAND_HEIGHT),
        alt: property?.name ?? "Property photo",
      },
      band,
    ],
  };
}

/* ── Table of Contents ─────────────────────────────────── */

/** The opening paragraph the broker rewrites — seeded with the deal's name. */
function contentsOpening(property?: Property): string {
  const subject = property?.name ?? "this offering";
  return `${BRAND.name} is pleased to present ${subject}. The pages that follow cover the property and its submarket, the financial picture behind the offering, and the team representing it. Replace this copy with your own introduction.`;
}

/**
 * Table of Contents — the generated section list on the left, an editable
 * opening statement on the right. The contents block derives its entries from
 * the document's pages, so the only thing to write here is the introduction.
 */
export function buildContentsPage(property?: Property): Page {
  const body: ColumnsBlock = {
    id: uid("block"),
    type: "columns",
    columnCount: 2,
    columns: [
      [
        {
          id: uid("block"),
          type: "contents",
          style: {
            ...DEFAULT_TEXT_STYLE,
            fontFamily: BRAND.fonts.body,
            fontSize: 13,
            lineHeight: 20,
            color: BRAND.palette.ink,
          },
        },
      ],
      [brandHeading("Introduction", 20), brandBody(contentsOpening(property))],
    ],
  };

  return {
    id: uid("page"),
    name: "Table of Contents",
    logoSrc: BRAND.logoSrc,
    locked: true,
    blocks: [brandHeading("Table of Contents"), body],
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
