import { SubGroup } from "#/components/common/recordForm/FieldGroup";
import {
	BulletsField,
	Col,
	FieldGrid,
	NumberField,
	SelectField,
	TextField,
} from "#/components/common/recordForm/fieldWidgets";
import type { DealMarketing } from "#/data/types";

const AVAILABLE_SF_TERMS = ["SF", "RSF"] as const;

/**
 * Listing page — Lease Marketing. Only rendered for Lease deals
 * (`dealType === "Lease"`). Holds the deal-level lease marketing copy and terms;
 * the per-space lease terms live in {@link SpaceTermsSection}.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function LeaseSection({
	marketing,
	patchMarketing,
}: {
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
}) {
	return (
		<>
			<SubGroup label="Headline">
				<TextField
					label="Lease Title"
					value={marketing.leaseTitle ?? ""}
					onChange={(v) => patchMarketing({ leaseTitle: v })}
				/>
				<FieldGrid>
					<Col span={12}>
						<TextField
							label="Lease Description"
							textarea
							rows={4}
							value={marketing.leaseDescription ?? ""}
							onChange={(v) => patchMarketing({ leaseDescription: v })}
						/>
					</Col>
				</FieldGrid>
				<BulletsField
					label="Lease Bullets"
					bullets={marketing.leaseBullets ?? []}
					onChange={(v) => patchMarketing({ leaseBullets: v })}
				/>
			</SubGroup>

			<SubGroup label="Terms">
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
					label="Closing Info"
					textarea
					value={marketing.leaseClosingInformation ?? ""}
					onChange={(v) => patchMarketing({ leaseClosingInformation: v })}
				/>
			</SubGroup>
		</>
	);
}
