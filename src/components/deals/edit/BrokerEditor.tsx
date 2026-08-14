import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker } from "#/data/types";
import { NumberField, TextField } from "#/components/common/recordForm/fieldWidgets";

// ── Broker rows ──────────────────────────────────────────────────────────────
export function BrokerEditor({
	title,
	brokers,
	side,
	onChange,
}: {
	title: string;
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
		<div className="d-flex flex-column gap-3">
			<div className="d-flex align-items-center justify-content-between">
				<span className="fw-semibold">{title}</span>
				<Button variant="ghost" size="sm" onClick={add}>
					<FontAwesomeIcon icon={faPlus} />
					Add broker
				</Button>
			</div>
			{brokers.length === 0 ? (
				<p className="text-muted mb-0">No {side} brokers on this deal.</p>
			) : (
				brokers.map((b) => (
					<div key={b.id} className="row g-2 align-items-end">
						<div className="col-md-7">
							<TextField
								label="Name"
								value={b.name}
								onChange={(v) => update(b.id, { name: v })}
							/>
						</div>
						<div className="col-md-4">
							<NumberField
								label="Split %"
								value={b.commissionSplitPct}
								onChange={(v) => update(b.id, { commissionSplitPct: v ?? 0 })}
							/>
						</div>
						<div className="col-md-1 d-flex justify-content-end pb-1">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Remove broker"
								onClick={() => onChange(brokers.filter((x) => x.id !== b.id))}
							>
								<FontAwesomeIcon icon={faTrashCan} />
							</Button>
						</div>
					</div>
				))
			)}
		</div>
	);
}
