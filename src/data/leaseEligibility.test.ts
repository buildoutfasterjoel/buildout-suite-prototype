import { describe, it, expect } from 'vitest'
import {
  isMultifamilyOnly,
  canLeaseProperty,
  isResidentialSubtype,
  RESIDENTIAL_SUBTYPES,
} from './leaseEligibility'
import type { Property, PropertyType, PropertySubtype } from './types'

function prop(
  propertyType: PropertyType,
  additional?: { type: PropertyType; subtype: PropertySubtype }[],
): Property {
  return { propertyType, additionalPropertyTypes: additional } as unknown as Property
}

describe('isMultifamilyOnly', () => {
  it('is true for a plain multifamily property', () => {
    expect(isMultifamilyOnly(prop('multifamily'))).toBe(true)
    expect(isMultifamilyOnly(prop('multifamily', []))).toBe(true)
  })

  it('is false for every other primary asset class', () => {
    for (const t of ['office', 'retail', 'industrial', 'mixed-use', 'land'] as PropertyType[]) {
      expect(isMultifamilyOnly(prop(t))).toBe(false)
    }
  })

  it('is false when a second, non-residential class is on the record', () => {
    const overRetail = prop('multifamily', [{ type: 'retail', subtype: 'Multi-Tenant' }])
    expect(isMultifamilyOnly(overRetail)).toBe(false)
  })

  it('stays true when every additional class is also multifamily', () => {
    const twoBuildings = prop('multifamily', [{ type: 'multifamily', subtype: 'Mid-Rise' }])
    expect(isMultifamilyOnly(twoBuildings)).toBe(true)
  })

  it('is false for an unknown property — a free-typed address has no class yet', () => {
    expect(isMultifamilyOnly(undefined)).toBe(false)
    expect(isMultifamilyOnly(null)).toBe(false)
  })
})

describe('isResidentialSubtype', () => {
  it('covers the whole multifamily block', () => {
    expect(RESIDENTIAL_SUBTYPES).toEqual([
      'Low-Rise/Garden', 'Mid-Rise', 'High-Rise',
      'Townhouse', 'Duplex', 'Triplex', 'Fourplex',
    ])
    for (const s of RESIDENTIAL_SUBTYPES) expect(isResidentialSubtype(s)).toBe(true)
  })

  it('leaves every commercial subtype leasable, including the ambiguous ones', () => {
    // Mixed-Use names a building that *contains* housing but is itself leasable;
    // Hotel/Motel are hospitality, not housing.
    for (const s of ['Multi-Tenant', 'Storefront', 'Warehouse', 'Medical',
      'Mixed-Use', 'Hotel', 'Motel', 'Self-Storage'] as PropertySubtype[]) {
      expect(isResidentialSubtype(s)).toBe(false)
    }
  })
})

describe('canLeaseProperty', () => {
  it('excludes multifamily-only buildings and admits everything else', () => {
    expect(canLeaseProperty(prop('multifamily'))).toBe(false)
    expect(canLeaseProperty(prop('mixed-use'))).toBe(true)
    expect(canLeaseProperty(undefined)).toBe(true)
  })
})
