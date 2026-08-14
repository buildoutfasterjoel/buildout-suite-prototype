import { FieldGroup } from "#/components/listings/edit/FieldGroup";
import type { ListingGroupId } from "#/components/listings/edit/listingFormGroups";
import { visibleListingGroups } from "#/components/listings/edit/listingFormGroups";
import { BuildingSection } from "#/components/listings/edit/sections/BuildingSection";
import { BuyerSection } from "#/components/listings/edit/sections/BuyerSection";
import { CondosSection } from "#/components/listings/edit/sections/CondosSection";
import { LandSection } from "#/components/listings/edit/sections/LandSection";
import { LeaseSection } from "#/components/listings/edit/sections/LeaseSection";
import { LocationSection } from "#/components/listings/edit/sections/LocationSection";
import { LotsSection } from "#/components/listings/edit/sections/LotsSection";
import { MarketingVisibilitySection } from "#/components/listings/edit/sections/MarketingVisibilitySection";
import { PropertySection } from "#/components/listings/edit/sections/PropertySection";
import { SaleSection } from "#/components/listings/edit/sections/SaleSection";
import { UnitsSection } from "#/components/listings/edit/sections/UnitsSection";
import { DisclaimerNotesSection } from "#/components/listings/edit/sections/DisclaimerNotesSection";
import { propertyTypeEffects, showBuyerSection } from "#/data/listingFormLogic";
import type {
	DealMarketing,
	DealType,
	Property,
	PropertyStatus,
	RentRollRow,
} from "#/data/types";

/**
 * The Listing page's form body: every section, from Location through
 * Disclaimer & Notes. Receives the shared working copy (marketing +
 * property draft, plus the rent roll narrowed out of `financials` — see
 * savePatches.ts) and their patchers, so it never owns state of its own.
 */
export function ListingFormEditor({
	dealType,
	status,
	marketing,
	patchMarketing,
	property,
	patchProperty,
	rentRoll,
	setRentRoll,
	internalNotes,
	setInternalNotes,
}: {
	dealType: DealType;
	status: PropertyStatus;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
	rentRoll: RentRollRow[];
	setRentRoll: (v: RentRollRow[]) => void;
	internalNotes: string;
	setInternalNotes: (v: string) => void;
}) {
	const effects = propertyTypeEffects(property.propertyType);
	const groups = visibleListingGroups({
		dealType,
		propertyType: property.propertyType,
	});
	const groupById = (id: ListingGroupId) => groups.find((g) => g.id === id);

	const location = groupById("location");
	const asset = groupById("asset");
	const units = groupById("units");
	const lots = groupById("lots");
	const condos = groupById("condos");
	const marketingGroup = groupById("marketing"); // not `marketing` — that prop is the draft
	const notes = groupById("notes");

	return (
		<div className="listing-form">
			{location && (
				<FieldGroup title={location.label} icon={location.icon}>
					<LocationSection
						property={property}
						patchProperty={patchProperty}
						marketing={marketing}
						patchMarketing={patchMarketing}
					/>
				</FieldGroup>
			)}

			{asset && (
				<FieldGroup title={asset.label} icon={asset.icon}>
					<PropertySection property={property} patchProperty={patchProperty} />
					<BuildingSection property={property} patchProperty={patchProperty} />
					{effects.landSections && (
						<LandSection property={property} patchProperty={patchProperty} />
					)}
				</FieldGroup>
			)}

			{units && (
				<FieldGroup title={units.label} icon={units.icon}>
					<UnitsSection
						property={property}
						patchProperty={patchProperty}
						marketing={marketing}
						patchMarketing={patchMarketing}
						rentRoll={rentRoll}
						setRentRoll={setRentRoll}
					/>
				</FieldGroup>
			)}

			{lots && (
				<FieldGroup title={lots.label} icon={lots.icon}>
					<LotsSection property={property} patchProperty={patchProperty} />
				</FieldGroup>
			)}

			{condos && (
				<FieldGroup title={condos.label} icon={condos.icon}>
					<CondosSection property={property} patchProperty={patchProperty} />
				</FieldGroup>
			)}

			{marketingGroup && (
				<FieldGroup title={marketingGroup.label} icon={marketingGroup.icon}>
					{dealType === "Sale" ? (
						<SaleSection marketing={marketing} patchMarketing={patchMarketing} />
					) : (
						// Space terms belong to the space deal that owns the unit — a
						// shell or flat lease deal manages its spaces from the Spaces tab.
						<LeaseSection marketing={marketing} patchMarketing={patchMarketing} />
					)}
					<MarketingVisibilitySection
						dealType={dealType}
						status={status}
						marketing={marketing}
						patchMarketing={patchMarketing}
					/>
					{showBuyerSection(dealType, status) && (
						<BuyerSection
							dealType={dealType}
							status={status}
							marketing={marketing}
							patchMarketing={patchMarketing}
						/>
					)}
				</FieldGroup>
			)}

			{notes && (
				<FieldGroup title={notes.label} icon={notes.icon}>
					<DisclaimerNotesSection
						marketing={marketing}
						patchMarketing={patchMarketing}
						internalNotes={internalNotes}
						setInternalNotes={setInternalNotes}
					/>
				</FieldGroup>
			)}
		</div>
	);
}
