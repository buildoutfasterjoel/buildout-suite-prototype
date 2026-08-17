import { SubGroup } from "#/components/common/recordForm/FieldGroup";
import {
	Col,
	FieldGrid,
	NumberField,
	SwitchRow,
	TextField,
} from "#/components/common/recordForm/fieldWidgets";
import type { SpaceLeaseTerms } from "#/data/types";

/**
 * Listing page — Expenses. What the tenant carries on top of rent.
 *
 * These used to be split in two: the recoveries sat at the bottom of a 25-field
 * "Additional Fields" accordion while the three tenant-pays switches sat in a
 * flag pile above it, so the two halves of one question were never on screen
 * together. They are one group now, and visible by default — a NNN quote is not
 * long-tail detail.
 *
 * No disclosure: nine fields is the whole of it.
 *
 * Emits subgroups only — `SpaceFormEditor` owns the group heading.
 */
export function SpaceExpensesSection({
	terms,
	onChange,
}: {
	terms: SpaceLeaseTerms;
	onChange: (patch: Partial<SpaceLeaseTerms>) => void;
}) {
	return (
		<>
			<SubGroup
				label="Recoveries"
				description="What the tenant reimburses, and the stops above which it starts."
			>
				<FieldGrid>
					<Col>
						<NumberField
							label="Tax ($/SF)"
							value={terms.taxPerSf}
							onChange={(v) => onChange({ taxPerSf: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Tax Stops"
							value={terms.taxStops ?? ""}
							onChange={(v) => onChange({ taxStops: v || null })}
						/>
					</Col>
					<Col>
						<NumberField
							label="CAM ($/SF)"
							value={terms.camPerSf}
							onChange={(v) => onChange({ camPerSf: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="CAM Stops"
							value={terms.camStops ?? ""}
							onChange={(v) => onChange({ camStops: v || null })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Insurance ($/SF)"
							value={terms.insurancePerSf}
							onChange={(v) => onChange({ insurancePerSf: v })}
						/>
					</Col>
					<Col>
						<TextField
							label="Expense Stops"
							value={terms.expenseStops ?? ""}
							onChange={(v) => onChange({ expenseStops: v || null })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup
				label="Utilities"
				description="Which meters the tenant pays directly rather than through CAM."
			>
				<SwitchRow
					label="Tenants pay gas"
					checked={terms.tenantsPayGas}
					onChange={(v) => onChange({ tenantsPayGas: v })}
				/>
				<SwitchRow
					label="Tenants pay electric"
					checked={terms.tenantsPayElectric}
					onChange={(v) => onChange({ tenantsPayElectric: v })}
				/>
				<SwitchRow
					label="Tenants pay water"
					checked={terms.tenantsPayWater}
					onChange={(v) => onChange({ tenantsPayWater: v })}
				/>
			</SubGroup>
		</>
	);
}
