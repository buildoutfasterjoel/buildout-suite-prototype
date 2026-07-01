import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faArrowRotateLeft,
  faTableColumnsAddBefore,
  faTableColumnsAddAfter,
  faTableRowsAddAbove,
  faTableRowsAddBelow,
  faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type {
  Block,
  Cell,
  ColumnsBlock,
  ContentBlock,
  DividerBlock,
  DynamicBlock,
  HeadingBlock,
  ImageBlock,
  SectionBlock,
  Selection,
  SpacerBlock,
  TableBlock,
  TextBlock,
  TextStyle,
} from "../types";
import { useEditorStore } from "../store";
import { findBlock } from "../tree";
import { resolveDynamic, resolveField } from "../dynamic";
import { SortableBlock, ListDropZone } from "../dnd/SortableBlock";
import type { ListLocation } from "../dnd/dndTypes";
import { blockLabel } from "./blockMeta";

function textStyleToCss(style: TextStyle): CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    lineHeight: style.lineHeight ? `${style.lineHeight}px` : undefined,
    textAlign: style.align,
    textTransform: style.transform === "none" ? undefined : style.transform,
    color: style.color ?? "#000",
    background: style.background ?? undefined,
  };
}

interface VisualProps {
  pageId: string;
  selection: Selection | null;
  /** The page is a locked preset: block structure is fixed, content stays editable. */
  locked: boolean;
}

function useSelect() {
  return useEditorStore((s) => s.select);
}

/* ---------------- A list of blocks (top level or nested) ---------------- */
export function BlockList({
  blocks,
  pageId,
  list,
  selection,
  locked,
}: {
  blocks: ContentBlock[] | Block[];
  pageId: string;
  list: ListLocation;
  selection: Selection | null;
  locked: boolean;
}) {
  // Locked (preset) pages render content only — no sortable chrome or drop
  // zones, so blocks can't be added, moved, or removed.
  if (locked) {
    return (
      <>
        {blocks.map((block, index) => (
          <BlockNode
            key={block.id}
            block={block}
            pageId={pageId}
            list={list}
            index={index}
            selection={selection}
            locked
          />
        ))}
      </>
    );
  }

  return (
    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      {blocks.map((block, index) => (
        <BlockNode
          key={block.id}
          block={block}
          pageId={pageId}
          list={list}
          index={index}
          selection={selection}
          locked={false}
        />
      ))}
      <ListDropZone list={list} length={blocks.length} empty={blocks.length === 0} />
    </SortableContext>
  );
}

/** A single block: sortable wrapper (handle/delete) + its visual. */
function BlockNode({
  block,
  pageId,
  list,
  index,
  selection,
  locked,
}: {
  block: Block;
  pageId: string;
  list: ListLocation;
  index: number;
  selection: Selection | null;
  locked: boolean;
}) {
  const visual = (
    <BlockVisual block={block} pageId={pageId} selection={selection} locked={locked} />
  );

  // "Located" from the Layers panel — outline it, unless it's already the
  // selected block (which draws its own outline).
  const located = useEditorStore(
    (s) => s.highlightedBlockId === block.id && s.selection?.blockId !== block.id,
  );
  const locatedClass = located ? " is-located" : "";

  // Locked pages skip the sortable wrapper entirely (no drag handle / delete).
  if (locked) {
    return (
      <div className={`bo-editor-sortable${locatedClass}`} data-block-id={block.id}>
        {visual}
      </div>
    );
  }

  const selected = selection?.blockId === block.id && !selection?.cellId;
  return (
    <SortableBlock
      blockId={block.id}
      label={blockLabel(block)}
      blockType={block.type}
      list={list}
      index={index}
      selected={selected}
      located={located}
    >
      {visual}
    </SortableBlock>
  );
}

function BlockVisual({ block, pageId, selection, locked }: { block: Block } & VisualProps) {
  switch (block.type) {
    case "heading":
      return <HeadingBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "text":
      return <TextBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "table":
      return <TableBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "image":
      return <ImageBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "dynamic":
      return <DynamicBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "spacer":
      return <SpacerBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "divider":
      return <DividerBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "columns":
      return <ColumnsBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
    case "section":
      return <SectionBlockView block={block} pageId={pageId} selection={selection} locked={locked} />;
  }
}

/* ---------------- Shared selection helpers ---------------- */
function useBlockSelect(blockId: string, pageId: string, selection: Selection | null) {
  const select = useSelect();
  const selected = selection?.blockId === blockId && !selection?.cellId;
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    select({ pageId, blockId });
  };
  return { selected, onClick };
}

/* ---------------- Leaf views ---------------- */
function HeadingBlockView({ block, pageId, selection }: { block: HeadingBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  const setBlockText = useEditorStore((s) => s.setBlockText);
  return (
    <div
      className={`bo-editor-block${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={textStyleToCss(block.style)}
    >
      <InlineText
        value={block.text}
        placeholder="Heading"
        onChange={(v) => setBlockText(block.id, v)}
      />
    </div>
  );
}

function TextBlockView({ block, pageId, selection }: { block: TextBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  const setBlockText = useEditorStore((s) => s.setBlockText);
  return (
    <div
      className={`bo-editor-block${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={textStyleToCss(block.style)}
    >
      <InlineText
        value={block.text}
        placeholder="Add your text here."
        onChange={(v) => setBlockText(block.id, v)}
      />
    </div>
  );
}

function ImageBlockView({ block, pageId, selection }: { block: ImageBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  return (
    <div className={`bo-editor-block${selected ? " is-selected" : ""}`} onClick={onClick}>
      <img src={block.src} alt={block.alt} style={{ maxWidth: "100%", display: "block" }} />
    </div>
  );
}

function DynamicBlockView({ block, pageId, selection }: { block: DynamicBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  const listing = useEditorStore((s) => s.activeListing);
  const value = resolveField(block.dynamicKey, block.format, listing);
  return (
    <div
      className={`bo-editor-block bo-editor-dynamic${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={textStyleToCss(block.style)}
    >
      {value}
    </div>
  );
}

function SpacerBlockView({ block, pageId, selection }: { block: SpacerBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  return (
    <div
      className={`bo-editor-block bo-editor-spacer${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={{ height: block.height }}
    >
      {selected && <span className="bo-editor-spacer-label">Spacer · {block.height}px</span>}
    </div>
  );
}

function DividerBlockView({ block, pageId, selection }: { block: DividerBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  return (
    <div
      className={`bo-editor-block${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={{ padding: "4px 0" }}
    >
      <hr
        style={{
          margin: 0,
          border: 0,
          borderTop: `${block.thickness}px ${block.style === "none" ? "solid" : block.style} ${block.color}`,
        }}
      />
    </div>
  );
}

/* ---------------- Container views ---------------- */
function ColumnsBlockView({ block, pageId, selection, locked }: { block: ColumnsBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  return (
    <div
      className={`bo-editor-block bo-editor-columns${selected ? " is-selected" : ""}`}
      onClick={onClick}
    >
      {block.columns.map((col, ci) => (
        <div key={ci} className="bo-editor-column">
          <BlockList
            blocks={col}
            pageId={pageId}
            list={{ kind: "column", blockId: block.id, columnIndex: ci }}
            selection={selection}
            locked={locked}
          />
        </div>
      ))}
    </div>
  );
}

function SectionBlockView({ block, pageId, selection, locked }: { block: SectionBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  return (
    <div
      className={`bo-editor-block bo-editor-section${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={{ padding: block.padding, background: block.background ?? undefined }}
    >
      <BlockList
        blocks={block.blocks}
        pageId={pageId}
        list={{ kind: "section", blockId: block.id }}
        selection={selection}
        locked={locked}
      />
    </div>
  );
}

/* ---------------- Table (cells selectable, rows/cols editable) ---------------- */

// Handle bars sit flush on the table's outer border; insert dots float in the
// gutter just outside the table.
const HANDLE_THICK = 6;
const DOT_GUTTER = 12;
// A handle is a short bar centered on its column/row (not the full span), just
// big enough to click; capped so it never overflows a narrow column/row.
const HANDLE_LEN = 24;
// Row handles read as taller than column handles at the same length, so keep
// them shorter.
const ROW_HANDLE_LEN = 14;
// Minimum breathing room at each end so a capped handle keeps a clickable gap.
const HANDLE_GAP = 3;

function TableBlockView({ block, pageId, selection }: { block: TableBlock } & VisualProps) {
  const select = useSelect();
  const setCellValue = useEditorStore((s) => s.setCellValue);
  const listing = useEditorStore((s) => s.activeListing);
  const zoom = useEditorStore((s) => s.zoom);
  const selectedBlock = selection?.blockId === block.id && !selection?.cellId;
  const selectedHere = selection?.blockId === block.id;

  // Reset only applies once the table diverges from its template default.
  const templateTable = useEditorStore((s) => {
    const t = findBlock(s.templateDocument, block.id);
    return t && t.type === "table" ? t : null;
  });
  const isEdited = !!templateTable && JSON.stringify(templateTable) !== JSON.stringify(block);
  const showReset = selectedHere && isEdited;

  const border =
    block.style.borderWidth > 0 && block.style.borderStyle !== "none"
      ? `${block.style.borderWidth}px ${block.style.borderStyle} ${block.style.borderColor ?? "#d5dae2"}`
      : "1px solid #d5dae2";

  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [edges, setEdges] = useState<TableEdges>({ cols: [], rows: [], width: 0, height: 0 });
  const [hovered, setHovered] = useState(false);
  // Which handle the cursor is over — drives the column/row highlight.
  const [hoverHandle, setHoverHandle] = useState<HandleTarget | null>(null);
  // Which handle's action menu is open (only one at a time).
  const [openMenu, setOpenMenu] = useState<HandleTarget | null>(null);
  // Which column/row the cursor is over — only those handles are shown.
  const [hoverBand, setHoverBand] = useState<{
    col: number | null;
    row: number | null;
  } | null>(null);

  // Measure column/row boundaries relative to the wrap so the affordance
  // overlay lines up with the (auto-width) native table.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const table = tableRef.current;
    if (!wrap || !table) return;

    const measure = () => {
      const wrapBox = wrap.getBoundingClientRect();
      const trs = Array.from(table.querySelectorAll("tbody > tr"));
      const firstCells = trs[0] ? Array.from(trs[0].children) : [];

      const cols: number[] = [];
      firstCells.forEach((c, i) => {
        const box = c.getBoundingClientRect();
        if (i === 0) cols.push(box.left - wrapBox.left);
        cols.push(box.right - wrapBox.left);
      });

      const rows: number[] = [];
      trs.forEach((tr, i) => {
        const box = tr.getBoundingClientRect();
        if (i === 0) rows.push(box.top - wrapBox.top);
        rows.push(box.bottom - wrapBox.top);
      });

      const tableBox = table.getBoundingClientRect();
      setEdges({
        cols,
        rows,
        width: tableBox.width,
        height: tableBox.height,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(table);
    return () => ro.disconnect();
  }, [block.rows]);

  // Track which column/row band the cursor is over so only those handles show.
  const onMouseMove = (e: React.MouseEvent) => {
    if (edges.cols.length < 2 || edges.rows.length < 2) return;
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    const band = (vals: number[], p: number): number | null => {
      if (p < vals[0] || p >= vals[vals.length - 1]) return null;
      for (let i = 0; i < vals.length - 1; i += 1) {
        if (p < vals[i + 1]) return i;
      }
      return null;
    };
    const col = band(edges.cols, px);
    const row = band(edges.rows, py);
    setHoverBand(col === null && row === null ? null : { col, row });
  };

  // The reset control is portaled out of the overflow:hidden page so it can
  // float in the workspace margin; track the table's viewport position for it.
  const [resetAnchor, setResetAnchor] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!showReset) {
      setResetAnchor(null);
      return;
    }
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setResetAnchor({ left: r.left, top: r.top + r.height / 2 });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [showReset, zoom, edges.height]);

  // Keep the overlay mounted while a menu is open even if the pointer has left
  // the table — the menu portals to the body, so leaving fires mouseleave.
  const showOverlay = hovered || selectedHere || openMenu != null;
  const highlight = openMenu ?? hoverHandle;

  return (
    <div
      ref={wrapRef}
      className={`bo-editor-block bo-editor-table-wrap${selectedBlock ? " is-selected" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        select({ pageId, blockId: block.id });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setHoverHandle(null);
        setHoverBand(null);
      }}
      onMouseMove={onMouseMove}
      style={{ width: "100%" }}
    >
      <table ref={tableRef} style={{ width: "100%", borderCollapse: "collapse", border }}>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell) => (
                <CellView
                  key={cell.id}
                  cell={cell}
                  border={border}
                  selected={selection?.blockId === block.id && selection?.cellId === cell.id}
                  value={resolveDynamic(cell, listing)}
                  editable={!cell.dynamicKey}
                  onChange={(v) => setCellValue(block.id, cell.id, v)}
                  onSelect={(e) => {
                    e.stopPropagation();
                    select({ pageId, blockId: block.id, cellId: cell.id });
                  }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {showOverlay && (
        <TableEditOverlay
          blockId={block.id}
          edges={edges}
          colCount={block.rows[0]?.length ?? 0}
          rowCount={block.rows.length}
          highlight={highlight}
          hoverBand={hoverBand}
          setHoverHandle={setHoverHandle}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
        />
      )}

      {showReset && resetAnchor && <TableToolbar blockId={block.id} anchor={resetAnchor} />}
    </div>
  );
}

interface TableEdges {
  /** x-offsets of every column boundary (length colCount + 1), relative to wrap. */
  cols: number[];
  /** y-offsets of every row boundary (length rowCount + 1), relative to wrap. */
  rows: number[];
  width: number;
  height: number;
}

/** A column or row handle, identified by axis + index. */
interface HandleTarget {
  axis: "col" | "row";
  index: number;
}

/**
 * Affordances laid over the table: a column/row highlight, per-column and
 * per-row handles (each opens an actions menu), and boundary insert dots. The
 * container is pointer-events:none; only the controls are interactive.
 */
function TableEditOverlay({
  blockId,
  edges,
  colCount,
  rowCount,
  highlight,
  hoverBand,
  setHoverHandle,
  openMenu,
  setOpenMenu,
}: {
  blockId: string;
  edges: TableEdges;
  colCount: number;
  rowCount: number;
  highlight: HandleTarget | null;
  hoverBand: { col: number | null; row: number | null } | null;
  setHoverHandle: (h: HandleTarget | null) => void;
  openMenu: HandleTarget | null;
  setOpenMenu: (h: HandleTarget | null) => void;
}) {
  if (edges.cols.length < 2 || edges.rows.length < 2) return null;

  return (
    <div className="bo-editor-table-overlay">
      <ColumnRowHighlight edges={edges} target={highlight} />
      <ColumnHandles
        blockId={blockId}
        edges={edges}
        colCount={colCount}
        hoverCol={hoverBand?.col ?? null}
        setHoverHandle={setHoverHandle}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
      />
      <RowHandles
        blockId={blockId}
        edges={edges}
        rowCount={rowCount}
        hoverRow={hoverBand?.row ?? null}
        setHoverHandle={setHoverHandle}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
      />
      <InsertDots blockId={blockId} edges={edges} colCount={colCount} rowCount={rowCount} />
    </div>
  );
}

/** A translucent rectangle spanning the hovered/active column or row. */
function ColumnRowHighlight({ edges, target }: { edges: TableEdges; target: HandleTarget | null }) {
  if (!target) return null;
  if (target.axis === "col" && target.index + 1 >= edges.cols.length) return null;
  if (target.axis === "row" && target.index + 1 >= edges.rows.length) return null;

  const style: CSSProperties =
    target.axis === "col"
      ? {
          left: edges.cols[target.index],
          width: edges.cols[target.index + 1] - edges.cols[target.index],
          top: 0,
          height: edges.height,
        }
      : {
          top: edges.rows[target.index],
          height: edges.rows[target.index + 1] - edges.rows[target.index],
          left: 0,
          width: edges.width,
        };
  return <div className="bo-editor-table-highlight" style={style} />;
}

/** Column handles across the top edge; each opens an insert/delete menu. */
function ColumnHandles({
  blockId,
  edges,
  colCount,
  hoverCol,
  setHoverHandle,
  openMenu,
  setOpenMenu,
}: {
  blockId: string;
  edges: TableEdges;
  colCount: number;
  hoverCol: number | null;
  setHoverHandle: (h: HandleTarget | null) => void;
  openMenu: HandleTarget | null;
  setOpenMenu: (h: HandleTarget | null) => void;
}) {
  const addColumn = useEditorStore((s) => s.addColumn);
  const removeColumn = useEditorStore((s) => s.removeColumn);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {Array.from({ length: colCount }, (_, i) => {
        const isOpen = openMenu?.axis === "col" && openMenu.index === i;
        // Show only the hovered column's handle (or one with its menu open).
        if (hoverCol !== i && !isOpen) return null;
        const width = Math.min(HANDLE_LEN, edges.cols[i + 1] - edges.cols[i] - HANDLE_GAP * 2);
        const left = (edges.cols[i] + edges.cols[i + 1]) / 2 - width / 2;
        return (
          <DropdownMenu
            key={`ch-${i}`}
            open={isOpen}
            onOpenChange={(o) => setOpenMenu(o ? { axis: "col", index: i } : null)}
          >
            <DropdownMenu.Trigger
              render={
                <button
                  type="button"
                  className={`bo-editor-col-handle${isOpen ? " is-active" : ""}`}
                  aria-label={`Column ${i + 1} options`}
                  style={{ left, width, top: edges.rows[0] - HANDLE_THICK / 2, height: HANDLE_THICK }}
                  onClick={stop}
                  onMouseEnter={() => setHoverHandle({ axis: "col", index: i })}
                  onMouseLeave={() => setHoverHandle(null)}
                />
              }
            />
            <DropdownMenu.Content align="start" sideOffset={6}>
              <DropdownMenu.Item onClick={() => addColumn(blockId, i)}>
                <FontAwesomeIcon icon={faTableColumnsAddBefore} />
                Insert column left
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => addColumn(blockId, i + 1)}>
                <FontAwesomeIcon icon={faTableColumnsAddAfter} />
                Insert column right
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item disabled={colCount <= 1} onClick={() => removeColumn(blockId, i)}>
                <FontAwesomeIcon icon={faTrashCan} />
                Delete column
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        );
      })}
    </>
  );
}

/** Row handles down the left edge; each opens an insert/delete menu. */
function RowHandles({
  blockId,
  edges,
  rowCount,
  hoverRow,
  setHoverHandle,
  openMenu,
  setOpenMenu,
}: {
  blockId: string;
  edges: TableEdges;
  rowCount: number;
  hoverRow: number | null;
  setHoverHandle: (h: HandleTarget | null) => void;
  openMenu: HandleTarget | null;
  setOpenMenu: (h: HandleTarget | null) => void;
}) {
  const addRow = useEditorStore((s) => s.addRow);
  const removeRow = useEditorStore((s) => s.removeRow);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {Array.from({ length: rowCount }, (_, i) => {
        const isOpen = openMenu?.axis === "row" && openMenu.index === i;
        // Show only the hovered row's handle (or one with its menu open).
        if (hoverRow !== i && !isOpen) return null;
        const height = Math.min(ROW_HANDLE_LEN, edges.rows[i + 1] - edges.rows[i] - HANDLE_GAP * 2);
        const top = (edges.rows[i] + edges.rows[i + 1]) / 2 - height / 2;
        return (
          <DropdownMenu
            key={`rh-${i}`}
            open={isOpen}
            onOpenChange={(o) => setOpenMenu(o ? { axis: "row", index: i } : null)}
          >
            <DropdownMenu.Trigger
              render={
                <button
                  type="button"
                  className={`bo-editor-row-handle${isOpen ? " is-active" : ""}`}
                  aria-label={`Row ${i + 1} options`}
                  style={{ top, height, left: edges.cols[0] - HANDLE_THICK / 2, width: HANDLE_THICK }}
                  onClick={stop}
                  onMouseEnter={() => setHoverHandle({ axis: "row", index: i })}
                  onMouseLeave={() => setHoverHandle(null)}
                />
              }
            />
            <DropdownMenu.Content align="start" side="right" sideOffset={6}>
              <DropdownMenu.Item onClick={() => addRow(blockId, i)}>
                <FontAwesomeIcon icon={faTableRowsAddAbove} />
                Insert row above
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => addRow(blockId, i + 1)}>
                <FontAwesomeIcon icon={faTableRowsAddBelow} />
                Insert row below
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item disabled={rowCount <= 1} onClick={() => removeRow(blockId, i)}>
                <FontAwesomeIcon icon={faTrashCan} />
                Delete row
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        );
      })}
    </>
  );
}

/** Small dots at every boundary that grow into a "+" and insert a row/column. */
function InsertDots({
  blockId,
  edges,
  colCount,
  rowCount,
}: {
  blockId: string;
  edges: TableEdges;
  colCount: number;
  rowCount: number;
}) {
  const addColumn = useEditorStore((s) => s.addColumn);
  const addRow = useEditorStore((s) => s.addRow);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const colLabel = (i: number) =>
    `Insert column ${i === 0 ? "before first" : i === colCount ? "after last" : `at ${i}`}`;
  const rowLabel = (i: number) =>
    `Insert row ${i === 0 ? "before first" : i === rowCount ? "after last" : `at ${i}`}`;

  return (
    <>
      {edges.cols.map((x, i) => (
        <button
          key={`cd-${i}`}
          type="button"
          className="bo-editor-insert-dot"
          aria-label={colLabel(i)}
          style={{ left: x, top: edges.rows[0] - DOT_GUTTER }}
          onClick={(e) => {
            stop(e);
            addColumn(blockId, i);
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      ))}
      {edges.rows.map((y, i) => (
        <button
          key={`rd-${i}`}
          type="button"
          className="bo-editor-insert-dot"
          aria-label={rowLabel(i)}
          style={{ top: y, left: edges.cols[0] - DOT_GUTTER }}
          onClick={(e) => {
            stop(e);
            addRow(blockId, i);
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
      ))}
    </>
  );
}

/**
 * Reset-to-template control, floating just left of a selected (and edited)
 * table. Portaled to the body with fixed positioning so it isn't clipped by the
 * overflow:hidden page; the anchor is the table's viewport-space left edge.
 * These tables are template-fixed, so reset is the only action (rows & columns
 * are still added/removed via the handles).
 */
function TableToolbar({
  blockId,
  anchor,
}: {
  blockId: string;
  anchor: { left: number; top: number };
}) {
  const resetTable = useEditorStore((s) => s.resetTable);

  return createPortal(
    <div
      className="bo-editor-table-reset"
      style={{ left: anchor.left - 12, top: anchor.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reset table"
              onClick={() => resetTable(blockId)}
            >
              <FontAwesomeIcon icon={faArrowRotateLeft} />
            </Button>
          }
        />
        <Tooltip.Content side="left">Reset table</Tooltip.Content>
      </Tooltip>
    </div>,
    document.body,
  );
}

function CellView({
  cell,
  border,
  selected,
  value,
  editable,
  onChange,
  onSelect,
}: {
  cell: Cell;
  border: string;
  selected: boolean;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const bottom =
    cell.style.borderBottomWidth > 0 && cell.style.borderBottomStyle !== "none"
      ? `${cell.style.borderBottomWidth}px ${cell.style.borderBottomStyle} ${cell.style.borderBottomColor ?? "#d5dae2"}`
      : undefined;

  const placeholder = cell.header ? "Label" : "Value";

  return (
    <td
      className={`bo-editor-cell${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      style={{
        border,
        borderBottom: bottom ?? border,
        background: cell.header ? "#eceef2" : cell.style.background ?? "#fff",
        padding: "8px 12px",
        fontSize: cell.style.fontSize,
        fontWeight: cell.header || cell.style.bold ? 600 : 400,
        fontStyle: cell.style.italic ? "italic" : "normal",
        textDecoration: cell.style.underline ? "underline" : "none",
        textAlign: cell.align ?? "left",
        color: cell.style.color ?? "#22262f",
        textTransform: cell.style.transform === "none" ? undefined : cell.style.transform,
      }}
    >
      {editable ? (
        <EditableCellText value={value} placeholder={placeholder} onChange={onChange} />
      ) : value === "" ? (
        <span className="bo-editor-cell-placeholder">{placeholder}</span>
      ) : (
        value
      )}
    </td>
  );
}

/**
 * Inline-editable text. The DOM is the source of truth while typing; we only
 * rewrite it when the external value diverges, so committing an edit never
 * resets the caret. A CSS placeholder shows when empty. Used by heading/text
 * blocks and (via EditableCellText) table cells — content editing that stays
 * available even on locked preset pages.
 */
function InlineText({
  value,
  placeholder,
  onChange,
  className = "bo-editor-inline-text",
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);

  return (
    <div
      ref={ref}
      className={`${className}${value === "" ? " is-empty" : ""}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      data-placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        // Enter commits and exits rather than inserting a newline.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** Inline-editable table cell text — InlineText styled for the cell context. */
function EditableCellText({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <InlineText
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      className="bo-editor-cell-edit"
    />
  );
}
