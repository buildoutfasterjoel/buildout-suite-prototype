import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartSimple,
  faBuildingCircleArrowRight,
  faCircleCheck,
  faFileLines,
  faHouseBuilding,
  faPeopleRoof,
  faUserCircle,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getDefaultRings } from "#/data/listingDemographics";
import type { ProspectOwnerContact } from "#/data/prospectOwners";
import { DemographicsTable } from "#/components/listings/demographics/DemographicsTable";
import { ProspectOwnershipTab } from "./ProspectOwnershipTab";
import {
  TYPE_LABELS,
  formatPrice,
  formatPct,
  formatSqFt,
  getPhotoUrl,
} from "./propertyDisplay";

type TabKey = "summary" | "ownership" | "records" | "comps" | "demographics";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d-flex justify-content-between gap-3 border-bottom py-2">
      <span className="text-muted">{label}</span>
      <span className="fw-semibold text-end">{value}</span>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * The prospect detail flyout.
 *
 * A prospect has no page of its own — it isn't your record yet — so its detail
 * opens over the results rail rather than navigating away. That keeps the list
 * and map behind it: prospecting is a scanning activity, and losing your place
 * to inspect one record is the thing that makes people stop scanning.
 */
export function ProspectFlyout({
  property,
  open,
  onOpenChange,
  onAdd,
  onSaveContact,
}: {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the Add Property dialog for this record. */
  onAdd: (property: Property) => void;
  /** Opens the Save Contact confirmation for one researched owner. */
  onSaveContact: (property: Property, owner: ProspectOwnerContact) => void;
}) {
  const [tab, setTab] = useState<TabKey>("summary");
  const rings = useMemo(() => getDefaultRings(), []);
  const [hiddenRows, setHiddenRows] = useState<Record<string, boolean>>({});

  // A different record always opens on Summary — carrying a tab across records
  // lands people on Ownership for a building they haven't looked at yet.
  useEffect(() => setTab("summary"), [property?.id]);

  const inDatabase = useDataStore((s) =>
    property ? s.properties.has(property.id) : false,
  );

  // Every recorded sale across the building's units, newest first — the
  // property's own transaction history, which is what a comp set is here.
  const comps = useMemo(() => {
    if (!property) return [];
    return property.units
      .flatMap((u) => u.saleHistory.map((s) => ({ ...s, unit: u.label })))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [property]);

  if (!property) return null;

  const address = property.street || property.name;
  const records = property.financialRecords;

  return (
    <Offcanvas open={open} onOpenChange={onOpenChange}>
      <Offcanvas.Content
        side="right"
        style={{ width: "min(60rem, 100vw)" }}
        aria-label={`${address} record`}
      >
        <Offcanvas.Header className="d-flex flex-column align-items-stretch gap-2">
          <div className="d-flex align-items-start justify-content-between gap-3">
            <div style={{ minWidth: 0 }}>
              <Offcanvas.Title className="fs-4 fw-semibold mb-0 text-truncate">
                {address}
              </Offcanvas.Title>
              <div className="text-muted">
                {property.city}, {property.state} {property.zip}
              </div>
            </div>
            {inDatabase ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    to="/properties/$propertyId"
                    params={{ propertyId: property.id }}
                  />
                }
              >
                <FontAwesomeIcon icon={faCircleCheck} />
                View Property
              </Button>
            ) : (
              <Button variant="primary" onClick={() => onAdd(property)}>
                <FontAwesomeIcon icon={faBuildingCircleArrowRight} />
                Add Property
              </Button>
            )}
          </div>
        </Offcanvas.Header>

        <Offcanvas.Body>
          <Tabs value={tab} onValueChange={(v) => v && setTab(v as TabKey)}>
            <Tabs.List>
              <Tabs.Tab
                value="summary"
                icon={<FontAwesomeIcon icon={faHouseBuilding} />}
              >
                Summary
              </Tabs.Tab>
              <Tabs.Tab
                value="ownership"
                icon={<FontAwesomeIcon icon={faUserCircle} />}
              >
                Ownership
              </Tabs.Tab>
              {/* Shown but not yet reachable — the flows being designed run
                  through Summary and Ownership, and these three would invite a
                  detour into surfaces nobody has reviewed. The panels below are
                  built and ready; dropping `disabled` turns them back on. */}
              <Tabs.Tab
                value="records"
                icon={<FontAwesomeIcon icon={faFileLines} />}
                disabled
              >
                Records ({records.length})
              </Tabs.Tab>
              <Tabs.Tab
                value="comps"
                icon={<FontAwesomeIcon icon={faChartSimple} />}
                disabled
              >
                Comps ({comps.length})
              </Tabs.Tab>
              <Tabs.Tab
                value="demographics"
                icon={<FontAwesomeIcon icon={faPeopleRoof} />}
                disabled
              >
                Demographics
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="summary" className="pt-4">
              <img
                src={getPhotoUrl(property.id, 960, 420)}
                alt=""
                className="w-100 rounded mb-4"
                style={{ height: 220, objectFit: "cover", display: "block" }}
              />
              <div className="row g-4">
                <div className="col-md-6">
                  <h3 className="fs-large fw-semibold">Property Information</h3>
                  <Row
                    label="Property Type"
                    value={TYPE_LABELS[property.propertyType]}
                  />
                  <Row
                    label="Property Subtype"
                    value={property.propertySubtype}
                  />
                  <Row label="Year Built" value={property.yearBuilt} />
                  <Row
                    label="Year Renovated"
                    value={property.yearRenovated ?? "—"}
                  />
                  <Row
                    label="Building Size"
                    value={formatSqFt(property.buildingSqFt)}
                  />
                  <Row label="Lot Size" value={formatSqFt(property.lotSqFt)} />
                  <Row label="Stories" value={property.stories} />
                  <Row label="Building Class" value={property.buildingClass} />
                  <Row
                    label="Residential Units"
                    value={property.residentialUnits ?? "—"}
                  />
                </div>
                <div className="col-md-6">
                  <h3 className="fs-large fw-semibold">Location &amp; Tax</h3>
                  <Row label="APN" value={property.apn} />
                  <Row label="County" value={property.county} />
                  <Row label="Submarket" value={property.submarket} />
                  <Row label="Zoning" value={property.zoning} />
                  <Row label="Use Code" value={property.useCode} />
                  <Row
                    label="Assessed Value"
                    value={formatPrice(property.assessedTaxValue)}
                  />
                  <Row
                    label="Tax Amount"
                    value={formatPrice(property.taxAmount)}
                  />
                  <Row label="Tax Year" value={property.taxYear} />
                  <Row
                    label="Open Liens"
                    value={
                      property.numberOfOpenLiens > 0
                        ? `${property.numberOfOpenLiens} · ${formatPrice(property.amountOfOpenLiens)}`
                        : "None"
                    }
                  />
                </div>
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="ownership" className="pt-4">
              <ProspectOwnershipTab
                property={property}
                onSaveContact={(owner) => onSaveContact(property, owner)}
              />
            </Tabs.Panel>

            <Tabs.Panel value="records" className="pt-4">
              {/* Land and other non-income parcels still carry dated assessor
                  records, they just have nothing to report on them. Say so,
                  rather than leaving a grid of zeros to read as a bug. */}
              {records.every((r) => r.effectiveGrossIncome === 0) && (
                <p className="text-muted" style={{ fontSize: 13 }}>
                  No operating income is reported for this parcel — the records
                  below are assessor filings only.
                </p>
              )}
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>As Of</Table.Head>
                    <Table.Head>Source</Table.Head>
                    <Table.Head>NOI</Table.Head>
                    <Table.Head>EGI</Table.Head>
                    <Table.Head>Cap Rate</Table.Head>
                    <Table.Head>Occupancy</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {records.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>{fmtDate(r.asOf)}</Table.Cell>
                      <Table.Cell>
                        <Badge variant="secondary" appearance="muted">
                          {r.source}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{formatPrice(r.noi)}</Table.Cell>
                      <Table.Cell>
                        {formatPrice(r.effectiveGrossIncome)}
                      </Table.Cell>
                      <Table.Cell>{formatPct(r.capRate * 100)}</Table.Cell>
                      <Table.Cell>{formatPct(r.occupancyPct)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </Tabs.Panel>

            <Tabs.Panel value="comps" className="pt-4">
              {comps.length === 0 ? (
                <Empty>
                  <Empty.Content>
                    <Empty.Title>No recorded sales</Empty.Title>
                    Nothing in this building has traded on record.
                  </Empty.Content>
                </Empty>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Unit</Table.Head>
                      <Table.Head>Date</Table.Head>
                      <Table.Head>Price</Table.Head>
                      <Table.Head>$/SF</Table.Head>
                      <Table.Head>Cap Rate</Table.Head>
                      <Table.Head>Buyer</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {comps.map((c) => (
                      <Table.Row key={c.id}>
                        <Table.Cell>{c.unit}</Table.Cell>
                        <Table.Cell>{fmtDate(c.date)}</Table.Cell>
                        <Table.Cell>{formatPrice(c.price)}</Table.Cell>
                        <Table.Cell>${c.pricePerSf.toFixed(0)}</Table.Cell>
                        <Table.Cell>
                          {formatPct(c.capRateAtSale * 100)}
                        </Table.Cell>
                        <Table.Cell>{c.buyer}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="demographics" className="pt-4">
              <DemographicsTable
                listingId={property.id}
                rings={rings}
                refreshNonce={0}
                hiddenRowIds={hiddenRows}
                onToggleRow={(rowId, hidden) =>
                  setHiddenRows((prev) => ({ ...prev, [rowId]: hidden }))
                }
              />
            </Tabs.Panel>
          </Tabs>
        </Offcanvas.Body>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
