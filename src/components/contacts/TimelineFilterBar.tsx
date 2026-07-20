import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  FILTER_TABS,
  FILTER_ICON,
  filterCounts,
  type FilterKey,
  type TimelineEvent,
} from "#/components/contacts/timeline";

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
              // "All" stays a text label in the tab track (the list icon is a
              // dropdown-only treatment).
              const icon = t.key === "all" ? undefined : FILTER_ICON[t.key];
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
