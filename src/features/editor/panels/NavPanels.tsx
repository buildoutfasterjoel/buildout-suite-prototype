import { useMemo, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useDraggable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  faFileLines,
  faPlus,
  faGripDotsVertical,
  faLock,
  faTableLayout,
  faPencil,
  faTrashCan,
  faMagnifyingGlass,
  faBolt,
} from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { List } from "@buildoutinc/blueprint-react/ui/List";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { useEditorStore } from "../store";
import type { Block, ContentBlock, Page } from "../types";
import { BLOCK_ICONS, blockLabel } from "../blocks/blockMeta";
import type { BlockVariant } from "../blocks/blockFactory";
import { PRESETS } from "../presets";
import { pageHasDynamicContent } from "../tree";

function PanelHeading({ children }: { children: string }) {
  return <span className="bo-editor-section-title">{children}</span>;
}

/* ---------------- Pages ---------------- */

/** A row in the flattened Pages list — either a group header or a page. */
type PageRow =
  | { kind: "header"; index: number; label: string }
  | { kind: "page"; index: number; page: Page };

/** Flatten pages into numbered rows, inserting a header row wherever a page starts a new group. */
function buildPageRows(pages: Page[]): PageRow[] {
  const rows: PageRow[] = [];
  let index = 0;
  for (const page of pages) {
    if (page.section) {
      rows.push({ kind: "header", index: (index += 1), label: page.section });
    }
    rows.push({ kind: "page", index: (index += 1), page });
  }
  return rows;
}

/** Filter rows by search query, keeping a header only if a matching page follows it. */
function filterPageRows(rows: PageRow[], query: string): PageRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  const result: PageRow[] = [];
  let pendingHeader: PageRow | null = null;
  for (const row of rows) {
    if (row.kind === "header") {
      pendingHeader = row;
      continue;
    }
    if (row.page.name.toLowerCase().includes(q)) {
      if (pendingHeader) result.push(pendingHeader);
      pendingHeader = null;
      result.push(row);
    }
  }
  return result;
}

export function PagesPanel() {
  const pages = useEditorStore((s) => s.document.pages);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const addPage = useEditorStore((s) => s.addPage);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => filterPageRows(buildPageRows(pages), search), [pages, search]);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="bo-editor-pages-search d-flex flex-column gap-2">
        <PanelHeading>Pages</PanelHeading>
        <InputGroup>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </InputGroup.Addon>
          <Input
            type="search"
            placeholder="Search for a page"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
      </div>

      <List flush>
        {rows.map((row) =>
          row.kind === "header" ? (
            <List.Item key={`section-${row.index}`} className="bo-editor-pages-header-row">
              <span className="bo-editor-pages-row-index">{row.index}</span>
              <span className="bo-editor-pages-header-label">{row.label}</span>
            </List.Item>
          ) : (
            <List.Item
              key={row.page.id}
              asAction
              active={selection?.pageId === row.page.id && !selection?.blockId}
              role="button"
              tabIndex={0}
              className="bo-editor-pages-row"
              onClick={() => select({ pageId: row.page.id })}
            >
              <span className="bo-editor-pages-row-index">{row.index}</span>
              <span className="bo-editor-pages-row-name text-truncate">{row.page.name}</span>
              {pageHasDynamicContent(row.page) && (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <span
                        className="bo-editor-pages-bolt d-flex align-items-center flex-shrink-0"
                        aria-label="Contains dynamic listing data"
                      >
                        <FontAwesomeIcon icon={faBolt} />
                      </span>
                    }
                  />
                  <Tooltip.Content side="left">Contains dynamic listing data</Tooltip.Content>
                </Tooltip>
              )}
            </List.Item>
          ),
        )}
      </List>

      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button variant="secondary" className="w-100">
              <FontAwesomeIcon icon={faPlus} />
              Add Page
            </Button>
          }
        />
        <DropdownMenu.Content align="start" sideOffset={6}>
          <DropdownMenu.Item onClick={() => addPage("blank")}>
            <FontAwesomeIcon icon={faFileLines} />
            Blank page
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel>Presets</DropdownMenu.GroupLabel>
            {PRESETS.map((preset) => (
              <DropdownMenu.Item
                key={preset.key}
                onClick={() => addPage(preset.key)}
              >
                <FontAwesomeIcon icon={faTableLayout} />
                {preset.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}

/* ---------------- Layers ---------------- */

/** One-level nesting: a container's indented children (empty for leaf blocks). */
function layerChildren(block: Block): ContentBlock[] {
  return block.type === "section"
    ? block.blocks
    : block.type === "columns"
      ? block.columns.flat()
      : [];
}

/**
 * The shared row visual. Clicking the body *locates* the block (highlight +
 * scroll) and keeps the Layers list open; the pencil opens content editing.
 * Locked rows show a "Fixed" badge and no delete; freeform rows get a delete
 * button (and, when top-level, a drag grip passed in as `dragHandle`).
 */
function LayerRowBody({
  block,
  pageId,
  depth,
  locked,
  dragHandle,
}: {
  block: Block;
  pageId: string;
  depth: number;
  locked: boolean;
  dragHandle?: ReactNode;
}) {
  const located = useEditorStore((s) => s.highlightedBlockId === block.id);
  const highlightBlock = useEditorStore((s) => s.highlightBlock);
  const select = useEditorStore((s) => s.select);
  const removeBlock = useEditorStore((s) => s.removeBlock);

  return (
    <div
      role="button"
      tabIndex={0}
      className="bo-editor-layer-row d-flex align-items-center gap-2 p-2"
      style={{
        border: "1px solid",
        borderColor: located ? "#7422ce" : "transparent",
        borderRadius: 6,
        background: located ? "#f9f5ff" : "transparent",
        cursor: "pointer",
        marginLeft: depth * 16,
      }}
      onClick={() => highlightBlock(block.id)}
    >
      {dragHandle}
      <FontAwesomeIcon
        icon={BLOCK_ICONS[block.type]}
        style={{ color: "#506079" }}
      />
      <span className="text-truncate flex-grow-1" style={{ fontSize: 14 }}>
        {blockLabel(block)}
      </span>

      {locked && (
        <Badge variant="secondary" appearance="muted" className="flex-shrink-0">
          Fixed
        </Badge>
      )}

      <Tooltip>
        <Tooltip.Trigger
          render={
            <button
              type="button"
              className="bo-editor-layer-action"
              aria-label="Edit content"
              onClick={(e) => {
                e.stopPropagation();
                highlightBlock(block.id);
                select({ pageId, blockId: block.id });
              }}
            >
              <FontAwesomeIcon icon={faPencil} />
            </button>
          }
        />
        <Tooltip.Content>Edit content</Tooltip.Content>
      </Tooltip>

      {!locked && (
        <button
          type="button"
          className="bo-editor-layer-action bo-editor-layer-action-danger"
          aria-label={`Delete ${block.type}`}
          onClick={(e) => {
            e.stopPropagation();
            removeBlock(block.id);
          }}
        >
          <FontAwesomeIcon icon={faTrashCan} />
        </button>
      )}
    </div>
  );
}

/** Static (non-draggable) row + recursion — locked pages and nested children. */
function StaticLayerRow({
  block,
  pageId,
  depth,
  locked,
}: {
  block: Block;
  pageId: string;
  depth: number;
  locked: boolean;
}) {
  return (
    <>
      <LayerRowBody
        block={block}
        pageId={pageId}
        depth={depth}
        locked={locked}
      />
      {layerChildren(block).map((child) => (
        <StaticLayerRow
          key={child.id}
          block={child}
          pageId={pageId}
          depth={depth + 1}
          locked={locked}
        />
      ))}
    </>
  );
}

/**
 * Freeform top-level row: draggable to reorder within its page. Nested children
 * render as static rows (drag reorder is scoped to top-level blocks).
 */
function SortableLayerRow({
  block,
  pageId,
  index,
}: {
  block: Block;
  pageId: string;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `layer:${block.id}`,
    data: {
      source: "layer",
      blockId: block.id,
      pageId,
      index,
      blockType: block.type,
      label: blockLabel(block),
    },
  });

  const grip = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className="bo-editor-layer-grip"
      aria-label="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <FontAwesomeIcon icon={faGripDotsVertical} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <LayerRowBody
        block={block}
        pageId={pageId}
        depth={0}
        locked={false}
        dragHandle={grip}
      />
      {layerChildren(block).map((child) => (
        <StaticLayerRow
          key={child.id}
          block={child}
          pageId={pageId}
          depth={1}
          locked={false}
        />
      ))}
    </div>
  );
}

/** One page's block tree — the list body under the page picker. */
function PageLayers({ page }: { page: Page }) {
  return (
    <div className="d-flex flex-column gap-1">
      {page.locked ? (
        page.blocks.map((block) => (
          <StaticLayerRow
            key={block.id}
            block={block}
            pageId={page.id}
            depth={0}
            locked
          />
        ))
      ) : (
        <SortableContext
          items={page.blocks.map((b) => `layer:${b.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {page.blocks.map((block, i) => (
            <SortableLayerRow
              key={block.id}
              block={block}
              pageId={page.id}
              index={i}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export function LayersPanel() {
  const pages = useEditorStore((s) => s.document.pages);
  // Layers are scoped to a single page — documents can have dozens of pages, so
  // a picker keeps the list manageable. The scope follows the page in view on
  // the canvas (`activePageId`, updated as the user scrolls); picking a page
  // here scrolls the canvas to it.
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePageId = useEditorStore((s) => s.setActivePageId);
  const page = pages.find((p) => p.id === activePageId) ?? pages[0];

  const goToPage = (id: string) => {
    setActivePageId(id);
    document
      .querySelector(`[data-page-id="${id}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <PanelHeading>Layers</PanelHeading>

      <Select value={page?.id} onValueChange={(v) => v && goToPage(v)}>
        <Select.Trigger className="w-100">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {pages.map((p, i) => (
            <Select.Item key={p.id} value={p.id}>
              {i + 1}. {p.name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {page?.locked && (
        <span
          className="d-flex align-items-center gap-2 fs-small"
          style={{ color: "#506079" }}
        >
          <FontAwesomeIcon icon={faLock} />
          Fixed layout — content editable
        </span>
      )}

      {page && <PageLayers page={page} />}
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
  {
    type: "heading",
    icon: BLOCK_ICONS.heading,
    label: "Heading",
    desc: "Section title",
  },
  {
    type: "text",
    icon: BLOCK_ICONS.text,
    label: "Text",
    desc: "Paragraph copy",
  },
  {
    type: "table",
    icon: BLOCK_ICONS.table,
    label: "Table",
    desc: "Rows & columns",
  },
  {
    type: "image",
    icon: BLOCK_ICONS.image,
    label: "Image",
    desc: "Photo or logo",
  },
  {
    type: "dynamic",
    icon: BLOCK_ICONS.dynamic,
    label: "Dynamic Field",
    desc: "Deal data token",
  },
];

const LAYOUT_BLOCKS: PaletteEntry[] = [
  {
    type: "columns",
    variant: { columnCount: 2 },
    icon: BLOCK_ICONS.columns,
    label: "2 Columns",
    desc: "Two side-by-side drop zones",
  },
  {
    type: "columns",
    variant: { columnCount: 3 },
    icon: BLOCK_ICONS.columns,
    label: "3 Columns",
    desc: "Three side-by-side drop zones",
  },
  {
    type: "section",
    icon: BLOCK_ICONS.section,
    label: "Section",
    desc: "Padded container",
  },
  {
    type: "spacer",
    icon: BLOCK_ICONS.spacer,
    label: "Spacer",
    desc: "Vertical gap",
  },
  {
    type: "divider",
    icon: BLOCK_ICONS.divider,
    label: "Divider",
    desc: "Horizontal rule",
  },
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
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: "#f9f5ff",
          color: "#7422ce",
        }}
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
