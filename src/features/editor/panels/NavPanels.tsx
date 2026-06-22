import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useDraggable } from "@dnd-kit/core";
import {
  faFileLines,
  faPlus,
  faGripDotsVertical,
} from "@fortawesome/pro-regular-svg-icons";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { useEditorStore } from "../store";
import type { Block, ContentBlock } from "../types";
import { BLOCK_ICONS, blockLabel } from "../blocks/blockMeta";
import type { BlockVariant } from "../blocks/blockFactory";

function PanelHeading({ children }: { children: string }) {
  return <span className="bo-editor-section-title">{children}</span>;
}

/* ---------------- Pages ---------------- */
export function PagesPanel() {
  const pages = useEditorStore((s) => s.document.pages);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);

  return (
    <div className="d-flex flex-column gap-3">
      <PanelHeading>Pages</PanelHeading>
      <div className="d-flex flex-column gap-2">
        {pages.map((page, i) => {
          const active = selection?.pageId === page.id && !selection?.blockId;
          return (
            <button
              key={page.id}
              type="button"
              className="d-flex align-items-center gap-3 p-2 text-start"
              style={{
                border: `1px solid ${active ? "#7422ce" : "#d5dae2"}`,
                borderRadius: 6,
                background: active ? "#f9f5ff" : "#fff",
                cursor: "pointer",
              }}
              onClick={() => select({ pageId: page.id })}
            >
              <span
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: 34,
                  height: 44,
                  background: "#fff",
                  border: "1px solid #d5dae2",
                  borderRadius: 3,
                  color: "#506079",
                }}
              >
                <FontAwesomeIcon icon={faFileLines} />
              </span>
              <span className="d-flex flex-column">
                <span className="fw-semibold" style={{ fontSize: 14 }}>
                  {i + 1}. {page.name}
                </span>
                <span className="fs-small" style={{ color: "#506079" }}>
                  {page.blocks.length} blocks
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <AddButton label="Add Page" />
    </div>
  );
}

/* ---------------- Layers ---------------- */
function LayerRow({
  block,
  pageId,
  depth,
}: {
  block: Block;
  pageId: string;
  depth: number;
}) {
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const active = selection?.blockId === block.id && !selection?.cellId;

  // One-level nesting: gather a container's children to render indented.
  const children: ContentBlock[] =
    block.type === "section"
      ? block.blocks
      : block.type === "columns"
        ? block.columns.flat()
        : [];

  return (
    <>
      <button
        type="button"
        className="d-flex align-items-center gap-2 p-2 text-start"
        style={{
          border: "1px solid",
          borderColor: active ? "#7422ce" : "transparent",
          borderRadius: 6,
          background: active ? "#f9f5ff" : "transparent",
          cursor: "pointer",
          marginLeft: depth * 16,
        }}
        onClick={() => select({ pageId, blockId: block.id })}
      >
        <FontAwesomeIcon icon={faGripDotsVertical} style={{ color: "#94a3b8" }} />
        <FontAwesomeIcon icon={BLOCK_ICONS[block.type]} style={{ color: "#506079" }} />
        <span className="text-truncate" style={{ fontSize: 14 }}>
          {blockLabel(block)}
        </span>
      </button>
      {children.map((child) => (
        <LayerRow key={child.id} block={child} pageId={pageId} depth={depth + 1} />
      ))}
    </>
  );
}

export function LayersPanel() {
  const pages = useEditorStore((s) => s.document.pages);
  const selection = useEditorStore((s) => s.selection);

  const activePageId = selection?.pageId ?? pages[0]?.id;
  const page = pages.find((p) => p.id === activePageId) ?? pages[0];

  return (
    <div className="d-flex flex-column gap-3">
      <PanelHeading>Layers</PanelHeading>
      <span className="fs-small" style={{ color: "#506079" }}>
        {page?.name}
      </span>
      <div className="d-flex flex-column gap-1">
        {page?.blocks.map((block) => (
          <LayerRow key={block.id} block={block} pageId={page.id} depth={0} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Blocks palette ---------------- */
interface PaletteEntry {
  type: Block["type"];
  variant?: BlockVariant;
  icon: IconDefinition;
  label: string;
  desc: string;
}

const CONTENT_BLOCKS: PaletteEntry[] = [
  { type: "heading", icon: BLOCK_ICONS.heading, label: "Heading", desc: "Section title" },
  { type: "text", icon: BLOCK_ICONS.text, label: "Text", desc: "Paragraph copy" },
  { type: "table", icon: BLOCK_ICONS.table, label: "Table", desc: "Rows & columns" },
  { type: "image", icon: BLOCK_ICONS.image, label: "Image", desc: "Photo or logo" },
  { type: "dynamic", icon: BLOCK_ICONS.dynamic, label: "Dynamic Field", desc: "Listing data token" },
];

const LAYOUT_BLOCKS: PaletteEntry[] = [
  { type: "columns", variant: { columnCount: 2 }, icon: BLOCK_ICONS.columns, label: "2 Columns", desc: "Two side-by-side drop zones" },
  { type: "columns", variant: { columnCount: 3 }, icon: BLOCK_ICONS.columns, label: "3 Columns", desc: "Three side-by-side drop zones" },
  { type: "section", icon: BLOCK_ICONS.section, label: "Section", desc: "Padded container" },
  { type: "spacer", icon: BLOCK_ICONS.spacer, label: "Spacer", desc: "Vertical gap" },
  { type: "divider", icon: BLOCK_ICONS.divider, label: "Divider", desc: "Horizontal rule" },
];

function paletteId(entry: PaletteEntry): string {
  return `palette:${entry.type}${entry.variant?.columnCount ? `:${entry.variant.columnCount}` : ""}`;
}

function PaletteItem({ entry }: { entry: PaletteEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteId(entry),
    data: {
      source: "palette",
      blockType: entry.type,
      variant: entry.variant,
      label: entry.label,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="bo-editor-palette-item d-flex align-items-center gap-3 p-2"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      <span
        className="d-flex align-items-center justify-content-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: 6, background: "#f9f5ff", color: "#7422ce" }}
      >
        <FontAwesomeIcon icon={entry.icon} />
      </span>
      <span className="d-flex flex-column">
        <span className="fw-semibold" style={{ fontSize: 14 }}>
          {entry.label}
        </span>
        <span className="fs-small" style={{ color: "#506079" }}>
          {entry.desc}
        </span>
      </span>
    </div>
  );
}

export function BlocksPanel() {
  return (
    <div className="d-flex flex-column gap-3">
      <PanelHeading>Blocks</PanelHeading>
      <span className="fs-small" style={{ color: "#506079" }}>
        Drag a block onto the page to add it.
      </span>

      <span className="bo-editor-subsection-title">Content</span>
      <div className="d-flex flex-column gap-2">
        {CONTENT_BLOCKS.map((b) => (
          <PaletteItem key={paletteId(b)} entry={b} />
        ))}
      </div>

      <span className="bo-editor-subsection-title">Layout</span>
      <div className="d-flex flex-column gap-2">
        {LAYOUT_BLOCKS.map((b) => (
          <PaletteItem key={paletteId(b)} entry={b} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Images ---------------- */
export function ImagesPanel() {
  return (
    <div className="d-flex flex-column gap-3">
      <PanelHeading>Images</PanelHeading>
      <div className="d-flex flex-wrap" style={{ gap: 8 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <img
            key={i}
            src={`https://picsum.photos/seed/editor-${i}/120/120`}
            alt=""
            style={{
              width: 78,
              height: 78,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid #d5dae2",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <AddButton label="Upload Image" />
    </div>
  );
}

/* ---------------- Settings ---------------- */
export function SettingsPanel() {
  const docName = useEditorStore((s) => s.document.name);
  return (
    <div className="d-flex flex-column gap-3">
      <PanelHeading>Document Settings</PanelHeading>
      <div className="d-flex flex-column gap-2">
        <span className="fs-small" style={{ color: "#506079" }}>
          Document Name
        </span>
        <Input defaultValue={docName} readOnly />
      </div>
      <div className="d-flex flex-column gap-2">
        <span className="fs-small" style={{ color: "#506079" }}>
          Page Size
        </span>
        <Input defaultValue="US Letter (8.5 × 11 in)" readOnly />
      </div>
      <div className="d-flex flex-column gap-2">
        <span className="fs-small" style={{ color: "#506079" }}>
          Orientation
        </span>
        <Input defaultValue="Portrait" readOnly />
      </div>
    </div>
  );
}

function AddButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="d-flex align-items-center justify-content-center gap-2 p-2"
      style={{
        border: "1px dashed #d5dae2",
        borderRadius: 6,
        background: "#fff",
        color: "#7422ce",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <FontAwesomeIcon icon={faPlus} />
      {label}
    </button>
  );
}
