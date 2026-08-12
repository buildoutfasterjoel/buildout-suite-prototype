import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaintbrush } from "@fortawesome/pro-regular-svg-icons";
import { usePropertyUiPrefs } from "./usePropertyUiPrefs";

/**
 * The Properties page's design-comparison switches — the same floating
 * paintbrush affordance the contact detail page uses, docked lower-left, so the
 * two prototypes are driven the same way. Prototype-only.
 */
export function PropertyDesignToggles() {
  const headerStyle = usePropertyUiPrefs((s) => s.headerStyle);
  const setHeaderStyle = usePropertyUiPrefs((s) => s.setHeaderStyle);

  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button
            variant="secondary"
            size="sm"
            className="position-fixed shadow rounded-circle d-inline-flex align-items-center justify-content-center p-0"
            style={{ left: 16, bottom: 16, zIndex: 1050, width: 40, height: 40 }}
            aria-label="Design options"
          >
            <FontAwesomeIcon icon={faPaintbrush} />
          </Button>
        }
      />
      <Popover.Content
        side="top"
        align="start"
        sideOffset={8}
        style={{ minWidth: 260 }}
      >
        <Popover.Header>Design options</Popover.Header>
        <Popover.Body>
          <label
            className="d-flex align-items-center gap-3 mb-0"
            style={{ cursor: "pointer" }}
          >
            <div className="d-flex flex-column flex-grow-1">
              <span className="fw-semibold">Header</span>
              <span className="text-muted fs-small">
                {headerStyle === "card" ? "Card (People style)" : "Banner"}
              </span>
            </div>
            <Switch
              checked={headerStyle === "card"}
              onCheckedChange={(c) => setHeaderStyle(c ? "card" : "banner")}
              aria-label="Header style"
            />
          </label>
        </Popover.Body>
      </Popover.Content>
    </Popover>
  );
}
