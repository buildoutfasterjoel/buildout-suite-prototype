import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPencil,
  faTableRowsAddAbove,
  faTableRowsAddBelow,
  faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker, Listing } from "#/data/types";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { formatCurrency, formatDate } from "./dealDisplay";
import { EditTransactionDialog } from "./EditTransactionDialog";
import {
  buildRentSchedule,
  computeTotal,
  formatScheduleDate,
  makeRow,
  reflowDates,
  type RentScheduleRow,
} from "./rentSchedule";

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

/** Label + Switch + ON/OFF state — the toggles above the rent schedule. */
function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="d-flex align-items-center gap-2">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      <span className="text-muted fs-small fw-semibold">{checked ? "ON" : "OFF"}</span>
    </div>
  );
}

/** Kinds of value an editable cell can hold — drives its input type and formatting. */
type CellType = "date" | "int" | "currency" | "percent";

/**
 * A schedule cell whose value is edited in place: shows the formatted value with an
 * "editable" underline, and swaps to an input on click (or Enter). Commits on blur/Enter,
 * cancels on Escape. Keystrokes stay local, so the row doesn't re-render mid-edit.
 */
function EditableCell({
  type,
  value,
  onCommit,
  align,
}: {
  type: CellType;
  value: number | string;
  onCommit: (next: number | string) => void;
  align?: "end";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    setEditing(false);
    if (type === "date") {
      if (draft) onCommit(draft);
      return;
    }
    const n = Number.parseFloat(draft);
    if (!Number.isNaN(n)) onCommit(type === "int" ? Math.max(1, Math.round(n)) : Math.max(0, n));
  }

  if (editing) {
    return (
      <input
        type={type === "date" ? "date" : "number"}
        className={`form-control form-control-sm${align === "end" ? " text-end" : ""}`}
        value={draft}
        autoFocus
        step={type === "currency" ? "0.01" : type === "percent" ? "0.1" : "1"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  const display =
    type === "date"
      ? formatScheduleDate(String(value))
      : type === "currency"
        ? formatCurrency(Number(value))
        : String(value);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setDraft(String(value));
          setEditing(true);
        }
      }}
      className="d-inline-block"
      style={{ cursor: "pointer", borderBottom: "1px dashed var(--bs-border-color)" }}
    >
      {display}
    </span>
  );
}

/** The three per-row actions — insert above/below and delete — each with a tooltip. */
function RowActions({
  onAddAbove,
  onAddBelow,
  onRemove,
}: {
  onAddAbove: () => void;
  onAddBelow: () => void;
  onRemove: () => void;
}) {
  const actions = [
    { icon: faTableRowsAddAbove, label: "Add term above", onClick: onAddAbove },
    { icon: faTableRowsAddBelow, label: "Add term below", onClick: onAddBelow },
    { icon: faTrashCan, label: "Delete term", onClick: onRemove },
  ];
  return (
    <div className="d-flex justify-content-end gap-1">
      {actions.map((a) => (
        <Tooltip key={a.label}>
          <Tooltip.Trigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={a.label} onClick={a.onClick}>
                <FontAwesomeIcon icon={a.icon} />
              </Button>
            }
          />
          <Tooltip.Content>{a.label}</Tooltip.Content>
        </Tooltip>
      ))}
    </div>
  );
}

/** Fields of a term the user can edit inline; the rest are derived by `reflowDates`. */
type EditableField = "startDate" | "months" | "monthlyRate" | "commissionPct";

/**
 * Rent Schedule: the lease term broken into annual periods, showing rent and the
 * commission earned per period. Renders only for Lease deals (whole building or an
 * individual space) — derived from the deal's lease terms, then editable in place.
 *
 * The schedule stays contiguous: the first term's start date anchors it, each later
 * term flows from the one before, and end dates / totals are always derived. Editing a
 * value, inserting a term, or removing one re-flows the dates and recomputes the totals.
 * State is component-local (resets on reload).
 */
function RentScheduleSection({ listing }: { listing: Listing }) {
  const initial = buildRentSchedule(listing);
  const [rows, setRows] = useState<RentScheduleRow[]>(initial?.rows ?? []);
  const [autoCalcRents, setAutoCalcRents] = useState(true);
  const [operatingExpenses, setOperatingExpenses] = useState(false);

  // Hooks run unconditionally above; non-lease deals render nothing.
  if (!initial) return null;
  const schedule = initial; // non-null const so closures below keep the narrowing

  const total = computeTotal(rows);

  function editField(index: number, field: EditableField, next: number | string) {
    setRows((prev) => reflowDates(prev.map((r, i) => (i === index ? { ...r, [field]: next } : r))));
  }

  /** Insert a 12-month term at `index`, inheriting the reference term's rate & commission. */
  function insertTerm(index: number) {
    setRows((prev) => {
      const ref = prev[Math.min(index, prev.length - 1)] ?? schedule.rows[0];
      const row = makeRow(ref.startDate, 12, ref.monthlyRate, ref.commissionPct);
      return reflowDates([...prev.slice(0, index), row, ...prev.slice(index)]);
    });
  }

  function removeTerm(index: number) {
    setRows((prev) => reflowDates(prev.filter((_, i) => i !== index)));
  }

  /** "Add Term" button: append after the last term; auto-calculate escalates the rate. */
  function addTerm() {
    setRows((prev) => {
      if (prev.length === 0) return reflowDates([{ ...schedule.rows[0] }]);
      const last = prev[prev.length - 1];
      const monthlyRate = autoCalcRents
        ? last.monthlyRate * (1 + schedule.escalatorPct / 100)
        : last.monthlyRate;
      return reflowDates([...prev, makeRow(prev[0].startDate, 12, monthlyRate, last.commissionPct)]);
    });
  }

  return (
    <Section
      title="Rent Schedule"
      action={
        <Button variant="ghost" size="sm" onClick={addTerm}>
          <FontAwesomeIcon icon={faPlus} />
          Add Term
        </Button>
      }
    >
      <div className="d-flex align-items-center gap-4">
        <ToggleControl
          label="Auto-calculate Rents"
          checked={autoCalcRents}
          onChange={setAutoCalcRents}
        />
        <ToggleControl
          label="Operating expenses"
          checked={operatingExpenses}
          onChange={setOperatingExpenses}
        />
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Start Date</Table.Head>
            <Table.Head>End Date</Table.Head>
            <Table.Head>Months</Table.Head>
            <Table.Head className="text-end">Lease Rate</Table.Head>
            <Table.Head className="text-end">Total Rent</Table.Head>
            <Table.Head className="text-end">Commission %</Table.Head>
            <Table.Head className="text-end">Commission $</Table.Head>
            <Table.Head />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((r, i) => (
            <Table.Row key={r.startDate}>
              <Table.Cell>
                {/* The first term's start anchors the schedule; later starts are derived. */}
                {i === 0 ? (
                  <EditableCell
                    type="date"
                    value={r.startDate}
                    onCommit={(next) => editField(i, "startDate", next)}
                  />
                ) : (
                  formatScheduleDate(r.startDate)
                )}
              </Table.Cell>
              <Table.Cell>{formatScheduleDate(r.endDate)}</Table.Cell>
              <Table.Cell>
                <EditableCell type="int" value={r.months} onCommit={(next) => editField(i, "months", next)} />
              </Table.Cell>
              <Table.Cell className="text-end">
                <EditableCell
                  type="currency"
                  align="end"
                  value={r.monthlyRate}
                  onCommit={(next) => editField(i, "monthlyRate", next)}
                />
              </Table.Cell>
              <Table.Cell className="text-end">{formatCurrency(r.totalRent)}</Table.Cell>
              <Table.Cell className="text-end">
                <EditableCell
                  type="percent"
                  align="end"
                  value={r.commissionPct}
                  onCommit={(next) => editField(i, "commissionPct", next)}
                />
              </Table.Cell>
              <Table.Cell className="text-end">{formatCurrency(r.commissionAmount)}</Table.Cell>
              <Table.Cell className="text-end">
                <RowActions
                  onAddAbove={() => insertTerm(i)}
                  onAddBelow={() => insertTerm(i + 1)}
                  onRemove={() => removeTerm(i)}
                />
              </Table.Cell>
            </Table.Row>
          ))}
          {total && (
            <Table.Row>
              <Table.Cell className="fw-semibold">{formatScheduleDate(total.startDate)}</Table.Cell>
              <Table.Cell className="fw-semibold">{formatScheduleDate(total.endDate)}</Table.Cell>
              <Table.Cell className="fw-semibold">{total.months}</Table.Cell>
              <Table.Cell />
              <Table.Cell className="text-end fw-semibold">{formatCurrency(total.totalRent)}</Table.Cell>
              <Table.Cell className="text-end fw-semibold">{total.commissionPct}%</Table.Cell>
              <Table.Cell className="text-end fw-semibold">{formatCurrency(total.commissionAmount)}</Table.Cell>
              <Table.Cell />
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </Section>
  );
}

/**
 * Transaction summary at the top of the Voucher — the key deal terms (headline value,
 * commission, close probability) as stat tiles, with secondary facts beneath and an
 * inline edit. Consolidates what used to be the separate Transaction tab.
 */
function TransactionSummarySection({ listing }: { listing: Listing }) {
  const [editOpen, setEditOpen] = useState(false);
  const { transaction } = listing;
  const isLease = listing.dealType === "Lease";
  const leaseTerms = listing.marketing.spaceLeaseTerms ?? [];
  const terms = leaseTerms.find((t) => t.unitId === listing.unitId) ?? leaseTerms[0];

  const headlineLabel = isLease ? "Lease Rate" : "Sale Price";
  const headlineValue = isLease
    ? terms?.leaseRate != null
      ? `$${terms.leaseRate} ${terms.leaseRateUnits}`
      : "—"
    : formatCurrency(transaction.salePrice);

  const secondary = (
    isLease
      ? [
          `Deal ID ${listing.dealId}`,
          terms?.leaseTermMonths != null ? `Lease Term ${terms.leaseTermMonths} mo` : null,
          `Available ${listing.marketing.availableSqFt.toLocaleString()} SF`,
        ]
      : [
          `Deal ID ${listing.dealId}`,
          `Price / SF $${listing.financials.pricePerSqFt.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        ]
  ).filter(Boolean);

  return (
    <Section
      title="Transaction"
      action={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit transaction"
          onClick={() => setEditOpen(true)}
        >
          <FontAwesomeIcon icon={faPencil} />
        </Button>
      }
    >
      <div className="row g-3">
        <div className="col-md-3">
          <StatTile label={headlineLabel} value={headlineValue} />
        </div>
        <div className="col-md-3">
          <StatTile label="Commission %" value={`${transaction.commissionPct}%`} />
        </div>
        <div className="col-md-3">
          <StatTile label="Commission $" value={formatCurrency(transaction.commissionAmount)} />
        </div>
        <div className="col-md-3">
          <StatTile label="Close Probability" value={`${transaction.closeProbability}%`} />
        </div>
      </div>
      <p className="text-muted fs-small mb-0">{secondary.join(" · ")}</p>

      {editOpen && (
        <EditTransactionDialog listing={listing} open={editOpen} onOpenChange={setEditOpen} />
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

      <TransactionSummarySection listing={listing} />

      <Separator />

      <BreakdownSection listing={listing} />

      <Separator />

      <OutsideCommissionsSection brokers={listing.outsideBrokers} />
      <PreSplitDeductionsSection listing={listing} />
      <InternalCommissionsSection listing={listing} />

      <Separator />

      <RentScheduleSection listing={listing} />

      <ReceivablesSection listing={listing} />

      <Section title="Payables">
        <p className="text-muted mb-0">
          Payables will be automatically created when deposits are applied to this deal.
        </p>
      </Section>
    </div>
  );
}
