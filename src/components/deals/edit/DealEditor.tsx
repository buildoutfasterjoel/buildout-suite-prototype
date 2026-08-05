import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { faGear, faFileContract } from "@fortawesome/pro-regular-svg-icons";
import type {
	DealBroker,
	DealPitchFinancials,
	DealTransaction,
	DealType,
	IngestionFieldKey,
	Listing,
	PropertyStatus,
} from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { resolveIngestionConflict, updateDeal } from "#/data/actions";
import { availableStages, dealShape, dealStageLabel } from "#/data/dealShape";
import {
	commissionAmountFromPct,
	commissionPctFromAmount,
} from "#/data/commission";
import { Section } from "#/components/listings/listingWidgets";
import {
	NumberField,
	DateField,
	SelectField,
	FieldGrid,
	Col,
} from "#/components/listings/edit/fieldWidgets";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { notify } from "#/lib/notify";
import { useStageGate } from "#/components/deals/useStageGate";
import {
	IngestionConflictProvider,
	conflictRowId,
	countConflictsFor,
} from "#/components/deals/ingestionConflictContext";
import {
	conflictKeysOn,
	firstUnresolvedOn,
	otherPage,
} from "#/components/deals/ingestionRouting";
import { dealSavePatch } from "#/components/deals/edit/savePatches";
import { reseedDraft } from "#/components/deals/edit/reseedDraft";
import { BrokerEditor } from "#/components/deals/edit/BrokerEditor";
import { DealFinancialsSection } from "#/components/deals/edit/DealFinancialsSection";
import { PendingPublishBanner } from "#/components/deals/edit/PendingPublishBanner";

/**
 * Edit Deal (`/listings/:id/edit`): the deal-only half of what used to be the
 * two-tab edit form. Not a nav section — `/edit` isn't in `NAV_GROUPS` at all;
 * the header pencil is its only entry point (contrast the Listing page, which
 * IS a Marketing nav item). Holds a working copy of the six deal fields in
 * local state behind a single Save/Cancel bar; Save commits with
 * {@link updateDeal} and {@link dealSavePatch}, Cancel discards. Owns Setup &
 * Status, both {@link BrokerEditor}s, Transaction Terms, and
 * {@link DealFinancialsSection}.
 */
export function DealEditor({
	listing,
	review,
}: {
	listing: Listing;
	/** When "ingestion", scroll to the first conflicting field this page owns. */
	review?: "ingestion";
}) {
	const navigate = useNavigate();
	const back = () =>
		navigate({
			to: "/listings/$listingId/overview",
			params: { listingId: listing.id },
		});

	// Computed once — `dealShape` scans every listing to find children, so it
	// isn't free to call more than once per render.
	const shape = dealShape(listing);

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

	// An ingestion run commits a few seconds after the deal is created, so it can
	// land while the broker is already sitting in this form. `finishIngestion`
	// writes transaction / financials straight to the store — values these drafts
	// snapshotted at mount — so saving would silently revert them. Re-seed on that
	// ONE status transition out of `processing` (not on every store change, which
	// would fight the broker's typing), and even then only for keys left untouched
	// since mount.
	const ingestionStatus = listing.ingestion?.status;
	const previousIngestionStatus = useRef(ingestionStatus);
	const mountedListing = useRef(listing);
	useEffect(() => {
		const previous = previousIngestionStatus.current;
		previousIngestionStatus.current = ingestionStatus;
		if (previous !== "processing" || ingestionStatus === "processing") return;
		const base = mountedListing.current;
		setTransaction((d) => reseedDraft(d, base.transaction, listing.transaction));
		setFinancials((d) => reseedDraft(d, base.financials, listing.financials));
	}, [ingestionStatus, listing]);

	// A StageGate commit always appends a history entry, so a change in its
	// length catches every one of those — including a publish-in-place, where
	// the status doesn't move. It does NOT catch every way status can change,
	// though: `updateDealStage` (src/data/actions.ts) writes `status` and
	// `transaction.closeProbability` with no history entry, and it's reachable
	// from this page through the AI rail's `updateDealStage` tool
	// (src/ai/tools.ts), which is persistent chrome mounted alongside this
	// form. A stage change made that way while this page is open won't trigger
	// this re-seed — a known gap, not one this effect closes. Only untouched
	// keys are re-seeded, so a broker who already changed Status or a
	// Transaction field keeps their edit.
	//
	// This effect keeps its OWN base ref (`gateBase`) rather than reusing
	// `mountedListing`, and advances it on every fire. The stage picker in the
	// page header (`PropertyDetailHeader` → `DealStageSelect`) lets a broker
	// commit the gate more than once without ever leaving this page — a frozen
	// mount-time base would compare commit #2 against commit #1's already-stale
	// values and reject it, so "untouched since mount" has to be "untouched since
	// the last sync" instead.
	const historyLength = listing.history.length;
	const previousHistoryLength = useRef(historyLength);
	const gateBase = useRef(listing);
	useEffect(() => {
		const previous = previousHistoryLength.current;
		previousHistoryLength.current = historyLength;
		if (historyLength === previous) return;
		const base = gateBase.current;
		gateBase.current = listing;
		setStatus((d) => (d === base.status ? listing.status : d));
		setTransaction((d) => reseedDraft(d, base.transaction, listing.transaction));
		setFinancials((d) => reseedDraft(d, base.financials, listing.financials));
	}, [historyLength, listing]);

	// A resolution writes financials straight to the store
	// (`resolveIngestionConflict` → `updateDealFinancials`) — including
	// `pricePerSqFt`, recomputed whenever Asking Price is the field picked. This
	// form has no field for `pricePerSqFt`, so nothing else brings that write
	// back into the draft; without this, Save would push the draft's stale
	// value back over it.
	//
	// This used to keep its own advancing base ref, the same shape as the gate
	// re-seed above — and that was wrong: it's the THIRD time this branch has
	// hit the same bug (Task 6 and Task 7's review rounds fixed the other two).
	// A ref only tracks "what the draft was last synced to" if it advances on
	// every write that moves the draft, but the ingestion-transition re-seed
	// and the gate re-seed both move this same `financials` draft without
	// touching this ref, so it goes stale the moment either one fires first.
	// Adding a fourth ref, or wiring this one into those two effects, just
	// grows the same failure mode. Retiring it instead: `listing` is the
	// route's reactive store record (see the route's `useDataStore` selector),
	// so reading its `financials` right before calling
	// `resolveIngestionConflict` gets exactly what the draft was last synced
	// to, by construction — no ref can go stale because nothing is being
	// remembered across renders.
	const onResolveConflict = (fieldKey: IngestionFieldKey, side: "doc" | "current") => {
		const base = useDataStore.getState().listings.get(listing.id)?.financials;
		resolveIngestionConflict(listing.id, fieldKey, side);
		const updated = useDataStore.getState().listings.get(listing.id);
		if (!base || !updated) return;
		setFinancials((d) => reseedDraft(d, base, updated.financials));
	};

	const conflicts = listing.ingestion?.conflicts ?? [];
	const conflictCount = countConflictsFor(conflicts, conflictKeysOn("deal"));
	const conflictsElsewhere = countConflictsFor(
		conflicts,
		conflictKeysOn(otherPage("deal")),
	);

	// Review mode: bring the first disputed field this page owns into view, so the
	// broker isn't left staring at the top of the form. Mount only — held in a ref
	// so re-renders as conflicts resolve can't re-fire it and yank the page around
	// mid-edit. Effects don't run during SSR; the `document` guard covers the rest.
	const scrollTarget = useRef(
		review === "ingestion" ? firstUnresolvedOn(conflicts, "deal") : null,
	);
	useEffect(() => {
		const fieldKey = scrollTarget.current;
		if (!fieldKey || typeof document === "undefined") return;
		document
			.getElementById(conflictRowId(fieldKey))
			?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, []);

	const isSale = dealType !== "Lease";

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
		updateDeal(
			listing.id,
			dealSavePatch(listing, {
				status,
				dealType,
				internalBrokers,
				outsideBrokers,
				transaction,
				financials,
			}),
		);
		notify({ title: "Deal saved" });
		back();
	};

	const actions = (
		<>
			<Button
				variant="ghost"
				onClick={() => {
					useStageGate.getState().clearPendingPublish();
					back();
				}}
			>
				Cancel
			</Button>
			<Button variant="primary" onClick={save}>
				Save
			</Button>
		</>
	);

	const body = (
		<div className="d-flex flex-column gap-6 p-4">
			<PendingPublishBanner listing={listing} />
			<ListingPageHeader
				title="Edit Deal"
				actions={
					<>
						{conflictCount > 0 && (
							<Badge variant="outline" className="ingestion-conflict__badge">
								{conflictCount}
							</Badge>
						)}
						{actions}
					</>
				}
			/>
			{conflictCount === 0 && conflictsElsewhere > 0 && (
				<p className="text-muted fs-small mb-0">
					{conflictsElsewhere} unresolved{" "}
					{conflictsElsewhere === 1 ? "conflict" : "conflicts"} remain on{" "}
					<Link
						to="/listings/$listingId/listing"
						params={{ listingId: listing.id }}
						search={{ review: "ingestion" }}
					>
						the Listing page
					</Link>
					.
				</p>
			)}

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
								options={availableStages(shape)}
								labels={Object.fromEntries(
									availableStages(shape).map((s) => [s, dealStageLabel(s, shape)]),
								)}
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

				{shape !== "shell" && (
					<>
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
						<DealFinancialsSection
							financials={financials}
							patchFinancials={patchFinancials}
						/>
					)}
					</>
				)}
			</div>

			<div className="d-flex justify-content-end gap-2 border-top pt-4">
				{actions}
			</div>
		</div>
	);

	return (
		<IngestionConflictProvider conflicts={conflicts} onResolve={onResolveConflict}>
			{body}
		</IngestionConflictProvider>
	);
}
