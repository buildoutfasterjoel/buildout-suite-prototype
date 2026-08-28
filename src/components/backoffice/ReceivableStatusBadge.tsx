import type { ReceivableStatus } from "#/data/receivables";
import { RECEIVABLE_STATUS_COLORS } from "#/data/receivables";

/**
 * Where a receivable stands with collections, as a solid pill.
 *
 * Not `StatusPill`, which the voucher and stage badges use: that pill is a tinted
 * chip with a coloured dot, tuned to sit quietly in a column of mostly-neutral
 * cells. This column is the opposite — it is the reason the page exists, and a
 * red Overdue has to carry across a dense table and agree at a glance with the
 * red band in the chart above it. So the colour is the fill.
 *
 * The colours come from `RECEIVABLE_STATUS_COLORS`, which the chart's series read
 * too, so a badge and its bar can never disagree about which red is Overdue.
 */
export function ReceivableStatusBadge({ status }: { status: ReceivableStatus }) {
  return (
    <span
      className="d-inline-block rounded text-white fw-semibold fs-small text-nowrap px-2 py-1"
      style={{ backgroundColor: RECEIVABLE_STATUS_COLORS[status], lineHeight: 1.2 }}
    >
      {status}
    </span>
  );
}
