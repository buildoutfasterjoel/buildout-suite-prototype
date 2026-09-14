import { useEditorStore } from "../store";
import { FIXED_HEIGHT, frameHeightStyle } from "../frames";
import type { Block, Rect, Selection } from "../types";
import { BlockVisual } from "./BlockViews";

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
  const located = useEditorStore(
    (s) => s.highlightedBlockId === block.id && s.selection?.blockId !== block.id,
  );
  const selected = selection?.blockId === block.id && !selection?.cellId;
  // Fixed-height types (image, map, divider, spacer, section, columns) get a
  // hard box from the frame — the `--boxed` modifier makes the block visual
  // fill it instead of floating at its own intrinsic size (an image covers
  // rather than letterboxing).
  const boxed = FIXED_HEIGHT.includes(block.type);

  return (
    <div
      className={`bo-editor-frame${boxed ? " bo-editor-frame--boxed" : ""}${selected ? " is-selected" : ""}${located ? " is-located" : ""}`}
      data-block-id={block.id}
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.w,
        ...frameHeightStyle(block.type, frame.h),
      }}
      onClick={(e) => {
        e.stopPropagation();
        select({ pageId, blockId: block.id });
      }}
    >
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
