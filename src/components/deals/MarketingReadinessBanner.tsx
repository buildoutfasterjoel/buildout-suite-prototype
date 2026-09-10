import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
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
 *
 * Shown on two surfaces, because a deal can be created four ways and only one
 * of them passes through the Listing form: the form itself, and the Overview,
 * which is where every creation path lands — the wizard, Otto's `createDeal`
 * tool, and a contact record's "Start a Deal". Three of those four also attach
 * the AI document set, so without the Overview copy a broker is handed
 * documents they were never told are waiting on anything.
 */
export function MarketingReadinessBanner({
	listing,
	onListingForm = false,
}: {
	listing: Listing;
	/**
	 * True when this renders on the Listing form, where the fields the banner
	 * names are on the page below it. The Overview has no fields, so it gets the
	 * way there instead.
	 */
	onListingForm?: boolean;
}) {
	const { missing } = useMarketingReadiness(listing);
	if (missing.length === 0) return null;

	return (
		<Alert severity="warning" withIcon>
			<FontAwesomeIcon icon={faTriangleExclamation} />
			<Alert.Title>Marketing is locked</Alert.Title>
			<div className="d-flex flex-column align-items-start gap-2">
				<span>
					Documents, the website, email campaigns and grids are built from{" "}
					{onListingForm ? "the fields below" : "the listing content"}. Anything
					Buildout drafted for this deal waits until these are filled in:
				</span>
				<ul className="mb-0 ps-4">
					{missing.map((field) => (
						<li key={field}>
							{MARKETING_FIELD_LABEL[field]}
							<FieldWhere field={field} listingId={listing.id} />
						</li>
					))}
				</ul>
				{!onListingForm && (
					<Button
						variant="primary"
						size="sm"
						nativeButton={false}
						render={
							<Link
								to="/listings/$listingId/listing"
								params={{ listingId: buildingSectionListingId(listing.id) }}
							/>
						}
					>
						Complete listing fields
					</Button>
				)}
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
