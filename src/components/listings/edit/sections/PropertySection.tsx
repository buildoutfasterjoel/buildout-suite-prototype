import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	AdditionalFields,
	SubGroup,
} from "#/components/common/recordForm/FieldGroup";
import {
	BulletsField,
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/common/recordForm/fieldWidgets";
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
			{/* Flex, not a 5/6/1 grid. The remove button used to sit in its own
			    grid column with `justify-content-end`, which parked it at the far
			    edge of that column and left a gap wide enough that it read as
			    detached from the row it deletes. Here it hugs at the same 8px as
			    the bullet rows in `BulletsField` — the bound tier. `flexBasis: 0`
			    is what makes the two fields split evenly: `flex-grow-1` alone only
			    shares out the *leftover* space, so the pair inherited their unequal
			    intrinsic widths and Type kept a 128px control. */}
			{rows.map((r, i) => (
				<div key={i} className="d-flex align-items-end gap-2">
					<div className="flex-grow-1" style={{ flexBasis: 0 }}>
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
					<div className="flex-grow-1" style={{ flexBasis: 0 }}>
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
					<Button
						variant="ghost"
						size="icon"
						className="flex-shrink-0"
						aria-label="Remove type"
						onClick={() => onChange(rows.filter((_, j) => j !== i))}
					>
						<FontAwesomeIcon icon={faTrashCan} />
					</Button>
				</div>
			))}
		</div>
	);
}

/**
 * Listing page — Property. Primary type/subtype, an optional display-label
 * override, repeatable additional types + aliases, and the required-when-land
 * Lot Size pair. A collapsed "Additional Fields" accordion holds the
 * long-tail site fields most listings never touch.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
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
		<>
			<SubGroup label="Identity">
				<FieldGrid>
					<Col>
						<SelectField
							label="Property Type"
							value={property.propertyType}
							options={PROPERTY_TYPES}
							labels={TYPE_LABELS}
							onChange={(v) => patchProperty({ propertyType: v })}
						/>
					</Col>
					<Col>
						<SelectField
							label="Subtype"
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

				<TextField
					label="Property Name"
					value={property.name}
					onChange={(v) => patchProperty({ name: v })}
				/>

				<BulletsField
					label="Alias"
					bullets={property.aliases ?? []}
					onChange={(v) => patchProperty({ aliases: v })}
				/>
			</SubGroup>

			<SubGroup label="Parcel">
				<FieldGrid>
					<Col span={6}>
						<TextField
							label="Zoning"
							value={property.zoning}
							onChange={(v) => patchProperty({ zoning: v })}
						/>
					</Col>
					<Col span={6}>
						<TextField
							label="APN#"
							value={property.apn}
							onChange={(v) => patchProperty({ apn: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label={lotSizeRequired ? "Lot Size *" : "Lot Size"}
							value={property.lotSqFt}
							onChange={(v) => patchProperty({ lotSqFt: v ?? 0 })}
						/>
					</Col>
					<Col span={6}>
						<SelectField
							label="Lot Size Unit"
							value={property.lotSizeUnit ?? "Sq Ft"}
							options={LOT_SIZE_UNITS}
							onChange={(v) => patchProperty({ lotSizeUnit: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>
		</>
	);
}

/**
 * The long-tail property fields, split out of `PropertySection` so the group can put
 * every disclosure after every cluster.
 *
 * "The Asset" is built from three sections, each of which used to end with its
 * own `AdditionalFields`. Rendered in sequence that put a collapsed disclosure
 * in the middle of the tile stack — between Parcel and Size & Age — where it
 * read as a cluster of its own rather than as the tail of the one above it.
 * Splitting the disclosure from its section lets `ListingFormEditor` order all
 * the clusters first and all the disclosures last, in DOM order rather than
 * with CSS `order` (which would leave tab order jumping back up the page).
 */
export function PropertyAdditionalFields({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	return (
		<AdditionalFields label="Show 12 more property fields">
			<SubGroup label="Site">
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

				<SwitchRow
					label="Corner Property"
					checked={property.cornerProperty ?? false}
					onChange={(v) => patchProperty({ cornerProperty: v })}
				/>

				<TextField
					label="Traffic Count"
					value={property.trafficCount ?? ""}
					onChange={(v) => patchProperty({ trafficCount: v })}
				/>

				<FieldGrid>
					<Col span={12}>
						<TextField
							label="Site Description"
							textarea
							value={property.siteDescription ?? ""}
							onChange={(v) => patchProperty({ siteDescription: v })}
						/>
					</Col>
					<Col span={12}>
						<TextField
							label="Amenities"
							textarea
							value={property.amenities ?? ""}
							onChange={(v) => patchProperty({ amenities: v })}
						/>
					</Col>
				</FieldGrid>

				<SwitchRow
					label="Waterfront"
					checked={property.waterfront ?? false}
					onChange={(v) => patchProperty({ waterfront: v })}
				/>
			</SubGroup>

			<SubGroup label="Records & Utilities">
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
					label="Power"
					value={property.powerDescription ?? ""}
					onChange={(v) => patchProperty({ powerDescription: v })}
				/>

				<SwitchRow
					label="Rail Access"
					checked={property.railAccess ?? false}
					onChange={(v) => patchProperty({ railAccess: v })}
				/>

				<TextField
					label="Gas/Propane"
					value={property.gasPropaneDescription ?? ""}
					onChange={(v) => patchProperty({ gasPropaneDescription: v })}
				/>
			</SubGroup>
		</AdditionalFields>
	);
}
