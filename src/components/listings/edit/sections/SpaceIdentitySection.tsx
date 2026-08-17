import {
	AdditionalFields,
	SubGroup,
} from "#/components/common/recordForm/FieldGroup";
import {
	Col,
	ComboField,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
	YesNoNaField,
} from "#/components/common/recordForm/fieldWidgets";
import { ALL_SUBTYPES } from "#/components/listings/edit/sections/PropertySection";
import { isResidentialSubtype } from "#/data/leaseEligibility";
import type { Property, SpaceLeaseTerms } from "#/data/types";

const SPACE_SIZE_UNITS = ["SF", "RSF", "SqM"] as const;

/**
 * Space Type offers the commercial subtypes only. A space that reaches this
 * editor is a leased space, and housing is a property-management assignment
 * rather than a lease — so the residential subtypes would never be a valid
 * answer here, even inside a mixed-use building whose apartments sit upstairs.
 */
const COMMERCIAL_SUBTYPES = ALL_SUBTYPES.filter(
	(s) => !isResidentialSubtype(s),
);

/**
 * Fit-Out's 8 (Ceiling Height, Parking Spaces, Conference Rooms, Offices, HVAC
 * Tonnage, Warehouse Allotment %, Furnished, Signage available) plus Systems'
 * 6 (heating / cooling / lighting, each with its description). Every one is
 * unconditional, so this is a constant rather than the derived count
 * `LocationSection` needs — but it lives here, beside the fields, so a field
 * added to either cluster is added next to the number that names it.
 */
const ADDITIONAL_SPACE_FIELDS = 8 + 6;

/**
 * Listing page — The Space. What the suite is, who is in it, how big it is, and
 * the build-out detail a tenant asks about on a tour.
 *
 * Size is passed separately from `terms` because it does not live on the terms
 * row: a space's size is `marketing.availableSqFt` on its own deal, which is
 * what the publish gate and every display surface read. Keeping it out of
 * `SpaceLeaseTerms` is what stops a second, unread copy existing — a `spaceSize`
 * field on the row was removed in `553282a` precisely because nothing read it.
 *
 * Emits subgroups only — `SpaceFormEditor` owns the group heading.
 */
export function SpaceIdentitySection({
	property,
	terms,
	onChange,
	availableSqFt,
	onAvailableSqFtChange,
}: {
	property: Property;
	terms: SpaceLeaseTerms;
	onChange: (patch: Partial<SpaceLeaseTerms>) => void;
	/** The space's size, from `marketing.availableSqFt` on its deal. */
	availableSqFt: number | null;
	onAvailableSqFtChange: (value: number | null) => void;
}) {
	const isIndustrial = property.propertyType === "industrial";
	// Multi-tenant properties require a per-space suite/address (visual hint only).
	const addressRequired = property.tenancy !== "Single";

	return (
		<>
			<SubGroup
				label="Identity"
				description="What this suite is called, and where it sits in the building."
			>
				<FieldGrid>
					<Col>
						<TextField
							label="Space Name"
							value={terms.spaceName ?? ""}
							onChange={(v) => onChange({ spaceName: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Suite / Address"
							required={addressRequired}
							value={terms.suite ?? ""}
							onChange={(v) => onChange({ suite: v })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Floor"
							value={terms.floor ?? null}
							onChange={(v) => onChange({ floor: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Zip+4"
							value={terms.zipPlus4 ?? ""}
							onChange={(v) => onChange({ zipPlus4: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup
				label="Tenant"
				description="Who occupies the space, when that is worth naming publicly."
			>
				{/* Bound tier: the name only matters once the switch says this tenant
				    is one worth advertising. */}
				<SwitchRow
					label="Major tenant"
					checked={terms.majorTenant ?? false}
					onChange={(v) => onChange({ majorTenant: v })}
				/>
				<TextField
					label="Tenant Name"
					required={terms.majorTenant ?? false}
					value={terms.tenantName ?? ""}
					onChange={(v) => onChange({ tenantName: v })}
				/>
			</SubGroup>

			<SubGroup
				label="Type & Size"
				description="How the space is classified, and how much of it there is."
			>
				<FieldGrid>
					<Col>
						<ComboField
							label="Space Type"
							value={terms.spaceType ?? null}
							options={COMMERCIAL_SUBTYPES}
							placeholder="Search space types…"
							onChange={(v) => onChange({ spaceType: v })}
						/>
					</Col>
					{/* "Type Label", not "Space Type Label Override": at 25 characters
					    that wrapped to two lines in the 164px gutter, which is the one
					    thing a fixed label column cannot absorb — every field in the
					    row grows to match it. The words it drops are the ones the
					    gutter already supplies: it sits immediately right of Space
					    Type, inside a cluster named Type & Size, so "Space" and the
					    override semantics are both readable from position. */}
					<Col>
						<TextField
							label="Type Label"
							value={terms.spaceTypeLabelOverride ?? ""}
							onChange={(v) => onChange({ spaceTypeLabelOverride: v })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Space Size"
							value={availableSqFt}
							onChange={onAvailableSqFtChange}
						/>
					</Col>
					<Col>
						<SelectField
							label="Size Units"
							value={
								(terms.spaceSizeUnits as (typeof SPACE_SIZE_UNITS)[number]) ??
								"SF"
							}
							options={SPACE_SIZE_UNITS}
							onChange={(v) => onChange({ spaceSizeUnits: v })}
						/>
					</Col>
					{/* Divisibility is a fact about the area, not a lease concession —
					    it answers "how much of this can I take", so it sits with the
					    size it qualifies rather than with the rate. */}
					<Col>
						<NumberField
							label="Min Divisible (SF)"
							value={terms.minDivisibleSqFt}
							onChange={(v) => onChange({ minDivisibleSqFt: v })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Max Contiguous (SF)"
							value={terms.maxContiguousSqFt}
							onChange={(v) => onChange({ maxContiguousSqFt: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup
				label="Description"
				description="The marketing copy for this suite, as it syndicates."
			>
				<FieldGrid>
					<Col span={12}>
						<TextField
							label="Description"
							textarea
							value={terms.description ?? ""}
							onChange={(v) => onChange({ description: v || null })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			{isIndustrial && (
				<SubGroup
					label="Industrial"
					description="Loading, power, and prior use — what an industrial tenant screens on first."
				>
					<FieldGrid>
						<Col>
							<TextField
								label="Previous Usage"
								value={terms.previousUsage ?? ""}
								onChange={(v) => onChange({ previousUsage: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Office Space (SF)"
								value={terms.officeSpace ?? null}
								onChange={(v) => onChange({ officeSpace: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Grade Level Doors"
								value={terms.gradeLevelDoors ?? null}
								onChange={(v) => onChange({ gradeLevelDoors: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Dock High Doors"
								value={terms.dockHighDoors ?? null}
								onChange={(v) => onChange({ dockHighDoors: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Drive-In Bays"
								value={terms.driveInBays ?? null}
								onChange={(v) => onChange({ driveInBays: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Number of Cranes"
								value={terms.numberOfCranes ?? null}
								onChange={(v) => onChange({ numberOfCranes: v })}
							/>
						</Col>
						<Col>
							<TextField
								label="Power Description"
								value={terms.powerDescription ?? ""}
								onChange={(v) => onChange({ powerDescription: v })}
							/>
						</Col>
					</FieldGrid>
				</SubGroup>
			)}

			<AdditionalFields
				label={`Show ${ADDITIONAL_SPACE_FIELDS} more space fields`}
			>
				<SubGroup
					label="Fit-Out"
					description="What is already built into the space, and what comes with it."
				>
					<FieldGrid>
						<Col>
							<NumberField
								label="Ceiling Height"
								value={terms.ceilingHeight ?? null}
								onChange={(v) => onChange({ ceilingHeight: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Parking Spaces"
								value={terms.parkingSpaces ?? null}
								onChange={(v) => onChange({ parkingSpaces: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Conference Rooms"
								value={terms.conferenceRooms ?? null}
								onChange={(v) => onChange({ conferenceRooms: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Offices"
								value={terms.offices ?? null}
								onChange={(v) => onChange({ offices: v })}
							/>
						</Col>
						<Col>
							<TextField
								label="HVAC Tonnage"
								value={terms.hvacTonnage ?? ""}
								onChange={(v) => onChange({ hvacTonnage: v })}
							/>
						</Col>
						{/* The warehouse share of the floor plate — a physical split of
						    the area, so it belongs beside Office Space (SF) rather than
						    in the lease tail where it used to sit. */}
						<Col>
							<NumberField
								label="Warehouse Allotment %"
								value={terms.warehouseAllotmentPct ?? null}
								onChange={(v) => onChange({ warehouseAllotmentPct: v })}
							/>
						</Col>
					</FieldGrid>

					<SwitchRow
						label="Furnished"
						checked={terms.furnished ?? false}
						onChange={(v) => onChange({ furnished: v })}
					/>
					<SwitchRow
						label="Signage available"
						checked={terms.signageAvailable}
						onChange={(v) => onChange({ signageAvailable: v })}
					/>
				</SubGroup>

				<SubGroup
					label="Systems"
					description="Heating, cooling, and lighting — present or not, and how."
				>
					<FieldGrid>
						<Col>
							<YesNoNaField
								label="Heating"
								value={terms.heating}
								onChange={(v) => onChange({ heating: v })}
							/>
						</Col>
						<Col>
							<TextField
								label="Heating Description"
								value={terms.heatingDescription ?? ""}
								onChange={(v) => onChange({ heatingDescription: v })}
							/>
						</Col>
						<Col>
							<YesNoNaField
								label="Cooling"
								value={terms.cooling}
								onChange={(v) => onChange({ cooling: v })}
							/>
						</Col>
						<Col>
							<TextField
								label="Cooling Description"
								value={terms.coolingDescription ?? ""}
								onChange={(v) => onChange({ coolingDescription: v })}
							/>
						</Col>
						<Col>
							<YesNoNaField
								label="Lighting"
								value={terms.lighting}
								onChange={(v) => onChange({ lighting: v })}
							/>
						</Col>
						<Col>
							<TextField
								label="Lighting Description"
								value={terms.lightingDescription ?? ""}
								onChange={(v) => onChange({ lightingDescription: v })}
							/>
						</Col>
					</FieldGrid>
				</SubGroup>
			</AdditionalFields>
		</>
	);
}
