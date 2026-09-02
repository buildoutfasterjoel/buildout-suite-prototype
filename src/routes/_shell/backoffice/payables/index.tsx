import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoneyCheckDollarPen } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { recordPayment } from "#/data/actions";
import { notify } from "#/lib/notify";
import {
  allPayableGroups,
  countPayables,
  filterPayableGroups,
  payableRows,
  payableYears,
  type PayableGroup,
} from "#/data/payableIndex";
import {
  clearedPayableFilters,
  countActivePayableFilters,
  emptyPayableFilters,
  matchesPayableFilters,
} from "#/data/payableFilters";
import { PayableFilterBar } from "#/components/backoffice/PayableFilterBar";
import { PaySelectedModal } from "#/components/backoffice/PaySelectedModal";
import { formatCurrency, formatDate } from "#/components/deals/dealDisplay";

export const Route = createFileRoute("/_shell/backoffice/payables/")({
  component: PayablesPage,
  head: () => ({ meta: [{ title: "Payables | Buildout Suite" }] }),
});

/**
 * Every payable in the book — the Back Office payouts queue.
 *
 * The one Back Office index that is not a flat table. Receivables and Deposits
 * are ledgers, sorted and paged; a payable is money owed to a person, and
 * cheques are written per person, so the rows arrive gathered under the broker
 * they are owed to. That grouping is also why there is no pagination: page 2 of
 * a grouped list either splits a broker across a page boundary or pads the
 * pages out to keep them whole, and both are worse than filtering. The filters
 * are how this list is narrowed.
 *
 * No chart, either. The sibling pages carry one because their question is
 * *when* — a collections calendar, a month of receipts. This page's question is
 * *who*, and a bar chart cannot answer it.
 */
function PayablesPage() {
  // Subscribe to the map: a payable's figures live on its deal, so this must
  // re-render when any deal changes, not merely when one is added or removed.
  void useDataStore((s) => s.listings);

  // Pinned once per mount rather than read inside the derivation, so a render
  // cannot straddle midnight and offer a year the rows disagree with.
  const [now] = useState(() => new Date());

  const groups = allPayableGroups();

  const [filters, setFilters] = useState(() => emptyPayableFilters(now));
  /** Checked row keys, by `PayableRow.key`. */
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [paying, setPaying] = useState(false);

  /**
   * Every filter change drops the selection.
   *
   * A selection of rows the table no longer shows would arm Pay Selected over
   * payables the user cannot see — and this button writes money, so a stale
   * selection is worse here than on Receivables, where the same rule holds.
   */
  function updateFilters(next: typeof filters) {
    setFilters(next);
    setSelected(new Set());
  }

  const years = useMemo(() => payableYears(groups, now), [groups, now]);

  const filtered = useMemo(
    () => filterPayableGroups(groups, (row) => matchesPayableFilters(row, filters)),
    [groups, filters],
  );

  const total = countPayables(groups);
  const shown = countPayables(filtered);
  const activeFilterCount = countActivePayableFilters(filters);

  /**
   * The selection, still grouped — what the modal summarises and what the
   * confirm walks to write its payments.
   *
   * Rebuilt from the FILTERED groups rather than kept as its own list, so a row
   * can never be paid because it was checked before a filter hid it.
   */
  const selectedGroups = useMemo(
    () => filterPayableGroups(filtered, (row) => selected.has(row.key)),
    [filtered, selected],
  );
  const selectedRows = payableRows(selectedGroups);

  /**
   * Only a row that still owes something can be paid.
   *
   * `recordPayment` already refuses a zero balance, so this is not what makes
   * the write safe — it is what stops the button counting cheques it will not
   * write. Without it, selecting a Fully Paid row would arm "Pay 3 Payables"
   * and then write two.
   */
  const payableSelection = selectedRows.filter((r) => r.balance > 0);
  const payableGroupsSelected = useMemo(
    () => filterPayableGroups(selectedGroups, (row) => row.balance > 0),
    [selectedGroups],
  );

  const payBlock =
    selectedRows.length === 0
      ? "Select a payable to pay."
      : payableSelection.length === 0
        ? "Every selected payable is already paid in full."
        : null;

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** The broker row's checkbox covers that broker's visible rows, nothing else. */
  function toggleGroup(group: PayableGroup) {
    const keys = group.rows.map((r) => r.key);
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }

  /**
   * Writes one payment per selected payable, each for its full balance.
   *
   * One `recordPayment` call per row rather than a bulk action of its own:
   * that function owns the clamp to the balance, the id, the viewer and the
   * date sort, and a second write path would be a second place for all four to
   * be got wrong.
   */
  function paySelected(date: string) {
    const written = payableSelection.filter(
      (row) =>
        recordPayment(row.dealId, row.payableId, {
          date,
          grossAmount: row.balance,
          deductions: [],
        }).paymentId !== null,
    );

    setSelected(new Set());

    if (written.length === 0) {
      notify({
        title: "Nothing was paid",
        description: "Those payables wouldn't accept a payment.",
        variant: "destructive",
      });
      return;
    }

    const paid = written.reduce((sum, r) => sum + r.balance, 0);
    notify({
      title: `${written.length} ${written.length === 1 ? "payment" : "payments"} recorded`,
      description: `${formatCurrency(paid)} paid out.`,
    });
  }

  return (
    // The body scrolls, not the table — the same call the Receivables index
    // makes. A grouped table has no header worth pinning: the heading that
    // matters is the broker row, and it travels with its own rows.
    <div className="h-100 d-flex flex-column overflow-hidden">
      {/* Header band — the full-bleed identity strip a deal page opens with. */}
      <div className="bg-card border-bottom flex-shrink-0">
        <div className="container p-4 d-flex align-items-center justify-content-between gap-3">
          <div className="d-flex flex-column gap-0">
            <h1 className="fs-4 mb-0 fw-semibold">Payables</h1>
            <div className="text-muted fs-small">
              Pay brokers what the brokerage owes them
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted">
              Displaying {shown} of {total}{" "}
              {total === 1 ? "Payable" : "Payables"}
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
                      disabled={payBlock !== null}
                      onClick={() => setPaying(true)}
                    >
                      Pay Selected
                    </Button>
                  </span>
                }
              />
              <Tooltip.Content>
                {payBlock ??
                  `Pay ${payableSelection.length} selected ${
                    payableSelection.length === 1 ? "payable" : "payables"
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
              <PayableFilterBar
                filters={filters}
                years={years}
                onChange={updateFilters}
              />
            </Card.Body>
          </Card>

          <Card className="shadow flex-shrink-0">
            <Card.Body className="d-flex flex-column gap-3">
              {filtered.length === 0 ? (
                <Empty className="flex-shrink-0">
                  <Empty.Media>
                    <FontAwesomeIcon icon={faMoneyCheckDollarPen} />
                  </Empty.Media>
                  <Empty.Content>
                    <Empty.Title>No payables match</Empty.Title>
                    {activeFilterCount > 0
                      ? "Widen the year or clear a filter."
                      : // A payable is raised by a deposit on an approved
                        // voucher, so an empty book here means nothing has been
                        // collected yet rather than that nothing is owed.
                        "Nothing has been collected on an approved voucher yet."}
                  </Empty.Content>
                  {activeFilterCount > 0 && (
                    <Empty.Actions>
                      <Button
                        variant="outline"
                        onClick={() => updateFilters(clearedPayableFilters())}
                      >
                        Clear filters
                      </Button>
                    </Empty.Actions>
                  )}
                </Empty>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head style={{ width: 40 }} />
                      <Table.Head>Payable For</Table.Head>
                      <Table.Head>Creation Date</Table.Head>
                      <Table.Head className="text-end">Amount</Table.Head>
                      <Table.Head className="text-end">Balance</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filtered.map((group) => {
                      const keys = group.rows.map((r) => r.key);
                      const allOn = keys.every((k) => selected.has(k));
                      return (
                        // A Fragment per group rather than a nested table: the
                        // broker heading and its rows are rows of the SAME
                        // grid, so a figure under Balance lands in the same
                        // place on both.
                        <Fragment key={group.key}>
                          {/* The broker heading. Its cells are `Table.Head` —
                              `<th>` — rather than styled `Table.Cell`s, so the
                              header background comes from the theme rather than
                              from a colour spelled here, and the name is marked
                              up as what it is: the heading for the rows under
                              it. */}
                          <Table.Row>
                            <Table.Head style={{ width: 40 }}>
                              <Checkbox
                                checked={allOn}
                                onCheckedChange={() => toggleGroup(group)}
                                aria-label={`Select every payable owed to ${group.broker.name}`}
                              />
                            </Table.Head>
                            <Table.Head colSpan={4}>
                              <span className="d-inline-flex align-items-center gap-2">
                                <Avatar size="sm">
                                  {group.broker.avatarUrl && (
                                    <Avatar.Image
                                      src={group.broker.avatarUrl}
                                      alt=""
                                    />
                                  )}
                                  <Avatar.Fallback>
                                    {group.broker.initials}
                                  </Avatar.Fallback>
                                </Avatar>
                                {group.broker.name}
                                {/* Body-size and bold rather than a large
                                    figure: a page of stacked broker headings is
                                    already dense, and one big number per
                                    heading would compete with the column of
                                    figures it is the total OF. */}
                                <span className="text-muted fw-normal ms-3">
                                  Total due:{" "}
                                  <span className="fw-semibold text-body">
                                    {formatCurrency(group.totalDue)}
                                  </span>
                                </span>
                              </span>
                            </Table.Head>
                          </Table.Row>

                          {group.rows.map((row) => (
                            // No whole-row click. The Payable For cell is the
                            // one destination, for the reason the Receivables
                            // table gives: a row that both navigates and holds
                            // a link teaches two rules at once.
                            <Table.Row key={row.key}>
                              <Table.Cell>
                                <Checkbox
                                  checked={selected.has(row.key)}
                                  onCheckedChange={() => toggleRow(row.key)}
                                  aria-label={`Select ${row.voucherName}, ${formatCurrency(row.balance)} owed to ${group.broker.name}`}
                                />
                              </Table.Cell>
                              <Table.Cell className="fw-medium text-nowrap">
                                <Link {...row.target}>{row.voucherName}</Link>
                              </Table.Cell>
                              <Table.Cell className="text-nowrap">
                                {formatDate(row.date)}
                              </Table.Cell>
                              <Table.Cell className="text-end text-nowrap">
                                {formatCurrency(row.amount)}
                              </Table.Cell>
                              {/* Muted once nothing is left to pay. The column
                                  reads downward, and a settled row showing a
                                  bold $0.00 draws the eye to the one line on it
                                  that needs nothing done. */}
                              <Table.Cell
                                className={`text-end text-nowrap${
                                  row.balance > 0 ? "" : " text-muted"
                                }`}
                              >
                                {formatCurrency(row.balance)}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Fragment>
                      );
                    })}
                  </Table.Body>
                </Table>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      <PaySelectedModal
        open={paying}
        onOpenChange={setPaying}
        groups={payableGroupsSelected}
        onConfirm={paySelected}
      />
    </div>
  );
}
