import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
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
import { TransitSection } from "#/components/listings/edit/sections/TransitSection";
import { UnitsSection } from "#/components/listings/edit/sections/UnitsSection";
import { VisualMediaSection } from "#/components/listings/edit/sections/VisualMediaSection";
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
 * The Listing page's form body: every section, from Location and Transit
 * through Disclaimer & Notes. Receives the shared working copy (marketing +
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
				rentRoll={rentRoll}
				setRentRoll={setRentRoll}
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
