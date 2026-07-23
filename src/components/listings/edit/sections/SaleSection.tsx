import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { faBullhorn } from "@fortawesome/pro-regular-svg-icons";
import {
	BulletsField,
	Col,
	DateField,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import type {
	DealMarketing,
	InvestmentType,
	PropertyUse,
	YesNoNA,
} from "#/data/types";

// ── Option lists (string unions from the data model) ────────────────────────
const PROPERTY_USES: PropertyUse[] = [
	"Net Leased Investment",
	"Investment",
	"Owner/User",
	"Business for Sale",
	"Development",
];
const INVESTMENT_TYPES: InvestmentType[] = [
	"Core",
	"Core Plus",
	"Value Add",
	"Opportunistic",
	"Distressed",
];

const YES_NO_NA_OPTIONS: YesNoNA[] = ["Y", "N", "NA"];

/** Y/N/NA select, e.g. 1031 Exchange/Consider Exchange. */
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
 * Listing tab — Sale Marketing & Terms. Only rendered for Sale deals
 * (`dealType === "Sale"`). Title/description/bullets and the core deal terms
 * show up front; the Auction toggle reveals its own date/time/location/bid/URL
 * fields inline, and the long-tail tax/loan/exchange fields sit behind a
 * collapsed "Additional Fields" accordion.
 */
export function SaleSection({
	marketing,
	patchMarketing,
}: {
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
}) {
	return (
		<Section title="Sale Marketing & Terms" icon={faBullhorn}>
			<TextField
				label="Sale Title"
				value={marketing.saleTitle ?? ""}
				onChange={(v) => patchMarketing({ saleTitle: v })}
			/>
			<TextField
				label="Sale Description"
				textarea
				rows={4}
				value={marketing.saleDescription ?? ""}
				onChange={(v) => patchMarketing({ saleDescription: v })}
			/>
			<BulletsField
				label="Sale Bullets"
				bullets={marketing.saleBullets ?? []}
				onChange={(v) => patchMarketing({ saleBullets: v })}
			/>

			<FieldGrid>
				<Col>
					<SelectField
						label="Property Use"
						value={marketing.propertyUse}
						options={PROPERTY_USES}
						onChange={(v) => patchMarketing({ propertyUse: v })}
					/>
				</Col>
				<Col>
					<SelectField
						label="Investment Type"
						value={marketing.investmentType}
						options={INVESTMENT_TYPES}
						onChange={(v) => patchMarketing({ investmentType: v })}
					/>
				</Col>
			</FieldGrid>

			<TextField
				label="Sale Terms"
				textarea
				value={marketing.saleTerms ?? ""}
				onChange={(v) => patchMarketing({ saleTerms: v })}
			/>

			<FieldGrid>
				<Col>
					<TextField
						label="Reimbursement"
						value={marketing.reimbursement ?? ""}
						onChange={(v) => patchMarketing({ reimbursement: v })}
					/>
				</Col>
				<Col>
					<TextField
						label="Sale Closing Info"
						value={marketing.saleClosingInfo ?? ""}
						onChange={(v) => patchMarketing({ saleClosingInfo: v })}
					/>
				</Col>
			</FieldGrid>

			<div className="d-flex flex-column gap-1" style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Includes real estate"
					checked={marketing.includesRealEstate ?? false}
					onChange={(v) => patchMarketing({ includesRealEstate: v })}
				/>
			</div>

			<FieldGrid>
				<Col>
					<TextField
						label="Years Left on Lease"
						value={marketing.yearsLeftOnLease ?? ""}
						onChange={(v) => patchMarketing({ yearsLeftOnLease: v })}
					/>
				</Col>
				<Col>
					<DateField
						label="NNN Lease Expiration"
						value={marketing.nnnLeaseExpiration ?? null}
						onChange={(v) => patchMarketing({ nnnLeaseExpiration: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Commission %"
						value={marketing.saleCommissionPct ?? null}
						onChange={(v) => patchMarketing({ saleCommissionPct: v })}
					/>
				</Col>
				<Col>
					<NumberField
						label="Tax per Unit"
						value={marketing.taxPerUnit ?? null}
						onChange={(v) => patchMarketing({ taxPerUnit: v })}
					/>
				</Col>
			</FieldGrid>

			<div className="d-flex flex-column gap-3" style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Auction"
					checked={marketing.auction ?? false}
					onChange={(v) => patchMarketing({ auction: v })}
				/>
			</div>

			{marketing.auction && (
				<FieldGrid>
					<Col>
						<DateField
							label="Auction Date"
							value={marketing.auctionDate ?? null}
							onChange={(v) => patchMarketing({ auctionDate: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Auction Time"
							value={marketing.auctionTime ?? ""}
							onChange={(v) => patchMarketing({ auctionTime: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Auction Location"
							value={marketing.auctionLocation ?? ""}
							onChange={(v) => patchMarketing({ auctionLocation: v })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Auction Starting Bid"
							value={marketing.auctionStartingBid ?? null}
							onChange={(v) => patchMarketing({ auctionStartingBid: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Auction URL"
							value={marketing.auctionUrl ?? ""}
							onChange={(v) => patchMarketing({ auctionUrl: v })}
						/>
					</Col>
				</FieldGrid>
			)}

			<Accordion variant="inline">
				<Accordion.Item value="sale-more">
					<Accordion.Trigger>
						<span className="fw-semibold">Show/Hide Additional Fields</span>
					</Accordion.Trigger>
					<Accordion.Content>
						<div className="d-flex flex-column gap-3">
							<FieldGrid>
								<Col>
									<TextField
										label="Capital Costs"
										value={marketing.capitalCosts ?? ""}
										onChange={(v) => patchMarketing({ capitalCosts: v })}
									/>
								</Col>
								<Col>
									<DateField
										label="Loan Due Date"
										value={marketing.loanDueDate ?? null}
										onChange={(v) => patchMarketing({ loanDueDate: v })}
									/>
								</Col>
							</FieldGrid>

							<TextField
								label="Loan Description"
								textarea
								value={marketing.loanDescription ?? ""}
								onChange={(v) => patchMarketing({ loanDescription: v })}
							/>

							<TextField
								label="Taxes"
								textarea
								value={marketing.taxes ?? ""}
								onChange={(v) => patchMarketing({ taxes: v })}
							/>

							<FieldGrid>
								<Col>
									<NumberField
										label="Tax Value - Land"
										value={marketing.taxValueLand ?? null}
										onChange={(v) => patchMarketing({ taxValueLand: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Tax Value - Improvements"
										value={marketing.taxValueImprovements ?? null}
										onChange={(v) =>
											patchMarketing({ taxValueImprovements: v })
										}
									/>
								</Col>
								<Col>
									<NumberField
										label="Tax Value - Personal"
										value={marketing.taxValuePersonal ?? null}
										onChange={(v) => patchMarketing({ taxValuePersonal: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Assessed Value"
										value={marketing.assessedValue ?? null}
										onChange={(v) => patchMarketing({ assessedValue: v })}
									/>
								</Col>
							</FieldGrid>

							<FieldGrid>
								<Col>
									<YesNoNaField
										label="1031 Exchange"
										value={marketing.exchange1031}
										onChange={(v) => patchMarketing({ exchange1031: v })}
									/>
								</Col>
								<Col>
									<YesNoNaField
										label="Consider Exchange"
										value={marketing.considerExchange}
										onChange={(v) => patchMarketing({ considerExchange: v })}
									/>
								</Col>
							</FieldGrid>

							<TextField
								label="Land Ownership"
								value={marketing.landOwnership ?? ""}
								onChange={(v) => patchMarketing({ landOwnership: v })}
							/>

							<TextField
								label="Land Legal Description"
								textarea
								value={marketing.landLegalDescription ?? ""}
								onChange={(v) => patchMarketing({ landLegalDescription: v })}
							/>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion>
		</Section>
	);
}
