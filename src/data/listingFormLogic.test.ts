import { describe, it, expect } from 'vitest'
import {
  channelsFor, isLandLikeSubtype, propertyTypeEffects,
  buildingClassOptions, showBuyerSection,
} from './listingFormLogic'

describe('marketing channel availability', () => {
  const IN_PLAY = ['proposal', 'active', 'under-contract'] as const
  const SETTLED = ['closed', 'inactive'] as const

  it('offers every channel while the deal is still in play', () => {
    for (const status of IN_PLAY) {
      expect(channelsFor(status)).toEqual([
        'None', 'My Brokerage Website', 'Buildout Syndication Network',
      ])
    }
  })

  // Setup happens before a deal is active, which is exactly when a broker picks
  // where the listing should go once it is live. Narrowing the list there hid
  // the decision at the moment it was being made.
  it('does not narrow between Pitching and Active', () => {
    expect(channelsFor('proposal')).toEqual(channelsFor('active'))
  })

  it('collapses to None once the deal is Closed or Lost', () => {
    for (const status of SETTLED) {
      expect(channelsFor(status)).toEqual(['None'])
    }
  })

  it('never offers the deprecated Buyer Network', () => {
    for (const status of [...IN_PLAY, ...SETTLED]) {
      expect(channelsFor(status)).not.toContain('Buildout Buyer Network')
    }
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
