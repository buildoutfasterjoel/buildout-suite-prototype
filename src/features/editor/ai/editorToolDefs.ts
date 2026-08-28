import { toolDefinition } from "@tanstack/ai";

/**
 * Isomorphic tool **definitions** for the editor agent (schemas only, no
 * execute).
 *
 * Same contract as `src/ai/toolDefs.ts`: the server relay passes these to
 * `chat()` so Claude knows the surface, and because they carry no server-side
 * `execute` the runtime emits a client-tool request per call. The browser runs
 * the matching implementation from `editorTools.ts` against `useEditorStore`,
 * so no document content leaves the client.
 *
 * Scoped deliberately to the open document — the editor agent never sees the
 * CRM tools in `src/ai/toolDefs.ts`, so it cannot restage a deal or send an
 * email from inside a brochure.
 */

const BLOCK_TYPES = [
  "heading",
  "text",
  "table",
  "image",
  "list",
  "contents",
  "map",
  "columns",
  "section",
  "spacer",
  "divider",
] as const;

/**
 * Result shape every tool returns: `{ ok: true, ... }` on success, `{ error }`
 * on refusal.
 *
 * Declared for a mechanical reason, not for validation. A client tool is
 * delivered as an interrupt, and the server derives that interrupt's
 * `responseSchema` from the tool's `outputSchema`. With no `outputSchema` it
 * emits `{}`, which the client rejects as `invalid-response-schema` — the run
 * then parks forever, the model never sees the result, and the next ask fails.
 * `additionalProperties: true` keeps every tool's extra fields (`blockId`,
 * `pageId`, `unlockedPages`, `removedChildren`, `filled`…) legal.
 */
const TOOL_RESULT_SCHEMA = {
  type: "object" as const,
  properties: {
    ok: { type: "boolean" as const },
    error: { type: "string" as const },
  },
  additionalProperties: true,
};

// ── Read ──────────────────────────────────────────────────────────────────

export const readPageDef = toolDefinition({
  name: "readPage",
  description:
    "Read one page's full block tree — block ids, types, text, table cells with their cellIds, and list items. The ACTIVE page is already in your context; use this only for a page that isn't (e.g. to make page 4 match page 2).",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      pageId: { type: "string", description: "The page's id, from the outline in your context." },
    },
    required: ["pageId"],
    additionalProperties: false,
  },
});

// ── Content ───────────────────────────────────────────────────────────────

export const editBlockTextDef = toolDefinition({
  name: "editBlockText",
  description:
    "Replace a heading or text block's content. Write the STORED form: inline field tokens like {{property.city}} or {{marketing.saleTitle}} stay literal and render as live values, so PREFER a token over a copied-out fact — the document then re-resolves against another listing. Light inline HTML (<b>, <i>, <u>) is allowed. Works on locked pages.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string" },
      text: { type: "string", description: "The new content, stored form." },
    },
    required: ["blockId", "text"],
    additionalProperties: false,
  },
});

export const setTableCellsDef = toolDefinition({
  name: "setTableCells",
  description:
    "Set several table cell values in one call — always batch rather than calling once per cell. Cells are addressed by the cellId in your context. A cell with a dynamicKey is bound to live listing data and REFUSED — its rendered value comes from the deal, so a value set here would never appear on the page. Works on locked pages.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string", description: "The table block's id." },
      cells: {
        type: "array",
        items: {
          type: "object",
          properties: {
            cellId: { type: "string" },
            value: { type: "string" },
          },
          required: ["cellId", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["blockId", "cells"],
    additionalProperties: false,
  },
});

export const addTableRowDef = toolDefinition({
  name: "addTableRow",
  description:
    "Append a row to a table (or insert it at `index`), optionally filling it left to right from `values`. Pass at most as many values as the table has columns — more is refused rather than truncated. To build a NEW table, use addBlock with content.rows instead — that costs one call for the whole table.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string" },
      index: { type: "integer", description: "Row position. Omit to append." },
      values: { type: "array", items: { type: "string" } },
    },
    required: ["blockId"],
    additionalProperties: false,
  },
});

export const removeTableRowDef = toolDefinition({
  name: "removeTableRow",
  description: "Remove the row at `index` from a table. A table's last remaining row cannot be removed.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string" },
      index: { type: "number" },
    },
    required: ["blockId", "index"],
    additionalProperties: false,
  },
});

export const setListItemsDef = toolDefinition({
  name: "setListItems",
  description:
    "Replace a list block's items wholesale — pass the complete new list, not a delta. Fails on a list bound to a dynamic field (its items come from the deal's copy).",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string" },
      items: { type: "array", items: { type: "string" }, description: "The complete new list." },
    },
    required: ["blockId", "items"],
    additionalProperties: false,
  },
});

// ── Structure ─────────────────────────────────────────────────────────────

export const addBlockDef = toolDefinition({
  name: "addBlock",
  description:
    "Add a block to a page, built complete in one call — pass `content` and the block arrives finished rather than needing follow-up edits. Omit `index` to append. To place it inside a container, pass `containerBlockId` (and `columnIndex` for a columns block). Containers (columns, section) can only sit at a page's top level. If the page has a fixed layout this unfreezes it and tells you so in `unlockedPages` — mention that in your reply.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      pageId: { type: "string" },
      index: { type: "number", description: "Position among siblings. Omit to append." },
      type: { type: "string", enum: BLOCK_TYPES as unknown as string[] },
      containerBlockId: {
        type: "string",
        description: "Place inside this section or columns block instead of at the page's top level.",
      },
      columnIndex: { type: "integer", description: "Which column, when containerBlockId is a columns block." },
      content: {
        type: "object",
        description:
          "Initial content, shaped per type. heading/text: { text }. table: { title, rows: string[][], headerRow } — every row is padded to the widest, so give equal-length rows unless you mean a blank cell. list: { items, marker }. columns: { columnCount }. Omit for a default block.",
        properties: {
          text: { type: "string" },
          title: { type: "string" },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          headerRow: { type: "boolean", description: "Treat rows[0] as a header row." },
          items: { type: "array", items: { type: "string" } },
          marker: { type: "string", enum: ["bullet", "number", "none"] },
          columnCount: { type: "number", enum: [2, 3] },
          alt: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    required: ["pageId", "type"],
    additionalProperties: false,
  },
});

export const removeBlockDef = toolDefinition({
  name: "removeBlock",
  description:
    "Remove a block from the document. Removing a columns or section block ALSO removes every block inside it — the result reports how many in `removedChildren`, and you must say so in your reply, because nothing can be undone. If its page has a fixed layout this unfreezes it and tells you so in `unlockedPages` — mention that too.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: { blockId: { type: "string" } },
    required: ["blockId"],
    additionalProperties: false,
  },
});

export const moveBlockDef = toolDefinition({
  name: "moveBlock",
  description:
    "Move a block to a new position, on the same page or another one. Pass `containerBlockId` (and `columnIndex`) to move it inside a container. Unfreezes the source and destination pages' layouts if needed, reporting them in `unlockedPages`.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      blockId: { type: "string" },
      pageId: { type: "string", description: "Destination page." },
      index: { type: "number" },
      containerBlockId: { type: "string" },
      columnIndex: { type: "integer" },
    },
    required: ["blockId", "pageId", "index"],
    additionalProperties: false,
  },
});

// ── Pages ─────────────────────────────────────────────────────────────────

export const addPageDef = toolDefinition({
  name: "addPage",
  description:
    "Add a page. `template` is a designer template key (see the catalog in your instructions) or \"blank\". PREFER a template when one fits the ask — template pages are on-brand and already bound to the listing's live data. Use \"blank\" and then addBlock only when no template covers it. The new page becomes the active page.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      template: { type: "string", description: "A template key, or \"blank\"." },
      name: { type: "string", description: "Override the page name (a contents block prints it)." },
      atIndex: { type: "number", description: "Page position. Omit to append." },
    },
    required: ["template"],
    additionalProperties: false,
  },
});

export const removePageDef = toolDefinition({
  name: "removePage",
  description: "Remove a page from the document. A document's only page can't be removed.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: { pageId: { type: "string" } },
    required: ["pageId"],
    additionalProperties: false,
  },
});

export const renamePageDef = toolDefinition({
  name: "renamePage",
  description:
    "Rename a page. The name is what a table-of-contents block prints, so keep it short and section-like.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: { pageId: { type: "string" }, name: { type: "string" } },
    required: ["pageId", "name"],
    additionalProperties: false,
  },
});

export const goToPageDef = toolDefinition({
  name: "goToPage",
  description:
    "Scroll the canvas to a page, so the broker is looking at what you are talking about. Use when they ask to see something; addPage already lands there on its own.",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: { pageId: { type: "string" } },
    required: ["pageId"],
    additionalProperties: false,
  },
});

export const setPageLockedDef = toolDefinition({
  name: "setPageLocked",
  description:
    "Freeze or unfreeze a page's layout. Template pages ship frozen — content editable, layout fixed. You do NOT need this before a structural edit: addBlock, removeBlock and moveBlock unfreeze on their own. Use it only when the broker asks directly (\"lock this page\", \"unfreeze the cover\").",
  outputSchema: TOOL_RESULT_SCHEMA,
  inputSchema: {
    type: "object",
    properties: {
      pageId: { type: "string" },
      locked: { type: "boolean", description: "true freezes the layout, false unfreezes it." },
    },
    required: ["pageId", "locked"],
    additionalProperties: false,
  },
});

/**
 * The editor agent's tool vocabulary in the present participle, for the running
 * tool chip in `OttoPanel`. It lives beside the definitions so a renamed tool
 * and its label are one edit apart — a stale key silently falls back to a
 * de-snaked raw name in the UI, which a test in `editorTools.test.ts` guards.
 */
export const EDITOR_TOOL_LABELS: Record<string, string> = {
  readPage: "Reading the page",
  editBlockText: "Rewriting copy",
  setTableCells: "Filling the table",
  addTableRow: "Adding a row",
  removeTableRow: "Removing a row",
  setListItems: "Rewriting the list",
  addBlock: "Adding a block",
  removeBlock: "Removing a block",
  moveBlock: "Moving a block",
  addPage: "Adding a page",
  removePage: "Removing a page",
  renamePage: "Renaming the page",
  goToPage: "Going to the page",
  // Both directions: this tool freezes as well as unfreezes.
  setPageLocked: "Changing the layout lock",
};

/**
 * The same vocabulary in the past tense, for a landed call's settled line (see
 * `toolDoneLabel`). Kept beside its present-tense twin so a renamed tool takes
 * both labels with it; `editorTools.test.ts` guards that neither map drifts.
 */
export const EDITOR_TOOL_LABELS_DONE: Record<string, string> = {
  readPage: "Read the page",
  editBlockText: "Rewrote copy",
  setTableCells: "Filled the table",
  addTableRow: "Added a row",
  removeTableRow: "Removed a row",
  setListItems: "Rewrote the list",
  addBlock: "Added a block",
  removeBlock: "Removed a block",
  moveBlock: "Moved a block",
  addPage: "Added a page",
  removePage: "Removed a page",
  renamePage: "Renamed the page",
  goToPage: "Went to the page",
  setPageLocked: "Changed the layout lock",
};

/** Every editor tool definition — passed to `chat({ tools })` by the relay. */
export const EDITOR_TOOL_DEFS = [
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
];
