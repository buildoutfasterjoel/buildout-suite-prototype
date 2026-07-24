import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGrid2Plus, faPlus } from "@fortawesome/pro-regular-svg-icons";
import {
	Col,
	DateField,
	FieldGrid,
	NumberField,
	SelectField,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import {
	ReorderableAccordion,
	ReorderToggle,
} from "#/components/listings/edit/ReorderableAccordion";
import { ALL_SUBTYPES } from "#/components/listings/edit/sections/PropertySection";
import { Section } from "#/components/listings/listingWidgets";
import {
	PROPERTY_STATUSES,
	STATUS_LABELS,
} from "#/components/properties/propertyDisplay";
import { emptyLot } from "#/data/createListing";
import type { Lot, Property } from "#/data/types";

const LOT_PRICE_UNITS: Lot["priceUnits"][] = [
	"Total",
	"SF",
	"SqM",
	"Acre",
	"Hectare",
];
const LOT_SIZE_UNITS = ["Acre", "SF", "SqM", "Hectare"];

/**
 * Listing tab — Lots. Each lot is a collapsible accordion card (PRD §14).
 * Closing details (Close Date / Buyer-Referral Source) only appear once a
 * lot's status is set to Closed. A section-level "Re-Order" toggle switches the
 * list into drag-to-sort mode. Shown for land-type properties only (gated by
 * the parent).
 */
export function LotsSection({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	const lots = property.lots ?? [];
	const [reordering, setReordering] = useState(false);

	const update = (id: string, patch: Partial<Lot>) =>
		patchProperty({
			lots: lots.map((l) => (l.id === id ? { ...l, ...patch } : l)),
		});
	const remove = (id: string) =>
		patchProperty({ lots: lots.filter((l) => l.id !== id) });
	const add = () => patchProperty({ lots: [...lots, emptyLot()] });

	return (
		<Section
			title="Lots"
			icon={faGrid2Plus}
			action={
				<div className="d-flex align-items-center gap-2">
					<ReorderToggle
						reordering={reordering}
						onToggle={() => setReordering((v) => !v)}
						count={lots.length}
					/>
					{!reordering && (
						<Button variant="ghost" size="sm" onClick={add}>
							<FontAwesomeIcon icon={faPlus} />
							Add a lot
						</Button>
					)}
				</div>
			}
		>
			{lots.length === 0 ? (
				<p className="text-muted mb-0">No lots yet.</p>
			) : (
				<ReorderableAccordion
					items={lots}
					reordering={reordering}
					onReorder={(next) => patchProperty({ lots: next })}
					onRemove={remove}
					removeLabel="Remove lot"
					renderTrigger={(lot, i) => (
						<span className="fw-semibold d-flex align-items-center gap-2">
							<FontAwesomeIcon icon={faGrid2Plus} className="text-muted" />
							{lot.lotNumber ? `Lot ${lot.lotNumber}` : `Lot ${i + 1}`}
							{lot.address && (
								<span className="text-muted fw-normal ms-1">{lot.address}</span>
							)}
						</span>
					)}
					renderContent={(lot) => (
						<>
							<FieldGrid>
								<Col>
									<SelectField
										label="Status"
										value={lot.status}
										options={PROPERTY_STATUSES}
										labels={STATUS_LABELS}
										onChange={(v) => update(lot.id, { status: v })}
									/>
								</Col>
								{lot.status === "closed" && (
									<>
										<Col>
											<DateField
												label="Close Date"
												value={lot.closeDate ?? null}
												onChange={(v) => update(lot.id, { closeDate: v })}
											/>
										</Col>
										<Col>
											<TextField
												label="Buyer / Referral Source"
												value={lot.buyerReferralSource ?? ""}
												onChange={(v) =>
													update(lot.id, { buyerReferralSource: v })
												}
											/>
										</Col>
									</>
								)}
							</FieldGrid>

							<FieldGrid>
								<Col>
									<TextField
										label="Lot Number"
										value={lot.lotNumber ?? ""}
										onChange={(v) => update(lot.id, { lotNumber: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="Address"
										value={lot.address ?? ""}
										onChange={(v) => update(lot.id, { address: v })}
									/>
								</Col>
								<Col>
									<TextField
										label="APN"
										value={lot.apn ?? ""}
										onChange={(v) => update(lot.id, { apn: v })}
									/>
								</Col>
								<Col>
									<SelectField
										label="Subtype"
										value={lot.subtype ?? "Vacant Land"}
										options={ALL_SUBTYPES}
										onChange={(v) => update(lot.id, { subtype: v })}
									/>
								</Col>
							</FieldGrid>

							<FieldGrid>
								<Col>
									<NumberField
										label="Sale Price"
										value={lot.salePrice ?? null}
										onChange={(v) => update(lot.id, { salePrice: v })}
									/>
								</Col>
								<Col>
									<SelectField
										label="Price Units"
										value={lot.priceUnits ?? "Total"}
										options={LOT_PRICE_UNITS}
										onChange={(v) => update(lot.id, { priceUnits: v })}
									/>
								</Col>
								<Col>
									<NumberField
										label="Size"
										value={lot.size ?? null}
										onChange={(v) => update(lot.id, { size: v })}
									/>
								</Col>
								<Col>
									<SelectField
										label="Size Units"
										value={lot.sizeUnits ?? "Acre"}
										options={LOT_SIZE_UNITS}
										onChange={(v) => update(lot.id, { sizeUnits: v })}
									/>
								</Col>
							</FieldGrid>

							<TextField
								label="Description"
								textarea
								value={lot.description ?? ""}
								onChange={(v) => update(lot.id, { description: v })}
							/>

							<TextField
								label="Zoning"
								value={lot.zoning ?? ""}
								onChange={(v) => update(lot.id, { zoning: v })}
							/>
						</>
					)}
				/>
			)}
		</Section>
	);
}
