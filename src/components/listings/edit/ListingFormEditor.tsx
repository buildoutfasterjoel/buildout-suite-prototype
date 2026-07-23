import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { BuildingSection } from "#/components/listings/edit/sections/BuildingSection";
import { CondosSection } from "#/components/listings/edit/sections/CondosSection";
import { LandSection } from "#/components/listings/edit/sections/LandSection";
import { LocationSection } from "#/components/listings/edit/sections/LocationSection";
import { LotsSection } from "#/components/listings/edit/sections/LotsSection";
import { PropertySection } from "#/components/listings/edit/sections/PropertySection";
import { SaleSection } from "#/components/listings/edit/sections/SaleSection";
import { TransitSection } from "#/components/listings/edit/sections/TransitSection";
import { UnitsSection } from "#/components/listings/edit/sections/UnitsSection";
import { propertyTypeEffects } from "#/data/listingFormLogic";
import type {
	DealMarketing,
	DealPitchFinancials,
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
	dealType,
	marketing,
	patchMarketing,
	property,
	patchProperty,
	financials,
	patchFinancials,
}: {
	listing: Listing;
	dealType: DealType;
	status: PropertyStatus;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
	financials: DealPitchFinancials;
	patchFinancials: (p: Partial<DealPitchFinancials>) => void;
}) {
	const effects = propertyTypeEffects(property.propertyType);

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
			<Separator />
			<PropertySection property={property} patchProperty={patchProperty} />
			<Separator />
			<BuildingSection property={property} patchProperty={patchProperty} />
			<Separator />
			<UnitsSection
				property={property}
				patchProperty={patchProperty}
				marketing={marketing}
				patchMarketing={patchMarketing}
				financials={financials}
				patchFinancials={patchFinancials}
			/>
			{effects.landSections && (
				<>
					<Separator />
					<LandSection property={property} patchProperty={patchProperty} />
				</>
			)}
			{dealType === "Sale" && (
				<>
					<Separator />
					<SaleSection marketing={marketing} patchMarketing={patchMarketing} />
				</>
			)}
			<Separator />
			<LotsSection property={property} patchProperty={patchProperty} />
			<Separator />
			<CondosSection property={property} patchProperty={patchProperty} />
		</div>
	);
}
