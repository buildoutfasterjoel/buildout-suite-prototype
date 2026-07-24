import { faKey } from "@fortawesome/pro-regular-svg-icons";
import {
	BulletsField,
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import type { DealMarketing } from "#/data/types";

const AVAILABLE_SF_TERMS = ["SF", "RSF"] as const;

/**
 * Listing tab — Lease Marketing. Only rendered for Lease deals
 * (`dealType === "Lease"`). Holds the deal-level lease marketing copy and terms;
 * the per-space lease terms live in {@link LeaseSpacesSection}.
 */
export function LeaseSection({
	marketing,
	patchMarketing,
}: {
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
}) {
	return (
		<Section title="Lease Marketing" icon={faKey}>
			<TextField
				label="Lease Title"
				value={marketing.leaseTitle ?? ""}
				onChange={(v) => patchMarketing({ leaseTitle: v })}
			/>
			<TextField
				label="Lease Description"
				textarea
				rows={4}
				value={marketing.leaseDescription ?? ""}
				onChange={(v) => patchMarketing({ leaseDescription: v })}
			/>
			<BulletsField
				label="Lease Bullets"
				bullets={marketing.leaseBullets ?? []}
				onChange={(v) => patchMarketing({ leaseBullets: v })}
			/>

			<FieldGrid>
				<Col>
					<NumberField
						label="Commission Split %"
						value={marketing.leaseCommissionSplitPct ?? null}
						onChange={(v) => patchMarketing({ leaseCommissionSplitPct: v })}
					/>
				</Col>
				<Col>
					<SelectField
						label="Available SF Term"
						value={marketing.availableSfTerm ?? "SF"}
						options={AVAILABLE_SF_TERMS}
						onChange={(v) => patchMarketing({ availableSfTerm: v })}
					/>
				</Col>
			</FieldGrid>

			<TextField
				label="Lease Closing Information"
				textarea
				value={marketing.leaseClosingInformation ?? ""}
				onChange={(v) => patchMarketing({ leaseClosingInformation: v })}
			/>
		</Section>
	);
}
