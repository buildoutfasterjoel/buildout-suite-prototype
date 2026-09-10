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
	ReadoutCards,
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
 * This group deliberately has NO `AdditionalFields` disclosure: `noi` carries an
 * ingestion conflict, and a closed `Collapsible` is `display: none`, which would
 * make `?review=ingestion`'s `scrollIntoView` a silent no-op. `askingPrice`
 * carries one too, and its field moved to the Listing page's Sale section — so
 * the same constraint went with it, and so did its `CONFLICT_PAGE` entry.
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
			<SubGroup label="Pricing" description="What the asset is valued at.">
				<FieldGrid>
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
				    this form, so NOI is entered rather than derived.

				    The asking price is the denominator, and it is entered on the
				    Listing page now — it is the figure the marketing prints, so it
				    sits beside the copy that prints it. Echoed here read-only rather
				    than dropped: a cap rate divided by a number that appears nowhere
				    on the page is a figure nobody can check, and the row doubles as
				    the pointer to where the field went. */}
				<Readout
					label="Asking price (on the Listing form)"
					value={formatCalcAmount(financials.askingPrice)}
				/>
				<Readout
					label="Computed cap rate"
					value={formatCalcPercent(capRate(financials.noi, financials.askingPrice))}
				/>
			</SubGroup>

			<SubGroup label="Income" description="What the asset takes in.">
				<FieldGrid>
					<Col>
						{/* Not "Gross Scheduled Income": at 156px it was the one label too
						    wide for the 164px gutter's content box, and the cluster it sits
						    in is already named Income. */}
						<NumberField
							label="Gross Scheduled"
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
				{/* Above the line-item table, not below it. All three figures derive
				    from the three fields in the grid — the table's own rows feed none of
				    them, and it carries its own Total — so sitting after it made them
				    read as that table's summary.
				    Cards rather than three `Readout` rows: stacked, they read as three
				    more form rows in a column that is otherwise all inputs. */}
				<ReadoutCards
					items={[
						{
							label: "Total scheduled income",
							value: formatCalcAmount(totalScheduled),
						},
						{ label: "Vacancy cost", value: formatCalcAmount(vacancy) },
						{
							label: "Gross income",
							value: formatCalcAmount(grossIncome(totalScheduled, vacancy)),
						},
					]}
				/>
				<LineItemEditor
					title="Income"
					items={financials.income}
					onChange={(v) => patchFinancials({ income: v })}
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
