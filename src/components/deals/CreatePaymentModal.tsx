import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDollarSign,
  faPlus,
  faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker } from "#/data/types";
import { toISODate } from "#/lib/isoDate";
import { DueDatePicker } from "./NewReceivableModal";
import { formatCurrency } from "./dealDisplay";

export interface CreatePaymentInput {
  /** `yyyy-mm-dd`. */
  date: string;
  grossAmount: number;
  deductions: { description: string; amount: number }[];
}

/** One row of the deduction repeater, while it is being typed. */
interface DraftDeduction {
  /** Local only — React's key, never stored. `recordPayment` spells the real id. */
  key: string;
  description: string;
  amount: string;
}

function emptyDeduction(): DraftDeduction {
  return { key: crypto.randomUUID(), description: "", amount: "" };
}

/**
 * Write one cheque against a payable.
 *
 * **Gross Amount starts at the balance**, which is the ordinary case — a payable
 * is usually paid off in one go — and typing a smaller figure is how a part
 * payment is made. Bigger is clamped at save rather than blocked here, the same
 * courtesy/guarantee split the Apply Deposit modal makes: the input says what is
 * reasonable, `recordPayment` decides what is stored.
 *
 * **Deductions come off after the split.** The broker's own percentage is what
 * the brokerage owes them; a hold-back is taken off the cheque itself. So the
 * total at the foot is `gross x split - deductions`, and it is spelled out as a
 * running figure rather than left for the admin to work out — a cheque written
 * for the wrong amount is not a mistake this screen should make easy.
 *
 * Under six fields plus a repeater, so plain stacked `Field`s rather than the
 * record-form shell, per the rule in CLAUDE.md.
 */
export function CreatePaymentModal({
  open,
  onOpenChange,
  broker,
  balance,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker: DealBroker | undefined;
  /** What is still owed on the payable, gross. */
  balance: number;
  onSave: (input: CreatePaymentInput) => void;
}) {
  const [date, setDate] = useState(toISODate(new Date()));
  const [amount, setAmount] = useState(String(balance));
  const [deductions, setDeductions] = useState<DraftDeduction[]>([]);

  const parsedAmount = Number.parseFloat(amount);
  const gross = Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0;

  const parsedDeductions = deductions
    .map((d) => ({
      description: d.description.trim(),
      amount: Number.parseFloat(d.amount),
    }))
    .map((d) => ({
      ...d,
      amount: Number.isFinite(d.amount) ? Math.max(0, d.amount) : 0,
    }));

  // The same arithmetic `paymentNet` does, run on figures that are still being
  // typed. Not `paymentNet` itself: that takes a stored payment, and building a
  // throwaway one on every keystroke to reuse six lines would read worse than
  // this does.
  const splitPct = broker?.personalSplitPct ?? 100;
  const deductionTotal = parsedDeductions.reduce((t, d) => t + d.amount, 0);
  const estimatedTotal = Math.max(
    0,
    Math.round((gross * (splitPct / 100) - deductionTotal) * 100) / 100,
  );

  const patch = (key: string, next: Partial<DraftDeduction>) =>
    setDeductions((rows) =>
      rows.map((d) => (d.key === key ? { ...d, ...next } : d)),
    );

  const priced = gross > 0 && date !== "";

  const save = () => {
    if (!priced) return;
    onSave({ date, grossAmount: gross, deductions: parsedDeductions });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "34rem" }}>
        <Modal.Header>
          <Modal.Title>Create Payment</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Date</Field.Label>
            {/* The voucher's shared picker, so the page does not offer two
                different date controls for two different dates. */}
            <DueDatePicker
              value={date}
              onChange={setDate}
              style={{ maxWidth: "14rem" }}
            />
          </Field>

          <Field>
            <Field.Label>Balance</Field.Label>
            {/* Read-only, and read-only rather than absent: what is still owed is
                the figure the amount below is measured against, and an admin
                typing a part payment needs to see it without going back to the
                table. */}
            <Input
              readOnly
              disabled
              className="text-end"
              value={formatCurrency(balance)}
            />
          </Field>

          <Field>
            <Field.Label>Gross Amount</Field.Label>
            <InputGroup>
              <InputGroup.Addon>
                <FontAwesomeIcon icon={faDollarSign} />
              </InputGroup.Addon>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={balance}
                className="text-end"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </InputGroup>
          </Field>

          <div className="d-flex flex-column gap-2">
            <h6 className="mb-0 fs-large fw-semibold">Deductions</h6>
            {/* Stacked rows, not a table. Two fields per row and usually none at
                all — `AdditionalTypesEditor`'s case exactly: at this size a
                header row costs more than it returns, and nothing here is read
                down a column. */}
            {deductions.map((d) => (
              <div key={d.key} className="d-flex align-items-center gap-2">
                <Input
                  className="flex-grow-1"
                  placeholder="Description"
                  aria-label="Deduction description"
                  value={d.description}
                  onChange={(e) => patch(d.key, { description: e.target.value })}
                />
                <InputGroup style={{ maxWidth: "10rem" }}>
                  <InputGroup.Addon>
                    <FontAwesomeIcon icon={faDollarSign} />
                  </InputGroup.Addon>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="text-end"
                    placeholder="0.00"
                    aria-label="Deduction amount"
                    value={d.amount}
                    onChange={(e) => patch(d.key, { amount: e.target.value })}
                  />
                </InputGroup>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove deduction"
                  onClick={() =>
                    setDeductions((rows) => rows.filter((x) => x.key !== d.key))
                  }
                >
                  <FontAwesomeIcon icon={faTrashCan} />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="align-self-start"
              onClick={() => setDeductions((rows) => [...rows, emptyDeduction()])}
            >
              <FontAwesomeIcon icon={faPlus} />
              Add a deduction
            </Button>
          </div>

          {/* The cheque, spelled out. "Estimated" because the figure moves with
              every keystroke above it and nothing is written until Save. */}
          <div className="d-flex align-items-center justify-content-between gap-3 border-top pt-3">
            <span className="fw-semibold">
              Estimated Total Due to {broker?.name ?? "this broker"}
            </span>
            <span className="fs-large fw-semibold">
              {formatCurrency(estimatedTotal)}
            </span>
          </div>
          {/* Says why the total is not simply the gross. Only shown when the two
              actually differ, so an outside broker's modal — where they are the
              same figure — carries no line explaining a split they do not have. */}
          {splitPct !== 100 && gross > 0 && (
            <p className="text-muted fs-small mb-0">
              {broker?.name} keeps {splitPct}% of the gross under their
              commission plan
              {deductionTotal > 0
                ? `, less ${formatCurrency(deductionTotal)} in deductions.`
                : "."}
            </p>
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
