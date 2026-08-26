import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing } from "#/data/types";
import { isVoucherPending, voucherHref } from "#/data/vouchers";

/**
 * Why every field on the Deal edit form is switched off, and how to switch them
 * back on — shown while the deal's voucher is Pending.
 *
 * Renders nothing otherwise, so the page can mount it unconditionally the way
 * {@link PendingPublishBanner} does.
 *
 * The button is the load-bearing half. A disabled form with no explanation is a
 * dead end; the lock is undone from the voucher, one page away, and a broker who
 * came here from the deal header has no reason to guess that.
 */
export function VoucherLockBanner({ listing }: { listing: Listing }) {
	if (!isVoucherPending(listing)) return null;
	// Non-null whenever `isVoucherPending` is true — it asks `voucherHref` the
	// same question — but the checker cannot carry that across the two calls.
	const target = voucherHref(listing);

	return (
		<Alert severity="warning" withIcon>
			{/* `withIcon` only reserves the gutter — the icon must be a direct child. */}
			<FontAwesomeIcon icon={faLock} />
			<Alert.Title>This deal's voucher is with an approver</Alert.Title>
			<div className="d-flex align-items-center justify-content-between gap-3">
				<span>
					The terms below are what is being approved, so they are frozen until
					the voucher comes back. Pull it to Draft to edit them.
				</span>
				{target && (
					<Button
						variant="primary"
						size="sm"
						className="flex-shrink-0"
						nativeButton={false}
						render={<Link {...target} />}
					>
						Go to voucher
					</Button>
				)}
			</div>
		</Alert>
	);
}
