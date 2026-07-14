import type { Contact } from "#/data/types";
import {
  emptyContactFilters,
  matchesContactFilters,
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";

/**
 * Quick pipeline filters — an entry-point row on the All Contacts page that
 * jumps straight to a single pipeline stage. Each button carries a fixed top
 * color bar (the stage's pipeline color, per Figma — a distinct progression
 * palette, not the softer table-pill colors), a live count, and the stage
 * label. Clicking one applies the mapped filter; the page then hides this row
 * because filters are active (see PeoplePage). No Blueprint equivalent exists,
 * so these are custom buttons styled with scoped classes in main.scss.
 */

interface QuickStage {
  key: string;
  label: string;
  /** Top-bar color — hex of a Blueprint palette token. */
  color: string;
  /** The filter this stage applies (built onto an empty filter set). */
  apply: (f: ContactFilterState) => ContactFilterState;
}

const STAGES: QuickStage[] = [
  {
    key: "cold",
    label: "Cold",
    color: "#1cd4f4", // seagull-400
    apply: (f) => ({ ...f, relationship: new Set(["cold"]) }),
  },
  {
    key: "nurturing",
    label: "Nurturing",
    color: "#ff5961", // solid-pink-400
    apply: (f) => ({ ...f, relationship: new Set(["nurturing"]) }),
  },
  {
    key: "pitching",
    label: "Pitching",
    color: "#fd9a00", // harvest-gold-500
    apply: (f) => ({ ...f, dealStage: new Set(["pitching"]) }),
  },
  {
    key: "active",
    label: "Active",
    color: "#3f86f2", // buildout-blue-500
    apply: (f) => ({
      ...f,
      dealStage: new Set(["active_search", "active_listing"]),
    }),
  },
  {
    key: "under_contract",
    label: "Under Contract",
    color: "#9f55f7", // purple-heart-500
    apply: (f) => ({ ...f, dealStage: new Set(["under_contract"]) }),
  },
  {
    key: "closed",
    label: "Closed",
    color: "#00bc7d", // mountain-meadow-500
    apply: (f) => ({ ...f, dealStage: new Set(["closed"]) }),
  },
];

export function QuickPipelineFilters({
  contacts,
  onSelect,
}: {
  contacts: Contact[];
  onSelect: (next: ContactFilterState) => void;
}) {
  return (
    <div className="quick-pipeline-filters">
      <div className="quick-pipeline-filters__label fs-small fw-semibold text-uppercase text-muted mb-2">
        Quick Pipeline Filters
      </div>
      <div className="quick-pipeline-filters__row d-flex gap-2 flex-wrap">
        {STAGES.map((stage) => {
          // Count via the same predicate the filter uses, so the number equals
          // the result the button produces (ignoring any active search).
          const patch = stage.apply(emptyContactFilters());
          const count = contacts.filter((c) =>
            matchesContactFilters(c, patch),
          ).length;
          return (
            <button
              key={stage.key}
              type="button"
              className="quick-filter-btn"
              onClick={() => onSelect(patch)}
            >
              <span
                className="quick-filter-btn__bar"
                style={{ background: stage.color }}
              />
              <span className="quick-filter-btn__count">{count}</span>
              <span className="quick-filter-btn__label">{stage.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
