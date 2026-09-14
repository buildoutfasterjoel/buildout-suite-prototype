import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripDotsVertical,
  faTrashCan,
  faBringForward,
  faSendBackward,
} from "@fortawesome/pro-regular-svg-icons";
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
}: {
  block: Block;
  pageId: string;
  frame: Rect;
  selection: Selection | null;
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

  return (
    <div
      className={`bo-editor-frame${boxed ? " bo-editor-frame--boxed" : ""}${bodyDraggable ? " bo-editor-frame--draggable" : ""}${selected ? " is-selected" : ""}${located ? " is-located" : ""}`}
      data-block-id={block.id}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        ...frameHeightStyle(block.type, rect.h),
      }}
      onPointerDown={bodyDraggable ? (e) => start(e, "move") : undefined}
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
          <div className="bo-editor-frame-actions">
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    aria-label="Bring to front"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockDepth(block.id, "front");
                    }}
                  >
                    <FontAwesomeIcon icon={faBringForward} />
                  </button>
                }
              />
              <Tooltip.Content>Bring to front</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    aria-label="Send to back"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockDepth(block.id, "back");
                    }}
                  >
                    <FontAwesomeIcon icon={faSendBackward} />
                  </button>
                }
              />
              <Tooltip.Content>Send to back</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    aria-label={`Delete ${block.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBlock(block.id);
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
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
        index={0}
      />
    </div>
  );
}
