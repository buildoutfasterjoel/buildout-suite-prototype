import { PageView } from "./blocks/PageView";
import { PAGE_WIDTH, PAGE_HEIGHT, type Page } from "./types";

/**
 * A non-interactive, scaled-down render of a real page — used for template
 * thumbnails. Wraps the live PageView (pointer-events off, no selection) so
 * previews never drift from the templates they represent.
 */
export function PagePreview({ page, width }: { page: Page; width: number }) {
  const scale = width / PAGE_WIDTH;
  return (
    <div
      aria-hidden
      style={{
        width,
        height: PAGE_HEIGHT * scale,
        overflow: "hidden",
        borderRadius: 6,
        border: "1px solid #d5dae2",
        background: "#fff",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <PageView page={page} selection={null} />
      </div>
    </div>
  );
}
