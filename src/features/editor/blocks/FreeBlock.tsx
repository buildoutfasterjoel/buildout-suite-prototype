import { useEditorStore } from "../store";
import { frameHeightStyle } from "../frames";
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

  return (
    <div
      className={`bo-editor-frame${selected ? " is-selected" : ""}${located ? " is-located" : ""}`}
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
        locked={false}
        index={0}
      />
    </div>
  );
}
