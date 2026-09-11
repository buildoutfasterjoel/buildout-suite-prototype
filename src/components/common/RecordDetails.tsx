import { useState, type ReactNode } from "react";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface DetailRow {
  label: string;
  /** Empty (`null`, `undefined`, `""`) renders as `--`, the way Buildout's own page does. */
  value: ReactNode;
}

export interface DetailsSection {
  key: string;
  title: string;
  icon: IconDefinition;
  rows: DetailRow[];
  /** Optional control at the heading's far right — e.g. an "Edit on deal" link. */
  action?: ReactNode;
}

/**
 * A record's facts, laid out the way Buildout's property details page lays them
 * out: an optional "Filter … Details" box, then one section per topic — a purple
 * glyph and a 17px heading — with each fact as a two-column row (semibold label
 * in the left half, value in the right) under a hairline divider. Empty values
 * read `--` rather than dropping the row, so the shape of the record is the
 * same for every property and a broker learns where to look.
 *
 * The filter matches on labels and hides sections with nothing left in them.
 */
export function RecordDetails({
  sections,
  filter,
}: {
  sections: DetailsSection[];
  /** When set, renders the filter box with this as its field label. */
  filter?: { label: string };
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = sections
    .map((s) => ({
      ...s,
      rows: q ? s.rows.filter((r) => r.label.toLowerCase().includes(q)) : s.rows,
    }))
    .filter((s) => s.rows.length > 0);

  return (
    <div className="record-details d-flex flex-column gap-6">
      {/* The grey well is what separates the control from the facts below it on
          Buildout's page — the filter acts on the list, so it sits apart from it. */}
      {filter && (
        <Field className="rounded p-3" style={{ background: "var(--color-storm-grey-50, #f6f7f9)" }}>
          <Field.Label className="fw-semibold">{filter.label}</Field.Label>
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faFilter} />
            </InputGroup.Addon>
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter Details..."
              aria-label={filter.label}
            />
          </InputGroup>
        </Field>
      )}

      {visible.length === 0 ? (
        <div className="text-muted fs-small">No details match &ldquo;{query.trim()}&rdquo;.</div>
      ) : (
        visible.map((s) => (
          <section key={s.key} className="record-details__section">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <h6 className="d-flex align-items-center gap-2 mb-0 fw-semibold record-details__heading">
                <FontAwesomeIcon icon={s.icon} />
                {s.title}
              </h6>
              {s.action}
            </div>
            {s.rows.map((r) => (
              <div key={r.label} className="d-flex gap-2 border-bottom py-1">
                <div className="fw-semibold w-50">{r.label}</div>
                <div className="w-50 text-break">
                  {r.value === null || r.value === undefined || r.value === "" ? (
                    <span className="text-muted">--</span>
                  ) : (
                    r.value
                  )}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
