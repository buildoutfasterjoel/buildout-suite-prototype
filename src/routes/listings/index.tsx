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
  faMagnifyingGlass,
  faUserGroupSimple,
  faArrowDownWideShort,
  faCirclePlus,
  faSign,
  faTableColumns,
  faTableCellsLarge,
  faLocationDot,
} from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { updateDealStage } from "#/data/actions";
import { useCreateDeal } from "#/data/useCreateDeal";
import type { Listing, PropertyStatus, DealSide } from "#/data/types";
import { DealBoard } from "#/components/deals/DealBoard";
import type { Facet } from "#/components/properties/PropertyFilters";
import { PropertyFilters } from "#/components/properties/PropertyFilters";
import { FacetDropdown } from "#/components/properties/FacetDropdown";
import { PropertyGrid } from "#/components/properties/PropertyGrid";
import { PropertyMap } from "#/components/properties/PropertyMap";
import {
  PROPERTY_TYPES,
  TYPE_LABELS,
  PROPERTY_STATUSES,
  STATUS_LABELS,
  formatPrice,
} from "#/components/properties/propertyDisplay";
import {
  SALE_LEASE_OPTIONS,
  EXPIRATION_OPTIONS,
  getSaleLease,
  getExpiration,
} from "#/components/properties/propertyFacets";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";

export const Route = createFileRoute("/listings/")({
  component: PropertyListings,
  head: () => ({
    meta: [{ title: "Deals | Buildout Suite" }],
  }),
});

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

type ViewMode = "board" | "grid" | "map";

const SIDE_OPTIONS: { value: DealSide | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "seller", label: "Seller" },
  { value: "buyer", label: "Buyer" },
];

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
  // Bumped when a deal is re-staged so the derived lists recompute.
  const [version, setVersion] = useState(0);
  const listings = useMemo(
    () => Array.from(getStore().listings.values()),
    [version],
  );

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [side, setSide] = useState<DealSide | "all">("all");
  const [view, setView] = useState<ViewMode>("board");
  const isListings = view === "grid" || view === "map";

  const onRestage = useCallback((listingId: string, stage: PropertyStatus) => {
    const listing = getStore().listings.get(listingId);
    if (!listing || listing.status === stage) return;
    updateDealStage(listingId, stage);
    // Local re-render bump: this list reads getStore() non-reactively and
    // re-derives the filtered/sorted board from the now-updated store.
    setVersion((v) => v + 1);
  }, []);

  const type = useToggleSet<string>();
  const saleLease = useToggleSet<string>();
  const expiration = useToggleSet<string>();
  const stage = useToggleSet<PropertyStatus>();

  // The stage/"Deal" facet lives on the board columns now, so it's dropped here.
  const facets: Facet[] = useMemo(
    () => [
      {
        id: "type",
        title: "Property Type",
        options: PROPERTY_TYPES.map((t) => ({
          value: t,
          label: TYPE_LABELS[t],
        })),
        getValue: (l: Listing) => l.propertyType,
        selected: type.set,
        toggle: type.toggle,
        clear: type.clear,
      },
      {
        id: "saleLease",
        title: "Sale / Lease",
        options: SALE_LEASE_OPTIONS.map((s) => ({ value: s, label: s })),
        getValue: getSaleLease,
        selected: saleLease.set,
        toggle: saleLease.toggle,
        clear: saleLease.clear,
      },
      {
        id: "expiration",
        title: "Expiration",
        options: EXPIRATION_OPTIONS.map((e) => ({ value: e, label: e })),
        getValue: getExpiration,
        selected: expiration.set,
        toggle: expiration.toggle,
        clear: expiration.clear,
      },
    ],
    [expiration, saleLease, type],
  );

  // Stage/deal-status facet — only surfaced in the Listings sidebar since the
  // Kanban board already visualizes stage via its columns.
  const stageFacet: Facet = useMemo(
    () => ({
      id: "status",
      title: "Stage",
      options: PROPERTY_STATUSES.map((s) => ({
        value: s,
        label: STATUS_LABELS[s],
      })),
      getValue: (l: Listing) => l.status,
      selected: stage.set,
      toggle: (v: string) => stage.toggle(v as PropertyStatus),
      clear: stage.clear,
    }),
    [stage],
  );

  const sidebarFacets = useMemo(
    () => [stageFacet, ...facets],
    [facets, stageFacet],
  );

  const clearAll = useCallback(() => {
    type.clear();
    saleLease.clear();
    expiration.clear();
    stage.clear();
  }, [type, saleLease, expiration, stage]);

  // Option counts across the full dataset for the dropdown/sidebar badges.
  const countsByFacet = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const facet of sidebarFacets) {
      const counts: Record<string, number> = {};
      for (const l of listings) {
        const v = facet.getValue(l);
        counts[v] = (counts[v] ?? 0) + 1;
      }
      result[facet.id] = counts;
    }
    return result;
  }, [sidebarFacets, listings]);

  const activeFilterCount = facets.reduce((n, f) => n + f.selected.size, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      if (side !== "all" && l.dealSide !== side) return false;
      for (const facet of sidebarFacets) {
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
  }, [listings, sidebarFacets, search, side]);

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

  // Weighted pipeline forecast: each deal's value discounted by its close
  // probability (Closed = 100%, Lost ≈ 0%), summed over the visible deals.
  const weightedForecast = useMemo(
    () =>
      filtered.reduce(
        (sum, l) => sum + l.askingPrice * (l.transaction.closeProbability / 100),
        0,
      ),
    [filtered],
  );

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
          <Button
            variant="primary"
            onClick={() => useCreateDeal.getState().openFor()}
          >
            <FontAwesomeIcon icon={faCirclePlus} />
            New Deal
          </Button>
        </div>
      </div>

      {/* Toolbar card */}
      <div className="py-3 d-flex flex-column gap-3">
        <div className="container">
          <div className="row">
            <div className="col">
              <Card className="shadow">
                <Card.Body className="d-flex align-items-center gap-2 p-3">
                  {/* Left: search + members + sort + filters */}
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

                    {/* Facet filters — move to the sidebar in Listings view */}
                    {!isListings && (
                      <>
                        {facets.map((facet) => (
                          <FacetDropdown
                            key={facet.id}
                            facet={facet}
                            counts={countsByFacet[facet.id]}
                          />
                        ))}
                        {activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={clearAll}
                            className="btn btn-link btn-sm text-decoration-none text-nowrap"
                          >
                            Clear filters
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right: count + view switcher */}
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
                              size="icon"
                              className={view === "board" ? "active" : ""}
                              onClick={() => setView("board")}
                              aria-pressed={view === "board"}
                              aria-label="Pipeline view"
                            >
                              <FontAwesomeIcon icon={faTableColumns} />
                            </Button>
                          }
                        />
                        <Tooltip.Content>Pipeline View</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Tooltip.Trigger
                          render={
                            <Button
                              variant="outline"
                              size="icon"
                              className={isListings ? "active" : ""}
                              onClick={() => setView("grid")}
                              aria-pressed={isListings}
                              aria-label="Listings view"
                            >
                              <FontAwesomeIcon icon={faSign} />
                            </Button>
                          }
                        />
                        <Tooltip.Content>Listings View</Tooltip.Content>
                      </Tooltip>
                    </ButtonGroup>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {view === "board" ? (
        <div className="container flex-grow-1 overflow-hidden d-flex flex-column pb-3">
          <Card className="flex-grow-1 overflow-hidden d-flex flex-column">
            <Card.Body className="flex-grow-1 overflow-hidden d-flex flex-column gap-3">
              <div className="d-flex align-items-baseline justify-content-between gap-3">
                <ButtonGroup aria-label="Deal side">
                  {SIDE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant="outline"
                      className={` border-storm-grey-300 ${side === opt.value ? "active" : ""}`}
                      onClick={() => setSide(opt.value)}
                      aria-pressed={side === opt.value}
                      appearance="muted"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </ButtonGroup>
                <div className="d-flex align-items-baseline gap-2">
                  <span
                    className="text-muted fs-xs text-uppercase"
                    style={{ letterSpacing: "0.04em" }}
                  >
                    Weighted forecast
                  </span>
                  <span className="fw-bold fs-5">
                    {formatPrice(weightedForecast)}
                  </span>
                </div>
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <DealBoard listings={sorted} onRestage={onRestage} />
              </div>
            </Card.Body>
          </Card>
        </div>
      ) : (
        <div className="container flex-grow-1 d-flex overflow-hidden gap-4 pb-3">
          <PropertyFilters
            listings={listings}
            facets={sidebarFacets}
            onClearAll={clearAll}
          />
          <Card className="flex-grow-1 overflow-hidden d-flex flex-column">
            <Card.Body className="flex-grow-1 overflow-hidden d-flex flex-column gap-3">
              <div className="align-self-end">
                <ButtonGroup aria-label="Property layout switcher">
                  <Tooltip>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          className={view === "grid" ? "active" : ""}
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
                          size="icon"
                          className={view === "map" ? "active" : ""}
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
              <div className="flex-grow-1 overflow-y-auto overflow-x-hidden">
                {view === "grid" ? (
                  <PropertyGrid listings={sorted} />
                ) : (
                  <PropertyMap listings={sorted} />
                )}
              </div>
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  );
}
