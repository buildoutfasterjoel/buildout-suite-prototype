import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { faNoteSticky } from "@fortawesome/pro-regular-svg-icons";
import { SwitchRow, TextField } from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import type { DealMarketing } from "#/data/types";

/**
 * Listing tab — Disclaimer & Notes. Override Disclaimer reveals a custom
 * disclaimer textarea; Internal Notes lives on `Listing` (not `marketing`),
 * so its state/setter come from the caller (`DealMarketingEditor`) rather
 * than from `patchMarketing`.
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
		<Section title="Disclaimer & Notes" icon={faNoteSticky}>
			<div style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Override Disclaimer"
					checked={marketing.overrideDisclaimer ?? false}
					onChange={(v) => patchMarketing({ overrideDisclaimer: v })}
				/>
			</div>
			{marketing.overrideDisclaimer && (
				<TextField
					label="Custom Disclaimer"
					textarea
					value={marketing.customDisclaimer ?? ""}
					onChange={(v) => patchMarketing({ customDisclaimer: v })}
				/>
			)}
			<TextField
				label="Internal Notes"
				textarea
				value={internalNotes ?? ""}
				onChange={setInternalNotes}
			/>
			<TextField
				label="Admin Notes"
				textarea
				value={marketing.adminNotes ?? ""}
				onChange={(v) => patchMarketing({ adminNotes: v })}
			/>
			<Field>
				<Field.Label>External ID</Field.Label>
				<Input readOnly value={marketing.externalId ?? ""} />
			</Field>
		</Section>
	);
}
