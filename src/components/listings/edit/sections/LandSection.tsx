import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { faMountainSun } from "@fortawesome/pro-regular-svg-icons";
import {
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import type { Property, YesNoNA } from "#/data/types";

const YES_NO_NA_OPTIONS: YesNoNA[] = ["Y", "N", "NA"];

/** Y/N/NA select, e.g. Irrigation/Water/Telephone/Cable/Sewer availability. */
function YesNoNaField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: YesNoNA | undefined;
	onChange: (v: YesNoNA) => void;
}) {
	return (
		<SelectField
			label={label}
			value={value ?? "NA"}
			options={YES_NO_NA_OPTIONS}
			onChange={onChange}
		/>
	);
}

/**
 * Listing tab — Land. Only rendered for the Land property type
 * (`propertyTypeEffects(...).landSections`). Number of Lots and Best Use show
 * up front; utility availability, environmental, and site fields sit behind a
 * collapsed "Additional Fields" accordion.
 */
export function LandSection({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	return (
		<Section title="Land" icon={faMountainSun}>
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

			<Accordion variant="inline">
				<Accordion.Item value="land-more">
					<Accordion.Trigger>
						<span className="fw-semibold">Show/Hide Additional Fields</span>
					</Accordion.Trigger>
					<Accordion.Content>
						<div className="d-flex flex-column gap-3">
							<FieldGrid>
								<Col>
									<YesNoNaField
										label="Irrigation"
										value={property.irrigation}
										onChange={(v) => patchProperty({ irrigation: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Irrigation Description"
										value={property.irrigationDescription ?? ""}
										onChange={(v) =>
											patchProperty({ irrigationDescription: v })
										}
									/>
								</Col>
								<Col>
									<YesNoNaField
										label="Water"
										value={property.water}
										onChange={(v) => patchProperty({ water: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Water Description"
										value={property.waterDescription ?? ""}
										onChange={(v) => patchProperty({ waterDescription: v })}
									/>
								</Col>
								<Col>
									<YesNoNaField
										label="Telephone"
										value={property.telephone}
										onChange={(v) => patchProperty({ telephone: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Telephone Description"
										value={property.telephoneDescription ?? ""}
										onChange={(v) =>
											patchProperty({ telephoneDescription: v })
										}
									/>
								</Col>
								<Col>
									<YesNoNaField
										label="Cable"
										value={property.cable}
										onChange={(v) => patchProperty({ cable: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Cable Description"
										value={property.cableDescription ?? ""}
										onChange={(v) => patchProperty({ cableDescription: v })}
									/>
								</Col>
								<Col>
									<YesNoNaField
										label="Sewer"
										value={property.sewer}
										onChange={(v) => patchProperty({ sewer: v })}
									/>
								</Col>
							</FieldGrid>

							<FieldGrid>
								<Col>
									<TextField
										label="Environmental Issues"
										value={property.environmentalIssues ?? ""}
										onChange={(v) =>
											patchProperty({ environmentalIssues: v })
										}
									/>
								</Col>
								<Col>
									<TextField
										label="Topography"
										value={property.topography ?? ""}
										onChange={(v) => patchProperty({ topography: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Soil Type"
										value={property.soilType ?? ""}
										onChange={(v) => patchProperty({ soilType: v })}
									/>
								</Col>
							</FieldGrid>

							<TextField
								label="Easements Description"
								textarea
								value={property.easementsDescription ?? ""}
								onChange={(v) => patchProperty({ easementsDescription: v })}
							/>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		</Section>
	);
}
