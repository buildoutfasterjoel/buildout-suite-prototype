import { hash } from "#/components/properties/propertyDisplay";

export interface DemographicRing {
  id: string;
  label: string;
  radiusMiles: number;
}

export type DemographicUnit = "number" | "currency" | "percent";

export interface DemographicRowDef {
  id: string;
  category: string;
  label: string;
  unit: DemographicUnit;
}

export const DEMOGRAPHIC_CATEGORIES = [
  "Overview",
  "Population",
  "Age",
  "Gender",
  "Income",
  "Education",
  "Housing",
  "Employment",
] as const;

export const DEMOGRAPHIC_ROWS: DemographicRowDef[] = [
  { id: "ov-total-pop", category: "Overview", label: "Total Population", unit: "number" },
  { id: "ov-total-hh", category: "Overview", label: "Total Households", unit: "number" },
  { id: "ov-avg-hh-income", category: "Overview", label: "Average Household Income", unit: "currency" },
  { id: "ov-avg-home-value", category: "Overview", label: "Average Home Value", unit: "currency" },
  { id: "ov-daytime-pop", category: "Overview", label: "Daytime Population", unit: "number" },

  { id: "pop-growth-5yr", category: "Population", label: "5-Year Population Growth", unit: "percent" },
  { id: "pop-density", category: "Population", label: "Population Density (per sq mi)", unit: "number" },

  { id: "age-median", category: "Age", label: "Median Age", unit: "number" },
  { id: "age-0-17", category: "Age", label: "Age 0-17", unit: "percent" },
  { id: "age-18-34", category: "Age", label: "Age 18-34", unit: "percent" },
  { id: "age-35-54", category: "Age", label: "Age 35-54", unit: "percent" },
  { id: "age-55-64", category: "Age", label: "Age 55-64", unit: "percent" },
  { id: "age-65-plus", category: "Age", label: "Age 65+", unit: "percent" },

  { id: "gender-male", category: "Gender", label: "Male", unit: "percent" },
  { id: "gender-female", category: "Gender", label: "Female", unit: "percent" },

  { id: "income-avg-hh", category: "Income", label: "Average Household Income", unit: "currency" },
  { id: "income-median-hh", category: "Income", label: "Median Household Income", unit: "currency" },
  { id: "income-per-capita", category: "Income", label: "Per Capita Income", unit: "currency" },

  { id: "edu-hs-plus", category: "Education", label: "High School Graduate+", unit: "percent" },
  { id: "edu-bachelors-plus", category: "Education", label: "Bachelor's Degree+", unit: "percent" },
  { id: "edu-graduate-plus", category: "Education", label: "Graduate Degree+", unit: "percent" },

  { id: "housing-owner", category: "Housing", label: "Owner Occupied", unit: "percent" },
  { id: "housing-renter", category: "Housing", label: "Renter Occupied", unit: "percent" },
  { id: "housing-median-value", category: "Housing", label: "Median Home Value", unit: "currency" },

  { id: "emp-labor-force", category: "Employment", label: "Labor Force", unit: "number" },
  { id: "emp-unemployment", category: "Employment", label: "Unemployment Rate", unit: "percent" },
  { id: "emp-white-collar", category: "Employment", label: "White Collar", unit: "percent" },
  { id: "emp-blue-collar", category: "Employment", label: "Blue Collar", unit: "percent" },
];

export function getDefaultRings(): DemographicRing[] {
  return [
    { id: "ring-0-25", label: "0.25 mi", radiusMiles: 0.25 },
    { id: "ring-0-5", label: "0.5 mi", radiusMiles: 0.5 },
    { id: "ring-1", label: "1 mi", radiusMiles: 1 },
  ];
}

/** Splits a whole into two hash-derived percentages that sum to 100 (e.g. Male/Female). */
function twoWaySplit(seed: number, min: number, max: number): [number, number] {
  const a = min + (seed % (max - min + 1));
  return [a, 100 - a];
}

/** Splits 100 across `count` hash-derived weighted buckets, rounded to sum exactly 100. */
function normalizedSplit(seed: string, count: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => 1 + (hash(`${seed}-w${i}`) % 20));
  const total = weights.reduce((a, b) => a + b, 0);
  const values = weights.map((w) => Math.round((w / total) * 100));
  values[values.length - 1] += 100 - values.reduce((a, b) => a + b, 0);
  return values;
}

/**
 * All demographic row values for one radius ring, computed deterministically from
 * the listing id + ring + refresh nonce. Population-scale counts grow with the
 * ring's area so bigger rings show bigger raw counts; rates/medians/percentages
 * vary only slightly ring-to-ring, as real demographic data does.
 */
export function getDemographicMetrics(
  listingId: string,
  ring: DemographicRing,
  refreshNonce: number,
): Record<string, number> {
  const seed = `${listingId}-${ring.id}-${refreshNonce}`;
  const area = Math.PI * ring.radiusMiles * ring.radiusMiles;

  const density = 800 + (hash(`${seed}-density`) % 4000); // people per sq mi
  const totalPop = Math.round(density * area);
  const hhSize = 2.2 + (hash(`${listingId}-hh-size`) % 80) / 100; // 2.2–3.0, stable per listing
  const totalHh = Math.round(totalPop / hhSize);
  const daytimeMultiplier = 0.7 + (hash(`${seed}-daytime`) % 110) / 100; // 0.7–1.8
  const laborForceRate = 0.55 + (hash(`${seed}-labor`) % 14) / 100; // 0.55–0.68

  const avgHhIncome = 55_000 + (hash(`${seed}-avg-income`) % 90_000);
  const medianHhIncome = Math.round(avgHhIncome * (0.8 + (hash(`${seed}-median-income`) % 15) / 100));
  const perCapitaIncome = Math.round(avgHhIncome / hhSize * (0.85 + (hash(`${seed}-per-capita`) % 10) / 100));
  const avgHomeValue = 250_000 + (hash(`${seed}-avg-home`) % 950_000);
  const medianHomeValue = Math.round(avgHomeValue * (0.85 + (hash(`${seed}-median-home`) % 10) / 100));

  const [male, female] = twoWaySplit(hash(`${seed}-gender`), 47, 53);
  const [owner, renter] = twoWaySplit(hash(`${seed}-housing`), 35, 75);
  const [whiteCollar, blueCollar] = twoWaySplit(hash(`${seed}-collar`), 45, 75);
  const [age0_17, age18_34, age35_54, age55_64, age65plus] = normalizedSplit(seed, 5);

  const hsPlus = 75 + (hash(`${seed}-hs`) % 21);
  const bachelorsPlus = Math.round(hsPlus * (0.25 + (hash(`${seed}-bachelors`) % 25) / 100));
  const graduatePlus = Math.round(bachelorsPlus * (0.2 + (hash(`${seed}-graduate`) % 20) / 100));

  return {
    "ov-total-pop": totalPop,
    "ov-total-hh": totalHh,
    "ov-avg-hh-income": avgHhIncome,
    "ov-avg-home-value": avgHomeValue,
    "ov-daytime-pop": Math.round(totalPop * daytimeMultiplier),

    "pop-growth-5yr": -5 + (hash(`${seed}-growth`) % 30),
    "pop-density": Math.round(density),

    "age-median": 28 + (hash(`${seed}-age-median`) % 25),
    "age-0-17": age0_17,
    "age-18-34": age18_34,
    "age-35-54": age35_54,
    "age-55-64": age55_64,
    "age-65-plus": age65plus,

    "gender-male": male,
    "gender-female": female,

    "income-avg-hh": avgHhIncome,
    "income-median-hh": medianHhIncome,
    "income-per-capita": perCapitaIncome,

    "edu-hs-plus": hsPlus,
    "edu-bachelors-plus": bachelorsPlus,
    "edu-graduate-plus": graduatePlus,

    "housing-owner": owner,
    "housing-renter": renter,
    "housing-median-value": medianHomeValue,

    "emp-labor-force": Math.round(totalPop * laborForceRate),
    "emp-unemployment": 2 + (hash(`${seed}-unemployment`) % 7),
    "emp-white-collar": whiteCollar,
    "emp-blue-collar": blueCollar,
  };
}

/** ISO timestamp for the initial "last refreshed" display — a stable-per-listing number of hours before now. */
export function getInitialLastRefreshed(listingId: string): string {
  const hoursAgo = 1 + (hash(`${listingId}-last-refreshed`) % 72);
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}
