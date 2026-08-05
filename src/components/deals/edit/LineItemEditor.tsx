import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import type { ExpenseLineItem, IncomeLineItem } from "#/data/types";

// ── Line-item editor (income / expenses) ─────────────────────────────────────
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
		<div className="d-flex flex-column gap-2">
			<div className="d-flex align-items-center justify-content-between">
				<span className="fw-semibold">{title}</span>
				<span className="text-muted">Total ${total.toLocaleString()}</span>
			</div>
			{items.map((item) => (
				<div key={item.id} className="d-flex align-items-center gap-2">
					<Input
						value={item.label}
						placeholder="Label"
						onChange={(e) =>
							onChange(
								items.map((x) =>
									x.id === item.id ? { ...x, label: e.target.value } : x,
								),
							)
						}
					/>
					<Input
						type="number"
						style={{ maxWidth: 160 }}
						value={item.amount}
						onChange={(e) =>
							onChange(
								items.map((x) =>
									x.id === item.id
										? { ...x, amount: Number(e.target.value) }
										: x,
								),
							)
						}
					/>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Remove line item"
						onClick={() => onChange(items.filter((x) => x.id !== item.id))}
					>
						<FontAwesomeIcon icon={faTrashCan} />
					</Button>
				</div>
			))}
			<div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						onChange([
							...items,
							{ id: crypto.randomUUID(), label: "", amount: 0 } as T,
						])
					}
				>
					<FontAwesomeIcon icon={faPlus} />
					Add line item
				</Button>
			</div>
		</div>
	);
}
