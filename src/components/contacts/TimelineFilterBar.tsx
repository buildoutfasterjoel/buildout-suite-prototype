import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faNoteSticky,
  faPhone,
  faEnvelope,
  faCalendar,
  faBinoculars,
} from "@fortawesome/pro-regular-svg-icons";
import {
  FILTER_TABS,
  filterCounts,
  type FilterKey,
  type TimelineEvent,
} from "#/components/contacts/timeline";

/**
 * Icon per filter tab. "All" keeps its text label (no icon); every other tab is
 * icon-only with the label surfaced via tooltip. Meetings/Tours reuse the
 * compose-tab icons (calendar / binoculars).
 */
const FILTER_ICON: Partial<Record<FilterKey, IconDefinition>> = {
  notes: faNoteSticky,
  calls: faPhone,
  emails: faEnvelope,
  meetings: faCalendar,
  tours: faBinoculars,
};

/**
 * Above-feed filter as pill tabs with live counts. Icon-only (except All), each
 * with a hover tooltip carrying its label. Scrolls horizontally in the narrow
 * column.
 */
export function TimelineFilterBar({
  events,
  value,
  onChange,
}: {
  events: TimelineEvent[];
  value: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  const counts = filterCounts(events);
  return (
    <div className="tl-filterbar">
      <Tooltip.Provider delay={150}>
        <Tabs value={value} onValueChange={(v) => v && onChange(v as FilterKey)}>
          <Tabs.List variant="pills">
            {FILTER_TABS.map((t) => {
              const icon = FILTER_ICON[t.key];
              const tab = (
                <Tabs.Tab
                  key={t.key}
                  value={t.key}
                  aria-label={t.label}
                  icon={icon ? <FontAwesomeIcon icon={icon} /> : undefined}
                >
                  {t.key === "all" && <span className="tl-filterbar__label">All</span>}
                  <span className="tl-filterbar__count">{counts[t.key]}</span>
                </Tabs.Tab>
              );
              // "All" carries its own label, so it needs no tooltip.
              if (t.key === "all") return tab;
              return (
                <Tooltip key={t.key}>
                  <Tooltip.Trigger render={tab} />
                  <Tooltip.Content>{t.label}</Tooltip.Content>
                </Tooltip>
              );
            })}
          </Tabs.List>
        </Tabs>
      </Tooltip.Provider>
    </div>
  );
}
