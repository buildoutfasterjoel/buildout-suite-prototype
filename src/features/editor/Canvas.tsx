import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { useEditorStore } from "./store";
import { PageView } from "./blocks/PageView";

/** Gray workspace that renders the document's pages at the current zoom. */
export function Canvas() {
  const pages = useEditorStore((s) => s.document.pages);
  const zoom = useEditorStore((s) => s.zoom);
  const selection = useEditorStore((s) => s.selection);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  return (
    <>
      <div style={{ padding: "8px 24px 0", background: "#f6f7f9", flexShrink: 0 }}>
        <Badge>Admin Only</Badge>
      </div>
      <div
        className="bo-editor-workspace"
        onClick={clearSelection}
      >
        <div className="bo-editor-pages" style={{ transform: `scale(${zoom})` }}>
          {pages.map((page) => (
            <div key={page.id} onClick={(e) => e.stopPropagation()}>
              <PageView page={page} selection={selection} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
