import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { faLocationDot } from "@fortawesome/pro-regular-svg-icons";
import {
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import type { DealMarketing, Property, YesNoNA } from "#/data/types";

// ── Local option constants ───────────────────────────────────────────────────
const COUNTRY_OPTIONS = [
	"United States",
	"Canada",
	"United Kingdom",
	"Australia",
	"Mexico",
	"United Arab Emirates",
];

/** Countries whose display name is well-known as-is — no manual override needed. */
const STANDARD_COUNTRIES = new Set<string>([
	"United States",
	"Canada",
	"United Kingdom",
	"Australia",
]);

/** Countries with no formal postal-code system — the Zip field is hidden. */
const NO_POSTAL_CODE_COUNTRIES = new Set<string>(["United Arab Emirates"]);

/** Countries with no county-level administrative division — County is hidden. */
const NO_COUNTY_COUNTRIES = new Set<string>(["Mexico", "United Arab Emirates"]);

const CURRENCY_OPTIONS = ["USD", "CAD", "GBP", "AUD", "MXN", "AED"];
const CURRENCY_FORMAT_OPTIONS = [
	"$1,000.00",
	"$1.000,00",
	"1.000,00 $",
	"1,000.00 $",
];
const LANGUAGE_OPTIONS = ["English", "French", "Spanish", "Arabic"];
const MEASUREMENT_OPTIONS: ("Imperial" | "Metric")[] = ["Imperial", "Metric"];
const YES_NO_NA_OPTIONS: YesNoNA[] = ["Y", "N", "NA"];
const YES_NO_NA_LABELS: Record<string, string> = {
	Y: "Yes",
	N: "No",
	NA: "N/A",
};

/**
 * Listing tab — Location. Country/address/map fields live on `property`
 * (persisted via `patchProperty`); the two location-description fields live on
 * `marketing` (persisted via `patchMarketing`) since they're syndication copy,
 * not property data. A collapsed "Additional Fields" accordion holds the
 * long-tail surveyor/road fields that most listings never touch.
 */
export function LocationSection({
	property,
	patchProperty,
	marketing,
	patchMarketing,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
}) {
	const country = property.country ?? "United States";
	const isStandardCountry = STANDARD_COUNTRIES.has(country);
	const isUnitedStates = country === "United States";
	const hasPostalCode = !NO_POSTAL_CODE_COUNTRIES.has(country);
	const hasCounty = !NO_COUNTY_COUNTRIES.has(country);

	return (
		<Section title="Location" icon={faLocationDot}>
			<FieldGrid>
				<Col>
					<SelectField
						label="Country"
						value={country}
						options={COUNTRY_OPTIONS}
						onChange={(v) => patchProperty({ country: v })}
					/>
				</Col>
				<Col>
					<SelectField
						label="Measurement System"
						value={property.measurementSystem ?? "Imperial"}
						options={MEASUREMENT_OPTIONS}
						onChange={(v) => patchProperty({ measurementSystem: v })}
					/>
				</Col>
				{!isStandardCountry && (
					<Col>
						<TextField
							label="Country Name Override"
							value={property.countryNameOverride ?? ""}
							onChange={(v) => patchProperty({ countryNameOverride: v })}
						/>
					</Col>
				)}
				{!isUnitedStates && (
					<>
						<Col>
							<SelectField
								label="Currency"
								value={property.currency ?? ""}
								options={CURRENCY_OPTIONS}
								onChange={(v) => patchProperty({ currency: v })}
							/>
						</Col>
						<Col>
							<SelectField
								label="Currency Format"
								value={property.currencyFormat ?? ""}
								options={CURRENCY_FORMAT_OPTIONS}
								onChange={(v) => patchProperty({ currencyFormat: v })}
							/>
						</Col>
						<Col>
							<SelectField
								label="Language"
								value={property.language ?? ""}
								options={LANGUAGE_OPTIONS}
								onChange={(v) => patchProperty({ language: v })}
							/>
						</Col>
					</>
				)}
			</FieldGrid>

			<FieldGrid>
				<Col>
					<TextField
						label="Address"
						value={property.street}
						onChange={(v) => patchProperty({ street: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="City"
						value={property.city}
						onChange={(v) => patchProperty({ city: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="State"
						value={property.state}
						onChange={(v) => patchProperty({ state: v })}
					/>
				</Col>
				{hasPostalCode && (
					<Col>
						<TextField
							label="Zip"
							value={property.zip}
							onChange={(v) => patchProperty({ zip: v })}
						/>
					</Col>
				)}
			</FieldGrid>

			<div style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Hide Address"
					checked={property.hideAddress ?? false}
					onChange={(v) => patchProperty({ hideAddress: v })}
				/>
			</div>
			{property.hideAddress && (
				<TextField
					label="Display Address As"
					value={property.displayAddressAs ?? ""}
					onChange={(v) => patchProperty({ displayAddressAs: v })}
				/>
			)}

			<div style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Override Map Location"
					checked={property.overrideMapLocation ?? false}
					onChange={(v) => patchProperty({ overrideMapLocation: v })}
				/>
			</div>
			{property.overrideMapLocation && (
				<FieldGrid>
					<Col>
						<NumberField
							label="Latitude"
							value={property.lat ?? null}
							onChange={(v) => patchProperty({ lat: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Longitude"
							value={property.lng ?? null}
							onChange={(v) => patchProperty({ lng: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
			)}

			<FieldGrid>
				{hasCounty && (
					<Col>
						<TextField
							label="County"
							value={property.county}
							onChange={(v) => patchProperty({ county: v })}
						/>
					</Col>
				)}
				<Col>
					<TextField
						label="Market"
						value={property.market ?? ""}
						onChange={(v) => patchProperty({ market: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="Submarket"
						value={property.submarket}
						onChange={(v) => patchProperty({ submarket: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="Cross Streets"
						value={property.crossStreets ?? ""}
						onChange={(v) => patchProperty({ crossStreets: v })}
					/>
				</Col>
			</FieldGrid>

			<TextField
				label="Location Description"
				textarea
				value={marketing.locationDescription}
				onChange={(v) => patchMarketing({ locationDescription: v })}
			/>
			<div style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Display Location Description for Syndication"
					checked={marketing.displayLocationDescriptionForSyndication ?? false}
					onChange={(v) =>
						patchMarketing({ displayLocationDescriptionForSyndication: v })
					}
				/>
			</div>

			<Accordion variant="inline">
				<Accordion.Item value="location-more">
					<Accordion.Trigger>
						<span className="fw-semibold">Show/Hide Additional Fields</span>
					</Accordion.Trigger>
					<Accordion.Content>
						<FieldGrid>
							<Col>
								<TextField
									label="Township"
									value={property.township ?? ""}
									onChange={(v) => patchProperty({ township: v })}
								/>
							</Col>
							<Col>
								<TextField
									label="Range"
									value={property.range ?? ""}
									onChange={(v) => patchProperty({ range: v })}
								/>
							</Col>
							<Col>
								<TextField
									label="Section"
									value={property.section ?? ""}
									onChange={(v) => patchProperty({ section: v })}
								/>
							</Col>
							<Col>
								<TextField
									label="Side of Street"
									value={property.sideOfStreet ?? ""}
									onChange={(v) => patchProperty({ sideOfStreet: v })}
								/>
							</Col>
							<Col>
								<SelectField
									label="Street Parking"
									value={property.streetParking ?? "NA"}
									options={YES_NO_NA_OPTIONS}
									labels={YES_NO_NA_LABELS}
									onChange={(v) => patchProperty({ streetParking: v })}
								/>
							</Col>
							<Col>
								<SelectField
									label="Signal Intersection"
									value={property.signalIntersection ?? "NA"}
									options={YES_NO_NA_OPTIONS}
									labels={YES_NO_NA_LABELS}
									onChange={(v) => patchProperty({ signalIntersection: v })}
								/>
							</Col>
							<Col>
								<TextField
									label="Road Type"
									value={property.roadType ?? ""}
									onChange={(v) => patchProperty({ roadType: v })}
								/>
							</Col>
							<Col>
								<TextField
									label="Market Type"
									value={property.marketType ?? ""}
									onChange={(v) => patchProperty({ marketType: v })}
								/>
							</Col>
							<Col>
								<TextField
									label="Nearest Highway"
									value={property.nearestHighway ?? ""}
									onChange={(v) => patchProperty({ nearestHighway: v })}
								/>
							</Col>
							<Col>
								<TextField
									label="Nearest Airport"
									value={property.nearestAirport ?? ""}
									onChange={(v) => patchProperty({ nearestAirport: v })}
								/>
							</Col>
						</FieldGrid>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		</Section>
	);
}
