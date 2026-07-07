import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSign,
  faPenToSquare,
  faMagnifyingGlassPlus,
  faMagnifyingGlassMinus,
  faArrowRotateLeft,
  faArrowRotateRight,
  faEllipsisVertical,
  faClockRotateLeft,
} from "@fortawesome/pro-regular-svg-icons";
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { CircularProgress } from "@buildoutinc/blueprint-react/ui/Progress";
import { useEditorStore, useSelectedEntities } from "./store";

/** Debounce window (ms): how long the doc must sit still before the fake autosave "completes". */
const AUTOSAVE_DEBOUNCE_MS = 600;

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
  listingId,
  onSaveAndClose,
  onEditListing,
  onSwitchToClassicEditor,
}: {
  listingId: string;
  onExport: () => void;
  onSaveAndClose: () => void;
  onEditListing: () => void;
  onSwitchToClassicEditor: () => void;
}) {
  const doc = useEditorStore((s) => s.document);
  const pages = doc.pages;
  const listingName = useEditorStore((s) => s.activeListing?.name ?? "Deal");
  const dirty = useEditorStore((s) => s.dirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const { page, block, cell } = useSelectedEntities();

  // Fake autosave: every edit re-arms the timer, so the indicator keeps
  // "saving" while the user is actively editing and only settles back to
  // saved after a brief quiet period.
  useEffect(() => {
    if (!dirty) return;
    const timeout = setTimeout(markSaved, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [doc, dirty, markSaved]);

  // Page → Block → Sub-block, drilling in as the user refines their selection.
  const currentPage = page ?? pages[0];
  const trail = [
    currentPage?.name,
    blockCrumb(block),
    cell ? "Cell" : null,
  ].filter((c): c is string => Boolean(c));

  return (
    <div className="d-flex align-items-center gap-2 p-3 w-100 flex-shrink-0 bg-white border-bottom">
      {/* Deal (link) / Page / Block / Sub-block */}
      <div className="d-flex align-items-center gap-1 flex-grow-1">
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Link
                to="/listings/$listingId/documents"
                params={{ listingId }}
                aria-label={`Back to ${listingName}`}
                className="d-flex align-items-center gap-1 text-truncate text-body fs-small"
              />
            }
          >
            <FontAwesomeIcon icon={faSign} style={{ fontSize: 12 }} />
            <span
              className={`text-truncate ${trail.length === 0 ? "fw-semibold" : "fw-normal"}`}
            >
              {listingName}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content>Back to deal</Tooltip.Content>
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
            <Tooltip>
              <Tooltip.Trigger render={<span aria-label="Saving changes" />}>
                <CircularProgress size="sm" label="Saving changes" />
              </Tooltip.Trigger>
              <Tooltip.Content>Saving changes…</Tooltip.Content>
            </Tooltip>
          ) : (
            <Tooltip>
              <Tooltip.Trigger render={<span aria-label="All Changes Saved" />}>
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className="text-success"
                />
              </Tooltip.Trigger>
              <Tooltip.Content>All Changes Saved</Tooltip.Content>
            </Tooltip>
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
          Close
        </Button>

        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="ghost" size="icon" aria-label="More actions">
                <FontAwesomeIcon icon={faEllipsisVertical} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onClick={onEditListing}>
              <FontAwesomeIcon icon={faPenToSquare} />
              Edit Listing Details
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onClick={onSwitchToClassicEditor}>
              <FontAwesomeIcon icon={faClockRotateLeft} />
              Switch to Classic Editor
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  );
}
