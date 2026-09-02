import { useEffect, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { toISODate } from "#/lib/isoDate";
import type { PayableGroup } from "#/data/payableIndex";
import { DueDatePicker } from "#/components/deals/NewReceivableModal";
import { formatCurrency } from "#/components/deals/dealDisplay";

/**
 * Pay off every selected payable in one go.
 *
 * **Full balance, no deductions.** That is the whole difference between this and
 * the voucher's own Create Payment modal, and it is deliberate rather than a
 * gap: a deduction is a hold-back negotiated with one broker on one deal, so
 * there is no such thing as a deduction that applies to a batch. Anyone who
 * needs one writes that cheque on the voucher, where the modal for it already
 * lives. This screen is for the ordinary case — a run of cheques, each for what
 * is owed — which is the only case a bulk action can honestly serve.
 *
 * One field, so plain stacked `Field`s rather than the record-form shell, per
 * the rule in CLAUDE.md.
 */
export function PaySelectedModal({
  open,
  onOpenChange,
  /** The selected rows, still under their brokers — the summary reads per person. */
  groups,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: PayableGroup[];
  /** `date` is `yyyy-mm-dd`. The caller writes the payments and reports. */
  onConfirm: (date: string) => void;
}) {
  const [date, setDate] = useState(() => toISODate(new Date()));

  // Back to today whenever the modal is opened again. A date left over from the
  // last run would silently post the next batch to a day nobody chose.
  useEffect(() => {
    if (open) setDate(toISODate(new Date()));
  }, [open]);

  const count = groups.reduce((total, g) => total + g.rows.length, 0);
  const total = groups.reduce((sum, g) => sum + g.totalDue, 0);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "34rem" }}>
        <Modal.Header>
          <Modal.Title>Pay Selected</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <p className="mb-0">
            Writing {count} {count === 1 ? "payment" : "payments"} to{" "}
            {groups.length} {groups.length === 1 ? "broker" : "brokers"}, each
            for the full balance owed.
          </p>

          <Field>
            <Field.Label>Payment Date</Field.Label>
            {/* The voucher's shared picker, so a payment dated here and a
                payment dated there use the same control. */}
            <DueDatePicker
              value={date}
              onChange={setDate}
              style={{ maxWidth: "14rem" }}
            />
          </Field>

          {/* Per broker rather than one lump sum: these are separate cheques to
              separate people, and the figure an admin checks before confirming
              is what each person is about to receive. */}
          <div className="d-flex flex-column gap-2">
            {groups.map((group) => (
              <div
                key={group.key}
                className="d-flex align-items-center justify-content-between gap-3"
              >
                <span>
                  {group.broker.name}
                  <span className="text-muted fs-small ms-2">
                    {group.rows.length}{" "}
                    {group.rows.length === 1 ? "payable" : "payables"}
                  </span>
                </span>
                <span className="text-nowrap">
                  {formatCurrency(group.totalDue)}
                </span>
              </div>
            ))}
          </div>

          <div className="d-flex align-items-center justify-content-between gap-3 border-top pt-3">
            <span className="fw-semibold">Total</span>
            <span className="fs-large fw-semibold">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Says what this modal cannot do, at the moment the choice is being
              made — not after, when the cheque is already written. */}
          <p className="text-muted fs-small mb-0">
            Gross amounts, before each broker's split. To hold anything back,
            pay that payable on its own voucher instead.
          </p>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={count === 0 || date === ""}
            onClick={() => {
              onConfirm(date);
              onOpenChange(false);
            }}
          >
            Pay {count} {count === 1 ? "Payable" : "Payables"}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
