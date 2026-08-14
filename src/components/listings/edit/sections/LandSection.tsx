import {
	AdditionalFields,
	SubGroup,
} from "#/components/common/recordForm/FieldGroup";
import {
	Col,
	FieldGrid,
	NumberField,
	TextField,
	YesNoNaField,
} from "#/components/common/recordForm/fieldWidgets";
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
		</>
	);
}

/**
 * The long-tail land fields, split out of `LandSection` so the group can put
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
export function LandAdditionalFields({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	return (
		<AdditionalFields label="Show 13 more land fields">
			<SubGroup label="Utilities">
				<FieldGrid>
					<Col span={6}>
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
					<Col span={6}>
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
					<Col span={6}>
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
					<Col span={6}>
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
					<Col span={6}>
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
					<Col span={6}>
						<TextField
							label="Environmental Issues"
							value={property.environmentalIssues ?? ""}
							onChange={(v) =>
								patchProperty({ environmentalIssues: v })
							}
						/>
					</Col>
					<Col span={6}>
						<TextField
							label="Topography"
							value={property.topography ?? ""}
							onChange={(v) => patchProperty({ topography: v })}
						/>
					</Col>
					<Col span={6}>
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
	);
}
