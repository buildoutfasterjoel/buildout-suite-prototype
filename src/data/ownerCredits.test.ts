import { beforeEach, describe, expect, it } from 'vitest'
import { useOwnerCredits } from './ownerCredits'

const credits = () => useOwnerCredits.getState()

describe('owner unlock credits', () => {
  beforeEach(() => credits().reset())

  it('spends one credit the first time a property is unlocked', () => {
    const before = credits().balance
    expect(credits().unlock('p1', 'quick')).toBe(true)
    expect(credits().balance).toBe(before - 1)
    expect(credits().depthFor('p1')).toBe('quick')
  })

  it('never charges twice for the same property', () => {
    credits().unlock('p1', 'in-depth')
    const after = credits().balance
    expect(credits().unlock('p1', 'in-depth')).toBe(false)
    expect(credits().balance).toBe(after)
  })

  it('deepens a paid-for lookup for free', () => {
    credits().unlock('p1', 'quick')
    const after = credits().balance
    expect(credits().unlock('p1', 'in-depth')).toBe(false)
    expect(credits().balance).toBe(after)
    expect(credits().depthFor('p1')).toBe('in-depth')
  })

  it('does not walk an in-depth lookup back to quick', () => {
    credits().unlock('p1', 'in-depth')
    credits().unlock('p1', 'quick')
    expect(credits().depthFor('p1')).toBe('in-depth')
  })

  it('charges each property separately', () => {
    const before = credits().balance
    credits().unlock('p1', 'quick')
    credits().unlock('p2', 'quick')
    expect(credits().balance).toBe(before - 2)
  })

  it('refuses to unlock once the balance is exhausted', () => {
    useOwnerCredits.setState({ balance: 0 })
    expect(credits().unlock('p9', 'quick')).toBe(false)
    expect(credits().depthFor('p9')).toBeNull()
    expect(credits().balance).toBe(0)
  })
})
