import { describe, it, expect } from "vitest";
import { generateDataset } from "./seed";

describe("The Delgado Building financials + occupancy gap", () => {
  const { contacts, properties } = generateDataset();
  const rosa = contacts.find((c) => c.heroKey === "rosa")!;
  const prop = properties.find((p) => p.id === rosa.propertyIds[0])!;

  it("is a 48-unit multifamily with a stated-vs-actual occupancy gap", () => {
    expect(prop.propertyType).toBe("multifamily");
    expect(prop.residentialUnits).toBe(48);
    expect(prop.occupancyPct).toBe(94); // stated / marketing
    expect(prop.financialRecords[0].occupancyPct).toBe(78); // T-12 actual
    expect(prop.financialRecords[0].source).toBe("T-12 actuals");
  });
});
