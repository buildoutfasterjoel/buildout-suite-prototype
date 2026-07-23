import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { faBuilding } from "@fortawesome/pro-regular-svg-icons";
import {
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import {
	buildingClassOptions,
	propertyTypeEffects,
} from "#/data/listingFormLogic";
import type { Property } from "#/data/types";

const TENANCY_OPTIONS: ("Single" | "Multiple")[] = ["Single", "Multiple"];

/**
 * Listing tab — Building. Base structural stats always show; Building Class,
 * Retail Clientele, and the industrial-cluster fields (doors/bays/cranes) are
 * gated by the primary property type via `propertyTypeEffects`. A collapsed
 * "Additional Fields" accordion holds the long-tail construction/parking
 * fields most listings never touch.
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
		<Section title="Building" icon={faBuilding}>
			<FieldGrid>
				<Col>
					<NumberField
						label="Building Size"
						value={property.buildingSqFt}
						onChange={(v) => patchProperty({ buildingSqFt: v ?? 0 })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Occupancy %"
						value={property.occupancyPct}
						onChange={(v) => patchProperty({ occupancyPct: v ?? 0 })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Year Built"
						value={property.yearBuilt}
						onChange={(v) => patchProperty({ yearBuilt: v ?? 0 })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Year Renovated"
						value={property.yearRenovated ?? null}
						onChange={(v) => patchProperty({ yearRenovated: v })}
					/>
				</Col>
			</FieldGrid>

			<FieldGrid>
				<Col>
					<NumberField
						label="Number of Floors"
						value={property.stories}
						onChange={(v) => patchProperty({ stories: v ?? 0 })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Average Floor Size"
						value={property.avgFloorSize ?? null}
						onChange={(v) => patchProperty({ avgFloorSize: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Ceiling Height"
						value={property.ceilingHeight ?? null}
						onChange={(v) => patchProperty({ ceilingHeight: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Min Ceiling Height"
						value={property.minCeilingHeight ?? null}
						onChange={(v) => patchProperty({ minCeilingHeight: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Office Space"
						value={property.officeSpaceSqFt ?? null}
						onChange={(v) => patchProperty({ officeSpaceSqFt: v })}
					/>
				</Col>
			</FieldGrid>

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

			{effects.industrialCluster && (
				<div className="d-flex flex-column gap-3">
					<FieldGrid>
						<Col>
							<NumberField
								label="Grade Level Doors"
								value={property.gradeLevelDoors ?? null}
								onChange={(v) => patchProperty({ gradeLevelDoors: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Dock High Doors"
								value={property.dockHighDoors ?? null}
								onChange={(v) => patchProperty({ dockHighDoors: v })}
							/>
						</Col>
						<Col>
							<NumberField
								label="Drive-in Bays"
								value={property.driveInBays ?? null}
								onChange={(v) => patchProperty({ driveInBays: v })}
							/>
						</Col>
						<Col>
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
				</div>
			)}

			<Accordion variant="inline">
				<Accordion.Item value="building-more">
					<Accordion.Trigger>
						<span className="fw-semibold">Show/Hide Additional Fields</span>
					</Accordion.Trigger>
					<Accordion.Content>
						<div className="d-flex flex-column gap-3">
							<FieldGrid>
								<Col>
									<NumberField
										label="Overhead Door Height"
										value={property.overheadDoorHeight ?? null}
										onChange={(v) => patchProperty({ overheadDoorHeight: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Column Space"
										value={property.columnSpace ?? ""}
										onChange={(v) => patchProperty({ columnSpace: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Gross Leasable Area"
										value={property.grossLeasableArea ?? null}
										onChange={(v) => patchProperty({ grossLeasableArea: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Load Factor"
										value={property.loadFactor ?? null}
										onChange={(v) => patchProperty({ loadFactor: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Construction Status"
										value={property.constructionStatus ?? ""}
										onChange={(v) => patchProperty({ constructionStatus: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Parking Ratio"
										value={property.parkingRatio ?? null}
										onChange={(v) => patchProperty({ parkingRatio: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Parking Type"
										value={property.parkingType ?? ""}
										onChange={(v) => patchProperty({ parkingType: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Warehouse %"
										value={property.warehousePct ?? null}
										onChange={(v) => patchProperty({ warehousePct: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Condition"
										value={property.condition ?? ""}
										onChange={(v) => patchProperty({ condition: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Number of Elevators"
										value={property.numberOfElevators ?? null}
										onChange={(v) => patchProperty({ numberOfElevators: v })}
									/>
								</Col>
								<Col>
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

							<TextField
								label="Construction Description"
								textarea
								value={property.constructionDescription ?? ""}
								onChange={(v) => patchProperty({ constructionDescription: v })}
							/>
							<TextField
								label="Parking Description"
								textarea
								value={property.parkingDescription ?? ""}
								onChange={(v) => patchProperty({ parkingDescription: v })}
							/>
							<TextField
								label="Utilities Description"
								textarea
								value={property.utilitiesDescription ?? ""}
								onChange={(v) => patchProperty({ utilitiesDescription: v })}
							/>
							<TextField
								label="Loading Description"
								textarea
								value={property.loadingDescription ?? ""}
								onChange={(v) => patchProperty({ loadingDescription: v })}
							/>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		</Section>
	);
}
