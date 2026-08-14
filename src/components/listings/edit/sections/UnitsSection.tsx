import {
	type Column,
	EditableTable,
} from "#/components/common/recordForm/EditableTable";
import { SubGroup } from "#/components/common/recordForm/FieldGroup";
import {
	Col,
	FieldGrid,
	NumberField,
	SwitchRow,
} from "#/components/common/recordForm/fieldWidgets";
import { emptyUnitMixRow } from "#/data/createListing";
import { autoFillRentRow } from "#/data/listingFinancials";
import { propertyTypeEffects } from "#/data/listingFormLogic";
import type {
	DealMarketing,
	Property,
	PropertyType,
	RentRollRow,
	UnitMixRow,
} from "#/data/types";

/** The Unit Mix columns to render for a given primary property type (PRD §18). */
function columnsFor(type: PropertyType): Column<UnitMixRow>[] {
	if (type === "multifamily") {
		return [
			{ key: "unitType", label: "Unit Type", kind: "text" },
			{ key: "bedrooms", label: "Bedrooms", kind: "number" },
			{ key: "bathrooms", label: "Bathrooms", kind: "number" },
			{ key: "count", label: "Count", kind: "number" },
			{ key: "size", label: "Size", kind: "number" },
			{ key: "rent", label: "Rent", kind: "number" },
			{ key: "minRent", label: "Min Rent", kind: "number" },
			{ key: "maxRent", label: "Max Rent", kind: "number" },
			{ key: "marketRent", label: "Market Rent", kind: "number" },
			{ key: "securityDeposit", label: "Security Deposit", kind: "number" },
		];
	}
	if (type === "hospitality") {
		return [
			{ key: "unitType", label: "Room Type", kind: "text" },
			{ key: "count", label: "Count", kind: "number" },
			{ key: "size", label: "Size", kind: "number" },
			{ key: "rackRate", label: "Rack Rate", kind: "number" },
			{ key: "description", label: "Description", kind: "text" },
		];
	}
	return [
		{ key: "unitType", label: "Unit Type", kind: "text" },
		{ key: "count", label: "Count", kind: "number" },
		{ key: "size", label: "Size", kind: "number" },
		{ key: "rent", label: "Rent", kind: "number" },
		{ key: "marketRent", label: "Market Rent", kind: "number" },
	];
}

const RENT_ROLL_COLUMNS: Column<RentRollRow>[] = [
	{ key: "suite", label: "Suite", kind: "text" },
	{ key: "tenant", label: "Tenant", kind: "text" },
	{ key: "size", label: "Size (SF)", kind: "number" },
	{ key: "rentPerSf", label: "Rent / SF", kind: "number" },
	{ key: "annualRent", label: "Annual Rent", kind: "number" },
	{ key: "actualRent", label: "Actual Rent", kind: "number" },
	{ key: "marketRent", label: "Market Rent", kind: "number" },
	{ key: "securityDeposit", label: "Security Deposit", kind: "number" },
	{ key: "leaseStart", label: "Lease Start", kind: "date" },
	{ key: "leaseEnd", label: "Lease End", kind: "date" },
];

/**
 * Listing page — Units. Number of Units (base property field) plus two optional,
 * independently-toggled marketing tables: Unit Mix (stored on `property.unitMix`)
 * and Rent Roll (which lives on `financials.rentRoll`, passed in narrowed to
 * `rentRoll`/`setRentRoll` — see savePatches.ts for why). Each Include toggle
 * reveals its table and a Syndicate switch. The Unit Mix column set changes
 * with the primary property type; the Rent Roll size/rate/annual trio
 * auto-fills the third value. Unit Mix is hidden for land; Rent Roll is
 * hidden for hospitality.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function UnitsSection({
	property,
	patchProperty,
	marketing,
	patchMarketing,
	rentRoll,
	setRentRoll,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	/** Rent roll only. It lives on `financials.rentRoll`, but it is the sole
	 *  financials field this form owns — the Deal page owns the rest, and taking
	 *  the whole object here would let a stale draft revert it. */
	rentRoll: RentRollRow[];
	setRentRoll: (v: RentRollRow[]) => void;
}) {
	const effects = propertyTypeEffects(property.propertyType);
	const unitMix = property.unitMix ?? [];

	const showUnitMix = property.propertyType !== "land";
	const showRentRoll = property.propertyType !== "hospitality";

	const editUnitMixRow = (id: string, patch: Partial<UnitMixRow>) =>
		patchProperty({
			unitMix: unitMix.map((r) => (r.id === id ? { ...r, ...patch } : r)),
		});

	const editRentRow = (id: string, patch: Partial<RentRollRow>) => {
		const next = rentRoll.map((r) => {
			if (r.id !== id) return r;
			const merged = { ...r, ...patch };
			const filled = autoFillRentRow(
				merged.size ?? null,
				merged.rentPerSf ?? null,
				merged.annualRent ?? null,
			);
			return {
				...merged,
				size: filled.size,
				rentPerSf: filled.ratePerSf,
				annualRent: filled.annualRent,
			};
		});
		setRentRoll(next);
	};

	const emptyRentRow = (): RentRollRow => ({
		id: crypto.randomUUID(),
		unitId: null,
		tenant: "",
		actualRent: 0,
		marketRent: 0,
		rentPerSf: null,
		securityDeposit: 0,
		leaseStart: null,
		leaseEnd: null,
		suite: "",
		size: null,
		annualRent: null,
	});

	return (
		<>
			<SubGroup label="Overview">
				<FieldGrid>
					<Col>
						<NumberField
							label={effects.unitsRequired ? "Number of Units *" : "Number of Units"}
							value={property.residentialUnits}
							onChange={(v) => patchProperty({ residentialUnits: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			{/* ── Unit Mix ── */}
			{showUnitMix && (
				<SubGroup label="Unit Mix">
					<SwitchRow
						label="Include Unit Mix"
						checked={marketing.includeUnitMix ?? false}
						onChange={(v) => patchMarketing({ includeUnitMix: v })}
					/>
					{(marketing.includeUnitMix ?? false) && (
						<>
							<EditableTable
								// Wide grid — the multifamily column set runs to ten. Takes the
								// 640px floor and scrolls inside its own `.table-container`.
								className="record-form__grid-table"
								columns={columnsFor(property.propertyType)}
								rows={unitMix}
								onEdit={editUnitMixRow}
								onAdd={() =>
									patchProperty({ unitMix: [...unitMix, emptyUnitMixRow()] })
								}
								onRemove={(id) =>
									patchProperty({ unitMix: unitMix.filter((r) => r.id !== id) })
								}
								addLabel="Add unit type"
								emptyLabel="No unit types yet."
							/>
							<SwitchRow
								label="Syndicate Unit Mix"
								checked={marketing.syndicateUnitMix ?? false}
								onChange={(v) => patchMarketing({ syndicateUnitMix: v })}
							/>
						</>
					)}
				</SubGroup>
			)}

			{/* ── Rent Roll ── */}
			{showRentRoll && (
				<SubGroup label="Rent Roll">
					<SwitchRow
						label="Include Rent Roll"
						checked={marketing.includeRentRoll ?? false}
						onChange={(v) => patchMarketing({ includeRentRoll: v })}
					/>
					{(marketing.includeRentRoll ?? false) && (
						<>
							<EditableTable
								// Wide grid — same 640px floor as Unit Mix.
								className="record-form__grid-table"
								columns={RENT_ROLL_COLUMNS}
								rows={rentRoll}
								onEdit={editRentRow}
								onAdd={() => setRentRoll([...rentRoll, emptyRentRow()])}
								onRemove={(id) =>
									setRentRoll(rentRoll.filter((r) => r.id !== id))
								}
								addLabel="Add rent roll row"
								emptyLabel="No rent roll rows yet."
							/>
							<SwitchRow
								label="Syndicate Rent Roll"
								checked={marketing.syndicateRentRoll ?? false}
								onChange={(v) => patchMarketing({ syndicateRentRoll: v })}
							/>
						</>
					)}
				</SubGroup>
			)}
		</>
	);
}
