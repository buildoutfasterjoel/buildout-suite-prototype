import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ButtonGroup } from "@buildoutinc/blueprint-react/ui/ButtonGroup";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faBuilding,
  faBuildings,
  faCaretDown,
  faFilter,
  faLocationDot,
  faRadar,
  faTableList,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getProspectProperties, INSIGHTS_RECORD_TOTAL } from "#/data/prospects";
import type { ProspectOwnerContact } from "#/data/prospectOwners";
import { saveProspectContact } from "#/data/prospectActions";
import { notify } from "#/lib/notify";
import { PropertyListRow } from "#/components/properties/PropertyListRow";
import { PropertyRecordMap } from "#/components/properties/PropertyRecordMap";
import { AddProspectDialog } from "#/components/properties/AddProspectDialog";
import { ProspectFlyout } from "#/components/properties/ProspectFlyout";
import { PropertyFilterPills } from "#/components/properties/PropertyFilterPills";
import {
  PropertyFiltersFlyout,
  EMPTY_FACETS,
  countActiveFacets,
  type PropertyFacetState,
} from "#/components/properties/PropertyFiltersFlyout";
import { filterProperties } from "#/components/properties/propertyIndexFilters";

export const Route = createFileRoute("/_shell/properties/")({
  component: PropertiesIndex,
  head: () => ({ meta: [{ title: "Properties | Buildout Suite" }] }),
});

/**
 * The two halves of one surface. "My Properties" is your company's database;
 * "Prospecting" is the Buildout Insights record set — the same map and the same
 * result rail, sourced from public records instead of your book. They used to
 * be separate pages; the toggle is what merges them.
 */
type Mode = "owned" | "prospect";

const MODES: Mode[] = ["owned", "prospect"];

/**
 * Persist the chosen mode so leaving the page and coming back — to open a
 * contact the prospecting flow just created, say — returns you to the half you
 * were working in rather than snapping back to My Properties.
 */
const MODE_STORAGE_KEY = "properties:mode";

function PropertiesIndex() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("owned");
  const [query, setQuery] = useState("");
  const [facets, setFacets] = useState<PropertyFacetState>(EMPTY_FACETS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Visual only — the table view isn't built yet (see `viewSwitcher`).
  const [resultsView, setResultsView] = useState<"map" | "table">("map");

  // Subscribed rather than read once: adding a prospect writes here, and both
  // the owned list and the prospect rows' "Added" state must follow.
  const propertiesMap = useDataStore((s) => s.properties);

  const owned = useMemo(() => [...propertiesMap.values()], [propertiesMap]);
  const prospects = useMemo(() => getProspectProperties(), []);

  const source = mode === "owned" ? owned : prospects;

  /**
   * The facets actually in force. Deal stage is meaningless on a record you
   * don't own, so it drops out in prospect mode — and everything that reports
   * on filtering (the results, the Filters count, the pills) reads this rather
   * than raw state, so none of them can claim a filter the list isn't applying.
   * The user's stage choice is preserved in `facets` and returns with the mode.
   */
  const appliedFacets: PropertyFacetState = useMemo(
    () => ({ ...facets, status: mode === "owned" ? facets.status : "all" }),
    [facets, mode],
  );

  const results = useMemo(
    () =>
      filterProperties(source, {
        query,
        types:
          appliedFacets.type === "all" ? new Set() : new Set([appliedFacets.type]),
        statuses:
          appliedFacets.status === "all"
            ? new Set()
            : new Set([appliedFacets.status]),
        size: appliedFacets.size,
      }).sort((a, b) => (a.street || a.name).localeCompare(b.street || b.name)),
    [source, query, appliedFacets],
  );

  // The prospecting overlays. `flyoutId` rather than the record itself so the
  // flyout always reads the current object out of `results`.
  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<Property | null>(null);

  // Saving an owner contact takes the action directly rather than through a
  // confirm step: the roster row turns into "View Contact" on the spot, which
  // says what happened better than a modal would have.
  const onSaveContact = useCallback(
    (property: Property, owner: ProspectOwnerContact) => {
      const { contact, alreadySaved } = saveProspectContact(property, owner);
      notify({
        title: alreadySaved ? "Already in your contacts" : "Contact saved",
        description: `${contact.firstName} ${contact.lastName} is linked to ${property.street || property.name}.`,
      });
    },
    [],
  );

  const flyoutProperty = useMemo(
    () => prospects.find((p) => p.id === flyoutId) ?? null,
    [prospects, flyoutId],
  );

  // Restore the last-used mode on mount. Reading in an effect keeps SSR
  // rendering the default, avoiding a hydration mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (stored && MODES.includes(stored as Mode)) setMode(stored as Mode);
  }, []);

  const selectMode = useCallback((next: Mode) => {
    setMode(next);
    setSelectedId(null);
    setFlyoutId(null);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  const onSelect = useCallback(
    (property: Property) => {
      // Your own properties open their record page. A prospect isn't your record
      // yet, so it opens in the flyout over the list — and frames itself on the
      // map at the same time, so the two halves stay in sync.
      if (mode === "owned") {
        navigate({
          to: "/properties/$propertyId",
          params: { propertyId: property.id },
        });
        return;
      }
      setSelectedId(property.id);
      setFlyoutId(property.id);
    },
    [mode, navigate],
  );

  const subtitle =
    mode === "owned"
      ? "Every property your company has in Buildout"
      : "Public records aggregated by Buildout Insights";

  const countLabel =
    mode === "owned"
      ? `Displaying ${results.length} of ${owned.length} properties`
      : `${results.length} records of ${INSIGHTS_RECORD_TOTAL.toLocaleString()} nationwide`;

  const searchPlaceholder =
    mode === "owned"
      ? "Search by name, address, city, zip"
      : "Search records by address, city, zip";

  const activeFilterCount = countActiveFacets(appliedFacets);

  /** The mode switch — identical in both header styles. */
  const modeTabs = (
    <Tabs value={mode} onValueChange={(v) => selectMode(v as Mode)}>
      <Tabs.List variant="pills">
        <Tabs.Tab value="owned" icon={<FontAwesomeIcon icon={faBuildings} />}>
          My Properties
          <Badge variant="secondary" appearance="muted" className="ms-2">
            {owned.length}
          </Badge>
        </Tabs.Tab>
        {/* No count on Prospecting. The number of loaded records isn't the size
            of anything a broker cares about — the real total is the nationwide
            figure in the toolbar — so a count here would sit next to a true one
            and claim to mean the same. */}
        <Tabs.Tab value="prospect" icon={<FontAwesomeIcon icon={faRadar} />}>
          Prospecting
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );

  const searchBox = (
    <InputGroup>
      <InputGroup.Addon>
        <FontAwesomeIcon icon={faMagnifyingGlass} />
      </InputGroup.Addon>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Search properties"
      />
    </InputGroup>
  );

  /**
   * The page header, shared by both styles.
   *
   * The switch sits under the title with the description beside it, which is
   * what makes the description read as a caption on the switch rather than on
   * the page — it changes when you flip, and now it changes next to the thing
   * you flipped. It also puts the switch on its own line, which is more
   * presence than it had opposite the title.
   */
  const headerBlock = (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <h1 className="fs-4 fw-semibold mb-0">Properties</h1>
        {/* Record actions belong to your own book — there's nothing to action
            on a public record you haven't added yet. Placeholders for now. */}
        {mode === "owned" && (
          <div className="d-flex align-items-center gap-2">
            <Button variant="outline">
              Actions
              <FontAwesomeIcon icon={faCaretDown} />
            </Button>
            <Button variant="primary">
              New Property
              <FontAwesomeIcon icon={faCaretDown} />
            </Button>
          </div>
        )}
      </div>

      <div className="d-flex align-items-center gap-3 flex-wrap">
        {modeTabs}
        <span className="text-muted">{subtitle}</span>
      </div>
    </div>
  );

  /**
   * Map / table switcher, mirroring the Deals toolbar's group. Selection is
   * local and visual only — the table view isn't built, so this changes which
   * button reads as active and nothing else.
   */
  const viewSwitcher = (
    <ButtonGroup aria-label="Results view">
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Button
              variant="outline"
              size="icon"
              className={resultsView === "map" ? "active" : ""}
              aria-pressed={resultsView === "map"}
              aria-label="Map view"
              onClick={() => setResultsView("map")}
            >
              <FontAwesomeIcon icon={faLocationDot} />
            </Button>
          }
        />
        <Tooltip.Content>Map</Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Button
              variant="outline"
              size="icon"
              className={resultsView === "table" ? "active" : ""}
              aria-pressed={resultsView === "table"}
              aria-label="Table view"
              onClick={() => setResultsView("table")}
            >
              <FontAwesomeIcon icon={faTableList} />
            </Button>
          }
        />
        <Tooltip.Content>Table</Tooltip.Content>
      </Tooltip>
    </ButtonGroup>
  );

  /** The results rail + map, shared by both header styles. */
  const results_ = (
    <>
      <div
        className="d-flex flex-column overflow-y-auto overflow-x-hidden gap-2 flex-shrink-0"
        // Wider than it was now the page runs full-bleed — the row carries an
        // address, a meta line, a thumbnail and a trailing action, and at
        // 480px the meta line truncated on almost every record.
        style={{ width: 560, maxWidth: "100%" }}
      >
        {results.length === 0 ? (
          <div className="d-flex align-items-center justify-content-center p-8">
            <Empty>
              <Empty.Media>
                <FontAwesomeIcon icon={faBuilding} aria-label="No properties" />
              </Empty.Media>
              <Empty.Content>
                <Empty.Title>
                  {mode === "owned"
                    ? "No properties match your filters"
                    : "No records match your filters"}
                </Empty.Title>
                Try clearing the search or widening the type and size filters.
              </Empty.Content>
            </Empty>
          </div>
        ) : (
          results.map((p) => (
            <PropertyListRow
              key={p.id}
              property={p}
              mode={mode}
              selected={selectedId === p.id}
              onSelect={() => onSelect(p)}
              onAdd={() => setAddTarget(p)}
              inDatabase={mode === "prospect" && propertiesMap.has(p.id)}
            />
          ))
        )}
      </div>

      <div className="flex-grow-1 d-none d-lg-block position-relative overflow-hidden rounded border">
        <PropertyRecordMap
          properties={results}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <span
          className="position-absolute bg-card border rounded px-3 py-2 fw-semibold shadow-sm"
          style={{ top: 12, left: 12, zIndex: 500, fontSize: 13 }}
        >
          {results.length.toLocaleString()}{" "}
          {mode === "owned" ? "Properties" : "Records"}
        </span>
      </div>
    </>
  );

  /**
   * The page, on the People index's structure: headline and subtext, then one
   * toolbar line (search · Filters · count · view switcher), then the active
   * filters as pills, with the results in the same panel card.
   */
  const pageLayout = (
    <div className="d-flex h-100 p-4 overflow-hidden w-100">
      <Card className="panel-card flex-grow-1 d-flex flex-column overflow-hidden">
        <Card.Body className="d-flex flex-column gap-4 overflow-hidden">
          {headerBlock}

          <div className="d-flex flex-column gap-3">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <div style={{ minWidth: 340 }}>{searchBox}</div>
              <Button
                variant="outline"
                onClick={() => setShowFilters((v) => !v)}
                aria-pressed={showFilters}
              >
                <FontAwesomeIcon icon={faFilter} />
                Filters
                {activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
              <span className="text-muted">{countLabel}</span>
              <div className="ms-auto">{viewSwitcher}</div>
            </div>

            <PropertyFilterPills
              facets={appliedFacets}
              onChange={setFacets}
            />
          </div>

          <div className="flex-grow-1 d-flex overflow-hidden gap-3">
            {results_}
          </div>
        </Card.Body>
      </Card>
    </div>
  );

  return (
    <>
      {pageLayout}

      {/* Prospecting overlays. Both flows reach both dialogs — the tile CTA
          opens Add Property directly, the flyout opens it from its header and
          Save Contact from its Ownership tab. */}
      <ProspectFlyout
        property={flyoutProperty}
        open={flyoutId !== null}
        onOpenChange={(o) => {
          if (!o) setFlyoutId(null);
        }}
        onAdd={(p) => setAddTarget(p)}
        onSaveContact={onSaveContact}
      />

      <AddProspectDialog
        property={addTarget}
        open={addTarget !== null}
        onOpenChange={(o) => {
          if (!o) setAddTarget(null);
        }}
      />

      <PropertyFiltersFlyout
        open={showFilters}
        onOpenChange={setShowFilters}
        facets={facets}
        onChange={setFacets}
        showStage={mode === "owned"}
      />
    </>
  );
}
