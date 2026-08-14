import { AdditionalFields, SubGroup } from "#/components/listings/edit/FieldGroup";
import {
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { US_STATES, stateLabel } from "#/components/contacts/usStates";
import { CoordinatePickerMap } from "#/components/listings/edit/CoordinatePickerMap";
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

/**
 * State is a picker only for the US, where the set is closed, official, and
 * already stored as the 2-letter code the rest of the app uses (seed listings
 * carry "TX", "IL", …; `NewContactModal` uses the same list). Every other
 * supported country keeps a free-text field — the form serves six countries
 * whose subdivisions are provinces, emirates, and counties, and shipping a
 * gazetteer for all of them is not what this asks for. Same country-conditional
 * shape as `hasPostalCode` and `hasCounty` below.
 */
const STATE_CODES = US_STATES.map((s) => s.code);
const STATE_LABELS: Record<string, string> = Object.fromEntries(
	STATE_CODES.map((code) => [code, stateLabel(code)]),
);

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
 * Listing page — Location. Country/address/map fields live on `property`
 * (persisted via `patchProperty`); the two location-description fields live on
 * `marketing` (persisted via `patchMarketing`) since they're syndication copy,
 * not property data. A collapsed `AdditionalFields` disclosure holds the
 * long-tail locale/surveyor/road fields that most listings never touch.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
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

	// Derived from the same booleans that gate the fields below (not a parallel
	// copy of the conditions) so the disclosure label can't drift from what's
	// actually inside it. Locale: Country + Measurement System are unconditional
	// (2), Country Name Override adds 1 when !isStandardCountry, Currency /
	// Currency Format / Language add 3 when !isUnitedStates. Legal & Frontage's
	// 10 fields are all unconditional.
	const localeFieldCount =
		2 + (isStandardCountry ? 0 : 1) + (isUnitedStates ? 0 : 3);
	const legalFrontageFieldCount = 10;
	const additionalLocationFieldCount =
		localeFieldCount + legalFrontageFieldCount;

	return (
		<>
			<SubGroup
				label="Address"
				description="Where the property sits, and how that reads publicly."
			>
				{/* Even 2x2. These were 6/3/3 + a 3-wide Zip, which filled the first
				    row exactly and left Zip stranded alone on the second. Now that a
				    field carries its label inside the control, half width is the
				    natural size for all four — no field here needs more. */}
				<FieldGrid>
					<Col span={6}>
						<TextField
							label="Address"
							value={property.street}
							onChange={(v) => patchProperty({ street: v })}
						/>
					</Col>
					<Col span={6}>
						<TextField
							label="City"
							value={property.city}
							onChange={(v) => patchProperty({ city: v })}
						/>
					</Col>
					<Col span={6}>
						{isUnitedStates ? (
							<SelectField
								label="State"
								value={property.state || null}
								options={STATE_CODES}
								labels={STATE_LABELS}
								placeholder="Select a state…"
								onChange={(v) => patchProperty({ state: v })}
							/>
						) : (
							<TextField
								label="State"
								value={property.state}
								onChange={(v) => patchProperty({ state: v })}
							/>
						)}
					</Col>
					{hasPostalCode && (
						<Col span={6}>
							<TextField
								label="Zip"
								value={property.zip}
								onChange={(v) => patchProperty({ zip: v })}
							/>
						</Col>
					)}
				</FieldGrid>

				<SwitchRow
					label="Hide Address"
					checked={property.hideAddress ?? false}
					onChange={(v) => patchProperty({ hideAddress: v })}
				/>
				{property.hideAddress && (
					<TextField
						label="Display Address As"
						value={property.displayAddressAs ?? ""}
						onChange={(v) => patchProperty({ displayAddressAs: v })}
					/>
				)}
			</SubGroup>

			<SubGroup
				label="Map"
				description="Where the pin drops on syndicated maps."
			>
				<SwitchRow
					label="Override Map Location"
					checked={property.overrideMapLocation ?? false}
					onChange={(v) => patchProperty({ overrideMapLocation: v })}
				/>
				{property.overrideMapLocation && (
					// Stacked pair on the left, square map on the right. The two are
					// one control in two forms: the map reports every click back
					// through the same patch the inputs use, so neither can drift
					// from the other. Deliberately not a `FieldGrid` — side-by-side
					// coordinates would each land under the ~330px an inline label
					// needs, which is the squeeze the span-6 rule exists to prevent.
					<div className="d-flex align-items-start gap-3">
						<div
							className="d-flex flex-column gap-2"
							style={{ flexBasis: 0, flexGrow: 1 }}
						>
							<NumberField
								label="Latitude"
								value={property.lat ?? null}
								onChange={(v) => patchProperty({ lat: v ?? 0 })}
							/>
							<NumberField
								label="Longitude"
								value={property.lng ?? null}
								onChange={(v) => patchProperty({ lng: v ?? 0 })}
							/>
						</div>
						<CoordinatePickerMap
							lat={property.lat ?? null}
							lng={property.lng ?? null}
							onPick={(lat, lng) => patchProperty({ lat, lng })}
						/>
					</div>
				)}
			</SubGroup>

			<SubGroup
				label="Market"
				description="Submarket and surroundings used for search and comps."
			>
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

				<FieldGrid>
					<Col span={12}>
						<TextField
							label="Description"
							textarea
							value={marketing.locationDescription}
							onChange={(v) => patchMarketing({ locationDescription: v })}
						/>
					</Col>
				</FieldGrid>
				<SwitchRow
					label="Display Location Description for Syndication"
					checked={marketing.displayLocationDescriptionForSyndication ?? false}
					onChange={(v) =>
						patchMarketing({ displayLocationDescriptionForSyndication: v })
					}
				/>
			</SubGroup>

			<AdditionalFields
				label={`Show ${additionalLocationFieldCount} more location fields`}
			>
				<SubGroup
					label="Locale"
					description="Country, units, and currency for this listing."
				>
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
				</SubGroup>

				<SubGroup
					label="Legal & Frontage"
					description="Survey references and road frontage detail."
				>
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
				</SubGroup>
			</AdditionalFields>
		</>
	);
}
