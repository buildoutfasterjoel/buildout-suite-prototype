import { useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";
import {
  faCircle,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import {
  UNDERWRITING_STRATEGIES,
  STRATEGY_ORDER,
  DEFAULT_STRATEGY,
  checksFor,
  strategyLabel,
  defaultSelectionFor,
  type UnderwritingStrategyId,
} from "./underwriting/strategies";
import "./UnderwritingDepth.scss";

/**
 * Underwriting control — pick a strategy (New Construction / Value-Add), then set
 * how thorough the analysis is. The strategy chooses which checks exist; the
 * slider selects the first N of them, and individual checks can be toggled.
 * Controlled when `strategy`/`value`/`onStrategyChange`/`onChange` are supplied,
 * otherwise fully self-managed.
 */
export function UnderwritingDepth({
  strategy,
  value,
  onStrategyChange,
  onChange,
}: {
  strategy?: UnderwritingStrategyId;
  value?: Set<number>;
  onStrategyChange?: (next: UnderwritingStrategyId) => void;
  onChange?: (next: Set<number>) => void;
} = {}) {
  const [internalStrategy, setInternalStrategy] =
    useState<UnderwritingStrategyId>(DEFAULT_STRATEGY);
  const [internalSel, setInternalSel] = useState<Set<number>>(() =>
    defaultSelectionFor(DEFAULT_STRATEGY),
  );
  const [checksOpen, setChecksOpen] = useState(false);

  const activeStrategy = strategy ?? internalStrategy;
  const selectedSet = value ?? internalSel;
  const checks = checksFor(activeStrategy);
  const total = checks.length;
  const count = [...selectedSet].filter((i) => i >= 0 && i < total).length;
  const fillPct = (count / total) * 100;

  const setStrategy = (next: UnderwritingStrategyId) => {
    // Switching strategy resets the depth to that strategy's full check list.
    const resetSel = defaultSelectionFor(next);
    if (onStrategyChange) onStrategyChange(next);
    else setInternalStrategy(next);
    if (onChange) onChange(resetSel);
    else setInternalSel(resetSel);
  };

  const updateSel = (next: Set<number>) =>
    onChange ? onChange(next) : setInternalSel(next);

  // Dragging the slider selects the first N checks in order.
  const setDepth = (n: number) =>
    updateSel(new Set(Array.from({ length: n }, (_, i) => i)));

  // Clicking a check toggles just that one (selection may be non-contiguous).
  const toggleCheck = (i: number) => {
    const next = new Set(selectedSet);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    updateSel(next);
  };

  return (
    <div className="underwriting-depth border rounded p-3">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <span className="fw-semibold">Underwriting strategy</span>
        <Badge variant="secondary" appearance="accent" className="underwriting-depth__badge">
          {strategyLabel(activeStrategy)}
        </Badge>
      </div>

      <Select
        value={activeStrategy}
        onValueChange={(v) => v && setStrategy(v as UnderwritingStrategyId)}
      >
        <Select.Trigger>
          <Select.Value>
            {(v) => strategyLabel(v as UnderwritingStrategyId)}
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          {STRATEGY_ORDER.map((id) => (
            <Select.Item key={id} value={id}>
              <div className="d-flex flex-column">
                <span className="fw-medium">{UNDERWRITING_STRATEGIES[id].label}</span>
                <span className="fs-small text-muted">
                  {UNDERWRITING_STRATEGIES[id].description}
                </span>
              </div>
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      <p className="fs-small text-muted mt-2 mb-3">
        {UNDERWRITING_STRATEGIES[activeStrategy].description} Set how thorough the
        analysis is below.
      </p>

      <div className="d-flex justify-content-between fs-small text-muted mb-1">
        <span>Fast</span>
        <span>Thorough</span>
      </div>
      <input
        type="range"
        className="underwriting-depth__slider"
        min={0}
        max={total}
        step={1}
        value={count}
        onChange={(e) => setDepth(Number(e.target.value))}
        aria-label="Underwriting depth"
        style={{ "--fill": `${fillPct}%` } as React.CSSProperties}
      />

      <Separator className="my-3" />

      <div className="d-flex align-items-center justify-content-between gap-2">
        <button
          type="button"
          className="underwriting-depth__toggle"
          onClick={() => setChecksOpen((o) => !o)}
        >
          <FontAwesomeIcon icon={checksOpen ? faChevronDown : faChevronRight} />
          {checksOpen ? "Hide checks" : "Show checks"}
        </button>
        <span className="fs-small text-muted">
          <span className="fw-semibold text-body">{count}</span> of {total} checks
        </span>
      </div>

      {checksOpen && (
        <div className="underwriting-depth__checks mt-3">
          {checks.map((check, i) => {
            const on = selectedSet.has(i);
            return (
              <button
                type="button"
                key={check.key}
                className={`underwriting-depth__check${on ? " is-on" : ""}`}
                onClick={() => toggleCheck(i)}
                aria-pressed={on}
              >
                <span className="underwriting-depth__check-icon">
                  <FontAwesomeIcon icon={faCircle} className="uw-icon uw-icon--off" />
                  <FontAwesomeIcon icon={faCircleCheck} className="uw-icon uw-icon--on" />
                </span>
                <span>{check.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
