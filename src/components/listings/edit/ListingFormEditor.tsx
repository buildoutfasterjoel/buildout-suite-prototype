import type {
	DealMarketing,
	DealType,
	Listing,
	Property,
	PropertyStatus,
} from "#/data/types";

/**
 * The Listing-tab body of the two-tab edit shell. A placeholder for now — the
 * marketing/visibility, property-detail, and per-space sections are added in
 * later tasks. Receives the shared working copy (marketing + property draft)
 * plus their patchers so it never owns state of its own.
 */
export function ListingFormEditor(_props: {
	listing: Listing;
	dealType: DealType;
	status: PropertyStatus;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	return (
		<div className="text-muted p-2">
			Listing form — sections added in later tasks.
		</div>
	);
}
