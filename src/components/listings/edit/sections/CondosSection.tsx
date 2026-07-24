import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDoorOpen, faPlus } from "@fortawesome/pro-regular-svg-icons";
import {
	Col,
	DateField,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import {
	ReorderableAccordion,
	ReorderToggle,
} from "#/components/listings/edit/ReorderableAccordion";
import { Section } from "#/components/listings/listingWidgets";
import {
	PROPERTY_STATUSES,
	STATUS_LABELS,
} from "#/components/properties/propertyDisplay";
import { emptyCondo } from "#/data/createListing";
import type { Condo, Property } from "#/data/types";

const CONDO_PRICE_UNITS: Condo["priceUnits"][] = ["Total", "SF", "SqM"];
const CONDO_SIZE_UNITS: Condo["sizeUnits"][] = ["Sq Ft", "Sq Meters"];

/**
 * Listing tab — Condos. Each condo is a collapsible accordion card (PRD §14).
 * Close Date only appears once a condo's status is set to Closed; a Hide Price
 * toggle reveals its own display-label override. A section-level "Re-Order"
 * toggle switches the list into drag-to-sort mode. Shown for Sale deals only
 * (gated by the parent).
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
		<Section
			title="Condos"
			icon={faDoorOpen}
			action={
				<div className="d-flex align-items-center gap-2">
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
			}
		>
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
								<Col>
									<SelectField
										label="Status"
										value={condo.status}
										options={PROPERTY_STATUSES}
										labels={STATUS_LABELS}
										onChange={(v) => update(condo.id, { status: v })}
									/>
								</Col>
								{condo.status === "closed" && (
									<Col>
										<DateField
											label="Close Date"
											value={condo.closeDate ?? null}
											onChange={(v) => update(condo.id, { closeDate: v })}
										/>
									</Col>
								)}
							</FieldGrid>

							<TextField
								label="Address 2"
								value={condo.addressUnit ?? ""}
								onChange={(v) => update(condo.id, { addressUnit: v })}
							/>

							<FieldGrid>
								<Col>
									<NumberField
										label="Sale Price"
										value={condo.salePrice ?? null}
										onChange={(v) => update(condo.id, { salePrice: v })}
									/>
								</Col>
								<Col>
									<SelectField
										label="Price Units"
										value={condo.priceUnits ?? "Total"}
										options={CONDO_PRICE_UNITS}
										onChange={(v) => update(condo.id, { priceUnits: v })}
									/>
								</Col>
							</FieldGrid>

							<div style={{ maxWidth: 360 }}>
								<SwitchRow
									label="Hide Price"
									checked={condo.hidePrice ?? false}
									onChange={(v) => update(condo.id, { hidePrice: v })}
								/>
							</div>
							{condo.hidePrice && (
								<TextField
									label="Hide Price Label"
									value={condo.hidePriceLabel ?? ""}
									onChange={(v) => update(condo.id, { hidePriceLabel: v })}
								/>
							)}

							<FieldGrid>
								<Col>
									<NumberField
										label="Size"
										value={condo.size ?? null}
										onChange={(v) => update(condo.id, { size: v })}
									/>
								</Col>
								<Col>
									<SelectField
										label="Size Units"
										value={condo.sizeUnits ?? "Sq Ft"}
										options={CONDO_SIZE_UNITS}
										onChange={(v) => update(condo.id, { sizeUnits: v })}
									/>
								</Col>
							</FieldGrid>

							<TextField
								label="Description"
								textarea
								value={condo.description ?? ""}
								onChange={(v) => update(condo.id, { description: v })}
							/>
						</>
					)}
				/>
			)}
		</Section>
	);
}
