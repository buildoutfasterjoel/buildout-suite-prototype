import type { DealSide, DealType, PropertyStatus, PropertyType } from "#/data/types";
import { STATUS_LABELS, TYPE_LABELS } from "#/components/properties/propertyDisplay";
import type { PipelineRow } from "./pipelineRows";

/**
 * Close date reads as a preset rather than a calendar: a pipeline question is
 * "what closes this quarter", not "what closes on the 14th".
 */
export type CloseDatePreset = "this-quarter" | "this-year" | "next-90" | "past";

export const CLOSE_DATE_LABELS: Record<CloseDatePreset, string> = {
  "this-quarter": "This quarter",
  "this-year": "This year",
  "next-90": "Next 90 days",
  past: "Past",
};

export const CLOSE_DATE_PRESETS: CloseDatePreset[] = [
  "this-quarter",
  "this-year",
  "next-90",
  "past",
];

/** Shared by the inline row and the All Filters modal so the option set never drifts. */
export const DEAL_TYPE_OPTIONS = ["Sale", "Lease"] as const;

/**
 * Every filter is single-select — "Any" plus one value — matching the reference
 * design's selects rather than the Deals list's multi-select facets. `null`
 * means Any.
 *
 * This state has three writers: the inline row, the All Filters modal, and chip
 * removal. That is why it lives here rather than inside any one of them.
 */
export interface PipelineFilterState {
  search: string;
  office: string | null;
  broker: string | null;
  stage: PropertyStatus | null;
  dealType: DealType | null;
  dealSide: DealSide | null;
  propertyType: PropertyType | null;
  closeDate: CloseDatePreset | null;
}

export const EMPTY_PIPELINE_FILTERS: PipelineFilterState = {
  search: "",
  office: null,
  broker: null,
  stage: null,
  dealType: null,
  dealSide: null,
  propertyType: null,
  closeDate: null,
};

export const DEAL_SIDE_LABELS: Record<DealSide, string> = {
  seller: "Seller / Landlord",
  buyer: "Buyer / Tenant",
};

/** Parsed as local time so a date never shifts a day backward. */
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function matchesCloseDate(
  closeDate: string | null,
  preset: CloseDatePreset,
  today: Date,
): boolean {
  // A deal with no close date is not "past" and not in any future window — it
  // simply has no answer, so every preset excludes it.
  if (!closeDate) return false;
  const when = parseIsoDate(closeDate);

  switch (preset) {
    case "past":
      return when < today;
    case "this-year":
      return when.getFullYear() === today.getFullYear() && when >= today;
    case "this-quarter": {
      const sameYear = when.getFullYear() === today.getFullYear();
      const sameQuarter =
        Math.floor(when.getMonth() / 3) === Math.floor(today.getMonth() / 3);
      return sameYear && sameQuarter && when >= today;
    }
    case "next-90": {
      const limit = new Date(today);
      limit.setDate(limit.getDate() + 90);
      return when >= today && when <= limit;
    }
  }
}

export function applyPipelineFilters(
  rows: PipelineRow[],
  f: PipelineFilterState,
  today: Date,
): PipelineRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.stage && r.stage !== f.stage) return false;
    if (f.dealType && r.dealType !== f.dealType) return false;
    if (f.dealSide && r.dealSide !== f.dealSide) return false;
    if (f.propertyType && r.propertyType !== f.propertyType) return false;
    if (f.office && r.office !== f.office) return false;
    if (f.broker && !r.brokers.includes(f.broker)) return false;
    if (f.closeDate && !matchesCloseDate(r.closeDate, f.closeDate, today)) return false;
    if (q) {
      const haystack =
        `${r.name} ${r.dealId} ${r.street ?? ""} ${r.city ?? ""} ${r.state ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export interface PipelineFilterChip {
  key: string;
  label: string;
  clear: (s: PipelineFilterState) => PipelineFilterState;
}

/**
 * One chip per active filter — inline and modal alike. A chips row that only
 * sometimes mirrors the controls above it is harder to read than one that
 * always states the whole filter state.
 */
export function pipelineFilterChips(f: PipelineFilterState): PipelineFilterChip[] {
  const chips: PipelineFilterChip[] = [];

  if (f.search.trim())
    chips.push({
      key: "search",
      label: `Search: ${f.search.trim()}`,
      clear: (s) => ({ ...s, search: "" }),
    });
  if (f.stage)
    chips.push({
      key: "stage",
      label: `Stage: ${STATUS_LABELS[f.stage]}`,
      clear: (s) => ({ ...s, stage: null }),
    });
  if (f.dealType)
    chips.push({
      key: "dealType",
      label: `Deal Type: ${f.dealType}`,
      clear: (s) => ({ ...s, dealType: null }),
    });
  if (f.propertyType)
    chips.push({
      key: "propertyType",
      label: `Property Type: ${TYPE_LABELS[f.propertyType]}`,
      clear: (s) => ({ ...s, propertyType: null }),
    });
  if (f.closeDate)
    chips.push({
      key: "closeDate",
      label: `Close Date: ${CLOSE_DATE_LABELS[f.closeDate]}`,
      clear: (s) => ({ ...s, closeDate: null }),
    });
  if (f.office)
    chips.push({
      key: "office",
      label: `Office: ${f.office}`,
      clear: (s) => ({ ...s, office: null }),
    });
  if (f.broker)
    chips.push({
      key: "broker",
      label: `Broker: ${f.broker}`,
      clear: (s) => ({ ...s, broker: null }),
    });
  if (f.dealSide)
    chips.push({
      key: "dealSide",
      label: `Deal Side: ${DEAL_SIDE_LABELS[f.dealSide]}`,
      clear: (s) => ({ ...s, dealSide: null }),
    });

  return chips;
}

