import { VOUCHER_STATUS_LABELS, type VoucherStatus } from "#/data/vouchers";
import { StatusPill } from "./DealStageBadge";

/**
 * Voucher-status colours, borrowed from the deal-stage tokens so the back office
 * reads in the same palette as the pipeline: grey for not yet submitted, the
 * in-flight purple for awaiting a decision, and the closed green for approved.
 */
export const VOUCHER_STATUS_COLORS: Record<VoucherStatus, string> = {
  Draft: "var(--stage-inactive)",
  Pending: "var(--stage-under-contract)",
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
