import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSliders,
  faMapLocationDot,
  faStar,
  faBolt,
  faArrowRotateLeft,
  faSwatchbook,
  faLockOpen,
} from "@fortawesome/pro-regular-svg-icons";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { useEditorStore } from "../store";
import { useWorkspaceRef } from "../workspaceContext";
import { BRAND } from "../brand";
import { PAGE_WIDTH, PAGE_HEIGHT, PAGE_PADDING, type Page, type Selection } from "../types";
import { BlockList } from "./BlockViews";
import { FreeBlock } from "./FreeBlock";
import { frameAt, measurePageElement } from "../frames";
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
 *
 * It portals into the scrolling workspace rather than the body, so the
 * workspace's overflow clips it: scroll down and the toolbar slides under the
 * editor's toolbars instead of floating over them. The popup still sits outside
 * the zoom-transformed page stack, so its buttons stay full size at any zoom.
 */
function PageToolbar({
  page,
  open,
}: {
  page: Page;
  open: boolean;
}) {
  const workspaceRef = useWorkspaceRef();
  const zoom = useEditorStore((s) => s.zoom);
  const freePage = useEditorStore((s) => s.freePage);

  // Measuring is the whole conversion: the rects come off the page as it is
  // rendered right now, so the page cannot move when it is unfrozen.
  const unfreeze = () => {
    const measured = measurePageElement(page.id, zoom);
    if (!measured) return;
    freePage(page.id, measured);
  };

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
        container={workspaceRef ?? undefined}
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
            {!page.frames && (
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button variant="ghost" size="sm" onClick={unfreeze}>
                      <FontAwesomeIcon icon={faLockOpen} />
                      Unfreeze layout
                    </Button>
                  }
                />
                <Tooltip.Content side="top">
                  Turn this page into a free canvas. Blocks keep their exact
                  positions and become movable.
                </Tooltip.Content>
              </Tooltip>
            )}
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

/**
 * The company footer that closes every base page — brand name on the left, the
 * page's position in the document on the right, over a hairline inset to the
 * same 40px margin the content above it uses.
 */
function PageFooter({ pageNumber }: { pageNumber: number }) {
  return (
    <div
      className="bo-editor-page-footer"
      style={{ fontFamily: BRAND.fonts.body }}
    >
      <span className="text-truncate">{BRAND.name}</span>
      <span>{pageNumber}</span>
    </div>
  );
}

/**
 * Render a free page's blocks in a stable DOM order, carrying their paint order
 * as a depth number instead.
 *
 * `page.blocks` order IS the paint order, but rendering in that order makes
 * React move DOM nodes whenever a block is sent to the back or brought to the
 * front. Moving a node detaches it, and a block that owns a live widget does
 * not survive that: Leaflet loses its container, and the *second* reorder of a
 * map threw inside Leaflet and blanked the whole document through the route's
 * error boundary. Sorting by id keeps every node where it is for the lifetime
 * of the page, so reordering only rewrites a `z-index` — nothing is detached,
 * and no block can be broken by being restacked.
 */
function paintOrder(blocks: Page["blocks"]): { block: Page["blocks"][number]; depth: number }[] {
  return blocks
    .map((block, depth) => ({ block, depth }))
    .sort((a, b) => (a.block.id < b.block.id ? -1 : a.block.id > b.block.id ? 1 : 0));
}

/** A single fixed-size page (US Letter) rendering its block stack. */
export function PageView({
  page,
  selection,
  pageNumber = 1,
}: {
  page: Page;
  selection: Selection | null;
  /** 1-based position in the document, printed in the footer. */
  pageNumber?: number;
}) {
  const select = useEditorStore((s) => s.select);
  const pageSelection = selection?.pageId === page.id ? selection : null;
  // The page itself (not a block inside it) is selected — clicking blank
  // page space sets a pageId-only selection; blocks stop propagation and set
  // their own blockId, which supersedes this page-level state.
  const pageSelected = pageSelection !== null && !pageSelection.blockId;
  // Full-bleed pages (covers) drop the page margin and block gap so their
  // artwork runs to the paper's edge.
  const bleed = page.bleed ?? false;
  // Base pages are framed by the brand logo header and the company footer;
  // covers and other bespoke layouts own the whole sheet.
  const chrome = (page.chrome ?? "base") === "base";

  return (
    <div style={{ position: "relative" }}>
      <div
        className={`bo-editor-page${pageSelected ? " is-page-selected" : ""}`}
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        onClick={() => select({ pageId: page.id })}
      >
        {chrome && page.logoSrc && (
          <div className="p-6" style={{ flexShrink: 0 }}>
            <img
              src={page.logoSrc}
              alt="Document logo"
              style={{ height: 55 }}
            />
          </div>
        )}

        {page.frames ? (
          // A free page owns the whole sheet: blocks sit in page coordinates,
          // over the chrome if that is where they were put.
          <div className="bo-editor-free-layer">
            {paintOrder(page.blocks).map(({ block, depth }) => (
              <FreeBlock
                key={block.id}
                block={block}
                pageId={page.id}
                frame={page.frames![block.id] ?? frameAt(block.type, PAGE_WIDTH / 2, 120)}
                selection={pageSelection}
                depth={depth}
              />
            ))}
          </div>
        ) : (
          <div
            className="d-flex flex-column"
            style={{
              gap: bleed ? 0 : 32,
              padding: bleed ? 0 : PAGE_PADDING,
              flex: "1 0 0",
              minHeight: 0,
            }}
          >
            <BlockList
              blocks={page.blocks}
              pageId={page.id}
              list={{ kind: "page", pageId: page.id }}
              selection={pageSelection}
              locked={page.locked ?? false}
            />
          </div>
        )}

        {chrome && <PageFooter pageNumber={pageNumber} />}
      </div>
      <PageToolbar page={page} open={pageSelected} />
    </div>
  );
}
