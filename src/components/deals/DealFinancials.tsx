import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
} from "recharts";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faDollarSign,
  faEllipsisVertical,
  faEnvelope,
  faPhone,
  faFileLines,
  faPercent,
  faPlus,
  faPencil,
  faTableRowsAddAbove,
  faTableRowsAddBelow,
  faTrashCan,
  faCaretDown,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type {
  DealBroker,
  DealType,
  FinancialDeduction,
  FinancialReceivable,
  Listing,
  TransactionSide,
} from "#/data/types";
import {
  addReceivable,
  createInvoiceFromReceivables,
  deleteReceivable,
  saveVoucherDraft,
  submitVoucher,
  updateReceivable,
} from "#/data/actions";
import {
  COMMISSION_PLANS,
  DEDUCTION_CATEGORIES,
  partyContactIds,
  partySectionTitle,
  payerFormOptions,
  payerRemovalBlock,
  receivablePayerLabel,
  TRANSACTION_SIDES,
  voucherParty,
  voucherPayers,
  type VoucherParty,
  type VoucherPayerRow,
} from "#/data/vouchers";
import { AddBrokerModal } from "./AddBrokerModal";
import { AddContactModal } from "./AddContactModal";
import { DueDatePicker, NewReceivableModal } from "./NewReceivableModal";
import { notify } from "#/lib/notify";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { VoucherStatusBadge } from "./VoucherStatusBadge";
import { VoucherApprovalBanner } from "./VoucherApprovalBanner";
import { dealEditTarget } from "./dealCardLink";
import { formatCurrency, formatDate, initials } from "./dealDisplay";
import { QuickbooksSyncBadge } from "#/components/common/QuickbooksSyncBadge";
import "./DealFinancials.scss";
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
      <div className={`fw-bold mt-1 ${accent ? "text-danger" : ""}`}>
        {value}
      </div>
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
function BreakdownListRow({
  row,
  isLast,
}: {
  row: BreakdownRow;
  isLast: boolean;
}) {
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
        <span className={row.emphasis ? "fw-semibold" : "text-muted"}>
          {row.label}
        </span>
      </div>
      <span
        className={`${row.emphasis ? "fw-bold" : "fw-semibold"}${row.accent ? " text-danger" : ""}`}
      >
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
  const brokerTotal = sum(
    listing.internalBrokers.map((b) => b.grossCommission),
  );
  const allocated = preSplitTotal + brokerTotal;
  const unallocated = Math.max(0, commissionAmount - allocated);

  const segments = [
    {
      label: "Pre-Split Deductions",
      value: preSplitTotal,
      color: DEDUCTIONS_COLOR,
    },
    { label: "Broker Commission", value: brokerTotal, color: BROKER_COLOR },
    { label: "Unallocated", value: unallocated, color: UNALLOCATED_COLOR },
  ];

  const rows: BreakdownRow[] = [
    {
      label: "Pre-Split Deductions",
      value: formatCurrency(preSplitTotal),
      color: DEDUCTIONS_COLOR,
    },
    {
      label: "Broker Commission",
      value: formatCurrency(brokerTotal),
      color: BROKER_COLOR,
    },
    { label: "Allocated", value: formatCurrency(allocated), emphasis: true },
    {
      label: "Unallocated",
      value: formatCurrency(unallocated),
      color: UNALLOCATED_COLOR,
      accent: unallocated > 0,
    },
  ];

  return (
    <Section title="Gross Commission Breakdown">
      <div className="row g-4 align-items-center">
        <div className="col-md-7">
          {rows.map((row, i) => (
            <BreakdownListRow
              key={row.label}
              row={row}
              isLast={i === rows.length - 1}
            />
          ))}
        </div>
        <div className="col-md-5">
          <div style={{ height: 160 }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ChartTooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
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

/** A broker's own split of their gross — the second table's derived money column. */
function brokerSplitAmount(broker: DealBroker): number {
  return Math.round(
    broker.grossCommission * ((broker.personalSplitPct ?? 0) / 100),
  );
}

/** One-column dropdown cell, shared by Transaction Side and Commission Plan. */
function BrokerSelectCell({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string) ?? "")}>
      <Select.Trigger aria-label={label}>
        <Select.Value placeholder="Select..." />
      </Select.Trigger>
      <Select.Content>
        {options.map((o) => (
          <Select.Item key={o} value={o}>
            {o}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
}

/** The row action both broker tables carry — delete, which drops the broker from both. */
function RemoveBrokerButton({
  name,
  onlyBroker,
  onRemove,
}: {
  name: string;
  /** The last broker on the voucher — removable by nobody. */
  onlyBroker: boolean;
  onRemove: () => void;
}) {
  const label = `Remove ${name || "broker"}`;
  const button = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      disabled={onlyBroker}
      onClick={onlyBroker ? undefined : onRemove}
    >
      <FontAwesomeIcon icon={faTrashCan} />
    </Button>
  );

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          // A disabled button fires no pointer events, so the last broker's
          // button hangs its tooltip off a wrapper — the same trick Submit
          // uses, and the reason the rule is discoverable rather than a dead
          // icon.
          onlyBroker ? <span className="d-inline-flex">{button}</span> : button
        }
      />
      <Tooltip.Content>
        {onlyBroker
          ? "A voucher keeps at least one internal broker."
          : "Remove broker"}
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The two Internal Commissions tables: what each broker takes off the deal's
 * gross, then what each takes home from their own share.
 *
 * One list behind both. A broker added from either table appears in both, and
 * deleting from either removes them from both — they are the same person on the
 * same deal, and a broker who earned a gross split but has no payout plan (or
 * the reverse) is not a state the voucher should be able to reach.
 *
 * Editable on a Draft, on the same terms as the deduction table: live controls,
 * delete as the only row action, and edits committed by the voucher's Save.
 * Broker Split $ is the one figure that is not typed — it is Gross $ times the
 * broker's own split, so typing it would let the three disagree.
 */
function InternalCommissionsSection({
  brokers,
  editable,
  onChange,
}: {
  brokers: DealBroker[];
  /** Draft only — a submitted voucher's splits are what an approver is reading. */
  editable: boolean;
  onChange: (next: DealBroker[]) => void;
}) {
  const grossTotal = sum(brokers.map((b) => b.grossCommission));
  const [adding, setAdding] = useState(false);

  const patch = (id: string, fields: Partial<DealBroker>) =>
    onChange(brokers.map((b) => (b.id === id ? { ...b, ...fields } : b)));
  // The voucher's commission has to be payable to somebody, so the last broker
  // stays. Guarded here as well as at the buttons, so both tables' Delete —
  // and anything that reaches this later — obey the same floor.
  const onlyBroker = brokers.length <= 1;
  const remove = (id: string) => {
    if (onlyBroker) return;
    onChange(brokers.filter((b) => b.id !== id));
  };

  return (
    <Section
      title="Internal Commissions"
      action={
        editable ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <FontAwesomeIcon icon={faPlus} />
            Add Broker
          </Button>
        ) : undefined
      }
    >
      <AddBrokerModal
        open={adding}
        onOpenChange={setAdding}
        brokers={brokers}
        onAdd={(b) => onChange([...brokers, b])}
      />
      <div className="d-flex flex-column gap-4">
        <Table dense className="align-middle">
          <Table.Header>
            <Table.Row>
              {/* Name and dropdown share equal widths: the remainder splits
                  between them in proportion, so they stay even at any table
                  width and a short name cannot claim half the row. */}
              <Table.Head style={{ width: 220 }}>Brokers</Table.Head>
              <Table.Head style={{ width: 220 }}>Transaction Side</Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Gross %
              </Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Gross $
              </Table.Head>
              {editable && <Table.Head style={{ width: 56 }} />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {brokers.map((b) =>
              editable ? (
                <Table.Row key={b.id}>
                  <Table.Cell>
                    <PersonLink name={b.name} contactId={b.id} />
                  </Table.Cell>
                  <Table.Cell>
                    <BrokerSelectCell
                      label="Transaction Side"
                      value={b.transactionSide ?? ""}
                      options={TRANSACTION_SIDES}
                      onChange={(v) =>
                        patch(b.id, { transactionSide: v as TransactionSide })
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <MoneyCell
                      label="Gross %"
                      unit={faPercent}
                      value={b.commissionSplitPct}
                      step="0.1"
                      onChange={(v) =>
                        patch(b.id, { commissionSplitPct: v ?? 0 })
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <MoneyCell
                      label="Gross $"
                      unit={faDollarSign}
                      value={b.grossCommission}
                      step="0.01"
                      onChange={(v) => patch(b.id, { grossCommission: v ?? 0 })}
                    />
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    <RemoveBrokerButton
                      name={b.name}
                      onlyBroker={onlyBroker}
                      onRemove={() => remove(b.id)}
                    />
                  </Table.Cell>
                </Table.Row>
              ) : (
                <Table.Row key={b.id}>
                  <Table.Cell>
                    <PersonLink name={b.name} contactId={b.id} />
                  </Table.Cell>
                  <Table.Cell>{b.transactionSide ?? "—"}</Table.Cell>
                  <Table.Cell className="text-end">
                    {b.commissionSplitPct}
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    {formatCurrency(b.grossCommission)}
                  </Table.Cell>
                </Table.Row>
              ),
            )}
          </Table.Body>
          <Table.Footer>
            <Table.Row>
              <Table.Cell colSpan={3}>Sum</Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(grossTotal)}
              </Table.Cell>
              {editable && <Table.Cell />}
            </Table.Row>
          </Table.Footer>
        </Table>

        <Table dense className="align-middle">
          <Table.Header>
            <Table.Row>
              <Table.Head style={{ width: 220 }}>Brokers</Table.Head>
              <Table.Head style={{ width: 220 }}>Commission Plan</Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Broker Split %
              </Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Broker Split $
              </Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Net Amount
              </Table.Head>
              {editable && <Table.Head style={{ width: 56 }} />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {brokers.map((b) => (
              <Table.Row key={b.id}>
                <Table.Cell>
                  <PersonLink name={b.name} contactId={b.id} />
                </Table.Cell>
                <Table.Cell>
                  {editable ? (
                    <BrokerSelectCell
                      label="Commission Plan"
                      value={b.commissionPlan ?? ""}
                      options={COMMISSION_PLANS}
                      onChange={(v) => patch(b.id, { commissionPlan: v })}
                    />
                  ) : (
                    (b.commissionPlan ?? "No Plan")
                  )}
                </Table.Cell>
                <Table.Cell className={editable ? undefined : "text-end"}>
                  {editable ? (
                    <MoneyCell
                      label="Broker Split %"
                      unit={faPercent}
                      value={b.personalSplitPct ?? 0}
                      step="0.1"
                      onChange={(v) =>
                        patch(b.id, { personalSplitPct: v ?? 0 })
                      }
                    />
                  ) : (
                    (b.personalSplitPct ?? 0)
                  )}
                </Table.Cell>
                {/* Derived from the row above it — Gross $ times this broker's
                    own split — so it is read-only at every status. */}
                <Table.Cell className="text-end">
                  {formatCurrency(brokerSplitAmount(b))}
                </Table.Cell>
                <Table.Cell className="text-end">
                  {/* The payout breakdown behind the figure. Not wired up yet,
                      so it is a button wearing the app's link styling rather
                      than a `Link` to a route that does not exist. */}
                  <button
                    type="button"
                    className="btn btn-link p-0 border-0 link-primary"
                  >
                    View Details
                  </button>
                </Table.Cell>
                {editable && (
                  <Table.Cell className="text-end">
                    <RemoveBrokerButton
                      name={b.name}
                      onlyBroker={onlyBroker}
                      onRemove={() => remove(b.id)}
                    />
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </Section>
  );
}

/** The remove action both party cards carry. */
function RemovePartyButton({
  name,
  blockedReason,
  onRemove,
}: {
  name: string;
  /** Non-null when removal is refused — greys the button and explains why. */
  blockedReason: string | null;
  onRemove: () => void;
}) {
  const button = (
    <Button
      variant="ghost"
      // `icon-sm`, not `icon`: on a card this sits in the same row as the name,
      // where a full-size icon button outweighed the name it belongs to.
      size="icon-sm"
      aria-label={`Remove ${name}`}
      disabled={blockedReason !== null}
      onClick={blockedReason !== null ? undefined : onRemove}
    >
      <FontAwesomeIcon icon={faTrashCan} />
    </Button>
  );
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          // A disabled button fires no pointer events, so a blocked one hangs
          // its tooltip off a wrapper — the same trick RemoveBrokerButton uses,
          // and the reason the rule is discoverable rather than a dead icon.
          blockedReason !== null ? (
            <span className="d-inline-flex">{button}</span>
          ) : (
            button
          )
        }
      />
      <Tooltip.Content>{blockedReason ?? `Remove ${name}`}</Tooltip.Content>
    </Tooltip>
  );
}

/** One reachable detail on a party card — icon in a fixed gutter, value beside it. */
function PartyContactLine({
  icon,
  value,
}: {
  icon: IconDefinition;
  value: string;
}) {
  return (
    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
      <FontAwesomeIcon icon={icon} className="text-muted flex-shrink-0" />
      <span className="text-truncate" title={value || undefined}>
        {value || "—"}
      </span>
    </div>
  );
}

/**
 * One party as a card — who they are, how to reach them, and whether QuickBooks
 * knows them.
 *
 * This replaced a four-column table in both sections below. A voucher names one
 * or two parties per side, and a table charges a header row for a comparison
 * nobody makes: name, company, email and phone are read ACROSS one person, never
 * down a column. The page is five money tables long by the time it reaches here,
 * so these two sections are where the density can break without losing a read.
 */
function PartyCard({
  party,
  billed,
  editable,
  blockedReason,
  onRemove,
}: {
  party: VoucherParty;
  /** Payers only — what this contact is billed across the receivables below. */
  billed?: number;
  editable: boolean;
  /** Non-null when removal is refused. Unread when not editable. */
  blockedReason?: string | null;
  onRemove: () => void;
}) {
  return (
    <Card>
      <Card.Body className="d-flex flex-column gap-3">
        <div className="d-flex align-items-start gap-3">
          <span className="position-relative flex-shrink-0 d-inline-flex">
            <Avatar size="lg">
              <Avatar.Fallback>{initials(party.name)}</Avatar.Fallback>
            </Avatar>
            {/* Hung just OUTSIDE the avatar's lower-right corner. Flush inside
                it (`bottom-0 end-0`) a 16px chip covered a third of the
                initials — the ring is what separates the two, so it needs to
                straddle the edge rather than sit within it. */}
            <span className="position-absolute" style={{ bottom: -3, right: -3 }}>
              <QuickbooksSyncBadge synced={party.quickbooksSynced} />
            </span>
          </span>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold">
              {/* No link when the contact is gone — a dead link to a contact
                  page that 404s is worse than plain text. */}
              <PersonLink
                name={party.name}
                contactId={party.exists ? party.contactId : undefined}
              />
            </div>
            <div className="text-muted fs-small">{party.company || "—"}</div>
          </div>
          {editable && (
            <RemovePartyButton
              name={party.name}
              blockedReason={blockedReason ?? null}
              onRemove={onRemove}
            />
          )}
        </div>

        <div className="d-flex flex-column gap-1">
          <PartyContactLine icon={faEnvelope} value={party.email} />
          <PartyContactLine icon={faPhone} value={party.phone} />
        </div>

        {billed !== undefined && (
          <div className="d-flex align-items-center justify-content-between border-top pt-3">
            <span className="text-muted">Billed</span>
            <span className="fw-semibold">{formatCurrency(billed)}</span>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

/**
 * Who is acquiring — the deal's buyers on a sale, its tenants on a lease.
 *
 * The section title and the list both come from `dealType`, in one place, so a
 * lease voucher can never show a "Buyer" heading over its tenants.
 *
 * Editable on a Draft. These contacts live on the deal rather than in the
 * voucher record, so this and the Deal form's own contact fields write the same
 * arrays — which is why Save routes through `saveVoucherDraft` like everything
 * else here, instead of writing on each add.
 */
function PartySection({
  dealType,
  contactIds,
  editable,
  onChange,
}: {
  dealType: DealType;
  contactIds: string[];
  editable: boolean;
  onChange: (next: string[]) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const title = partySectionTitle(dealType);
  const parties = contactIds.map(voucherParty);

  return (
    <Section
      title={title}
      action={
        editable ? (
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            <FontAwesomeIcon icon={faPlus} />
            Add {title}
          </Button>
        ) : undefined
      }
    >
      {parties.length === 0 ? (
        <p className="text-muted mb-0">
          No {title.toLowerCase()} has been added.
        </p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {parties.map((party) => (
            <PartyCard
              key={party.contactId}
              party={party}
              editable={editable}
              onRemove={() =>
                onChange(contactIds.filter((id) => id !== party.contactId))
              }
            />
          ))}
        </div>
      )}

      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        takenIds={contactIds}
        title={title}
        onAdd={(contactId) => onChange([...contactIds, contactId])}
      />
    </Section>
  );
}

/**
 * Who this voucher bills.
 *
 * A payer is usually the buyer or the tenant and often is not — a lease
 * commission billed to a corporate AP department, a sale where a holding
 * company pays. That is the reason this is its own list rather than a column on
 * the section beside it.
 *
 * Each card carries its own Billed figure and the section closes with their Sum,
 * which is what the table's `tfoot` used to hold. The Sum is the only downward
 * read this section has, so it is the only thing that stayed shared.
 */
function PayersSection({
  payers,
  editable,
  onChange,
}: {
  payers: VoucherPayerRow[];
  editable: boolean;
  onChange: (next: string[]) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const contactIds = payers.map((p) => p.contactId);
  const billedTotal = sum(payers.map((p) => p.billed));

  return (
    <Section
      title="Billing"
      action={
        editable ? (
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            <FontAwesomeIcon icon={faPlus} />
            Add Payer
          </Button>
        ) : undefined
      }
    >
      {payers.length === 0 ? (
        <p className="text-muted mb-0">No payers have been added.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {payers.map((payer) => (
            <PartyCard
              key={payer.contactId}
              party={payer}
              billed={payer.billed}
              editable={editable}
              blockedReason={payerRemovalBlock(payer)}
              onRemove={() =>
                onChange(contactIds.filter((id) => id !== payer.contactId))
              }
            />
          ))}
          {/* Outside the cards, on the section itself — the total belongs to the
              set, not to any one payer in it. Hidden at one payer, where the
              card above it already states the same number. */}
          {payers.length > 1 && (
            <div className="d-flex align-items-center justify-content-between border-top pt-3">
              <span className="fw-semibold">Sum</span>
              <span className="fw-semibold">{formatCurrency(billedTotal)}</span>
            </div>
          )}
        </div>
      )}

      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        takenIds={contactIds}
        title="Payer"
        onAdd={(contactId) => onChange([...contactIds, contactId])}
      />
    </Section>
  );
}

function OutsideCommissionsSection({
  brokers,
  editable,
}: {
  brokers: DealBroker[];
  /** False while the voucher is Pending — nothing joins the split off the approver's desk. */
  editable: boolean;
}) {
  return (
    <Section
      title="Outside Commissions"
      action={
        editable ? (
          <Button variant="ghost" size="sm">
            <FontAwesomeIcon icon={faPlus} />
            Add Outside Commission
          </Button>
        ) : undefined
      }
    >
      {brokers.length === 0 ? (
        <p className="text-muted mb-0">
          No outside commissions have been added.
        </p>
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
                <Table.Cell className="text-end">
                  {b.commissionSplitPct}
                </Table.Cell>
                <Table.Cell className="text-end">
                  {formatCurrency(b.grossCommission)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Section>
  );
}

/** A blank deduction row — no category picked, nothing typed, nothing covered. */
function emptyDeduction(): FinancialDeduction {
  return {
    id: crypto.randomUUID(),
    category: "",
    description: "",
    pct: 0,
    amount: 0,
    covered: null,
  };
}

/**
 * One numeric cell of an editable row — deductions and both broker tables share
 * it: a `$` or `%` addon over a right-aligned number, so the unit is on the
 * field rather than only in the header two rows up. Empty-as-null on Covered $,
 * so an amount that has not been decided stays `null` rather than a typed zero.
 */
function MoneyCell({
  label,
  unit,
  value,
  step,
  nullable,
  onChange,
}: {
  label: string;
  unit: IconDefinition;
  value: number | null;
  step: string;
  /** Covered $ only: an empty box means "none", not zero. */
  nullable?: boolean;
  onChange: (next: number | null) => void;
}) {
  return (
    <InputGroup>
      <InputGroup.Addon>
        <FontAwesomeIcon icon={unit} />
      </InputGroup.Addon>
      <Input
        type="number"
        step={step}
        min={0}
        aria-label={label}
        className="text-end"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(nullable ? null : 0);
            return;
          }
          const n = Number.parseFloat(raw);
          onChange(Number.isNaN(n) ? (nullable ? null : 0) : Math.max(0, n));
        }}
      />
    </InputGroup>
  );
}

/**
 * Pre-Split Deductions — what comes off the gross commission before any broker
 * is paid.
 *
 * Editable in place while the voucher is a Draft: every cell is a live control
 * rather than a click-to-edit span, because a row is typically filled left to
 * right in one pass and a dropdown that has to be woken up first costs a click
 * per cell. That is also why the row's only action is Delete — an Edit button
 * would open what is already open.
 *
 * Edits are held in the caller's working copy and committed by the voucher's
 * Save, so the breakdown and its donut — which read the store — move when the
 * broker says the figures are ready, not on every keystroke.
 *
 * Not `EditableTable` from the record-form shell: that one has no dropdown
 * column, no per-column alignment, and a footer that spans the whole width,
 * where this table needs Sum to land under Amount and Covered.
 */
function PreSplitDeductionsSection({
  deductions,
  editable,
  onChange,
}: {
  deductions: FinancialDeduction[];
  /** Draft only — a submitted voucher's deductions are what an approver is reading. */
  editable: boolean;
  onChange: (next: FinancialDeduction[]) => void;
}) {
  const amountTotal = sum(deductions.map((d) => d.amount));
  const coveredTotal = sum(deductions.map((d) => d.covered ?? 0));

  const patch = (id: string, fields: Partial<FinancialDeduction>) =>
    onChange(deductions.map((d) => (d.id === id ? { ...d, ...fields } : d)));

  return (
    <Section
      title="Pre-Split Deductions"
      action={
        editable ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange([...deductions, emptyDeduction()])}
          >
            <FontAwesomeIcon icon={faPlus} />
            Add Pre-Split Deduction
          </Button>
        ) : undefined
      }
    >
      {deductions.length === 0 ? (
        <p className="text-muted mb-0">
          No pre-split deductions have been added.
        </p>
      ) : (
        <Table dense className="align-middle">
          <Table.Header>
            {/* The three number columns are pinned narrow so Description — the
                only free-text field, and the one that runs long — takes what is
                left. Category is pinned too, or "Broker of Record" wraps. */}
            <Table.Row>
              <Table.Head style={{ width: 190 }}>Category</Table.Head>
              <Table.Head>Description</Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Percent %
              </Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Amount $
              </Table.Head>
              <Table.Head className="text-end" style={{ width: 132 }}>
                Covered $
              </Table.Head>
              {editable && <Table.Head style={{ width: 56 }} />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {deductions.map((d) =>
              editable ? (
                <Table.Row key={d.id}>
                  <Table.Cell>
                    <Select
                      value={d.category}
                      onValueChange={(v) =>
                        patch(d.id, { category: (v as string) ?? "" })
                      }
                    >
                      <Select.Trigger aria-label="Category">
                        <Select.Value placeholder="Select..." />
                      </Select.Trigger>
                      <Select.Content>
                        {DEDUCTION_CATEGORIES.map((c) => (
                          <Select.Item key={c} value={c}>
                            {c}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      aria-label="Description"
                      value={d.description}
                      onChange={(e) =>
                        patch(d.id, { description: e.target.value })
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <MoneyCell
                      label="Percent %"
                      unit={faPercent}
                      value={d.pct}
                      step="0.1"
                      onChange={(pct) => patch(d.id, { pct: pct ?? 0 })}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <MoneyCell
                      label="Amount $"
                      unit={faDollarSign}
                      value={d.amount}
                      step="0.01"
                      onChange={(amount) =>
                        patch(d.id, { amount: amount ?? 0 })
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <MoneyCell
                      label="Covered $"
                      unit={faDollarSign}
                      value={d.covered}
                      step="0.01"
                      nullable
                      onChange={(covered) => patch(d.id, { covered })}
                    />
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    <Tooltip>
                      <Tooltip.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete deduction"
                            onClick={() =>
                              onChange(deductions.filter((r) => r.id !== d.id))
                            }
                          >
                            <FontAwesomeIcon icon={faTrashCan} />
                          </Button>
                        }
                      />
                      <Tooltip.Content>Delete deduction</Tooltip.Content>
                    </Tooltip>
                  </Table.Cell>
                </Table.Row>
              ) : (
                <Table.Row key={d.id}>
                  <Table.Cell>{d.category}</Table.Cell>
                  <Table.Cell>{d.description}</Table.Cell>
                  <Table.Cell className="text-end">{d.pct}</Table.Cell>
                  <Table.Cell className="text-end">
                    {formatCurrency(d.amount)}
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    {d.covered !== null ? formatCurrency(d.covered) : "None"}
                  </Table.Cell>
                </Table.Row>
              ),
            )}
          </Table.Body>
          {/* Sum is a `tfoot`, not a last body row: the theme gives `tfoot`
              cells the header's background, weight, and a rule above them, so
              the total reads as the table's own summary rather than another
              deduction — and the hand-applied `fw-semibold` goes away. */}
          <Table.Footer>
            <Table.Row>
              <Table.Cell colSpan={3}>Sum</Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(amountTotal)}
              </Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(coveredTotal)}
              </Table.Cell>
              {editable && <Table.Cell />}
            </Table.Row>
          </Table.Footer>
        </Table>
      )}
    </Section>
  );
}

/** Width of the receivables checkbox gutter. */
const RECEIVABLE_CHECKBOX_W = 44;

/**
 * Column widths for the Receivables table.
 *
 * Everything is pinned except Billing Description, which takes `width: 100%`
 * and therefore absorbs whatever is left. That is the point: a description is
 * the only free-text column here and the only one whose content has no natural
 * length, while a date, a dollar amount and a name all do. Letting the browser
 * share width evenly gave the amounts room they never use and squeezed the one
 * column that needed it.
 *
 * The payer is pinned rather than sized to content so the table's columns do
 * not jump when a row switches between a person's name and their company — the
 * cell truncates instead (see `text-truncate` at the call site).
 */
const RECEIVABLE_COL = {
  // The unheaded QuickBooks gutter. Wide enough for an 18px chip and the cell's
  // own padding, and no wider — it is a status, not a column anyone reads down.
  sync: 40,
  payer: 220,
  dueDate: 150,
  // The money columns are sized to their content, and their content is the
  // widest figure a commission realistically reaches — "$1,167,802.00" is a real
  // seeded value. Amount needs a little more than Credited despite showing the
  // same magnitude: it is an input with a currency addon, not plain text.
  amount: 150,
  credited: 130,
  actions: 44,
} as const;

/**
 * One item in the Receivables Actions menu, greyed when its precondition fails.
 *
 * The `disabled` prop alone would not grey it: base-ui renders a menu item as a
 * `div`, so Bootstrap's `.dropdown-item:disabled` rule never matches and the
 * item stays black while silently refusing to open. The class is what greys it,
 * the prop is what blocks the click and tells a screen reader — pairing them
 * here is what stops the two drifting apart across three call sites.
 */
function ReceivableActionItem({
  icon,
  disabled,
  onClick,
  children,
}: {
  icon: IconDefinition;
  disabled?: boolean;
  /** Omitted by the items that are still unbuilt — Apply Deposit, Apply Other Credit. */
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      className={disabled ? "disabled" : undefined}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="me-2" />
      {children}
    </DropdownMenu.Item>
  );
}

/**
 * A receivable's billing description, edited in the cell.
 *
 * Keystrokes stay local and commit on blur, so typing a sentence is one write
 * to the store rather than one per character — the same reason the rent
 * schedule's cells commit on blur. Re-seeds when the stored value moves under
 * it, which is what keeps a row honest if the same voucher is edited elsewhere.
 */
function ReceivableTextCell({
  value,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  placeholder: string;
  className?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `value` alone by design
  useEffect(() => setDraft(value), [value]);
  return (
    <Input
      className={`bg-card${className ? ` ${className}` : ""}`}
      value={draft}
      placeholder={placeholder}
      aria-label="Billing description"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
    />
  );
}

/**
 * One receivable's own actions.
 *
 * All three credit actions are stubs and all three read as stubs — greyed, with
 * the same `ReceivableActionItem` treatment the toolbar menu uses, because a
 * menu item that looks live and does nothing is worse than one that says it
 * cannot yet. Deliberately greyed unconditionally, unlike the toolbar's Apply
 * Deposit: that one greys on a fully credited line, which reads as a live
 * control the rest of the time and would promise something this cannot do.
 *
 * Delete is the only live item, and the only place a single receivable can be
 * removed — the toolbar's Actions menu deliberately dropped its bulk Delete
 * rather than offer the same act twice.
 */
function ReceivableRowMenu({
  label,
  onCreateInvoice,
  onDelete,
}: {
  label: string;
  onCreateInvoice: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${label}`}
          >
            <FontAwesomeIcon icon={faEllipsisVertical} />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        <ReceivableActionItem icon={faFileLines} onClick={onCreateInvoice}>
          Create New Invoice
        </ReceivableActionItem>
        <ReceivableActionItem icon={faArrowRight} disabled>
          Apply Deposit
        </ReceivableActionItem>
        <ReceivableActionItem icon={faArrowRight} disabled>
          Apply Other Credit
        </ReceivableActionItem>
        <Separator className="my-1" />
        <DropdownMenu.Item onClick={onDelete}>
          <FontAwesomeIcon icon={faTrashCan} className="me-2" />
          Delete Receivable
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function ReceivablesSection({
  listing,
  editable,
}: {
  listing: Listing;
  /** False while the voucher is Pending — no adds, and nothing to select rows for. */
  editable: boolean;
}) {
  const receivables = listing.transaction.backOffice.receivables;
  const amountTotal = sum(receivables.map((r) => r.amount));
  const creditedTotal = sum(receivables.map((r) => r.credited));
  const [addOpen, setAddOpen] = useState(false);

  // Receivable edits write straight through rather than joining the page's Save
  // working copy — see `addReceivable` in actions.ts for why the guard differs.
  // Every cell below commits on blur, so a keystroke is not a write.
  const patch = (id: string, next: Partial<FinancialReceivable>) =>
    updateReceivable(listing.id, id, next);



  // Which rows the bulk actions apply to. Local state — nothing here persists,
  // and every read below goes through `selectedRows` rather than the set itself,
  // so an id left behind by a previous deal is ignored rather than miscounted.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRows = receivables.filter((r) => selectedIds.has(r.id));
  const allSelected =
    receivables.length > 0 && selectedRows.length === receivables.length;
  const someSelected = selectedRows.length > 0;

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(receivables.map((r) => r.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // A deposit lands against money still outstanding, so a fully credited
  // receivable has nothing left to apply one to.
  const canApplyDeposit =
    someSelected && selectedRows.every((r) => r.credited < r.amount);
  // One invoice bills one payer. Compared by contact id, not by name: two
  // different contacts who happen to share a name are two payers.
  const canCreateInvoice =
    someSelected && new Set(selectedRows.map((r) => r.payerContactId)).size === 1;

  /**
   * Bill the given receivables on one invoice, filed against the deal.
   *
   * The broker stays on the voucher. The invoice lands on the Invoices page and
   * the toast names the file, which is enough to know it worked — navigating
   * away mid-task would abandon whatever else they were doing to this voucher.
   *
   * The selection clears on success, so the same rows cannot be billed twice by
   * a second click on a menu that is still open. `createInvoiceFromReceivables`
   * re-checks the one-payer rule and returns nulls rather than throwing, so a
   * refusal is silent here by design — the button was already disabled for it.
   */
  const createInvoice = (receivableIds: string[]) => {
    const { name } = createInvoiceFromReceivables(listing.id, receivableIds);
    if (!name) return;
    setSelectedIds(new Set());
    notify({
      title: "Invoice created",
      description: `${name} is on this deal's Invoices page.`,
    });
  };

  return (
    <Section
      title="Receivables"
      action={
        editable ? (
          <div className="d-flex gap-2">
            <Button variant="ghost" size="sm">
              <FontAwesomeIcon icon={faPlus} />
              Set Sales Tax
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
              <FontAwesomeIcon icon={faPlus} />
              Add Receivable
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button variant="ghost" size="sm" disabled={!someSelected}>
                    Actions
                    <FontAwesomeIcon icon={faCaretDown} />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end">
                <ReceivableActionItem
                  icon={faArrowRight}
                  disabled={!canApplyDeposit}
                >
                  Apply Deposit
                </ReceivableActionItem>
                <ReceivableActionItem
                  icon={faFileLines}
                  disabled={!canCreateInvoice}
                  onClick={() => createInvoice(selectedRows.map((r) => r.id))}
                >
                  Create New Invoice
                </ReceivableActionItem>
                {/* No Delete here. Deleting is a one-row act and the row's own
                    menu owns it; a bulk Delete beside it would be a second way
                    to do the same thing, differing only in how many rows it
                    takes. What stays is what genuinely reads a selection —
                    applying one deposit across several lines, or billing
                    several lines on one invoice. */}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        ) : undefined
      }
    >
      {receivables.length === 0 ? (
        <p className="text-muted mb-0">No receivables have been added.</p>
      ) : (
        /* `receivables-table` pins `table-layout: fixed`, which is what makes
           the widths below mean anything — see DealFinancials.scss. A class
           rather than a style prop because Blueprint's `Table` does not forward
           `style` to the rendered `<table>`. */
        <Table className="receivables-table">
          <Table.Header>
            <Table.Row>
              {/* The gutter exists to arm the Actions menu. With the menu gone
                  there is nothing a selection could do, so the column goes with
                  it rather than leaving checkboxes that tick and mean nothing. */}
              {editable && (
                <Table.Head
                  style={{
                    width: RECEIVABLE_CHECKBOX_W,
                    minWidth: RECEIVABLE_CHECKBOX_W,
                  }}
                >
                  <Checkbox
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onCheckedChange={(c) => toggleAll(c === true)}
                    aria-label="Select all receivables"
                  />
                </Table.Head>
              )}
              {/* No heading, by design. The badge is a row status and the
                  tooltip names it; a "QuickBooks" header over a column that is
                  blank three times in four would read as missing data. It sits
                  at the head of the row rather than the tail, where the actions
                  column would have made it look like a control. */}
              <Table.Head
                style={{ width: RECEIVABLE_COL.sync }}
                aria-label="QuickBooks sync status"
              />
              <Table.Head style={{ width: RECEIVABLE_COL.payer }}>
                Payer Name
              </Table.Head>
              <Table.Head style={{ width: RECEIVABLE_COL.dueDate }}>
                Due Date
              </Table.Head>
              {/* The only column that grows. */}
              <Table.Head style={{ width: "100%" }}>
                Billing Description
              </Table.Head>
              <Table.Head
                className="text-end"
                style={{ width: RECEIVABLE_COL.amount }}
              >
                Receivable Amount
              </Table.Head>
              <Table.Head
                className="text-end"
                style={{ width: RECEIVABLE_COL.credited }}
              >
                Credited Amount
              </Table.Head>
              {editable && (
                <Table.Head style={{ width: RECEIVABLE_COL.actions }} />
              )}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {receivables.map((r) => {
              const label = receivablePayerLabel(r.payerContactId, r.billToCompany);
              return (
                <Table.Row
                  key={r.id}
                  className={
                    editable && selectedIds.has(r.id) ? "table-active" : undefined
                  }
                >
                  {editable && (
                    <Table.Cell
                      style={{
                        width: RECEIVABLE_CHECKBOX_W,
                        minWidth: RECEIVABLE_CHECKBOX_W,
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.has(r.id)}
                        onCheckedChange={(c) => toggleOne(r.id, c === true)}
                        aria-label={`Select receivable for ${label}`}
                      />
                    </Table.Cell>
                  )}
                  <Table.Cell style={{ width: RECEIVABLE_COL.sync }}>
                    <QuickbooksSyncBadge synced={r.quickbooksSynced} size={18} />
                  </Table.Cell>
                  <Table.Cell style={{ width: RECEIVABLE_COL.payer }}>
                    {editable ? (
                      /* Two options, both naming this row's own payer: the
                         person, or the company they belong to. Deliberately NOT
                         the contact book — who a receivable bills is settled
                         when it is created, and re-offering every contact here
                         would let "how is this addressed" quietly become "who
                         is this billed to". */
                      <Select
                        value={r.billToCompany ? "company" : "person"}
                        onValueChange={(v) =>
                          patch(r.id, { billToCompany: v === "company" })
                        }
                      >
                        <Select.Trigger
                          className="bg-card"
                          aria-label="Payer"
                          title={label}
                          // `min-width: 0` is what lets the label inside shrink:
                          // a flex item refuses to go below its content width
                          // without it, so the trigger would push the column
                          // wider instead of the text truncating.
                          style={{ minWidth: 0 }}
                        >
                          {/* The label is passed as children, not left to
                              `Select.Value` to derive. Blueprint's Select.Value
                              renders the raw VALUE when given none — here that
                              is the literal string "person" — and this is the
                              third time in this file that has been discovered in
                              a browser rather than by the type checker. If you
                              add a Select whose value is not also its label,
                              pass the label. */}
                          <Select.Value>
                            <span className="d-block text-truncate">
                              {label}
                            </span>
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Content>
                          {payerFormOptions(r.payerContactId).map((o) => (
                            <Select.Item key={o.value} value={o.value}>
                              {o.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    ) : (
                      <span className="d-block text-truncate" title={label}>
                        {label}
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ width: RECEIVABLE_COL.dueDate }}>
                    {editable ? (
                      /* The same `DueDatePicker` the New Receivable modal uses,
                         so one page does not offer two different date controls
                         for the same field. A native `<input type="date">` was
                         here first and rendered its own `mm/dd/yyyy` chrome,
                         which belongs to the browser rather than to Blueprint. */
                      <DueDatePicker
                        className="bg-card"
                        value={r.dueDate}
                        onChange={(next) => patch(r.id, { dueDate: next })}
                      />
                    ) : (
                      formatDate(r.dueDate)
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {editable ? (
                      <ReceivableTextCell
                        value={r.billingDescription}
                        placeholder="Billing description"
                        className="w-100"
                        onCommit={(next) =>
                          patch(r.id, { billingDescription: next })
                        }
                      />
                    ) : (
                      r.billingDescription
                    )}
                  </Table.Cell>
                  <Table.Cell
                    className="text-end"
                    style={{ width: RECEIVABLE_COL.amount }}
                  >
                    {editable ? (
                      <MoneyCell
                        label="Receivable amount"
                        unit={faDollarSign}
                        value={r.amount}
                        step="0.01"
                        onChange={(v) => patch(r.id, { amount: v ?? 0 })}
                      />
                    ) : (
                      formatCurrency(r.amount)
                    )}
                  </Table.Cell>
                  {/* Credited stays read-only at every status: it is what has
                      been paid against this line, which is the deposit and
                      credit actions' business, not something to type over. */}
                  <Table.Cell
                    className="text-end"
                    style={{ width: RECEIVABLE_COL.credited }}
                  >
                    {r.credited > 0 ? formatCurrency(r.credited) : "None"}
                  </Table.Cell>
                  {editable && (
                    <Table.Cell style={{ width: RECEIVABLE_COL.actions }}>
                      <ReceivableRowMenu
                        label={label}
                        onCreateInvoice={() => createInvoice([r.id])}
                        onDelete={() => deleteReceivable(listing.id, r.id)}
                      />
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            })}
          </Table.Body>
          {/* A `tfoot`, for the same reason the other three money tables use one
              — see the note on Pre-Split Deductions. The leading colSpan counts
              the select-all gutter, so it moves with `editable` the way the body
              rows above it do. */}
          <Table.Footer>
            <Table.Row>
              {/* Counts the select-all gutter and the QuickBooks gutter, so it
                  moves with `editable` the way the body rows do. */}
              <Table.Cell colSpan={editable ? 5 : 4}>Sum</Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(amountTotal)}
              </Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(creditedTotal)}
              </Table.Cell>
              {editable && <Table.Cell />}
            </Table.Row>
          </Table.Footer>
        </Table>
      )}

      <NewReceivableModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(input) => addReceivable(listing.id, input)}
      />
    </Section>
  );
}

/** Switch + label — the toggles above the rent schedule. */
function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  // Switch first, label beside it — the same shape as `SwitchRow` everywhere
  // else. The trailing "ON"/"OFF" text is redundant: the switch's own position
  // already says which it is, and the word only competed with the label.
  return (
    <div className="d-flex align-items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      <span>{label}</span>
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
  editable = true,
}: {
  type: CellType;
  value: number | string;
  onCommit: (next: number | string) => void;
  align?: "end";
  /** False on a frozen voucher — the same formatted value, without the affordance. */
  editable?: boolean;
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
    if (!Number.isNaN(n))
      onCommit(type === "int" ? Math.max(1, Math.round(n)) : Math.max(0, n));
  }

  const display =
    type === "date"
      ? formatScheduleDate(String(value))
      : type === "currency"
        ? formatCurrency(Number(value))
        : String(value);

  // Read-only cells route through here rather than being formatted at the call
  // site, so a frozen schedule shows exactly the string an editable one does.
  if (!editable) return <>{display}</>;

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
      style={{
        cursor: "pointer",
        borderBottom: "1px dashed var(--bs-border-color)",
      }}
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
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={a.label}
                onClick={a.onClick}
              >
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
function RentScheduleSection({
  listing,
  editable,
}: {
  listing: Listing;
  /** False while the voucher is Pending — the schedule is what an approver is reading. */
  editable: boolean;
}) {
  const initial = buildRentSchedule(listing);
  const [rows, setRows] = useState<RentScheduleRow[]>(initial?.rows ?? []);
  const [autoCalcRents, setAutoCalcRents] = useState(true);
  const [operatingExpenses, setOperatingExpenses] = useState(false);

  // Hooks run unconditionally above; non-lease deals render nothing.
  if (!initial) return null;
  const schedule = initial; // non-null const so closures below keep the narrowing

  const total = computeTotal(rows);

  function editField(
    index: number,
    field: EditableField,
    next: number | string,
  ) {
    setRows((prev) =>
      reflowDates(
        prev.map((r, i) => (i === index ? { ...r, [field]: next } : r)),
      ),
    );
  }

  /** Insert a 12-month term at `index`, inheriting the reference term's rate & commission. */
  function insertTerm(index: number) {
    setRows((prev) => {
      const ref = prev[Math.min(index, prev.length - 1)] ?? schedule.rows[0];
      const row = makeRow(
        ref.startDate,
        12,
        ref.monthlyRate,
        ref.commissionPct,
      );
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
      return reflowDates([
        ...prev,
        makeRow(prev[0].startDate, 12, monthlyRate, last.commissionPct),
      ]);
    });
  }

  return (
    <Section
      title="Rent Schedule"
      action={
        editable ? (
          <Button variant="ghost" size="sm" onClick={addTerm}>
            <FontAwesomeIcon icon={faPlus} />
            Add Term
          </Button>
        ) : undefined
      }
    >
      {/* Both toggles only shape an edit — auto-calculate escalates the rate of
          the next term added, operating expenses is a display switch over rows
          nobody can change — so a frozen schedule drops the row entirely rather
          than leaving two live switches over a table that cannot move. */}
      {editable && (
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
      )}

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
            {editable && <Table.Head />}
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
                    editable={editable}
                  />
                ) : (
                  formatScheduleDate(r.startDate)
                )}
              </Table.Cell>
              <Table.Cell>{formatScheduleDate(r.endDate)}</Table.Cell>
              <Table.Cell>
                <EditableCell
                  type="int"
                  value={r.months}
                  onCommit={(next) => editField(i, "months", next)}
                  editable={editable}
                />
              </Table.Cell>
              <Table.Cell className="text-end">
                <EditableCell
                  type="currency"
                  align="end"
                  value={r.monthlyRate}
                  onCommit={(next) => editField(i, "monthlyRate", next)}
                  editable={editable}
                />
              </Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(r.totalRent)}
              </Table.Cell>
              <Table.Cell className="text-end">
                <EditableCell
                  type="percent"
                  align="end"
                  value={r.commissionPct}
                  onCommit={(next) => editField(i, "commissionPct", next)}
                  editable={editable}
                />
              </Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(r.commissionAmount)}
              </Table.Cell>
              {editable && (
                <Table.Cell className="text-end">
                  <RowActions
                    onAddAbove={() => insertTerm(i)}
                    onAddBelow={() => insertTerm(i + 1)}
                    onRemove={() => removeTerm(i)}
                  />
                </Table.Cell>
              )}
            </Table.Row>
          ))}
          {total && (
            <Table.Row>
              <Table.Cell className="fw-semibold">
                {formatScheduleDate(total.startDate)}
              </Table.Cell>
              <Table.Cell className="fw-semibold">
                {formatScheduleDate(total.endDate)}
              </Table.Cell>
              <Table.Cell className="fw-semibold">{total.months}</Table.Cell>
              <Table.Cell />
              <Table.Cell className="text-end fw-semibold">
                {formatCurrency(total.totalRent)}
              </Table.Cell>
              <Table.Cell className="text-end fw-semibold">
                {total.commissionPct}%
              </Table.Cell>
              <Table.Cell className="text-end fw-semibold">
                {formatCurrency(total.commissionAmount)}
              </Table.Cell>
              {editable && <Table.Cell />}
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
function TransactionSummarySection({
  listing,
  editable,
}: {
  listing: Listing;
  /** Draft only: once submitted, the terms are what an approver reads or signed off on. */
  editable: boolean;
}) {
  const { transaction } = listing;
  const isLease = listing.dealType === "Lease";
  const leaseTerms = listing.marketing.spaceLeaseTerms ?? [];
  const terms =
    leaseTerms.find((t) => t.unitId === listing.unitId) ?? leaseTerms[0];

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
          terms?.leaseTermMonths != null
            ? `Lease Term ${terms.leaseTermMonths} mo`
            : null,
          `Available ${listing.marketing.availableSqFt.toLocaleString()} SF`,
        ]
      : [
          `Deal ID ${listing.dealId}`,
          `Price / SF $${listing.financials.pricePerSqFt.toLocaleString(
            undefined,
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )}`,
        ]
  ).filter(Boolean);

  return (
    <Section
      title="Transaction"
      action={
        // The deal editor's Transaction Terms group already carries every field
        // this section shows, so the voucher links to it rather than keeping a
        // second, narrower copy of the same form in a modal. A submitted voucher
        // drops the link: the figures are the thing being approved, so both the
        // voucher page and this Deal form close. The stage gate remains a
        // separate, unguarded path to the same fields — see the `voucherLocked`
        // comment in DealEditor.tsx.
        editable ? (
          <Tooltip>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit transaction"
                  nativeButton={false}
                  render={<Link {...dealEditTarget(listing)} />}
                >
                  <FontAwesomeIcon icon={faPencil} />
                </Button>
              }
            />
            <Tooltip.Content>Edit Deal</Tooltip.Content>
          </Tooltip>
        ) : undefined
      }
    >
      <div className="row g-3">
        <div className="col-md-3">
          <StatTile label={headlineLabel} value={headlineValue} />
        </div>
        <div className="col-md-3">
          <StatTile
            label="Commission %"
            value={`${transaction.commissionPct}%`}
          />
        </div>
        <div className="col-md-3">
          <StatTile
            label="Commission $"
            value={formatCurrency(transaction.commissionAmount)}
          />
        </div>
        <div className="col-md-3">
          <StatTile
            label="Close Probability"
            value={`${transaction.closeProbability}%`}
          />
        </div>
      </div>
      <p className="text-muted fs-small mb-0">{secondary.join(" · ")}</p>
    </Section>
  );
}

/**
 * One label for both Submit buttons. They are the same verb in two places, so
 * the string lives once — two spellings of one action read as two actions.
 */
const SUBMIT_LABEL = "Submit for Approval";

/**
 * One wording for the attestation, in both places it appears. Short enough to
 * share the header's line with a title and a button — two phrasings of one
 * attestation would read as two different things being confirmed.
 */
const ATTESTATION_LABEL = "I confirm the information is accurate";

/**
 * The attestation and the Submit it gates, as one cluster — rendered in the page
 * header and again at the foot of the page, from this one component so the two
 * cannot drift apart in wording, treatment or behaviour.
 *
 * Both instances write the same page state, so ticking either box enables both
 * buttons and the broker never has to go find the other one.
 *
 * The card and the button are matched by `align-items-stretch` rather than a
 * height: the card carries horizontal padding only, so its content can never
 * out-grow the button, the button is always the thing setting the height, and
 * nothing drifts the first time the theme changes its control sizing. A pinned
 * px height to match a Blueprint button would.
 */
function AttestationSubmit({
  attested,
  onChange,
  onSubmit,
  dirty,
  onSave,
}: {
  attested: boolean;
  onChange: (checked: boolean) => void;
  onSubmit: () => void;
  /** There are unsaved voucher edits the store has not seen yet. */
  dirty: boolean;
  onSave: () => void;
}) {
  return (
    <div className="d-flex align-items-stretch gap-2">
      <Field
        orientation="horizontal"
        className="align-items-center gap-2 mb-0 px-3 border rounded"
      >
        <Checkbox
          checked={attested}
          onCheckedChange={(next) => onChange(next === true)}
        />
        {/* `fw-normal`: Field.Label is 600, which is right for a two-word field
            name and heavy for a sentence of body copy the broker is meant to
            read. */}
        <Field.Label className="mb-0 fw-normal">
          {ATTESTATION_LABEL}
        </Field.Label>
      </Field>
      {/* Save is beside Submit, not out over the table it commits: the page has
          two of these clusters and a broker who scrolled to the bottom one
          should not have to go back up to keep the work. Dead until there is
          something to keep, so it never reads as a second Submit. */}
      <Button variant="secondary" disabled={!dirty} onClick={onSave}>
        Save
      </Button>
      <SubmitVoucherButton
        attested={attested}
        unsaved={dirty}
        onSubmit={onSubmit}
      />
    </div>
  );
}

/**
 * The voucher's Submit. Always reached through {@link AttestationSubmit}, which
 * is what keeps a Submit button from ever appearing without its attestation.
 *
 * Disabled until the broker has ticked an attestation — there is one beside
 * this button in the header and one in the page footer, and either will do —
 * and disabled again while there are unsaved voucher edits the store has not
 * seen. The tooltip carries whichever reason applies, because a dead primary
 * button with no explanation is the worst version of this. It hangs off a
 * wrapper `span` since a disabled button fires no pointer events, which would
 * otherwise make the one explanation of why it is dead unreachable.
 */
function SubmitVoucherButton({
  attested,
  unsaved,
  onSubmit,
}: {
  attested: boolean;
  /** Unsaved voucher edits — submitting would send the stored figures, not these. */
  unsaved: boolean;
  onSubmit: () => void;
}) {
  // Unsaved edits outrank a missing tick: what an approver would receive is the
  // stored voucher, so the fix is Save, and saying "confirm you checked it"
  // while the numbers on screen are not the numbers being sent would be a lie.
  const blockedReason = unsaved
    ? "Save your changes before submitting."
    : attested
      ? null
      : "Confirm you have checked this voucher first.";

  if (!blockedReason) {
    return (
      <Button variant="primary" onClick={onSubmit}>
        {SUBMIT_LABEL}
      </Button>
    );
  }

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <span className="d-inline-flex">
            <Button variant="primary" disabled>
              {SUBMIT_LABEL}
            </Button>
          </span>
        }
      />
      <Tooltip.Content>{blockedReason}</Tooltip.Content>
    </Tooltip>
  );
}

/** Financials tab: gross commission, its breakdown, commissions, and receivables/payables. */
export function DealFinancials({
  listing,
  heading = "Voucher",
}: {
  listing: Listing;
  /** Overridden on a shell's per-space voucher, so the suite is named. */
  heading?: string;
}) {
  const voucher = listing.transaction.backOffice;
  const isDraft = voucher.status === "Draft";
  // A Pending voucher is on an approver's desk, so the page freezes whole: no
  // edits, no adds, no row actions anywhere below, and no way back. Submitting
  // is one-way for the broker — sending it is the decision, and what an approver
  // is holding cannot be changed underneath them. Only an approver moves it now.
  //
  // Approved is deliberately *not* frozen the same way here. What it will
  // eventually accept is additions (receivables, invoices, credits against what
  // was approved) rather than a blanket lock, which needs the data reworked
  // first. Until that pass lands it keeps the controls it has today.
  const isPending = voucher.status === "Pending";
  // The broker's attestation, which gates both Submit buttons. Page state, not
  // stored: it is a confirmation of *this* reading of the voucher, so it should
  // not survive a reload and come back pre-ticked.
  const [attested, setAttested] = useState(false);

  // The deduction table's working copy. Held here rather than in the section
  // because Save sits up in the header cluster beside Submit, and the two have
  // to agree about whether there is anything to save.
  //
  // `deductions !== stored` is the dirty test: every write in this app spreads
  // a new array, so an edit, an add, or a delete all break identity, and Save
  // writing them through restores it. A hand-reverted edit still reads dirty —
  // saving it is a no-op, which is the cheap side of that trade.
  const stored = voucher.preSplitDeductions;
  const storedBrokers = listing.internalBrokers;
  const [deductions, setDeductions] = useState(stored);
  const [brokers, setBrokers] = useState(storedBrokers);

  // The party list's working copy, on the same terms as the deduction and
  // broker tables above: edited locally, committed by the one Save. `stored…`
  // is the dirty test — every write here spreads a new array, so an add or a
  // remove breaks identity and Save writing it through restores it.
  const storedParties = partyContactIds(listing);
  const [parties, setParties] = useState(storedParties);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `storedParties` alone by design
  useEffect(() => setParties(storedParties), [storedParties]);

  const storedPayers = voucher.payerContactIds;
  const [payerIds, setPayerIds] = useState(storedPayers);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `storedPayers` alone by design
  useEffect(() => setPayerIds(storedPayers), [storedPayers]);

  const dirty =
    deductions !== stored ||
    brokers !== storedBrokers ||
    parties !== storedParties ||
    payerIds !== storedPayers;

  // Re-seed when the store's array moves under us — a Save of our own, or a
  // write from elsewhere (the AI rail, another tab of the same deal). This
  // *does* drop unsaved edits when something else writes the same array, which
  // is the honest outcome: the two copies disagree and the store is the one
  // that is real.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `stored` alone by design
  useEffect(() => setDeductions(stored), [stored]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `storedBrokers` alone by design
  useEffect(() => setBrokers(storedBrokers), [storedBrokers]);

  // Both Submit buttons commit through the same action, so the two can never
  // disagree about what submitting means. `submitVoucher` re-checks Draft itself;
  // the attestation is re-checked here for the same reason — a guard at the one
  // write path holds even if a button forgets to disable itself.
  const submit = () => {
    if (!attested) return;
    submitVoucher(listing.id);
    setAttested(false);
    notify({
      // Says the irreversible part out loud. Submitting is the last thing a
      // broker can do to a voucher, and a toast reading only "with an approver"
      // leaves that as something to discover by looking for the Edit button.
      title: "Voucher submitted",
      description: "It is now with an approver and can no longer be edited.",
    });
  };

  // Commit the unsaved voucher edits. `saveVoucherDraft` re-checks Draft, so a
  // voucher that moved on while this page was open cannot be written to.
  const save = () => {
    if (!dirty) return;
    saveVoucherDraft(listing.id, {
      preSplitDeductions: deductions,
      internalBrokers: brokers,
      partyContactIds: parties,
      payerContactIds: payerIds,
    });
    notify({
      title: "Voucher saved",
      description: "Parties, deductions and commissions updated.",
    });
  };

  return (
    <div className="d-flex flex-column gap-5 p-4">
      <ListingPageHeader
        title={heading}
        /* Where this voucher stands, under the title it describes rather than
           against the button that moves it. Every deal carries a voucher from
           the moment it is created, so there is always a status here — a new
           deal's reads Draft. */
        meta={<VoucherStatusBadge status={voucher.status} long />}
        actions={
          /* Draft is the only state with an action. Submitting hands the voucher
             over, and a broker cannot take it back: an approver reading a set of
             figures must be reading the same ones the broker attested to, which
             an Edit that un-submits cannot promise. So Pending offers nothing,
             and neither does Approved — there the banner below states who signed
             it off, and what stays open on a settled voucher is additions to it,
             receivables and invoices, not an edit of the approved figures. */
          isDraft ? (
            <AttestationSubmit
              attested={attested}
              onChange={setAttested}
              onSubmit={submit}
              dirty={dirty}
              onSave={save}
            />
          ) : undefined
        }
      />

      <VoucherApprovalBanner voucher={voucher} />

      <TransactionSummarySection listing={listing} editable={isDraft} />

      <Separator />

      <BreakdownSection listing={listing} />

      <Separator />

      <OutsideCommissionsSection
        brokers={listing.outsideBrokers}
        editable={!isPending}
      />
      <PreSplitDeductionsSection
        deductions={deductions}
        editable={isDraft}
        onChange={setDeductions}
      />
      <InternalCommissionsSection
        brokers={brokers}
        editable={isDraft}
        onChange={setBrokers}
      />

      <Separator />

      {/* The two party lists, side by side, after the commissions band.
          Two columns rather than two stacked sections because each is a short
          list of cards — at full width a single card left most of the row empty,
          and the pair reads as one answer to "who is on this deal" anyway.
          They collapse to one column below `lg`, where half a row is too narrow
          for a name, a company and an email.

          Billing used to sit directly above Receivables, since that table names
          these payers. Only the rent schedule separates them now. */}
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <PartySection
            dealType={listing.dealType}
            contactIds={parties}
            editable={isDraft}
            onChange={setParties}
          />
        </div>
        <div className="col-12 col-lg-6">
          <PayersSection
            payers={voucherPayers({ ...voucher, payerContactIds: payerIds })}
            editable={isDraft}
            onChange={setPayerIds}
          />
        </div>
      </div>

      <Separator />

      <RentScheduleSection listing={listing} editable={!isPending} />

      <ReceivablesSection listing={listing} editable={!isPending} />

      <Section title="Payables">
        <p className="text-muted mb-0">
          Payables will be automatically created when deposits are applied to
          this deal.
        </p>
      </Section>

      {/* The header's cluster again, at the end of the page. This is a long
          scroll — commission breakdown, splits, rent schedule, receivables — and
          a broker who has just read the last of it should not have to scroll
          back up to send it; the confirmation belongs here for the same reason,
          at the end of the thing being confirmed rather than above it. Draft
          only, like the header's: there is nothing to submit once it is with an
          approver.

          Right-aligned so the pair sits where the header's does. Splitting them
          to opposite ends of the bar read as two unrelated controls, when the
          checkbox is the thing that arms the button beside it. */}
      {isDraft && (
        <div className="d-flex justify-content-end border-top pt-4">
          <AttestationSubmit
            attested={attested}
            onChange={setAttested}
            onSubmit={submit}
            dirty={dirty}
            onSave={save}
          />
        </div>
      )}
    </div>
  );
}
