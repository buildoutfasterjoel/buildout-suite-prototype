import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import {
	Col,
	ComboField,
	DateField,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
	YesNoNaField,
} from "#/components/listings/edit/fieldWidgets";
import { ALL_SUBTYPES } from "#/components/listings/edit/sections/PropertySection";
import { isResidentialSubtype } from "#/data/leaseEligibility";
import type {
	LeaseRateUnits,
	Property,
	PropertyUnit,
	SpaceLeaseTerms,
	SpaceLeaseType,
} from "#/data/types";

// ── Option lists (string unions from the data model) ────────────────────────
const LEASE_RATE_UNITS: LeaseRateUnits[] = ["SF/Yr", "SF/Mo", "Monthly"];
const LEASE_TYPES: SpaceLeaseType[] = [
	"Gross",
	"Modified Gross",
	"NNN",
	"Modified Net",
	"Full Service",
	"Ground Lease",
];
const LEASE_RATE_MODES = ["Flat", "Range", "Hidden"] as const;
const SPACE_SIZE_UNITS = ["SF", "RSF", "SqM"] as const;
/**
 * Space Type offers the commercial subtypes only. A space that reaches this
 * editor is a leased space, and housing is a property-management assignment
 * rather than a lease — so the residential subtypes would never be a valid
 * answer here, even inside a mixed-use building whose apartments sit upstairs.
 */
const COMMERCIAL_SUBTYPES = ALL_SUBTYPES.filter((s) => !isResidentialSubtype(s));

/**
 * A single space's lease terms editor. Renders the fields only — the caller
 * supplies its own frame; today that's `SpaceDetails`, the space deal's own
 * Details page, which is now this component's only caller.
 *
 * Size is passed separately from `terms` because it does not live on the terms
 * row: a space's size is `marketing.availableSqFt` on its own deal, which is what
 * the publish gate and every display surface read. Keeping it out of
 * `SpaceLeaseTerms` is what stops a second, unread copy existing.
 */
export function SpaceTermsSection({
	unit,
	property,
	terms,
	onChange,
	availableSqFt,
	onAvailableSqFtChange,
}: {
	unit: PropertyUnit;
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
			{/* Availability is the space deal's stage — see spaceAvailability() — not a field. */}
			<p className="form-text mb-0">
				Availability follows this space&apos;s deal stage.
			</p>

			{/* ── Space type & tenant ── */}
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
				<Col>
					<TextField
						label="Space Type Label Override"
						value={terms.spaceTypeLabelOverride ?? ""}
						onChange={(v) => onChange({ spaceTypeLabelOverride: v })}
					/>
				</Col>
			</FieldGrid>

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

			{/* ── Location within the property ── */}
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

			{/* ── Lease rate ── */}
			<FieldGrid>
				<Col>
					<NumberField
						label="Lease Rate"
						value={terms.leaseRate}
						onChange={(v) => onChange({ leaseRate: v })}
					/>
				</Col>
				<Col>
					<SelectField
						label="Rate Units"
						value={terms.leaseRateUnits}
						options={LEASE_RATE_UNITS}
						onChange={(v) => onChange({ leaseRateUnits: v })}
					/>
				</Col>
				<Col>
					<SelectField
						label="Rate Mode"
						value={terms.leaseRateMode ?? "Flat"}
						options={LEASE_RATE_MODES}
						onChange={(v) => onChange({ leaseRateMode: v })}
					/>
				</Col>
				{terms.leaseRateMode === "Range" && (
					<Col>
						<NumberField
							label="Rate To"
							value={terms.leaseRateTo ?? null}
							onChange={(v) => onChange({ leaseRateTo: v })}
						/>
					</Col>
				)}
				{terms.leaseRateMode === "Hidden" && (
					<Col>
						<TextField
							label="Rate Unit Label Override"
							value={terms.leaseRateUnitLabelOverride ?? ""}
							onChange={(v) =>
								onChange({ leaseRateUnitLabelOverride: v })
							}
						/>
					</Col>
				)}
			</FieldGrid>

			{/* ── Size / type / dimensions ── */}
			<FieldGrid>
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
				<Col>
					<SelectField
						label="Lease Type"
						value={terms.leaseType}
						options={LEASE_TYPES}
						onChange={(v) => onChange({ leaseType: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="Lease Type Label Override"
						value={terms.leaseTypeLabelOverride ?? ""}
						onChange={(v) => onChange({ leaseTypeLabelOverride: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Term (months)"
						value={terms.leaseTermMonths}
						onChange={(v) => onChange({ leaseTermMonths: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Ceiling Height"
						value={terms.ceilingHeight ?? null}
						onChange={(v) => onChange({ ceilingHeight: v })}
					/>
				</Col>
			</FieldGrid>

			{/* ── Availability / concessions ── */}
			<FieldGrid>
				<Col>
					<DateField
						label="Date Available"
						value={terms.dateAvailable}
						onChange={(v) => onChange({ dateAvailable: v })}
					/>
				</Col>
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
				<Col>
					<NumberField
						label="TI Allowance ($/SF)"
						value={terms.tiAllowance}
						onChange={(v) => onChange({ tiAllowance: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Free Rent (months)"
						value={terms.freeRentMonths}
						onChange={(v) => onChange({ freeRentMonths: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="Rent Escalators"
						value={terms.rentEscalators ?? ""}
						onChange={(v) => onChange({ rentEscalators: v || null })}
					/>
				</Col>
			</FieldGrid>

			{/* ── Sublease ── */}
			<SwitchRow
				label="Sublease"
				checked={terms.sublease}
				onChange={(v) => onChange({ sublease: v })}
			/>
			{terms.sublease && (
				<div style={{ maxWidth: 360 }}>
					<DateField
						label="Sublease Expiration"
						value={terms.subleaseExpiration ?? null}
						onChange={(v) => onChange({ subleaseExpiration: v })}
					/>
				</div>
			)}

			{/* ── Description ── */}
			<TextField
				label="Description"
				textarea
				value={terms.description ?? ""}
				onChange={(v) => onChange({ description: v || null })}
			/>

			{/* ── Flags ── */}
			<div className="d-flex flex-column gap-1">
				<SwitchRow
					label="Hide rate"
					checked={terms.hideLeaseRate}
					onChange={(v) => onChange({ hideLeaseRate: v })}
				/>
				<SwitchRow
					label="Signage available"
					checked={terms.signageAvailable}
					onChange={(v) => onChange({ signageAvailable: v })}
				/>
				<SwitchRow
					label="Net lease investment"
					checked={terms.netLeaseInvestment}
					onChange={(v) => onChange({ netLeaseInvestment: v })}
				/>
				<SwitchRow
					label="Tenants pay gas"
					checked={terms.tenantsPayGas}
					onChange={(v) => onChange({ tenantsPayGas: v })}
				/>
				<SwitchRow
					label="Tenants pay electric"
					checked={terms.tenantsPayElectric}
					onChange={(v) => onChange({ tenantsPayElectric: v })}
				/>
				<SwitchRow
					label="Tenants pay water"
					checked={terms.tenantsPayWater}
					onChange={(v) => onChange({ tenantsPayWater: v })}
				/>
			</div>

			{/* ── Industrial cluster (industrial properties only) ── */}
			{isIndustrial && (
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
			)}

			{/* ── Additional fields ── */}
			<Accordion variant="inline">
				<Accordion.Item value={`${unit.id}-more`}>
					<Accordion.Trigger>
						<span className="fw-semibold">
							Show/Hide Additional Fields
						</span>
					</Accordion.Trigger>
					<Accordion.Content>
						<div className="d-flex flex-column gap-3">
							<FieldGrid>
								<Col>
									<NumberField
										label="Sale Price"
										value={terms.salePrice ?? null}
										onChange={(v) => onChange({ salePrice: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Warehouse Allotment %"
										value={terms.warehouseAllotmentPct ?? null}
										onChange={(v) =>
											onChange({ warehouseAllotmentPct: v })
										}
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
							</FieldGrid>

							<SwitchRow
								label="Furnished"
								checked={terms.furnished ?? false}
								onChange={(v) => onChange({ furnished: v })}
							/>

							{/* Heating / cooling / lighting — Y/N/NA + description */}
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
										onChange={(v) =>
											onChange({ heatingDescription: v })
										}
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
										onChange={(v) =>
											onChange({ coolingDescription: v })
										}
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
										onChange={(v) =>
											onChange({ lightingDescription: v })
										}
									/>
								</Col>
							</FieldGrid>

							<TextField
								label="Rent Concession"
								value={terms.rentConcession ?? ""}
								onChange={(v) => onChange({ rentConcession: v })}
							/>
							<TextField
								label="Lease Terms"
								textarea
								value={terms.leaseTermsText ?? ""}
								onChange={(v) => onChange({ leaseTermsText: v })}
							/>

							{/* Tax / CAM / insurance / fee long-tail */}
							<FieldGrid>
								<Col>
									<NumberField
										label="Tax ($/SF)"
										value={terms.taxPerSf}
										onChange={(v) => onChange({ taxPerSf: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Tax Stops"
										value={terms.taxStops ?? ""}
										onChange={(v) => onChange({ taxStops: v || null })}
									/>
								</Col>
								<Col>
									<NumberField
										label="CAM ($/SF)"
										value={terms.camPerSf}
										onChange={(v) => onChange({ camPerSf: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="CAM Stops"
										value={terms.camStops ?? ""}
										onChange={(v) => onChange({ camStops: v || null })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Insurance ($/SF)"
										value={terms.insurancePerSf}
										onChange={(v) => onChange({ insurancePerSf: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Expense Stops"
										value={terms.expenseStops ?? ""}
										onChange={(v) =>
											onChange({ expenseStops: v || null })
										}
									/>
								</Col>
								<Col>
									<NumberField
										label="Procurement Fee %"
										value={terms.procurementFeePct}
										onChange={(v) => onChange({ procurementFeePct: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Moving Allowance ($)"
										value={terms.movingAllowance}
										onChange={(v) => onChange({ movingAllowance: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Buyout Allowance ($)"
										value={terms.buyoutAllowance}
										onChange={(v) => onChange({ buyoutAllowance: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Concession"
										value={terms.concession ?? ""}
										onChange={(v) => onChange({ concession: v || null })}
									/>
								</Col>
							</FieldGrid>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		</>
	);
}
