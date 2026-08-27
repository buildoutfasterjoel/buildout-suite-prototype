import { useEffect, useMemo, useState } from "react";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollarSign } from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import { previewDeposit, type DepositPreviewLine } from "#/data/deposits";
import type {
  DepositAllocation,
  FinancialDeduction,
  FinancialReceivable,
} from "#/data/types";
import { toISODate } from "#/lib/isoDate";
import { DueDatePicker } from "./NewReceivableModal";
import { formatCurrency, formatDate } from "./dealDisplay";

export interface ApplyDepositInput {
  date: string;
  amount: number;
  referenceNumber: string;
  receivableAllocations: DepositAllocation[];
  deductionAllocations: DepositAllocation[];
}

/** The Applied Amount column, read-only or typed over depending on Override. */
function AppliedAmountCell({
  line,
  override,
  onOverride,
}: {
  line: DepositPreviewLine;
  /** Null while Override is off, or while this line has not been retyped. */
  override: number | null;
  onOverride: (next: number) => void;
}) {
  const value = override ?? line.applied;
  if (override === null) {
    return <span className="text-nowrap">{formatCurrency(value)}</span>;
  }
  return (
    <InputGroup>
      <InputGroup.Addon>
        <FontAwesomeIcon icon={faDollarSign} />
      </InputGroup.Addon>
      <Input
        type="number"
        step="0.01"
        min={0}
        max={line.balance}
        className="text-end"
        aria-label="Applied amount"
        value={value}
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          onOverride(Number.isNaN(n) ? 0 : Math.max(0, n));
        }}
      />
    </InputGroup>
  );
}

/**
 * One preview table — a Receivables one and a Deductions one, differing only in
 * what their first column names.
 */
function PreviewTable({
  title,
  firstHeading,
  lines,
  labelFor,
  overrides,
  overriding,
  onOverride,
}: {
  title: string;
  firstHeading: string;
  lines: DepositPreviewLine[];
  labelFor: (targetId: string) => string;
  overrides: Record<string, number>;
  overriding: boolean;
  onOverride: (targetId: string, next: number) => void;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="d-flex flex-column gap-2">
      <h6 className="mb-0">{title}</h6>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>{firstHeading}</Table.Head>
            <Table.Head className="text-end">Balance</Table.Head>
            <Table.Head className="text-end" style={{ width: 170 }}>
              Applied Amount
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {lines.map((line) => (
            <Table.Row key={line.targetId}>
              <Table.Cell>{labelFor(line.targetId)}</Table.Cell>
              <Table.Cell className="text-end text-nowrap">
                {formatCurrency(line.balance)}
              </Table.Cell>
              <Table.Cell className="text-end">
                <AppliedAmountCell
                  line={line}
                  override={
                    overriding ? (overrides[line.targetId] ?? line.applied) : null
                  }
                  onOverride={(next) => onOverride(line.targetId, next)}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

/**
 * Apply Deposit — money received against the receivables this voucher billed.
 *
 * **The selection is the scope.** Opened from a row's own menu it holds that one
 * receivable; opened from the toolbar it holds every selected row, filled oldest
 * due date first. The modal does not decide this — `selected` arrives already
 * chosen, which is what keeps the two entry points meaning different things
 * without the modal knowing which one it came from.
 *
 * The deduction lines are a second reading of the same money, not a slice taken
 * out of it: a $5,555.55 deposit puts $5,555.55 against a receivable *and* its
 * proportional share against each deduction. See `previewDeposit`.
 *
 * **Override hands the split to the admin.** Off, the Applied Amount column is
 * text. On, every cell becomes an input seeded with the computed figure, and what
 * is on screen at Save is what gets stored — `applyDeposit` deliberately does not
 * recompute it. Turning Override back off discards the typed figures and returns
 * to the computed split, which is the only reading of "off" that stays true.
 *
 * There is no New Payables table. The note says a deposit creates payables for
 * brokers and the voucher's Payables section says the same, but that record does
 * not exist yet, and a table of figures nothing stores would be the one part of
 * this preview that was not true.
 */
export function ApplyDepositModal({
  open,
  onOpenChange,
  selected,
  allReceivables,
  deductions,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The receivables this deposit may touch — one row, or a toolbar selection. */
  selected: FinancialReceivable[];
  /** Every receivable on the voucher. The deduction denominator, nothing else. */
  allReceivables: FinancialReceivable[];
  deductions: FinancialDeduction[];
  onApply: (input: ApplyDepositInput) => void;
}) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  // A fresh form every time it opens, dated today. Deposit Date defaults where
  // Due Date on the New Receivable modal deliberately does not: a receivable is
  // often opened before its date is known, while a deposit is being recorded
  // because money has just arrived.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `open` alone by design
  useEffect(() => {
    if (!open) return;
    setDate(toISODate(new Date()));
    setAmount("");
    setReference("");
    setOverriding(false);
    setOverrides({});
  }, [open]);

  const parsedAmount = Number.parseFloat(amount) || 0;

  const preview = useMemo(
    () =>
      previewDeposit({
        amount: parsedAmount,
        selected,
        allReceivables,
        deductions,
      }),
    [parsedAmount, selected, allReceivables, deductions],
  );

  const receivablesById = useMemo(
    () => new Map(allReceivables.map((r) => [r.id, r])),
    [allReceivables],
  );
  const deductionsById = useMemo(
    () => new Map(deductions.map((d) => [d.id, d])),
    [deductions],
  );

  /** What Save would write — the computed split, or whatever was typed over it. */
  const allocationsFor = (lines: DepositPreviewLine[]): DepositAllocation[] =>
    lines.map((line) => ({
      targetId: line.targetId,
      amount: overriding ? (overrides[line.targetId] ?? line.applied) : line.applied,
    }));

  const setOverride = (targetId: string, next: number) =>
    setOverrides((prev) => ({ ...prev, [targetId]: next }));

  // Turning Override off drops the typed figures rather than keeping them
  // invisible behind a switch — a hidden override that Save still wrote would be
  // the worst of both readings.
  const toggleOverride = (on: boolean) => {
    setOverriding(on);
    if (!on) setOverrides({});
  };

  const priced = parsedAmount > 0;

  const save = () => {
    if (!priced) return;
    onApply({
      date,
      amount: parsedAmount,
      referenceNumber: reference.trim(),
      receivableAllocations: allocationsFor(preview.receivables),
      deductionAllocations: allocationsFor(preview.deductions),
    });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "46rem" }}>
        <Modal.Header>
          <Modal.Title>Apply Deposit</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Deposit Date</Field.Label>
            {/* The shared picker, so the voucher does not offer two different
                date controls for two different dates on the same page. */}
            <DueDatePicker
              value={date}
              onChange={setDate}
              style={{ maxWidth: "14rem" }}
            />
          </Field>

          <Field>
            <Field.Label>Deposit Amount</Field.Label>
            <InputGroup>
              <InputGroup.Addon>
                <FontAwesomeIcon icon={faDollarSign} />
              </InputGroup.Addon>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="text-end"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </InputGroup>
          </Field>

          <Field>
            <Field.Label>Reference Number</Field.Label>
            {/* Free text, not a number input: a wire reference is as often
                "WT-4471-A" as it is digits, and a number field would refuse it. */}
            <Input
              value={reference}
              placeholder="Cheque or wire reference"
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>

          {/* What lands beyond the receivable itself. The second line is not yet
              true of the data — nothing creates a payable — and is kept because
              the voucher's own Payables section already states it, so dropping it
              here would make the two pages disagree. */}
          <Alert severity="info" withIcon>
            <FontAwesomeIcon icon={faCircleInfo} />
            <div>
              <div className="fw-semibold">We will:</div>
              <ul className="mb-0 ps-3">
                <li>Apply voucher deductions</li>
                <li>Create payables for brokers</li>
              </ul>
            </div>
          </Alert>

          <div className="d-flex align-items-center justify-content-between gap-3">
            <h5 className="mb-0">Deposit Application Preview</h5>
            <div className="d-flex align-items-center gap-2">
              <span>Override</span>
              <Switch
                checked={overriding}
                onCheckedChange={toggleOverride}
                disabled={!priced}
                aria-label="Override the deposit allocation"
              />
            </div>
          </div>

          {!priced ? (
            <p className="text-muted mb-0">
              Enter an amount and date to see how the deposit will be applied.
            </p>
          ) : (
            <div className="d-flex flex-column gap-4">
              <PreviewTable
                title="Receivables"
                firstHeading="Date"
                lines={preview.receivables}
                labelFor={(id) => {
                  const r = receivablesById.get(id);
                  return r ? formatDate(r.dueDate) : "—";
                }}
                overrides={overrides}
                overriding={overriding}
                onOverride={setOverride}
              />

              {/* Stated rather than swallowed. A deposit larger than the selected
                  lines can absorb is a real thing to enter — the rest belongs to
                  receivables that were not selected — and money that quietly
                  vanished between the amount typed and the amounts applied is the
                  one thing this preview exists to prevent. */}
              {preview.unapplied > 0 && !overriding && (
                <p className="text-harvest-gold-700 fs-small mb-0">
                  {formatCurrency(preview.unapplied)} not applied — the selected
                  receivables cannot absorb the whole deposit.
                </p>
              )}

              <PreviewTable
                title="Deductions"
                firstHeading="Category/Description"
                lines={preview.deductions}
                labelFor={(id) => {
                  const d = deductionsById.get(id);
                  if (!d) return "—";
                  return d.description
                    ? `${d.category} - ${d.description}`
                    : d.category;
                }}
                overrides={overrides}
                overriding={overriding}
                onOverride={setOverride}
              />
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!priced}>
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
