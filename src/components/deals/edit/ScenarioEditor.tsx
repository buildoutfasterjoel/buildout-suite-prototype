import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faArrowUp,
	faArrowDown,
	faPlus,
	faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import type { FinancialScenario } from "#/data/types";
import { FieldGrid, NumberField } from "#/components/listings/edit/fieldWidgets";

// ── Scenario editor (reorderable) ────────────────────────────────────────────
export function ScenarioEditor({
	scenarios,
	onChange,
}: {
	scenarios: FinancialScenario[];
	onChange: (v: FinancialScenario[]) => void;
}) {
	const move = (i: number, dir: -1 | 1) => {
		const j = i + dir;
		if (j < 0 || j >= scenarios.length) return;
		const next = [...scenarios];
		[next[i], next[j]] = [next[j], next[i]];
		onChange(next);
	};
	const update = (id: string, patch: Partial<FinancialScenario>) =>
		onChange(scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)));
	return (
		<div className="d-flex flex-column gap-3">
			<div className="d-flex align-items-center justify-content-between">
				<span className="fw-semibold">Scenarios</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						onChange([
							...scenarios,
							{
								id: crypto.randomUUID(),
								name: "New scenario",
								noi: 0,
								capRate: 0,
								cashFlow: 0,
							},
						])
					}
				>
					<FontAwesomeIcon icon={faPlus} />
					Add scenario
				</Button>
			</div>
			{scenarios.map((s, i) => (
				<div
					key={s.id}
					className="border rounded p-3"
					style={{ borderRadius: 6 }}
				>
					<div className="d-flex align-items-center gap-2 mb-2">
						<div className="d-flex flex-column">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Move scenario up"
								disabled={i === 0}
								onClick={() => move(i, -1)}
							>
								<FontAwesomeIcon icon={faArrowUp} />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Move scenario down"
								disabled={i === scenarios.length - 1}
								onClick={() => move(i, 1)}
							>
								<FontAwesomeIcon icon={faArrowDown} />
							</Button>
						</div>
						<div className="flex-grow-1">
							<Input
								value={s.name}
								onChange={(e) => update(s.id, { name: e.target.value })}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remove scenario"
							onClick={() => onChange(scenarios.filter((x) => x.id !== s.id))}
						>
							<FontAwesomeIcon icon={faTrashCan} />
						</Button>
					</div>
					<FieldGrid>
						<div className="col-md-4">
							<NumberField
								label="NOI"
								value={s.noi}
								onChange={(v) => update(s.id, { noi: v ?? 0 })}
							/>
						</div>
						<div className="col-md-4">
							<NumberField
								label="Cap Rate %"
								value={s.capRate}
								onChange={(v) => update(s.id, { capRate: v ?? 0 })}
							/>
						</div>
						<div className="col-md-4">
							<NumberField
								label="Cash Flow"
								value={s.cashFlow}
								onChange={(v) => update(s.id, { cashFlow: v ?? 0 })}
							/>
						</div>
					</FieldGrid>
				</div>
			))}
		</div>
	);
}
