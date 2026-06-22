import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSign,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faCircleCheck,
  faArrowRotateLeft,
  faArrowRotateRight,
  faCaretDown,
} from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { useEditorStore, useSelectedEntities } from "./store";

function blockCrumb(block: ReturnType<typeof useSelectedEntities>["block"]): string | null {
  if (!block) return null;
  switch (block.type) {
    case "heading":
      return "Heading";
    case "text":
      return "Text";
    case "table":
      return block.title || "Table";
    case "image":
      return "Image";
    case "dynamic":
      return "Dynamic Field";
    case "columns":
      return `${block.columnCount} Columns`;
    case "section":
      return "Section";
    case "spacer":
      return "Spacer";
    case "divider":
      return "Divider";
  }
}

/** Top canvas bar: breadcrumb trail, zoom, save status, undo/redo, actions. */
export function CanvasActions({
  listingId,
  onExport,
}: {
  listingId: string;
  onExport: () => void;
}) {
  const pages = useEditorStore((s) => s.document.pages);
  const listingName = useEditorStore((s) => s.activeListing?.name ?? "Listing");
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const { page, block, cell } = useSelectedEntities();

  // Listing → Page → Block → Sub-block. The listing is always shown (as the
  // link home); the rest fill in as the user drills into the selection.
  const currentPage = page ?? pages[0];
  const trail = [
    currentPage?.name,
    blockCrumb(block),
    cell ? "Cell" : null,
  ].filter((c): c is string => Boolean(c));

  return (
    <div
      className="d-flex align-items-center gap-2 p-3 w-100 flex-shrink-0"
      style={{ borderBottom: "1px solid #eceef2", background: "#fff" }}
    >
      {/* Breadcrumbs: Listing (link) / Page / Block / Sub-block */}
      <div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 0 }}>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Link
                to="/listings/$listingId/documents"
                params={{ listingId }}
                aria-label={`Back to ${listingName}`}
                className="d-flex align-items-center gap-1 text-truncate"
                style={{ color: "#22262f", fontSize: 12, fontWeight: trail.length === 0 ? 600 : 400 }}
              >
                <FontAwesomeIcon icon={faSign} style={{ fontSize: 12 }} />
                <span className="text-truncate">{listingName}</span>
              </Link>
            }
          />
          <Tooltip.Content>Back to listing</Tooltip.Content>
        </Tooltip>
        {trail.map((crumb, i) => (
          <span key={i} className="d-flex align-items-center gap-1">
            <span style={{ color: "#506079", fontSize: 12 }}>/</span>
            <span
              style={{
                color: "#22262f",
                fontSize: 12,
                fontWeight: i === trail.length - 1 ? 600 : 400,
              }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Zoom */}
      <div className="d-flex align-items-center justify-content-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={zoomOut}>
          <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
        </Button>
        <span style={{ fontSize: 14, color: "#22262f", width: 40, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={zoomIn}>
          <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
        </Button>
      </div>

      {/* Status + undo/redo + actions */}
      <div className="d-flex align-items-center justify-content-end gap-3 flex-grow-1">
        <span className="d-flex align-items-center gap-1">
          <FontAwesomeIcon icon={faCircleCheck} style={{ color: "#00bc7d" }} />
          <span style={{ fontSize: 14, color: "#22262f" }}>All Changes Saved</span>
        </span>

        <div className="d-flex align-items-center gap-1">
          <Button variant="ghost" size="icon-sm" disabled aria-label="Undo">
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled aria-label="Redo">
            <FontAwesomeIcon icon={faArrowRotateRight} />
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="outline">
                Actions
                <FontAwesomeIcon icon={faCaretDown} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={onExport}>Export PDF</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onExport}>Download</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onExport}>Share Link</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onClick={onExport}>Duplicate Document</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  );
}
