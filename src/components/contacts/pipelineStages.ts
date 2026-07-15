import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faSnowflake,
  faComments,
  faMemoCircleCheck,
  faSign,
  faFileMagnifyingGlass,
  faHandshakeSimple,
} from "@fortawesome/pro-regular-svg-icons";
import {
  emptyContactFilters,
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";

/**
 * "My Pipeline" — a fixed set of preset filter pages that model the pipeline's
 * two ladders (see the Pipeline & lifecycle reference). Cold and Nurturing live
 * on the contact (relationship temperature); Pitching, Active, Under Contract,
 * and Closed live on the deal (transaction stage).
 *
 * Unlike user dynamic lists, these are NOT stored in the call-list store and are
 * not editable: their saved filter set is fixed. Landing on one loads its preset
 * filters; altering them offers only "Save as New List" + "Revert" (never a
 * "Save Filters" that would edit the preset).
 */
export interface PipelineStage {
  /** Stable id, also used as the active-list id when this page is open. */
  id: string;
  label: string;
  description: string;
  /** Nav icon + its color (hex of a Blueprint palette token, per Figma). */
  icon: IconDefinition;
  color: string;
  /** Builds the preset working filters (fresh Sets each call). */
  preset: () => ContactFilterState;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "pipeline-cold",
    label: "Cold",
    description:
      'In your book with nothing on the calendar — no follow-up scheduled, regardless of past contact. Your "needs a next touch" worklist.',
    icon: faSnowflake,
    color: "#00b8d8", // seagull-500
    preset: () => ({ ...emptyContactFilters(), relationship: new Set(["cold"]) }),
  },
  {
    id: "pipeline-nurturing",
    label: "Nurturing",
    description:
      "You have an open follow-up scheduled (a planned next touch), but no deal yet.",
    icon: faComments,
    color: "#ff5961", // solid-pink-400
    preset: () => ({
      ...emptyContactFilters(),
      relationship: new Set(["nurturing"]),
    }),
  },
  {
    id: "pipeline-pitching",
    label: "Pitching",
    description:
      "Actively pitching — BOVs, comps, and docs are out. A deal is open but not yet won.",
    icon: faMemoCircleCheck,
    color: "#e27400", // harvest-gold-600
    preset: () => ({
      ...emptyContactFilters(),
      dealStage: new Set(["pitching"]),
    }),
  },
  {
    id: "pipeline-active",
    label: "Active",
    description:
      "A won deal that's live: an active listing on the market, or an active buy-side search touring and making offers.",
    icon: faSign,
    color: "#3f86f2", // buildout-blue-500
    preset: () => ({
      ...emptyContactFilters(),
      dealStage: new Set(["active"]),
    }),
  },
  {
    id: "pipeline-under-contract",
    label: "Under Contract",
    description:
      "Under offer or contract and in diligence — where a potential deal becomes a committed one.",
    icon: faFileMagnifyingGlass,
    color: "#9f55f7", // purple-heart-500
    preset: () => ({
      ...emptyContactFilters(),
      dealStage: new Set(["under_contract"]),
    }),
  },
  {
    id: "pipeline-closed",
    label: "Closed",
    description:
      "Funded and done. Closing flips the contact to Client, then Past Client.",
    icon: faHandshakeSimple,
    color: "#00a46d", // mountain-meadow-600
    preset: () => ({
      ...emptyContactFilters(),
      dealStage: new Set(["closed"]),
    }),
  },
];

/** The pipeline stage for an active-list id, if that id names one. */
export function getPipelineStage(id: string): PipelineStage | undefined {
  return PIPELINE_STAGES.find((s) => s.id === id);
}
