import type { DealUnderwriting, Property } from "#/data/types";
import type {
  Block,
  Cell,
  ContentBlock,
  DynamicKey,
  Page,
  TableBlock,
  TextStyle,
} from "./types";
import {
  DEFAULT_CELL_STYLE,
  DEFAULT_TEXT_STYLE,
  SERIF,
  uid,
} from "./blocks/blockFactory";
import { LOGO_SRC } from "./presets";
import {
  checksFor,
  coerceStrategy,
  strategyLabel,
} from "#/components/deals/underwriting/strategies";
import { buildCtx, type Ctx } from "#/components/deals/underwriting/underwritingResult";

/**
 * Builds the "Underwriting" section injected into a deal's document once the AI
 * has generated it. The checks the user selected (thoroughness) decide which
 * section pages appear — a Rapid Screen yields a short section, an Institutional
 * run a long one. All figures are FAKE but derived deterministically from the
 * property, so the numbers are stable across the editor's repeated rebuilds
 * (the editor holds no persistence) and never use Math.random.
 *
 * Sections are resolved by the stable `key` on each check in the deal's chosen
 * strategy (see `checksFor` in `src/components/deals/underwriting/strategies.ts`),
 * not by numeric index into a single global list.
 */

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontFamily: SERIF,
  fontSize: 32,
  align: "center",
};

const subtitleStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 13,
  align: "center",
  color: "#506079",
};

const introStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 12.5,
  lineHeight: 20,
  color: "#506079",
};

const sectionHeadingStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  bold: true,
  fontSize: 15,
  color: "#1f2a3d",
};

// ── Cell / table / block helpers ──────────────────────────────────────────────

function hcell(value: string, align: Cell["align"] = "left"): Cell {
  return {
    id: uid("cell"),
    value,
    header: true,
    align,
    style: { ...DEFAULT_CELL_STYLE, bold: true },
  };
}

function vcell(
  value: string,
  opts: { align?: Cell["align"]; dynamicKey?: DynamicKey; format?: Cell["format"] } = {},
): Cell {
  return {
    id: uid("cell"),
    value,
    dynamicKey: opts.dynamicKey,
    format: opts.format,
    align: opts.align ?? "right",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

function table(rows: Cell[][]): TableBlock {
  return {
    id: uid("block"),
    type: "table",
    style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
    rows,
  };
}

function heading(text: string, style: TextStyle): ContentBlock {
  return { id: uid("block"), type: "heading", text, style };
}

function text(value: string, style: TextStyle): ContentBlock {
  return { id: uid("block"), type: "text", text: value, style };
}

function spacer(height: number): ContentBlock {
  return { id: uid("block"), type: "spacer", height };
}

// ── Formatting + deterministic figures ────────────────────────────────────────

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (d: number) => `${(d * 100).toFixed(1)}%`;
const perSf = (n: number) => `$${n.toFixed(2)}`;

// ── Section builders (resolved by strategy check key via SECTION_BUILDERS) ────

interface Section {
  name: string;
  blocks: ContentBlock[];
}

function section(name: string, ...content: ContentBlock[]): Section {
  return { name, blocks: [text(name, sectionHeadingStyle), ...content] };
}

const TENANTS = ["Northwind Traders", "Contoso Ltd.", "Fabrikam Retail", "Adventure Works"];

function rentRollSection(c: Ctx): Section {
  const unitSqft = Math.round(c.sqft / 5);
  const rates = [c.rentPerSf, c.rentPerSf - 1, c.rentPerSf + 1.5, c.rentPerSf - 0.5];
  const rows: Cell[][] = [
    [hcell("Suite"), hcell("Tenant"), hcell("SF", "right"), hcell("Rent / mo", "right"), hcell("$/SF/yr", "right")],
  ];
  TENANTS.forEach((tenant, i) => {
    const rate = Math.max(8, rates[i]);
    rows.push([
      vcell(`Suite ${100 + i * 10}`, { align: "left" }),
      vcell(tenant, { align: "left" }),
      vcell(unitSqft.toLocaleString()),
      vcell(money((unitSqft * rate) / 12)),
      vcell(perSf(rate)),
    ]);
  });
  rows.push([
    vcell("Suite 150", { align: "left" }),
    vcell("Vacant", { align: "left" }),
    vcell(unitSqft.toLocaleString()),
    vcell("—"),
    vcell("—"),
  ]);
  return section("Rent Roll Summary", table(rows));
}

function projectInfoSection(c: Ctx, property: Property | undefined): Section {
  const type = property?.propertyType ?? "Multifamily";
  const year = property?.yearBuilt && property.yearBuilt > 0 ? String(property.yearBuilt) : "—";
  const zoning = property?.zoning || "Mixed-use (MU-2)";
  const lot = property?.lotSqFt && property.lotSqFt > 0 ? property.lotSqFt : Math.round(c.sqft * 1.8);
  const submarket = property?.submarket || "Central Business District";
  return section(
    "Project Information",
    table([
      [hcell("Property Type"), vcell(type, { align: "left" })],
      [hcell("Submarket"), vcell(submarket, { align: "left" })],
      [hcell("Year Built"), vcell(year)],
      [hcell("Building Size"), vcell(`${c.sqft.toLocaleString()} SF`)],
      [hcell("Lot Size"), vcell(`${lot.toLocaleString()} SF`)],
      [hcell("Zoning"), vcell(zoning, { align: "left" })],
    ]),
  );
}

function unitMixSection(c: Ctx): Section {
  const units = Math.max(4, Math.round(c.sqft / 850));
  const studio = Math.round(units * 0.2);
  const one = Math.round(units * 0.45);
  const two = units - studio - one;
  const baseRent = Math.max(1200, Math.round((c.rentPerSf * 850) / 12));
  return section(
    "Unit Mix",
    table([
      [hcell("Unit Type"), hcell("Units", "right"), hcell("Avg SF", "right"), hcell("Proj. Rent / mo", "right")],
      [vcell("Studio", { align: "left" }), vcell(String(studio)), vcell("520"), vcell(money(baseRent * 0.8))],
      [vcell("1 Bed / 1 Bath", { align: "left" }), vcell(String(one)), vcell("780"), vcell(money(baseRent))],
      [vcell("2 Bed / 2 Bath", { align: "left" }), vcell(String(two)), vcell("1,150"), vcell(money(baseRent * 1.45))],
      [hcell("Total"), hcell(String(units), "right"), hcell("—", "right"), hcell("—", "right")],
    ]),
  );
}

function incomeExpensesSection(c: Ctx, label: string): Section {
  return section(
    label,
    table([
      [hcell("Potential Gross Income"), vcell(money(c.pgi))],
      [hcell("Vacancy & Credit Loss"), vcell(`(${money(c.vacancy)})`)],
      [hcell("Effective Gross Income"), vcell(money(c.egi))],
      [hcell("Operating Expenses"), vcell(`(${money(c.opex)})`)],
      [hcell("Net Operating Income"), vcell(money(c.noi))],
    ]),
  );
}

function investmentCostSection(c: Ctx): Section {
  const land = Math.round(c.price * 0.35);
  const hard = Math.round(c.sqft * 185);
  const soft = Math.round(hard * 0.18);
  const contingency = Math.round((hard + soft) * 0.05);
  const total = land + hard + soft + contingency;
  return section(
    "Investment Cost Assumptions",
    table([
      [hcell("Land / Acquisition"), vcell(money(land))],
      [hcell("Hard Costs"), vcell(money(hard))],
      [hcell("Soft Costs"), vcell(money(soft))],
      [hcell("Contingency (5%)"), vcell(money(contingency))],
      [hcell("Total Project Cost"), vcell(money(total))],
    ]),
  );
}

function exitDispositionSection(c: Ctx): Section {
  const exitCap = c.cap - 0.005;
  const exitValue = Math.round(c.noi / exitCap / 10_000) * 10_000;
  return section(
    "Exit / Disposition Assumptions",
    table([
      [hcell("Hold Period"), vcell("5 years")],
      [hcell("Exit Cap Rate"), vcell(pct(exitCap))],
      [hcell("Projected Reversion Value"), vcell(money(exitValue))],
      [hcell("Cost of Sale"), vcell("2.0%")],
    ]),
  );
}

function financingSection(c: Ctx): Section {
  const dscr = c.noi / c.debtService;
  return section(
    "Financing Assumptions",
    table([
      [hcell("Loan Amount (65% LTV)"), vcell(money(c.loan))],
      [hcell("Interest Rate"), vcell("7.5%")],
      [hcell("Amortization"), vcell("30 years")],
      [hcell("Debt Service Coverage"), vcell(`${dscr.toFixed(2)}x`)],
      [hcell("Debt Yield"), vcell(pct(c.noi / c.loan))],
    ]),
  );
}

function gpLpTermsSection(c: Ctx): Section {
  const equity = Math.round(c.price * 0.35);
  return section(
    "GP / LP Terms",
    table([
      [hcell("Total Equity"), vcell(money(equity))],
      [hcell("LP / GP Split"), vcell("90% / 10%", { align: "left" })],
      [hcell("Preferred Return"), vcell("8.0%")],
      [hcell("Promote (above pref)"), vcell("20%")],
      [hcell("Target Equity Multiple"), vcell("1.9x")],
    ]),
  );
}

function renovationBudgetSection(c: Ctx): Section {
  const units = Math.max(4, Math.round(c.sqft / 850));
  const perUnit = 22_500;
  const interior = units * perUnit;
  const common = Math.round(interior * 0.3);
  const exterior = Math.round(c.sqft * 6);
  const total = interior + common + exterior;
  return section(
    "Renovation & Capex Budget",
    table([
      [hcell("Scope"), hcell("Basis", "right"), hcell("Cost", "right")],
      [vcell("Interior units", { align: "left" }), vcell(`${units} × ${money(perUnit)}`), vcell(money(interior))],
      [vcell("Common areas", { align: "left" }), vcell("Lump sum"), vcell(money(common))],
      [vcell("Exterior / systems", { align: "left" }), vcell(`${c.sqft.toLocaleString()} SF`), vcell(money(exterior))],
      [hcell("Total Capex"), hcell("", "right"), vcell(money(total))],
    ]),
  );
}

function stabilizedProformaSection(c: Ctx): Section {
  const stabilizedNoi = Math.round(c.noi * 1.28);
  const stabilizedValue = Math.round(stabilizedNoi / c.cap / 10_000) * 10_000;
  return section(
    "Stabilized (Post-Reno) Pro-Forma",
    table([
      [hcell("Metric"), hcell("In-Place", "right"), hcell("Stabilized", "right")],
      [vcell("Effective Gross Income", { align: "left" }), vcell(money(c.egi)), vcell(money(Math.round(c.egi * 1.22)))],
      [vcell("Net Operating Income", { align: "left" }), vcell(money(c.noi)), vcell(money(stabilizedNoi))],
      [
        vcell("Value @ Going-In Cap", { align: "left" }),
        vcell(money(Math.round(c.noi / c.cap / 10_000) * 10_000)),
        vcell(money(stabilizedValue)),
      ],
    ]),
  );
}

type SectionBuilder = (c: Ctx, property: Property | undefined) => Section;

/** Resolves each strategy check `key` to its document section builder. */
const SECTION_BUILDERS: Record<string, SectionBuilder> = {
  "project-info": (c, p) => projectInfoSection(c, p),
  "unit-mix": (c) => unitMixSection(c),
  "income-expenses": (c) => incomeExpensesSection(c, "Pro-Forma Income & Expenses"),
  "income-expenses-inplace": (c) => incomeExpensesSection(c, "In-Place Income & Expenses"),
  "investment-cost": (c) => investmentCostSection(c),
  "exit-disposition": (c) => exitDispositionSection(c),
  financing: (c) => financingSection(c),
  "gp-lp-terms": (c) => gpLpTermsSection(c),
  "rent-roll": (c) => renameSection(rentRollSection(c), "Current Rent Roll"),
  "renovation-budget": (c) => renovationBudgetSection(c),
  "stabilized-proforma": (c) => stabilizedProformaSection(c),
};

/** Rename a section (and its heading block) without rebuilding it. */
function renameSection(s: Section, name: string): Section {
  const blocks = [...s.blocks];
  if (blocks[0]?.type === "heading" || blocks[0]?.type === "text") {
    blocks[0] = { ...blocks[0], text: name } as ContentBlock;
  }
  return { name, blocks };
}

// ── Page assembly ─────────────────────────────────────────────────────────────

function addressOf(property: Property | undefined): string {
  return property
    ? `${property.street}, ${property.city}, ${property.state} ${property.zip}`.replace(/\s+,/g, ",")
    : "123 Market Street, Dallas, TX 75201";
}

/** The lead summary page: title, headline metrics, and the scope checklist. */
function buildSummaryPage(property: Property | undefined, uw: DealUnderwriting, c: Ctx): Page {
  const strategy = coerceStrategy(uw.strategy);
  const checks = checksFor(strategy);
  const selected = new Set(uw.selectedChecks);
  const scopeRows: Cell[][] = [
    [hcell("Analysis"), hcell("Status", "right")],
    ...checks.map((check, i): Cell[] => [
      vcell(check.label, { align: "left" }),
      vcell(selected.has(i) ? "✓ Included" : "—"),
    ]),
  ];

  // Headline figures use the same deterministic fake values as the section
  // tables, so the whole underwriting reads consistently even for a fresh deal
  // whose property record has no financials yet.
  const metricsTable: TableBlock = table([
    [hcell("Asking Price"), vcell(money(c.price))],
    [hcell("Cap Rate"), vcell(pct(c.cap))],
    [hcell("Net Operating Income"), vcell(money(c.noi))],
    [hcell("Building Size"), vcell(`${c.sqft.toLocaleString()} SF`)],
  ]);

  const includedCount = checks.filter((_, i) => selected.has(i)).length;
  return {
    id: uid("page"),
    name: "Underwriting",
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      heading("Underwriting", headingStyle),
      text(
        `${strategyLabel(strategy)} · ${includedCount} of ${checks.length} analyses · Generated by AI · ${addressOf(property)}`,
        subtitleStyle,
      ),
      text(
        "This underwriting was assembled automatically by AI from property, market, and " +
          "financial data. Figures are estimates for review and should be verified before use.",
        introStyle,
      ),
      spacer(8),
      text("Headline Metrics", sectionHeadingStyle),
      metricsTable,
      spacer(16),
      text("Scope", sectionHeadingStyle),
      table(scopeRows),
    ],
  };
}

/** A content page holding up to `perPage` sections stacked with spacers. */
function buildContentPage(sections: Section[]): Page {
  const blocks: Block[] = [];
  sections.forEach((s, i) => {
    if (i > 0) blocks.push(spacer(20));
    blocks.push(...s.blocks);
  });
  return {
    id: uid("page"),
    name: `Underwriting — ${sections.map((s) => s.name).join(" · ")}`,
    logoSrc: LOGO_SRC,
    locked: true,
    blocks,
  };
}

/**
 * Build the full underwriting section for a deal: a summary page followed by
 * content pages that render the selected checks (≈2 per page). Returns an empty
 * array when the underwriting isn't ready, so callers can spread it freely.
 */
export function buildUnderwritingSection(
  property: Property | undefined,
  underwriting: DealUnderwriting | undefined,
): Page[] {
  if (!underwriting || underwriting.status !== "ready") return [];

  const ctx = buildCtx(property);
  const strategy = coerceStrategy(underwriting.strategy);
  const checks = checksFor(strategy);
  const selected = [...underwriting.selectedChecks]
    .filter((i) => i >= 0 && i < checks.length)
    .sort((a, b) => a - b);
  const sections = selected
    .map((i) => SECTION_BUILDERS[checks[i].key])
    .filter((b): b is SectionBuilder => Boolean(b))
    .map((build) => build(ctx, property));

  const pages: Page[] = [buildSummaryPage(property, underwriting, ctx)];
  const PER_PAGE = 2;
  for (let i = 0; i < sections.length; i += PER_PAGE) {
    pages.push(buildContentPage(sections.slice(i, i + PER_PAGE)));
  }
  return pages;
}
