const has = (n: number | null | undefined): n is number => n != null && !Number.isNaN(n)

export function totalScheduledIncome(gross: number | null, other: number | null): number | null {
  if (!has(gross) && !has(other)) return null
  return (has(gross) ? gross : 0) + (has(other) ? other : 0)
}

export function vacancyCost(gross: number | null, vacancyPct: number | null): number | null {
  if (!has(gross) || !has(vacancyPct)) return null
  return (gross * vacancyPct) / 100
}

export function grossIncome(totalScheduled: number | null, vacancy: number | null): number | null {
  if (!has(totalScheduled)) return null
  return totalScheduled - (has(vacancy) ? vacancy : 0)
}

export function noi(gross: number | null, opex: number | null): number | null {
  if (!has(gross)) return null
  return gross - (has(opex) ? opex : 0)
}

export function capRate(noiValue: number | null, price: number | null): number | null {
  if (!has(noiValue) || !has(price) || price === 0) return null
  return (noiValue / price) * 100
}

/** Given any two of {size, ratePerSf, annualRent}, compute the third (PRD §19). */
export function autoFillRentRow(
  size: number | null, ratePerSf: number | null, annualRent: number | null,
): { size: number | null; ratePerSf: number | null; annualRent: number | null } {
  const known = [has(size), has(ratePerSf), has(annualRent)].filter(Boolean).length
  // Fewer than two known: nothing to derive — return inputs verbatim.
  if (known < 2) return { size, ratePerSf, annualRent }
  if (has(size) && has(ratePerSf)) return { size, ratePerSf, annualRent: size * ratePerSf }
  if (has(size) && has(annualRent)) return { size, ratePerSf: size === 0 ? null : annualRent / size, annualRent }
  if (has(ratePerSf) && has(annualRent)) return { size: ratePerSf === 0 ? null : annualRent / ratePerSf, ratePerSf, annualRent }
  return { size, ratePerSf, annualRent }
}
