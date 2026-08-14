import {
	AdditionalFields,
	SubGroup,
} from "#/components/listings/edit/FieldGroup";
import {
	Col,
	FieldGrid,
	NumberField,
	TextField,
	YesNoNaField,
} from "#/components/listings/edit/fieldWidgets";
import type { Property } from "#/data/types";

/**
 * Listing page — Land. Only rendered for the Land property type
 * (`propertyTypeEffects(...).landSections`). Number of Lots and Best Use show
 * up front; utility availability, environmental, and site fields sit behind a
 * collapsed "Additional Fields" accordion.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function LandSection({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	return (
		<>
			<SubGroup label="Land">
				<FieldGrid>
					<Col>
						<NumberField
							label="Number of Lots"
							value={property.numberOfLots ?? null}
							onChange={(v) => patchProperty({ numberOfLots: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Best Use"
							value={property.bestUse ?? ""}
							onChange={(v) => patchProperty({ bestUse: v })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<AdditionalFields label="Show 13 more land fields">
				<SubGroup label="Utilities">
					<FieldGrid>
						<Col span={3}>
							<YesNoNaField
								label="Irrigation"
								value={property.irrigation}
								onChange={(v) => patchProperty({ irrigation: v })}
							/>
						</Col>
						<Col span={9}>
							<TextField
								label="Irrigation Description"
								value={property.irrigationDescription ?? ""}
								onChange={(v) =>
									patchProperty({ irrigationDescription: v })
								}
							/>
						</Col>
						<Col span={3}>
							<YesNoNaField
								label="Water"
								value={property.water}
								onChange={(v) => patchProperty({ water: v })}
							/>
						</Col>
						<Col span={9}>
							<TextField
								label="Water Description"
								value={property.waterDescription ?? ""}
								onChange={(v) => patchProperty({ waterDescription: v })}
							/>
						</Col>
						<Col span={3}>
							<YesNoNaField
								label="Telephone"
								value={property.telephone}
								onChange={(v) => patchProperty({ telephone: v })}
							/>
						</Col>
						<Col span={9}>
							<TextField
								label="Telephone Description"
								value={property.telephoneDescription ?? ""}
								onChange={(v) =>
									patchProperty({ telephoneDescription: v })
								}
							/>
						</Col>
						<Col span={3}>
							<YesNoNaField
								label="Cable"
								value={property.cable}
								onChange={(v) => patchProperty({ cable: v })}
							/>
						</Col>
						<Col span={9}>
							<TextField
								label="Cable Description"
								value={property.cableDescription ?? ""}
								onChange={(v) => patchProperty({ cableDescription: v })}
							/>
						</Col>
						<Col span={3}>
							<YesNoNaField
								label="Sewer"
								value={property.sewer}
								onChange={(v) => patchProperty({ sewer: v })}
							/>
						</Col>
					</FieldGrid>
				</SubGroup>

				<SubGroup label="Site Conditions">
					<FieldGrid>
						<Col span={4}>
							<TextField
								label="Environmental Issues"
								value={property.environmentalIssues ?? ""}
								onChange={(v) =>
									patchProperty({ environmentalIssues: v })
								}
							/>
						</Col>
						<Col span={4}>
							<TextField
								label="Topography"
								value={property.topography ?? ""}
								onChange={(v) => patchProperty({ topography: v })}
							/>
						</Col>
						<Col span={4}>
							<TextField
								label="Soil Type"
								value={property.soilType ?? ""}
								onChange={(v) => patchProperty({ soilType: v })}
							/>
						</Col>
						<Col span={12}>
							<TextField
								label="Easements Description"
								textarea
								value={property.easementsDescription ?? ""}
								onChange={(v) => patchProperty({ easementsDescription: v })}
							/>
						</Col>
					</FieldGrid>
				</SubGroup>
			</AdditionalFields>
		</>
	);
}
