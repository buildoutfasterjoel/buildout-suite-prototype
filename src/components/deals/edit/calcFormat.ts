// ── Read-only computed-field display formatting ─────────────────────────────

/** Rounded, comma-formatted currency-ish figure; blank (not "0") when null. */
export function formatCalcAmount(v: number | null): string {
	return v == null ? "" : Math.round(v).toLocaleString();
}

/** Percentage with 2 decimals; blank (not "0.00") when null. */
export function formatCalcPercent(v: number | null): string {
	return v == null ? "" : `${v.toFixed(2)}%`;
}
