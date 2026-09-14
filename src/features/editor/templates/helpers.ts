import type { Property } from "#/data/types";
import type {
  Cell,
  DynamicKey,
  HeadingBlock,
  ImageBlock,
  TableBlock,
  TextBlock,
  TextStyle,
} from "../types";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { pricePerSf } from "../dynamic";
import { tokenSyntax } from "../inlineTokens";
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

/**
 * A table's value cell. Passing a `key` binds it to live listing data — as an
 * inline token, the same representation a heading uses and the same one the
 * toolbar's "Insert field" produces, so the broker can edit around it, delete
 * it, or swap it for another field. `value` is then only the fallback text for
 * an unbound cell.
 */
export function valueCell(value: string, key?: DynamicKey): Cell {
  return {
    id: uid("cell"),
    value: key ? tokenSyntax(key) : value,
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
      [headerCell("Price"), valueCell("$2,000,000", "askingPrice")],
      [headerCell("Price per SF"), valueCell(pricePerSf(property))],
      [headerCell("Cap Rate"), valueCell("—", "capRate")],
      [headerCell("Net Operating Income"), valueCell("—", "noi")],
      [headerCell("Building Size"), valueCell("—", "buildingSqFt")],
    ],
  };
}
