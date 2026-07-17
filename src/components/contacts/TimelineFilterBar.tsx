import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import {
  FILTER_TABS,
  filterCounts,
  type FilterKey,
  type TimelineEvent,
} from "#/components/contacts/timeline";

/**
 * Above-feed filter tabs with live counts (Blueprint Tabs). Tab set mirrors the
 * spec minus the excluded channels: All · Notes · Calls · Emails · Meetings ·
 * Tours · Attachments · Activity · Marketing · Starred. Scrolls horizontally in
 * the narrow column.
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
      <Tabs value={value} onValueChange={(v) => v && onChange(v as FilterKey)}>
        <Tabs.List>
          {FILTER_TABS.map((t) => (
            <Tabs.Tab key={t.key} value={t.key}>
              {t.label}
              <span className="tl-filterbar__count">{counts[t.key]}</span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
  );
}
