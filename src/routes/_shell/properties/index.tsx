import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faBuilding } from "@fortawesome/pro-regular-svg-icons";
import type { PropertyType, PropertyStatus } from "#/data/types";
import { getStore } from "#/data/store";
import { listDealsForProperty } from "#/data/selectors";
import { PropertyRecordCard } from "#/components/properties/PropertyRecordCard";
import { filterProperties } from "#/components/properties/propertyIndexFilters";
import {
  PROPERTY_TYPES,
  TYPE_LABELS,
  PROPERTY_STATUSES,
  STATUS_LABELS,
} from "#/components/properties/propertyDisplay";

export const Route = createFileRoute("/_shell/properties/")({
  component: PropertiesIndex,
  head: () => ({ meta: [{ title: "Properties | Buildout Suite" }] }),
});

function PropertiesIndex() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PropertyType | "all">("all");
  const [status, setStatus] = useState<PropertyStatus | "all">("all");

  const all = useMemo(() => [...getStore().properties.values()], []);
  const dealCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) m.set(p.id, listDealsForProperty(p.id).length);
    return m;
  }, [all]);

  const results = useMemo(
    () =>
      filterProperties(all, {
        query,
        types: type === "all" ? new Set() : new Set([type]),
        statuses: status === "all" ? new Set() : new Set([status]),
      }).sort((a, b) => a.name.localeCompare(b.name)),
    [all, query, type, status],
  );

  return (
    <div className="container py-4 d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h1 className="h4 mb-0">Properties</h1>
        <span className="text-muted fs-small">{results.length} of {all.length}</span>
      </div>

      <div className="d-flex flex-wrap gap-2">
        <InputGroup style={{ maxWidth: 320 }}>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-muted" />
          </InputGroup.Addon>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address, name, submarket…"
            aria-label="Search properties"
          />
        </InputGroup>

        <Select value={type} onValueChange={(v) => setType(v as PropertyType | "all")}>
          <Select.Trigger style={{ minWidth: 160 }}><Select.Value placeholder="Type" /></Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All types</Select.Item>
            {PROPERTY_TYPES.map((t) => (
              <Select.Item key={t} value={t}>{TYPE_LABELS[t]}</Select.Item>
            ))}
          </Select.Content>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus(v as PropertyStatus | "all")}>
          <Select.Trigger style={{ minWidth: 160 }}><Select.Value placeholder="Status" /></Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All statuses</Select.Item>
            {PROPERTY_STATUSES.map((s) => (
              <Select.Item key={s} value={s}>{STATUS_LABELS[s]}</Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      {results.length === 0 ? (
        <div className="d-flex align-items-center justify-content-center p-8">
          <Empty>
            <Empty.Media>
              <FontAwesomeIcon icon={faBuilding} aria-label="No properties" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No properties match your filters</Empty.Title>
              Try clearing the search or changing the type/status.
            </Empty.Content>
          </Empty>
        </div>
      ) : (
        <div className="row g-3">
          {results.map((p) => (
            <div key={p.id} className="col-md-6 col-lg-4 col-xl-3">
              <Link
                to="/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="text-decoration-none text-reset d-block h-100"
              >
                <PropertyRecordCard property={p} dealCount={dealCounts.get(p.id) ?? 0} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
