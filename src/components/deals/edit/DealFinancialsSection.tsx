import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { faChartLine } from "@fortawesome/pro-regular-svg-icons";
import type { DealPitchFinancials } from "#/data/types";
import {
	capRate,
	grossIncome,
	totalScheduledIncome,
	vacancyCost,
} from "#/data/listingFinancials";
import { Section } from "#/components/listings/listingWidgets";
import {
	Col,
	FieldGrid,
	NumberField,
	SwitchRow,
} from "#/components/listings/edit/fieldWidgets";
import { LineItemEditor } from "#/components/deals/edit/LineItemEditor";
import { ScenarioEditor } from "#/components/deals/edit/ScenarioEditor";

// ── Read-only computed-field display formatting ─────────────────────────────
/** Rounded, comma-formatted currency-ish figure; blank (not "0") when null. */
function formatCalcAmount(v: number | null): string {
	return v == null ? "" : Math.round(v).toLocaleString();
}
/** Percentage with 2 decimals; blank (not "0.00") when null. */
function formatCalcPercent(v: number | null): string {
	return v == null ? "" : `${v.toFixed(2)}%`;
}

/**
 * The Deal page's Financials block: the editable pitch numbers, the four
 * read-only computed rows beneath them, the hide-price switch, and the income /
 * expense / scenario editors. Sale-only — the caller decides whether to render it.
 */
export function DealFinancialsSection({
	financials,
	patchFinancials,
}: {
	financials: DealPitchFinancials;
	patchFinancials: (p: Partial<DealPitchFinancials>) => void;
}) {
	return (
		<Section title="Financials" icon={faChartLine}>
			<FieldGrid>
				<Col>
					<NumberField
						label="Asking Price"
						value={financials.askingPrice}
						onChange={(v) => patchFinancials({ askingPrice: v ?? 0 })}
						fieldKey="askingPrice"
					/>
				</Col>
				<Col>
					<NumberField
						label="Cap Rate %"
						value={financials.capRate}
						onChange={(v) => patchFinancials({ capRate: v ?? 0 })}
					/>
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
						label="Operating Expenses"
						value={financials.operatingExpenses}
						onChange={(v) =>
							patchFinancials({ operatingExpenses: v ?? 0 })
						}
					/>
				</Col>
				<Col>
					<NumberField
						label="Gross Scheduled Income"
						value={financials.grossScheduledIncome || null}
						onChange={(v) =>
							patchFinancials({ grossScheduledIncome: v ?? 0 })
						}
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

			{/* Computed underwriting (read-only; blank until inputs exist) */}
			<FieldGrid>
				<Col>
					<Field>
						<Field.Label>Total Scheduled Income (calc)</Field.Label>
						<Input
							readOnly
							value={formatCalcAmount(
								totalScheduledIncome(
									financials.grossScheduledIncome,
									financials.otherIncome,
								),
							)}
						/>
					</Field>
				</Col>
				<Col>
					<Field>
						<Field.Label>Vacancy Cost (calc)</Field.Label>
						<Input
							readOnly
							value={formatCalcAmount(
								vacancyCost(
									financials.grossScheduledIncome,
									financials.vacancyPct,
								),
							)}
						/>
					</Field>
				</Col>
				<Col>
					<Field>
						<Field.Label>Gross Income (calc)</Field.Label>
						<Input
							readOnly
							value={formatCalcAmount(
								grossIncome(
									totalScheduledIncome(
										financials.grossScheduledIncome,
										financials.otherIncome,
									),
									vacancyCost(
										financials.grossScheduledIncome,
										financials.vacancyPct,
									),
								),
							)}
						/>
					</Field>
				</Col>
				<Col>
					<Field>
						<Field.Label>Cap Rate (calc)</Field.Label>
						<Input
							readOnly
							value={formatCalcPercent(
								capRate(financials.noi, financials.askingPrice),
							)}
						/>
					</Field>
				</Col>
			</FieldGrid>

			<div style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Hide price"
					checked={financials.hidePrice}
					onChange={(v) => patchFinancials({ hidePrice: v })}
				/>
			</div>
			<LineItemEditor
				title="Income"
				items={financials.income}
				onChange={(v) => patchFinancials({ income: v })}
			/>
			<LineItemEditor
				title="Expenses"
				items={financials.expenses}
				onChange={(v) => patchFinancials({ expenses: v })}
			/>
			<ScenarioEditor
				scenarios={financials.scenarios}
				onChange={(v) => patchFinancials({ scenarios: v })}
			/>
		</Section>
	);
}
