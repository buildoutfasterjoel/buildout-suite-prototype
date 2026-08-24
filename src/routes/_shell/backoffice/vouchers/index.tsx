import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRight,
  faFileInvoiceDollar,
  faMagnifyingGlass,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import {
  allVouchers,
  voucherTotals,
  VOUCHER_STATUSES,
  type VoucherRow,
  type VoucherStatus,
} from "#/data/vouchers";
import { StatusPill } from "#/components/deals/DealStageBadge";
import { formatCurrency, formatDate } from "#/components/deals/dealDisplay";
import { TYPE_LABELS } from "#/components/properties/propertyDisplay";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

export const Route = createFileRoute("/_shell/backoffice/vouchers/")({
  component: VouchersPage,
  head: () => ({ meta: [{ title: "Vouchers | Buildout Suite" }] }),
});

const PAGE_SIZE = 25;

/**
 * Status colours, borrowed from the deal-stage tokens so the back office reads
 * in the same palette as the pipeline: grey for not-yet-submitted, the
 * in-flight purple for awaiting a decision, and the closed green for approved.
 */
const STATUS_COLORS: Record<VoucherStatus, string> = {
  Draft: "var(--stage-inactive)",
  Pending: "var(--stage-under-contract)",
  Approved: "var(--stage-closed)",
};

/** The band's tiles spell the state out; the table's badges stay terse. */
const STATUS_BAND_LABELS: Record<VoucherStatus, string> = {
  Draft: "Draft",
  Pending: "Pending Approval",
  Approved: "Approved",
};

/** Whole dollars — the band footes many vouchers, where cents are noise. */
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** One status's gross commission and voucher count, under a coloured rule. */
function CommissionTile({
  status,
  count,
  grossCommission,
}: {
  status: VoucherStatus;
  count: number;
  grossCommission: number;
}) {
  const color = STATUS_COLORS[status];
  return (
    <div className="col-12 col-md-4">
      <div className="bg-card border rounded overflow-hidden h-100">
        <div style={{ height: 4, backgroundColor: color }} />
        <div className="p-3">
          <div className="d-flex align-items-center gap-2 text-muted fs-small fw-semibold text-uppercase">
            <span
              className="rounded-circle flex-shrink-0"
              style={{ width: 8, height: 8, backgroundColor: color }}
            />
            {STATUS_BAND_LABELS[status]}
          </div>
          {/* Body-size bold, not a display figure: three of these sit under a
              heading and above a table, and outsized numerals would outrank
              both. */}
          <div className="mt-2">
            <span className="fw-bold">{money(grossCommission)}</span>
            <span className="text-muted">
              {" | "}
              {count} {count === 1 ? "Voucher" : "Vouchers"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Every voucher in the book, across every deal — the Back Office index.
 *
 * A row's two links go to different places on purpose: the voucher name opens
 * the voucher itself (a tab whose route depends on the deal's shape — see
 * `voucherHref`), while the Deal column opens the deal record behind it.
 */
function VouchersPage() {
  const navigate = useNavigate();
  // Subscribe to the map: a voucher's figures live on its deal, so this must
  // re-render when any deal changes, not merely when one is added or removed.
  void useDataStore((s) => s.listings);
  const rows = allVouchers();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VoucherStatus | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.dealName.toLowerCase().includes(q) ||
        row.identifier.toLowerCase().includes(q) ||
        row.relatedContactsLabel.toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  // The band foots the filtered set, so it always agrees with the table beneath
  // it — a filtered view whose totals described the whole book would misreport.
  const totals = voucherTotals(filtered);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped rather than reset in an effect: a filter change that shortens the
  // list would otherwise render one blank frame on a now-nonexistent page.
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function openVoucher(row: VoucherRow) {
    void navigate(row.target);
  }

  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      {/* Header band — the full-bleed identity strip a deal page opens with. */}
      <div className="bg-card border-bottom">
        <div className="container p-4 d-flex align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <FontAwesomeIcon
              icon={faFileInvoiceDollar}
              className="text-muted"
              style={{ fontSize: 20 }}
            />
            <h1 className="fs-4 mb-0 fw-semibold">Vouchers</h1>
          </div>
          <span className="text-muted">
            Displaying {filtered.length} of {rows.length}{" "}
            {rows.length === 1 ? "Voucher" : "Vouchers"}
          </span>
        </div>
      </div>

      <div className="container d-flex flex-column gap-4 py-4">
        <section className="d-flex flex-column gap-3">
          <h2 className="fs-6 mb-0 fw-semibold">Gross Commission</h2>
          <div className="row g-3">
            {VOUCHER_STATUSES.map((s) => (
              <CommissionTile
                key={s}
                status={s}
                count={totals[s].count}
                grossCommission={totals[s].grossCommission}
              />
            ))}
          </div>
        </section>

        <Card className="shadow">
          <Card.Body className="d-flex flex-column gap-3">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div style={{ maxWidth: 320, flex: "1 1 240px" }}>
                <InputGroup>
                  <InputGroup.Addon>
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </InputGroup.Addon>
                  <Input
                    type="search"
                    placeholder="Search name, identifier, or contact"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </InputGroup>
              </div>
              {/* Fixed width: Select.Trigger fills its container, so as a bare
                  flex child it would eat the whole row. */}
              <div style={{ width: 220 }}>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as VoucherStatus | "all");
                    setPage(1);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {(v) =>
                        v === "all"
                          ? "Voucher Status"
                          : STATUS_BAND_LABELS[v as VoucherStatus]
                      }
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">All Statuses</Select.Item>
                    {VOUCHER_STATUSES.map((s) => (
                      <Select.Item key={s} value={s}>
                        {STATUS_BAND_LABELS[s]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <Empty>
                <Empty.Media>
                  <FontAwesomeIcon icon={faFileInvoiceDollar} />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No vouchers match</Empty.Title>
                  Try a different search term or clear the status filter.
                </Empty.Content>
              </Empty>
            ) : (
              <>
                {/* Eleven columns outrun the container on a laptop; the table
                    scrolls inside its own box rather than the page doing it.
                    The inner width is load-bearing. `max-content` sizes the
                    table to what its columns actually need, so no column is
                    squeezed into wrapping or clipped mid-figure; `min-width:
                    100%` keeps it filling the card when the columns do fit. A
                    fixed floor can't do both — too low and columns scrunch, too
                    high and a narrow table grows a scrollbar it doesn't need. */}
                <div className="table-responsive">
                  <div style={{ width: "max-content", minWidth: "100%" }}>
                    <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Voucher Name</Table.Head>
                        <Table.Head>Deal</Table.Head>
                        <Table.Head>ID</Table.Head>
                        <Table.Head>Status</Table.Head>
                        <Table.Head>Close Date</Table.Head>
                        <Table.Head>Deal Type</Table.Head>
                        <Table.Head>Property Type</Table.Head>
                        <Table.Head>Related Contacts</Table.Head>
                        <Table.Head className="text-end">
                          Transaction Value
                        </Table.Head>
                        <Table.Head className="text-end">
                          Gross Commission
                        </Table.Head>
                        <Table.Head className="text-end">
                          Receivables
                        </Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {visible.map((row) => (
                        // The whole row opens the voucher, matching the shell's
                        // per-space index and ContactsTable. `shouldIgnoreRowClick`
                        // exempts `<a>`, so the two links inside keep their own
                        // targets and modified clicks still open new tabs.
                        <Table.Row
                          key={row.dealId}
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            if (shouldIgnoreRowClick(e)) return;
                            openVoucher(row);
                          }}
                        >
                          <Table.Cell className="fw-medium text-nowrap">
                            <Link {...row.target} className="text-reset">
                              {row.name}
                            </Link>
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            <Link
                              to="/listings/$listingId"
                              params={{ listingId: row.dealId }}
                              className="d-inline-flex align-items-center gap-1"
                            >
                              {row.dealName}
                              <FontAwesomeIcon
                                icon={faArrowUpRight}
                                style={{ fontSize: 11 }}
                              />
                            </Link>
                          </Table.Cell>
                          <Table.Cell className="text-muted">
                            {row.identifier}
                          </Table.Cell>
                          <Table.Cell>
                            <StatusPill color={STATUS_COLORS[row.status]}>
                              {row.status}
                            </StatusPill>
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {formatDate(row.closeDate)}
                          </Table.Cell>
                          <Table.Cell>{row.dealType}</Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {row.propertyType
                              ? TYPE_LABELS[row.propertyType]
                              : "--"}
                          </Table.Cell>
                          <Table.Cell>{row.relatedContactsLabel}</Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.transactionValue)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.grossCommission)}
                          </Table.Cell>
                          <Table.Cell className="text-end text-nowrap">
                            {formatCurrency(row.receivablesOutstanding)}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                    </Table>
                  </div>
                </div>

                {pageCount > 1 && (
                  <Pagination>
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
  );
}
