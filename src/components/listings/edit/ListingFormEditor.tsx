import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { LocationSection } from "#/components/listings/edit/sections/LocationSection";
import { TransitSection } from "#/components/listings/edit/sections/TransitSection";
import type {
	DealMarketing,
	DealType,
	Listing,
	Property,
	PropertyStatus,
} from "#/data/types";

/**
 * The Listing-tab body of the two-tab edit shell. Renders the Listing-tab
 * sections (Location, Transit, and more added in later tasks). Receives the
 * shared working copy (marketing + property draft) plus their patchers so it
 * never owns state of its own.
 */
export function ListingFormEditor({
	marketing,
	patchMarketing,
	property,
	patchProperty,
}: {
	listing: Listing;
	dealType: DealType;
	status: PropertyStatus;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	return (
		<div className="d-flex flex-column gap-6">
			<LocationSection
				property={property}
				patchProperty={patchProperty}
				marketing={marketing}
				patchMarketing={patchMarketing}
			/>
			<Separator />
			<TransitSection />
		</div>
	);
}
