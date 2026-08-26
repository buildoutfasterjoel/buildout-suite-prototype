import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing } from "#/data/types";
import { isVoucherPending, voucherHref } from "#/data/vouchers";

/**
 * Why the Transaction Terms group is switched off, and how to switch it back on
 * — shown while the deal's voucher is Pending.
 *
 * Renders nothing otherwise, so the page can mount it unconditionally the way
 * {@link PendingPublishBanner} does.
 *
 * Names the group it applies to, because the rest of the form stays live: a
 * broker who reads "frozen" and finds Status still moving would trust neither
 * statement.
 *
 * The button goes to the voucher to *read* it, not to undo anything — a
 * submitted voucher cannot be pulled back. It earns its place because the
 * voucher is where the state this banner describes is actually visible, and
 * nothing else on this page leads there.
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
					Transaction Terms are what is being approved, so they are frozen until
					the approver has acted on the voucher. Everything else here is still
					editable.
				</span>
				{target && (
					<Button
						variant="primary"
						size="sm"
						className="flex-shrink-0"
						nativeButton={false}
						render={<Link {...target} />}
					>
						View voucher
					</Button>
				)}
			</div>
		</Alert>
	);
}
