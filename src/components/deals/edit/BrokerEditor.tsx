import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker } from "#/data/types";
import { NumberField, TextField } from "#/components/common/recordForm/fieldWidgets";

// ── Broker rows ──────────────────────────────────────────────────────────────
export function BrokerEditor({
	brokers,
	side,
	onChange,
}: {
	brokers: DealBroker[];
	side: "internal" | "outside";
	onChange: (v: DealBroker[]) => void;
}) {
	const update = (id: string, patch: Partial<DealBroker>) =>
		onChange(brokers.map((b) => (b.id === id ? { ...b, ...patch } : b)));
	const add = () =>
		onChange([
			...brokers,
			{
				id: crypto.randomUUID(),
				name: "",
				role: "Co-Broker",
				email: "",
				side,
				commissionSplitPct: 0,
				grossCommission: 0,
			},
		]);
	return (
		<div className="d-flex flex-column gap-2">
			{brokers.length === 0 ? (
				<p className="text-muted mb-0">No {side} brokers on this deal.</p>
			) : (
				brokers.map((b) => (
					// Flex with `flexBasis: 0`, not a 7/4/1 grid. The grid gave Split %
					// a `col-md-4` — 164px of label gutter inside a ~200px column left a
					// 16px input holding a value nobody could read. Basis 0 is what
					// makes the two fields split evenly; `flex-grow-1` alone shares out
					// only the leftover space, so they would keep their unequal
					// intrinsic widths. The remove button hugs at the 8px bound tier
					// instead of being parked at the far edge of its own column.
					<div key={b.id} className="d-flex align-items-center gap-2">
						<div className="flex-grow-1" style={{ flexBasis: 0 }}>
							<TextField
								label="Name"
								value={b.name}
								onChange={(v) => update(b.id, { name: v })}
							/>
						</div>
						<div className="flex-grow-1" style={{ flexBasis: 0 }}>
							<NumberField
								label="Split %"
								value={b.commissionSplitPct}
								onChange={(v) => update(b.id, { commissionSplitPct: v ?? 0 })}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="flex-shrink-0"
							aria-label="Remove broker"
							onClick={() => onChange(brokers.filter((x) => x.id !== b.id))}
						>
							<FontAwesomeIcon icon={faTrashCan} />
						</Button>
					</div>
				))
			)}
			<div>
				<Button variant="ghost" size="sm" onClick={add}>
					<FontAwesomeIcon icon={faPlus} />
					Add broker
				</Button>
			</div>
		</div>
	);
}
