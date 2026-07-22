import type { Property } from "#/data/types";
import type { Page } from "../types";
import {
  buildAdvisorBiosPage,
  buildBrandDividerPage,
  buildComparablesPage,
  buildCoverPage,
  buildFinancialHeroPage,
  buildFinancialSummaryPage,
  buildLocationMapPage,
  buildPropertyOverviewPage,
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
  { key: "cover", name: "Cover Page", category: "Cover", description: "Full-bleed hero, logo, title, and a deal-stat strip.", build: buildCoverPage },
  { key: "financialHero", name: "Financial Highlights", category: "Financials", description: "Headline metric callouts above the financial summary.", build: buildFinancialHeroPage },
  { key: "financialSummary", name: "Financial Summary", category: "Financials", description: "Address header with a data-bound financial summary table.", build: buildFinancialSummaryPage },
  { key: "propertyOverview", name: "Property Overview", category: "Property", description: "Magazine-style two-column overview with a highlights table.", build: buildPropertyOverviewPage },
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

export { buildBlankPage, buildOnBrandBlankPage } from "./blankPages";
