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
	const isSpaceDeal = listing.parentDealId != null;
	const spaceUnit =
		isSpaceDeal && listing.unitId
			? property.units.find((u) => u.id === listing.unitId)
			: undefined;

	// Every other section on this tab is property-level. Location, Transit,
	// Property, Building, Units and Lots write straight to the shared `Property`,
	// so editing them from inside Suite 200 silently rewrites the building with
	// no indication of scope. Lease copy, Marketing Visibility, Visual Media and
	// the Disclaimer write into the child's own forked `marketing`, giving the
	// building's marketing a second editable home that quietly diverges from the
	// shell. Both are wrong for a space, whose only marketing surface is the
	// read-through Property Marketing hub. So the space's Listing tab is exactly
	// its own terms; the Deal tab still carries Setup, Transaction and Financials.
	if (isSpaceDeal) {
		return (
			<div className="d-flex flex-column gap-6">
				{spaceUnit ? (
					<Section title="Space Terms" icon={faVectorSquare}>
						<SpaceTermsSection
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
				) : (
					<p className="text-muted mb-0">
						This space is not linked to a unit on the building, so there are no
						space terms to edit.
					</p>
				)}
			</div>
		);
	}

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
					{/* Space terms belong to the space deal that owns the unit — a shell
					    or flat lease deal manages its spaces from the Spaces tab. */}
					<LeaseSection marketing={marketing} patchMarketing={patchMarketing} />
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
			{/* Unscoped here by construction: only a non-space shape reaches this
			    branch, and those own the whole library. */}
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
