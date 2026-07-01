import type { Property } from "#/data/types";
import type { EditorDocument } from "./types";
import { buildPresetPage } from "./presets";

/**
 * Build the sample "Proposal" document, seeded with the bound listing's real
 * data. Ships two contrasting pages so the editor demonstrates both modes:
 *
 * - Page 1: a **locked preset** ("Financial Summary") — fixed layout with
 *   editable content (image, text, and a data-bound table).
 * - Page 2: a **freeform** page ("Property Overview") — fully editable layout
 *   the user can drag, add to, and rearrange.
 */
export function buildSampleDocument(property: Property | undefined): EditorDocument {
  return {
    id: "doc-proposal",
    name: "Proposal",
    pages: [
      buildPresetPage("financialSummary", property),
      { ...buildPresetPage("propertyOverview", property), locked: false },
    ],
  };
}
