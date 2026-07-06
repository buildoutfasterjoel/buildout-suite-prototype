import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faCircleCheck,
  faCircleDot,
  faArrowRotateLeft,
  faArrowRotateRight,
  faSave,
  faEllipsisVertical,
} from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { useEditorStore, useSelectedEntities } from "./store";

function blockCrumb(
  block: ReturnType<typeof useSelectedEntities>["block"],
): string | null {
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

/** Top canvas bar: save & close, breadcrumb trail, zoom, save status, undo/redo, actions. */
export function CanvasActions({
  onExport,
  onSaveAndClose,
  onEditListing,
}: {
  onExport: () => void;
  onSaveAndClose: () => void;
  onEditListing: () => void;
}) {
  const pages = useEditorStore((s) => s.document.pages);
  const listingName = useEditorStore((s) => s.activeListing?.name ?? "Deal");
  const dirty = useEditorStore((s) => s.dirty);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const { page, block, cell } = useSelectedEntities();

  // Page → Block → Sub-block, drilling in as the user refines their selection.
  const currentPage = page ?? pages[0];
  const trail = [
    currentPage?.name,
    blockCrumb(block),
    cell ? "Cell" : null,
  ].filter((c): c is string => Boolean(c));

  return (
    <div className="d-flex align-items-center gap-2 p-3 w-100 flex-shrink-0 bg-white border-bottom">
      {/* Listing name (edit entry point) / Page / Block / Sub-block */}
      <div className="d-flex align-items-center gap-1 flex-grow-1">
        <span
          className={`text-truncate text-body fs-small ${trail.length === 0 ? "fw-semibold" : "fw-normal"}`}
        >
          {listingName}
        </span>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit listing details"
                onClick={onEditListing}
              >
                <FontAwesomeIcon icon={faPenToSquare} />
              </Button>
            }
          />
          <Tooltip.Content>Edit listing details</Tooltip.Content>
        </Tooltip>
        {trail.map((crumb, i) => (
          <span key={i} className="d-flex align-items-center gap-1">
            <span className="text-muted fs-small">/</span>
            <span
              className={`text-body fs-small ${i === trail.length - 1 ? "fw-semibold" : "fw-normal"}`}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Zoom */}
      <div className="d-flex align-items-center justify-content-center gap-2">
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={zoomOut}
              >
                <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
              </Button>
            }
          />
          <Tooltip.Content>Zoom out</Tooltip.Content>
        </Tooltip>
        <span className="text-body text-center" style={{ width: 40 }}>
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={zoomIn}
              >
                <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
              </Button>
            }
          />
          <Tooltip.Content>Zoom in</Tooltip.Content>
        </Tooltip>
      </div>

      {/* Status + undo/redo + actions */}
      <div className="d-flex align-items-center justify-content-end gap-3 flex-grow-1">
        <span className="d-flex align-items-center gap-1">
          {dirty ? (
            <>
              <FontAwesomeIcon icon={faCircleDot} className="text-warning" />
              <span className="text-body">Unsaved Changes</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faCircleCheck} className="text-success" />
              <span className="text-body">All Changes Saved</span>
            </>
          )}
        </span>

        <div className="d-flex align-items-center gap-1">
          <Button variant="ghost" size="icon-sm" disabled aria-label="Undo">
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled aria-label="Redo">
            <FontAwesomeIcon icon={faArrowRotateRight} />
          </Button>
        </div>

        <Button variant="outline" onClick={onSaveAndClose}>
          <FontAwesomeIcon icon={faSave} />
          Save &amp; Close
        </Button>

        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="ghost" size="icon">
                <FontAwesomeIcon icon={faEllipsisVertical} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={onExport}>Export PDF</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onExport}>Download</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onExport}>Share Link</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onClick={onExport}>
              Duplicate Document
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  );
}
