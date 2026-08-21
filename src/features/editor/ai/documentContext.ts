import { useEditorStore } from "../store";
import { findBlock } from "../tree";
import type { DealMarketing } from "#/data/types";
import type { BlockType, Page } from "../types";
import { describeBlock, type EditorAgentBlock } from "./blockShape";

/**
 * The open document, as the editor agent sees it.
 *
 * Mirrors `src/ai/context.ts`: a typed snapshot built from the live store, then
 * serialized with a byte cap. The active page arrives in full so an ask about
 * "this" resolves without a tool call; every other page arrives as an outline
 * the agent can expand with `readPage`.
 *
 * Blocks are serialized by the shared `describeBlock` in `blockShape.ts` — the
 * same function `readPage` uses — so context and tool results never describe a
 * block two different ways.
 */
export interface EditorAgentContext {
  document: { id: string; name: string; pageCount: number };
  pages: Array<{
    id: string;
    name: string;
    index: number;
    locked?: boolean;
    hidden?: boolean;
    blockCount: number;
  }>;
  activePage: {
    id: string;
    name: string;
    locked?: boolean;
    blocks: EditorAgentBlock[];
  } | null;
  selection: {
    pageId: string;
    blockId?: string;
    cellId?: string;
    blockType?: BlockType;
  } | null;
  listing: {
    name: string;
    address: string;
    city: string;
    state: string;
    propertyType: string;
    buildingSqFt?: number;
    askingPrice?: number;
    capRate?: number;
    yearBuilt?: number;
    occupancyPct?: number;
    /**
     * The deal's marketing copy under its REAL field names, so what the agent
     * reads here matches the `{{marketing.<field>}}` token it can write and the
     * field the designer templates bind. Only populated fields appear — an
     * absent key means the broker hasn't written that copy, which is itself
     * worth knowing before offering to draft it.
     */
    marketing: MarketingCopy;
  } | null;
}

/**
 * The `marketing.*` fields the agent can both read and write.
 *
 * Named exactly as the store holds them and as `{{marketing.<field>}}`
 * resolves them (`dynamic.ts`), rather than flattened to a neutral
 * title/description/bullets. Sale and lease copy coexist on a deal, the store
 * carries no `dealType` to choose between them, and every designer template
 * binds the sale fields — so a snapshot that picked a winner left the agent
 * reading copy under a key that matched no token it could write.
 */
export interface MarketingCopy {
  saleTitle?: string;
  saleDescription?: string;
  saleBullets?: string[];
  leaseTitle?: string;
  leaseDescription?: string;
  leaseBullets?: string[];
  locationDescription?: string;
}

/**
 * Copy the marketing fields that are actually populated. Empty strings and
 * empty arrays are dropped rather than sent as blanks: an absent key is a
 * shorter, truer "nothing written here yet".
 */
function marketingCopy(marketing: DealMarketing | undefined): MarketingCopy {
  if (!marketing) return {};
  const out: MarketingCopy = {};
  const text = (value: string | undefined) => (value && value.trim() ? value : undefined);
  const list = (value: string[] | undefined) => (value?.length ? value : undefined);
  if (text(marketing.saleTitle)) out.saleTitle = marketing.saleTitle;
  if (text(marketing.saleDescription)) out.saleDescription = marketing.saleDescription;
  if (list(marketing.saleBullets)) out.saleBullets = marketing.saleBullets;
  if (text(marketing.leaseTitle)) out.leaseTitle = marketing.leaseTitle;
  if (text(marketing.leaseDescription)) out.leaseDescription = marketing.leaseDescription;
  if (list(marketing.leaseBullets)) out.leaseBullets = marketing.leaseBullets;
  if (text(marketing.locationDescription)) out.locationDescription = marketing.locationDescription;
  return out;
}

/** Count a page's blocks including one level of container children. */
function countBlocks(page: Page): number {
  let total = page.blocks.length;
  for (const b of page.blocks) {
    if (b.type === "section") total += b.blocks.length;
    if (b.type === "columns") total += b.columns.reduce((n, col) => n + col.length, 0);
  }
  return total;
}

/** Build the snapshot from the live editor store. */
export function buildEditorContext(): EditorAgentContext {
  const s = useEditorStore.getState();
  const { document, activePageId, selection, activeListing, activeMarketing } = s;

  const active =
    document.pages.find((p) => p.id === activePageId) ?? document.pages[0] ?? null;

  // Resolved via `findBlock`, which walks one level into `section`/`columns`
  // containers — a top-level-only lookup here would leave every nested
  // selection (the cover's whole title band, among others) without a
  // `blockType`. `resolveSelection` in store.ts learned this same lesson.
  const selectedBlock = selection?.blockId ? findBlock(document, selection.blockId) : null;

  return {
    document: { id: document.id, name: document.name, pageCount: document.pages.length },
    pages: document.pages.map((p, index) => ({
      id: p.id,
      name: p.name,
      index,
      ...(p.locked ? { locked: true } : {}),
      ...(p.hidden ? { hidden: true } : {}),
      blockCount: countBlocks(p),
    })),
    activePage: active
      ? {
          id: active.id,
          name: active.name,
          ...(active.locked ? { locked: true } : {}),
          blocks: active.blocks.map(describeBlock),
        }
      : null,
    selection: selection
      ? {
          pageId: selection.pageId,
          ...(selection.blockId ? { blockId: selection.blockId } : {}),
          ...(selection.cellId ? { cellId: selection.cellId } : {}),
          ...(selectedBlock ? { blockType: selectedBlock.type } : {}),
        }
      : null,
    listing: activeListing
      ? {
          name: activeListing.name,
          address: activeListing.street,
          city: activeListing.city,
          state: activeListing.state,
          propertyType: activeListing.propertyType,
          buildingSqFt: activeListing.buildingSqFt,
          askingPrice: activeListing.askingPrice,
          capRate: activeListing.capRate,
          yearBuilt: activeListing.yearBuilt,
          occupancyPct: activeListing.occupancyPct,
          marketing: marketingCopy(activeMarketing),
        }
      : null,
  };
}

/** Truncate a string to `n` characters with an ellipsis. */
const clip = (text: string, n: number) => (text.length <= n ? text : `${text.slice(0, n)}…`);

/**
 * Compact JSON, trimmed to fit `maxBytes`.
 *
 * Trim order, cheapest information first: active-page text values, then
 * container-child detail, then the listing's marketing copy. The page outline is
 * never dropped — without page ids the agent cannot act at all, so a document
 * too big to fit degrades to "here are your pages, ask me to read one."
 */
export function serializeEditorContext(ctx: EditorAgentContext, maxBytes = 12288): string {
  let out = JSON.stringify(ctx);
  if (out.length <= maxBytes) return out;

  const clone = JSON.parse(out) as EditorAgentContext;

  for (const limit of [400, 160, 60]) {
    if (clone.activePage) {
      for (const b of clone.activePage.blocks) {
        if (b.text) b.text = clip(b.text, limit);
        if (b.items) b.items = b.items.map((i) => clip(i, limit));
        if (b.rows) {
          for (const row of b.rows) for (const c of row) c.value = clip(c.value, limit);
        }
      }
    }
    out = JSON.stringify(clone);
    if (out.length <= maxBytes) return out;
  }

  if (clone.activePage) {
    for (const b of clone.activePage.blocks) delete b.children;
  }
  out = JSON.stringify(clone);
  if (out.length <= maxBytes) return out;

  if (clone.listing) clone.listing.marketing = {};
  out = JSON.stringify(clone);
  if (out.length <= maxBytes) return out;

  // Last resort: keep the outline and the active page's block skeleton only.
  if (clone.activePage) {
    clone.activePage.blocks = clone.activePage.blocks.map((b) => ({ id: b.id, type: b.type }));
  }
  return JSON.stringify(clone);
}
