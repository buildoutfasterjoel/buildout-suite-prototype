import type {
  Contact,
  Listing,
  Property,
  PropertyStatus,
  PropertyUnit,
  RentRollRow,
  SpaceLeaseTerms,
} from './types'

/**
 * A seeded lease deal to turn into an umbrella shell, and the suites to split it
 * across. `childStages` is the whole point: one entry per suite, in order, giving
 * the availability table a row in each state a broker actually sees.
 *
 * `suiteProportions` holds one fewer entry than `childStages` — the final suite
 * takes the remainder, so the suites always sum back to `buildingSqFt` no matter
 * what the seed produced.
 */
export interface ShellSpec {
  dealId: string
  suiteProportions: number[]
  childStages: PropertyStatus[]
}

export const SHELL_SPECS: ShellSpec[] = [
  // Meridian Business Park — an active office building mid-lease-up. One suite in
  // each of the four states `spaceAvailability` can report.
  {
    dealId: '107',
    suiteProportions: [0.32, 0.25, 0.23],
    childStages: ['closed', 'under-contract', 'active', 'proposal'],
  },
  // Patriot Commerce Park — just split, nothing marketed yet. Every suite reads
  // "Not advertised", which is what a broker sees the moment they break a
  // building out.
  {
    dealId: '104',
    suiteProportions: [0.4, 0.33],
    childStages: ['proposal', 'proposal', 'proposal'],
  },
]

/** `YYYY-MM-DD`, `days` from today (negative = past). Mirrors how the hero pass handles time. */
export function isoDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/** Suite sqft per unit index: proportions of the building, last one taking the remainder. */
function suiteSizes(buildingSqFt: number, proportions: number[]): number[] {
  const sizes = proportions.map((p) => Math.round(buildingSqFt * p))
  sizes.push(buildingSqFt - sizes.reduce((sum, n) => sum + n, 0))
  return sizes
}

/**
 * Re-slice a property into `sizes.length` suites. Existing unit objects are
 * resized in place rather than replaced: their ids are already referenced by
 * `financials.rentRoll[].unitId`, and swapping the array would leave those rows
 * dangling. Suites beyond the seeded ones are appended.
 */
function resliceUnits(property: Property, spec: ShellSpec, sizes: number[]): void {
  const template = property.units[0]
  const units: PropertyUnit[] = []

  for (let i = 0; i < sizes.length; i += 1) {
    const suiteNumber = (i + 1) * 100
    const existing = property.units[i]
    if (existing) {
      existing.sqft = sizes[i]
      // Each prior sale's price was struck against the unit's old size, so
      // resizing would leave `pricePerSf` disagreeing with `price / sqft` (an
      // invariant seed.test.ts pins). Hold $/SF — a market rate, which redrawing
      // suite boundaries does not move — and restate the price at the new size.
      for (const sale of existing.saleHistory) {
        sale.price = Math.round(sale.pricePerSf * sizes[i])
      }
      units.push(existing)
      continue
    }
    units.push({
      id: `unit-${spec.dealId}-${suiteNumber}`,
      label: `Suite ${suiteNumber}`,
      unitType: template?.unitType ?? 'office',
      sqft: sizes[i],
      beds: null,
      baths: null,
      suite: String(suiteNumber),
      floor: i + 1,
      ceilingHeight: template?.ceilingHeight ?? 12,
      offices: template?.offices ?? 2,
      conferenceRooms: template?.conferenceRooms ?? 1,
      furnished: false,
      saleHistory: [],
    })
  }

  property.units = units
}

/** Fallback tenants for suites the seed never wrote a rent roll row for. */
const FIXTURE_TENANTS = ['Northline Logistics', 'Vertex Systems', 'Harbor & Co.', 'Ridgeway Dental']

/**
 * Rebuild the shell's rent roll from the resized suites, so rent and rent-per-sf
 * stay consistent with the new sizes. Each row keeps its seeded tenant and dates
 * where one existed; new suites take a fixed name from the pool.
 */
function rebuildRentRoll(shell: Listing, property: Property, spec: ShellSpec): void {
  const original = shell.financials.rentRoll
  const ratePerSf = original[0]?.rentPerSf && original[0].rentPerSf > 0 ? original[0].rentPerSf : 2

  shell.financials.rentRoll = property.units.map((unit, i): RentRollRow => {
    const prior = original[i]
    const actualRent = Math.round(unit.sqft * ratePerSf)
    return {
      id: `rent-${spec.dealId}-${unit.id}`,
      unitId: unit.id,
      tenant: prior?.tenant ?? FIXTURE_TENANTS[i % FIXTURE_TENANTS.length],
      actualRent,
      marketRent: Math.round(actualRent * 1.08),
      rentPerSf: ratePerSf,
      securityDeposit: actualRent,
      leaseStart: prior?.leaseStart ?? isoDate(-540),
      leaseEnd: prior?.leaseEnd ?? isoDate(540),
    }
  })
}

/**
 * Lease terms for a suite that has none yet, cloned from a sibling row so the
 * fixture inherits realistic seeded values rather than a blank record. Mirrors
 * `spaceTermsFromUnit` in createListing.ts, which cannot be imported here without
 * closing the store → dataStore → seed cycle.
 */
function termsForUnit(template: SpaceLeaseTerms, unit: PropertyUnit): SpaceLeaseTerms {
  return {
    ...template,
    unitId: unit.id,
    spaceName: unit.label,
    suite: unit.suite ?? undefined,
    floor: unit.floor,
    ceilingHeight: unit.ceilingHeight,
    offices: unit.offices,
    conferenceRooms: unit.conferenceRooms,
    minDivisibleSqFt: Math.round(unit.sqft / 2),
    maxContiguousSqFt: unit.sqft,
  }
}

/** Extend the shell's terms so every suite — seeded or newly sliced — has exactly one row. */
function fillTermsForUnits(shell: Listing, property: Property): void {
  const existing = shell.marketing.spaceLeaseTerms ?? []
  const template = existing[0]
  if (!template) return
  shell.marketing.spaceLeaseTerms = property.units.map(
    (unit) => existing.find((t) => t.unitId === unit.id) ?? termsForUnit(template, unit),
  )
}

/**
 * Turn the seeded lease deals named in {@link SHELL_SPECS} into umbrella shells
 * with child space deals.
 *
 * Called from `generateDataset` after `applyHeroes` — by then the heroes have
 * claimed their listings, so the two passes cannot contend for the same deal —
 * and before `reconcileContactDealFields`, so tenants the children take on get
 * reconciled exactly as a live store mutation would.
 *
 * Deliberately takes no `faker` draws: `generateDataset` keeps drawing after this
 * point, and a draw here would shift every downstream value the seed tests pin.
 */
export function applyLeaseSpaces(
  listings: Listing[],
  properties: Property[],
  _contacts: Contact[],
  _dealIdRef: { n: number },
): void {
  for (const spec of SHELL_SPECS) {
    const shell = listings.find((l) => l.dealId === spec.dealId)
    const property = properties.find((p) => p.id === shell?.propertyId)
    // generateDataset runs at module load — a missed lookup must skip, not throw.
    if (!shell || !property || shell.dealType !== 'Lease' || property.units.length === 0) continue

    // A tenant-rep deal does not own a building's spaces, so a shell is always
    // landlord-side. `104` is seeded buyer-side; its (currently empty) buyer
    // contacts move to the landlord side so the flip stays correct either way.
    shell.dealSide = 'seller'
    shell.sellerContactIds = [...shell.sellerContactIds, ...shell.buyerContactIds]
    shell.buyerContactIds = []

    resliceUnits(property, spec, suiteSizes(property.buildingSqFt, spec.suiteProportions))
    rebuildRentRoll(shell, property, spec)
    fillTermsForUnits(shell, property)
  }
}
