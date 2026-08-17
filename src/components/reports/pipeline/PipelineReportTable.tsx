import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSort, faSortUp, faSortDown } from "@fortawesome/pro-regular-svg-icons";
import { TYPE_LABELS } from "#/components/properties/propertyDisplay";
import { DealStageBadge } from "#/components/deals/DealStageBadge";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { dealShape } from "#/data/dealShape";
import { getListing } from "#/data/store";
import { DEAL_SIDE_LABELS } from "./pipelineFilters";
import {
  formatReportCurrency,
  pipelineTotals,
  type PipelineRow,
} from "./pipelineRows";

const PAGE_SIZE = 20;

export type PipelineSortKey =
  | "dealId"
  | "name"
  | "stage"
  | "dealType"
  | "propertyType"
  | "city"
  | "state"
  | "transactionValue"
  | "brokerageGross";

/** Page numbers with gaps, matching the Tasks page's pagination. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

/** `--` for a value the record does not have. A real zero renders "$0.00". */
function orDash(value: string | null): string {
  return value && value.length > 0 ? value : "--";
}

/**
 * A deal's link, resolved through the one shared rule so a child space deal
 * opens its own space page rather than its building's.
 */
function DealLink({ row, children }: { row: PipelineRow; children: React.ReactNode }) {
  const listing = getListing(row.listingId);
  if (!listing) return <>{children}</>;
  const props = dealCardLinkProps(listing);
  return (
    <Link {...props} className="text-decoration-none">
      {children}
    </Link>
  );
}

export function PipelineReportTable({ rows }: { rows: PipelineRow[] }) {
  // Transaction Value descending is the reference's default and the useful
  // pipeline read.
  const [sortKey, setSortKey] = useState<PipelineSortKey>("transactionValue");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const x = a[sortKey];
      const y = b[sortKey];
      if (typeof x === "number" && typeof y === "number") return asc ? x - y : y - x;
      const cmp = String(x ?? "").localeCompare(String(y ?? ""));
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, asc]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Filtering can shrink the set under the current page; clamp rather than
  // render an empty page the user cannot see they are on.
  const current = Math.min(page, pageCount);
  const paged = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const totals = pipelineTotals(rows);

  function toggleSort(key: PipelineSortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
    setPage(1);
  }

  function SortHead({
    columnKey,
    children,
    align = "start",
  }: {
    columnKey: PipelineSortKey;
    children: React.ReactNode;
    align?: "start" | "end";
  }) {
    const icon = columnKey !== sortKey ? faSort : asc ? faSortUp : faSortDown;
    return (
      <Table.Head className={align === "end" ? "text-end" : undefined}>
        <button
          type="button"
          className="btn btn-link p-0 text-reset text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold"
          onClick={() => toggleSort(columnKey)}
        >
          {children}
          <FontAwesomeIcon icon={icon} className="text-muted" style={{ fontSize: 11 }} />
        </button>
      </Table.Head>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="border rounded-3">
        <Table variant="sticky">
          <Table.Header sticky>
            <Table.Row>
              <SortHead columnKey="dealId">Deal ID</SortHead>
              <SortHead columnKey="name">Deal Name</SortHead>
              <SortHead columnKey="stage">Stage</SortHead>
              <SortHead columnKey="dealType">Deal Type</SortHead>
              <Table.Head>Deal Side</Table.Head>
              <SortHead columnKey="propertyType">Property Type</SortHead>
              <SortHead columnKey="city">City</SortHead>
              <SortHead columnKey="state">State</SortHead>
              <SortHead columnKey="transactionValue" align="end">
                Transaction Value
              </SortHead>
              <SortHead columnKey="brokerageGross" align="end">
                Brokerage Gross
              </SortHead>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {/* Summary row above the data, as in the reference: the count is
                the report's first question. Tracks the filtered set.
                The tint goes on the cells, not the row: Blueprint's `.table`
                paints each `td` its own background, which covers anything set
                on the `tr` underneath. */}
            <Table.Row className="fw-semibold">
              <Table.Cell colSpan={8} className="bg-body">
                Count {totals.count}
              </Table.Cell>
              <Table.Cell className="bg-body text-end">
                {formatReportCurrency(totals.transactionValue)}
              </Table.Cell>
              <Table.Cell className="bg-body text-end">
                {formatReportCurrency(totals.brokerageGross)}
              </Table.Cell>
            </Table.Row>

            {paged.map((r) => (
              <Table.Row key={r.listingId}>
                <Table.Cell>
                  <DealLink row={r}>{r.dealId}</DealLink>
                </Table.Cell>
                <Table.Cell>
                  <DealLink row={r}>{r.name}</DealLink>
                </Table.Cell>
                <Table.Cell>
                  <StageCell row={r} />
                </Table.Cell>
                <Table.Cell>{r.dealType}</Table.Cell>
                <Table.Cell>{DEAL_SIDE_LABELS[r.dealSide]}</Table.Cell>
                <Table.Cell>
                  {orDash(r.propertyType ? TYPE_LABELS[r.propertyType] : null)}
                </Table.Cell>
                <Table.Cell>{orDash(r.city)}</Table.Cell>
                <Table.Cell>{orDash(r.state)}</Table.Cell>
                <Table.Cell className="text-end">
                  {formatReportCurrency(r.transactionValue)}
                </Table.Cell>
                <Table.Cell className="text-end">
                  {formatReportCurrency(r.brokerageGross)}
                </Table.Cell>
              </Table.Row>
            ))}

            {paged.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={10} className="text-center text-muted py-4">
                  No deals match these filters.
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>

      {pageCount > 1 && (
        <Pagination className="d-flex justify-content-center">
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                href="#"
                aria-disabled={current === 1}
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
              />
            </Pagination.Item>
            {pageWindow(current, pageCount).map((item, i) =>
              item === "…" ? (
                <Pagination.Item key={`gap-${i}`}>
                  <span className="px-2 text-muted" aria-hidden>
                    …
                  </span>
                </Pagination.Item>
              ) : (
                <Pagination.Item key={item}>
                  <Pagination.Link
                    href="#"
                    isActive={item === current}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(item);
                    }}
                  >
                    {item}
                  </Pagination.Link>
                </Pagination.Item>
              ),
            )}
            <Pagination.Item>
              <Pagination.Next
                href="#"
                aria-disabled={current === pageCount}
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(pageCount, p + 1));
                }}
              />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      )}
    </div>
  );
}

/**
 * Stage renders through the same badge the deal page uses, resolved with the
 * deal's shape so a space deal reads the label its own page shows.
 */
function StageCell({ row }: { row: PipelineRow }) {
  const listing = getListing(row.listingId);
  return (
    <DealStageBadge stage={row.stage} shape={listing ? dealShape(listing) : "sale"} />
  );
}
