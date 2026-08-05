import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRocketLaunch } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing } from "#/data/types";
import {
	requestSetupCompletion,
	requestStageChange,
	useStageGate,
} from "#/components/deals/useStageGate";

/**
 * Shown on both edit pages after the broker steps out of the publish review to
 * make changes: the way back into the gate. Renders nothing otherwise, so a page
 * can mount it unconditionally.
 */
export function PendingPublishBanner({ listing }: { listing: Listing }) {
	const pendingPublishDealId = useStageGate((s) => s.pendingPublishDealId);
	if (pendingPublishDealId !== listing.id) return null;
	return (
		<Alert severity="info" withIcon>
			{/* `withIcon` only reserves the gutter — the icon must be a direct child. */}
			<FontAwesomeIcon icon={faRocketLaunch} />
			<Alert.Title>Finish up, then publish</Alert.Title>
			<div className="d-flex align-items-center justify-content-between gap-3">
				<span>
					You stepped out of the publish review to make changes. Save them, then
					head back to publish.
				</span>
				<Button
					variant="primary"
					size="sm"
					className="flex-shrink-0"
					onClick={() =>
						listing.status === "proposal"
							? requestStageChange(listing.id, "active")
							: requestSetupCompletion(listing.id)
					}
				>
					Review &amp; publish
				</Button>
			</div>
		</Alert>
	);
}
