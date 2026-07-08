import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faThumbTack,
  faThumbTackSlash,
} from "@fortawesome/pro-regular-svg-icons";
import { useEditorStore, useSelectedEntities } from "./store";
import { StyleControls } from "./panels/StyleControls";
import {
  PagesPanel,
  LayersPanel,
  BlocksPanel,
  ImagesPanel,
  SettingsPanel,
} from "./panels/NavPanels";

/**
 * 280px left properties panel. Shows contextual style controls when an element
 * is selected, otherwise the active nav-rail panel. The Back button returns to
 * the Blocks panel.
 *
 * Pinned = docked in-flow (pushes the canvas), same as the panel's original
 * always-visible behavior. Unpinned = floats over the canvas, popping in on
 * selection/rail clicks and auto-collapsing again on deselect. The header's
 * toggle button collapses it when pinned/open, or pins (keeps) it open when
 * it's currently showing as an unpinned floating overlay.
 */
export function PropertiesPanel() {
  const activeNavPanel = useEditorStore((s) => s.activeNavPanel);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const sidebarPinned = useEditorStore((s) => s.sidebarPinned);
  const sidebarPoppedOpen = useEditorStore((s) => s.sidebarPoppedOpen);
  const collapseSidebar = useEditorStore((s) => s.collapseSidebar);
  const toggleSidebarPin = useEditorStore((s) => s.toggleSidebarPin);
  const { block, cell } = useSelectedEntities();

  const showStyles = block !== null;
  const isOpen = sidebarPinned || sidebarPoppedOpen;
  const panelClassName = [
    "bo-editor-panel",
    sidebarPinned ? "bo-editor-panel--docked" : "bo-editor-panel--floating",
    isOpen ? "bo-editor-panel--open" : "bo-editor-panel--collapsed",
  ].join(" ");

  return (
    <div className={panelClassName} aria-hidden={isOpen ? undefined : true}>
      <div
        className="p-3 d-flex align-items-center justify-content-between"
        style={{ borderBottom: "1px solid #eceef2" }}
      >
        <Button variant="ghost" onClick={clearSelection} disabled={!showStyles}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Back
        </Button>

        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={sidebarPinned ? collapseSidebar : toggleSidebarPin}
              >
                <FontAwesomeIcon
                  icon={sidebarPinned ? faThumbTackSlash : faThumbTack}
                />
              </Button>
            }
          />
          <Tooltip.Content>
            {sidebarPinned ? "Collapse panel" : "Keep panel open"}
          </Tooltip.Content>
        </Tooltip>
      </div>

      <div className="bo-editor-panel-scroll p-3">
        {showStyles ? (
          <StyleControls block={block} cell={cell} />
        ) : (
          <NavPanelContent panel={activeNavPanel} />
        )}
      </div>
    </div>
  );
}

function NavPanelContent({
  panel,
}: {
  panel: ReturnType<typeof useEditorStore.getState>["activeNavPanel"];
}) {
  switch (panel) {
    case "pages":
      return <PagesPanel />;
    case "layers":
      return <LayersPanel />;
    case "images":
      return <ImagesPanel />;
    case "settings":
      return <SettingsPanel />;
    case "blocks":
    default:
      return <BlocksPanel />;
  }
}
