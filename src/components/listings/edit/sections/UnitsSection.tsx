import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup, faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import {
	Col,
	FieldGrid,
	NumberField,
	SwitchRow,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import { emptyUnitMixRow } from "#/data/createListing";
import { autoFillRentRow } from "#/data/listingFinancials";
import { propertyTypeEffects } from "#/data/listingFormLogic";
import type {
	DealMarketing,
	DealPitchFinancials,
	Property,
	PropertyType,
	RentRollRow,
	UnitMixRow,
} from "#/data/types";

// ── Column model ─────────────────────────────────────────────────────────────
type ColKind = "text" | "number" | "date";
type Column<T> = { key: keyof T; label: string; kind: ColKind };

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

// ── Generic editable table (repeatable rows, add/remove) ─────────────────────
function EditableTable<T extends { id: string }>({
	columns,
	rows,
	onEdit,
	onAdd,
	onRemove,
	addLabel,
	emptyLabel,
}: {
	columns: Column<T>[];
	rows: T[];
	onEdit: (id: string, patch: Partial<T>) => void;
	onAdd: () => void;
	onRemove: (id: string) => void;
	addLabel: string;
	emptyLabel: string;
}) {
	return (
		<div className="d-flex flex-column gap-2">
			<div style={{ overflowX: "auto" }}>
				<table className="table table-sm align-middle mb-0" style={{ minWidth: 640 }}>
					<thead>
						<tr>
							{columns.map((c) => (
								<th key={String(c.key)} className="text-muted fw-semibold" style={{ fontSize: 13 }}>
									{c.label}
								</th>
							))}
							<th style={{ width: 44 }} />
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ? (
							<tr>
								<td colSpan={columns.length + 1} className="text-muted">
									{emptyLabel}
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<tr key={row.id}>
									{columns.map((c) => {
										const raw = row[c.key] as string | number | null | undefined;
										return (
											<td key={String(c.key)}>
												{c.kind === "text" ? (
													<Input
														style={{ minWidth: 140 }}
														value={(raw as string | null) ?? ""}
														onChange={(e) =>
															onEdit(row.id, { [c.key]: e.target.value } as Partial<T>)
														}
													/>
												) : c.kind === "date" ? (
													<Input
														type="date"
														style={{ minWidth: 150 }}
														value={(raw as string | null) ?? ""}
														onChange={(e) =>
															onEdit(row.id, {
																[c.key]: e.target.value === "" ? null : e.target.value,
															} as Partial<T>)
														}
													/>
												) : (
													<Input
														type="number"
														style={{ minWidth: 110 }}
														value={(raw as number | null) ?? ""}
														onChange={(e) =>
															onEdit(row.id, {
																[c.key]:
																	e.target.value === "" ? null : Number(e.target.value),
															} as Partial<T>)
														}
													/>
												)}
											</td>
										);
									})}
									<td>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label="Remove row"
											onClick={() => onRemove(row.id)}
										>
											<FontAwesomeIcon icon={faTrashCan} />
										</Button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<div>
				<Button variant="ghost" size="sm" onClick={onAdd}>
					<FontAwesomeIcon icon={faPlus} />
					{addLabel}
				</Button>
			</div>
		</div>
	);
}

/**
 * Listing tab — Units. Number of Units (base property field) plus two optional,
 * independently-toggled marketing tables: Unit Mix (stored on `property.unitMix`)
 * and Rent Roll (stored on `financials.rentRoll`). Each Include toggle reveals its
 * table and a Syndicate switch. The Unit Mix column set changes with the primary
 * property type; the Rent Roll size/rate/annual trio auto-fills the third value.
 * Unit Mix is hidden for land; Rent Roll is hidden for hospitality.
 */
export function UnitsSection({
	property,
	patchProperty,
	marketing,
	patchMarketing,
	financials,
	patchFinancials,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	financials: DealPitchFinancials;
	patchFinancials: (p: Partial<DealPitchFinancials>) => void;
}) {
	const effects = propertyTypeEffects(property.propertyType);
	const unitMix = property.unitMix ?? [];
	const rentRoll = financials.rentRoll ?? [];

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
				rentPerSf: filled.ratePerSf ?? 0,
				annualRent: filled.annualRent,
			};
		});
		patchFinancials({ rentRoll: next });
	};

	const emptyRentRow = (): RentRollRow => ({
		id: crypto.randomUUID(),
		unitId: null,
		tenant: "",
		actualRent: 0,
		marketRent: 0,
		rentPerSf: 0,
		securityDeposit: 0,
		leaseStart: null,
		leaseEnd: null,
		suite: "",
		size: null,
		annualRent: null,
	});

	return (
		<Section title="Units" icon={faLayerGroup}>
			<FieldGrid>
				<Col>
					<NumberField
						label={effects.unitsRequired ? "Number of Units *" : "Number of Units"}
						value={property.residentialUnits}
						onChange={(v) => patchProperty({ residentialUnits: v })}
					/>
				</Col>
			</FieldGrid>

			{/* ── Unit Mix ── */}
			{showUnitMix && (
				<div className="d-flex flex-column gap-3">
					<div style={{ maxWidth: 360 }}>
						<SwitchRow
							label="Include Unit Mix"
							checked={marketing.includeUnitMix ?? false}
							onChange={(v) => patchMarketing({ includeUnitMix: v })}
						/>
					</div>
					{(marketing.includeUnitMix ?? false) && (
						<div className="d-flex flex-column gap-3">
							<EditableTable
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
							<div style={{ maxWidth: 360 }}>
								<SwitchRow
									label="Syndicate Unit Mix"
									checked={marketing.syndicateUnitMix ?? false}
									onChange={(v) => patchMarketing({ syndicateUnitMix: v })}
								/>
							</div>
						</div>
					)}
				</div>
			)}

			{/* ── Rent Roll ── */}
			{showRentRoll && (
				<div className="d-flex flex-column gap-3">
					<div style={{ maxWidth: 360 }}>
						<SwitchRow
							label="Include Rent Roll"
							checked={marketing.includeRentRoll ?? false}
							onChange={(v) => patchMarketing({ includeRentRoll: v })}
						/>
					</div>
					{(marketing.includeRentRoll ?? false) && (
						<div className="d-flex flex-column gap-3">
							<EditableTable
								columns={RENT_ROLL_COLUMNS}
								rows={rentRoll}
								onEdit={editRentRow}
								onAdd={() =>
									patchFinancials({ rentRoll: [...rentRoll, emptyRentRow()] })
								}
								onRemove={(id) =>
									patchFinancials({
										rentRoll: rentRoll.filter((r) => r.id !== id),
									})
								}
								addLabel="Add rent roll row"
								emptyLabel="No rent roll rows yet."
							/>
							<div style={{ maxWidth: 360 }}>
								<SwitchRow
									label="Syndicate Rent Roll"
									checked={marketing.syndicateRentRoll ?? false}
									onChange={(v) => patchMarketing({ syndicateRentRoll: v })}
								/>
							</div>
						</div>
					)}
				</div>
			)}
		</Section>
	);
}
