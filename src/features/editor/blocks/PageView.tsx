import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { useEditorStore } from "../store";
import { PAGE_WIDTH, PAGE_HEIGHT, type Page, type Selection } from "../types";
import { BlockList } from "./BlockViews";

/** A single fixed-size page (US Letter) rendering its block stack. */
export function PageView({
  page,
  selection,
}: {
  page: Page;
  selection: Selection | null;
}) {
  const select = useEditorStore((s) => s.select);
  const pageSelection = selection?.pageId === page.id ? selection : null;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
        <Badge>Admin Only</Badge>
      </div>

      <div
        className="bo-editor-page"
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        onClick={() => select({ pageId: page.id })}
      >
        {page.logoSrc && (
          <div className="p-6" style={{ flexShrink: 0 }}>
            <img src={page.logoSrc} alt="Document logo" style={{ height: 55 }} />
          </div>
        )}

        <div
          className="d-flex flex-column"
          style={{ gap: 32, padding: 40, flex: "1 0 0", minHeight: 0 }}
        >
          <BlockList
            blocks={page.blocks}
            pageId={page.id}
            list={{ kind: "page", pageId: page.id }}
            selection={pageSelection}
          />
        </div>
      </div>
    </div>
  );
}
