import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";

/** A filterable facet: its options, how to read a property's value, and its selection state. */
export interface Facet {
  id: string;
  title: string;
  options: readonly { value: string; label: string }[];
  getValue: (p: Property) => string;
  selected: Set<string>;
  toggle: (value: string) => void;
}

export interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

function FacetSection({
  facet,
  counts,
}: {
  facet: Facet;
  counts: Record<string, number>;
}) {
  return (
    <div className="mb-4">
      <h2
        className="fw-semibold mb-2"
        style={{ fontSize: 17, color: "#22262f" }}
      >
        {facet.title}
      </h2>
      <div className="d-flex flex-column">
        {facet.options.map((opt) => {
          const active = facet.selected.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => facet.toggle(opt.value)}
              aria-pressed={active}
              className="d-flex w-100 align-items-center justify-content-between bg-transparent border-0 px-0 py-1 text-start"
              style={{ cursor: "pointer" }}
            >
              <span
                className={active ? "fw-semibold text-primary" : "text-body"}
              >
                {opt.label}
              </span>
              <span
                className={active ? "fw-semibold text-primary" : "text-muted"}
              >
                {counts[opt.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PropertyFilters({
  properties,
  facets,
  onClearAll,
}: {
  properties: Property[];
  facets: Facet[];
  onClearAll: () => void;
}) {
  // Totals per option across the full dataset (faceted look, like the mock).
  const countsByFacet = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const facet of facets) {
      const counts: Record<string, number> = {};
      for (const p of properties) {
        const v = facet.getValue(p);
        counts[v] = (counts[v] ?? 0) + 1;
      }
      result[facet.id] = counts;
    }
    return result;
  }, [properties, facets]);

  const chips: ActiveChip[] = facets.flatMap((facet) =>
    [...facet.selected].map((value) => ({
      key: `${facet.id}:${value}`,
      label: facet.options.find((o) => o.value === value)?.label ?? value,
      remove: () => facet.toggle(value),
    })),
  );

  return (
    <Card className="overflow-auto shadow flex-shrink-0" style={{ width: 248 }}>
      {/* Active Filters */}
      <Card.Body className="mb-4">
        <div className="d-flex align-items-baseline justify-content-between mb-2">
          <h2
            className="fw-semibold mb-0"
            style={{ fontSize: 17, color: "#22262f" }}
          >
            Active Filters
          </h2>
          {chips.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="btn btn-link btn-sm p-0 text-decoration-none"
              style={{ fontSize: 12 }}
            >
              Clear all
            </button>
          )}
        </div>
        {chips.length === 0 ? (
          <p className="text-muted mb-0" style={{ fontSize: 12 }}>
            No filters applied
          </p>
        ) : (
          <div className="d-flex flex-wrap gap-1">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.remove}
                className="p-0 border-0 bg-transparent d-inline-flex"
                aria-label={`Remove ${chip.label} filter`}
              >
                <Badge
                  variant="secondary"
                  className="d-inline-flex align-items-center gap-1"
                >
                  {chip.label}
                  <FontAwesomeIcon icon={faXmark} />
                </Badge>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4">
          {facets.map((facet) => (
            <FacetSection
              key={facet.id}
              facet={facet}
              counts={countsByFacet[facet.id]}
            />
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
