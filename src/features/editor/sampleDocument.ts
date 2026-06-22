import type { Property } from "#/data/types";
import type { Cell, EditorDocument, TableBlock, TextStyle } from "./types";
import { pricePerSf } from "./dynamic";
import {
  DEFAULT_CELL_STYLE,
  DEFAULT_TEXT_STYLE,
  SERIF,
  uid,
} from "./blocks/blockFactory";

/** "Better Homes and Gardens"-style placeholder header logo. */
const LOGO_SRC =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Better_Homes_and_Gardens_Real_Estate_logo.svg/320px-Better_Homes_and_Gardens_Real_Estate_logo.svg.png";

function headerCell(value: string): Cell {
  return {
    id: uid("cell"),
    value,
    header: true,
    align: "left",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

function valueCell(value: string, dynamicKey?: Cell["dynamicKey"], format?: Cell["format"]): Cell {
  return {
    id: uid("cell"),
    value,
    dynamicKey,
    format,
    align: "right",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

/**
 * Build the sample "Financial Summary" document, seeded with the bound
 * listing's real data. Mirrors the Figma reference (node 32:733).
 */
export function buildSampleDocument(property: Property | undefined): EditorDocument {
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

  const address = property
    ? `${property.street}, ${property.city}, ${property.state} ${property.zip}`
    : "123 Market Street, Dallas, TX 75201";

  return {
    id: "doc-proposal",
    name: "Proposal",
    pages: [
      {
        id: "page-1",
        name: "Property Summary",
        logoSrc: LOGO_SRC,
        blocks: [
          { id: uid("block"), type: "heading", text: "Financial Summary", style: headingStyle },
          { id: uid("block"), type: "text", text: address, style: addressStyle },
          financialTable,
        ],
      },
      {
        id: "page-2",
        name: "Property Details",
        logoSrc: LOGO_SRC,
        blocks: [
          {
            id: uid("block"),
            type: "heading",
            text: "Property Overview",
            style: { ...headingStyle, fontSize: 28 },
          },
          {
            id: uid("block"),
            type: "text",
            text:
              property?.name ??
              "A premier commercial opportunity in a high-growth submarket.",
            style: { ...DEFAULT_TEXT_STYLE, fontSize: 13, lineHeight: 22 },
          },
        ],
      },
    ],
  };
}
