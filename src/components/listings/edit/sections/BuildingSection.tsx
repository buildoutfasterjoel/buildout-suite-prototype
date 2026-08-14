import {
	AdditionalFields,
	SubGroup,
} from "#/components/common/recordForm/FieldGroup";
import {
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/common/recordForm/fieldWidgets";
import {
	buildingClassOptions,
	propertyTypeEffects,
} from "#/data/listingFormLogic";
import type { Property } from "#/data/types";

const TENANCY_OPTIONS: ("Single" | "Multiple")[] = ["Single", "Multiple"];

/**
 * Listing page — Building. Base structural stats always show; Building Class,
 * Retail Clientele, and the industrial-cluster fields (doors/bays/cranes) are
 * gated by the primary property type via `propertyTypeEffects`. A collapsed
 * "Additional Fields" accordion holds the long-tail construction/parking
 * fields most listings never touch.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function BuildingSection({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	const effects = propertyTypeEffects(property.propertyType);

	return (
		<>
			<SubGroup label="Size & Age">
				<FieldGrid>
					<Col span={6}>
						<NumberField
							label="Building Size"
							value={property.buildingSqFt}
							onChange={(v) => patchProperty({ buildingSqFt: v ?? 0 })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Occupancy %"
							value={property.occupancyPct}
							onChange={(v) => patchProperty({ occupancyPct: v ?? 0 })}
							fieldKey="occupancyPct"
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Year Built"
							value={property.yearBuilt}
							onChange={(v) => patchProperty({ yearBuilt: v ?? 0 })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Year Renovated"
							value={property.yearRenovated ?? null}
							onChange={(v) => patchProperty({ yearRenovated: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup label="Structure">
				<FieldGrid>
					<Col span={6}>
						<NumberField
							label="Number of Floors"
							value={property.stories}
							onChange={(v) => patchProperty({ stories: v ?? 0 })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Average Floor Size"
							value={property.avgFloorSize ?? null}
							onChange={(v) => patchProperty({ avgFloorSize: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Ceiling Height"
							value={property.ceilingHeight ?? null}
							onChange={(v) => patchProperty({ ceilingHeight: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Min Ceiling Height"
							value={property.minCeilingHeight ?? null}
							onChange={(v) => patchProperty({ minCeilingHeight: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Office Space"
							value={property.officeSpaceSqFt ?? null}
							onChange={(v) => patchProperty({ officeSpaceSqFt: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup label="Class & Tenancy">
				<FieldGrid>
					<Col>
						<SelectField
							label="Building Class"
							value={property.buildingClass}
							options={buildingClassOptions(property.country)}
							onChange={(v) => patchProperty({ buildingClass: v })}
						/>
					</Col>
					<Col>
						<SelectField
							label="Tenancy"
							value={property.tenancy ?? "Single"}
							options={TENANCY_OPTIONS}
							onChange={(v) => patchProperty({ tenancy: v })}
						/>
					</Col>
				</FieldGrid>

				{effects.retailClientele && (
					<TextField
						label="Retail Clientele"
						value={property.retailClientele ?? ""}
						onChange={(v) => patchProperty({ retailClientele: v })}
					/>
				)}
			</SubGroup>

			{effects.industrialCluster && (
				<SubGroup label="Loading">
					<FieldGrid>
						<Col span={6}>
							<NumberField
								label="Grade Level Doors"
								value={property.gradeLevelDoors ?? null}
								onChange={(v) => patchProperty({ gradeLevelDoors: v })}
							/>
						</Col>
						<Col span={6}>
							<NumberField
								label="Dock High Doors"
								value={property.dockHighDoors ?? null}
								onChange={(v) => patchProperty({ dockHighDoors: v })}
							/>
						</Col>
						<Col span={6}>
							<NumberField
								label="Drive-in Bays"
								value={property.driveInBays ?? null}
								onChange={(v) => patchProperty({ driveInBays: v })}
							/>
						</Col>
						<Col span={6}>
							<NumberField
								label="Number of Cranes"
								value={property.numberOfCranes ?? null}
								onChange={(v) => patchProperty({ numberOfCranes: v })}
							/>
						</Col>
					</FieldGrid>
					<TextField
						label="Dock Description"
						value={property.dockDescription ?? ""}
						onChange={(v) => patchProperty({ dockDescription: v })}
					/>
					<TextField
						label="Crane Description"
						value={property.craneDescription ?? ""}
						onChange={(v) => patchProperty({ craneDescription: v })}
					/>
					<TextField
						label="Sprinkler Description"
						value={property.sprinklerDescription ?? ""}
						onChange={(v) => patchProperty({ sprinklerDescription: v })}
					/>
				</SubGroup>
			)}
		</>
	);
}

/**
 * The long-tail building fields, split out of `BuildingSection` so the group can put
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
export function BuildingAdditionalFields({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	return (
		<AdditionalFields label="Show 19 more building fields">
			<SubGroup label="Measurements">
				<FieldGrid>
					<Col span={6}>
						<NumberField
							label="Overhead Door Height"
							value={property.overheadDoorHeight ?? null}
							onChange={(v) => patchProperty({ overheadDoorHeight: v })}
						/>
					</Col>
					<Col span={6}>
						<TextField
							label="Column Space"
							value={property.columnSpace ?? ""}
							onChange={(v) => patchProperty({ columnSpace: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Gross Leasable Area"
							value={property.grossLeasableArea ?? null}
							onChange={(v) => patchProperty({ grossLeasableArea: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Load Factor"
							value={property.loadFactor ?? null}
							onChange={(v) => patchProperty({ loadFactor: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup label="Parking & Construction">
				<FieldGrid>
					<Col span={6}>
						<TextField
							label="Construction Status"
							value={property.constructionStatus ?? ""}
							onChange={(v) => patchProperty({ constructionStatus: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Parking Ratio"
							value={property.parkingRatio ?? null}
							onChange={(v) => patchProperty({ parkingRatio: v })}
						/>
					</Col>
					<Col span={6}>
						<TextField
							label="Parking Type"
							value={property.parkingType ?? ""}
							onChange={(v) => patchProperty({ parkingType: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Warehouse %"
							value={property.warehousePct ?? null}
							onChange={(v) => patchProperty({ warehousePct: v })}
						/>
					</Col>
				</FieldGrid>

				<FieldGrid>
					<Col span={12}>
						<TextField
							label="Construction Notes"
							textarea
							value={property.constructionDescription ?? ""}
							onChange={(v) =>
								patchProperty({ constructionDescription: v })
							}
						/>
					</Col>
					<Col span={12}>
						<TextField
							label="Parking Description"
							textarea
							value={property.parkingDescription ?? ""}
							onChange={(v) => patchProperty({ parkingDescription: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup label="Systems & Condition">
				<FieldGrid>
					<Col span={6}>
						<TextField
							label="Condition"
							value={property.condition ?? ""}
							onChange={(v) => patchProperty({ condition: v })}
						/>
					</Col>
					<Col span={6}>
						<NumberField
							label="Number of Elevators"
							value={property.numberOfElevators ?? null}
							onChange={(v) => patchProperty({ numberOfElevators: v })}
						/>
					</Col>
					<Col span={6}>
						<TextField
							label="Roof"
							value={property.roof ?? ""}
							onChange={(v) => patchProperty({ roof: v })}
						/>
					</Col>
				</FieldGrid>

				<div className="row g-3">
					<div className="col-md-6">
						<SwitchRow
							label="Freight Elevator"
							checked={property.freightElevator ?? false}
							onChange={(v) => patchProperty({ freightElevator: v })}
						/>
					</div>
					<div className="col-md-6">
						<SwitchRow
							label="Central HVAC"
							checked={property.centralHvac ?? false}
							onChange={(v) => patchProperty({ centralHvac: v })}
						/>
					</div>
					<div className="col-md-6">
						<SwitchRow
							label="Free Standing"
							checked={property.freeStanding ?? false}
							onChange={(v) => patchProperty({ freeStanding: v })}
						/>
					</div>
					<div className="col-md-6">
						<SwitchRow
							label="LEED Certified"
							checked={property.leedCertified ?? false}
							onChange={(v) => patchProperty({ leedCertified: v })}
						/>
					</div>
				</div>

				<FieldGrid>
					<Col span={12}>
						<TextField
							label="Utilities Description"
							textarea
							value={property.utilitiesDescription ?? ""}
							onChange={(v) => patchProperty({ utilitiesDescription: v })}
						/>
					</Col>
					<Col span={12}>
						<TextField
							label="Loading Description"
							textarea
							value={property.loadingDescription ?? ""}
							onChange={(v) => patchProperty({ loadingDescription: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>
		</AdditionalFields>
	);
}
