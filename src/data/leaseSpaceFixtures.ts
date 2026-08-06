import type {
  Contact,
  Listing,
  Property,
  PropertyStatus,
  PropertyUnit,
  RentRollRow,
  SpaceLeaseTerms,
} from './types'
import { closeProbabilityForStage } from './commission'

/**
 * A seeded lease deal to turn into an umbrella shell, and the suites to split it
 * across.
 *
 * The suites are deliberately not all alike: the deal-bearing ones give the
 * availability table a row in each state a broker actually sees, and the ones
 * past them give the suite directory the two states a suite can be in without an
 * engagement — occupied by a sitting tenant, and vacant and unworked. See
 * `suiteProportions` below for how the three groups are laid out.
 */
export interface ShellSpec {
  dealId: string
  /**
   * Suite sizes as proportions of the building; the array yields
   * `length + 1` units, the last taking the remainder.
   *
   * The first `childStages.length` units get child deals. The next
   * `occupiedSuites.length` are occupied with no deal. Anything after that is
   * vacant with no deal — which is what makes Start-a-deal reachable from a
   * fresh seed.
   */
  suiteProportions: number[]
  childStages: PropertyStatus[]
  /** Suites after the deal-bearing ones: on the building, occupied, no deal. */
  occupiedSuites: { tenant: string; expiresInDays: number }[]
}

export const SHELL_SPECS: ShellSpec[] = [
  // Meridian Business Park — an active office building mid-lease-up. One suite in
  // each of the four states `spaceAvailability` can report, plus the two a suite
  // can be in without a deal: occupied by a sitting tenant, and vacant and
  // unworked. Six units, four children.
  {
    dealId: '107',
    suiteProportions: [0.26, 0.2, 0.18, 0.14, 0.12],
    childStages: ['closed', 'under-contract', 'active', 'proposal'],
    occupiedSuites: [{ tenant: 'Calloway Freight', expiresInDays: 240 }],
  },
  // Patriot Commerce Park — just split, nothing marketed yet. Every worked suite
  // reads "Not advertised", which is what a broker sees the moment they break a
  // building out; one suite is occupied and was never part of the assignment.
  // Four units, three children.
  {
    dealId: '104',
    suiteProportions: [0.32, 0.26, 0.22],
    childStages: ['proposal', 'proposal', 'proposal'],
    occupiedSuites: [{ tenant: 'Sunbelt Fabrication', expiresInDays: 620 }],
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
      occupancy: 'vacant',
      tenantName: null,
      leaseExpiration: null,
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
 * Lease terms restated against a suite: the commercial values come from `base`
 * (the row the suite already had, or a sibling's when it had none, so the fixture
 * inherits realistic seeded numbers rather than a blank record), the physical
 * ones from the unit. Mirrors `spaceTermsFromUnit` in createListing.ts, which
 * cannot be imported here without closing the store → dataStore → seed cycle.
 */
function termsForUnit(base: SpaceLeaseTerms, unit: PropertyUnit): SpaceLeaseTerms {
  return {
    ...base,
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

/**
 * Give every suite — seeded or newly sliced — exactly one terms row, restated
 * against its unit.
 *
 * Every row goes through `termsForUnit`, not just the new ones. The seeded rows
 * carry no suite, space name or floor (the generator never wrote them), and
 * Suite/Address is a required field on the roster — so a row left as seeded shows
 * up blank and flagged. Re-deriving them all also keeps the sizes honest after
 * the re-slice.
 */
function fillTermsForUnits(shell: Listing, property: Property): void {
  const existing = shell.marketing.spaceLeaseTerms ?? []
  const template = existing[0]
  if (!template) return
  shell.marketing.spaceLeaseTerms = property.units.map((unit) =>
    termsForUnit(existing.find((t) => t.unitId === unit.id) ?? template, unit),
  )
}

/** Full ISO timestamp, `days` from now (negative = past). */
export function isoTimestamp(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

/**
 * A child space deal for one suite. Matches `addSpaceToDeal` field for field —
 * inherited marketing, own pipeline state, one terms row — so a seeded space and
 * a clicked-through one are the same record.
 */
function buildChild(
  shell: Listing,
  unit: PropertyUnit,
  terms: SpaceLeaseTerms,
  stage: PropertyStatus,
  index: number,
  spec: ShellSpec,
  dealIdRef: { n: number },
): Listing {
  const suiteNumber = (index + 1) * 100
  const createdAt = isoTimestamp(-120)
  return {
    ...shell,
    id: `space-${spec.dealId}-${suiteNumber}`,
    dealId: String(dealIdRef.n++),
    parentDealId: shell.id,
    unitId: unit.id,
    name: `${shell.name} — ${unit.label}`,
    slug: `${shell.slug}-space-${index + 1}`,
    status: stage,
    publishedAt: null,
    // Own pipeline state — a space does not inherit the shell's parties or history.
    sellerContactIds: [...shell.sellerContactIds],
    buyerContactIds: [],
    tenantContactIds: [],
    otherContactIds: [],
    tasks: [],
    messages: [],
    activities: [],
    history: [
      {
        id: `hist-${spec.dealId}-${suiteNumber}-created`,
        label: 'Created under',
        fromStage: null,
        toStage: 'proposal',
        actor: 'You (Listing Broker)',
        timestamp: createdAt,
      },
    ],
    documents: [],
    marketing: {
      ...shell.marketing,
      availableSqFt: unit.sqft,
      spaceLeaseTerms: [{ ...terms }],
    },
    transaction: {
      ...shell.transaction,
      commissionAmount: 0,
      contractExecutedDate: null,
      closeDate: null,
      leaseCommencementDate: null,
      nextCriticalDate: null,
      // A space starts unmarketed no matter what the building was doing —
      // `applyStageDetail` is the only thing that puts a date back on it.
      listedOnDate: null,
      backOffice: { ...shell.transaction.backOffice, receivables: [], closeDate: null },
    },
    createdAt,
    updatedAt: createdAt,
  }
}

/**
 * Total lease commission over the term, replicating `buildRentSchedule`: base
 * annual rent split into 12-month periods, escalated each year, commission taken
 * at the deal's rate on each period.
 *
 * The math is inlined rather than imported because `rentSchedule.ts` pulls in
 * `dealDisplay` → `propertyDisplay`, and this module is loaded from `seed.ts` at
 * store-init time. `leaseSpaceFixtures.test.ts` pins the two together so the
 * duplication cannot drift.
 */
export function leaseCommissionAmount(
  annualRent: number,
  termMonths: number,
  escalatorPct: number,
  commissionPct: number,
): number {
  if (annualRent <= 0 || termMonths <= 0) return 0
  const baseMonthly = annualRent / 12
  let remaining = termMonths
  let year = 0
  let total = 0
  while (remaining > 0) {
    const months = Math.min(12, remaining)
    const monthlyRate = baseMonthly * (1 + escalatorPct / 100) ** year
    total += monthlyRate * months * (commissionPct / 100)
    remaining -= months
    year += 1
  }
  return total
}

/** Leading percentage of an escalator string, e.g. "3% annual" → 3. Mirrors `rentSchedule`. */
function parseEscalatorPct(escalators: string | null): number {
  if (!escalators) return 0
  const match = escalators.match(/([\d.]+)\s*%/)
  return match ? Number.parseFloat(match[1]) : 0
}

/** Annual rent for a space, per `dealHeadlineValue`'s lease branch. */
function annualRentFor(terms: SpaceLeaseTerms, sqft: number): number {
  if (terms.leaseRate == null) return 0
  switch (terms.leaseRateUnits) {
    case 'Monthly':
      return terms.leaseRate * 12
    case 'SF/Mo':
      return terms.leaseRate * 12 * sqft
    default:
      return terms.leaseRate * sqft
  }
}

/** Terms `status` for a space, matching what its deal stage advertises. */
const TERMS_STATUS: Record<PropertyStatus, SpaceLeaseTerms['status']> = {
  proposal: 'Inactive',
  active: 'Active',
  'under-contract': 'Under Contract',
  closed: 'Closed',
  inactive: 'Inactive',
}

/**
 * Fill in what a space's stage implies. A Leased suite with no commission and no
 * dates reads as broken, so each stage gets the dates, history and settlement
 * records a broker would have captured getting it there.
 */
function applyStageDetail(child: Listing, suiteNumber: number, tenantName?: string): void {
  const stage = child.status
  const terms = child.marketing.spaceLeaseTerms?.[0]
  if (terms) terms.status = TERMS_STATUS[stage]
  // The roster's Tenant Name is marketing copy on the terms row, separate from
  // the `tenantContactIds` link the vouchers index reads. A Leased suite needs
  // both, or the space reads as let to nobody.
  if (terms && tenantName) terms.tenantName = tenantName

  const advance = (toStage: PropertyStatus, fromStage: PropertyStatus, days: number) => {
    child.history.push({
      id: `hist-${child.id}-${toStage}`,
      label: 'Stage updated from',
      fromStage,
      toStage,
      actor: child.internalBrokers[0]?.name ?? 'You (Listing Broker)',
      timestamp: isoTimestamp(-days),
    })
  }

  if (stage === 'proposal') return

  // Everything past proposal was marketed first.
  child.transaction.listedOnDate = isoDate(-90)
  child.publishedAt = isoTimestamp(-90)
  advance('active', 'proposal', 90)

  if (stage === 'active') {
    child.transaction.closeProbability = closeProbabilityForStage('active')
    child.tasks = [
      {
        id: `task-${child.id}-tour`,
        label: 'Follow up on tour request',
        date: isoDate(4),
        relativeDue: null,
        assigneeInitials: 'OW',
        status: 'open',
        hasAttachment: false,
      },
    ]
    child.transaction.nextCriticalDate = child.tasks[0].date
    return
  }

  // Under contract and beyond: a tenant was accepted (linked in applyLeaseSpaces).
  child.transaction.contractExecutedDate = isoDate(-30)
  advance('under-contract', 'active', 30)

  if (stage === 'under-contract') {
    child.transaction.closeProbability = closeProbabilityForStage('under-contract')
    child.tasks = [
      {
        id: `task-${child.id}-lease`,
        label: 'Collect countersigned lease',
        date: isoDate(6),
        relativeDue: null,
        assigneeInitials: 'MT',
        status: 'open',
        hasAttachment: true,
      },
    ]
    child.transaction.nextCriticalDate = child.tasks[0].date
    return
  }

  if (stage !== 'closed') return

  // Leased: the space transacted, so it carries money.
  const sqft = child.marketing.availableSqFt || 0
  const commissionAmount = terms
    ? Math.round(
        leaseCommissionAmount(
          annualRentFor(terms, sqft),
          terms.leaseTermMonths ?? 0,
          parseEscalatorPct(terms.rentEscalators),
          child.transaction.commissionPct,
        ),
      )
    : 0

  child.transaction.commissionAmount = commissionAmount
  child.transaction.closeDate = isoDate(-10)
  child.transaction.leaseCommencementDate = isoDate(-5)
  child.transaction.closeProbability = closeProbabilityForStage('closed')
  child.transaction.nextCriticalDate = null
  if (terms) terms.closeDate = child.transaction.closeDate
  advance('closed', 'under-contract', 10)

  child.tasks = [
    {
      id: `task-${child.id}-voucher`,
      label: 'Submit commission voucher',
      date: isoDate(-8),
      relativeDue: null,
      assigneeInitials: 'KN',
      status: 'complete',
      hasAttachment: true,
    },
  ]

  child.transaction.backOffice = {
    ...child.transaction.backOffice,
    name: child.name,
    identifier: child.dealId,
    status: 'Approved',
    closeDate: child.transaction.closeDate,
    receivables: [
      {
        id: `recv-${child.id}`,
        payerName: child.transaction.backOffice.relatedContactsLabel,
        payerEmail: 'ap@tenant.example.com',
        dueDate: isoDate(20),
        billingDescription: `Lease commission — Suite ${suiteNumber}`,
        amount: commissionAmount,
        credited: 0,
      },
    ],
  }
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
  contacts: Contact[],
  dealIdRef: { n: number },
): void {
  for (const spec of SHELL_SPECS) {
    const shell = listings.find((l) => l.dealId === spec.dealId)
    const property = properties.find((p) => p.id === shell?.propertyId)
    // generateDataset runs at module load — a missed lookup must skip, not throw.
    if (!shell || !property || shell.dealType !== 'Lease' || property.units.length === 0) continue

    // A tenant-rep deal does not own a building's spaces, so a shell is always
    // landlord-side. What happens to the seeded `buyerContactIds` depends on
    // which side the deal started on: on a tenant-rep deal they ARE the
    // represented party and move to the landlord side with the flip; on a deal
    // already landlord-side they are the lease counterparties, so they become
    // the tenant pool instead. Merging them unconditionally would hand the
    // building's would-be tenants to the landlord and leave the spaces without one.
    const wasBuyerSide = shell.dealSide === 'buyer'
    const formerBuyerIds = [...shell.buyerContactIds]
    shell.dealSide = 'seller'
    shell.buyerContactIds = []
    if (wasBuyerSide) {
      shell.sellerContactIds = [...shell.sellerContactIds, ...formerBuyerIds]
    }

    resliceUnits(property, spec, suiteSizes(property.buildingSqFt, spec.suiteProportions))
    rebuildRentRoll(shell, property, spec)
    fillTermsForUnits(shell, property)

    // Split: each suite's terms row moves down onto its own child deal.
    const termsByUnit = new Map(
      (shell.marketing.spaceLeaseTerms ?? []).map((t) => [t.unitId, t]),
    )

    // Tenants for the transacting suites: the deal's own former counterparties
    // first, then any other contact linked to this property who is not on the
    // landlord side. If the pool ever runs short, later suites go without a
    // tenant rather than two suites sharing one.
    const tenantPool = [
      ...new Set([
        ...formerBuyerIds,
        ...contacts.filter((c) => c.propertyIds.includes(property.id)).map((c) => c.id),
      ]),
    ].filter((id) => !shell.sellerContactIds.includes(id))
    let tenantIndex = 0

    // Tenant names for suites whose deal has closed — captured here so occupancy
    // can be set truthfully below without recomputing the tenant pool.
    const closedTenantByUnit = new Map<string, string>()

    property.units.forEach((unit, i) => {
      const terms = termsByUnit.get(unit.id)
      if (!terms) return
      const stage = spec.childStages[i]
      // Past the deal-bearing suites: this one lives on the building without an
      // engagement. No child, and its occupancy is set below.
      if (stage === undefined) return
      const child = buildChild(shell, unit, terms, stage, i, spec, dealIdRef)
      // Past Available, a space has an accepted tenant — the lease-side
      // counterparty, which `stageGates` requires to reach Under Contract and
      // which `spaceVouchers` reads. Distinct from `buyerContactIds` on purpose.
      let tenantName: string | undefined
      if (stage === 'under-contract' || stage === 'closed') {
        const tenantId = tenantPool[tenantIndex++]
        if (tenantId) {
          child.tenantContactIds = [tenantId]
          const tenant = contacts.find((c) => c.id === tenantId)
          // Person name, not company: `spaceVouchers` derives its Tenant column
          // from the contact this way, and the roster and the vouchers index must
          // not print two different tenants for the same suite.
          tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : undefined
        }
      }
      if (stage === 'closed' && tenantName) closedTenantByUnit.set(unit.id, tenantName)
      applyStageDetail(child, (i + 1) * 100, tenantName)
      listings.push(child)
    })

    // Occupancy is the asset's own fact. `suiteStatus` reads a suite's deal
    // first, so these values only answer for the suites that have no deal — but
    // a Leased suite must not have its unit claiming to be vacant either, so the
    // closed ones are set too.
    property.units.forEach((unit, i) => {
      const occupied = spec.occupiedSuites[i - spec.childStages.length]
      const closedTenant = closedTenantByUnit.get(unit.id)
      if (occupied) {
        unit.occupancy = 'occupied'
        unit.tenantName = occupied.tenant
        unit.leaseExpiration = isoDate(occupied.expiresInDays)
      } else if (closedTenant) {
        unit.occupancy = 'occupied'
        unit.tenantName = closedTenant
        unit.leaseExpiration = isoDate(1825)
      } else {
        unit.occupancy = 'vacant'
        unit.tenantName = null
        unit.leaseExpiration = null
      }
    })

    // The shell holds no space terms and is scoped to no single unit — its spaces
    // own both. This is `addSpaceToDeal`'s "one editable home per unit" rule.
    shell.marketing.spaceLeaseTerms = []
    shell.unitId = null
    shell.transaction.commissionAmount = 0
    shell.transaction.closeDate = null
    shell.transaction.leaseCommencementDate = null
  }
}
