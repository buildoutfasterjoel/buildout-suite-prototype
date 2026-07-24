import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ButtonGroup } from "@buildoutinc/blueprint-react/ui/ButtonGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
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
import { getProperty, getStore } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import { useCreateDeal } from "#/data/useCreateDeal";
import type { Listing, PropertyStatus, DealSide } from "#/data/types";
import { DealBoard } from "#/components/deals/DealBoard";
import { requestStageChange } from "#/components/deals/useStageGate";
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
import { dealHeadlineValue } from "#/components/deals/dealDisplay";
import { isUmbrella } from "#/data/leaseSpaces";
import { commissionForecast } from "#/data/commission";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";

export const Route = createFileRoute("/_shell/listings/")({
  // `?q=` pre-fills the address/name search — e.g. deep-linking from a contact's
  // property card to all deals on that property.
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
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

// Persist the chosen view so returning to Deals reopens the last one used.
const VIEW_STORAGE_KEY = "deals:view";
const VIEW_MODES: ViewMode[] = ["board", "grid", "map"];

// Deal-side labels speak the lease vocabulary (Landlord/Tenant) when the
// Sale/Lease filter is narrowed to Lease, and the sale vocabulary
// (Seller/Buyer) otherwise.
function sideOptions(
  leaseOnly: boolean,
): { value: DealSide | "all"; label: string }[] {
  return [
    { value: "all", label: "All" },
    { value: "seller", label: leaseOnly ? "Landlord" : "Seller" },
    { value: "buyer", label: leaseOnly ? "Tenant" : "Buyer" },
  ];
}

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

  // Re-derive the board whenever the store's listings change (e.g. a gate commit).
  useEffect(() => {
    const unsub = useDataStore.subscribe((s, prev) => {
      if (s.listings !== prev.listings) setVersion((v) => v + 1);
    });
    return unsub;
  }, []);

  // Seed the search from the `?q=` param (e.g. a property address deep-link).
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q ?? "");
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [side, setSide] = useState<DealSide | "all">("all");
  const [view, setView] = useState<ViewMode>("grid");
  const isListings = view === "grid" || view === "map";

  // Restore the last-used view on mount (defaults to the listings view). Reading
  // in an effect keeps SSR rendering the default, avoiding a hydration mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored && VIEW_MODES.includes(stored as ViewMode)) {
      setView(stored as ViewMode);
    }
  }, []);

  // User-driven view switch — updates state and persists the choice.
  const selectView = useCallback((v: ViewMode) => {
    setView(v);
    window.localStorage.setItem(VIEW_STORAGE_KEY, v);
  }, []);

  const onRestage = useCallback((listingId: string, stage: PropertyStatus) => {
    // Sell-side deals open the gate; buy-side deals move directly (no listing to
    // publish). The card is never optimistically moved, so a cancelled gate
    // leaves the board unchanged. The board re-derives when the store commits,
    // via the useDataStore subscribe effect above bumping `version`.
    requestStageChange(listingId, stage);
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
        getValue: (l: Listing) => getProperty(l.propertyId)?.propertyType ?? "",
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
        const p = getProperty(l.propertyId);
        const haystack =
          `${l.name} ${p?.street ?? ""} ${p?.city ?? ""} ${p?.state ?? ""}`.toLowerCase();
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
        return arr.sort((a, b) => dealHeadlineValue(b) - dealHeadlineValue(a));
      case "price-asc":
        return arr.sort((a, b) => dealHeadlineValue(a) - dealHeadlineValue(b));
      case "cap-rate-desc":
        return arr.sort((a, b) => b.financials.capRate - a.financials.capRate);
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  // Umbrella (parent) deals are shells that hold child space deals and don't run
  // the standard pipeline workflow yet, so keep them off the board for now.
  // `version` is a dep because `isUmbrella` reads child relationships live.
  const boardListings = useMemo(
    () => sorted.filter((l) => !isUmbrella(l.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted, version],
  );

  const total = listings.length;

  // Commission forecast: each deal's commission discounted by its close
  // probability (Closed = 100%, Lost ≈ 0%), split between the logged-in broker
  // ("you") and the whole firm ("brokerage"), over the visible deals. Umbrella
  // (parent) deals are excluded — their child space listings are the real deals
  // and already carry their own commission. `version` is a dep because
  // `isUmbrella` reads child relationships live.
  const commission = useMemo(
    () => commissionForecast(filtered.filter((l) => !isUmbrella(l.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, version],
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
                              onClick={() => selectView("board")}
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
                              onClick={() => selectView("grid")}
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
                  {sideOptions(
                    saleLease.set.size === 1 && saleLease.set.has("Lease"),
                  ).map((opt) => (
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
                <div className="d-flex align-items-center gap-3">
                  <span
                    className="text-muted fs-xs text-uppercase"
                    style={{ letterSpacing: "0.04em" }}
                  >
                    Commission forecast
                  </span>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold fs-5">
                      {formatPrice(commission.you)}
                    </span>
                    <span className="text-muted fs-xs">You</span>
                  </div>
                  <Separator orientation="vertical" style={{ height: "1.5rem" }} />
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold fs-5">
                      {formatPrice(commission.brokerage)}
                    </span>
                    <span className="text-muted fs-xs">Brokerage</span>
                  </div>
                </div>
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <DealBoard listings={boardListings} onRestage={onRestage} />
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
                          onClick={() => selectView("grid")}
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
                          onClick={() => selectView("map")}
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
