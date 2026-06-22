import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGear,
  faFileLines,
  faImages,
  faLayerGroup,
  faCubes,
} from "@fortawesome/pro-regular-svg-icons";
import { useEditorStore } from "./store";
import type { NavPanel } from "./types";

const ITEMS: { panel: NavPanel; icon: IconDefinition; label: string }[] = [
  { panel: "settings", icon: faGear, label: "Settings" },
  { panel: "pages", icon: faFileLines, label: "Pages" },
  { panel: "images", icon: faImages, label: "Images" },
  { panel: "layers", icon: faLayerGroup, label: "Layers" },
  { panel: "blocks", icon: faCubes, label: "Blocks" },
];

/** Far-left vertical icon rail that switches the active properties panel. */
export function DocsNavRail() {
  const activeNavPanel = useEditorStore((s) => s.activeNavPanel);
  const setNavPanel = useEditorStore((s) => s.setNavPanel);

  return (
    <div
      className="d-flex flex-column align-items-center gap-4 p-3 h-100 flex-shrink-0"
      style={{ borderRight: "1px solid #eceef2", background: "#fff" }}
    >
      {ITEMS.map((item) => (
        <button
          key={item.panel}
          type="button"
          className={`bo-editor-rail-btn${activeNavPanel === item.panel ? " is-active" : ""}`}
          onClick={() => setNavPanel(item.panel)}
        >
          <span className="bo-editor-rail-icon">
            <FontAwesomeIcon icon={item.icon} />
          </span>
          <span className="bo-editor-rail-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
