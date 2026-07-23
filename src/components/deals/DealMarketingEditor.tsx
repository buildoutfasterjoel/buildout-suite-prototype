import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faArrowUp,
	faArrowDown,
	faPlus,
	faTrashCan,
	faGear,
	faFileContract,
	faChartLine,
	faHandshake,
	faBuildingColumns,
} from "@fortawesome/pro-regular-svg-icons";
import type {
	DealBroker,
	DealPitchFinancials,
	DealTransaction,
	DealType,
	ExpenseLineItem,
	FinancialScenario,
	IncomeLineItem,
	Listing,
	Property,
	PropertyStatus,
} from "#/data/types";
import { updateDeal } from "#/data/actions";
import { updateProperty } from "#/data/store";
import {
	commissionAmountFromPct,
	commissionPctFromAmount,
} from "#/data/commission";
import {
	totalScheduledIncome,
	vacancyCost,
	grossIncome,
	capRate,
} from "#/data/listingFinancials";
import {
	STATUS_LABELS,
	PROPERTY_STATUSES,
} from "#/components/properties/propertyDisplay";
import { Section } from "#/components/listings/listingWidgets";
import {
	TextField,
	NumberField,
	DateField,
	SelectField,
	SwitchRow,
	FieldGrid,
	Col,
} from "#/components/listings/edit/fieldWidgets";
import { ListingFormEditor } from "#/components/listings/edit/ListingFormEditor";

// ── Broker rows ──────────────────────────────────────────────────────────────
function BrokerEditor({
	title,
	brokers,
	side,
	onChange,
}: {
	title: string;
	brokers: DealBroker[];
	side: "internal" | "outside";
	onChange: (v: DealBroker[]) => void;
}) {
	const update = (id: string, patch: Partial<DealBroker>) =>
		onChange(brokers.map((b) => (b.id === id ? { ...b, ...patch } : b)));
	const add = () =>
		onChange([
			...brokers,
			{
				id: crypto.randomUUID(),
				name: "",
				role: "Co-Broker",
				email: "",
				side,
				commissionSplitPct: 0,
				grossCommission: 0,
			},
		]);
	return (
		<div className="d-flex flex-column gap-3">
			<div className="d-flex align-items-center justify-content-between">
				<span className="fw-semibold">{title}</span>
				<Button variant="ghost" size="sm" onClick={add}>
					<FontAwesomeIcon icon={faPlus} />
					Add broker
				</Button>
			</div>
			{brokers.length === 0 ? (
				<p className="text-muted mb-0">No {side} brokers on this deal.</p>
			) : (
				brokers.map((b) => (
					<div key={b.id} className="row g-2 align-items-end">
						<div className="col-md-7">
							<TextField
								label="Name"
								value={b.name}
								onChange={(v) => update(b.id, { name: v })}
							/>
						</div>
						<div className="col-md-4">
							<NumberField
								label="Split %"
								value={b.commissionSplitPct}
								onChange={(v) => update(b.id, { commissionSplitPct: v ?? 0 })}
							/>
						</div>
						<div className="col-md-1 d-flex justify-content-end pb-1">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Remove broker"
								onClick={() => onChange(brokers.filter((x) => x.id !== b.id))}
							>
								<FontAwesomeIcon icon={faTrashCan} />
							</Button>
						</div>
					</div>
				))
			)}
		</div>
	);
}

// ── Line-item editor (income / expenses) ─────────────────────────────────────
function LineItemEditor<T extends IncomeLineItem | ExpenseLineItem>({
	title,
	items,
	onChange,
}: {
	title: string;
	items: T[];
	onChange: (v: T[]) => void;
}) {
	const total = items.reduce((sum, i) => sum + i.amount, 0);
	return (
		<div className="d-flex flex-column gap-2">
			<div className="d-flex align-items-center justify-content-between">
				<span className="fw-semibold">{title}</span>
				<span className="text-muted">Total ${total.toLocaleString()}</span>
			</div>
			{items.map((item) => (
				<div key={item.id} className="d-flex align-items-center gap-2">
					<Input
						value={item.label}
						placeholder="Label"
						onChange={(e) =>
							onChange(
								items.map((x) =>
									x.id === item.id ? { ...x, label: e.target.value } : x,
								),
							)
						}
					/>
					<Input
						type="number"
						style={{ maxWidth: 160 }}
						value={item.amount}
						onChange={(e) =>
							onChange(
								items.map((x) =>
									x.id === item.id
										? { ...x, amount: Number(e.target.value) }
										: x,
								),
							)
						}
					/>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Remove line item"
						onClick={() => onChange(items.filter((x) => x.id !== item.id))}
					>
						<FontAwesomeIcon icon={faTrashCan} />
					</Button>
				</div>
			))}
			<div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						onChange([
							...items,
							{ id: crypto.randomUUID(), label: "", amount: 0 } as T,
						])
					}
				>
					<FontAwesomeIcon icon={faPlus} />
					Add line item
				</Button>
			</div>
		</div>
	);
}

// ── Scenario editor (reorderable) ────────────────────────────────────────────
function ScenarioEditor({
	scenarios,
	onChange,
}: {
	scenarios: FinancialScenario[];
	onChange: (v: FinancialScenario[]) => void;
}) {
	const move = (i: number, dir: -1 | 1) => {
		const j = i + dir;
		if (j < 0 || j >= scenarios.length) return;
		const next = [...scenarios];
		[next[i], next[j]] = [next[j], next[i]];
		onChange(next);
	};
	const update = (id: string, patch: Partial<FinancialScenario>) =>
		onChange(scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)));
	return (
		<div className="d-flex flex-column gap-3">
			<div className="d-flex align-items-center justify-content-between">
				<span className="fw-semibold">Scenarios</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						onChange([
							...scenarios,
							{
								id: crypto.randomUUID(),
								name: "New scenario",
								noi: 0,
								capRate: 0,
								cashFlow: 0,
							},
						])
					}
				>
					<FontAwesomeIcon icon={faPlus} />
					Add scenario
				</Button>
			</div>
			{scenarios.map((s, i) => (
				<div
					key={s.id}
					className="border rounded p-3"
					style={{ borderRadius: 6 }}
				>
					<div className="d-flex align-items-center gap-2 mb-2">
						<div className="d-flex flex-column">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Move scenario up"
								disabled={i === 0}
								onClick={() => move(i, -1)}
							>
								<FontAwesomeIcon icon={faArrowUp} />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Move scenario down"
								disabled={i === scenarios.length - 1}
								onClick={() => move(i, 1)}
							>
								<FontAwesomeIcon icon={faArrowDown} />
							</Button>
						</div>
						<div className="flex-grow-1">
							<Input
								value={s.name}
								onChange={(e) => update(s.id, { name: e.target.value })}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remove scenario"
							onClick={() => onChange(scenarios.filter((x) => x.id !== s.id))}
						>
							<FontAwesomeIcon icon={faTrashCan} />
						</Button>
					</div>
					<FieldGrid>
						<div className="col-md-4">
							<NumberField
								label="NOI"
								value={s.noi}
								onChange={(v) => update(s.id, { noi: v ?? 0 })}
							/>
						</div>
						<div className="col-md-4">
							<NumberField
								label="Cap Rate %"
								value={s.capRate}
								onChange={(v) => update(s.id, { capRate: v ?? 0 })}
							/>
						</div>
						<div className="col-md-4">
							<NumberField
								label="Cash Flow"
								value={s.cashFlow}
								onChange={(v) => update(s.id, { cashFlow: v ?? 0 })}
							/>
						</div>
					</FieldGrid>
				</div>
			))}
		</div>
	);
}

/**
 * Two-tab edit shell (Deal + Listing) for a listing. Holds ONE shared working
 * copy in local state — the deal fields plus a `propertyDraft` — behind a single
 * Save/Cancel bar. Save commits both sides ({@link updateDeal} +
 * {@link updateProperty}); Cancel discards. The Deal tab owns Setup, Brokers,
 * Transaction, and Financials; the Listing tab renders {@link ListingFormEditor}.
 */
export function DealMarketingEditor({
	listing,
	property,
}: {
	listing: Listing;
	property: Property;
}) {
	const navigate = useNavigate();
	const back = () =>
		navigate({
			to: "/listings/$listingId/overview",
			params: { listingId: listing.id },
		});

	const [tab, setTab] = useState<"deal" | "listing">("deal");
	const [propertyDraft, setPropertyDraft] = useState<Property>(property);
	const patchProperty = (patch: Partial<Property>) =>
		setPropertyDraft((p) => ({ ...p, ...patch }));

	const [status, setStatus] = useState<PropertyStatus>(listing.status);
	// Deal Type is fixed for a listing — kept in state so Save still persists it,
	// but rendered read-only (no setter).
	const [dealType] = useState<DealType>(listing.dealType);
	const [internalBrokers, setInternalBrokers] = useState<DealBroker[]>(
		listing.internalBrokers,
	);
	const [outsideBrokers, setOutsideBrokers] = useState<DealBroker[]>(
		listing.outsideBrokers,
	);
	const [transaction, setTransaction] = useState<DealTransaction>(
		listing.transaction,
	);
	const [financials, setFinancials] = useState<DealPitchFinancials>(
		listing.financials,
	);
	const [marketing, setMarketing] = useState(listing.marketing);
	const [internalNotes, setInternalNotes] = useState(listing.internalNotes);

	const isSale = dealType !== "Lease";

	const patchMarketing = (patch: Partial<typeof marketing>) =>
		setMarketing((m) => ({ ...m, ...patch }));
	const patchFinancials = (patch: Partial<DealPitchFinancials>) =>
		setFinancials((f) => ({ ...f, ...patch }));
	const patchTransaction = (patch: Partial<DealTransaction>) =>
		setTransaction((t) => ({ ...t, ...patch }));

	// Sale Price / Gross Commission % / Gross Commission $ — bi-directional, sale
	// price anchors (same math as the stage gate and Edit Transaction dialog).
	const setSalePrice = (v: number | null) =>
		setTransaction((t) => ({
			...t,
			salePrice: v ?? 0,
			commissionAmount:
				v != null && t.commissionPct != null
					? commissionAmountFromPct(v, t.commissionPct)
					: t.commissionAmount,
		}));
	const setCommissionPct = (v: number | null) =>
		setTransaction((t) => ({
			...t,
			commissionPct: v ?? 0,
			commissionAmount:
				v != null && t.salePrice != null
					? commissionAmountFromPct(t.salePrice, v)
					: t.commissionAmount,
		}));
	const setCommissionAmount = (v: number | null) =>
		setTransaction((t) => ({
			...t,
			commissionAmount: v ?? 0,
			commissionPct:
				v != null && t.salePrice > 0
					? commissionPctFromAmount(t.salePrice, v)
					: t.commissionPct,
		}));

	const save = () => {
		updateDeal(listing.id, {
			status,
			dealType,
			internalBrokers,
			outsideBrokers,
			transaction,
			financials,
			marketing,
			internalNotes,
		});
		updateProperty(property.id, propertyDraft);
		back();
	};

	const actions = (
		<>
			<Button variant="ghost" onClick={back}>
				Cancel
			</Button>
			<Button variant="primary" onClick={save}>
				Save
			</Button>
		</>
	);

	return (
		<div className="d-flex flex-column gap-6 p-4">
			<div className="d-flex align-items-center justify-content-between gap-3">
				<h2 className="fs-6 mb-0 fw-semibold">Edit Listing</h2>
				<div className="d-flex align-items-center gap-2">{actions}</div>
			</div>

			<Tabs value={tab} onValueChange={(v) => setTab(v as "deal" | "listing")}>
				<Tabs.List>
					<Tabs.Tab value="deal" icon={<FontAwesomeIcon icon={faHandshake} />}>
						Deal
					</Tabs.Tab>
					<Tabs.Tab
						value="listing"
						icon={<FontAwesomeIcon icon={faBuildingColumns} />}
					>
						Listing
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>

			{tab === "deal" ? (
				<div className="d-flex flex-column gap-6">
					{/* ── Setup / status ── */}
					<Section title="Setup & Status" icon={faGear}>
						<FieldGrid>
							<Col>
								<Field>
									<Field.Label>Deal Type</Field.Label>
									<Input readOnly value={dealType} />
								</Field>
							</Col>
							<Col>
								<SelectField
									label="Status"
									value={status}
									options={PROPERTY_STATUSES}
									labels={STATUS_LABELS}
									onChange={setStatus}
								/>
							</Col>
							<Col>
								<DateField
									label="Listed On"
									value={transaction.listedOnDate}
									onChange={(v) => patchTransaction({ listedOnDate: v })}
								/>
							</Col>
							<Col>
								<DateField
									label="Listing Expiration"
									value={transaction.listingExpirationDate}
									onChange={(v) =>
										patchTransaction({ listingExpirationDate: v })
									}
								/>
							</Col>
						</FieldGrid>
						<BrokerEditor
							title="Internal Brokers"
							brokers={internalBrokers}
							side="internal"
							onChange={setInternalBrokers}
						/>
						<BrokerEditor
							title="Outside Brokers"
							brokers={outsideBrokers}
							side="outside"
							onChange={setOutsideBrokers}
						/>
					</Section>

					<Separator />

					{/* ── Transaction terms (parity with the stage gate + Edit Transaction dialog) ── */}
					<Section title="Transaction Terms" icon={faFileContract}>
						<FieldGrid>
							<Col>
								<NumberField
									label="Sale Price"
									value={transaction.salePrice || null}
									onChange={setSalePrice}
								/>
							</Col>
							<Col>
								<NumberField
									label="Gross Commission %"
									value={transaction.commissionPct || null}
									onChange={setCommissionPct}
								/>
							</Col>
							<Col>
								<NumberField
									label="Gross Commission $"
									value={transaction.commissionAmount || null}
									onChange={setCommissionAmount}
								/>
							</Col>
							<Col>
								<NumberField
									label="Close Probability (%)"
									value={transaction.closeProbability || null}
									onChange={(v) =>
										patchTransaction({ closeProbability: v ?? 0 })
									}
								/>
							</Col>
							<Col>
								<DateField
									label="Contract Executed"
									value={transaction.contractExecutedDate}
									onChange={(v) =>
										patchTransaction({ contractExecutedDate: v })
									}
								/>
							</Col>
							<Col>
								<DateField
									label="Close Date"
									value={transaction.closeDate}
									onChange={(v) => patchTransaction({ closeDate: v })}
								/>
							</Col>
						</FieldGrid>
					</Section>

					{isSale && <Separator />}

					{/* ── Financials ── */}
					{isSale && (
						<Section title="Financials" icon={faChartLine}>
							<FieldGrid>
								<Col>
									<NumberField
										label="Asking Price"
										value={financials.askingPrice}
										onChange={(v) => patchFinancials({ askingPrice: v ?? 0 })}
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
											value={
												totalScheduledIncome(
													financials.grossScheduledIncome,
													financials.otherIncome,
												) ?? ""
											}
										/>
									</Field>
								</Col>
								<Col>
									<Field>
										<Field.Label>Vacancy Cost (calc)</Field.Label>
										<Input
											readOnly
											value={
												vacancyCost(
													financials.grossScheduledIncome,
													financials.vacancyPct,
												) ?? ""
											}
										/>
									</Field>
								</Col>
								<Col>
									<Field>
										<Field.Label>Gross Income (calc)</Field.Label>
										<Input
											readOnly
											value={
												grossIncome(
													totalScheduledIncome(
														financials.grossScheduledIncome,
														financials.otherIncome,
													),
													vacancyCost(
														financials.grossScheduledIncome,
														financials.vacancyPct,
													),
												) ?? ""
											}
										/>
									</Field>
								</Col>
								<Col>
									<Field>
										<Field.Label>Cap Rate (calc)</Field.Label>
										<Input
											readOnly
											value={
												capRate(financials.noi, financials.askingPrice) ?? ""
											}
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
					)}
				</div>
			) : (
				<ListingFormEditor
					listing={listing}
					dealType={dealType}
					status={status}
					marketing={marketing}
					patchMarketing={patchMarketing}
					property={propertyDraft}
					patchProperty={patchProperty}
					financials={financials}
					patchFinancials={patchFinancials}
					internalNotes={internalNotes}
					setInternalNotes={setInternalNotes}
				/>
			)}

			<div className="d-flex justify-content-end gap-2 border-top pt-4">
				{actions}
			</div>
		</div>
	);
}
