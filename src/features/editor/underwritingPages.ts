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

/**
 * Builds the "Underwriting" section injected into a deal's document once Cactus
 * has generated it. The checks the user selected (thoroughness) decide which
 * section pages appear — a Rapid Screen yields a short section, an Institutional
 * run a long one. All figures are FAKE but derived deterministically from the
 * property, so the numbers are stable across the editor's repeated rebuilds
 * (the editor holds no persistence) and never use Math.random.
 *
 * The 12 sections are indexed to match `UNDERWRITING_CHECKS` in
 * `src/components/deals/UnderwritingDepth.tsx`.
 */

const CHECK_LABELS = [
  "Rent roll summary",
  "Net operating income",
  "T-12 operating statement",
  "Cap rate & DSCR",
  "Sales comparables",
  "Rent comparables",
  "Cash flow projection",
  "Tenant credit review",
  "Lease abstraction",
  "Market & demographics",
  "Environmental (Phase I)",
  "Sensitivity & stress test",
] as const;

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

const bodyStyle: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 12.5,
  lineHeight: 21,
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

interface Ctx {
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

function buildCtx(property: Property | undefined): Ctx {
  const price = property && property.askingPrice > 0 ? property.askingPrice : 2_450_000;
  const sqft = property && property.buildingSqFt > 0 ? property.buildingSqFt : 42_000;
  const cap = property && property.capRate > 0 ? property.capRate : 0.062;
  const noi = Math.round(price * cap);
  // Back into a simple income model: 38% expense ratio, 6% vacancy.
  const egi = Math.round(noi / 0.62);
  const opex = egi - noi;
  const pgi = Math.round(egi / 0.94);
  const vacancy = pgi - egi;
  const rentPerSf = Math.round((pgi / sqft) * 100) / 100;
  const loan = Math.round(price * 0.65);
  const debtService = Math.round(loan * 0.075);
  return { price, sqft, cap, noi, egi, opex, pgi, vacancy, rentPerSf, loan, debtService };
}

// ── Section builders (indexed to CHECK_LABELS) ────────────────────────────────

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

function noiSection(c: Ctx): Section {
  return section(
    "Net Operating Income",
    table([
      [hcell("Potential Gross Income"), vcell(money(c.pgi))],
      [hcell("Vacancy & Credit Loss"), vcell(`(${money(c.vacancy)})`)],
      [hcell("Effective Gross Income"), vcell(money(c.egi))],
      [hcell("Operating Expenses"), vcell(`(${money(c.opex)})`)],
      [hcell("Net Operating Income"), vcell(money(c.noi))],
    ]),
  );
}

function t12Section(c: Ctx): Section {
  return section(
    "Trailing 12-Month Operating Statement",
    table([
      [hcell("Metric"), hcell("Q1", "right"), hcell("Q2", "right"), hcell("Q3", "right"), hcell("Q4", "right")],
      [
        vcell("Revenue", { align: "left" }),
        vcell(money(c.egi * 0.24)),
        vcell(money(c.egi * 0.25)),
        vcell(money(c.egi * 0.25)),
        vcell(money(c.egi * 0.26)),
      ],
      [
        vcell("Expenses", { align: "left" }),
        vcell(money(c.opex * 0.25)),
        vcell(money(c.opex * 0.26)),
        vcell(money(c.opex * 0.24)),
        vcell(money(c.opex * 0.25)),
      ],
      [
        vcell("NOI", { align: "left" }),
        vcell(money(c.noi * 0.23)),
        vcell(money(c.noi * 0.25)),
        vcell(money(c.noi * 0.26)),
        vcell(money(c.noi * 0.26)),
      ],
    ]),
  );
}

function capDscrSection(c: Ctx): Section {
  const dscr = c.noi / c.debtService;
  return section(
    "Cap Rate & DSCR",
    table([
      [hcell("Going-In Cap Rate"), vcell(pct(c.cap))],
      [hcell("Loan Amount (65% LTV)"), vcell(money(c.loan))],
      [hcell("Annual Debt Service (7.5%)"), vcell(money(c.debtService))],
      [hcell("Debt Service Coverage"), vcell(`${dscr.toFixed(2)}x`)],
      [hcell("Debt Yield"), vcell(pct(c.noi / c.loan))],
    ]),
  );
}

function salesCompsSection(c: Ctx): Section {
  const factors = [0.94, 1.06, 0.98, 1.03];
  const caps = [c.cap + 0.003, c.cap - 0.002, c.cap + 0.001, c.cap - 0.001];
  const addrs = ["1420 Commerce St", "88 Harbor Blvd", "500 Innovation Dr", "2201 Gateway Ave"];
  const dates = ["Nov 2025", "Sep 2025", "Jul 2025", "May 2025"];
  const rows: Cell[][] = [
    [hcell("Address"), hcell("Date", "right"), hcell("Price", "right"), hcell("$/SF", "right"), hcell("Cap", "right")],
  ];
  addrs.forEach((addr, i) => {
    const p = Math.round((c.price * factors[i]) / 10_000) * 10_000;
    rows.push([
      vcell(addr, { align: "left" }),
      vcell(dates[i]),
      vcell(money(p)),
      vcell(perSf(p / c.sqft)),
      vcell(pct(caps[i])),
    ]);
  });
  return section("Sales Comparables", table(rows));
}

function rentCompsSection(c: Ctx): Section {
  const rates = [c.rentPerSf + 1, c.rentPerSf - 0.75, c.rentPerSf + 2, c.rentPerSf];
  const names = ["The Meridian", "Gateway Commons", "Harbor Point", "Union Square"];
  const types = ["Class A", "Class B", "Class A", "Class B"];
  const rows: Cell[][] = [
    [hcell("Property"), hcell("Class", "right"), hcell("$/SF/yr", "right"), hcell("Occupancy", "right")],
  ];
  names.forEach((name, i) => {
    rows.push([
      vcell(name, { align: "left" }),
      vcell(types[i]),
      vcell(perSf(Math.max(8, rates[i]))),
      vcell(pct(0.9 + i * 0.02)),
    ]);
  });
  return section("Rent Comparables", table(rows));
}

function cashFlowSection(c: Ctx): Section {
  const rows: Cell[][] = [
    [hcell("Year"), hcell("EGI", "right"), hcell("OpEx", "right"), hcell("NOI", "right"), hcell("Cash Flow", "right")],
  ];
  for (let y = 0; y < 5; y++) {
    const g = Math.pow(1.03, y);
    const egi = c.egi * g;
    const opex = c.opex * Math.pow(1.025, y);
    const noi = egi - opex;
    rows.push([
      vcell(`Year ${y + 1}`, { align: "left" }),
      vcell(money(egi)),
      vcell(`(${money(opex)})`),
      vcell(money(noi)),
      vcell(money(noi - c.debtService)),
    ]);
  }
  return section("Five-Year Cash Flow Projection", table(rows));
}

function tenantCreditSection(): Section {
  const rows: Cell[][] = [
    [hcell("Tenant"), hcell("Credit", "right"), hcell("% of NOI", "right"), hcell("Term Remaining", "right")],
    [vcell("Northwind Traders", { align: "left" }), vcell("A / Stable"), vcell("34%"), vcell("6.2 yrs")],
    [vcell("Contoso Ltd.", { align: "left" }), vcell("BBB"), vcell("27%"), vcell("3.8 yrs")],
    [vcell("Fabrikam Retail", { align: "left" }), vcell("BB / Watch"), vcell("21%"), vcell("2.1 yrs")],
    [vcell("Adventure Works", { align: "left" }), vcell("A-"), vcell("18%"), vcell("4.5 yrs")],
  ];
  return section("Tenant Credit Review", table(rows));
}

function leaseAbstractionSection(): Section {
  const rows: Cell[][] = [
    [hcell("Tenant"), hcell("Start", "right"), hcell("Expiry", "right"), hcell("Escalations", "right")],
    [vcell("Northwind Traders", { align: "left" }), vcell("Jan 2022"), vcell("Dec 2031"), vcell("3.0% / yr")],
    [vcell("Contoso Ltd.", { align: "left" }), vcell("Jun 2021"), vcell("May 2029"), vcell("2.5% / yr")],
    [vcell("Fabrikam Retail", { align: "left" }), vcell("Mar 2023"), vcell("Feb 2028"), vcell("CPI")],
    [vcell("Adventure Works", { align: "left" }), vcell("Oct 2022"), vcell("Sep 2030"), vcell("3.0% / yr")],
  ];
  return section("Lease Abstraction", table(rows));
}

function demographicsSection(): Section {
  return section(
    "Market & Demographics",
    table([
      [hcell("Population (3-mile)"), vcell("184,320")],
      [hcell("Median Household Income"), vcell(money(94_500))],
      [hcell("5-Year Population Growth"), vcell("+6.4%")],
      [hcell("Submarket Vacancy"), vcell("7.1%")],
      [hcell("Avg. Asking Rent"), vcell(perSf(26.5))],
    ]),
  );
}

function environmentalSection(): Section {
  return section(
    "Environmental — Phase I ESA",
    text(
      "Phase I Environmental Site Assessment completed to ASTM E1527-21 standards. " +
        "No Recognized Environmental Conditions (RECs) were identified. Historical use is " +
        "consistent with commercial occupancy; no further investigation or remediation is " +
        "recommended at this time.",
      bodyStyle,
    ),
  );
}

function sensitivitySection(c: Ctx): Section {
  const scenarios: [string, number][] = [
    ["Downside", c.cap + 0.0075],
    ["Base", c.cap],
    ["Upside", c.cap - 0.005],
  ];
  const rows: Cell[][] = [
    [hcell("Scenario"), hcell("Exit Cap", "right"), hcell("Value", "right"), hcell("DSCR", "right")],
  ];
  scenarios.forEach(([name, cap]) => {
    const value = Math.round(c.noi / cap / 10_000) * 10_000;
    rows.push([
      vcell(name, { align: "left" }),
      vcell(pct(cap)),
      vcell(money(value)),
      vcell(`${(c.noi / c.debtService).toFixed(2)}x`),
    ]);
  });
  return section("Sensitivity & Stress Test", table(rows));
}

/** The 12 section builders, indexed to match CHECK_LABELS / UNDERWRITING_CHECKS. */
const SECTIONS: ((c: Ctx) => Section)[] = [
  rentRollSection,
  noiSection,
  t12Section,
  capDscrSection,
  salesCompsSection,
  rentCompsSection,
  cashFlowSection,
  tenantCreditSection,
  leaseAbstractionSection,
  demographicsSection,
  environmentalSection,
  sensitivitySection,
];

// ── Page assembly ─────────────────────────────────────────────────────────────

function addressOf(property: Property | undefined): string {
  return property
    ? `${property.street}, ${property.city}, ${property.state} ${property.zip}`.replace(/\s+,/g, ",")
    : "123 Market Street, Dallas, TX 75201";
}

/** The lead summary page: title, headline metrics, and the scope checklist. */
function buildSummaryPage(property: Property | undefined, uw: DealUnderwriting, c: Ctx): Page {
  const selected = new Set(uw.selectedChecks);
  const scopeRows: Cell[][] = [
    [hcell("Analysis"), hcell("Status", "right")],
    ...CHECK_LABELS.map((label, i): Cell[] => [
      vcell(label, { align: "left" }),
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

  return {
    id: uid("page"),
    name: "Underwriting",
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      heading("Underwriting", headingStyle),
      text(`${uw.tier} · Generated by Cactus · ${addressOf(property)}`, subtitleStyle),
      text(
        "This underwriting was assembled automatically by Cactus from property, market, and " +
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
  const selected = [...underwriting.selectedChecks]
    .filter((i) => i >= 0 && i < SECTIONS.length)
    .sort((a, b) => a - b);
  const sections = selected.map((i) => SECTIONS[i](ctx));

  const pages: Page[] = [buildSummaryPage(property, underwriting, ctx)];
  const PER_PAGE = 2;
  for (let i = 0; i < sections.length; i += PER_PAGE) {
    pages.push(buildContentPage(sections.slice(i, i + PER_PAGE)));
  }
  return pages;
}
