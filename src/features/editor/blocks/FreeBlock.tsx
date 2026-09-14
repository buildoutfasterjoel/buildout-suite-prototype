import { useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripDotsVertical,
  faTrashCan,
  faBringForward,
  faSendBackward,
} from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { useEditorStore } from "../store";
import { FIXED_HEIGHT, frameHeightStyle, moveRect, resizeRect, type ResizeDir } from "../frames";
import type { Block, Rect, Selection } from "../types";
import { BlockVisual } from "./BlockViews";

/**
 * Pointer-driven move and resize.
 *
 * The gesture is held in local state and committed once on pointer-up, so a
 * drag is one store write rather than one per frame — the whole document
 * re-renders on every write, and a live commit made dragging visibly stutter.
 *
 * Deltas divide by zoom because the pointer moves in screen pixels and the
 * model stores page pixels.
 */
function useFrameDrag(pageId: string, blockId: string, frame: Rect) {
  const zoom = useEditorStore((s) => s.zoom);
  const setFrame = useEditorStore((s) => s.setFrame);
  const [draft, setDraft] = useState<Rect | null>(null);

  const start = (e: ReactPointerEvent, dir: ResizeDir | "move") => {
    e.preventDefault();
    e.stopPropagation();
    // Pointer capture redirects this pointer's events to `target` regardless
    // of where the release happens — including outside the browser window,
    // which never delivers a `pointerup` to `window` on its own. Without it,
    // a release over OS chrome or another app leaves the listeners attached
    // and the gesture's final `setFrame` never fires.
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    target.setPointerCapture(pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const base = frame;
    let next = base;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      next = dir === "move" ? moveRect(base, dx, dy) : resizeRect(base, dir, dx, dy);
      setDraft(next);
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      target.releasePointerCapture(pointerId);
      setDraft(null);
      setFrame(pageId, blockId, next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  return { rect: draft ?? frame, start };
}

const RESIZE_DIRS: ResizeDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * `.bo-editor-page` clips its content (`overflow: hidden`), so the actions
 * tray (`top: -36px`) and the north/west handles (`-5px` outside the frame)
 * get clipped off for a block sitting at the page's top or left edge — the
 * seeded hero photo at (0,0) is exactly this case. When the frame is close
 * enough to an edge that the default offset would land outside the page,
 * pull that chrome inside the frame instead.
 */
const EDGE_THRESHOLD_Y = 40;
const EDGE_THRESHOLD_X = 6;
const INSET = 4;

function handleOverride(dir: ResizeDir, nearTop: boolean, nearLeft: boolean): CSSProperties | undefined {
  const style: CSSProperties = {};
  if (nearTop && (dir === "nw" || dir === "n" || dir === "ne")) style.top = INSET;
  if (nearLeft && (dir === "nw" || dir === "sw" || dir === "w")) style.left = INSET;
  return Object.keys(style).length > 0 ? style : undefined;
}

/** Human-readable direction for each resize handle's `aria-label`. */
const DIR_LABELS: Record<ResizeDir, string> = {
  nw: "top left",
  n: "top",
  ne: "top right",
  e: "right",
  se: "bottom right",
  s: "bottom",
  sw: "bottom left",
  w: "left",
};

/**
 * Types whose body can be grabbed directly. Text-bearing blocks are excluded:
 * they are contentEditable, so a body drag would steal the pointer from
 * selecting text inside them. Those keep the drag handle the stacked layout
 * already uses.
 */
const BODY_DRAGGABLE: Block["type"][] = ["image", "map", "divider", "spacer", "section", "contents"];

/**
 * One block on a free page: an absolutely positioned box around the same visual
 * a stacked page renders. Selection, editing and every style control keep
 * working, because only the wrapper changed.
 */
export function FreeBlock({
  block,
  pageId,
  frame,
  selection,
  depth,
}: {
  block: Block;
  pageId: string;
  frame: Rect;
  selection: Selection | null;
  /** Position in the page's paint order — 0 is the backmost block. */
  depth: number;
}) {
  const select = useEditorStore((s) => s.select);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const setBlockDepth = useEditorStore((s) => s.setBlockDepth);
  const located = useEditorStore(
    (s) => s.highlightedBlockId === block.id && s.selection?.blockId !== block.id,
  );
  const selected = selection?.blockId === block.id && !selection?.cellId;
  // Fixed-height types (image, map, divider, spacer, section, columns) get a
  // hard box from the frame — the `--boxed` modifier makes the block visual
  // fill it instead of floating at its own intrinsic size (an image covers
  // rather than letterboxing).
  const boxed = FIXED_HEIGHT.includes(block.type);
  const { rect, start } = useFrameDrag(pageId, block.id, frame);
  const bodyDraggable = BODY_DRAGGABLE.includes(block.type);
  // A table is the one block with no workable grab: its cells are editable, so
  // the body can't be dragged, and its own row/column handles and insert dots
  // float in the gutter exactly where the drag handle sits — they take the
  // pointer first. Its frame gets a padding band instead, grabbable because a
  // pointerdown there lands on the frame itself rather than on anything inside.
  const grabBand = block.type === "table";

  return (
    <div
      className={`bo-editor-frame${boxed ? " bo-editor-frame--boxed" : ""}${bodyDraggable ? " bo-editor-frame--draggable" : ""}${grabBand ? " bo-editor-frame--grab-band" : ""}${selected ? " is-selected" : ""}${located ? " is-located" : ""}`}
      data-block-id={block.id}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        // Paint order comes from this, not from DOM order — see `paintOrder`.
        // Deliberately not boosted while selected: lifting the selected block
        // would make "Send to back" look like it did nothing until you click
        // away.
        zIndex: depth,
        ...frameHeightStyle(block.type, rect.h),
      }}
      onPointerDown={(e) => {
        if (bodyDraggable) {
          start(e, "move");
          return;
        }
        if (!grabBand || e.target !== e.currentTarget) return;
        // The gesture calls preventDefault, which can swallow the click that
        // would otherwise select the block — so select from the band directly.
        select({ pageId, blockId: block.id });
        start(e, "move");
      }}
      onClick={(e) => {
        e.stopPropagation();
        select({ pageId, blockId: block.id });
      }}
    >
      {!bodyDraggable && (
        <button
          type="button"
          className="bo-editor-drag-handle"
          aria-label="Drag to move"
          onPointerDown={(e) => start(e, "move")}
        >
          <FontAwesomeIcon icon={faGripDotsVertical} />
        </button>
      )}

      {selected && (
        <>
          <div
            className="bo-editor-frame-actions"
            style={rect.y < EDGE_THRESHOLD_Y ? { top: INSET } : undefined}
            // A body-draggable block starts its move gesture from a pointerdown
            // anywhere inside the frame, and that gesture calls preventDefault
            // — which cancels the click before the button ever sees it. So the
            // tray keeps pointerdown to itself; without this, every one of
            // these buttons is dead on exactly the blocks you can drag by their
            // body, and works fine on the ones you can't.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="ghost"
                    appearance="accent"
                    size="icon-sm"
                    aria-label="Bring to front"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockDepth(block.id, "front");
                    }}
                  >
                    <FontAwesomeIcon icon={faBringForward} />
                  </Button>
                }
              />
              <Tooltip.Content>Bring to front</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="ghost"
                    appearance="accent"
                    size="icon-sm"
                    aria-label="Send to back"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockDepth(block.id, "back");
                    }}
                  >
                    <FontAwesomeIcon icon={faSendBackward} />
                  </Button>
                }
              />
              <Tooltip.Content>Send to back</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="ghost"
                    appearance="accent"
                    size="icon-sm"
                    aria-label={`Delete ${block.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBlock(block.id);
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </Button>
                }
              />
              <Tooltip.Content>Delete {block.type}</Tooltip.Content>
            </Tooltip>
          </div>

          {RESIZE_DIRS.map((dir) => (
            <span
              key={dir}
              className={`bo-editor-handle is-${dir}`}
              aria-label={`Resize from ${DIR_LABELS[dir]}`}
              style={handleOverride(dir, rect.y < EDGE_THRESHOLD_Y, rect.x < EDGE_THRESHOLD_X)}
              onPointerDown={(e) => start(e, dir)}
            />
          ))}
        </>
      )}

      <BlockVisual
        block={block}
        pageId={pageId}
        selection={selection}
        // A free page's containers hold blocks the user can't yet drag or
        // remove in place, same as a locked preset's block structure — so a
        // section renders as a plain rectangle instead of an empty list's
        // drag-and-drop zone.
        locked
        // `index` only matters to ImageBlockView's now-disabled fullBleed
        // check (see `freeLayer` below); there's no list position here.
        index={0}
        // The frame already gives this block its explicit width/position —
        // fullBleed's page-padding-canceling margins don't apply on a free
        // canvas (see ImageBlockView).
        freeLayer
      />
    </div>
  );
}
