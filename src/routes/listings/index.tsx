import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ButtonGroup } from "@buildoutinc/blueprint-react/ui/ButtonGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTableCellsLarge,
  faLocationDot,
  faMagnifyingGlass,
  faUserGroupSimple,
  faArrowDownWideShort,
  faCirclePlus,
} from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import type { Listing } from "#/data/types";
import { PropertyGrid } from "#/components/properties/PropertyGrid";
import { PropertyMap } from "#/components/properties/PropertyMap";
import {
  PropertyFilters,
  type Facet,
} from "#/components/properties/PropertyFilters";
import {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  TYPE_LABELS,
  STATUS_LABELS,
} from "#/components/properties/propertyDisplay";
import {
  SALE_LEASE_OPTIONS,
  EXPIRATION_OPTIONS,
  getSaleLease,
  getExpiration,
} from "#/components/properties/propertyFacets";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { NewListingModal } from "#/components/listings/NewListingModal";

export const Route = createFileRoute("/listings/")({
  component: PropertyListings,
  head: () => ({
    meta: [{ title: "Deals | Buildout Suite" }],
  }),
});

type ViewMode = "grid" | "map";
type SortBy =
  | "default"
  | "name-asc"
  | "name-desc"
  | "price-desc"
  | "price-asc"
  | "cap-rate-desc";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "cap-rate-desc", label: "Cap Rate: High → Low" },
];
const SORT_LABELS = Object.fromEntries(
  SORT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SortBy, string>;

/** Toggle a value in a Set held in state. */
function useToggleSet<T extends string>() {
  const [set, setSet] = useState<Set<T>>(() => new Set());
  const toggle = useCallback((value: T) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSet(new Set()), []);
  return { set, toggle, clear };
}

function PropertyListings() {
  const listings = useMemo(() => Array.from(getStore().listings.values()), []);

  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [newOpen, setNewOpen] = useState(false);

  const status = useToggleSet<string>();
  const type = useToggleSet<string>();
  const saleLease = useToggleSet<string>();
  const expiration = useToggleSet<string>();

  const facets: Facet[] = useMemo(
    () => [
      {
        id: "status",
        title: "Deal",
        options: PROPERTY_STATUSES.map((s) => ({
          value: s,
          label: STATUS_LABELS[s],
        })),
        getValue: (l: Listing) => l.status,
        selected: status.set,
        toggle: status.toggle,
      },
      {
        id: "expiration",
        title: "Expiration",
        options: EXPIRATION_OPTIONS.map((e) => ({ value: e, label: e })),
        getValue: getExpiration,
        selected: expiration.set,
        toggle: expiration.toggle,
      },
      {
        id: "saleLease",
        title: "Sale / Lease",
        options: SALE_LEASE_OPTIONS.map((s) => ({ value: s, label: s })),
        getValue: getSaleLease,
        selected: saleLease.set,
        toggle: saleLease.toggle,
      },
      {
        id: "type",
        title: "Property Types",
        options: PROPERTY_TYPES.map((t) => ({
          value: t,
          label: TYPE_LABELS[t],
        })),
        getValue: (l: Listing) => l.propertyType,
        selected: type.set,
        toggle: type.toggle,
      },
    ],
    [status, expiration, saleLease, type],
  );

  const clearAll = useCallback(() => {
    status.clear();
    type.clear();
    saleLease.clear();
    expiration.clear();
  }, [status, type, saleLease, expiration]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      for (const facet of facets) {
        if (facet.selected.size && !facet.selected.has(facet.getValue(l)))
          return false;
      }
      if (q) {
        const haystack =
          `${l.name} ${l.street} ${l.city} ${l.state}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [listings, facets, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "name-asc":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return arr.sort((a, b) => b.name.localeCompare(a.name));
      case "price-desc":
        return arr.sort((a, b) => b.askingPrice - a.askingPrice);
      case "price-asc":
        return arr.sort((a, b) => a.askingPrice - b.askingPrice);
      case "cap-rate-desc":
        return arr.sort((a, b) => b.capRate - a.capRate);
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  const total = listings.length;

  return (
    <div className="d-flex flex-column h-100 overflow-hidden">
      {/* Page header — matches Pipeline */}
      <div className="border-bottom bg-card">
        <div className="container py-4 d-flex align-items-center justify-content-between">
          <div className="d-flex flex-column">
            <h1 className="fs-4 fw-semibold mb-0">Deals</h1>
            <span className="text-muted">
              {filtered.length} {filtered.length === 1 ? "deal" : "deals"}
              {filtered.length !== total && ` of ${total}`}
            </span>
          </div>
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <FontAwesomeIcon icon={faCirclePlus} />
            New Deal
          </Button>
        </div>
      </div>

      <NewListingModal open={newOpen} onOpenChange={setNewOpen} />

      {/* Toolbar card */}
      <div className="py-3 d-flex flex-column gap-3">
        <div className="container">
          <div className="row">
            <div className="col">
              <Card className="shadow">
                <Card.Body className="d-flex align-items-center gap-2 p-3">
                  {/* Left: search + members + sort */}
                  <div className="d-flex align-items-center gap-2 flex-grow-1">
                    <div className="flex-grow-1" style={{ maxWidth: 320 }}>
                      <InputGroup>
                        <InputGroup.Addon>
                          <FontAwesomeIcon icon={faMagnifyingGlass} />
                        </InputGroup.Addon>
                        <Input
                          type="search"
                          placeholder="Search by Address…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </InputGroup>
                    </div>
                    <div>
                      <InputGroup>
                        <InputGroup.Addon>
                          <FontAwesomeIcon icon={faUserGroupSimple} />
                        </InputGroup.Addon>
                        <Input placeholder="All Members" readOnly />
                      </InputGroup>
                    </div>
                    <div>
                      <Select
                        value={sortBy}
                        onValueChange={(v) => setSortBy(v as SortBy)}
                      >
                        <Select.Trigger>
                          <FontAwesomeIcon
                            icon={faArrowDownWideShort}
                            className="me-2"
                          />
                          <Select.Value>
                            {(v) =>
                              v === "default"
                                ? "Sort By"
                                : SORT_LABELS[v as SortBy]
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Content>
                          {SORT_OPTIONS.map((opt) => (
                            <Select.Item key={opt.value} value={opt.value}>
                              {opt.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                  </div>

                  {/* Right: view toggle + count */}
                  <div className="d-flex align-items-center gap-3 ms-auto">
                    <span className="text-muted text-nowrap">
                      Displaying {filtered.length} of {total} Deals
                    </span>
                    <ButtonGroup aria-label="View switcher">
                      <Tooltip>
                        <Tooltip.Trigger
                          render={
                            <Button
                              variant="outline"
                              className={view === "grid" ? "active" : ""}
                              size="icon"
                              onClick={() => setView("grid")}
                              aria-pressed={view === "grid"}
                              aria-label="Grid view"
                            >
                              <FontAwesomeIcon icon={faTableCellsLarge} />
                            </Button>
                          }
                        />
                        <Tooltip.Content>Grid</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Tooltip.Trigger
                          render={
                            <Button
                              variant="outline"
                              className={view === "map" ? "active" : ""}
                              size="icon"
                              onClick={() => setView("map")}
                              aria-pressed={view === "map"}
                              aria-label="Map view"
                            >
                              <FontAwesomeIcon icon={faLocationDot} />
                            </Button>
                          }
                        />
                        <Tooltip.Content>Map</Tooltip.Content>
                      </Tooltip>
                    </ButtonGroup>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar + content */}
      <div className="container flex-grow-1 overflow-hidden d-flex flex-column pb-3">
        <div className="row gx-3 flex-grow-1 overflow-hidden">
          <div className="col-2 overflow-auto h-100">
            <PropertyFilters
              listings={listings}
              facets={facets}
              onClearAll={clearAll}
            />
          </div>
          <div className="col-10 d-flex flex-column overflow-hidden h-100">
            <Card className="flex-grow-1 overflow-hidden d-flex flex-column">
              {view === "grid" ? (
                <div className="flex-grow-1 overflow-y-auto overflow-x-hidden">
                  <Card.Body>
                    <PropertyGrid listings={sorted} />
                  </Card.Body>
                </div>
              ) : (
                <Card.Body>
                  <PropertyMap listings={sorted} />
                </Card.Body>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
