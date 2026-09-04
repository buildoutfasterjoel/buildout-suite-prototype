import { Fragment, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowTurnDownRight,
  faCircleInfo,
  faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker, Listing, VoucherPayable, VoucherPayment } from "#/data/types";
import {
  findPayableBroker,
  isPayableSettled,
  payableBalance,
  payableGrossPaid,
  payableNetPaid,
  paymentDeductionTotal,
  paymentNet,
} from "#/data/payables";
import { deletePayment, recordPayment } from "#/data/actions";
import { notify } from "#/lib/notify";
import { PrivatePayout } from "./PrivatePayout";
import { Section } from "./VoucherSection";
import { CreatePaymentModal, type CreatePaymentInput } from "./CreatePaymentModal";
import { formatCurrency, formatDate } from "./dealDisplay";

/**
 * Column widths for the payables table.
 *
 * Pinned the same way `RECEIVABLE_COL` is, and for the same reason: the payment
 * child rows below are rows of THIS grid rather than a nested table, so a column
 * that sized itself to its content would put a payment's figure somewhere other
 * than under the payable's.
 */
const PAYABLE_COL = {
  /**
   * Pay To takes the remainder, with a floor. Without one the six fixed columns
   * below claim the row and a two-word broker name wraps onto two lines — the
   * one column here that holds a name rather than a figure.
   */
  payToMin: 180,
  date: 132,
  plan: 200,
  gross: 140,
  grossPaid: 140,
  netPaid: 140,
  actions: 88,
} as const;

/** The Commission Plan cell — the plan, and what this broker keeps under it. */
function CommissionPlanCell({ broker }: { broker: DealBroker | undefined }) {
  const plan = broker?.commissionPlan ?? "No Plan";
  // An outside broker has no plan and no split of their own — their gross IS
  // their cheque — so there is nothing for an icon to explain.
  if (!broker?.personalSplitPct) {
    return <span className="text-muted">{plan}</span>;
  }
  return (
    <span className="d-inline-flex align-items-center gap-2">
      {plan}
      {/* States the broker's OWN figure rather than what the plan is supposed to
          pay. Every broker in this prototype is on the same `personalSplitPct`
          by design — one flat rate keeps the pipeline's "You" forecast
          predictable — so a tooltip describing the plan's rate would be
          inventing a number the data does not have. */}
      <Tooltip>
        <Tooltip.Trigger
          render={
            <span
              role="img"
              className="text-muted"
              aria-label={`About ${plan}`}
            >
              <FontAwesomeIcon icon={faCircleInfo} />
            </span>
          }
        />
        <Tooltip.Content>
          {broker.name} keeps {broker.personalSplitPct}% of their gross
          commission under this plan.
        </Tooltip.Content>
      </Tooltip>
    </span>
  );
}

/**
 * One payment, rendered under the payable it settles.
 *
 * A row in the PARENT table's grid rather than a nested table — the same shape
 * `DepositRow` takes under a receivable, and for the same reason: the columns
 * are pinned, so a table inside a spanning cell would size its own and the
 * figures would land nowhere near the ones they belong under.
 */
function PaymentRow({
  payment,
  broker,
  seesPayout,
  onDelete,
}: {
  payment: VoucherPayment;
  broker: DealBroker | undefined;
  /**
   * Whether the viewer may see this broker's payout. A cheque's net and the
   * hold-backs that shaped it are both what the person actually took home, so
   * they go behind the marker together — see `canSeeBrokerPayout`.
   */
  seesPayout: boolean;
  onDelete: () => void;
}) {
  const deductions = payment.deductions;
  return (
    <Table.Row className="receivables-table__deposit">
      <Table.Cell>
        <span className="d-inline-flex align-items-center gap-2 text-muted">
          <FontAwesomeIcon icon={faArrowTurnDownRight} />
          Payment
        </span>
      </Table.Cell>
      <Table.Cell className="text-muted" style={{ width: PAYABLE_COL.date }}>
        {formatDate(payment.date)}
      </Table.Cell>
      {/* Under Commission Plan, because a hold-back is the other thing that
          decides what this cheque is worth. One deduction reads by name; several
          read as a count, since three descriptions do not fit the column and the
          figure beside it already says what they came to. */}
      <Table.Cell className="text-muted" style={{ width: PAYABLE_COL.plan }}>
        {!seesPayout ? (
          deductions.length > 0 && (
            <PrivatePayout variant="cell" />
          )
        ) : deductions.length === 0 ? (
          ""
        ) : deductions.length === 1 ? (
          `${deductions[0]!.description} −${formatCurrency(deductions[0]!.amount)}`
        ) : (
          `${deductions.length} deductions −${formatCurrency(paymentDeductionTotal(payment))}`
        )}
      </Table.Cell>
      {/* Gross Amount stays empty. A payment has no amount owed — the figure it
          carries is what was paid, and that belongs under the two paid columns
          beside the running totals it moved. */}
      <Table.Cell style={{ width: PAYABLE_COL.gross }} />
      <Table.Cell
        className="text-end text-muted"
        style={{ width: PAYABLE_COL.grossPaid }}
      >
        {formatCurrency(payment.grossAmount)}
      </Table.Cell>
      <Table.Cell
        className="text-end text-muted"
        style={{ width: PAYABLE_COL.netPaid }}
      >
        {seesPayout ? (
          formatCurrency(paymentNet(payment, broker))
        ) : (
          <PrivatePayout variant="cell" />
        )}
      </Table.Cell>
      <Table.Cell style={{ width: PAYABLE_COL.actions }}>
        {/* A bare trash button rather than a menu: a payment has exactly one
            thing that can be done to it, and burying one item behind a `⋮`
            costs a click to reveal what the icon already says. */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete payment of ${formatCurrency(payment.grossAmount)}`}
          onClick={onDelete}
        >
          <FontAwesomeIcon icon={faTrashCan} />
        </Button>
      </Table.Cell>
    </Table.Row>
  );
}

/**
 * Payables & Payments: what the brokerage owes its brokers out of the money that
 * has come in, and the cheques written against it.
 *
 * **Approved vouchers only.** A payable is raised by a deposit landing on a
 * signed-off voucher, so a Draft carrying deposits has none — and says so rather
 * than rendering an empty table, because "nothing yet" and "nothing ever" are
 * different answers and only one of them is true here.
 *
 * Nothing on this table is filed by hand. There is no Add button and no editable
 * amount: a payable is a consequence of money arriving, and the way to change
 * one is to change the deposit that raised it.
 */
export function PayablesSection({
  listing,
  seesPayout,
}: {
  listing: Listing;
  /** See `canSeeBrokerPayout` — resolved once by the voucher and passed down. */
  seesPayout: (broker: Pick<DealBroker, "name" | "side">) => boolean;
}) {
  const voucher = listing.transaction.backOffice;
  const payables = voucher.payables ?? [];
  const [paying, setPaying] = useState<VoucherPayable | null>(null);

  const brokerFor = (payable: VoucherPayable) =>
    findPayableBroker(listing, payable.brokerId);
  // An unresolvable broker is treated as private: we cannot show it is the
  // viewer's own row, and guessing open is the wrong way to be wrong about pay.
  const canSee = (payable: VoucherPayable) => {
    const broker = brokerFor(payable);
    return broker ? seesPayout(broker) : false;
  };

  const grossTotal = payables.reduce((t, p) => t + p.grossAmount, 0);
  const grossPaidTotal = payables.reduce((t, p) => t + payableGrossPaid(p), 0);
  const netPaidTotal = payables.reduce(
    (t, p) => t + payableNetPaid(p, brokerFor(p)),
    0,
  );
  // A Net Paid total over only the rows the viewer can see would be a wrong
  // number under the right label, so the total is withheld unless every row is
  // visible. Gross Amount and Gross Paid are the deal's business and keep theirs.
  const seesNetTotal = payables.every(canSee);

  const pay = (input: CreatePaymentInput) => {
    if (!paying) return;
    const broker = brokerFor(paying);
    const { paymentId } = recordPayment(listing.id, paying.id, input);
    // Silent on a refusal, the way the deposit actions are: `recordPayment`
    // clamps and re-checks the voucher's status itself, and the control that got
    // here was already hidden on a settled row.
    if (!paymentId) return;
    notify({
      title: "Payment recorded",
      description: `${formatCurrency(input.grossAmount)} paid to ${broker?.name ?? "this broker"}.`,
    });
  };

  const removePayment = (payable: VoucherPayable, payment: VoucherPayment) => {
    deletePayment(listing.id, payable.id, payment.id);
    notify({
      title: "Payment removed",
      description: `${formatCurrency(payment.grossAmount)} reversed — the payable is open again.`,
    });
  };

  if (voucher.status !== "Approved") {
    return (
      <Section title="Payables & Payments">
        <p className="text-muted mb-0">
          Payables are created automatically when a deposit is applied to an
          approved voucher.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Payables & Payments">
      {payables.length === 0 ? (
        <p className="text-muted mb-0">
          No payables yet. Applying a deposit to this voucher will create one for
          each broker, for their share of what arrived.
        </p>
      ) : (
        <Table dense className="align-middle">
          <Table.Header>
            <Table.Row>
              <Table.Head style={{ minWidth: PAYABLE_COL.payToMin }}>
                Pay To
              </Table.Head>
              <Table.Head style={{ width: PAYABLE_COL.date }}>Date</Table.Head>
              <Table.Head style={{ width: PAYABLE_COL.plan }}>
                Commission Plan
              </Table.Head>
              <Table.Head className="text-end" style={{ width: PAYABLE_COL.gross }}>
                Gross Amount
              </Table.Head>
              <Table.Head
                className="text-end"
                style={{ width: PAYABLE_COL.grossPaid }}
              >
                Gross Paid
              </Table.Head>
              <Table.Head
                className="text-end"
                style={{ width: PAYABLE_COL.netPaid }}
              >
                Net Paid
              </Table.Head>
              <Table.Head style={{ width: PAYABLE_COL.actions }} />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {payables.map((payable) => {
              const broker = brokerFor(payable);
              return (
                <Fragment key={payable.id}>
                  <Table.Row>
                    {/* Plain text, not a link. Neither an internal broker nor an
                        outside one has a contact record in this prototype — a
                        broker is on the deal, not in the address book — so there
                        is nowhere for a name to go. */}
                    <Table.Cell className="fw-semibold">
                      {broker?.name ?? "Unknown broker"}
                    </Table.Cell>
                    <Table.Cell style={{ width: PAYABLE_COL.date }}>
                      {formatDate(payable.date)}
                    </Table.Cell>
                    <Table.Cell style={{ width: PAYABLE_COL.plan }}>
                      {canSee(payable) ? (
                        <CommissionPlanCell broker={broker} />
                      ) : (
                        <PrivatePayout variant="cell" />
                      )}
                    </Table.Cell>
                    <Table.Cell
                      className="text-end"
                      style={{ width: PAYABLE_COL.gross }}
                    >
                      {formatCurrency(payable.grossAmount)}
                    </Table.Cell>
                    <Table.Cell
                      className="text-end"
                      style={{ width: PAYABLE_COL.grossPaid }}
                    >
                      {formatCurrency(payableGrossPaid(payable))}
                    </Table.Cell>
                    <Table.Cell
                      className="text-end"
                      style={{ width: PAYABLE_COL.netPaid }}
                    >
                      {canSee(payable) ? (
                        formatCurrency(payableNetPaid(payable, broker))
                      ) : (
                        <PrivatePayout variant="cell" />
                      )}
                    </Table.Cell>
                    <Table.Cell style={{ width: PAYABLE_COL.actions }}>
                      {/* Gone once the payable is settled, rather than disabled.
                          A disabled Pay on a row reading its full amount under
                          Gross Paid invites a hover to find out why; nothing
                          there says the same thing without the detour. */}
                      {!isPayableSettled(payable) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaying(payable)}
                        >
                          Pay
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                  {payable.payments.map((payment) => (
                    <PaymentRow
                      key={payment.id}
                      payment={payment}
                      broker={broker}
                      seesPayout={canSee(payable)}
                      onDelete={() => removePayment(payable, payment)}
                    />
                  ))}
                </Fragment>
              );
            })}
          </Table.Body>
          {/* A `tfoot`, like the voucher's other money tables. The three totals
              are the reason this is a table rather than a card per row: a column
              carrying a total is read downward at any row count. */}
          <Table.Footer>
            <Table.Row>
              <Table.Cell colSpan={3}>Sum</Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(grossTotal)}
              </Table.Cell>
              <Table.Cell className="text-end">
                {formatCurrency(grossPaidTotal)}
              </Table.Cell>
              <Table.Cell className="text-end">
                {seesNetTotal ? (
                  formatCurrency(netPaidTotal)
                ) : (
                  <PrivatePayout variant="cell" />
                )}
              </Table.Cell>
              <Table.Cell />
            </Table.Row>
          </Table.Footer>
        </Table>
      )}

      {/* Kept mounted with a null payable so the modal has somewhere to live;
          it renders nothing until one is chosen. `key` on the payable id resets
          its fields between rows — without it, the amount typed against one
          broker would still be sitting there when the next Pay is clicked. */}
      {paying && (
        <CreatePaymentModal
          key={paying.id}
          open
          onOpenChange={(next) => !next && setPaying(null)}
          broker={brokerFor(paying)}
          balance={payableBalance(paying)}
          onSave={pay}
        />
      )}
    </Section>
  );
}
