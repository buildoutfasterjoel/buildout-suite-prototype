import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faArrowDown,
	faArrowUp,
	faDoorOpen,
	faPlus,
	faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import {
	Col,
	DateField,
	FieldGrid,
	NumberField,
	SelectField,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
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
 * Listing tab — Condos. A repeatable, reorderable card per condo unit
 * (PRD §14). Close Date only appears once a condo's status is set to Closed;
 * a Hide Price toggle reveals its own display-label override. Condos are
 * always present — entitlement is assumed on for this prototype.
 */
export function CondosSection({
	property,
	patchProperty,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
}) {
	const condos = property.condos ?? [];

	const update = (id: string, patch: Partial<Condo>) =>
		patchProperty({
			condos: condos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
		});
	const move = (i: number, dir: -1 | 1) => {
		const j = i + dir;
		if (j < 0 || j >= condos.length) return;
		const next = [...condos];
		[next[i], next[j]] = [next[j], next[i]];
		patchProperty({ condos: next });
	};
	const remove = (id: string) =>
		patchProperty({ condos: condos.filter((c) => c.id !== id) });
	const add = () => patchProperty({ condos: [...condos, emptyCondo()] });

	return (
		<Section
			title="Condos"
			icon={faDoorOpen}
			action={
				<Button variant="ghost" size="sm" onClick={add}>
					<FontAwesomeIcon icon={faPlus} />
					Add a condo
				</Button>
			}
		>
			{condos.length === 0 ? (
				<p className="text-muted mb-0">No condos yet.</p>
			) : (
				condos.map((condo, i) => (
					<div
						key={condo.id}
						className="border rounded p-3"
						style={{ borderRadius: 6 }}
					>
						<div className="d-flex align-items-start gap-2 mb-3">
							<div className="d-flex flex-column">
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Move condo up"
									disabled={i === 0}
									onClick={() => move(i, -1)}
								>
									<FontAwesomeIcon icon={faArrowUp} />
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Move condo down"
									disabled={i === condos.length - 1}
									onClick={() => move(i, 1)}
								>
									<FontAwesomeIcon icon={faArrowDown} />
								</Button>
							</div>
							<div className="flex-grow-1 d-flex flex-column gap-3">
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
							</div>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Remove condo"
								onClick={() => remove(condo.id)}
							>
								<FontAwesomeIcon icon={faTrashCan} />
							</Button>
						</div>
					</div>
				))
			)}
		</Section>
	);
}
