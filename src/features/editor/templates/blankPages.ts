import type { ColumnsBlock, Page } from "../types";
import { uid } from "../blocks/blockFactory";
import { BRAND } from "../brand";
import { LOGO_SRC, brandBody, brandHeading } from "./helpers";

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
