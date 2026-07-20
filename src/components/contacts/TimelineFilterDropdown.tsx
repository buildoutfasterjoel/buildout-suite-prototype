import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  FILTER_TABS,
  FILTER_ICON,
  filterCounts,
  type FilterKey,
  type TimelineEvent,
} from "#/components/contacts/timeline";

const LABELS = Object.fromEntries(
  FILTER_TABS.map((t) => [t.key, t.label]),
) as Record<FilterKey, string>;

/**
 * Alternate timeline filter: a type dropdown (with per-type counts) plus a
 * "Needs Reply" checkbox that narrows the feed to the rows still needing
 * attention (missed calls, unreplied emails, open inquiries). Toggleable
 * against the pill-track filter via the floating design toggle.
 */
export function TimelineFilterDropdown({
  events,
  value,
  onChange,
  needsReply,
  onNeedsReplyChange,
  attentionCount,
}: {
  events: TimelineEvent[];
  value: FilterKey;
  onChange: (key: FilterKey) => void;
  needsReply: boolean;
  onNeedsReplyChange: (on: boolean) => void;
  attentionCount: number;
}) {
  const counts = filterCounts(events);
  return (
    <div className="tl-filter-controls">
      <label className={`tl-needs-reply ${needsReply ? "is-on" : ""}`}>
        <Checkbox
          checked={needsReply}
          onCheckedChange={(checked) => onNeedsReplyChange(!!checked)}
        />
        <span>Needs Reply</span>
        <span className="tl-needs-reply__count">{attentionCount}</span>
      </label>

      <Select value={value} onValueChange={(v) => v && onChange(v as FilterKey)}>
        <Select.Trigger className="tl-filter-select" aria-label="Filter timeline by type">
          <Select.Value>
            {(v) => {
              const key = (v as FilterKey) ?? "all";
              const icon = FILTER_ICON[key];
              return (
                <span className="tl-filter-item__value">
                  {icon && <FontAwesomeIcon icon={icon} className="tl-filter-item__icon" />}
                  {LABELS[key] ?? "All"}
                </span>
              );
            }}
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          {FILTER_TABS.map((t) => {
            const icon = FILTER_ICON[t.key];
            return (
              <Select.Item key={t.key} value={t.key}>
                <span className="tl-filter-item">
                  {icon && <FontAwesomeIcon icon={icon} className="tl-filter-item__icon" />}
                  <span className="tl-filter-item__label">{t.label}</span>
                  <span className="tl-filter-item__count">{counts[t.key]}</span>
                </span>
              </Select.Item>
            );
          })}
        </Select.Content>
      </Select>
    </div>
  );
}
