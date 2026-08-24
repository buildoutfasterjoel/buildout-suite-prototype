import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/pro-duotone-svg-icons";
import { formatLongDate } from "#/components/deals/dealDisplay";
import { findTeammate } from "#/data/teammates";
import type { DealFinancials } from "#/data/types";

/**
 * Who signed this voucher off, and when — shown under the voucher header once
 * it is approved.
 *
 * Renders nothing for a Draft or Pending voucher, so the page can mount it
 * unconditionally the way `PendingPublishBanner` does. The status pill in the
 * header stays either way: the pill is the vocabulary the Back Office list
 * shares, and this only adds the detail a list column has no room for.
 *
 * No `Alert.Title`. The title would read "Approved", which is the word already
 * sitting in the pill a few pixels above it, and the voucher page is a long
 * stack of section headings that a third competing line does not help.
 */
export function VoucherApprovalBanner({
  voucher,
}: {
  voucher: DealFinancials;
}) {
  const { approval } = voucher;
  if (voucher.status !== "Approved" || !approval) return null;

  // A reviewer who has left the roster still approved the voucher — the date
  // and the fact of the sign-off are the parts worth keeping on screen.
  const reviewer = findTeammate(approval.reviewerId);

  return (
    <Alert severity="success" withIcon>
      {/* The icon stays a direct child — the theme absolutely positions it via
          `.alert-icon > svg`. */}
      <FontAwesomeIcon icon={faCircleCheck} />
      Approved by {reviewer?.name ?? "a former reviewer"} on{" "}
      {formatLongDate(approval.approvedOn)}
    </Alert>
  );
}
