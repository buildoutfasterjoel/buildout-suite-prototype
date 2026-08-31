import { useEffect, useMemo, useState } from "react";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDollarSign,
  faMagnifyingGlass,
} from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import {
  allocationTally,
  previewDeposit,
  receivableBalance,
} from "#/data/deposits";
import { voucherParty } from "#/data/vouchers";
import type { DepositAllocation } from "#/data/types";
import { toISODate } from "#/lib/isoDate";
import { DueDatePicker } from "#/components/deals/NewReceivableModal";
import { formatCurrency, formatDate } from "#/components/deals/dealDisplay";
import type { DepositVoucherOption } from "#/data/depositVouchers";

export interface NewDepositInput {
  dealId: string;
  date: string;
  amount: number;
  referenceNumber: string;
  receivableAllocations: DepositAllocation[];
  deductionAllocations: DepositAllocation[];
}

/**
 * A money input with the `$` addon, right-aligned the way every figure is.
 *
 * `minWidth` is not decoration. Inside the Apply To table these sit in an
 * auto-layout column that collapses to whatever the header text needs, and a
 * seven-figure allocation then renders as "40" with the rest clipped. A width on
 * the `<th>` is only a hint the browser drops under pressure; a floor on the
 * control itself is what the column actually has to respect.
 */
function MoneyInput({
  value,
  onChange,
  max,
  label,
  minWidth,
  placeholder = "0.00",
}: {
  value: string;
  onChange: (next: string) => void;
  max?: number;
  label: string;
  minWidth?: number;
  placeholder?: string;
}) {
  return (
    <InputGroup style={minWidth ? { minWidth } : undefined}>
      <InputGroup.Addon>
        <FontAwesomeIcon icon={faDollarSign} />
      </InputGroup.Addon>
      <Input
        type="number"
        step="0.01"
        min="0"
        max={max}
        className="text-end"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </InputGroup>
  );
}

/**
 * New Deposit — money received, filed from the Back Office rather than from one
 * deal's voucher.
 *
 * The deal page's Apply Deposit modal arrives already knowing which voucher and
 * which lines it is for, because a row's menu or a toolbar selection chose them.
 * Nothing has chosen anything here, so this modal starts one step earlier: pick
 * the voucher, then say where the money goes.
 *
 * **Nothing is split for you.** Apply Deposit fills the selected lines oldest
 * first and offers an Override switch to correct it. Here every receivable
 * starts at $0.00 and the broker types each figure, because a deposit filed from
 * the Back Office is usually one cheque against one known line — an auto-split
 * across four lines would be four figures to undo. The running total above the
 * table is what makes that workable: it says what is left to place, counting
 * down as the fields are filled.
 *
 * Deductions are the exception, and they stay computed. A deduction is a second
 * reading of the same money rather than a slice taken out of it (see
 * `previewDeposit`), so there is no decision for the broker to make and nothing
 * typed there would change what is left to allocate.
 */
export function NewDepositModal({
  open,
  onOpenChange,
  vouchers,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vouchers that can take a deposit, already filtered — see `depositVouchers`. */
  vouchers: DepositVoucherOption[];
  onSave: (input: NewDepositInput) => void;
}) {
  const [voucher, setVoucher] = useState<DepositVoucherOption | null>(null);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  /** Keyed by receivable id, held as typed text so a half-typed "1." survives. */
  const [lines, setLines] = useState<Record<string, string>>({});

  // A fresh form every time it opens, dated today — a deposit is being recorded
  // because money has just arrived. The same default Apply Deposit takes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `open` alone by design
  useEffect(() => {
    if (!open) return;
    setVoucher(null);
    setQuery("");
    setDate(toISODate(new Date()));
    setAmount("");
    setReference("");
    setLines({});
  }, [open]);

  const parsedAmount = Number.parseFloat(amount) || 0;

  /** Only the lines with money on them — a $0.00 allocation is not a record. */
  const allocations = useMemo(
    () =>
      Object.entries(lines)
        .map(([targetId, raw]) => ({
          targetId,
          amount: Number.parseFloat(raw) || 0,
        }))
        .filter((a) => a.amount > 0),
    [lines],
  );

  const tally = allocationTally(
    parsedAmount,
    allocations.map((a) => a.amount),
  );

  // Deductions only. `selected: []` skips the oldest-first fill this modal does
  // not want, and leaves the proportional deduction share, which is measured
  // against the whole voucher either way.
  const deductionLines = useMemo(() => {
    if (!voucher || parsedAmount <= 0) return [];
    return previewDeposit({
      amount: parsedAmount,
      selected: [],
      allReceivables: voucher.receivables,
      deductions: voucher.deductions,
    }).deductions;
  }, [voucher, parsedAmount]);

  /** Outstanding lines only. A settled receivable has nothing to receive. */
  const openReceivables = useMemo(
    () => (voucher?.receivables ?? []).filter((r) => receivableBalance(r) > 0),
    [voucher],
  );

  const pickVoucher = (next: DepositVoucherOption | null) => {
    setVoucher(next);
    setQuery(next?.label ?? "");
    // The old voucher's line ids mean nothing on the new one, and a stale
    // allocation would silently ride along into the save.
    setLines({});
  };

  const blocked = (): string | null => {
    if (!voucher) return "Pick a voucher first.";
    if (parsedAmount <= 0) return "Enter the amount that arrived.";
    if (allocations.length === 0) return "Apply the deposit to a receivable.";
    if (tally.overAllocated > 0) {
      return `${formatCurrency(tally.overAllocated)} more is applied than arrived.`;
    }
    return null;
  };
  const block = blocked();

  const save = () => {
    if (block || !voucher) return;
    onSave({
      dealId: voucher.dealId,
      date,
      amount: parsedAmount,
      referenceNumber: reference.trim(),
      receivableAllocations: allocations,
      deductionAllocations: deductionLines
        .filter((line) => line.applied > 0)
        .map((line) => ({ targetId: line.targetId, amount: line.applied })),
    });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "46rem" }}>
        <Modal.Header>
          <Modal.Title>New Deposit</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Voucher</Field.Label>
            <Combobox
              items={vouchers}
              value={voucher}
              inputValue={query}
              onInputValueChange={(v: string) => setQuery(v)}
              onValueChange={(v) =>
                pickVoucher((v as DepositVoucherOption | null) ?? null)
              }
            >
              <Combobox.InputGroup>
                <InputGroup.Addon>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </InputGroup.Addon>
                <Combobox.Input
                  placeholder="Search by voucher, deal, address or broker"
                  showTrigger
                  showClear
                />
              </Combobox.InputGroup>
              <Combobox.Content>
                <Combobox.Empty className="text-muted">
                  {vouchers.length === 0
                    ? "Every voucher is fully paid — nothing is waiting on a deposit."
                    : "No matching vouchers"}
                </Combobox.Empty>
                <Combobox.List>
                  {(item: DepositVoucherOption) => (
                    <Combobox.Item key={item.dealId} value={item}>
                      <div className="d-flex justify-content-between gap-3 w-100">
                        <div className="d-flex flex-column">
                          <span>{item.label}</span>
                          <span className="text-muted fs-small">
                            {item.sublabel}
                          </span>
                        </div>
                        <span className="text-nowrap fs-small">
                          {formatCurrency(item.outstanding)} due
                        </span>
                      </div>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Content>
            </Combobox>
          </Field>

          {/* Nothing below this point means anything without a voucher: there
              are no lines to place money against, so the form would be three
              fields leading nowhere. */}
          {!voucher ? (
            <p className="text-muted mb-0">
              Pick the voucher this money came in against.
            </p>
          ) : (
            <>
              <div className="d-flex gap-3 flex-wrap">
                <Field style={{ flex: "1 1 12rem" }}>
                  <Field.Label>Deposit Date</Field.Label>
                  {/* The shared picker, so Back Office does not offer a
                      different date control from the one the voucher uses. */}
                  <DueDatePicker value={date} onChange={setDate} />
                </Field>

                <Field style={{ flex: "1 1 10rem" }}>
                  <Field.Label>Deposit Amount</Field.Label>
                  <MoneyInput
                    value={amount}
                    onChange={setAmount}
                    label="Deposit amount"
                  />
                </Field>

                <Field style={{ flex: "1 1 12rem" }}>
                  <Field.Label>Reference Number</Field.Label>
                  {/* Free text, not a number input: a wire reference is as often
                      "WT-4471-A" as it is digits. Optional, and the placeholder
                      says what happens if it stays that way — money often lands
                      before its paperwork does, and a generated reference beats
                      a broker typing a placeholder that then reads as the
                      payer's real one. */}
                  <Input
                    value={reference}
                    placeholder="Generated if left blank"
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
              </div>

              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <h6 className="mb-0 fs-large fw-semibold">Apply To</h6>
                  {/* The running total — the whole reason a hand-allocated form
                      works. It answers "how much is left" on every keystroke,
                      so nobody has to subtract four figures in their head. */}
                  {parsedAmount > 0 &&
                    (tally.overAllocated > 0 ? (
                      <span className="text-danger fw-semibold text-nowrap">
                        {formatCurrency(tally.overAllocated)} over-applied
                      </span>
                    ) : tally.unallocated > 0 ? (
                      <span className="text-harvest-gold-700 fw-semibold text-nowrap">
                        {formatCurrency(tally.unallocated)} left to apply
                      </span>
                    ) : (
                      <span className="text-success fw-semibold text-nowrap">
                        Fully applied
                      </span>
                    ))}
                </div>

                {openReceivables.length === 0 ? (
                  <p className="text-muted mb-0">
                    Every receivable on this voucher is fully paid.
                  </p>
                ) : (
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        {/* No Description column. It reads "Initial Payment"
                            or "Balance Due" on almost every line, and the due
                            date and payer already say which instalment this is
                            — while the Apply inputs need a floor width, and
                            five columns inside a 46rem modal pushed the table
                            into a horizontal scroll that clipped the date. */}
                        <Table.Head>Due Date</Table.Head>
                        <Table.Head>Payer</Table.Head>
                        <Table.Head className="text-end">Balance</Table.Head>
                        <Table.Head className="text-end">Apply</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {openReceivables.map((r) => {
                        const party = voucherParty(r.payerContactId);
                        return (
                          <Table.Row key={r.id}>
                            <Table.Cell className="text-nowrap">
                              {formatDate(r.dueDate)}
                            </Table.Cell>
                            <Table.Cell className="text-nowrap">
                              {r.billToCompany && party.company
                                ? party.company
                                : party.name}
                            </Table.Cell>
                            <Table.Cell className="text-end text-nowrap">
                              {formatCurrency(receivableBalance(r))}
                            </Table.Cell>
                            <Table.Cell className="text-end">
                              {/* Capped at the line's own balance, which is a
                                  rule rather than a nicety: `applyDeposit`
                                  clamps to it on save anyway, so a larger
                                  figure typed here would be silently trimmed. */}
                              <MoneyInput
                                value={lines[r.id] ?? ""}
                                max={receivableBalance(r)}
                                minWidth={150}
                                label={`Apply to the receivable due ${formatDate(r.dueDate)}`}
                                onChange={(next) =>
                                  setLines((prev) => ({ ...prev, [r.id]: next }))
                                }
                              />
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                )}
              </div>

              {/* Computed, not typed. A deduction is a claim on the whole
                  commission that this deposit part-covers — there is no
                  decision here for the broker to make, and it takes nothing
                  out of the money being placed above. */}
              {deductionLines.length > 0 && (
                <div className="d-flex flex-column gap-2">
                  <h6 className="mb-0">Deductions Covered</h6>
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Category/Description</Table.Head>
                        <Table.Head className="text-end">Balance</Table.Head>
                        <Table.Head className="text-end">Covered</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {deductionLines.map((line) => {
                        const d = voucher.deductions.find(
                          (x) => x.id === line.targetId,
                        );
                        return (
                          <Table.Row key={line.targetId}>
                            <Table.Cell>
                              {d?.description
                                ? `${d.category} - ${d.description}`
                                : (d?.category ?? "—")}
                            </Table.Cell>
                            <Table.Cell className="text-end text-nowrap">
                              {formatCurrency(line.balance)}
                            </Table.Cell>
                            <Table.Cell className="text-end text-nowrap">
                              {formatCurrency(line.applied)}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                  <p className="text-muted fs-small mb-0">
                    A deduction is covered in proportion to the whole voucher. It
                    does not come out of the amount above.
                  </p>
                </div>
              )}

              {/* The payables line is conditional because the rule is: money
                  arriving on a voucher nobody has signed off pays nobody yet.
                  Saying "create payables" on a Draft would promise a section
                  that will still be empty afterwards. */}
              <Alert severity="info" withIcon>
                <FontAwesomeIcon icon={faCircleInfo} />
                <div>
                  <div className="fw-semibold">We will:</div>
                  <ul className="mb-0 ps-3">
                    <li>Apply voucher deductions</li>
                    <li>
                      {voucher.approved
                        ? "Create payables for brokers"
                        : "Create payables for brokers once this voucher is approved"}
                    </li>
                  </ul>
                </div>
              </Alert>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          {/* The reason Save is dead, stated beside it. A greyed button with no
              explanation is the worst of both. */}
          {block && voucher && (
            <span className="text-muted fs-small me-auto">{block}</span>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={block !== null}>
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
