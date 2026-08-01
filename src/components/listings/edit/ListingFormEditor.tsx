import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
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
import { SpaceTermsSection } from "#/components/listings/edit/sections/SpaceTermsSection";
import { TransitSection } from "#/components/listings/edit/sections/TransitSection";
import { UnitsSection } from "#/components/listings/edit/sections/UnitsSection";
import { VisualMediaSection } from "#/components/listings/edit/sections/VisualMediaSection";
import { DisclaimerNotesSection } from "#/components/listings/edit/sections/DisclaimerNotesSection";
import { Section } from "#/components/listings/listingWidgets";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { propertyTypeEffects, showBuyerSection } from "#/data/listingFormLogic";
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
	listing,
	dealType,
	status,
	marketing,
	patchMarketing,
	property,
	patchProperty,
	financials,
	patchFinancials,
	internalNotes,
	setInternalNotes,
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
	internalNotes: string;
	setInternalNotes: (v: string) => void;
}) {
	const effects = propertyTypeEffects(property.propertyType);

	// A space deal edits exactly one unit's terms — its own. Every other listing
	// shape manages spaces from the Spaces tab.
	const spaceUnit =
		listing.parentDealId != null && listing.unitId
			? property.units.find((u) => u.id === listing.unitId)
			: undefined;

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
			{effects.landSections && (
				<>
					<Separator />
					<LotsSection property={property} patchProperty={patchProperty} />
				</>
			)}
			{dealType === "Sale" && (
				<>
					<Separator />
					<CondosSection property={property} patchProperty={patchProperty} />
				</>
			)}
			{dealType === "Lease" && (
				<>
					<Separator />
					<LeaseSection marketing={marketing} patchMarketing={patchMarketing} />
					{/* Space terms belong to the space deal that owns the unit. A shell or
					    flat lease deal manages its spaces from the Spaces tab instead. */}
					{spaceUnit && (
						<>
							<Separator />
							<Section title="Space Terms" icon={faVectorSquare}>
								<SpaceTermsSection
									bare
									unit={spaceUnit}
									property={property}
									terms={
										marketing.spaceLeaseTerms?.[0] ?? emptySpaceLeaseTerms(spaceUnit.id)
									}
									onChange={(patch) =>
										patchMarketing({
											spaceLeaseTerms: [
												{
													...(marketing.spaceLeaseTerms?.[0] ??
														emptySpaceLeaseTerms(spaceUnit.id)),
													...patch,
												},
											],
										})
									}
								/>
							</Section>
						</>
					)}
				</>
			)}
			<Separator />
			<MarketingVisibilitySection
				dealType={dealType}
				status={status}
				marketing={marketing}
				patchMarketing={patchMarketing}
			/>
			{showBuyerSection(dealType, status) && (
				<>
					<Separator />
					<BuyerSection
						dealType={dealType}
						status={status}
						marketing={marketing}
						patchMarketing={patchMarketing}
					/>
				</>
			)}
			<Separator />
			<VisualMediaSection marketing={marketing} patchMarketing={patchMarketing} />
			<Separator />
			<DisclaimerNotesSection
				marketing={marketing}
				patchMarketing={patchMarketing}
				internalNotes={internalNotes}
				setInternalNotes={setInternalNotes}
			/>
		</div>
	);
}
