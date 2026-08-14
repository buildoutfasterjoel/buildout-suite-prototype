import type { ExpenseLineItem, IncomeLineItem } from "#/data/types";
import {
	EditableTable,
	type Column,
} from "#/components/common/recordForm/EditableTable";

// ── Line-item editor (income / expenses) ─────────────────────────────────────
// A headerless hand-rolled repeater before: label + amount read down the column,
// which is exactly what `EditableTable` is for. The title and the running Total
// move into the footer — the cluster's gutter already names the table.
const COLUMNS: Column<IncomeLineItem | ExpenseLineItem>[] = [
	{ key: "label", label: "Item", kind: "text" },
	{ key: "amount", label: "Amount", kind: "number" },
];

export function LineItemEditor<T extends IncomeLineItem | ExpenseLineItem>({
	title,
	items,
	onChange,
}: {
	title: string;
	items: T[];
	onChange: (v: T[]) => void;
}) {
	const total = items.reduce((sum, i) => sum + i.amount, 0);
	return (
		<EditableTable<T>
			// A union-typed column list feeding a generic component: both members
			// carry `label` and `amount`, but TS can't narrow `keyof T` from the
			// union's keys, so the cast is deliberate.
			columns={COLUMNS as Column<T>[]}
			rows={items}
			// `EditableTable`'s number cells write `null` for an emptied input, but
			// `amount` is non-nullable, so a cleared cell has to land as 0 — a number
			// input that silently restores its old value when cleared reads as broken.
			// The `in` check is what separates that from a label-only patch, which
			// carries no `amount` key at all: a bare `patch.amount ?? 0` would zero the
			// row's amount every time someone edited the Item text.
			onEdit={(id, patch) =>
				onChange(
					items.map((x) =>
						x.id === id
							? {
									...x,
									...patch,
									amount: "amount" in patch ? (patch.amount ?? 0) : x.amount,
								}
							: x,
					),
				)
			}
			onAdd={() =>
				onChange([
					...items,
					{ id: crypto.randomUUID(), label: "", amount: 0 } as T,
				])
			}
			onRemove={(id) => onChange(items.filter((x) => x.id !== id))}
			addLabel="Add line item"
			emptyLabel={`No ${title.toLowerCase()} line items yet.`}
			footer={
				<div className="d-flex justify-content-between">
					<span className="fw-semibold">Total</span>
					<span className="fw-semibold">${total.toLocaleString()}</span>
				</div>
			}
		/>
	);
}
