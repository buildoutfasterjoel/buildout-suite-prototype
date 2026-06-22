import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/pro-regular-svg-icons";
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
 */
export function PropertiesPanel() {
  const activeNavPanel = useEditorStore((s) => s.activeNavPanel);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const { block, cell } = useSelectedEntities();

  const showStyles = block !== null;

  return (
    <div className="bo-editor-panel">
      <div className="p-3" style={{ borderBottom: "1px solid #eceef2" }}>
        <Button
          variant="ghost"
          onClick={clearSelection}
          disabled={!showStyles}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Back
        </Button>
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

function NavPanelContent({ panel }: { panel: ReturnType<typeof useEditorStore.getState>["activeNavPanel"] }) {
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
