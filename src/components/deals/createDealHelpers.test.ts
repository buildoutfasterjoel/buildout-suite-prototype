import { describe, expect, it } from 'vitest'
import {
  buildPropertyGroups,
  contactRoleLabel,
  contactSearchPlaceholder,
  type PropertyGroup,
} from './createDealHelpers'
import type { PropertyOption } from '#/data/store'

function opt(value: string): PropertyOption {
  return { value, label: value, propertyType: 'office', subtype: 'Multi-Tenant', sizeLabel: null }
}

describe('contactRoleLabel', () => {
  it('falls back to Contact with no side', () => {
    expect(contactRoleLabel(null, 'Sale')).toBe('Contact')
  })
  it('labels sale sides Seller / Buyer', () => {
    expect(contactRoleLabel('seller', 'Sale')).toBe('Seller')
    expect(contactRoleLabel('buyer', 'Sale')).toBe('Buyer')
  })
  it('labels lease sides Landlord / Tenant', () => {
    expect(contactRoleLabel('seller', 'Lease')).toBe('Landlord')
    expect(contactRoleLabel('buyer', 'Lease')).toBe('Tenant')
  })
})

describe('contactSearchPlaceholder', () => {
  it('is generic with no side', () => {
    expect(contactSearchPlaceholder(null, 'Sale')).toBe('Search contacts…')
  })
  it('pluralizes the role', () => {
    expect(contactSearchPlaceholder('seller', 'Lease')).toBe('Search landlords…')
  })
})

describe('buildPropertyGroups', () => {
  const options = [opt('a'), opt('b'), opt('c')]

  it('returns a single unlabeled group when there are no owned ids', () => {
    const groups = buildPropertyGroups(options, [], 'Jane Doe')
    expect(groups).toEqual<PropertyGroup[]>([{ value: 'all', label: null, items: options }])
  })

  it('returns a single unlabeled group when owner name is null', () => {
    const groups = buildPropertyGroups(options, ['a'], null)
    expect(groups).toEqual<PropertyGroup[]>([{ value: 'all', label: null, items: options }])
  })

  it('splits owned first, then the rest, with section labels', () => {
    const groups = buildPropertyGroups(options, ['b'], 'Jane Doe')
    expect(groups).toEqual<PropertyGroup[]>([
      { value: 'owned', label: 'Owned by Jane Doe', items: [opt('b')] },
      { value: 'all', label: 'All properties', items: [opt('a'), opt('c')] },
    ])
  })
})
