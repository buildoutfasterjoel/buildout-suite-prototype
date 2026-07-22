import type { Property } from "#/data/types";
import type {
  DealUnderwriting,
  UnderwritingMetric,
  UnderwritingResult,
  UnderwritingResultSection,
  UnderwritingResultRow,
} from "#/data/types";
import { checksFor, coerceStrategy } from "./strategies";

/** The deterministic figure model behind a deal's underwriting. */
export interface Ctx {
  price: number;
  sqft: number;
  cap: number;
  noi: number;
  egi: number;
  opex: number;
  pgi: number;
  vacancy: number;
  rentPerSf: number;
  loan: number;
  debtService: number;
}

/**
 * Back a full income + financing model out of a property's headline figures.
 * All values are FAKE but deterministic (no Math.random / Date) so repeated
 * builds are stable. Falls back to sensible constants for a bare property.
 */
export function buildCtx(property: Property | undefined): Ctx {
  const price = property && property.askingPrice > 0 ? property.askingPrice : 2_450_000;
  const sqft = property && property.buildingSqFt > 0 ? property.buildingSqFt : 42_000;
  const cap = property && property.capRate > 0 ? property.capRate : 0.062;
  const noi = Math.round(price * cap);
  const egi = Math.round(noi / 0.62);
  const opex = egi - noi;
  const pgi = Math.round(egi / 0.94);
  const vacancy = pgi - egi;
  const rentPerSf = Math.round((pgi / sqft) * 100) / 100;
  const loan = Math.round(price * 0.65);
  const debtService = Math.round(loan * 0.075);
  return { price, sqft, cap, noi, egi, opex, pgi, vacancy, rentPerSf, loan, debtService };
}

// ── Formatters ────────────────────────────────────────────────────────────────
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (d: number) => `${(d * 100).toFixed(1)}%`;
const perSf = (n: number) => `$${n.toFixed(2)}`;

function metric(
  key: string,
  label: string,
  value: number,
  format: UnderwritingMetric["format"],
  display: string,
): UnderwritingMetric {
  return { key, label, value, display, format };
}

function row(cells: string[], emphasis = false): UnderwritingResultRow {
  return { cells, emphasis };
}

// ── Metrics (always the full set, independent of selected checks) ──────────────
function buildMetrics(c: Ctx): UnderwritingMetric[] {
  const dscr = c.noi / c.debtService;
  const exitCap = c.cap - 0.005;
  const reversion = Math.round(c.noi / exitCap / 10_000) * 10_000;
  const stabilizedNoi = Math.round(c.noi * 1.28);
  const stabilizedValue = Math.round(stabilizedNoi / c.cap / 10_000) * 10_000;
  const land = Math.round(c.price * 0.35);
  const hard = Math.round(c.sqft * 185);
  const soft = Math.round(hard * 0.18);
  const contingency = Math.round((hard + soft) * 0.05);
  const totalProjectCost = land + hard + soft + contingency;
  const equity = Math.round(c.price * 0.35);
  return [
    metric("askingPrice", "Asking Price", c.price, "money", money(c.price)),
    metric("goingInCapRate", "Going-In Cap Rate", c.cap, "percent", pct(c.cap)),
    metric("netOperatingIncome", "Net Operating Income", c.noi, "money", money(c.noi)),
    metric("buildingSize", "Building Size", c.sqft, "sqft", `${c.sqft.toLocaleString()} SF`),
    metric("potentialGrossIncome", "Potential Gross Income", c.pgi, "money", money(c.pgi)),
    metric("effectiveGrossIncome", "Effective Gross Income", c.egi, "money", money(c.egi)),
    metric("operatingExpenses", "Operating Expenses", c.opex, "money", money(c.opex)),
    metric("vacancyCreditLoss", "Vacancy & Credit Loss", c.vacancy, "money", money(c.vacancy)),
    metric("rentPerSf", "Rent / SF / yr", c.rentPerSf, "money", perSf(c.rentPerSf)),
    metric("loanAmount", "Loan Amount (65% LTV)", c.loan, "money", money(c.loan)),
    metric("debtService", "Annual Debt Service", c.debtService, "money", money(c.debtService)),
    metric("dscr", "Debt Service Coverage", dscr, "ratio", `${dscr.toFixed(2)}x`),
    metric("debtYield", "Debt Yield", c.noi / c.loan, "percent", pct(c.noi / c.loan)),
    metric("exitCapRate", "Exit Cap Rate", exitCap, "percent", pct(exitCap)),
    metric("reversionValue", "Projected Reversion Value", reversion, "money", money(reversion)),
    metric("stabilizedNOI", "Stabilized NOI", stabilizedNoi, "money", money(stabilizedNoi)),
    metric("stabilizedValue", "Stabilized Value", stabilizedValue, "money", money(stabilizedValue)),
    metric("totalProjectCost", "Total Project Cost", totalProjectCost, "money", money(totalProjectCost)),
    metric("totalEquity", "Total Equity", equity, "money", money(equity)),
    metric("targetEquityMultiple", "Target Equity Multiple", 1.9, "ratio", "1.9x"),
  ];
}

// ── Sections (plain data; one per selected check) ──────────────────────────────
const TENANTS = ["Northwind Traders", "Contoso Ltd.", "Fabrikam Retail", "Adventure Works"];

function keyValue(key: string, name: string, rows: [string, string][]): UnderwritingResultSection {
  return { key, name, kind: "keyValue", rows: rows.map(([l, v]) => row([l, v])) };
}

function projectInfo(c: Ctx, p: Property | undefined): UnderwritingResultSection {
  const type = p?.propertyType ?? "Multifamily";
  const year = p?.yearBuilt && p.yearBuilt > 0 ? String(p.yearBuilt) : "—";
  const zoning = p?.zoning || "Mixed-use (MU-2)";
  const lot = p?.lotSqFt && p.lotSqFt > 0 ? p.lotSqFt : Math.round(c.sqft * 1.8);
  const submarket = p?.submarket || "Central Business District";
  return keyValue("project-info", "Project Information", [
    ["Property Type", type],
    ["Submarket", submarket],
    ["Year Built", year],
    ["Building Size", `${c.sqft.toLocaleString()} SF`],
    ["Lot Size", `${lot.toLocaleString()} SF`],
    ["Zoning", zoning],
  ]);
}

function incomeExpenses(c: Ctx, key: string, name: string): UnderwritingResultSection {
  return keyValue(key, name, [
    ["Potential Gross Income", money(c.pgi)],
    ["Vacancy & Credit Loss", `(${money(c.vacancy)})`],
    ["Effective Gross Income", money(c.egi)],
    ["Operating Expenses", `(${money(c.opex)})`],
    ["Net Operating Income", money(c.noi)],
  ]);
}

function investmentCost(c: Ctx): UnderwritingResultSection {
  const land = Math.round(c.price * 0.35);
  const hard = Math.round(c.sqft * 185);
  const soft = Math.round(hard * 0.18);
  const contingency = Math.round((hard + soft) * 0.05);
  return keyValue("investment-cost", "Investment Cost Assumptions", [
    ["Land / Acquisition", money(land)],
    ["Hard Costs", money(hard)],
    ["Soft Costs", money(soft)],
    ["Contingency (5%)", money(contingency)],
    ["Total Project Cost", money(land + hard + soft + contingency)],
  ]);
}

function exitDisposition(c: Ctx): UnderwritingResultSection {
  const exitCap = c.cap - 0.005;
  const exitValue = Math.round(c.noi / exitCap / 10_000) * 10_000;
  return keyValue("exit-disposition", "Exit / Disposition Assumptions", [
    ["Hold Period", "5 years"],
    ["Exit Cap Rate", pct(exitCap)],
    ["Projected Reversion Value", money(exitValue)],
    ["Cost of Sale", "2.0%"],
  ]);
}

function financing(c: Ctx): UnderwritingResultSection {
  const dscr = c.noi / c.debtService;
  return keyValue("financing", "Financing Assumptions", [
    ["Loan Amount (65% LTV)", money(c.loan)],
    ["Interest Rate", "7.5%"],
    ["Amortization", "30 years"],
    ["Debt Service Coverage", `${dscr.toFixed(2)}x`],
    ["Debt Yield", pct(c.noi / c.loan)],
  ]);
}

function gpLpTerms(c: Ctx): UnderwritingResultSection {
  const equity = Math.round(c.price * 0.35);
  return keyValue("gp-lp-terms", "GP / LP Terms", [
    ["Total Equity", money(equity)],
    ["LP / GP Split", "90% / 10%"],
    ["Preferred Return", "8.0%"],
    ["Promote (above pref)", "20%"],
    ["Target Equity Multiple", "1.9x"],
  ]);
}

function unitMix(c: Ctx): UnderwritingResultSection {
  const units = Math.max(4, Math.round(c.sqft / 850));
  const studio = Math.round(units * 0.2);
  const one = Math.round(units * 0.45);
  const two = units - studio - one;
  const baseRent = Math.max(1200, Math.round((c.rentPerSf * 850) / 12));
  return {
    key: "unit-mix",
    name: "Unit Mix",
    kind: "matrix",
    columns: ["Unit Type", "Units", "Avg SF", "Proj. Rent / mo"],
    rows: [
      row(["Studio", String(studio), "520", money(baseRent * 0.8)]),
      row(["1 Bed / 1 Bath", String(one), "780", money(baseRent)]),
      row(["2 Bed / 2 Bath", String(two), "1,150", money(baseRent * 1.45)]),
      row(["Total", String(units), "—", "—"], true),
    ],
  };
}

function rentRoll(c: Ctx): UnderwritingResultSection {
  const unitSqft = Math.round(c.sqft / 5);
  const rates = [c.rentPerSf, c.rentPerSf - 1, c.rentPerSf + 1.5, c.rentPerSf - 0.5];
  const rows: UnderwritingResultRow[] = TENANTS.map((tenant, i) => {
    const rate = Math.max(8, rates[i]);
    return row([
      `Suite ${100 + i * 10}`,
      tenant,
      unitSqft.toLocaleString(),
      money((unitSqft * rate) / 12),
      perSf(rate),
    ]);
  });
  rows.push(row([`Suite 150`, "Vacant", unitSqft.toLocaleString(), "—", "—"]));
  return {
    key: "rent-roll",
    name: "Current Rent Roll",
    kind: "matrix",
    columns: ["Suite", "Tenant", "SF", "Rent / mo", "$/SF/yr"],
    rows,
  };
}

function renovationBudget(c: Ctx): UnderwritingResultSection {
  const units = Math.max(4, Math.round(c.sqft / 850));
  const perUnit = 22_500;
  const interior = units * perUnit;
  const common = Math.round(interior * 0.3);
  const exterior = Math.round(c.sqft * 6);
  return {
    key: "renovation-budget",
    name: "Renovation & Capex Budget",
    kind: "matrix",
    columns: ["Scope", "Basis", "Cost"],
    rows: [
      row(["Interior units", `${units} × ${money(perUnit)}`, money(interior)]),
      row(["Common areas", "Lump sum", money(common)]),
      row(["Exterior / systems", `${c.sqft.toLocaleString()} SF`, money(exterior)]),
      row(["Total Capex", "", money(interior + common + exterior)], true),
    ],
  };
}

function stabilizedProforma(c: Ctx): UnderwritingResultSection {
  const stabilizedNoi = Math.round(c.noi * 1.28);
  const stabilizedValue = Math.round(stabilizedNoi / c.cap / 10_000) * 10_000;
  const inPlaceValue = Math.round(c.noi / c.cap / 10_000) * 10_000;
  return {
    key: "stabilized-proforma",
    name: "Stabilized (Post-Reno) Pro-Forma",
    kind: "matrix",
    columns: ["Metric", "In-Place", "Stabilized"],
    rows: [
      row(["Effective Gross Income", money(c.egi), money(Math.round(c.egi * 1.22))]),
      row(["Net Operating Income", money(c.noi), money(stabilizedNoi)]),
      row(["Value @ Going-In Cap", money(inPlaceValue), money(stabilizedValue)]),
    ],
  };
}

/** Resolves each strategy check `key` to its plain-data section builder. */
const SECTIONS: Record<string, (c: Ctx, p: Property | undefined) => UnderwritingResultSection> = {
  "project-info": (c, p) => projectInfo(c, p),
  "unit-mix": (c) => unitMix(c),
  "income-expenses": (c) => incomeExpenses(c, "income-expenses", "Pro-Forma Income & Expenses"),
  "income-expenses-inplace": (c) => incomeExpenses(c, "income-expenses-inplace", "In-Place Income & Expenses"),
  "investment-cost": (c) => investmentCost(c),
  "exit-disposition": (c) => exitDisposition(c),
  financing: (c) => financing(c),
  "gp-lp-terms": (c) => gpLpTerms(c),
  "rent-roll": (c) => rentRoll(c),
  "renovation-budget": (c) => renovationBudget(c),
  "stabilized-proforma": (c) => stabilizedProforma(c),
};

function addressOf(p: Property | undefined): string {
  return p
    ? `${p.street}, ${p.city}, ${p.state} ${p.zip}`.replace(/\s+,/g, ",")
    : "123 Market Street, Dallas, TX 75201";
}

/**
 * Build the stored underwriting result: the full flat metric set plus one
 * plain-data section per SELECTED check (in strategy order). Pure + deterministic.
 */
export function buildUnderwritingResult(
  property: Property | undefined,
  underwriting: DealUnderwriting,
): UnderwritingResult {
  const c = buildCtx(property);
  const strategy = coerceStrategy(underwriting.strategy);
  const checks = checksFor(strategy);
  const sections = [...underwriting.selectedChecks]
    .filter((i) => i >= 0 && i < checks.length)
    .sort((a, b) => a - b)
    .map((i) => SECTIONS[checks[i].key])
    .filter((b): b is (c: Ctx, p: Property | undefined) => UnderwritingResultSection => Boolean(b))
    .map((build) => build(c, property));
  return {
    strategy,
    metrics: buildMetrics(c),
    sections,
    inputs: {
      address: addressOf(property),
      askingPrice: c.price,
      buildingSqFt: c.sqft,
      capRate: c.cap,
    },
  };
}
