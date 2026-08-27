import type {
  DealFinancials,
  DealType,
  Listing,
  PropertyStatus,
  PropertyType,
  TransactionSide,
} from './types'
import { getStore, getProperty, getContact } from './store'
import { dealShape } from './dealShape'

/** The three states a voucher moves through. Mirrors `DealFinancials['status']`. */
export type VoucherStatus = 'Draft' | 'Pending' | 'Approved'

/** Display order for the KPI band: earliest state first, so it reads as a pipeline. */
export const VOUCHER_STATUSES: VoucherStatus[] = ['Draft', 'Pending', 'Approved']

/**
 * How a status is written out where there is room for it — the KPI tiles and the
 * status filter. The table's badges use the bare `status` instead, which is why
 * only `Pending` differs: a column of badges cannot afford "Pending Approval".
 */
export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  Draft: 'Draft',
  Pending: 'Pending Approval',
  Approved: 'Approved',
}

/**
 * What a pre-split deduction can be filed under — the Category dropdown on a
 * Draft voucher, and what the seed picks from.
 *
 * A new row starts with no category chosen (`''`), which is why
 * `FinancialDeduction.category` stays a plain `string` rather than this union:
 * the empty state is a real state on an unfinished row, not a broken one.
 */
export const DEDUCTION_CATEGORIES = [
  'Outside Referral',
  'Royalties',
  'Internal Referrals',
  'Broker of Record',
  'Other',
] as const

export type DeductionCategory = (typeof DEDUCTION_CATEGORIES)[number]

/** The Transaction Side dropdown on the voucher's Internal Commissions table. */
export const TRANSACTION_SIDES: TransactionSide[] = [
  'Buy Side',
  'Sell Side',
  'Dual',
]

/**
 * The payout plans a broker's own split can be figured under. `'No Plan'` is a
 * real choice, not an empty one — it is what the seed gives every internal
 * broker — so the dropdown carries it rather than leaving the field blank.
 */
export const COMMISSION_PLANS = [
  'No Plan',
  'Standard Commission Plan',
  'Custom Plan',
  'House Split Plan',
] as const

/**
 * Where a deal's voucher page lives, as a typed route target.
 *
 * A discriminated union, not `{ to: string; params: Record<string, string> }`:
 * the space route needs two params and the others one, and only the union lets
 * a caller spread this straight into `<Link {...target} />` or `navigate()`
 * without TanStack rejecting the params as under-specified.
 */
export type VoucherTarget =
  | { to: '/listings/$listingId/financials'; params: { listingId: string } }
  | {
      to: '/listings/$listingId/spaces/$spaceId/financials'
      params: { listingId: string; spaceId: string }
    }

/**
 * Whether this deal is held by a voucher sitting with an approver.
 *
 * What the deal record's own Edit pencil reads. Not a bare
 * `backOffice.status === 'Pending'` check: a shell keeps the `backOffice`
 * record it had from before it was split, so the bare check would lock a
 * building's header over a voucher that belongs to its suites now.
 * {@link voucherHref} already owns the "does this deal have a voucher"
 * question, so the rule stays in one place.
 */
export function isVoucherPending(deal: Listing): boolean {
  return (
    voucherHref(deal) !== null &&
    deal.transaction.backOffice.status === 'Pending'
  )
}

/**
 * One party on a voucher — a buyer, a tenant, or a payer — resolved from the
 * contact record for display.
 *
 * A party stores nothing of its own. Name, company, email and phone are read
 * here at render time rather than copied onto the voucher, so correcting a
 * contact corrects every voucher that names them.
 */
export interface VoucherParty {
  contactId: string
  name: string
  company: string
  email: string
  phone: string
  /**
   * False when the contact is no longer in the store.
   *
   * The row still renders. A voucher is a record of who was billed, and losing
   * a billed line because someone tidied the contact book would be a worse
   * failure than showing a placeholder. Callers use this to decide whether to
   * link the name to a contact page that is not there any more.
   */
  exists: boolean
}

export function voucherParty(contactId: string): VoucherParty {
  const contact = getContact(contactId)
  if (!contact) {
    return {
      contactId,
      name: 'Unknown contact',
      company: '',
      email: '',
      phone: '',
      exists: false,
    }
  }
  return {
    contactId,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    company: contact.company,
    email: contact.email,
    phone: contact.phone,
    exists: true,
  }
}

/**
 * How one receivable addresses its payer — the string the Payer Name cell shows
 * and the payer picker selects by.
 *
 * Two forms of the same contact: the person, carrying their email so a broker
 * can tell two same-named contacts apart, or the company they belong to. Which
 * one a receivable uses is stored on the receivable (`billToCompany`), because
 * one voucher can bill the same person directly on one line and through their
 * entity on another.
 */
export function receivablePayerLabel(
  contactId: string,
  billToCompany: boolean,
): string {
  const party = voucherParty(contactId)
  if (billToCompany && party.company) return party.company
  return party.email ? `${party.name} (${party.email})` : party.name
}

/** How one receivable's own payer can be addressed. */
export interface PayerFormOption {
  value: 'person' | 'company'
  label: string
}

/**
 * The two ways to address ONE payer — as the person, or as their company.
 *
 * A receivable belongs to one person, chosen when it is created. This is the
 * narrower question the row asks afterwards: which name goes on the invoice.
 * So it takes a single contact id, not a contact list — offering every contact
 * again here would let a row silently change WHO it bills under the guise of
 * changing how they are addressed.
 *
 * A contact with no company gets one option. There is nothing else to bill, and
 * a dropdown with a single choice still reads correctly as "this is the payer".
 */
export function payerFormOptions(contactId: string): PayerFormOption[] {
  const party = voucherParty(contactId)
  const person: PayerFormOption = {
    value: 'person',
    label: party.email ? `${party.name} (${party.email})` : party.name,
  }
  if (!party.company) return [person]
  return [person, { value: 'company', label: party.company }]
}

/** A payer, plus what this voucher has billed them. */
export interface VoucherPayerRow extends VoucherParty {
  /**
   * Sum of this payer's receivables, GROSS of credits — what they were asked
   * for, not what is still outstanding. The Receivables table below carries the
   * Credited column, and restating it here would put two different answers to
   * "how much" on one screen.
   */
  billed: number
  /**
   * How many receivables name this payer. Drives the removal guard: a payer
   * with receivables cannot be taken off the voucher, because the rows that
   * bill them would point at nobody.
   */
  receivableCount: number
}

export function voucherPayers(voucher: DealFinancials): VoucherPayerRow[] {
  return voucher.payerContactIds.map((contactId) => {
    const rows = voucher.receivables.filter((r) => r.payerContactId === contactId)
    return {
      ...voucherParty(contactId),
      billed: rows.reduce((sum, r) => sum + r.amount, 0),
      receivableCount: rows.length,
    }
  })
}

/**
 * Why this payer cannot be taken off the voucher, or null when they can be.
 *
 * A payer with receivables cannot leave: the rows billing them would point at
 * nobody, and the Receivables table would name a payer the voucher does not
 * list. The rule lives here rather than only in the button that enforces it,
 * so any future removal path can consult it, and it can be tested without a
 * browser.
 *
 * Returns the sentence the tooltip shows rather than a boolean, because a
 * greyed button with no explanation is a dead icon — the reason is the whole
 * value of blocking it.
 */
export function payerRemovalBlock(payer: VoucherPayerRow): string | null {
  if (payer.receivableCount === 0) return null
  const plural = payer.receivableCount === 1 ? 'receivable' : 'receivables'
  return `${payer.name} has ${payer.receivableCount} ${plural}. Remove those first.`
}

/**
 * The deal's acquiring party — buyers on a sale, tenants on a lease.
 *
 * The two live in separate arrays on the deal (`buyerContactIds` and
 * `tenantContactIds` are deliberately distinct datasets), and the voucher shows
 * exactly one of them. This is the single place that choice is made, so the
 * section title and the section's writes cannot disagree about which list they
 * are looking at.
 */
export function partyContactIds(deal: Listing): string[] {
  return deal.dealType === 'Lease' ? deal.tenantContactIds : deal.buyerContactIds
}

/** What the acquiring party is called on this deal type. */
export function partySectionTitle(dealType: DealType): string {
  return dealType === 'Lease' ? 'Tenant' : 'Buyer'
}

export interface VoucherRow {
  /** The deal this voucher settles — also the row's identity. */
  dealId: string
  /** The voucher's own name. Seeded from the deal name, but editable apart from it. */
  name: string
  /** The deal's name, for the column that links back to the record. */
  dealName: string
  identifier: string
  status: VoucherStatus
  closeDate: string | null
  /**
   * The day the deal was created, as `yyyy-mm-dd`.
   *
   * Normalised to a local calendar day here rather than kept as the raw
   * timestamp, so every date the filters compare is the same shape and sorts
   * chronologically as a plain string.
   */
  createdOn: string
  dealType: DealType
  /** The deal's stage — the Deal Stage facet, and what `active-ytd-closed` reads. */
  dealStage: PropertyStatus
  /** Null when the deal's property has been removed from the store. */
  propertyType: PropertyType | null
  /** Street address of the deal's property, for the toolbar's address search. */
  propertyAddress: string
  /** The deal's primary internal broker, or null when it has none. */
  brokerName: string | null
  relatedContactsLabel: string
  transactionValue: number
  grossCommission: number
  /** Receivables billed but not yet credited. 0 when the voucher has none. */
  receivablesOutstanding: number
  /** Where the row navigates — see {@link voucherHref}. */
  target: VoucherTarget
}

/**
 * The voucher page for a deal, or null when the deal has no voucher.
 *
 * A voucher is not a record of its own — it is a tab whose route depends on the
 * deal's shape, which is why this mirrors the swap `dealNav` already makes in
 * the deal sidebar.
 *
 * **A shell has no voucher.** Splitting a lease deal hands the transaction to
 * each space; the building keeps the assignment, not the money. Its own
 * `backOffice` record is left untouched in the store — the fixtures copy it onto
 * each child at creation, and `dealShape` reads whether children exist rather
 * than anything stamped on at split time. So this is derived, not mutated, and
 * it reverses on its own: remove the last space and the deal is a flat lease
 * again, with its voucher back.
 */
export function voucherHref(deal: Listing): VoucherTarget | null {
  const shape = dealShape(deal)
  if (shape === 'shell') return null
  if (shape === 'space' && deal.parentDealId) {
    return {
      to: '/listings/$listingId/spaces/$spaceId/financials',
      params: { listingId: deal.parentDealId, spaceId: deal.id },
    }
  }
  return { to: '/listings/$listingId/financials', params: { listingId: deal.id } }
}

/**
 * Every voucher in the book, flattened for the Back Office index.
 *
 * One row per deal that *has* a voucher — every deal carries a
 * `transaction.backOffice` record from the moment it is created, so there is no
 * separate notion of "a voucher was created" to filter on, but a shell's record
 * is a leftover from before it was split and belongs to its spaces now. Listing
 * it would put a building in the table beside its own suites, claiming money the
 * suites are already claiming.
 *
 * Sorted by voucher name. The store returns insertion order, which is arbitrary
 * to a broker and would also reshuffle the table on any unrelated deal edit.
 */
export function allVouchers(): VoucherRow[] {
  return [...getStore().listings.values()]
    .flatMap((deal) => {
      // `voucherHref` owns the "does this deal have a voucher" question, so the
      // rule lives in one place rather than being re-derived here.
      const target = voucherHref(deal)
      if (!target) return []
      const voucher = deal.transaction.backOffice
      const property = getProperty(deal.propertyId)
      const created = new Date(deal.createdAt)
      return [{
        dealId: deal.id,
        name: voucher.name,
        dealName: deal.name,
        identifier: voucher.identifier,
        status: voucher.status,
        closeDate: voucher.closeDate,
        createdOn: [
          created.getFullYear(),
          String(created.getMonth() + 1).padStart(2, '0'),
          String(created.getDate()).padStart(2, '0'),
        ].join('-'),
        dealType: deal.dealType,
        dealStage: deal.status,
        propertyType: property?.propertyType ?? null,
        // Assembled the way the deal header shows it, so a broker searching the
        // address they see on the deal page finds the voucher here.
        propertyAddress: property
          ? [property.street, property.city, property.state, property.zip]
              .filter(Boolean)
              .join(', ')
          : '',
        brokerName: deal.internalBrokers[0]?.name ?? null,
        relatedContactsLabel: voucher.relatedContactsLabel,
        transactionValue: deal.transaction.salePrice,
        grossCommission: deal.transaction.commissionAmount,
        // Net of credits: what the brokerage is still owed, which is the figure
        // the Financials tab's receivables table also foots to.
        receivablesOutstanding: voucher.receivables.reduce(
          (sum, r) => sum + (r.amount - r.credited),
          0,
        ),
        target,
      }]
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
}

export interface VoucherTotal {
  count: number
  grossCommission: number
}

/**
 * Gross commission and voucher count per status — the three tiles above the
 * table. Takes the rows rather than reading the store so the band can be footed
 * against the filtered set the table is actually showing.
 *
 * Seeded with every status, so a tile with nothing behind it renders "$0 | 0
 * Vouchers" rather than disappearing and leaving a two-tile band.
 */
export function voucherTotals(
  rows: Pick<VoucherRow, 'status' | 'grossCommission'>[],
): Record<VoucherStatus, VoucherTotal> {
  const totals = {
    Draft: { count: 0, grossCommission: 0 },
    Pending: { count: 0, grossCommission: 0 },
    Approved: { count: 0, grossCommission: 0 },
  }
  for (const row of rows) {
    totals[row.status].count += 1
    totals[row.status].grossCommission += row.grossCommission
  }
  return totals
}
