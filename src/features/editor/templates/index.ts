import type { Property } from "#/data/types";
import type { Page } from "../types";
import {
  buildAdvisorBiosPage,
  buildBrandDividerPage,
  buildComparablesPage,
  buildContentsPage,
  buildCoverPage,
  buildFinancialHeroPage,
  buildFinancialSummaryPage,
  buildLocationMapPage,
  buildPropertyDescriptionPage,
  buildPropertySummaryPage,
} from "./designer";

export type TemplateCategory =
  | "Cover" | "Financials" | "Property" | "Location" | "Comparables" | "Team";

export interface TemplateDef {
  key: string;
  name: string;
  category: TemplateCategory;
  description: string;
  build: (property?: Property) => Page;
}

/** All designer templates, in gallery display order. */
export const TEMPLATES: TemplateDef[] = [
  { key: "cover", name: "Cover Page", category: "Cover", description: "Full-bleed hero over a navy title band with address and asset line.", build: buildCoverPage },
  { key: "contents", name: "Table of Contents", category: "Cover", description: "A generated section list beside an editable opening statement.", build: buildContentsPage },
  { key: "financialHero", name: "Financial Highlights", category: "Financials", description: "Headline metric callouts above the financial summary.", build: buildFinancialHeroPage },
  { key: "financialSummary", name: "Financial Summary", category: "Financials", description: "Address header with a data-bound financial summary table.", build: buildFinancialSummaryPage },
  { key: "propertySummary", name: "Property Summary", category: "Property", description: "Full-bleed hero over the deal's sale copy and a fact table that follows the asset class.", build: buildPropertySummaryPage },
  { key: "propertyDescription", name: "Property Description", category: "Property", description: "A tall photo beside the deal's marketing title and description copy.", build: buildPropertyDescriptionPage },
  { key: "locationMap", name: "Location & Map", category: "Location", description: "Map image with submarket and city narrative.", build: buildLocationMapPage },
  { key: "comparables", name: "Sale Comparables", category: "Comparables", description: "A three-up grid of comparable properties with photos.", build: buildComparablesPage },
  { key: "advisorBios", name: "Advisor Bios", category: "Team", description: "Team layout: advisor photo, name, role, and blurb.", build: buildAdvisorBiosPage },
  { key: "brandDivider", name: "Section Divider", category: "Property", description: "A branded full-band section divider.", build: () => buildBrandDividerPage() },
];

/** Build a template page by key (falls back to the first template). */
export function buildTemplatePage(key: string, property?: Property): Page {
  const def = TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
  return def.build(property);
}

export { buildBlankPage } from "./blankPages";
