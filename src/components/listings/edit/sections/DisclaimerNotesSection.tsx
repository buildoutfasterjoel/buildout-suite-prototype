import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { SubGroup } from "#/components/listings/edit/FieldGroup";
import {
	Col,
	FieldGrid,
	SwitchRow,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import type { DealMarketing } from "#/data/types";

/**
 * Disclaimer & Notes section. Override Disclaimer reveals a custom
 * disclaimer textarea; Internal Notes lives on `Listing` (not `marketing`),
 * so its state/setter come from the parent (`ListingEditor`) rather
 * than from `patchMarketing`.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function DisclaimerNotesSection({
	marketing,
	patchMarketing,
	internalNotes,
	setInternalNotes,
}: {
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	internalNotes: string;
	setInternalNotes: (v: string) => void;
}) {
	return (
		<>
			<SubGroup label="Disclaimer">
				<SwitchRow
					label="Override Disclaimer"
					checked={marketing.overrideDisclaimer ?? false}
					onChange={(v) => patchMarketing({ overrideDisclaimer: v })}
				/>
				{marketing.overrideDisclaimer && (
					<FieldGrid>
						<Col span={12}>
							<TextField
								label="Custom Disclaimer"
								textarea
								value={marketing.customDisclaimer ?? ""}
								onChange={(v) => patchMarketing({ customDisclaimer: v })}
							/>
						</Col>
					</FieldGrid>
				)}
			</SubGroup>

			<SubGroup label="Internal">
				<FieldGrid>
					<Col span={12}>
						<TextField
							label="Internal Notes"
							textarea
							value={internalNotes ?? ""}
							onChange={setInternalNotes}
						/>
					</Col>
					<Col span={12}>
						<TextField
							label="Admin Notes"
							textarea
							value={marketing.adminNotes ?? ""}
							onChange={(v) => patchMarketing({ adminNotes: v })}
						/>
					</Col>
				</FieldGrid>

				{/* External ID isn't in the plan's width table — kept unchanged,
				    grouped here as the section's other back-office/internal field. */}
				<Field>
					<Field.Label>External ID</Field.Label>
					<Input readOnly value={marketing.externalId ?? ""} />
				</Field>
			</SubGroup>
		</>
	);
}
