import type {
  Contact,
  DealBroker,
  Listing,
  MediaAsset,
  MediaLink,
  Property,
  PropertyStatus,
  PropertyUnit,
  RentRollRow,
  SpaceLeaseTerms,
  VisualMediaType,
} from './types'
import { closeProbabilityForStage, splitNetCommission } from './commission'
import {
  invoiceDueDate,
  invoiceFileName,
  invoiceLineItems,
  invoicePayerFileLabel,
  type InvoicePayerName,
} from './invoices'
import { listingGallery } from '#/components/properties/propertyDisplay'

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
  /**
   * Who works each suite, by roster name, indexed like `childStages`. An absent
   * or `undefined` entry leaves the suite on the shell's own brokers, which is
   * what splitting a building normally produces.
   *
   * Naming someone else is how a building gets suites in different hands — the
   * case `dealAccessFor` exists for, and the one a shell's brokers copied down
   * every suite can never show. See the Central Campus spec below.
   */
  suiteBrokers?: (string | undefined)[]
  /**
   * Force the shell's own stage, when the base deal's is wrong for the suites
   * above it. A space cannot advance past its building — `stageGates`' own
   * `shellActive` rule reads "Building marketing published" — so a spec with a
   * Leased suite under a still-pitching building would contradict the gate the
   * app enforces. Omitted leaves the base deal's stage alone.
   */
  shellStatus?: PropertyStatus
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
  // Central Campus — one building, two brokers, different suites. This is the
  // case the space permission rules exist for, and the only shell that shows it:
  // splitting a building copies its brokers onto every suite, so on the two
  // shells above every seat either works all the suites or none, and the rule is
  // invisible.
  //
  // Sarah holds the assignment and two of the three worked suites; Marcus holds
  // the third. Neither may read the other's voucher, and each sees the other's
  // suite on the directory as a locked row. Marcus's is the Leased one so it
  // carries real commission — which is what makes the Vouchers index's filter
  // legible: Sarah's total is missing money she can see exists.
  //
  // Five units, three children, one occupied, one vacant.
  {
    dealId: '102',
    suiteProportions: [0.28, 0.24, 0.2, 0.16],
    childStages: ['under-contract', 'active', 'closed'],
    occupiedSuites: [{ tenant: 'Lumen Analytics', expiresInDays: 400 }],
    suiteBrokers: [undefined, undefined, 'Marcus Patel'],
    // The base deal is still pitching, and its suites are not: one is Leased.
    // `shellActive` gates a space's advance on its building being live, so the
    // building has to be.
    shellStatus: 'active',
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
/**
 * The brokers who work one suite.
 *
 * A suite normally inherits the building's, which is what `...shell` in
 * `buildChild` already does — splitting a shell hands every suite the same team.
 * A spec that names someone puts that one suite in different hands instead, so a
 * building can hold suites its own brokers cannot open. That is the only way the
 * seed produces the case `dealAccessFor` exists for.
 *
 * The named broker takes the whole split: they are the suite's only broker, and
 * all of a commission nobody shares is theirs. `applySuiteCommission` divides the
 * real figures over this list later, so the zeroes here are the same starting
 * point every other suite gets.
 *
 * Faker-free like the rest of this module. The id derives from the suite and the
 * email follows the roster's own `first.last@` convention rather than importing
 * the roster: `seed.ts` loads this module at store-init time and must not pull
 * `teammates.ts` in behind it.
 */
function suiteBrokers(shell: Listing, spec: ShellSpec, index: number): DealBroker[] {
  const name = spec.suiteBrokers?.[index]
  // Checked before the roster is touched at all, so a shell built without an
  // `internalBrokers` array — as the payer-reset test's fake one is — takes the
  // same path it did before this override existed.
  if (!name) return shell.internalBrokers
  const template = shell.internalBrokers?.[0]
  // Nobody to copy the row's shape from: inherit rather than invent a broker.
  if (!template) return shell.internalBrokers
  return [
    {
      ...template,
      id: `suite-broker-${spec.dealId}-${(index + 1) * 100}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@buildout.com`,
      role: 'Primary Broker - Sell Side',
      commissionSplitPct: 100,
      grossCommission: 0,
    },
  ]
}

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
    // Whoever the spec names works this suite instead of the building's own
    // team. Set here, before `applyStageDetail` runs `applySuiteCommission`,
    // which divides the suite's commission over exactly this list.
    internalBrokers: suiteBrokers(shell, spec, index),
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
      // A unit's media has exactly ONE home: the building's marketing. A space's
      // Media tab is a filtered editor onto its parent, not an owner of its own
      // copy — so the child starts with all three lists empty and nothing ever
      // writes to them. Mirrors `addSpaceToDeal`'s child construction.
      photos: [],
      links: [],
      visualMedia: [],
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
      // A space's voucher starts from scratch, whatever the building's was
      // doing — the same reasoning as `listedOnDate` above. Inheriting the
      // shell's status put a suite nobody had closed into Pending Approval, and
      // once a sign-off carries a name and a date, an inherited `Approved`
      // would credit a reviewer with approving a voucher that never existed.
      // The payer list is part of that same reset: it's the building's
      // money, billed to the building's parties, and none of them were ever
      // billed on this suite — so inheriting it would name payers against a
      // voucher with nothing on it. `applyStageDetail` is the only thing
      // that moves a space's voucher on.
      backOffice: {
        ...shell.transaction.backOffice,
        receivables: [],
        payerContactIds: [],
        closeDate: null,
        status: 'Draft',
        approval: null,
      },
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
 * Spread a leased suite's commission across the figures derived from it: its
 * pre-split deductions, and what each broker earned.
 *
 * **Why this is needed at all.** A suite inherits its brokers and its deduction
 * list from the shell it was split out of, and a lease shell's own
 * `commissionAmount` is pinned to 0 on purpose — the building holds no money,
 * its suites do. So every figure derived from a commission arrives here reading
 * $0: the deduction has a real percentage against nothing, and both brokers are
 * recorded as having earned nothing on a suite that just billed real money.
 *
 * That was invisible until payables existed. Nothing read `grossCommission` on a
 * suite before, so a deposit applied to the one Approved suite voucher in the
 * seed raised no payables — every broker's share of the money was zero — and
 * there was no way to tell that from a rule correctly declining to pay out.
 *
 * **New objects, never mutation.** `buildChild` spreads the shell, so the child
 * starts sharing its `internalBrokers`, `outsideBrokers` and
 * `preSplitDeductions` by reference. Writing through them would credit the
 * building with the suite's commission — and, with several suites per shell,
 * each suite would overwrite the last. `leaseSpaceFixtures.test.ts` pins the
 * shell's own figures at zero to hold that.
 *
 * The arithmetic mirrors `generateBroker` and its reconciliation in `seed.ts`:
 * pre-split deductions come off the gross, the co-broke comes off what is left,
 * and the house's own brokers divide the remainder. Faker-free, like everything
 * else in this module.
 *
 * Splitting a shell copies its brokers onto every suite, so a bug here is a bug
 * multiplied by the suite count — which is why this follows the same order the
 * money leaves rather than an approximation of it.
 */
function applySuiteCommission(child: Listing, commissionAmount: number): void {
  const deductions = child.transaction.backOffice.preSplitDeductions.map((d) => ({
    ...d,
    amount: Math.round(commissionAmount * (d.pct / 100)),
  }))
  const netCommission =
    commissionAmount - deductions.reduce((total, d) => total + d.amount, 0)

  child.transaction.backOffice = {
    ...child.transaction.backOffice,
    preSplitDeductions: deductions,
  }
  const split = splitNetCommission({
    internal: child.internalBrokers,
    outside: child.outsideBrokers,
    netCommission,
  })
  child.internalBrokers = split.internal
  child.outsideBrokers = split.outside
}

/**
 * Fill in what a space's stage implies. A Leased suite with no commission and no
 * dates reads as broken, so each stage gets the dates, history and settlement
 * records a broker would have captured getting it there.
 */
function applyStageDetail(
  child: Listing,
  suiteNumber: number,
  /**
   * The accepted tenant's name and company, once there is one.
   *
   * Both halves, not just the display name: the suite's receivable bills the
   * tenant *business*, so its invoice filename needs the company, while
   * `spaceVouchers` and the roster print the person. One argument carrying both
   * keeps those two from being resolved in two different places.
   */
  tenant?: InvoicePayerName,
  /**
   * Whether the tenant is in QuickBooks. Passed in rather than pinned, so the
   * suite's receivable cannot claim to be in QuickBooks under a tenant that is
   * not — see the note at the receivable below.
   */
  tenantSynced?: boolean,
): void {
  const tenantName = tenant?.name
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
  applySuiteCommission(child, commissionAmount)
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

  // The suite's tenant is who gets billed. This used to hold
  // `relatedContactsLabel`, a display string like "Jane Doe & 2 more", in a
  // field meant for one person — so the Receivables table named a payer who
  // was not a real party.
  //
  // Falls back to the seller when no tenant is linked: `tenantContactIds` is
  // filled from a pool guarded by `if (tenantId)`, so a suite can reach here
  // with none assigned, and `sellerContactIds` — copied from the shell when
  // the child was built — is never empty.
  const tenantContactId = child.tenantContactIds[0] ?? child.sellerContactIds[0]

  child.transaction.backOffice = {
    ...child.transaction.backOffice,
    name: child.name,
    identifier: child.dealId,
    status: 'Approved',
    // Two days after the "Submit commission voucher" task above completed.
    // Named outright rather than drawn from `SEED_VOUCHER_APPROVER_IDS`: this
    // module must stay faker-free, and the seed tests pin it that way. Tessa
    // because she is the Back Office Manager — Omar was named here back when the
    // approver list was hardcoded and he was on it.
    approval: { reviewerId: 'tessa-nakamura', approvedOn: isoDate(-6) },
    closeDate: child.transaction.closeDate,
    payerContactIds: [tenantContactId],
    receivables: [
      {
        id: `recv-${child.id}`,
        payerContactId: tenantContactId,
        // A lease commission is billed to the tenant business, not the person
        // who signed — the one place in the fixtures where the company form is
        // the truthful one.
        billToCompany: true,
        dueDate: isoDate(20),
        billingDescription: `Lease commission — Suite ${suiteNumber}`,
        amount: commissionAmount,
        credited: 0,
        // Taken from the tenant rather than hashed from the id like the
        // pipeline's receivables, and rather than pinned true.
        //
        // Pinned was the first version, on the reasoning that an Approved
        // voucher whose invoice has gone out is precisely the line QuickBooks
        // would hold. But the tenant's own flag is hashed, so a pin was only
        // consistent by luck: one shift in the seed stream and this suite would
        // show a settled bill as connected directly above a tenant that is not.
        // Deriving makes that pair impossible instead of merely unlikely.
        quickbooksSynced: tenantSynced === true,
      },
    ],
  }

  // The invoice that bill went out on. An Approved voucher has one, for the same
  // reason the pipeline seed gives one to every voucher past Draft: sending the
  // invoices is the last thing a broker does before submitting.
  //
  // Built from the receivable just written rather than re-derived, and named
  // through the same helpers the create action uses, so a suite's invoice and a
  // broker-made one cannot disagree about what an invoice looks like. Dates come
  // from `isoDate`, not faker — this module stays faker-free.
  const suiteReceivable = child.transaction.backOffice.receivables[0]
  const suiteLineItems = invoiceLineItems([suiteReceivable])
  child.invoices = [
    {
      id: `invoice-${child.id}`,
      name: invoiceFileName(
        invoicePayerFileLabel(tenant ?? { name: '', company: '' }, suiteReceivable.billToCompany),
        1,
      ),
      // Two days after the "Submit commission voucher" task completed, a day
      // before the sign-off above.
      createdAt: `${isoDate(-7)}T17:00:00.000Z`,
      createdById: 'you',
      payerContactId: suiteReceivable.payerContactId,
      billToCompany: suiteReceivable.billToCompany,
      dueDate: invoiceDueDate(suiteLineItems),
      lineItems: suiteLineItems,
    },
  ]
}

/**
 * Seed a shell's media library: building-wide photos and visual media, plus an
 * uneven scatter of per-unit photos, floor plans and links.
 *
 * Deliberately uneven — every third unit gets photos, a floor plan and a link,
 * the next gets photos only, the next gets nothing — so a demo reaches a full
 * grid, a partial one and an empty state without anyone editing first.
 *
 * Photo URLs come from `listingGallery`, which is deterministic, so the modelled
 * library agrees with the photos already shown on deal cards, in the publish
 * preview and on `SpaceDetailHeader` by construction rather than by coincidence.
 * `listingGallery` keeps all its current callers; this adds a library beside it.
 *
 * Ids are derived from the unit and kind rather than random, so a snapshot of the
 * seed is stable across runs.
 *
 * Takes NO faker draws, for the reason given on `applyLeaseSpaces`: the dataset
 * keeps drawing after this point and a draw here shifts every downstream value
 * the seed tests pin. `listingGallery` is deterministic, not faker.
 */
function applyShellMedia(shell: Listing, property: Property): void {
  const photos: MediaAsset[] = []
  const links: MediaLink[] = []

  // Building-wide: the four photos the building's own gallery already shows.
  listingGallery(shell.id, 4, 480, 280).forEach((url, i) => {
    photos.push({
      id: `${shell.id}-photo-${i}`,
      url,
      kind: 'photo',
      caption: i === 0 ? 'Building exterior' : '',
      unitId: null,
    })
  })
  links.push({
    id: `${shell.id}-video`,
    url: 'https://videos.example.com/tour/building',
    kind: 'video',
    unitId: null,
  })

  // Building-wide visual media, appended to whatever the listing already has so
  // a hero's seeded embeds are not discarded.
  const visualMedia = [
    ...(shell.marketing.visualMedia ?? []),
    {
      id: `${shell.id}-vm-matterport`,
      url: 'https://tours.example.com/matterport/building',
      mediaType: 'Matterport Tour' as VisualMediaType,
      unitId: null,
    },
    {
      id: `${shell.id}-vm-siteplan`,
      url: 'https://tours.example.com/siteplan/building',
      mediaType: 'Interactive Site Plan' as VisualMediaType,
      unitId: null,
    },
  ]

  property.units.forEach((unit, i) => {
    const bucket = i % 3
    // bucket 2 gets nothing at all — the empty state has to be reachable.
    if (bucket === 2) return

    listingGallery(unit.id, 2, 480, 280).forEach((url, j) => {
      photos.push({
        id: `${unit.id}-photo-${j}`,
        url,
        kind: 'photo',
        caption: j === 0 ? `${unit.label} interior` : '',
        unitId: unit.id,
      })
    })

    if (bucket !== 0) return
    // A floor plan is its own kind, and only ever scoped to a unit — a
    // building-wide floor plan has no section to render in.
    photos.push({
      id: `${unit.id}-floorplan`,
      // A distinct derivation from the unit's photos, so the plan is not simply
      // the first interior shot again.
      url: listingGallery(`${unit.id}-plan`, 1, 480, 280)[0],
      kind: 'floorPlan',
      caption: `${unit.label} floor plan`,
      unitId: unit.id,
    })
    links.push({
      id: `${unit.id}-matterport`,
      url: `https://tours.example.com/matterport/${unit.id}`,
      kind: 'matterport',
      unitId: unit.id,
    })
    visualMedia.push({
      id: `${unit.id}-vm-tour`,
      url: `https://tours.example.com/360/${unit.id}`,
      mediaType: '360 Tour' as VisualMediaType,
      unitId: unit.id,
    })
  })

  shell.marketing.photos = photos
  shell.marketing.links = links
  shell.marketing.visualMedia = visualMedia
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
    if (spec.shellStatus) {
      shell.status = spec.shellStatus
      // A live building the suites hang under has been published; leaving this
      // null would render an active shell as never marketed.
      shell.publishedAt ??= isoTimestamp(-150)
    }

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

    // Must run after resliceUnits: property.units is still the pre-slice
    // placeholder pair until then, so seeding media any earlier would scatter
    // assets across two units nobody ever sees instead of the final ten suites.
    applyShellMedia(shell, property)

    // Split: each deal-bearing suite's terms row moves down onto its own child
    // deal. A `stage` of `undefined` (below) marks a suite that stays on the
    // building with no engagement, so the loop leaves those rows where they are.
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
      let tenantPayer: InvoicePayerName | undefined
      let tenantSynced = false
      if (stage === 'under-contract' || stage === 'closed') {
        const tenantId = tenantPool[tenantIndex++]
        if (tenantId) {
          child.tenantContactIds = [tenantId]
          const tenant = contacts.find((c) => c.id === tenantId)
          // Person name, not company: `spaceVouchers` derives its Tenant column
          // from the contact this way, and the roster and the vouchers index must
          // not print two different tenants for the same suite. The company rides
          // along for the invoice filename — see `applyStageDetail`.
          if (tenant) {
            tenantName = `${tenant.firstName} ${tenant.lastName}`.trim()
            tenantPayer = { name: tenantName, company: tenant.company }
            tenantSynced = tenant.quickbooksSynced === true
          }
        }
      }
      if (stage === 'closed' && tenantName) closedTenantByUnit.set(unit.id, tenantName)
      applyStageDetail(child, (i + 1) * 100, tenantPayer, tenantSynced)
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
        // Keep the rent roll naming the same tenant for the same unit — it is
        // built above from `FIXTURE_TENANTS`, which knows nothing about the
        // occupancy this loop is setting.
        const rentRow = shell.financials.rentRoll.find((r) => r.unitId === unit.id)
        if (rentRow) rentRow.tenant = occupied.tenant
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
