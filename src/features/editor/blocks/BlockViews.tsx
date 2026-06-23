import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus, faXmark } from "@fortawesome/pro-regular-svg-icons";
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
}: {
  blocks: ContentBlock[] | Block[];
  pageId: string;
  list: ListLocation;
  selection: Selection | null;
}) {
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
}: {
  block: Block;
  pageId: string;
  list: ListLocation;
  index: number;
  selection: Selection | null;
}) {
  const selected = selection?.blockId === block.id && !selection?.cellId;
  return (
    <SortableBlock
      blockId={block.id}
      label={blockLabel(block)}
      blockType={block.type}
      list={list}
      index={index}
      selected={selected}
    >
      <BlockVisual block={block} pageId={pageId} selection={selection} />
    </SortableBlock>
  );
}

function BlockVisual({ block, pageId, selection }: { block: Block } & VisualProps) {
  switch (block.type) {
    case "heading":
      return <HeadingBlockView block={block} pageId={pageId} selection={selection} />;
    case "text":
      return <TextBlockView block={block} pageId={pageId} selection={selection} />;
    case "table":
      return <TableBlockView block={block} pageId={pageId} selection={selection} />;
    case "image":
      return <ImageBlockView block={block} pageId={pageId} selection={selection} />;
    case "dynamic":
      return <DynamicBlockView block={block} pageId={pageId} selection={selection} />;
    case "spacer":
      return <SpacerBlockView block={block} pageId={pageId} selection={selection} />;
    case "divider":
      return <DividerBlockView block={block} pageId={pageId} selection={selection} />;
    case "columns":
      return <ColumnsBlockView block={block} pageId={pageId} selection={selection} />;
    case "section":
      return <SectionBlockView block={block} pageId={pageId} selection={selection} />;
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
  return (
    <div
      className={`bo-editor-block${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={textStyleToCss(block.style)}
    >
      {block.text}
    </div>
  );
}

function TextBlockView({ block, pageId, selection }: { block: TextBlock } & VisualProps) {
  const { selected, onClick } = useBlockSelect(block.id, pageId, selection);
  return (
    <div
      className={`bo-editor-block${selected ? " is-selected" : ""}`}
      onClick={onClick}
      style={textStyleToCss(block.style)}
    >
      {block.text}
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
function ColumnsBlockView({ block, pageId, selection }: { block: ColumnsBlock } & VisualProps) {
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
          />
        </div>
      ))}
    </div>
  );
}

function SectionBlockView({ block, pageId, selection }: { block: SectionBlock } & VisualProps) {
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
      />
    </div>
  );
}

/* ---------------- Table (cells selectable, rows/cols editable) ---------------- */
function TableBlockView({ block, pageId, selection }: { block: TableBlock } & VisualProps) {
  const select = useSelect();
  const listing = useEditorStore((s) => s.activeListing);
  const selectedBlock = selection?.blockId === block.id && !selection?.cellId;
  const selectedHere = selection?.blockId === block.id;

  const border =
    block.style.borderWidth > 0 && block.style.borderStyle !== "none"
      ? `${block.style.borderWidth}px ${block.style.borderStyle} ${block.style.borderColor ?? "#d5dae2"}`
      : "1px solid #d5dae2";

  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [edges, setEdges] = useState<TableEdges>({ cols: [], rows: [], width: 0, height: 0 });
  const [hovered, setHovered] = useState(false);
  // The single boundary the cursor is hovering near — the gap between two
  // columns or two rows. Null when the cursor isn't near any gap.
  const [active, setActive] = useState<ActiveInsert | null>(null);

  // Reveal an insert bar only when the cursor is near a boundary; pick whichever
  // gap (column or row) is closer.
  const onMouseMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || edges.cols.length < 2 || edges.rows.length < 2) return;
    const box = wrap.getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    const THRESHOLD = 10;

    const nearest = (vals: number[], p: number) => {
      let index = 0;
      let dist = Infinity;
      vals.forEach((v, i) => {
        const d = Math.abs(p - v);
        if (d < dist) {
          dist = d;
          index = i;
        }
      });
      return { index, dist };
    };

    const col = nearest(edges.cols, px);
    const row = nearest(edges.rows, py);

    if (col.dist <= THRESHOLD && col.dist <= row.dist) {
      setActive({ axis: "col", index: col.index });
    } else if (row.dist <= THRESHOLD) {
      setActive({ axis: "row", index: row.index });
    } else {
      setActive(null);
    }
  };

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
        setActive(null);
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

      {(hovered || selectedHere) && (
        <TableEditOverlay
          blockId={block.id}
          edges={edges}
          active={active}
          colCount={block.rows[0]?.length ?? 0}
          rowCount={block.rows.length}
        />
      )}
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

/** The single boundary the cursor is hovering near. */
interface ActiveInsert {
  axis: "col" | "row";
  index: number;
}

/**
 * Hover affordances laid over the table: insert lines + "+" buttons in the gaps
 * between/around rows and columns, and remove handles per row/column. Pointer
 * events pass through the container; only the controls are interactive.
 */
function TableEditOverlay({
  blockId,
  edges,
  active,
  colCount,
  rowCount,
}: {
  blockId: string;
  edges: TableEdges;
  active: ActiveInsert | null;
  colCount: number;
  rowCount: number;
}) {
  const addColumn = useEditorStore((s) => s.addColumn);
  const removeColumn = useEditorStore((s) => s.removeColumn);
  const addRow = useEditorStore((s) => s.addRow);
  const removeRow = useEditorStore((s) => s.removeRow);

  if (edges.cols.length < 2 || edges.rows.length < 2) return null;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // One insert affordance — the gap the cursor is hovering: a full-table bar at
  // that boundary with a floating "+" outside the table. Bar and button insert.
  let insert = null;
  if (active?.axis === "col") {
    const label = `Insert column ${active.index === 0 ? "before first" : active.index === colCount ? "after last" : `at ${active.index}`}`;
    const onInsert = (e: React.MouseEvent) => {
      stop(e);
      addColumn(blockId, active.index);
    };
    insert = (
      <div className="bo-editor-insert bo-editor-insert--col" style={{ left: edges.cols[active.index] }}>
        <button type="button" className="bo-editor-insert-bar" aria-label={label} onClick={onInsert} />
        <button type="button" className="bo-editor-insert-btn" aria-label={label} onClick={onInsert}>
          <FontAwesomeIcon icon={faCirclePlus} />
        </button>
      </div>
    );
  } else if (active?.axis === "row") {
    const label = `Insert row ${active.index === 0 ? "before first" : active.index === rowCount ? "after last" : `at ${active.index}`}`;
    const onInsert = (e: React.MouseEvent) => {
      stop(e);
      addRow(blockId, active.index);
    };
    insert = (
      <div className="bo-editor-insert bo-editor-insert--row" style={{ top: edges.rows[active.index] }}>
        <button type="button" className="bo-editor-insert-bar" aria-label={label} onClick={onInsert} />
        <button type="button" className="bo-editor-insert-btn" aria-label={label} onClick={onInsert}>
          <FontAwesomeIcon icon={faCirclePlus} />
        </button>
      </div>
    );
  }

  return (
    <div className="bo-editor-table-overlay">
      {insert}

      {/* Column remove handles (top gutter) — hidden when only one column. */}
      {colCount > 1 &&
        Array.from({ length: colCount }, (_, i) => {
          const left = edges.cols[i];
          const width = edges.cols[i + 1] - edges.cols[i];
          return (
            <Tooltip key={`cr-${i}`}>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    className="bo-editor-col-remove"
                    aria-label="Remove column"
                    style={{ left, width }}
                    onClick={(e) => {
                      stop(e);
                      removeColumn(blockId, i);
                    }}
                  >
                    <span className="bo-editor-remove-handle">
                      <FontAwesomeIcon icon={faXmark} />
                    </span>
                  </button>
                }
              />
              <Tooltip.Content>Remove column</Tooltip.Content>
            </Tooltip>
          );
        })}

      {/* Row remove handles (left gutter) — hidden when only one row. */}
      {rowCount > 1 &&
        Array.from({ length: rowCount }, (_, i) => {
          const top = edges.rows[i];
          const height = edges.rows[i + 1] - edges.rows[i];
          return (
            <Tooltip key={`rr-${i}`}>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    className="bo-editor-row-remove"
                    aria-label="Remove row"
                    style={{ top, height }}
                    onClick={(e) => {
                      stop(e);
                      removeRow(blockId, i);
                    }}
                  >
                    <span className="bo-editor-remove-handle">
                      <FontAwesomeIcon icon={faXmark} />
                    </span>
                  </button>
                }
              />
              <Tooltip.Content>Remove row</Tooltip.Content>
            </Tooltip>
          );
        })}
    </div>
  );
}

function CellView({
  cell,
  border,
  selected,
  value,
  onSelect,
}: {
  cell: Cell;
  border: string;
  selected: boolean;
  value: string;
  onSelect: (e: React.MouseEvent) => void;
}) {
  const bottom =
    cell.style.borderBottomWidth > 0 && cell.style.borderBottomStyle !== "none"
      ? `${cell.style.borderBottomWidth}px ${cell.style.borderBottomStyle} ${cell.style.borderBottomColor ?? "#d5dae2"}`
      : undefined;

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
      {value === "" ? (
        <span className="bo-editor-cell-placeholder">{cell.header ? "Label" : "Value"}</span>
      ) : (
        value
      )}
    </td>
  );
}
