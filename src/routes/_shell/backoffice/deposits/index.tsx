import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoneyCheckDollar } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import {
  allDeposits,
  depositBuckets,
  depositTotals,
  depositYears,
  type DepositRow,
} from "#/data/depositIndex";
import {
  countActiveDepositFilters,
  emptyDepositFilters,
  matchesDepositFilters,
  type DepositFilterState,
} from "#/data/depositFilters";
import { BrokerStack } from "#/components/backoffice/BrokerStack";
import { DepositChart } from "#/components/backoffice/DepositChart";
import { DepositFilterBar } from "#/components/backoffice/DepositFilterBar";
import { formatCurrency, formatDate } from "#/components/deals/dealDisplay";

export const Route = createFileRoute("/_shell/backoffice/deposits/")({
  component: DepositsPage,
  head: () => ({ meta: [{ title: "Deposits | Buildout Suite" }] }),
});

const PAGE_SIZE = 25;

/**
 * Every deposit in the book — the Back Office cash-received index.
 *
 * Receivables answers what is owed and how much of it is still out. This page
 * picks the money up where that one drops it: the cash has arrived, so the
 * question is where all of it went. Four columns divide each deposit up and
 * always foot back to what landed.
 *
 * **No selection and no primary action.** Receivables carries a checkbox column
 * because a set of billed lines makes an invoice. Nothing in the product acts on
 * a set of deposits — a deposit is already a completed fact — so the column and
 * the header button would be furniture. Editing one still happens where it is
 * applied, on the voucher's Financials tab, which the Voucher cell links to.
 */
function DepositsPage() {
  // Subscribe to the map: a deposit's figures live on its deal — its payables
  // and their payments — so this must re-render when any deal changes, not
  // merely when one is added or removed.
  void useDataStore((s) => s.listings);

  // Pinned once per mount rather than read on each render, so the year the
  // dropdown defaults to cannot change under a user who leaves the tab open
  // across New Year.
  const [now] = useState(() => new Date());

  const rows = allDeposits();

  const [filters, setFilters] = useState(() => emptyDepositFilters(now));
  const [page, setPage] = useState(1);

  /**
   * Every filter change returns to page one. Page 4 of a 2-page result is
   * nothing.
   */
  function updateFilters(next: DepositFilterState) {
    setFilters(next);
    setPage(1);
  }

  // Options drawn from the book rather than a fixed roster — an option nothing
  // matches is a dead end. Same call the receivables toolbar makes.
  const brokerNames = useMemo(
    () =>
      [...new Set(rows.flatMap((r) => r.brokerNames))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const years = useMemo(() => depositYears(rows, now), [rows, now]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesDepositFilters(row, filters)),
    [rows, filters],
  );

  const activeFilterCount = countActiveDepositFilters(filters, now);

  // Both foot the FILTERED set, so the chart, the total row and the table can
  // never describe three different books.
  const totals = depositTotals(filtered);
  const buckets = useMemo(
    () =>
      depositBuckets(filtered, {
        // 'All time' has no single year to draw. The current one keeps the axis
        // a full twelve wide rather than collapsing the chart.
        year: filters.year === "all" ? now.getFullYear() : filters.year,
        grain: filters.grain,
      }),
    [filtered, filters.year, filters.grain, now],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped rather than reset in an effect: a filter change that shortens the
  // list would otherwise render one blank frame on a now-nonexistent page.
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    // The BODY scrolls, not the table — the chart sits between the toolbar and
    // the rows, and giving the table the leftovers of a laptop viewport leaves
    // two rows visible under a full-height chart. The same call the Receivables
    // index makes, for the same reason.
    <div className="h-100 d-flex flex-column overflow-hidden">
      {/* Header band — the full-bleed identity strip a deal page opens with. */}
      <div className="bg-card border-bottom flex-shrink-0">
        <div className="container p-4 d-flex align-items-center justify-content-between gap-3">
          <div className="d-flex flex-column gap-0">
            <h1 className="fs-4 mb-0 fw-semibold">Deposits</h1>
            <div className="text-muted fs-small">
              Track commission payments received
            </div>
          </div>
          <span className="text-muted">
            Displaying {filtered.length} of {rows.length}{" "}
            {rows.length === 1 ? "Deposit" : "Deposits"}
          </span>
        </div>
      </div>

      <div className="flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
        <div className="container d-flex flex-column gap-4 py-4">
          <Card className="shadow flex-shrink-0">
            <Card.Body>
              <DepositFilterBar
                filters={filters}
                brokerNames={brokerNames}
                years={years}
                onChange={updateFilters}
              />
            </Card.Body>
          </Card>

          <Card className="shadow flex-shrink-0">
            <Card.Body>
              <DepositChart buckets={buckets} />
            </Card.Body>
          </Card>

          <Card className="shadow flex-shrink-0">
            <Card.Body className="d-flex flex-column gap-3">
              {filtered.length === 0 ? (
                <Empty className="flex-shrink-0">
                  <Empty.Media>
                    <FontAwesomeIcon icon={faMoneyCheckDollar} />
                  </Empty.Media>
                  <Empty.Content>
                    <Empty.Title>No deposits match</Empty.Title>
                    {activeFilterCount > 0
                      ? "Widen the year or clear a filter."
                      : "No money has come in yet."}
                  </Empty.Content>
                  {activeFilterCount > 0 && (
                    <Empty.Actions>
                      <Button
                        variant="outline"
                        onClick={() => updateFilters(emptyDepositFilters(now))}
                      >
                        Reset filters
                      </Button>
                    </Empty.Actions>
                  )}
                </Empty>
              ) : (
                <>
                  {/* `.table-wide` restores the width Bootstrap's `.table`
                      takes away, or ten columns would compress instead of
                      scroll. */}
                  <Table className="table-wide">
                    <Table.Header sticky>
                      <Table.Row>
                        <Table.Head>Voucher</Table.Head>
                        <Table.Head>Brokers</Table.Head>
                        <Table.Head>Ref #</Table.Head>
                        <Table.Head>Payer</Table.Head>
                        <Table.Head>Date</Table.Head>
                        <Table.Head className="text-end">Amount</Table.Head>
                        <Table.Head className="text-end">
                          Deducted Pre-Split
                        </Table.Head>
                        <Table.Head className="text-end">
                          Paid To Brokers
                        </Table.Head>
                        <Table.Head className="text-end">
                          Open Payables
                        </Table.Head>
                        <Table.Head className="text-end">
                          Collected House Split
                        </Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {/* Foots the filtered set, so it always agrees with the
                        table beneath it — and sits under the sticky header
                        rather than at the end, where a total is only reached
                        by scrolling past everything it describes. */}
                      <Table.Row className="fw-semibold bg-body-secondary">
                        <Table.Cell className="text-nowrap">
                          TOTAL ({totals.count})
                        </Table.Cell>
                        <Table.Cell colSpan={4} />
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.amount)}
                        </Table.Cell>
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.deductedPreSplit)}
                        </Table.Cell>
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.paidToBrokers)}
                        </Table.Cell>
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.openPayables)}
                        </Table.Cell>
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.collectedHouseSplit)}
                        </Table.Cell>
                      </Table.Row>

                      {visible.map((row: DepositRow) => (
                        // No whole-row click. The Voucher cell is the one
                        // destination, for the reason the Vouchers table gives:
                        // a row that both navigates and holds a link teaches two
                        // rules at once.
                        <Table.Row key={row.key}>
                          <Table.Cell className="fw-medium text-nowrap">
                            <Link {...row.target}>{row.voucherName}</Link>
                          </Table.Cell>
                          <Table.Cell>
                            <BrokerStack brokers={row.brokers} />
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {row.referenceNumber || "--"}
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {row.payerName}
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {formatDate(row.date)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.amount)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.deductedPreSplit)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.paidToBrokers)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.openPayables)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.collectedHouseSplit)}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>

                  {pageCount > 1 && (
                    // Centred in the card, matching the Receivables table.
                    // Blueprint's Pagination root is a bare <nav>, so alignment
                    // is the caller's to set.
                    <Pagination className="d-flex justify-content-center flex-shrink-0">
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
                        {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                          (n) => (
                            <Pagination.Item key={n}>
                              <Pagination.Link
                                href="#"
                                isActive={n === current}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPage(n);
                                }}
                              >
                                {n}
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
                </>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
