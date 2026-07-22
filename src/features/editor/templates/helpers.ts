import type { Property } from "#/data/types";
import type {
  Cell,
  HeadingBlock,
  ImageBlock,
  TableBlock,
  TextBlock,
  TextStyle,
} from "../types";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { pricePerSf } from "../dynamic";
import {
  DEFAULT_CELL_STYLE,
  DEFAULT_TEXT_STYLE,
  SERIF,
  uid,
} from "../blocks/blockFactory";
import { BRAND } from "../brand";

/** Brand header logo shown at the top of document pages (served from /public). */
export const LOGO_SRC = BRAND.logoSrc;

export function headerCell(value: string): Cell {
  return {
    id: uid("cell"),
    value,
    header: true,
    align: "left",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

export function valueCell(
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

export const headingStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontFamily: SERIF,
  fontSize: 32,
  align: "center",
};

export const addressStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 13,
  align: "center",
  color: "#506079",
};

export function addressOf(property: Property | undefined): string {
  return property
    ? `${property.street}, ${property.city}, ${property.state} ${property.zip}`
    : "123 Market Street, Dallas, TX 75201";
}

export function heroImage(seed: string, w = 736, h = 300): ImageBlock {
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
export function buildFinancialSummaryTable(property?: Property): TableBlock {
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
