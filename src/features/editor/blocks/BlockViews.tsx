import type { CSSProperties } from "react";
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

/* ---------------- Table (cells selectable) ---------------- */
function TableBlockView({ block, pageId, selection }: { block: TableBlock } & VisualProps) {
  const select = useSelect();
  const listing = useEditorStore((s) => s.activeListing);
  const selectedBlock = selection?.blockId === block.id && !selection?.cellId;

  const border =
    block.style.borderWidth > 0 && block.style.borderStyle !== "none"
      ? `${block.style.borderWidth}px ${block.style.borderStyle} ${block.style.borderColor ?? "#d5dae2"}`
      : "1px solid #d5dae2";

  return (
    <div
      className={`bo-editor-block${selectedBlock ? " is-selected" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        select({ pageId, blockId: block.id });
      }}
      style={{ width: "100%" }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", border }}>
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
      {value}
    </td>
  );
}
