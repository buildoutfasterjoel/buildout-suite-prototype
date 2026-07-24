import { describe, it, expect } from "vitest";
import { generateDataset } from "./seed";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";

describe("Marcus Pinckney hero seed", () => {
  const { contacts, properties } = generateDataset();
  const marcus = contacts.find((c) => c.heroKey === "marcus");

  it("exists as an owner with an overnight signal and no deal yet", () => {
    expect(marcus).toBeDefined();
    expect(marcus!.role).toBe("owner");
    expect(marcus!.firstName).toBe("Marcus");
    expect(marcus!.lastName).toBe("Pinckney");
    expect(marcus!.signal?.kind).toBe("loan-maturity");
  });

  it("is linked to an underwriting-eligible (multifamily) property", () => {
    const linked = marcus!.propertyIds
      .map((id) => properties.find((p) => p.id === id))
      .filter(Boolean);
    expect(linked.some((p) => propertyQualifiesForUnderwriting(p!))).toBe(true);
  });
});
