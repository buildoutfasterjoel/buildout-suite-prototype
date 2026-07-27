import { useState } from "react";
import type { UnderwritingResult } from "#/data/types";
import "./SensitivityPlayground.scss";

/**
 * Sensitivity playground — drag a cap rate and a rent-growth assumption and the
 * estimated valuation recalculates live off the underwriting's Year 1 NOI.
 * Purely a what-if surface: nothing here mutates the stored underwriting result.
 */

const CAP = { min: 3, max: 10, step: 0.05 };
const GROWTH = { min: 0, max: 8, step: 0.1 };
const DEFAULT_GROWTH = 3;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
/** Snap to the nearest step so the thumb always lands on a real notch. */
const snap = (n: number, step: number) => Math.round(n / step) * step;
const fillPct = (value: number, { min, max }: { min: number; max: number }) =>
  ((value - min) / (max - min)) * 100;

function formatValuation(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function SensitivityPlayground({ result }: { result: UnderwritingResult }) {
  const baseNoi = result.metrics.find((m) => m.key === "netOperatingIncome")?.value ?? 0;
  const baseCap = clamp(snap(result.inputs.capRate * 100, CAP.step), CAP.min, CAP.max);

  const [cap, setCap] = useState(baseCap);
  const [growth, setGrowth] = useState(DEFAULT_GROWTH);

  const valuation = (baseNoi * (1 + growth / 100)) / (cap / 100);

  return (
    <div className="sensitivity border rounded p-3">
      <div className="d-flex align-items-baseline flex-wrap gap-2 mb-3">
        <span className="fw-semibold">Sensitivity playground</span>
        <span className="fs-small text-muted">Tweak assumptions, valuation updates live</span>
      </div>

      <div className="row g-3 align-items-center">
        <div className="col-lg-7">
          <div className="d-flex flex-column gap-3">
            <SliderRow
              label="Cap rate"
              display={`${cap.toFixed(2)}%`}
              range={CAP}
              value={cap}
              onChange={setCap}
            />
            <SliderRow
              label="Rent growth"
              display={`${growth.toFixed(1)}%`}
              range={GROWTH}
              value={growth}
              onChange={setGrowth}
            />
          </div>
        </div>

        <div className="col-lg-5">
          <div className="sensitivity__panel">
            <div className="sensitivity__panel-label fs-small fw-semibold">
              Estimated valuation
            </div>
            <div className="sensitivity__panel-value">{formatValuation(valuation)}</div>
            <div className="sensitivity__panel-note fs-small">
              Year 1 NOI / cap rate · adjusted for rent growth
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  display,
  range,
  value,
  onChange,
}: {
  label: string;
  display: string;
  range: { min: number; max: number; step: number };
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="mb-1">
        {label} ·{" "}
        <span className="fw-semibold text-buildout-blue-700">{display}</span>
      </div>
      <input
        type="range"
        className="sensitivity__slider"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={display}
        style={{ "--fill": `${fillPct(value, range)}%` } as React.CSSProperties}
      />
    </div>
  );
}
