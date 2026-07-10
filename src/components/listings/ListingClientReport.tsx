import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import {
  Calendar,
  type DateRange,
} from "@buildoutinc/blueprint-react/ui/Calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendar,
  faCaretDown,
  faEye,
  faShareNodes,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing, Property } from "#/data/types";
import {
  getClientReportKpis,
  getClientReportLeads,
} from "#/data/listingClientReport";
import { ListingPageHeader } from "./ListingPageHeader";
import { KpiTile } from "./listingWidgets";
import { ClientReportActivitySummary } from "./client-report/ClientReportActivitySummary";
import { ClientReportFunnel } from "./client-report/ClientReportFunnel";
import { ClientReportCompanies } from "./client-report/ClientReportCompanies";
import { ClientReportLeadsTable } from "./client-report/ClientReportLeadsTable";

const REPORT_FIELDS = [
  "KPIs",
  "Activity Summary",
  "Activity Funnel",
  "Companies",
  "Leads",
];

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

function formatDateRange(range?: DateRange): string {
  if (!range?.from) return "Date Range";
  const from = range.from.toLocaleDateString(undefined, DATE_FORMAT);
  if (!range.to || range.to.getTime() === range.from.getTime()) return from;
  return `${from} – ${range.to.toLocaleDateString(undefined, DATE_FORMAT)}`;
}

/** Rollup summary of a listing's Marketing-section activity, for sharing with a client. */
export function ListingClientReport({
  listing,
  property,
}: {
  listing: Listing;
  property: Property;
}) {
  const leads = getClientReportLeads(property);
  const kpis = getClientReportKpis(property);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader
        title="Client Report"
        actions={
          <>
            <Popover>
              <Popover.Trigger
                render={
                  <Button variant="outline">
                    <FontAwesomeIcon icon={faCalendar} />
                    {formatDateRange(dateRange)}
                  </Button>
                }
              />
              <Popover.Content className="p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  defaultMonth={dateRange?.from}
                />
              </Popover.Content>
            </Popover>

            <Popover>
              <Popover.Trigger
                render={
                  <Button variant="outline">
                    <FontAwesomeIcon icon={faEye} />
                    Field Visibility
                  </Button>
                }
              />
              <Popover.Content align="end">
                <Popover.Body className="d-flex flex-column gap-2">
                  {REPORT_FIELDS.map((field) => (
                    <Field
                      key={field}
                      orientation="horizontal"
                      className="align-items-center gap-2"
                    >
                      <Checkbox defaultChecked />
                      <Field.Label>{field}</Field.Label>
                    </Field>
                  ))}
                </Popover.Body>
              </Popover.Content>
            </Popover>

            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button variant="outline">
                    Actions
                    <FontAwesomeIcon icon={faCaretDown} />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item>Export PDF</DropdownMenu.Item>
                <DropdownMenu.Item>Print</DropdownMenu.Item>
                <DropdownMenu.Item>Duplicate Report</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>

            <Button variant="primary">
              <FontAwesomeIcon icon={faShareNodes} />
              Share Summary
            </Button>
          </>
        }
      />

      {/* KPI tiles */}
      <div className="row g-3">
        <div className="col-6 col-md">
          <KpiTile
            label="Total Days on Market"
            value={kpis.totalDaysOnMarket}
          />
        </div>
        <div className="col-6 col-md">
          <KpiTile label="CAs Signed" value={kpis.casSigned} />
        </div>
        <div className="col-6 col-md">
          <KpiTile label="Leads" value={kpis.leadsCount} />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <ClientReportActivitySummary listing={listing} kpis={kpis} />
        </div>
        <div className="col-12 col-xl-4">
          <ClientReportFunnel listing={listing} kpis={kpis} />
        </div>
        <div className="col-12 col-xl-4">
          <ClientReportCompanies leads={leads} />
        </div>
      </div>

      <ClientReportLeadsTable leads={leads} />
    </div>
  );
}
