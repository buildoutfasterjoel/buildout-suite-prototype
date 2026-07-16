import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faArrowDown,
  faPlus,
  faTrashCan,
  faCalendar,
  faGear,
  faFileContract,
  faBullhorn,
  faChartLine,
  faKey,
  faBuilding,
  faVectorSquare,
} from "@fortawesome/pro-regular-svg-icons";
import type {
  DealBroker,
  DealPitchFinancials,
  DealTransaction,
  DealType,
  ExpenseLineItem,
  FinancialScenario,
  IncomeLineItem,
  InvestmentType,
  LeaseRateUnits,
  Listing,
  MarketingChannel,
  Property,
  PropertyStatus,
  PropertyUnit,
  PropertyUse,
  SpaceLeaseType,
  SpaceLeaseTerms,
  VisibilityTier,
} from "#/data/types";
import { updateDeal } from "#/data/actions";
import {
  commissionAmountFromPct,
  commissionPctFromAmount,
} from "#/data/commission";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import {
  STATUS_LABELS,
  PROPERTY_STATUSES,
} from "#/components/properties/propertyDisplay";
import { Section } from "#/components/listings/listingWidgets";

// ── Option lists (string unions from the data model) ────────────────────────
const DEAL_TYPES: DealType[] = ["Sale", "Lease", "Sale / Lease"];
const PROPERTY_USES: PropertyUse[] = [
  "Net Leased Investment",
  "Investment",
  "Owner/User",
  "Business for Sale",
  "Development",
];
const INVESTMENT_TYPES: InvestmentType[] = [
  "Core",
  "Core Plus",
  "Value Add",
  "Opportunistic",
  "Distressed",
];
const MARKETING_CHANNELS: MarketingChannel[] = [
  "None",
  "Buildout Buyer Network",
  "My Brokerage Website",
  "Buildout Syndication Network",
];
const VISIBILITY_TIERS: VisibilityTier[] = [
  "Fully Private",
  "Private",
  "Semi-Public",
  "Fully Public",
];
const LEASE_RATE_UNITS: LeaseRateUnits[] = ["SF/Yr", "SF/Mo", "Monthly"];
const LEASE_TYPES: SpaceLeaseType[] = [
  "Gross",
  "Modified Gross",
  "NNN",
  "Modified Net",
  "Full Service",
  "Ground Lease",
];

// ── Small field wrappers ─────────────────────────────────────────────────────
function TextField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      {textarea ? (
        <Textarea
          rows={rows ?? 3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </Field>
  );
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/** Format a stored date value (ISO string or `yyyy-mm-dd`) as a local Date. */
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  // Plain `yyyy-mm-dd` parses as UTC midnight; pin to local to avoid an
  // off-by-one day. Full ISO strings already carry a time/zone.
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value);
}

/** Serialize a picked Date to a local `yyyy-mm-dd` (no timezone drift). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Blueprint date input: a read-only field with a calendar-icon addon that opens
 * a single-date Calendar popover, closing once a date is picked.
 * (Documented InputGroup + Popover + Calendar pattern.)
 */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <InputGroup>
        <InputGroup.Addon>
          <Popover open={open} onOpenChange={setOpen}>
            <Popover.Trigger
              nativeButton={false}
              aria-label="Open date picker"
              render={<FontAwesomeIcon icon={faCalendar} />}
            />
            <Popover.Content className="p-0" align="start">
              <Calendar
                mode="single"
                selected={selected}
                defaultMonth={selected}
                onSelect={(d) => {
                  onChange(d ? toISODate(d) : null);
                  setOpen(false);
                }}
              />
            </Popover.Content>
          </Popover>
        </InputGroup.Addon>
        <Input
          type="text"
          readOnly
          placeholder="Pick a date"
          value={
            selected ? selected.toLocaleDateString(undefined, DATE_FORMAT) : ""
          }
        />
      </InputGroup>
    </Field>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  labels,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
        <Select.Trigger className="w-100">
          <Select.Value>
            {(v) => (labels ? (labels[v as string] ?? String(v)) : String(v))}
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          {options.map((o) => (
            <Select.Item key={o} value={o}>
              {labels?.[o] ?? o}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </Field>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3 py-1">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

/** A responsive two-column grid of fields. */
function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="row g-3">{children}</div>;
}
function Col({ children }: { children: React.ReactNode }) {
  return <div className="col-md-6">{children}</div>;
}

// ── Bullets editor ───────────────────────────────────────────────────────────
function BulletsField({
  label,
  bullets,
  onChange,
}: {
  label: string;
  bullets: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <div className="d-flex flex-column gap-2">
        {bullets.map((b, i) => (
          <div key={i} className="d-flex align-items-center gap-2">
            <Input
              value={b}
              onChange={(e) =>
                onChange(bullets.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove bullet"
              onClick={() => onChange(bullets.filter((_, j) => j !== i))}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange([...bullets, ""])}
          >
            <FontAwesomeIcon icon={faPlus} />
            Add bullet
          </Button>
        </div>
      </div>
    </Field>
  );
}

// ── Broker rows ──────────────────────────────────────────────────────────────
function BrokerEditor({
  title,
  brokers,
  side,
  onChange,
}: {
  title: string;
  brokers: DealBroker[];
  side: "internal" | "outside";
  onChange: (v: DealBroker[]) => void;
}) {
  const update = (id: string, patch: Partial<DealBroker>) =>
    onChange(brokers.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const add = () =>
    onChange([
      ...brokers,
      {
        id: crypto.randomUUID(),
        name: "",
        role: "Co-Broker",
        email: "",
        side,
        commissionSplitPct: 0,
        grossCommission: 0,
      },
    ]);
  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between">
        <span className="fw-semibold">{title}</span>
        <Button variant="ghost" size="sm" onClick={add}>
          <FontAwesomeIcon icon={faPlus} />
          Add broker
        </Button>
      </div>
      {brokers.length === 0 ? (
        <p className="text-muted mb-0">No {side} brokers on this deal.</p>
      ) : (
        brokers.map((b) => (
          <div key={b.id} className="row g-2 align-items-end">
            <div className="col-md-7">
              <TextField
                label="Name"
                value={b.name}
                onChange={(v) => update(b.id, { name: v })}
              />
            </div>
            <div className="col-md-4">
              <NumberField
                label="Split %"
                value={b.commissionSplitPct}
                onChange={(v) => update(b.id, { commissionSplitPct: v ?? 0 })}
              />
            </div>
            <div className="col-md-1 d-flex justify-content-end pb-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove broker"
                onClick={() => onChange(brokers.filter((x) => x.id !== b.id))}
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Line-item editor (income / expenses) ─────────────────────────────────────
function LineItemEditor<T extends IncomeLineItem | ExpenseLineItem>({
  title,
  items,
  onChange,
}: {
  title: string;
  items: T[];
  onChange: (v: T[]) => void;
}) {
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between">
        <span className="fw-semibold">{title}</span>
        <span className="text-muted">Total ${total.toLocaleString()}</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="d-flex align-items-center gap-2">
          <Input
            value={item.label}
            placeholder="Label"
            onChange={(e) =>
              onChange(
                items.map((x) =>
                  x.id === item.id ? { ...x, label: e.target.value } : x,
                ),
              )
            }
          />
          <Input
            type="number"
            style={{ maxWidth: 160 }}
            value={item.amount}
            onChange={(e) =>
              onChange(
                items.map((x) =>
                  x.id === item.id
                    ? { ...x, amount: Number(e.target.value) }
                    : x,
                ),
              )
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove line item"
            onClick={() => onChange(items.filter((x) => x.id !== item.id))}
          >
            <FontAwesomeIcon icon={faTrashCan} />
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange([
              ...items,
              { id: crypto.randomUUID(), label: "", amount: 0 } as T,
            ])
          }
        >
          <FontAwesomeIcon icon={faPlus} />
          Add line item
        </Button>
      </div>
    </div>
  );
}

// ── Scenario editor (reorderable) ────────────────────────────────────────────
function ScenarioEditor({
  scenarios,
  onChange,
}: {
  scenarios: FinancialScenario[];
  onChange: (v: FinancialScenario[]) => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= scenarios.length) return;
    const next = [...scenarios];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const update = (id: string, patch: Partial<FinancialScenario>) =>
    onChange(scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between">
        <span className="fw-semibold">Scenarios</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange([
              ...scenarios,
              {
                id: crypto.randomUUID(),
                name: "New scenario",
                noi: 0,
                capRate: 0,
                cashFlow: 0,
              },
            ])
          }
        >
          <FontAwesomeIcon icon={faPlus} />
          Add scenario
        </Button>
      </div>
      {scenarios.map((s, i) => (
        <div
          key={s.id}
          className="border rounded p-3"
          style={{ borderRadius: 6 }}
        >
          <div className="d-flex align-items-center gap-2 mb-2">
            <div className="d-flex flex-column">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move scenario up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <FontAwesomeIcon icon={faArrowUp} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move scenario down"
                disabled={i === scenarios.length - 1}
                onClick={() => move(i, 1)}
              >
                <FontAwesomeIcon icon={faArrowDown} />
              </Button>
            </div>
            <div className="flex-grow-1">
              <Input
                value={s.name}
                onChange={(e) => update(s.id, { name: e.target.value })}
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove scenario"
              onClick={() => onChange(scenarios.filter((x) => x.id !== s.id))}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </Button>
          </div>
          <FieldGrid>
            <div className="col-md-4">
              <NumberField
                label="NOI"
                value={s.noi}
                onChange={(v) => update(s.id, { noi: v ?? 0 })}
              />
            </div>
            <div className="col-md-4">
              <NumberField
                label="Cap Rate %"
                value={s.capRate}
                onChange={(v) => update(s.id, { capRate: v ?? 0 })}
              />
            </div>
            <div className="col-md-4">
              <NumberField
                label="Cash Flow"
                value={s.cashFlow}
                onChange={(v) => update(s.id, { cashFlow: v ?? 0 })}
              />
            </div>
          </FieldGrid>
        </div>
      ))}
    </div>
  );
}

// ── Per-unit lease terms card ────────────────────────────────────────────────
function UnitLeaseCard({
  unit,
  terms,
  onChange,
}: {
  unit: PropertyUnit;
  terms: SpaceLeaseTerms;
  onChange: (patch: Partial<SpaceLeaseTerms>) => void;
}) {
  return (
    <Accordion.Item value={unit.id}>
      <Accordion.Trigger
        render={
          <span className="fw-semibold d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
            {unit.label}
            <span className="text-muted fw-normal ms-1">
              {unit.sqft.toLocaleString()} SF
            </span>
          </span>
        }
      />
      <Accordion.Content>
        <FieldGrid>
          <Col>
            <NumberField
              label="Lease Rate"
              value={terms.leaseRate}
              onChange={(v) => onChange({ leaseRate: v })}
            />
          </Col>
          <Col>
            <SelectField
              label="Rate Units"
              value={terms.leaseRateUnits}
              options={LEASE_RATE_UNITS}
              onChange={(v) => onChange({ leaseRateUnits: v })}
            />
          </Col>
          <Col>
            <SelectField
              label="Lease Type"
              value={terms.leaseType}
              options={LEASE_TYPES}
              onChange={(v) => onChange({ leaseType: v })}
            />
          </Col>
          <Col>
            <NumberField
              label="Term (months)"
              value={terms.leaseTermMonths}
              onChange={(v) => onChange({ leaseTermMonths: v })}
            />
          </Col>
          <Col>
            <DateField
              label="Date Available"
              value={terms.dateAvailable}
              onChange={(v) => onChange({ dateAvailable: v })}
            />
          </Col>
          <Col>
            <NumberField
              label="Min Divisible (SF)"
              value={terms.minDivisibleSqFt}
              onChange={(v) => onChange({ minDivisibleSqFt: v })}
            />
          </Col>
          <Col>
            <NumberField
              label="Max Contiguous (SF)"
              value={terms.maxContiguousSqFt}
              onChange={(v) => onChange({ maxContiguousSqFt: v })}
            />
          </Col>
          <Col>
            <NumberField
              label="TI Allowance ($/SF)"
              value={terms.tiAllowance}
              onChange={(v) => onChange({ tiAllowance: v })}
            />
          </Col>
          <Col>
            <NumberField
              label="Free Rent (months)"
              value={terms.freeRentMonths}
              onChange={(v) => onChange({ freeRentMonths: v })}
            />
          </Col>
          <Col>
            <TextField
              label="Rent Escalators"
              value={terms.rentEscalators ?? ""}
              onChange={(v) => onChange({ rentEscalators: v || null })}
            />
          </Col>
          <Col>
            <NumberField
              label="Tax ($/SF)"
              value={terms.taxPerSf}
              onChange={(v) => onChange({ taxPerSf: v })}
            />
          </Col>
          <Col>
            <TextField
              label="Tax Stops"
              value={terms.taxStops ?? ""}
              onChange={(v) => onChange({ taxStops: v || null })}
            />
          </Col>
          <Col>
            <NumberField
              label="CAM ($/SF)"
              value={terms.camPerSf}
              onChange={(v) => onChange({ camPerSf: v })}
            />
          </Col>
          <Col>
            <TextField
              label="CAM Stops"
              value={terms.camStops ?? ""}
              onChange={(v) => onChange({ camStops: v || null })}
            />
          </Col>
          <Col>
            <NumberField
              label="Insurance ($/SF)"
              value={terms.insurancePerSf}
              onChange={(v) => onChange({ insurancePerSf: v })}
            />
          </Col>
          <Col>
            <TextField
              label="Expense Stops"
              value={terms.expenseStops ?? ""}
              onChange={(v) => onChange({ expenseStops: v || null })}
            />
          </Col>
          <Col>
            <NumberField
              label="Procurement Fee %"
              value={terms.procurementFeePct}
              onChange={(v) => onChange({ procurementFeePct: v })}
            />
          </Col>
          <Col>
            <NumberField
              label="Moving Allowance ($)"
              value={terms.movingAllowance}
              onChange={(v) => onChange({ movingAllowance: v })}
            />
          </Col>
          <Col>
            <NumberField
              label="Buyout Allowance ($)"
              value={terms.buyoutAllowance}
              onChange={(v) => onChange({ buyoutAllowance: v })}
            />
          </Col>
          <Col>
            <TextField
              label="Concession"
              value={terms.concession ?? ""}
              onChange={(v) => onChange({ concession: v || null })}
            />
          </Col>
        </FieldGrid>
        <div className="mt-3">
          <TextField
            label="Description"
            textarea
            value={terms.description ?? ""}
            onChange={(v) => onChange({ description: v || null })}
          />
        </div>
        <div
          className="mt-3 d-flex flex-column gap-1"
          style={{ maxWidth: 360 }}
        >
          <SwitchRow
            label="Hide rate"
            checked={terms.hideLeaseRate}
            onChange={(v) => onChange({ hideLeaseRate: v })}
          />
          <SwitchRow
            label="Signage available"
            checked={terms.signageAvailable}
            onChange={(v) => onChange({ signageAvailable: v })}
          />
          <SwitchRow
            label="Sublease"
            checked={terms.sublease}
            onChange={(v) => onChange({ sublease: v })}
          />
          <SwitchRow
            label="Net lease investment"
            checked={terms.netLeaseInvestment}
            onChange={(v) => onChange({ netLeaseInvestment: v })}
          />
          <SwitchRow
            label="Tenants pay gas"
            checked={terms.tenantsPayGas}
            onChange={(v) => onChange({ tenantsPayGas: v })}
          />
          <SwitchRow
            label="Tenants pay electric"
            checked={terms.tenantsPayElectric}
            onChange={(v) => onChange({ tenantsPayElectric: v })}
          />
          <SwitchRow
            label="Tenants pay water"
            checked={terms.tenantsPayWater}
            onChange={(v) => onChange({ tenantsPayWater: v })}
          />
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

/**
 * Single-page deal editor — the marketing content behind a deal's outputs. Holds a
 * working copy in local state; Save commits through {@link updateDeal}, Cancel
 * discards. Sale/Lease sections adapt to the deal's `dealType`.
 */
export function DealMarketingEditor({
  listing,
  property,
}: {
  listing: Listing;
  property: Property;
}) {
  const navigate = useNavigate();
  const back = () =>
    navigate({
      to: "/listings/$listingId/overview",
      params: { listingId: listing.id },
    });

  const [status, setStatus] = useState<PropertyStatus>(listing.status);
  const [dealType, setDealType] = useState<DealType>(listing.dealType);
  const [internalBrokers, setInternalBrokers] = useState<DealBroker[]>(
    listing.internalBrokers,
  );
  const [outsideBrokers, setOutsideBrokers] = useState<DealBroker[]>(
    listing.outsideBrokers,
  );
  const [transaction, setTransaction] = useState<DealTransaction>(
    listing.transaction,
  );
  const [financials, setFinancials] = useState<DealPitchFinancials>(
    listing.financials,
  );
  const [marketing, setMarketing] = useState(listing.marketing);

  const isSale = dealType !== "Lease";
  const isLease = dealType !== "Sale";

  const patchMarketing = (patch: Partial<typeof marketing>) =>
    setMarketing((m) => ({ ...m, ...patch }));
  const patchFinancials = (patch: Partial<DealPitchFinancials>) =>
    setFinancials((f) => ({ ...f, ...patch }));
  const patchTransaction = (patch: Partial<DealTransaction>) =>
    setTransaction((t) => ({ ...t, ...patch }));

  // Sale Price / Gross Commission % / Gross Commission $ — bi-directional, sale
  // price anchors (same math as the stage gate and Edit Transaction dialog).
  const setSalePrice = (v: number | null) =>
    setTransaction((t) => ({
      ...t,
      salePrice: v ?? 0,
      commissionAmount:
        v != null && t.commissionPct != null
          ? commissionAmountFromPct(v, t.commissionPct)
          : t.commissionAmount,
    }));
  const setCommissionPct = (v: number | null) =>
    setTransaction((t) => ({
      ...t,
      commissionPct: v ?? 0,
      commissionAmount:
        v != null && t.salePrice != null
          ? commissionAmountFromPct(t.salePrice, v)
          : t.commissionAmount,
    }));
  const setCommissionAmount = (v: number | null) =>
    setTransaction((t) => ({
      ...t,
      commissionAmount: v ?? 0,
      commissionPct:
        v != null && t.salePrice > 0
          ? commissionPctFromAmount(t.salePrice, v)
          : t.commissionPct,
    }));

  // Tolerate a stale snapshot that predates the per-unit array.
  const spaceLeaseTerms = marketing.spaceLeaseTerms ?? [];

  /** Look up a unit's terms in the working copy, defaulting a blank record. */
  const termsForUnit = (unitId: string): SpaceLeaseTerms =>
    spaceLeaseTerms.find((t) => t.unitId === unitId) ??
    emptySpaceLeaseTerms(unitId);

  const patchUnitTerms = (unitId: string, patch: Partial<SpaceLeaseTerms>) => {
    const existing = spaceLeaseTerms.find((t) => t.unitId === unitId);
    const next = existing
      ? spaceLeaseTerms.map((t) =>
          t.unitId === unitId ? { ...t, ...patch } : t,
        )
      : [...spaceLeaseTerms, { ...emptySpaceLeaseTerms(unitId), ...patch }];
    patchMarketing({ spaceLeaseTerms: next });
  };

  const save = () => {
    updateDeal(listing.id, {
      status,
      dealType,
      internalBrokers,
      outsideBrokers,
      transaction,
      financials,
      marketing,
    });
    back();
  };

  const actions = (
    <>
      <Button variant="ghost" onClick={back}>
        Cancel
      </Button>
      <Button variant="primary" onClick={save}>
        Save
      </Button>
    </>
  );

  return (
    <div className="d-flex flex-column gap-6 p-4">
      <div className="d-flex align-items-center justify-content-between gap-3">
        <h2 className="fs-6 mb-0 fw-semibold">Edit Deal</h2>
        <div className="d-flex align-items-center gap-2">{actions}</div>
      </div>

      {/* ── Setup / status ── */}
      <Section title="Setup & Status" icon={faGear}>
        <FieldGrid>
          <Col>
            <SelectField
              label="Deal Type"
              value={dealType}
              options={DEAL_TYPES}
              onChange={setDealType}
            />
          </Col>
          <Col>
            <SelectField
              label="Status"
              value={status}
              options={PROPERTY_STATUSES}
              labels={STATUS_LABELS}
              onChange={setStatus}
            />
          </Col>
          <Col>
            <DateField
              label="Listed On"
              value={transaction.listedOnDate}
              onChange={(v) => patchTransaction({ listedOnDate: v })}
            />
          </Col>
          <Col>
            <DateField
              label="Listing Expiration"
              value={transaction.listingExpirationDate}
              onChange={(v) => patchTransaction({ listingExpirationDate: v })}
            />
          </Col>
          <Col>
            <SelectField
              label="Marketing Channel"
              value={marketing.marketingChannel}
              options={MARKETING_CHANNELS}
              onChange={(v) => patchMarketing({ marketingChannel: v })}
            />
          </Col>
          <Col>
            <SelectField
              label="Visibility Tier"
              value={marketing.visibilityTier}
              options={VISIBILITY_TIERS}
              onChange={(v) => patchMarketing({ visibilityTier: v })}
            />
          </Col>
        </FieldGrid>
        <BrokerEditor
          title="Internal Brokers"
          brokers={internalBrokers}
          side="internal"
          onChange={setInternalBrokers}
        />
        <BrokerEditor
          title="Outside Brokers"
          brokers={outsideBrokers}
          side="outside"
          onChange={setOutsideBrokers}
        />
      </Section>

      <Separator />

      {/* ── Transaction terms (parity with the stage gate + Edit Transaction dialog) ── */}
      <Section title="Transaction Terms" icon={faFileContract}>
        <FieldGrid>
          <Col>
            <NumberField
              label="Sale Price"
              value={transaction.salePrice || null}
              onChange={setSalePrice}
            />
          </Col>
          <Col>
            <NumberField
              label="Gross Commission %"
              value={transaction.commissionPct || null}
              onChange={setCommissionPct}
            />
          </Col>
          <Col>
            <NumberField
              label="Gross Commission $"
              value={transaction.commissionAmount || null}
              onChange={setCommissionAmount}
            />
          </Col>
          <Col>
            <NumberField
              label="Close Probability (%)"
              value={transaction.closeProbability || null}
              onChange={(v) => patchTransaction({ closeProbability: v ?? 0 })}
            />
          </Col>
          <Col>
            <DateField
              label="Contract Executed"
              value={transaction.contractExecutedDate}
              onChange={(v) => patchTransaction({ contractExecutedDate: v })}
            />
          </Col>
          <Col>
            <DateField
              label="Close Date"
              value={transaction.closeDate}
              onChange={(v) => patchTransaction({ closeDate: v })}
            />
          </Col>
        </FieldGrid>
      </Section>

      {isSale && <Separator />}

      {/* ── Sale-side marketing + terms ── */}
      {isSale && (
        <Section title="Sale Marketing & Terms" icon={faBullhorn}>
          <TextField
            label="Sale Title"
            value={marketing.saleTitle}
            onChange={(v) => patchMarketing({ saleTitle: v })}
          />
          <TextField
            label="Sale Description"
            textarea
            rows={4}
            value={marketing.saleDescription}
            onChange={(v) => patchMarketing({ saleDescription: v })}
          />
          <BulletsField
            label="Sale Bullets"
            bullets={marketing.saleBullets}
            onChange={(v) => patchMarketing({ saleBullets: v })}
          />
          <FieldGrid>
            <Col>
              <SelectField
                label="Property Use"
                value={marketing.propertyUse}
                options={PROPERTY_USES}
                onChange={(v) => patchMarketing({ propertyUse: v })}
              />
            </Col>
            <Col>
              <SelectField
                label="Investment Type"
                value={marketing.investmentType}
                options={INVESTMENT_TYPES}
                onChange={(v) => patchMarketing({ investmentType: v })}
              />
            </Col>
          </FieldGrid>
          <TextField
            label="Sale Terms"
            textarea
            value={marketing.saleTerms}
            onChange={(v) => patchMarketing({ saleTerms: v })}
          />
          <FieldGrid>
            <Col>
              <TextField
                label="Reimbursement"
                value={marketing.reimbursement}
                onChange={(v) => patchMarketing({ reimbursement: v })}
              />
            </Col>
            <Col>
              <TextField
                label="Closing Info"
                value={marketing.saleClosingInfo}
                onChange={(v) => patchMarketing({ saleClosingInfo: v })}
              />
            </Col>
          </FieldGrid>
          <div className="d-flex flex-column gap-1" style={{ maxWidth: 360 }}>
            <SwitchRow
              label="Includes real estate"
              checked={marketing.includesRealEstate}
              onChange={(v) => patchMarketing({ includesRealEstate: v })}
            />
            <SwitchRow
              label="Auction"
              checked={marketing.auction}
              onChange={(v) => patchMarketing({ auction: v })}
            />
          </div>
        </Section>
      )}

      {isSale && <Separator />}

      {/* ── Sale-side financials ── */}
      {isSale && (
        <Section title="Sale Financials" icon={faChartLine}>
          <FieldGrid>
            <Col>
              <NumberField
                label="Asking Price"
                value={financials.askingPrice}
                onChange={(v) => patchFinancials({ askingPrice: v ?? 0 })}
              />
            </Col>
            <Col>
              <NumberField
                label="Cap Rate %"
                value={financials.capRate}
                onChange={(v) => patchFinancials({ capRate: v ?? 0 })}
              />
            </Col>
            <Col>
              <NumberField
                label="NOI"
                value={financials.noi}
                onChange={(v) => patchFinancials({ noi: v ?? 0 })}
              />
            </Col>
            <Col>
              <NumberField
                label="Operating Expenses"
                value={financials.operatingExpenses}
                onChange={(v) => patchFinancials({ operatingExpenses: v ?? 0 })}
              />
            </Col>
          </FieldGrid>
          <div style={{ maxWidth: 360 }}>
            <SwitchRow
              label="Hide price"
              checked={financials.hidePrice}
              onChange={(v) => patchFinancials({ hidePrice: v })}
            />
          </div>
          <LineItemEditor
            title="Income"
            items={financials.income}
            onChange={(v) => patchFinancials({ income: v })}
          />
          <LineItemEditor
            title="Expenses"
            items={financials.expenses}
            onChange={(v) => patchFinancials({ expenses: v })}
          />
          <ScenarioEditor
            scenarios={financials.scenarios}
            onChange={(v) => patchFinancials({ scenarios: v })}
          />
        </Section>
      )}

      {isLease && <Separator />}

      {/* ── Lease-side terms ── */}
      {isLease && (
        <Section title="Lease Marketing & Terms" icon={faKey}>
          <TextField
            label="Lease Title"
            value={marketing.leaseTitle}
            onChange={(v) => patchMarketing({ leaseTitle: v })}
          />
          <TextField
            label="Lease Description"
            textarea
            value={marketing.leaseDescription}
            onChange={(v) => patchMarketing({ leaseDescription: v })}
          />
          <BulletsField
            label="Lease Bullets"
            bullets={marketing.leaseBullets}
            onChange={(v) => patchMarketing({ leaseBullets: v })}
          />
          <div style={{ maxWidth: 360 }}>
            <NumberField
              label="Commission Split %"
              value={marketing.leaseCommissionSplitPct}
              onChange={(v) => patchMarketing({ leaseCommissionSplitPct: v })}
            />
          </div>
        </Section>
      )}

      {isLease && <Separator />}

      {/* ── Per-space lease terms ── */}
      {isLease && (
        <Section title="Per-Space Terms" icon={faBuilding}>
          {property.units.length === 0 ? (
            <p className="text-muted mb-0">
              This property has no units to set lease terms on.
            </p>
          ) : (
            <Accordion variant="inline" multiple>
              {property.units.map((unit) => (
                <UnitLeaseCard
                  key={unit.id}
                  unit={unit}
                  terms={termsForUnit(unit.id)}
                  onChange={(patch) => patchUnitTerms(unit.id, patch)}
                />
              ))}
            </Accordion>
          )}
        </Section>
      )}

      <div className="d-flex justify-content-end gap-2 border-top pt-4">
        {actions}
      </div>
    </div>
  );
}
