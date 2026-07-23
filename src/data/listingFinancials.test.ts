import { describe, it, expect } from 'vitest'
import {
  totalScheduledIncome, vacancyCost, grossIncome, noi, capRate, autoFillRentRow,
} from './listingFinancials'

describe('financial calcs (blank-not-zero)', () => {
  it('sums scheduled income', () => {
    expect(totalScheduledIncome(100000, 5000)).toBe(105000)
    expect(totalScheduledIncome(null, null)).toBeNull()
  })
  it('vacancy cost = gross * pct', () => {
    expect(vacancyCost(100000, 5)).toBe(5000)
    expect(vacancyCost(100000, null)).toBeNull()
  })
  it('gross income = total scheduled - vacancy', () => {
    expect(grossIncome(105000, 5000)).toBe(100000)
  })
  it('noi = gross income - opex', () => {
    expect(noi(100000, 30000)).toBe(70000)
  })
  it('cap rate = noi / price, blank when price missing', () => {
    expect(capRate(70000, 1000000)).toBeCloseTo(7)
    expect(capRate(70000, null)).toBeNull()
    expect(capRate(70000, 0)).toBeNull()
  })
})

describe('rent-roll auto-fill (any two compute the third)', () => {
  it('computes annual rent from size + rate', () => {
    expect(autoFillRentRow(1000, 20, null).annualRent).toBe(20000)
  })
  it('computes rate from size + annual', () => {
    expect(autoFillRentRow(1000, null, 20000).ratePerSf).toBe(20)
  })
  it('computes size from rate + annual', () => {
    expect(autoFillRentRow(null, 20, 20000).size).toBe(1000)
  })
  it('leaves all as-is when fewer than two are known', () => {
    expect(autoFillRentRow(1000, null, null)).toEqual({ size: 1000, ratePerSf: null, annualRent: null })
  })
})
