import { describe, it, expect } from 'vitest'
import {
  saleChannelsFor, leaseChannelsFor, isLandLikeSubtype, propertyTypeEffects,
  buildingClassOptions, showBuyerSection,
} from './listingFormLogic'

describe('marketing channel availability by status', () => {
  it('Active offers all four sale channels', () => {
    expect(saleChannelsFor('active')).toEqual([
      'None', 'Buildout Buyer Network', 'My Brokerage Website', 'Buildout Syndication Network',
    ])
  })
  it('Under Contract drops Syndication', () => {
    expect(saleChannelsFor('under-contract')).toEqual([
      'None', 'Buildout Buyer Network', 'My Brokerage Website',
    ])
  })
  it('Proposal/Inactive/Closed offer only None', () => {
    for (const s of ['proposal', 'inactive', 'closed'] as const) {
      expect(saleChannelsFor(s)).toEqual(['None'])
    }
  })
  it('lease Active offers Website + Syndication (no Buyer Network)', () => {
    expect(leaseChannelsFor('active')).toEqual([
      'None', 'My Brokerage Website', 'Buildout Syndication Network',
    ])
    expect(leaseChannelsFor('proposal')).toEqual(['None'])
  })
})

describe('property-type + subtype effects', () => {
  it('flags land-like subtypes', () => {
    expect(isLandLikeSubtype('Vacant Land')).toBe(true)
    expect(isLandLikeSubtype('Industrial Outdoor Storage')).toBe(true)
    expect(isLandLikeSubtype('Mid-Rise')).toBe(false)
  })
  it('office reveals building class', () => {
    expect(propertyTypeEffects('office').buildingClass).toBe(true)
  })
  it('industrial reveals the industrial cluster', () => {
    expect(propertyTypeEffects('industrial').industrialCluster).toBe(true)
  })
  it('multifamily requires units and hides lease', () => {
    const e = propertyTypeEffects('multifamily')
    expect(e.unitsRequired).toBe(true)
    expect(e.hidesLease).toBe(true)
  })
  it('hospitality hides lease', () => {
    expect(propertyTypeEffects('hospitality').hidesLease).toBe(true)
  })
  it('land reveals land sections', () => {
    expect(propertyTypeEffects('land').landSections).toBe(true)
  })
})

describe('building class options by country', () => {
  it('offers A+ for US, not for others', () => {
    expect(buildingClassOptions('United States')).toContain('A+')
    expect(buildingClassOptions('Canada')).not.toContain('A+')
  })
  it('treats an unset country as domestic (US): A+ eligible', () => {
    expect(buildingClassOptions(undefined)).toContain('A+')
  })
})

describe('buyer section gating', () => {
  it('shows only for Sale + Under Contract', () => {
    expect(showBuyerSection('Sale', 'under-contract')).toBe(true)
    expect(showBuyerSection('Sale', 'active')).toBe(false)
    expect(showBuyerSection('Lease', 'under-contract')).toBe(false)
  })
})
