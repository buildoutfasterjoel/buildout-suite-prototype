import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaintbrush } from "@fortawesome/pro-regular-svg-icons";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

/** A single labeled switch row inside the design menu. */
function ToggleRow({
  title,
  value,
  checked,
  onCheckedChange,
}: {
  title: string;
  value: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="d-flex align-items-center gap-3 mb-0"
      style={{ cursor: "pointer" }}
    >
      <div className="d-flex flex-column flex-grow-1">
        <span className="fw-semibold">{title}</span>
        <span className="text-muted fs-small">{value}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={`${title}: ${value}`}
      />
    </label>
  );
}

/**
 * A single floating paintbrush button, docked in the lower-left of the contact
 * detail page. Opens a popover menu holding the prototype's design-comparison
 * switches (accordion style, tab track, timeline filter) so they stay tucked
 * away rather than cluttering the corner. Prototype-only affordance.
 */
export function ContactDesignToggles() {
  const legacyAccordions = useContactUiPrefs((s) => s.legacyAccordions);
  const setLegacyAccordions = useContactUiPrefs((s) => s.setLegacyAccordions);
  const tabTrack = useContactUiPrefs((s) => s.tabTrack);
  const setTabTrack = useContactUiPrefs((s) => s.setTabTrack);
  const timelineFilter = useContactUiPrefs((s) => s.timelineFilter);
  const setTimelineFilter = useContactUiPrefs((s) => s.setTimelineFilter);

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
        <Popover.Body className="d-flex flex-column gap-3">
          <ToggleRow
            title="Accordions"
            value={legacyAccordions ? "New" : "Legacy"}
            checked={legacyAccordions}
            onCheckedChange={setLegacyAccordions}
          />
          <Separator />
          <ToggleRow
            title="Tabs"
            value={tabTrack === "ghost" ? "Ghost Track" : "System"}
            checked={tabTrack === "ghost"}
            onCheckedChange={(c) => setTabTrack(c ? "ghost" : "system")}
          />
          <Separator />
          <ToggleRow
            title="Timeline filter"
            value={timelineFilter === "dropdown" ? "Dropdown" : "Tabs"}
            checked={timelineFilter === "dropdown"}
            onCheckedChange={(c) => setTimelineFilter(c ? "dropdown" : "tabs")}
          />
        </Popover.Body>
      </Popover.Content>
    </Popover>
  );
}
