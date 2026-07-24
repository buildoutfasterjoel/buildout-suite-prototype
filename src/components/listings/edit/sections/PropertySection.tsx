import { useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { faCity, faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	BulletsField,
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import {
	PROPERTY_TYPES,
	TYPE_LABELS,
} from "#/components/properties/propertyDisplay";
import { isLandLikeSubtype } from "#/data/listingFormLogic";
import type { Property, PropertySubtype, PropertyType } from "#/data/types";

// ── Local option constants ───────────────────────────────────────────────────
/** Full `PropertySubtype` union (types.ts) — every subtype is selectable regardless of the primary type. */
export const ALL_SUBTYPES: PropertySubtype[] = [
	"Low-Rise/Garden",
	"Mid-Rise",
	"High-Rise",
	"Townhouse",
	"Duplex",
	"Triplex",
	"Fourplex",
	"Single Tenant",
	"Multi-Tenant",
	"Medical",
	"Creative/Loft",
	"Strip Center",
	"Power Center",
	"Neighborhood Center",
	"Freestanding",
	"Storefront",
	"Warehouse",
	"Flex",
	"Distribution",
	"Manufacturing",
	"Cold Storage",
	"Vacant Land",
	"Hotel",
	"Motel",
	"Self-Storage",
	"Industrial Outdoor Storage",
	"Mixed-Use",
];

const LOT_SIZE_UNITS = ["Sq Ft", "Acres", "Sq Meters", "Hectares"];

// ── Additional property types repeatable rows ───────────────────────────────
function AdditionalTypesEditor({
	rows,
	onChange,
}: {
	rows: { type: PropertyType; subtype: PropertySubtype }[];
	onChange: (v: { type: PropertyType; subtype: PropertySubtype }[]) => void;
}) {
	return (
		<div className="d-flex flex-column gap-2">
			<div className="d-flex align-items-center justify-content-between">
				<span className="fw-semibold">Additional Property Types</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						onChange([...rows, { type: "office", subtype: "Multi-Tenant" }])
					}
				>
					<FontAwesomeIcon icon={faPlus} /> Add type
				</Button>
			</div>
			{rows.map((r, i) => (
				<div key={i} className="row g-2 align-items-end">
					<div className="col-md-5">
						<SelectField
							label="Type"
							value={r.type}
							options={PROPERTY_TYPES}
							labels={TYPE_LABELS}
							onChange={(v) =>
								onChange(rows.map((x, j) => (j === i ? { ...x, type: v } : x)))
							}
						/>
					</div>
					<div className="col-md-6">
						<SelectField
							label="Subtype"
							value={r.subtype}
							options={ALL_SUBTYPES}
							onChange={(v) =>
								onChange(
									rows.map((x, j) => (j === i ? { ...x, subtype: v } : x)),
								)
							}
						/>
					</div>
					<div className="col-md-1 d-flex justify-content-end pb-1">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remove type"
							onClick={() => onChange(rows.filter((_, j) => j !== i))}
						>
							<FontAwesomeIcon icon={faTrashCan} />
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}

/**
 * Listing tab — Property. Primary type/subtype, an optional display-label
 * override, repeatable additional types + aliases, and the required-when-land
 * Lot Size pair. A collapsed "Additional Fields" accordion holds the
 * long-tail site fields most listings never touch.
 */
export function PropertySection({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	const [showLabelOverride, setShowLabelOverride] = useState(
		!!property.propertyTypeLabelOverride,
	);

	const lotSizeRequired =
		property.propertyType === "land" ||
		isLandLikeSubtype(property.propertySubtype);

	return (
		<Section title="Property" icon={faCity}>
			<FieldGrid>
				<Col>
					<SelectField
						label="Primary Property Type"
						value={property.propertyType}
						options={PROPERTY_TYPES}
						labels={TYPE_LABELS}
						onChange={(v) => patchProperty({ propertyType: v })}
					/>
				</Col>
				<Col>
					<SelectField
						label="Primary Property Subtype"
						value={property.propertySubtype}
						options={ALL_SUBTYPES}
						onChange={(v) => patchProperty({ propertySubtype: v })}
					/>
				</Col>
			</FieldGrid>

			<div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowLabelOverride((s) => !s)}
				>
					{showLabelOverride ? "Remove label override" : "Override label"}
				</Button>
			</div>
			{showLabelOverride && (
				<TextField
					label="Property Type Label Override"
					value={property.propertyTypeLabelOverride ?? ""}
					onChange={(v) => patchProperty({ propertyTypeLabelOverride: v })}
				/>
			)}

			<AdditionalTypesEditor
				rows={property.additionalPropertyTypes ?? []}
				onChange={(v) => patchProperty({ additionalPropertyTypes: v })}
			/>

			<FieldGrid>
				<Col>
					<TextField
						label="Property Name"
						value={property.name}
						onChange={(v) => patchProperty({ name: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="Zoning"
						value={property.zoning}
						onChange={(v) => patchProperty({ zoning: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="APN#"
						value={property.apn}
						onChange={(v) => patchProperty({ apn: v })}
					/>
				</Col>
			</FieldGrid>

			<BulletsField
				label="Alias"
				bullets={property.aliases ?? []}
				onChange={(v) => patchProperty({ aliases: v })}
			/>

			<FieldGrid>
				<Col>
					<NumberField
						label={lotSizeRequired ? "Lot Size *" : "Lot Size"}
						value={property.lotSqFt}
						onChange={(v) => patchProperty({ lotSqFt: v ?? 0 })}
					/>
				</Col>
				<Col>
					<SelectField
						label="Lot Size Unit"
						value={property.lotSizeUnit ?? "Sq Ft"}
						options={LOT_SIZE_UNITS}
						onChange={(v) => patchProperty({ lotSizeUnit: v })}
					/>
				</Col>
			</FieldGrid>

			<Accordion variant="inline">
				<Accordion.Item value="property-more">
					<Accordion.Trigger>
						<span className="fw-semibold">Show/Hide Additional Fields</span>
					</Accordion.Trigger>
					<Accordion.Content>
						<div className="d-flex flex-column gap-3">
							<FieldGrid>
								<Col>
									<NumberField
										label="Lot Frontage"
										value={property.lotFrontage ?? null}
										onChange={(v) => patchProperty({ lotFrontage: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Lot Depth"
										value={property.lotDepth ?? null}
										onChange={(v) => patchProperty({ lotDepth: v })}
									/>
								</Col>
							</FieldGrid>

							<div style={{ maxWidth: 360 }}>
								<SwitchRow
									label="Corner Property"
									checked={property.cornerProperty ?? false}
									onChange={(v) => patchProperty({ cornerProperty: v })}
								/>
							</div>

							<TextField
								label="Traffic Count"
								value={property.trafficCount ?? ""}
								onChange={(v) => patchProperty({ trafficCount: v })}
							/>

							<TextField
								label="Site Description"
								textarea
								value={property.siteDescription ?? ""}
								onChange={(v) => patchProperty({ siteDescription: v })}
							/>
							<TextField
								label="Amenities"
								textarea
								value={property.amenities ?? ""}
								onChange={(v) => patchProperty({ amenities: v })}
							/>

							<div style={{ maxWidth: 360 }}>
								<SwitchRow
									label="Waterfront"
									checked={property.waterfront ?? false}
									onChange={(v) => patchProperty({ waterfront: v })}
								/>
							</div>

							<FieldGrid>
								<Col>
									<TextField
										label="MLS ID#"
										value={property.mlsId ?? ""}
										onChange={(v) => patchProperty({ mlsId: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Thomas Guide Page #"
										value={property.thomasGuidePage ?? ""}
										onChange={(v) => patchProperty({ thomasGuidePage: v })}
									/>
								</Col>
							</FieldGrid>

							<TextField
								label="Power Description"
								value={property.powerDescription ?? ""}
								onChange={(v) => patchProperty({ powerDescription: v })}
							/>

							<div style={{ maxWidth: 360 }}>
								<SwitchRow
									label="Rail Access"
									checked={property.railAccess ?? false}
									onChange={(v) => patchProperty({ railAccess: v })}
								/>
							</div>

							<TextField
								label="Gas/Propane Description"
								value={property.gasPropaneDescription ?? ""}
								onChange={(v) => patchProperty({ gasPropaneDescription: v })}
							/>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		</Section>
	);
}
