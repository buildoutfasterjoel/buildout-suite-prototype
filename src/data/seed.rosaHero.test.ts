import { describe, it, expect } from "vitest";
import { generateDataset } from "./seed";

describe("Rosa Delgado hero seed", () => {
  const { contacts, properties } = generateDataset();
  const rosa = contacts.find((c) => c.heroKey === "rosa");

  it("seeds Rosa as a signal owner", () => {
    expect(rosa).toBeDefined();
    expect(rosa!.role).toBe("owner");
    expect(rosa!.firstName).toBe("Rosa");
    expect(rosa!.lastName).toBe("Delgado");
    expect(rosa!.signal?.kind).toBe("loan-maturity");
  });

  it("removes Marcus entirely", () => {
    expect(contacts.some((c) => (c.heroKey as string) === "marcus")).toBe(false);
    expect(properties.some((p) => p.name === "Palmetto Court")).toBe(false);
  });

  it("makes The Delgado Building the multifamily occupancy-gap hero property", () => {
    const prop = properties.find((p) => p.id === rosa!.propertyIds[0]);
    expect(prop).toBeDefined();
    expect(prop!.name).toBe("The Delgado Building");
    expect(prop!.propertyType).toBe("multifamily");
    expect(prop!.occupancyPct).toBe(94); // stated
    expect(prop!.financialRecords[0]?.occupancyPct).toBe(78); // T-12 actual
    expect(prop!.financialRecords[0]?.vacancyRate).toBeCloseTo(0.22);
  });
});
