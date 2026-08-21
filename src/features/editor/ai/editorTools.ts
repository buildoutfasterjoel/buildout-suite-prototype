import type { AnyClientTool } from "@tanstack/ai";
import { useEditorStore } from "../store";
import { findBlock, findLocation } from "../tree";
import { createBlock, createCell } from "../blocks/blockFactory";
import { TEMPLATES, buildBlankPage, buildTemplatePage } from "../templates";
import { describeBlock } from "./blockShape";
import type {
  Block,
  Cell,
  DropTarget,
  EditorDocument,
  ListBlock,
  Page,
  TableBlock,
} from "../types";
import {
  readPageDef,
  editBlockTextDef,
  setTableCellsDef,
  addTableRowDef,
  removeTableRowDef,
  setListItemsDef,
  addBlockDef,
  removeBlockDef,
  moveBlockDef,
  addPageDef,
  removePageDef,
  renamePageDef,
  goToPageDef,
  setPageLockedDef,
} from "./editorToolDefs";

/**
 * Client-side implementations of the editor agent's tools, run in the browser
 * against `useEditorStore`. Every one returns a plain object — `{ error }` on
 * failure rather than a throw — so the model can relay the problem and try
 * something else. See `src/ai/tools.ts` for the same pattern on the CRM side.
 *
 * Handlers are exported individually so they can be tested against a real store
 * without a chat runtime; `createEditorTools` binds them to their definitions.
 */

type Result = Record<string, unknown>;

const err = (message: string): Result => ({ error: message });

/** Resolve a block id, or return the error a tool should hand back. */
function requireBlock(blockId: string): { block: Block } | { error: string } {
  const block = findBlock(useEditorStore.getState().document, blockId);
  return block ? { block } : { error: `No block with id "${blockId}" in this document.` };
}

// ── Read ──────────────────────────────────────────────────────────────────

export function readPage(args: { pageId: string }): Result {
  const page = useEditorStore.getState().document.pages.find((p) => p.id === args.pageId);
  if (!page) return err(`No page with id "${args.pageId}" in this document.`);
  return {
    id: page.id,
    name: page.name,
    locked: page.locked ?? false,
    // The same serializer the context snapshot uses (`blockShape.ts`), so a
    // page read here and the active page read from context arrive in one shape.
    blocks: page.blocks.map(describeBlock),
  };
}

// ── Content ───────────────────────────────────────────────────────────────

export function editBlockText(args: { blockId: string; text: string }): Result {
  const found = requireBlock(args.blockId);
  if ("error" in found) return found;
  if (found.block.type !== "heading" && found.block.type !== "text") {
    return err(
      `Block "${args.blockId}" is a ${found.block.type}, which has no text to edit. Use setTableCells for a table or setListItems for a list.`,
    );
  }
  useEditorStore.getState().setBlockText(args.blockId, args.text);
  return { ok: true, blockId: args.blockId };
}

export function setTableCells(args: {
  blockId: string;
  cells: Array<{ cellId: string; value: string }>;
}): Result {
  const found = requireBlock(args.blockId);
  if ("error" in found) return found;
  if (found.block.type !== "table") {
    return err(`Block "${args.blockId}" is a ${found.block.type}, not a table.`);
  }

  // Validate the whole batch first: a half-applied table is worse than a
  // refusal the model can correct.
  const cells = new Map(
    (found.block as TableBlock).rows.flatMap((row) => row.map((c) => [c.id, c] as const)),
  );
  const missing = args.cells.filter((c) => !cells.has(c.cellId)).map((c) => c.cellId);
  if (missing.length > 0) {
    return err(`No cell in this table with id ${missing.map((m) => `"${m}"`).join(", ")}.`);
  }

  // A bound cell renders `resolveDynamic(cell, data)` and is not editable on
  // the canvas (`BlockViews.tsx`), so writing its `value` would change nothing
  // the broker can see while this call still answered `{ ok: true }` — the
  // worst failure available to an agent whose only verification channel is the
  // canvas. Refused in code rather than left to the prompt, exactly as
  // `setListItems` refuses a bound list, and refused before applying any of the
  // batch so a half-written table never survives the refusal. The dynamicKey
  // comes back so the model can say which live field owns the value.
  const bound = args.cells
    .map(({ cellId }) => cells.get(cellId))
    .filter((cell): cell is Cell => Boolean(cell?.dynamicKey));
  if (bound.length > 0) {
    return err(
      `${bound.length === 1 ? "Cell" : "Cells"} ${bound
        .map((cell) => `"${cell.id}" (bound to ${cell.dynamicKey})`)
        .join(", ")} pull live listing data, so a value set here would never show on the page. Nothing was changed — edit the listing's own field instead, or target a different cell.`,
    );
  }

  const store = useEditorStore.getState();
  for (const { cellId, value } of args.cells) store.setCellValue(args.blockId, cellId, value);
  return { ok: true, updated: args.cells.length };
}

/**
 * Row geometry is content, not layout — so `addTableRow` and `removeTableRow`
 * deliberately do NOT unlock the page or report one, unlike the structural
 * tools below.
 *
 * `locked` gates *block* layout: dragging a block, deleting one, dropping one
 * in (`dnd/`, and the suppressed delete buttons in `PageView`/`NavPanels`). A
 * table's rows are inside a block the broker may already edit freely on a
 * locked page — the canvas's own row handles work there today — so lifting the
 * page's lock to add a row would unfreeze layout the broker never asked to
 * unfreeze, and report an unlock they don't need to hear about. Don't "fix"
 * this by routing them through `unlockIfNeeded`.
 */
export function addTableRow(args: {
  blockId: string;
  index?: number;
  values?: string[];
}): Result {
  const found = requireBlock(args.blockId);
  if ("error" in found) return found;
  if (found.block.type !== "table") {
    return err(`Block "${args.blockId}" is a ${found.block.type}, not a table.`);
  }

  const table = found.block as TableBlock;
  const index = args.index ?? table.rows.length;
  // Whole numbers only: the store's `clampIndex` passes 1.5 straight through,
  // `splice` truncates it to 1, and the fill below would then read
  // `rows[1.5]` — undefined — and throw, which no tool may do.
  if (!Number.isInteger(index)) {
    return err(`Row index ${index} isn't a whole number.`);
  }
  if (index < 0 || index > table.rows.length) {
    return err(`Row index ${index} is out of range — this table has ${table.rows.length} rows.`);
  }

  // A new row inherits the table's column count, so surplus values have
  // nowhere to go. Refuse before adding the row rather than filling what fits
  // and answering `{ ok: true }`: too many values means the model misread the
  // table's width, and silently dropping the tail leaves a wrong row on a
  // canvas with no undo.
  const columnCount = table.rows[0]?.length ?? 0;
  if (args.values && args.values.length > columnCount) {
    return err(
      `${args.values.length} values won't fit — this table has ${columnCount} columns. Pass at most that many, or add a column first.`,
    );
  }

  const store = useEditorStore.getState();
  store.addRow(args.blockId, index);

  let filled = 0;
  if (args.values?.length) {
    const fresh = findBlock(useEditorStore.getState().document, args.blockId) as TableBlock;
    const row = fresh.rows[index];
    row.forEach((cell, i) => {
      const value = args.values?.[i];
      if (value !== undefined) {
        store.setCellValue(args.blockId, cell.id, value);
        filled += 1;
      }
    });
  }
  return { ok: true, index, filled };
}

/** Like `addTableRow`, this never touches the page's lock — see the note there. */
export function removeTableRow(args: { blockId: string; index: number }): Result {
  const found = requireBlock(args.blockId);
  if ("error" in found) return found;
  if (found.block.type !== "table") {
    return err(`Block "${args.blockId}" is a ${found.block.type}, not a table.`);
  }
  const table = found.block as TableBlock;
  if (args.index < 0 || args.index >= table.rows.length) {
    return err(
      `Row index ${args.index} is out of range — this table has ${table.rows.length} rows.`,
    );
  }
  if (table.rows.length <= 1) return err("A table's last remaining row can't be removed.");

  useEditorStore.getState().removeRow(args.blockId, args.index);
  return { ok: true };
}

export function setListItems(args: { blockId: string; items: string[] }): Result {
  const found = requireBlock(args.blockId);
  if ("error" in found) return found;
  if (found.block.type !== "list") {
    return err(`Block "${args.blockId}" is a ${found.block.type}, not a list.`);
  }
  const list = found.block as ListBlock;
  if (list.dynamicKey) {
    return err(
      `This list is bound to ${list.dynamicKey}, so its items come from the deal's copy and can't be set here.`,
    );
  }
  if (args.items.length === 0) return err("A list can't be empty — pass at least one item.");

  const store = useEditorStore.getState();
  // Re-read the document each call: `store` is a snapshot from `getState()`, so
  // `store.document` would otherwise stay frozen at its pre-loop length and
  // this loop would never converge.
  const current = () =>
    (findBlock(useEditorStore.getState().document, args.blockId) as ListBlock).items.length;

  // Grow or shrink to length, then write every value.
  while (current() < args.items.length) {
    store.addListItem(args.blockId, current());
  }
  while (current() > args.items.length) {
    store.removeListItem(args.blockId, current() - 1);
  }
  args.items.forEach((text, i) => store.setListItem(args.blockId, i, text));

  return { ok: true, count: args.items.length };
}

// ── Structure ─────────────────────────────────────────────────────────────

/** The page a block currently lives on, or null when the id resolves to nothing. */
function pageOf(blockId: string): Page | null {
  const doc = useEditorStore.getState().document;
  const loc = findLocation(doc, blockId);
  if (!loc) return null;
  if (loc.kind === "page") return doc.pages.find((p) => p.id === loc.pageId) ?? null;
  // A container target — find the page holding the container.
  return doc.pages.find((p) => p.blocks.some((b) => b.id === loc.blockId)) ?? null;
}

/**
 * Unfreeze a page's layout if it is frozen, and report which page that was.
 *
 * Every page in a real document ships `locked: true` — all 12 designer templates
 * and the sample Proposal's stub pages — and nothing in the UI unfreezes one. A
 * structural tool that refused here would leave the whole capability reachable
 * on nothing but a blank page the agent made itself.
 *
 * Unlocking inside the tool rather than making the model call `setPageLocked`
 * first is the robust shape: one round-trip, and no failure mode where it asks
 * for a layout change and forgets to lift the lock. The page name comes back so
 * the model can tell the broker their template was unfrozen — the prompt
 * requires it, because the broker otherwise silently loses a protection they
 * never chose to give up: blocks on that page become draggable and deletable,
 * and the next agent edit no longer has to unfreeze anything. (The UI itself
 * keeps up on its own — the "Fixed layout" badge, the per-layer "Fixed" chips,
 * and the suppressed delete buttons all read `page.locked` through reactive
 * store selectors.)
 */
function unlockIfNeeded(page: Page | null): string | null {
  if (!page?.locked) return null;
  useEditorStore.getState().setPageLocked(page.id, false);
  return page.name;
}

/** Turn the tools' flat arguments into the store's DropTarget union. */
function toDropTarget(args: {
  pageId: string;
  index?: number;
  containerBlockId?: string;
  columnIndex?: number;
}): DropTarget {
  const index = args.index ?? Number.MAX_SAFE_INTEGER;
  if (args.containerBlockId === undefined) {
    return { kind: "page", pageId: args.pageId, index };
  }
  const container = findBlock(useEditorStore.getState().document, args.containerBlockId);
  if (container?.type === "columns") {
    return {
      kind: "column",
      blockId: args.containerBlockId,
      columnIndex: args.columnIndex ?? 0,
      index,
    };
  }
  return { kind: "section", blockId: args.containerBlockId, index };
}

/**
 * Validate a container placement target shared by `addBlock` and `moveBlock`:
 * when `containerBlockId` is given, it must be an existing section or columns
 * block that lives at the top level of `pageId` — not merely somewhere in the
 * document — and a columns block's `columnIndex` must be a whole number
 * within its column count. Returns an error message, or null when valid.
 *
 * This runs before either tool touches the store. The store's own
 * `insertAt`/`moveBlock` don't validate their target at all — they just no-op
 * (or, for a move, silently drop the block) when it doesn't resolve — and
 * `toDropTarget` above will happily build a `{ kind: "section" }` target from
 * a `containerBlockId` that doesn't exist or isn't a container. Checking here
 * first means a doomed call never unlocks a page as a side effect, and a
 * moved block is never removed from its old spot before its new one turns
 * out to be bogus.
 *
 * Scoped to the given page on purpose: `insertAt`'s container branch matches
 * the container by id *within* the page it's told to look at, ignoring
 * `pageId` isn't even in play once inside that branch — so a containerBlockId
 * that lives on a different page would otherwise structurally edit that other
 * (possibly still-locked) page while this tool unlocks and reports the wrong
 * one.
 */
function validateContainerTarget(
  doc: EditorDocument,
  args: { pageId: string; containerBlockId?: string; columnIndex?: number },
): string | null {
  if (args.containerBlockId === undefined) return null;

  const page = doc.pages.find((p) => p.id === args.pageId);
  const container = page?.blocks.find((b) => b.id === args.containerBlockId);
  if (!container || (container.type !== "columns" && container.type !== "section")) {
    return `No section or columns block with id "${args.containerBlockId}" on page "${args.pageId}".`;
  }

  if (container.type === "columns") {
    const columnIndex = args.columnIndex ?? 0;
    if (
      !Number.isInteger(columnIndex) ||
      columnIndex < 0 ||
      columnIndex >= container.columnCount
    ) {
      return `Column index ${columnIndex} is out of range — this columns block has ${container.columnCount} columns.`;
    }
  }

  return null;
}

export interface AddBlockContent {
  text?: string;
  title?: string;
  rows?: string[][];
  headerRow?: boolean;
  items?: string[];
  marker?: "bullet" | "number" | "none";
  columnCount?: 2 | 3;
  alt?: string;
}

/** Build a complete block from `createBlock`'s default plus the given content. */
function buildBlock(type: Block["type"], content?: AddBlockContent): Block {
  const block = createBlock(type, content?.columnCount ? { columnCount: content.columnCount } : undefined);
  if (!content) return block;

  if ((block.type === "heading" || block.type === "text") && content.text !== undefined) {
    block.text = content.text;
  }
  if (block.type === "table") {
    if (content.title !== undefined) block.title = content.title;
    if (content.rows?.length) {
      // Pad every row to the widest one. The renderer derives its column count
      // from `rows[0]` alone (`BlockViews.tsx`, and `store.ts`'s addRow), so a
      // 2-cell totals row under a 3-cell header would render with the wrong
      // geometry and a misaligned edit overlay — permanently, since there is
      // no undo. A model that means "leave that cell empty" gets exactly that.
      const width = content.rows.reduce((max, row) => Math.max(max, row.length), 0);
      block.rows = content.rows.map((row, rowIndex) =>
        Array.from({ length: width }, (_, columnIndex) => {
          const cell = createCell({ header: content.headerRow === true && rowIndex === 0 });
          cell.value = row[columnIndex] ?? "";
          return cell;
        }),
      );
    }
  }
  if (block.type === "list") {
    if (content.items?.length) block.items = [...content.items];
    if (content.marker) block.marker = content.marker;
  }
  if (block.type === "image" && content.alt !== undefined) block.alt = content.alt;

  return block;
}

export function addBlock(args: {
  pageId: string;
  index?: number;
  type: Block["type"];
  containerBlockId?: string;
  columnIndex?: number;
  content?: AddBlockContent;
}): Result {
  const doc = useEditorStore.getState().document;
  const page = doc.pages.find((p) => p.id === args.pageId);
  if (!page) return err(`No page with id "${args.pageId}" in this document.`);

  const isContainerType = args.type === "columns" || args.type === "section";
  if (isContainerType && args.containerBlockId !== undefined) {
    return err(
      "A columns or section block can't go inside another container — put it at the page's top level.",
    );
  }

  // Validate before unlocking: a call that's going to be refused shouldn't
  // unfreeze the page as a side effect and then lose that report on the
  // error return.
  const targetError = validateContainerTarget(doc, args);
  if (targetError) return err(targetError);

  const unlockedPage = unlockIfNeeded(page);

  const block = buildBlock(args.type, args.content);
  const target = toDropTarget(args);
  useEditorStore.getState().insertBlock(target, block);

  // Belt-and-braces: validateContainerTarget already rules out a bogus or
  // mistyped containerBlockId, so this should always succeed. Kept in case
  // insertBlock ever grows another silent-no-op path — and if it ever does,
  // re-freeze the page, because an `{ error }` return carries no
  // `unlockedPages` and would otherwise leave a template silently unfrozen
  // with nothing to show for it.
  if (!findBlock(useEditorStore.getState().document, block.id)) {
    if (unlockedPage) useEditorStore.getState().setPageLocked(page.id, true);
    return err(`Couldn't place a ${args.type} block there.`);
  }
  return { ok: true, blockId: block.id, ...(unlockedPage ? { unlockedPages: [unlockedPage] } : {}) };
}

/** How many blocks a container holds — what goes with it when it is removed. */
function childCount(block: Block): number {
  if (block.type === "section") return block.blocks.length;
  if (block.type === "columns") return block.columns.reduce((n, col) => n + col.length, 0);
  return 0;
}

export function removeBlock(args: { blockId: string }): Result {
  const found = requireBlock(args.blockId);
  if ("error" in found) return found;

  // Removing a section or columns block takes its whole subtree with it. With
  // no undo in this editor that is the agent's largest irreversible blast
  // radius, so the count comes back and the prompt requires the model to say
  // it — "removed the two-column band and the 3 blocks inside it" — rather
  // than confirming a bare success for content the broker never named.
  const removedChildren = childCount(found.block);

  const unlockedPage = unlockIfNeeded(pageOf(args.blockId));

  useEditorStore.getState().removeBlock(args.blockId);
  return {
    ok: true,
    ...(removedChildren > 0 ? { removedChildren } : {}),
    ...(unlockedPage ? { unlockedPages: [unlockedPage] } : {}),
  };
}

export function moveBlock(args: {
  blockId: string;
  pageId: string;
  index: number;
  containerBlockId?: string;
  columnIndex?: number;
}): Result {
  const found = requireBlock(args.blockId);
  if ("error" in found) return found;

  const doc = useEditorStore.getState().document;
  if (!doc.pages.some((p) => p.id === args.pageId)) {
    return err(`No page with id "${args.pageId}" in this document.`);
  }

  if (
    (found.block.type === "columns" || found.block.type === "section") &&
    args.containerBlockId !== undefined
  ) {
    return err(
      "A columns or section block can't go inside another container — put it at the page's top level.",
    );
  }

  // Validate the destination container before touching anything: the store's
  // moveBlock removes the block from its current spot unconditionally and
  // only then tries to reinsert it, so a bogus containerBlockId, a container
  // that lives on a different page, or an out-of-range/non-integer
  // columnIndex would silently drop the block from the document rather than
  // leaving it in place with an error.
  const targetError = validateContainerTarget(doc, args);
  if (targetError) return err(targetError);

  // Both ends: a block can't leave a frozen page or land on one.
  const unlockedSource = unlockIfNeeded(pageOf(args.blockId));
  const unlockedDestination = unlockIfNeeded(
    useEditorStore.getState().document.pages.find((p) => p.id === args.pageId) ?? null,
  );
  const unlockedPages = [unlockedSource, unlockedDestination].filter(
    (name): name is string => name !== null,
  );

  useEditorStore.getState().moveBlock(args.blockId, toDropTarget(args));
  return { ok: true, ...(unlockedPages.length > 0 ? { unlockedPages } : {}) };
}

// ── Pages ─────────────────────────────────────────────────────────────────

export function addPage(args: {
  template: string;
  name?: string;
  atIndex?: number;
}): Result {
  const known = args.template === "blank" || TEMPLATES.some((t) => t.key === args.template);
  if (!known) {
    return err(
      `"${args.template}" isn't a template. Available: blank, ${TEMPLATES.map((t) => t.key).join(", ")}.`,
    );
  }

  const listing = useEditorStore.getState().activeListing;
  const page =
    args.template === "blank" ? buildBlankPage() : buildTemplatePage(args.template, listing);
  if (args.name) page.name = args.name;

  useEditorStore.getState().insertPage(page, args.atIndex);
  // `insertPage` sets `activePageId`, but the canvas recomputes that from the
  // viewport as soon as the page list changes — so without an actual scroll
  // request the broker stays where they were while this claimed the new page
  // was active. `goToPage` records the request the Canvas acts on.
  useEditorStore.getState().goToPage(page.id);
  return { ok: true, pageId: page.id, name: page.name };
}

export function removePage(args: { pageId: string }): Result {
  const doc = useEditorStore.getState().document;
  if (!doc.pages.some((p) => p.id === args.pageId)) {
    return err(`No page with id "${args.pageId}" in this document.`);
  }
  if (doc.pages.length <= 1) {
    return err("That's the document's only page — removing it would leave nothing to edit.");
  }
  useEditorStore.getState().removePage(args.pageId);
  return { ok: true };
}

export function renamePage(args: { pageId: string; name: string }): Result {
  const doc = useEditorStore.getState().document;
  if (!doc.pages.some((p) => p.id === args.pageId)) {
    return err(`No page with id "${args.pageId}" in this document.`);
  }
  useEditorStore.getState().renamePage(args.pageId, args.name);
  return { ok: true, name: args.name };
}

export function goToPage(args: { pageId: string }): Result {
  const doc = useEditorStore.getState().document;
  if (!doc.pages.some((p) => p.id === args.pageId)) {
    return err(`No page with id "${args.pageId}" in this document.`);
  }
  useEditorStore.getState().goToPage(args.pageId);
  return { ok: true };
}

export function setPageLocked(args: { pageId: string; locked: boolean }): Result {
  const doc = useEditorStore.getState().document;
  if (!doc.pages.some((p) => p.id === args.pageId)) {
    return err(`No page with id "${args.pageId}" in this document.`);
  }
  useEditorStore.getState().setPageLocked(args.pageId, args.locked);
  return { ok: true, locked: args.locked };
}

/**
 * Bind every handler to its definition. Called once from `OttoPanel` and passed
 * to `useChat({ tools })`, which dispatches by tool name.
 */
export function createEditorTools(): AnyClientTool[] {
  return [
    readPageDef.client(async (args) => readPage(args as { pageId: string })),
    editBlockTextDef.client(async (args) =>
      editBlockText(args as { blockId: string; text: string }),
    ),
    setTableCellsDef.client(async (args) =>
      setTableCells(args as { blockId: string; cells: Array<{ cellId: string; value: string }> }),
    ),
    addTableRowDef.client(async (args) =>
      addTableRow(args as { blockId: string; index?: number; values?: string[] }),
    ),
    removeTableRowDef.client(async (args) =>
      removeTableRow(args as { blockId: string; index: number }),
    ),
    setListItemsDef.client(async (args) =>
      setListItems(args as { blockId: string; items: string[] }),
    ),
    addBlockDef.client(async (args) => addBlock(args as Parameters<typeof addBlock>[0])),
    removeBlockDef.client(async (args) => removeBlock(args as { blockId: string })),
    moveBlockDef.client(async (args) => moveBlock(args as Parameters<typeof moveBlock>[0])),
    addPageDef.client(async (args) => addPage(args as Parameters<typeof addPage>[0])),
    removePageDef.client(async (args) => removePage(args as { pageId: string })),
    renamePageDef.client(async (args) => renamePage(args as { pageId: string; name: string })),
    goToPageDef.client(async (args) => goToPage(args as { pageId: string })),
    setPageLockedDef.client(async (args) =>
      setPageLocked(args as { pageId: string; locked: boolean }),
    ),
  ];
}
