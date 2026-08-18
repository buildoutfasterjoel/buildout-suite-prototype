import type { ContentBlock, Page } from "./types";

/**
 * Derivation for the `contents` block. Entries live nowhere in the document —
 * they are computed from the page list every render, so a page rename or
 * reorder shows up in the contents with nothing to sync.
 *
 * The number is the entry's position in the contents, not the page's position
 * in the document: it stays stable as front matter comes and goes, and can't
 * drift out of agreement with the footer's page number the way a printed page
 * reference would.
 */
export interface ContentsEntry {
  pageId: string;
  /** 1-based position in the contents list. */
  index: number;
  label: string;
}

/** Whether a block (or one of a container's children) is a contents block. */
function hasContentsBlock(blocks: readonly ContentBlock[]): boolean {
  return blocks.some((b) => b.type === "contents");
}

/**
 * A contents page lists the document's *sections*, so it never lists itself or
 * a sibling contents page. Detected by the block rather than by a page flag —
 * whatever page carries the block is the contents page by definition.
 */
function isContentsPage(page: Page): boolean {
  return page.blocks.some((block) => {
    if (block.type === "contents") return true;
    if (block.type === "section") return hasContentsBlock(block.blocks);
    if (block.type === "columns") return block.columns.some(hasContentsBlock);
    return false;
  });
}

/**
 * The sections a contents block lists: every page except hidden ones (they
 * don't print), front matter (`omitFromContents`, e.g. the cover), and contents
 * pages themselves.
 */
export function contentsEntries(pages: readonly Page[]): ContentsEntry[] {
  return pages
    .filter((page) => !page.hidden && !page.omitFromContents && !isContentsPage(page))
    .map((page, i) => ({ pageId: page.id, index: i + 1, label: page.name }));
}

/** Zero-padded entry number — `01`, `02`, … `12`. */
export function contentsIndexLabel(index: number): string {
  return String(index).padStart(2, "0");
}
