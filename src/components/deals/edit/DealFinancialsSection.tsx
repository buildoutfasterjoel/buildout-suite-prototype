import type { DealPitchFinancials } from "#/data/types";
import {
	capRate,
	grossIncome,
	totalScheduledIncome,
	vacancyCost,
} from "#/data/listingFinancials";
import {
	Col,
	FieldGrid,
	NumberField,
	Readout,
	SwitchRow,
} from "#/components/common/recordForm/fieldWidgets";
import { SubGroup } from "#/components/common/recordForm/FieldGroup";
import { LineItemEditor } from "#/components/deals/edit/LineItemEditor";
import { ScenarioEditor } from "#/components/deals/edit/ScenarioEditor";
import { formatCalcAmount, formatCalcPercent } from "#/components/deals/edit/calcFormat";

/**
 * The Deal page's Financials clusters: Pricing, Income, Expenses, Debt, and
 * Scenarios. Emits {@link SubGroup}s only — the caller owns the `FieldGroup`
 * heading, the same split `ListingFormEditor` uses for the Listing sections.
 * Sale-only; the caller's `financials` group decides whether it renders.
 *
 * Each computed figure is a {@link Readout} inside the cluster whose inputs
 * produce it, rather than a read-only input in a block of its own — so the
 * computed cap rate sits under the entered one, and the three income figures sit
 * under the fields that drive them.
 *
 * This group deliberately has NO `AdditionalFields` disclosure: `askingPrice` and
 * `noi` carry ingestion conflicts, and a closed `Collapsible` is `display: none`,
 * which would make `?review=ingestion`'s `scrollIntoView` a silent no-op.
 */
export function DealFinancialsSection({
	financials,
	patchFinancials,
}: {
	financials: DealPitchFinancials;
	patchFinancials: (p: Partial<DealPitchFinancials>) => void;
}) {
	const totalScheduled = totalScheduledIncome(
		financials.grossScheduledIncome,
		financials.otherIncome,
	);
	const vacancy = vacancyCost(
		financials.grossScheduledIncome,
		financials.vacancyPct,
	);

	return (
		<>
			<SubGroup label="Pricing" description="What the asset is priced at.">
				<FieldGrid>
					<Col>
						{/* `gap-2` is the bound tier: Hide price governs Asking Price, so it
						    sits under it. It used to float at the end of the cluster, below the
						    computed cap rate, where it read as hiding the calculated figure. */}
						<div className="d-flex flex-column gap-2">
							<NumberField
								label="Asking Price"
								value={financials.askingPrice}
								onChange={(v) => patchFinancials({ askingPrice: v ?? 0 })}
								fieldKey="askingPrice"
							/>
							<SwitchRow
								label="Hide price"
								checked={financials.hidePrice}
								onChange={(v) => patchFinancials({ hidePrice: v })}
							/>
						</div>
					</Col>
					<Col>
						<NumberField
							label="NOI"
							value={financials.noi}
							onChange={(v) => patchFinancials({ noi: v ?? 0 })}
							fieldKey="noi"
						/>
					</Col>
					<Col>
						<NumberField
							label="Cap Rate %"
							value={financials.capRate}
							onChange={(v) => patchFinancials({ capRate: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
				{/* NOI lives here, not under Income: it is the numerator of the
				    computed cap rate, and `noi()` (gross − opex) is never called on
				    this form, so NOI is entered rather than derived. */}
				<Readout
					label="Computed cap rate"
					value={formatCalcPercent(capRate(financials.noi, financials.askingPrice))}
				/>
			</SubGroup>

			<SubGroup label="Income" description="What the asset takes in.">
				<FieldGrid>
					<Col>
						<NumberField
							label="Gross Scheduled Income"
							value={financials.grossScheduledIncome || null}
							onChange={(v) => patchFinancials({ grossScheduledIncome: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Other Income"
							value={financials.otherIncome || null}
							onChange={(v) => patchFinancials({ otherIncome: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Vacancy %"
							value={financials.vacancyPct || null}
							onChange={(v) => patchFinancials({ vacancyPct: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
				<LineItemEditor
					title="Income"
					items={financials.income}
					onChange={(v) => patchFinancials({ income: v })}
				/>
				<Readout
					label="Total scheduled income"
					value={formatCalcAmount(totalScheduled)}
				/>
				<Readout label="Vacancy cost" value={formatCalcAmount(vacancy)} />
				<Readout
					label="Gross income"
					value={formatCalcAmount(grossIncome(totalScheduled, vacancy))}
				/>
			</SubGroup>

			<SubGroup label="Expenses" description="What it costs to run.">
				<FieldGrid>
					<Col>
						<NumberField
							label="Operating Expenses"
							value={financials.operatingExpenses}
							onChange={(v) => patchFinancials({ operatingExpenses: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
				<LineItemEditor
					title="Expenses"
					items={financials.expenses}
					onChange={(v) => patchFinancials({ expenses: v })}
				/>
			</SubGroup>

			<SubGroup label="Debt" description="How the purchase is financed.">
				<FieldGrid>
					<Col>
						<NumberField
							label="Loan Amount"
							value={financials.loanAmount || null}
							onChange={(v) => patchFinancials({ loanAmount: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Down Payment"
							value={financials.downPayment || null}
							onChange={(v) => patchFinancials({ downPayment: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Debt Service"
							value={financials.debtService || null}
							onChange={(v) => patchFinancials({ debtService: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Cash Flow"
							value={financials.cashFlow || null}
							onChange={(v) => patchFinancials({ cashFlow: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup label="Scenarios" description="Alternate underwriting cases.">
				<ScenarioEditor
					scenarios={financials.scenarios}
					onChange={(v) => patchFinancials({ scenarios: v })}
				/>
			</SubGroup>
		</>
	);
}
