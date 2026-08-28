import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileInvoiceDollar } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { createInvoiceFromReceivables } from "#/data/actions";
import { notify } from "#/lib/notify";
import {
  allReceivables,
  invoiceSelectionBlock,
  receivableBuckets,
  receivableTotals,
  receivableYears,
  type ReceivableBroker,
  type ReceivableRow,
} from "#/data/receivables";
import {
  countActiveReceivableFilters,
  emptyReceivableFilters,
  matchesReceivableFilters,
  type ReceivableFilterState,
} from "#/data/receivableFilters";
import { ReceivableChart } from "#/components/backoffice/ReceivableChart";
import { ReceivableFilterBar } from "#/components/backoffice/ReceivableFilterBar";
import { ReceivableStatusBadge } from "#/components/backoffice/ReceivableStatusBadge";
import { formatCurrency, formatDate } from "#/components/deals/dealDisplay";

export const Route = createFileRoute("/_shell/backoffice/receivables/")({
  component: ReceivablesPage,
  head: () => ({ meta: [{ title: "Receivables | Buildout Suite" }] }),
});

const PAGE_SIZE = 25;

/** Up to three faces, then a count — a wide column of avatars buys nothing. */
const AVATARS_SHOWN = 3;

/**
 * The Brokers cell.
 *
 * `Avatar.Group` owns the overlap, the ring and the radius, and `Avatar.More`
 * renders its own `+n` — none of that is reimplemented here.
 *
 * Each avatar IS its tooltip trigger, via `render`, rather than sitting inside
 * a trigger `<span>`. The group overlaps its children with
 * `.avatar .avatar:first-child { margin-left: 0 }`, so a wrapper per avatar
 * would make every one of them a first child and flatten the stack.
 */
function BrokerStack({ brokers }: { brokers: ReceivableBroker[] }) {
  if (brokers.length === 0) return <span className="text-muted">--</span>;
  const shown = brokers.slice(0, AVATARS_SHOWN);
  const extra = brokers.length - shown.length;

  return (
    <Avatar.Group>
      {shown.map((broker, i) => (
        <Tooltip key={`${broker.name}-${i}`}>
          <Tooltip.Trigger
            render={
              <Avatar>
                {broker.avatarUrl && (
                  <Avatar.Image src={broker.avatarUrl} alt="" />
                )}
                <Avatar.Fallback>{broker.initials}</Avatar.Fallback>
              </Avatar>
            }
          />
          <Tooltip.Content>{broker.name}</Tooltip.Content>
        </Tooltip>
      ))}
      {extra > 0 && <Avatar.More count={extra} />}
    </Avatar.Group>
  );
}

/**
 * Every receivable in the book — the Back Office collections index.
 *
 * The Vouchers index answers what state a deal's settlement is in. This answers
 * the money question underneath it, which is why the band above the table is a
 * calendar of what is owed rather than a set of status tiles: the useful read
 * here is *when*, not *how many*.
 */
function ReceivablesPage() {
  // Subscribe to the map: a receivable's figures live on its deal, so this must
  // re-render when any deal changes, not merely when one is added or removed.
  void useDataStore((s) => s.listings);

  // Pinned once per mount rather than read inside the derivation: a `new Date()`
  // per row would let a page render straddle midnight and turn one line Overdue
  // halfway down the table.
  const [now] = useState(() => new Date());

  const rows = allReceivables(now);

  const [filters, setFilters] = useState(() => emptyReceivableFilters(now));
  const [page, setPage] = useState(1);
  /** Checked row keys. Survives paging — see `updateFilters` for why not filters. */
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  /**
   * Every filter change returns to page one and drops the selection.
   *
   * Page 4 of a 2-page result is nothing, and a selection of rows the table no
   * longer shows would arm Create Invoice over records the user cannot see.
   */
  function updateFilters(next: ReceivableFilterState) {
    setFilters(next);
    setPage(1);
    setSelected(new Set());
  }

  // Options drawn from the book rather than a fixed roster — an option nothing
  // matches is a dead end. Same call the voucher toolbar makes.
  const brokerNames = useMemo(
    () =>
      [...new Set(rows.flatMap((r) => r.brokerNames))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const years = useMemo(() => receivableYears(rows, now), [rows, now]);

  const filtered = useMemo(
    () => rows.filter((row) => matchesReceivableFilters(row, filters)),
    [rows, filters],
  );

  const activeFilterCount = countActiveReceivableFilters(filters, now);

  // Both foot the FILTERED set, so the chart, the total row and the table can
  // never describe three different books.
  const totals = receivableTotals(filtered);
  const buckets = useMemo(
    () =>
      receivableBuckets(filtered, {
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

  const selectedRows = filtered.filter((r) => selected.has(r.key));
  const invoiceBlock = invoiceSelectionBlock(selectedRows);

  /** Toggle one row's checkbox, never mutating the Set in place. */
  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** The header checkbox covers THIS PAGE, which is what the user can see. */
  const pageKeys = visible.map((r) => r.key);
  const allOnPageSelected =
    pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function createInvoice() {
    if (invoiceBlock || selectedRows.length === 0) return;
    const { invoiceId, name } = createInvoiceFromReceivables(
      selectedRows[0].dealId,
      selectedRows.map((r) => r.receivableId),
    );
    if (!invoiceId) {
      notify({
        title: "Couldn't create the invoice",
        description: "That voucher wouldn't accept the selected lines.",
        variant: "destructive",
      });
      return;
    }
    const count = selectedRows.length;
    notify({
      title: name ?? "Invoice created",
      description: `Billing ${count} ${count === 1 ? "receivable" : "receivables"}.`,
    });
    setSelected(new Set());
  }

  return (
    // The BODY scrolls here, not the table — the one place this page departs
    // from the Vouchers index it otherwise copies.
    //
    // There, the table is the only scroller and its header stays put. That
    // works because nothing sits between the toolbar and the rows. Here the
    // chart does, and it is 280px of it: giving the table the leftovers of a
    // laptop viewport left two rows visible under a full-height chart. So the
    // chart and the table scroll together and the table takes its natural
    // height, which is also how the reference design behaves.
    //
    // The header band stays pinned above the scroller, so the count and Create
    // Invoice are reachable from anywhere in the list.
    <div className="h-100 d-flex flex-column overflow-hidden">
      {/* Header band — the full-bleed identity strip a deal page opens with. */}
      <div className="bg-card border-bottom flex-shrink-0">
        <div className="container p-4 d-flex align-items-center justify-content-between gap-3">
          <div className="d-flex flex-column gap-0">
            <h1 className="fs-4 mb-0 fw-semibold">Receivables</h1>
            <div className="text-muted fs-small">
              Track commissions due for collection
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted">
              Displaying {filtered.length} of {rows.length}{" "}
              {rows.length === 1 ? "Receivable" : "Receivables"}
            </span>
            {/* The reason for the block is the whole value of greying the
                button — a dead control with no explanation is the worst of
                both. The span is required: a disabled button fires no pointer
                events, so the tooltip would never open. */}
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="d-inline-flex">
                    <Button
                      variant="primary"
                      disabled={invoiceBlock !== null}
                      onClick={createInvoice}
                    >
                      Create Invoice
                    </Button>
                  </span>
                }
              />
              <Tooltip.Content>
                {invoiceBlock ??
                  `Invoice ${selectedRows.length} selected ${
                    selectedRows.length === 1 ? "receivable" : "receivables"
                  }.`}
              </Tooltip.Content>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
        <div className="container d-flex flex-column gap-4 py-4">
          <Card className="shadow flex-shrink-0">
            <Card.Body>
              <ReceivableFilterBar
                filters={filters}
                brokerNames={brokerNames}
                years={years}
                onChange={updateFilters}
              />
            </Card.Body>
          </Card>

          <Card className="shadow flex-shrink-0">
            <Card.Body>
              <ReceivableChart buckets={buckets} />
            </Card.Body>
          </Card>

          <Card className="shadow flex-shrink-0">
            <Card.Body className="d-flex flex-column gap-3">
              {filtered.length === 0 ? (
                <Empty className="flex-shrink-0">
                  <Empty.Media>
                    <FontAwesomeIcon icon={faFileInvoiceDollar} />
                  </Empty.Media>
                  <Empty.Content>
                    <Empty.Title>No receivables match</Empty.Title>
                    {activeFilterCount > 0
                      ? "Widen the year or clear a filter."
                      : "Nothing has been billed yet."}
                  </Empty.Content>
                  {activeFilterCount > 0 && (
                    <Empty.Actions>
                      <Button
                        variant="outline"
                        onClick={() =>
                          updateFilters(emptyReceivableFilters(now))
                        }
                      >
                        Reset filters
                      </Button>
                    </Empty.Actions>
                  )}
                </Empty>
              ) : (
                <>
                  {/* The one scrolling region on the page. `style` lands on
                    Blueprint's `.table-container` (which already carries the
                    border and `overflow: auto`), while `className` lands on the
                    `<table>` — so the frame stays put and only the rows travel.
                    `.table-wide` restores the width Bootstrap's `.table` takes
                    away, or eleven columns would compress instead of scroll. */}
                  <Table className="table-wide">
                    <Table.Header sticky>
                      <Table.Row>
                        <Table.Head style={{ width: 40 }}>
                          <Checkbox
                            checked={allOnPageSelected}
                            onCheckedChange={togglePage}
                            aria-label="Select every receivable on this page"
                          />
                        </Table.Head>
                        <Table.Head>Voucher</Table.Head>
                        <Table.Head>Brokers</Table.Head>
                        <Table.Head>Invoices</Table.Head>
                        <Table.Head>Payer</Table.Head>
                        <Table.Head>Due Date</Table.Head>
                        <Table.Head>Status</Table.Head>
                        <Table.Head>Description</Table.Head>
                        <Table.Head className="text-end">Amount</Table.Head>
                        <Table.Head className="text-end">Deposits</Table.Head>
                        <Table.Head className="text-end">
                          Other Credits
                        </Table.Head>
                        <Table.Head className="text-end">Open / Due</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {/* Foots the filtered set, so it always agrees with the
                        table beneath it — and sits under the sticky header
                        rather than at the end, where a total is only reached
                        by scrolling past everything it describes. */}
                      <Table.Row className="fw-semibold bg-body-secondary">
                        <Table.Cell />
                        <Table.Cell className="text-nowrap">
                          TOTAL ({totals.count})
                        </Table.Cell>
                        <Table.Cell colSpan={6} />
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.amount)}
                        </Table.Cell>
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.deposits)}
                        </Table.Cell>
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.otherCredits)}
                        </Table.Cell>
                        <Table.Cell className="text-end text-nowrap">
                          {formatCurrency(totals.openDue)}
                        </Table.Cell>
                      </Table.Row>

                      {visible.map((row: ReceivableRow) => (
                        // No whole-row click. The Voucher cell is the one
                        // destination, for the reason the Vouchers table gives:
                        // a row that both navigates and holds a link teaches two
                        // rules at once.
                        <Table.Row key={row.key}>
                          <Table.Cell>
                            <Checkbox
                              checked={selected.has(row.key)}
                              onCheckedChange={() => toggleRow(row.key)}
                              aria-label={`Select ${row.voucherName}, ${row.payerName}`}
                            />
                          </Table.Cell>
                          <Table.Cell className="fw-medium text-nowrap">
                            <Link {...row.target}>{row.voucherName}</Link>
                          </Table.Cell>
                          <Table.Cell>
                            <BrokerStack brokers={row.brokers} />
                          </Table.Cell>
                          <Table.Cell className="text-muted">
                            {row.invoiceCount || "--"}
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {row.payerName}
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {formatDate(row.dueDate)}
                          </Table.Cell>
                          <Table.Cell>
                            <ReceivableStatusBadge status={row.status} />
                          </Table.Cell>
                          <Table.Cell className="text-muted">
                            {row.description || "--"}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.amount)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.deposits)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.otherCredits)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.openDue)}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>

                  {pageCount > 1 && (
                    // Centred in the card, matching the Vouchers table.
                    // Blueprint's Pagination root is a bare <nav>, so alignment is
                    // the caller's to set.
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
