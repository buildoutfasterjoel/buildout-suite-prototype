import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import { buildingSectionListingId } from "#/components/deals/dealCardLink";
import { useMarketingReadiness } from "#/components/deals/useMarketingReadiness";
import {
	MARKETING_FIELD_FORM,
	MARKETING_FIELD_LABEL,
	type MarketingField,
} from "#/data/marketingReadiness";
import type { Listing } from "#/data/types";

/**
 * What the broker still has to type before this deal can produce marketing.
 *
 * Every row names the field and, when the field is not on this page, where it
 * actually is. One of the eight lives elsewhere — the lease type is per-space —
 * and listing it flat would send the broker looking through a form that does
 * not contain it.
 *
 * `useMarketingReadiness` decides who sees this, so the banner cannot disagree
 * with the sidebar rows and the route guard reading the same hook.
 */
export function MarketingReadinessBanner({ listing }: { listing: Listing }) {
	const { missing } = useMarketingReadiness(listing);
	if (missing.length === 0) return null;

	return (
		<Alert severity="warning" withIcon>
			<FontAwesomeIcon icon={faTriangleExclamation} />
			<Alert.Title>Marketing is locked</Alert.Title>
			<div className="d-flex flex-column gap-2">
				<span>
					Documents, the website, email campaigns and grids are built from the
					fields below. Fill them in and those sections unlock.
				</span>
				<ul className="mb-0 ps-4">
					{missing.map((field) => (
						<li key={field}>
							{MARKETING_FIELD_LABEL[field]}
							<FieldWhere field={field} listingId={listing.id} />
						</li>
					))}
				</ul>
			</div>
		</Alert>
	);
}

/** Where a field lives, for the one case that is not this page. */
function FieldWhere({
	field,
	listingId,
}: {
	field: MarketingField;
	listingId: string;
}) {
	if (MARKETING_FIELD_FORM[field] === "listing") return null;
	// A space's lease type is set on the space itself, and a lease deal with no
	// space yet has to add one — so both cases land on the Spaces tab rather than
	// on a `$spaceId` route this banner has no id for.
	//
	// The Spaces tab is building-level. A space never reaches this banner —
	// `marketingReadiness` reports one ready, its building owning every gated
	// section — but the id still goes through the same resolver the rest of the
	// app uses, so the rule holds without a second exemption to reason about.
	return (
		<>
			{" — on the "}
			<Link
				to="/listings/$listingId/spaces"
				params={{ listingId: buildingSectionListingId(listingId) }}
			>
				Spaces tab
			</Link>
		</>
	);
}
