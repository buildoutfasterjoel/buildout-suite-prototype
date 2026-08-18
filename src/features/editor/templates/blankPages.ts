import type { Page } from "../types";
import { uid } from "../blocks/blockFactory";
import { BRAND } from "../brand";

/**
 * A base page — the brand logo header and company footer frame it, and
 * everything between them is the user's to build up from the Blocks palette.
 *
 * There is no second "on-brand" variant: the header and footer are page chrome
 * now (see `Page.chrome`), so every blank page is on-brand by construction and
 * a seeded scaffold would only be something to delete.
 */
export function buildBlankPage(): Page {
  return {
    id: uid("page"),
    name: "New Page",
    logoSrc: BRAND.logoSrc,
    locked: false,
    blocks: [],
  };
}
