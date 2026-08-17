import {
	AdditionalFields,
	SubGroup,
} from "#/components/common/recordForm/FieldGroup";
import {
	Col,
	DateField,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/common/recordForm/fieldWidgets";
import type {
	LeaseRateUnits,
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

/**
 * Allowances & Fees' 4 (Moving Allowance, Buyout Allowance, Procurement Fee %,
 * Concession) plus Terms & Sale's 2 (Lease Terms, Sale Price). All
 * unconditional — see the note on `ADDITIONAL_SPACE_FIELDS`.
 */
const ADDITIONAL_LEASE_FIELDS = 4 + 2;

/**
 * Listing page — Lease Terms. What the space asks, on what structure, for how
 * long, and what the landlord gives up to get it signed.
 *
 * Emits subgroups only — `SpaceFormEditor` owns the group heading.
 */
export function SpaceLeaseTermsSection({
	terms,
	onChange,
}: {
	terms: SpaceLeaseTerms;
	onChange: (patch: Partial<SpaceLeaseTerms>) => void;
}) {
	return (
		<>
			<SubGroup
				label="Rate"
				description="What the space asks, and how that number is published."
			>
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
								onChange={(v) => onChange({ leaseRateUnitLabelOverride: v })}
							/>
						</Col>
					)}
				</FieldGrid>

				{/* The switch that suppresses the figures above it — a flag about the
				    rate, so it sits with the rate rather than in a pile of unrelated
				    switches at the foot of the form. */}
				<SwitchRow
					label="Hide rate"
					checked={terms.hideLeaseRate}
					onChange={(v) => onChange({ hideLeaseRate: v })}
				/>
			</SubGroup>

			<SubGroup
				label="Structure"
				description="The lease type, the commitment, and when the space can be taken."
			>
				<FieldGrid>
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
						<DateField
							label="Date Available"
							value={terms.dateAvailable}
							onChange={(v) => onChange({ dateAvailable: v })}
						/>
					</Col>
				</FieldGrid>

				{/* Classifies the lease itself, which is why it sits under Lease Type
				    rather than among the tenant-pays switches. */}
				<SwitchRow
					label="Net lease investment"
					checked={terms.netLeaseInvestment}
					onChange={(v) => onChange({ netLeaseInvestment: v })}
				/>
			</SubGroup>

			<SubGroup
				label="Sublease"
				description="Whether a sitting tenant is assigning the space on."
			>
				{/* Not "Sublease" — that is the cluster's name, and a switch echoing
				    its own gutter label reads as a duplicate rather than a question. */}
				<SwitchRow
					label="This is a sublease"
					checked={terms.sublease}
					onChange={(v) => onChange({ sublease: v })}
				/>
				{terms.sublease && (
					<DateField
						label="Sublease Expiration"
						value={terms.subleaseExpiration ?? null}
						onChange={(v) => onChange({ subleaseExpiration: v })}
					/>
				)}
			</SubGroup>

			<SubGroup
				label="Concessions"
				description="What the landlord gives up to get the deal signed."
			>
				<FieldGrid>
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
					<Col>
						<TextField
							label="Rent Concession"
							value={terms.rentConcession ?? ""}
							onChange={(v) => onChange({ rentConcession: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<AdditionalFields
				label={`Show ${ADDITIONAL_LEASE_FIELDS} more lease fields`}
			>
				<SubGroup
					label="Allowances & Fees"
					description="One-off money moving in either direction at signing."
				>
					<FieldGrid>
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
							<NumberField
								label="Procurement Fee %"
								value={terms.procurementFeePct}
								onChange={(v) => onChange({ procurementFeePct: v })}
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
				</SubGroup>

				<SubGroup
					label="Terms & Sale"
					description="Long-form lease language, and an asking price if the suite also sells."
				>
					<FieldGrid>
						<Col span={12}>
							<TextField
								label="Lease Terms"
								textarea
								value={terms.leaseTermsText ?? ""}
								onChange={(v) => onChange({ leaseTermsText: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Sale Price"
								value={terms.salePrice ?? null}
								onChange={(v) => onChange({ salePrice: v })}
							/>
						</Col>
					</FieldGrid>
				</SubGroup>
			</AdditionalFields>
		</>
	);
}
