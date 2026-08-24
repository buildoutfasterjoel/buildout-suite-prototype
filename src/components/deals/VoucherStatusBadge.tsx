import { VOUCHER_STATUS_LABELS, type VoucherStatus } from "#/data/vouchers";
import { StatusPill } from "./DealStageBadge";

/**
 * Voucher-status colours: grey for not yet submitted, the warning ramp for
 * awaiting a decision, and the closed green for approved.
 *
 * Pending is the one that is not a deal-stage token. It used to borrow the
 * in-flight purple, which sat quietly among the others; a voucher waiting on an
 * approver is the status that wants chasing, so it takes the warning ramp
 * instead. That is still the pipeline's palette — Blueprint's `--bp-warning`
 * resolves to harvest-gold-500, the same hue `--stage-proposal` carries — but it
 * is referenced as *warning* rather than as a stage, because a voucher awaiting
 * approval has nothing to do with a deal being pitched.
 *
 * `--bp-warning`, not `--root-warning` or `--color-harvest-gold-500`: only the
 * `--bp-` prefixed names are actually emitted. The others read as undefined in
 * the browser and fall through to whatever fallback the call site supplies.
 */
export const VOUCHER_STATUS_COLORS: Record<VoucherStatus, string> = {
  Draft: "var(--stage-inactive)",
  Pending: "var(--bp-warning)",
  Approved: "var(--stage-closed)",
};

/**
 * Where a voucher stands, as a pill.
 *
 * Shared by the Back Office index and the voucher page itself, so a status read
 * off the list and the same status read on the record are the same colour and
 * the same word — the reason `DealStageBadge` exists for stages.
 *
 * `long` spells `Pending` out as "Pending Approval". A column of badges cannot
 * afford the longer label; a single badge beside a heading can, and there the
 * extra word is what tells you the voucher is waiting on somebody.
 */
export function VoucherStatusBadge({
  status,
  long = false,
}: {
  status: VoucherStatus;
  long?: boolean;
}) {
  return (
    <StatusPill color={VOUCHER_STATUS_COLORS[status]}>
      {long ? VOUCHER_STATUS_LABELS[status] : status}
    </StatusPill>
  );
}
