import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSliders,
  faMapLocationDot,
  faStar,
  faBolt,
  faArrowRotateLeft,
  faSwatchbook,
} from "@fortawesome/pro-regular-svg-icons";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { useEditorStore } from "../store";
import { PAGE_WIDTH, PAGE_HEIGHT, type Page, type Selection } from "../types";
import { BlockList } from "./BlockViews";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";

/** Icon button + tooltip shown in the page toolbar popover. */
function PageToolbarButton({
  icon,
  label,
}: {
  icon: typeof faSliders;
  label: string;
}) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Button variant="ghost" size="sm" aria-label={label}>
            <FontAwesomeIcon icon={icon} />
          </Button>
        }
      />
      <Tooltip.Content side="top">{label}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * Floating toolbar shown above the page when it (not a block inside it) is
 * selected — anchored to an invisible marker at the page's top-center so the
 * popover stays centered above the page regardless of zoom.
 */
function PageToolbar({ page, open }: { page: Page; open: boolean }) {
  return (
    <Popover open={open}>
      <Popover.Trigger
        nativeButton={false}
        render={
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              width: 0,
              height: 0,
            }}
          />
        }
      />
      <Popover.Content
        side="top"
        align="start"
        sideOffset={12}
        autoFocus={false}
        className="w-auto"
      >
        <div
          className="d-flex align-items-center gap-2 p-1 position-relative"
          onClick={(e) => e.stopPropagation()}
        >
          {page.locked && (
            <>
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <span className="fs-small fw-semibold text-nowrap d-inline-flex align-items-center gap-0-5">
                      <Badge
                        variant="secondary"
                        appearance="muted"
                        className="bg-transparent"
                      >
                        <FontAwesomeIcon icon={faSwatchbook} />
                      </Badge>
                      <span className="user-select-none">{page.name}</span>
                    </span>
                  }
                />
                <Tooltip.Content>
                  Preset Layout: the structure of this page is fixed, but its
                  content is editable.
                </Tooltip.Content>
              </Tooltip>
            </>
          )}

          <Separator
            orientation="vertical"
            className="align-self-stretch h-auto"
          />
          <div className="d-flex gap-0-5 align-items-center">
            <PageToolbarButton icon={faSliders} label="Page Options" />
            <PageToolbarButton
              icon={faMapLocationDot}
              label="Retail Map Options"
            />
            <PageToolbarButton icon={faStar} label="Save to Library" />
            <PageToolbarButton icon={faBolt} label="Powerpage Information" />
            <PageToolbarButton icon={faArrowRotateLeft} label="Reset" />
          </div>
        </div>
      </Popover.Content>
    </Popover>
  );
}

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
  // The page itself (not a block inside it) is selected — clicking blank
  // page space sets a pageId-only selection; blocks stop propagation and set
  // their own blockId, which supersedes this page-level state.
  const pageSelected = pageSelection !== null && !pageSelection.blockId;

  return (
    <div style={{ position: "relative" }}>
      <div
        className={`bo-editor-page${pageSelected ? " is-page-selected" : ""}`}
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        onClick={() => select({ pageId: page.id })}
      >
        {page.logoSrc && (
          <div className="p-6" style={{ flexShrink: 0 }}>
            <img
              src={page.logoSrc}
              alt="Document logo"
              style={{ height: 55 }}
            />
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
            locked={page.locked ?? false}
          />
        </div>
      </div>
      <PageToolbar page={page} open={pageSelected} />
    </div>
  );
}
