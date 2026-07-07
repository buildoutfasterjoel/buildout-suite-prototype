import { useEffect, useRef } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { useEditorStore } from "./store";
import { PageView } from "./blocks/PageView";
import { RichTextToolbar } from "./RichTextToolbar";

/** Gray workspace that renders the document's pages at the current zoom. */
export function Canvas() {
  const pages = useEditorStore((s) => s.document.pages);
  const zoom = useEditorStore((s) => s.zoom);
  const selection = useEditorStore((s) => s.selection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const highlightedBlockId = useEditorStore((s) => s.highlightedBlockId);
  const setActivePageId = useEditorStore((s) => s.setActivePageId);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Locating a block from the Layers panel scrolls it into view on the canvas.
  useEffect(() => {
    if (!highlightedBlockId) return;
    const el = document.querySelector(`[data-block-id="${highlightedBlockId}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightedBlockId]);

  // Track the page under the viewport's vertical center as the user scrolls, so
  // the Layers panel follows along.
  useEffect(() => {
    const root = workspaceRef.current;
    if (!root) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rootRect = root.getBoundingClientRect();
      const centerY = rootRect.top + rootRect.height / 2;
      const els = Array.from(
        root.querySelectorAll<HTMLElement>("[data-page-id]"),
      );
      let best: string | null = null;
      let bestDist = Infinity;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top <= centerY && r.bottom >= centerY) {
          best = el.dataset.pageId ?? null;
          break; // page spans the center — definitive.
        }
        const dist = Math.abs(r.top + r.height / 2 - centerY);
        if (dist < bestDist) {
          bestDist = dist;
          best = el.dataset.pageId ?? null;
        }
      }
      if (best) setActivePageId(best);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pages, setActivePageId]);

  return (
    <>
      <RichTextToolbar />
      <div style={{ padding: "8px 24px 0", background: "#f6f7f9", flexShrink: 0 }}>
        <Badge>Admin Only</Badge>
      </div>
      <div ref={workspaceRef} className="bo-editor-workspace" onClick={clearSelection}>
        <div className="bo-editor-pages" style={{ transform: `scale(${zoom})` }}>
          {pages.map((page) => (
            <div
              key={page.id}
              data-page-id={page.id}
              onClick={(e) => e.stopPropagation()}
            >
              <PageView page={page} selection={selection} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
