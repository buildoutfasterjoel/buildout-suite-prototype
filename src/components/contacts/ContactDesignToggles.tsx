import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaintbrush } from "@fortawesome/pro-regular-svg-icons";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { useContactNarrow } from "#/lib/useMediaQuery";
import { useAssistant } from "#/ai/useAssistant";

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
 * A single floating paintbrush button, docked in the lower-left. Opens a popover
 * menu holding the prototype's design-comparison switches (accordion style, tab
 * track, timeline filter, deal cards) so they stay tucked away rather than
 * cluttering the corner. Prototype-only affordance.
 *
 * Mounted on both the contact detail page and the Pipeline board — the deal-card
 * switch applies to both surfaces, so it has to be reachable from either.
 */
export function ContactDesignToggles() {
  const legacyAccordions = useContactUiPrefs((s) => s.legacyAccordions);
  const setLegacyAccordions = useContactUiPrefs((s) => s.setLegacyAccordions);
  const tabTrack = useContactUiPrefs((s) => s.tabTrack);
  const setTabTrack = useContactUiPrefs((s) => s.setTabTrack);
  const timelineFilter = useContactUiPrefs((s) => s.timelineFilter);
  const setTimelineFilter = useContactUiPrefs((s) => s.setTimelineFilter);
  const dealCards = useContactUiPrefs((s) => s.dealCards);
  const setDealCards = useContactUiPrefs((s) => s.setDealCards);
  const narrowLayout = useContactUiPrefs((s) => s.narrowLayout);
  const setNarrowLayout = useContactUiPrefs((s) => s.setNarrowLayout);
  // The narrow-layout switch only changes anything below the breakpoint, so say
  // so rather than letting it read as broken on a wide screen. An open assistant
  // rail pins the arrangement to tabs at any width, which the row has to admit
  // too, or the switch looks stuck.
  const assistantOpen = useAssistant((s) => s.open);
  const isNarrow = useContactNarrow(assistantOpen);
  const pinnedByRail = assistantOpen;

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
          <Separator />
          <ToggleRow
            title="Deal cards"
            value={dealCards === "new" ? "New" : "Current"}
            checked={dealCards === "new"}
            onCheckedChange={(c) => setDealCards(c ? "new" : "current")}
          />
          <Separator />
          <ToggleRow
            title="Narrow layout"
            value={
              pinnedByRail
                ? "Tabs · while the assistant is open"
                : `${narrowLayout === "tabs" ? "Tabs" : "Stacked"}${
                    isNarrow ? "" : " · needs < 1280px"
                  }`
            }
            checked={pinnedByRail || narrowLayout === "tabs"}
            onCheckedChange={(c) => setNarrowLayout(c ? "tabs" : "stacked")}
          />
        </Popover.Body>
      </Popover.Content>
    </Popover>
  );
}
