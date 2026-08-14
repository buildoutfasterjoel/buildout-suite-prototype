import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGrid2Plus, faPlus } from "@fortawesome/pro-regular-svg-icons";
import { SubGroup } from "#/components/listings/edit/FieldGroup";
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
 * Listing page — Lots. Each lot is a collapsible accordion card (PRD §14).
 * Closing details (Close Date / Buyer-Referral Source) only appear once a
 * lot's status is set to Closed. A section-level "Re-Order" toggle switches the
 * list into drag-to-sort mode. Shown for land-type properties only (gated by
 * the parent).
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
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
		<>
			<div className="d-flex align-items-center justify-content-end gap-2">
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
			<SubGroup>
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
									<Col span={4}>
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
											<Col span={4}>
												<DateField
													label="Close Date"
													value={lot.closeDate ?? null}
													onChange={(v) => update(lot.id, { closeDate: v })}
												/>
											</Col>
											<Col span={4}>
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

								{/* Address / Zoning aren't in the plan's width table — kept as a
								    full-width pair so no field is dropped and the row still sums
								    to 12 (see task-8-report.md). */}
								<FieldGrid>
									<Col span={8}>
										<TextField
											label="Address"
											value={lot.address ?? ""}
											onChange={(v) => update(lot.id, { address: v })}
										/>
									</Col>
									<Col span={4}>
										<TextField
											label="Zoning"
											value={lot.zoning ?? ""}
											onChange={(v) => update(lot.id, { zoning: v })}
										/>
									</Col>
								</FieldGrid>

								<FieldGrid>
									<Col span={4}>
										<TextField
											label="Lot Number"
											value={lot.lotNumber ?? ""}
											onChange={(v) => update(lot.id, { lotNumber: v })}
										/>
									</Col>
									<Col span={4}>
										<TextField
											label="APN"
											value={lot.apn ?? ""}
											onChange={(v) => update(lot.id, { apn: v })}
										/>
									</Col>
									<Col span={4}>
										<SelectField
											label="Subtype"
											value={lot.subtype ?? "Vacant Land"}
											options={ALL_SUBTYPES}
											onChange={(v) => update(lot.id, { subtype: v })}
										/>
									</Col>
								</FieldGrid>

								<FieldGrid>
									<Col span={3}>
										<NumberField
											label="Sale Price"
											value={lot.salePrice ?? null}
											onChange={(v) => update(lot.id, { salePrice: v })}
										/>
									</Col>
									<Col span={3}>
										<SelectField
											label="Price Units"
											value={lot.priceUnits ?? "Total"}
											options={LOT_PRICE_UNITS}
											onChange={(v) => update(lot.id, { priceUnits: v })}
										/>
									</Col>
									<Col span={3}>
										<NumberField
											label="Size"
											value={lot.size ?? null}
											onChange={(v) => update(lot.id, { size: v })}
										/>
									</Col>
									<Col span={3}>
										<SelectField
											label="Size Units"
											value={lot.sizeUnits ?? "Acre"}
											options={LOT_SIZE_UNITS}
											onChange={(v) => update(lot.id, { sizeUnits: v })}
										/>
									</Col>
								</FieldGrid>

								<FieldGrid>
									<Col span={12}>
										<TextField
											label="Description"
											textarea
											value={lot.description ?? ""}
											onChange={(v) => update(lot.id, { description: v })}
										/>
									</Col>
								</FieldGrid>
							</>
						)}
					/>
				)}
			</SubGroup>
		</>
	);
}
