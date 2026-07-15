import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker, Listing } from "#/data/types";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { formatCurrency, formatDate } from "./dealDisplay";

/** Chart colors — same brand hues already used for the app's other recharts series. */
const DEDUCTIONS_COLOR = "#8833ea";
const BROKER_COLOR = "#2968e7";
const UNALLOCATED_COLOR = "#e27400";

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/** Borderless group: a heading (+ optional action) over its content — sections are set apart by gap, not a card. */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <h3 className="fs-large fw-semibold mb-0">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A person's name — links to their contact record when one is resolvable, plain text otherwise. */
function PersonLink({ name, contactId }: { name: string; contactId?: string }) {
  if (!contactId) return <>{name}</>;
  return (
    <Link to="/backoffice/contacts/$contactId" params={{ contactId }}>
      {name}
    </Link>
  );
}

/** Label + figure at body size — so KPI figures don't compete with the section headings above them. */
function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border rounded p-3" style={{ borderRadius: 6 }}>
      <div className="text-muted text-truncate fs-small">{label}</div>
      <div className={`fw-bold mt-1 ${accent ? "text-danger" : ""}`}>{value}</div>
    </div>
  );
}

type BreakdownRow = {
  label: string;
  value: string;
  /** Swatch color — matches the donut slice it corresponds to. Omitted for the Allocated subtotal row. */
  color?: string;
  /** Bolds the row as a subtotal (Allocated). */
  emphasis?: boolean;
  accent?: boolean;
};

/** One row of the breakdown list — its color swatch doubles as the donut's legend entry. */
function BreakdownListRow({ row, isLast }: { row: BreakdownRow; isLast: boolean }) {
  return (
    <div
      className={`d-flex align-items-center justify-content-between gap-3 py-2${isLast ? "" : " border-bottom"}`}
    >
      <div className="d-flex align-items-center gap-2">
        {row.color && (
          <span
            className="d-inline-block rounded-circle flex-shrink-0"
            style={{ width: 8, height: 8, backgroundColor: row.color }}
            aria-hidden="true"
          />
        )}
        <span className={row.emphasis ? "fw-semibold" : "text-muted"}>{row.label}</span>
      </div>
      <span className={`${row.emphasis ? "fw-bold" : "fw-semibold"}${row.accent ? " text-danger" : ""}`}>
        {row.value}
      </span>
    </div>
  );
}

/** Gross Commission Breakdown: a list (doubling as the donut's legend) with the chart alongside it. */
function BreakdownSection({ listing }: { listing: Listing }) {
  const { transaction } = listing;
  const { backOffice: financials, commissionAmount } = transaction;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const preSplitTotal = sum(financials.preSplitDeductions.map((d) => d.amount));
  const brokerTotal = sum(listing.internalBrokers.map((b) => b.grossCommission));
  const allocated = preSplitTotal + brokerTotal;
  const unallocated = Math.max(0, commissionAmount - allocated);

  const segments = [
    { label: "Pre-Split Deductions", value: preSplitTotal, color: DEDUCTIONS_COLOR },
    { label: "Broker Commission", value: brokerTotal, color: BROKER_COLOR },
    { label: "Unallocated", value: unallocated, color: UNALLOCATED_COLOR },
  ];

  const rows: BreakdownRow[] = [
    { label: "Pre-Split Deductions", value: formatCurrency(preSplitTotal), color: DEDUCTIONS_COLOR },
    { label: "Broker Commission", value: formatCurrency(brokerTotal), color: BROKER_COLOR },
    { label: "Allocated", value: formatCurrency(allocated), emphasis: true },
    {
      label: "Unallocated",
      value: formatCurrency(unallocated),
      color: UNALLOCATED_COLOR,
      accent: unallocated > 0,
    },
  ];

  return (
    <Section
      title="Gross Commission Breakdown"
    >
      <div className="row g-4 align-items-center">
        <div className="col-md-7">
          {rows.map((row, i) => (
            <BreakdownListRow key={row.label} row={row} isLast={i === rows.length - 1} />
          ))}
        </div>
        <div className="col-md-5">
          <div style={{ height: 160 }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ChartTooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Pie
                    data={segments}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {segments.map((s) => (
                      <Cell key={s.label} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

function dealSideLabel(listing: Listing): string {
  return listing.dealSide === "buyer" ? "Buy Side" : "Sell Side";
}

/** The two Internal Commissions tables: broker gross split, then each broker's personal payout. */
function InternalCommissionsSection({ listing }: { listing: Listing }) {
  const brokers = listing.internalBrokers;
  const grossTotal = sum(brokers.map((b) => b.grossCommission));

  return (
    <Section
      title="Internal Commissions"
      action={
        <Button variant="ghost" size="sm">
          <FontAwesomeIcon icon={faPlus} />
          Add broker
        </Button>
      }
    >
      <div className="d-flex flex-column gap-4">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Brokers</Table.Head>
              <Table.Head>Transaction Side</Table.Head>
              <Table.Head className="text-end">Gross %</Table.Head>
              <Table.Head className="text-end">Gross $</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {brokers.map((b) => (
              <Table.Row key={b.id}>
                <Table.Cell>
                  <PersonLink name={b.name} contactId={b.id} />
                </Table.Cell>
                <Table.Cell>{dealSideLabel(listing)}</Table.Cell>
                <Table.Cell className="text-end">{b.commissionSplitPct}</Table.Cell>
                <Table.Cell className="text-end">{formatCurrency(b.grossCommission)}</Table.Cell>
              </Table.Row>
            ))}
            <Table.Row>
              <Table.Cell colSpan={3} className="fw-semibold">
                Sum
              </Table.Cell>
              <Table.Cell className="text-end fw-semibold">{formatCurrency(grossTotal)}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Brokers</Table.Head>
              <Table.Head>Commission Plan</Table.Head>
              <Table.Head className="text-end">Broker Split %</Table.Head>
              <Table.Head className="text-end">Broker Split $</Table.Head>
              <Table.Head className="text-end">Net Amount</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {brokers.map((b) => {
              const splitPct = b.personalSplitPct ?? 0;
              const netAmount = Math.round(b.grossCommission * (splitPct / 100));
              return (
                <Table.Row key={b.id}>
                  <Table.Cell>
                    <PersonLink name={b.name} contactId={b.id} />
                  </Table.Cell>
                  <Table.Cell>{b.commissionPlan ?? "No Plan"}</Table.Cell>
                  <Table.Cell className="text-end">{splitPct}</Table.Cell>
                  <Table.Cell className="text-end">{formatCurrency(netAmount)}</Table.Cell>
                  <Table.Cell className="text-end">
                    <Button variant="ghost" size="sm">
                      View Est.
                    </Button>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </div>
    </Section>
  );
}

function OutsideCommissionsSection({ brokers }: { brokers: DealBroker[] }) {
  return (
    <Section
      title="Outside Commissions"
      action={
        <Button variant="ghost" size="sm">
          <FontAwesomeIcon icon={faPlus} />
          Add Outside Commission
        </Button>
      }
    >
      {brokers.length === 0 ? (
        <p className="text-muted mb-0">No outside commissions have been added.</p>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Brokers</Table.Head>
              <Table.Head className="text-end">Split %</Table.Head>
              <Table.Head className="text-end">Amount</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {brokers.map((b) => (
              <Table.Row key={b.id}>
                <Table.Cell>
                  <PersonLink name={b.name} contactId={b.id} />
                </Table.Cell>
                <Table.Cell className="text-end">{b.commissionSplitPct}</Table.Cell>
                <Table.Cell className="text-end">{formatCurrency(b.grossCommission)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Section>
  );
}

function PreSplitDeductionsSection({ listing }: { listing: Listing }) {
  const deductions = listing.transaction.backOffice.preSplitDeductions;
  const amountTotal = sum(deductions.map((d) => d.amount));
  const coveredTotal = sum(deductions.map((d) => d.covered ?? 0));

  return (
    <Section
      title="Pre-Split Deductions"
      action={
        <Button variant="ghost" size="sm">
          <FontAwesomeIcon icon={faPlus} />
          Add Pre-Split Deduction
        </Button>
      }
    >
      {deductions.length === 0 ? (
        <p className="text-muted mb-0">No pre-split deductions have been added.</p>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Category</Table.Head>
              <Table.Head>Description</Table.Head>
              <Table.Head className="text-end">Percent %</Table.Head>
              <Table.Head className="text-end">Amount $</Table.Head>
              <Table.Head className="text-end">Covered $</Table.Head>
              <Table.Head />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {deductions.map((d) => (
              <Table.Row key={d.id}>
                <Table.Cell>{d.category}</Table.Cell>
                <Table.Cell>{d.description}</Table.Cell>
                <Table.Cell className="text-end">{d.pct}</Table.Cell>
                <Table.Cell className="text-end">{formatCurrency(d.amount)}</Table.Cell>
                <Table.Cell className="text-end">
                  {d.covered !== null ? formatCurrency(d.covered) : "None"}
                </Table.Cell>
                <Table.Cell className="text-end">
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
            <Table.Row>
              <Table.Cell colSpan={3} className="fw-semibold">
                Sum
              </Table.Cell>
              <Table.Cell className="text-end fw-semibold">{formatCurrency(amountTotal)}</Table.Cell>
              <Table.Cell className="text-end fw-semibold">{formatCurrency(coveredTotal)}</Table.Cell>
              <Table.Cell />
            </Table.Row>
          </Table.Body>
        </Table>
      )}
    </Section>
  );
}

function ReceivablesSection({ listing }: { listing: Listing }) {
  const receivables = listing.transaction.backOffice.receivables;
  const amountTotal = sum(receivables.map((r) => r.amount));
  const creditedTotal = sum(receivables.map((r) => r.credited));
  // Receivables don't carry a payer id, but every payer is the deal's buyer (or seller) contact.
  const payerContactId = listing.buyerContactIds[0] ?? listing.sellerContactIds[0];

  return (
    <Section
      title="Receivables"
      action={
        <div className="d-flex gap-2">
          <Button variant="ghost" size="sm">
            <FontAwesomeIcon icon={faPlus} />
            Add Receivable
          </Button>
          <Button variant="ghost" size="sm">
            Actions
          </Button>
        </div>
      }
    >
      {receivables.length === 0 ? (
        <p className="text-muted mb-0">No receivables have been added.</p>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Payer Name</Table.Head>
              <Table.Head>Due Date</Table.Head>
              <Table.Head>Billing Description</Table.Head>
              <Table.Head className="text-end">Receivable Amount</Table.Head>
              <Table.Head className="text-end">Credited Amount</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {receivables.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>
                  <div>
                    <PersonLink name={r.payerName} contactId={payerContactId} />
                  </div>
                  <div className="text-muted fs-small">{r.payerEmail}</div>
                </Table.Cell>
                <Table.Cell>{formatDate(r.dueDate)}</Table.Cell>
                <Table.Cell>{r.billingDescription}</Table.Cell>
                <Table.Cell className="text-end">{formatCurrency(r.amount)}</Table.Cell>
                <Table.Cell className="text-end">
                  {r.credited > 0 ? formatCurrency(r.credited) : "None"}
                </Table.Cell>
              </Table.Row>
            ))}
            <Table.Row>
              <Table.Cell colSpan={3} className="fw-semibold">
                Sum
              </Table.Cell>
              <Table.Cell className="text-end fw-semibold">{formatCurrency(amountTotal)}</Table.Cell>
              <Table.Cell className="text-end fw-semibold">{formatCurrency(creditedTotal)}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      )}
    </Section>
  );
}

/** Financials tab: gross commission, its breakdown, commissions, and receivables/payables. */
export function DealFinancials({ listing }: { listing: Listing }) {
  return (
    <div className="d-flex flex-column gap-5 p-4">
      <ListingPageHeader
        title="Financials"
        actions={
          <div className="d-flex gap-2">
            <Button variant="outline">Deal Sheet</Button>
            <Button variant="primary">Submit Financials</Button>
          </div>
        }
      />

      <Section title="Gross Commission">
        <div className="row g-3">
          <div className="col-md-4">
            <StatTile label="Transaction Value (TV)" value={formatCurrency(listing.transaction.salePrice)} />
          </div>
          <div className="col-md-4">
            <StatTile label="Gross Commission Percent *" value={`${listing.transaction.commissionPct}%`} />
          </div>
          <div className="col-md-4">
            <StatTile label="Gross Commission Amount *" value={formatCurrency(listing.transaction.commissionAmount)} />
          </div>
        </div>
        <p className="text-muted fs-small mb-0">* Required to submit financials for this deal.</p>
      </Section>

      <BreakdownSection listing={listing} />

      <Separator />

      <OutsideCommissionsSection brokers={listing.outsideBrokers} />
      <PreSplitDeductionsSection listing={listing} />
      <InternalCommissionsSection listing={listing} />

      <Separator />

      <ReceivablesSection listing={listing} />

      <Section title="Payables">
        <p className="text-muted mb-0">
          Payables will be automatically created when deposits are applied to this deal.
        </p>
      </Section>
    </div>
  );
}
