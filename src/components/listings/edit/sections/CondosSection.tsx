import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDoorOpen, faPlus } from "@fortawesome/pro-regular-svg-icons";
import { SubGroup } from "#/components/common/recordForm/FieldGroup";
import {
	Col,
	DateField,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/common/recordForm/fieldWidgets";
import {
	ReorderableAccordion,
	ReorderToggle,
} from "#/components/listings/edit/ReorderableAccordion";
import {
	PROPERTY_STATUSES,
	STATUS_LABELS,
} from "#/components/properties/propertyDisplay";
import { emptyCondo } from "#/data/createListing";
import type { Condo, Property } from "#/data/types";

const CONDO_PRICE_UNITS: Condo["priceUnits"][] = ["Total", "SF", "SqM"];
const CONDO_SIZE_UNITS: Condo["sizeUnits"][] = ["Sq Ft", "Sq Meters"];

/**
 * Listing page — Condos. Each condo is a collapsible accordion card (PRD §14).
 * Close Date only appears once a condo's status is set to Closed; a Hide Price
 * toggle reveals its own display-label override. A section-level "Re-Order"
 * toggle switches the list into drag-to-sort mode. Shown for Sale deals only
 * (gated by the parent).
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function CondosSection({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	const condos = property.condos ?? [];
	const [reordering, setReordering] = useState(false);

	const update = (id: string, patch: Partial<Condo>) =>
		patchProperty({
			condos: condos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
		});
	const remove = (id: string) =>
		patchProperty({ condos: condos.filter((c) => c.id !== id) });
	const add = () => patchProperty({ condos: [...condos, emptyCondo()] });

	return (
		<>
			<div className="d-flex align-items-center justify-content-end gap-2">
				<ReorderToggle
					reordering={reordering}
					onToggle={() => setReordering((v) => !v)}
					count={condos.length}
				/>
				{!reordering && (
					<Button variant="ghost" size="sm" onClick={add}>
						<FontAwesomeIcon icon={faPlus} />
						Add a condo
					</Button>
				)}
			</div>
			<SubGroup>
				{condos.length === 0 ? (
					<p className="text-muted mb-0">No condos yet.</p>
				) : (
					<ReorderableAccordion
						items={condos}
						reordering={reordering}
						onReorder={(next) => patchProperty({ condos: next })}
						onRemove={remove}
						removeLabel="Remove condo"
						renderTrigger={(condo, i) => (
							<span className="fw-semibold d-flex align-items-center gap-2">
								<FontAwesomeIcon icon={faDoorOpen} className="text-muted" />
								{condo.addressUnit ? condo.addressUnit : `Unit ${i + 1}`}
							</span>
						)}
						renderContent={(condo) => (
							<>
								<FieldGrid>
									<Col span={6}>
										<SelectField
											label="Status"
											value={condo.status}
											options={PROPERTY_STATUSES}
											labels={STATUS_LABELS}
											onChange={(v) => update(condo.id, { status: v })}
										/>
									</Col>
									{condo.status === "closed" && (
										<Col span={6}>
											<DateField
												label="Close Date"
												value={condo.closeDate ?? null}
												onChange={(v) => update(condo.id, { closeDate: v })}
											/>
										</Col>
									)}
								</FieldGrid>

								{/* Address 2 isn't in the plan's width table — kept as its own
								    full-width field, unchanged. */}
								<TextField
									label="Address 2"
									value={condo.addressUnit ?? ""}
									onChange={(v) => update(condo.id, { addressUnit: v })}
								/>

								<FieldGrid>
									<Col span={6}>
										<NumberField
											label="Sale Price"
											value={condo.salePrice ?? null}
											onChange={(v) => update(condo.id, { salePrice: v })}
										/>
									</Col>
									<Col span={6}>
										<SelectField
											label="Price Units"
											value={condo.priceUnits ?? "Total"}
											options={CONDO_PRICE_UNITS}
											onChange={(v) => update(condo.id, { priceUnits: v })}
										/>
									</Col>
									<Col span={6}>
										<NumberField
											label="Size"
											value={condo.size ?? null}
											onChange={(v) => update(condo.id, { size: v })}
										/>
									</Col>
									<Col span={6}>
										<SelectField
											label="Size Units"
											value={condo.sizeUnits ?? "Sq Ft"}
											options={CONDO_SIZE_UNITS}
											onChange={(v) => update(condo.id, { sizeUnits: v })}
										/>
									</Col>
								</FieldGrid>

								{/* Hide Price / Hide Price Label aren't in the plan's width
								    table either — kept unchanged, repositioned after the merged
								    Sale Price/Size row since that row now occupies the slot they
								    used to sit inside. */}
								<SwitchRow
									label="Hide Price"
									checked={condo.hidePrice ?? false}
									onChange={(v) => update(condo.id, { hidePrice: v })}
								/>
								{condo.hidePrice && (
									<TextField
										label="Hide Price Label"
										value={condo.hidePriceLabel ?? ""}
										onChange={(v) => update(condo.id, { hidePriceLabel: v })}
									/>
								)}

								<FieldGrid>
									<Col span={12}>
										<TextField
											label="Description"
											textarea
											value={condo.description ?? ""}
											onChange={(v) => update(condo.id, { description: v })}
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
