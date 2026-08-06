# Lease-with-spaces seed fixtures

**Date:** 2026-08-06
**Status:** Approved, not yet implemented

## Problem

The seed predates the lease spaces workflow. All 20 seeded deals are flat
(`parentDealId: null`), and each of the 5 `Lease` deals carries a
`spaceLeaseTerms` row for *every* unit on its property — the shape the workflow
replaced.

Consequently nothing in the dataset is a shell, and every surface built on the
umbrella/child relationship renders empty until someone hand-builds one through
the UI:

- `buildingAvailability()` / the Spaces tab
- `spaceVouchers()` / the shell's Vouchers index
- the child-count rollup badge on `DealCard`
- the `Space` card flair and its `dealCardLinkProps` routing
- `dealShape()`'s `shell` and `space` branches

## Goal

Seed two lease deals as shells with child space deals, so those surfaces have
data on first load, while leaving flat-lease deals in the dataset for contrast.

Explicitly out of scope: changing any workflow code. This is fixture data only.

## Approach

A new hand-authored pass in `src/data/leaseSpaceFixtures.ts`:

```ts
export function applyLeaseSpaces(
  listings: Listing[],
  properties: Property[],
  contacts: Contact[],
  dealIdRef: { n: number },
): void
```

Called from `generateDataset()` immediately after `applyHeroes(...)` and before
`reconcileContactDealFields(...)`. Same pattern as the hero pass, and for the
same reason: heroes have already claimed their listings by then, so the two
passes cannot collide over the same deal.

### The pass uses zero `faker` draws

This is load-bearing, not stylistic. `generateDataset()` makes further faker
calls *after* this insertion point — inquiry channels/dates/messages, comps, and
the demo-property block. Any draw taken here shifts that entire downstream
sequence and would change values pinned by `seed.test.ts`,
`seed.rosaHero.test.ts`, and `seed.delgado.test.ts`.

So the pass uses:

- **Deterministic ids** — `space-107-300` rather than `crypto.randomUUID()`.
  Also better to debug against than a UUID.
- **`Date.now()` offsets** for dates, matching how `HERO_FIXTURES` and
  `forceListingStage` already handle time.
- **Existing contacts**, reassigned rather than generated.

Running before `reconcileContactDealFields` means tenants the children take on
get their `relationship` / `dealStage` / `side` reconciled for free, exactly as
the live store does on every deal mutation.

### Deal selection

Shells are selected by `dealId` (`'107'`, `'104'`) — stable under the fixed
`faker.seed(20240101)`.

If either lookup misses, or the resolved deal fails its expected shape, **the
pass no-ops for that shell rather than throwing.** `generateDataset` runs at
module load from `dataStore.ts`; a throw there takes down the whole app. The
invariant is enforced by a test that fails loudly instead (see Testing).

## Shell A — Meridian Business Park (`107`)

Seeded as: Active, seller-side, office, ~297,078 sf building, 2 units of
148,539 sf each. Already a valid shell candidate — `canAddSpaces()` passes
(lease parent, seller side, active).

**Unit re-slicing.** Two suites of 148,539 sf makes a thin availability table.
The pass re-slices the property to **4 suites** by proportion of
`buildingSqFt` — `[0.32, 0.25, 0.23]` with the fourth taking the remainder, so
the units always sum back to the building regardless of what the seed produced.

The two **existing unit objects are kept and resized in place**, and two new
ones (`Suite 300`, `Suite 400`) appended. Keeping the original objects preserves
their `id`s, which `financials.rentRoll[].unitId` already references — replacing
the array wholesale would leave those rows dangling.

The shell's `rentRoll` is then rebuilt from the new unit list so `rentPerSf`
stays consistent with the resized suites.

**Parties.** The shell keeps `sellerContactIds` (the landlord) and is left with
an empty `buyerContactIds` — `spaceVouchers()` reads
`child.tenantContactIds[0]`, and a shell has no counterparty of its own.

Tenants for the two transacting children are drawn from the contacts linked to
the shell's property, excluding the landlord side, taken in order:

```ts
contacts.filter(
  (c) => c.propertyIds.includes(property.id) && !shell.sellerContactIds.includes(c.id),
)
```

For `107` that pool is exactly 2 (4 linked, 2 of them sellers) — one each for the
`closed` and `under-contract` suites. If a future seed shift shortens the pool,
children beyond its length go without a tenant rather than sharing one; only the
Leased suite's tenant is pinned by a test.

## Shell B — Patriot Commerce Park (`104`)

Seeded as: Proposal, **buyer-side**, industrial, 2 units of 45,647 sf.

Buyer-side is the blocker: `canAddSpaces()` requires `dealSide === 'seller'`,
because a tenant-rep deal doesn't own a building's spaces. The pass flips it to
`seller`. Its `buyerContactIds` is already empty in the current seed, but the
pass still moves any entries to `sellerContactIds` so the flip stays correct if
that changes.

Re-sliced to **3 suites** by proportion `[0.40, 0.33]` plus remainder. All three
children sit at `proposal` → all read "Not advertised". That is the
just-split state: the building is broken out but nothing is marketed yet.

## Child construction

Children follow `addSpaceToDeal()` semantics exactly, so the seeded state is
indistinguishable from one produced by clicking through the UI:

- `name`: `` `${parent.name} — ${unit.label}` ``
- `slug`: `` `${parent.slug}-space-${n}` ``
- `parentDealId` set, `unitId` set
- `marketing.availableSqFt = unit.sqft`
- `marketing.spaceLeaseTerms` = exactly one row, for its own unit
- own `tasks` / `messages` / `activities` / `history` / `documents`
- `dealId` continues the seed counter via `dealIdRef` (`120`+)

**The parents are left holding no `spaceLeaseTerms`.** Their rows move to the
children. This mirrors `addSpaceToDeal`'s "one editable home per unit" rule and
is what makes `buildingAvailability()` the single source of the table.

### Detail scaled to stage

`addSpaceToDeal` creates children clean — no tenant, no commission, no dates.
Correct for a just-clicked space, wrong for one that is supposedly Leased. Each
child gets what its stage implies:

| Suite | Stage | Reads as | Carries |
|---|---|---|---|
| 100 | `closed` | Leased | tenant contact, commission, `leaseCommencementDate`, `closeDate`, closed history, back-office receivable |
| 200 | `under-contract` | Under Contract | tenant contact, `contractExecutedDate`, one open task |
| 300 | `active` | Available | full lease terms, `listedOnDate`, one open task |
| 400 | `proposal` | Not advertised | terms only, bare pipeline |

Shell B's three suites are all `proposal`/bare.

`closeProbability` for each child comes from `closeProbabilityForStage(stage)`
rather than a literal, so the commission forecast weights them the way a live
stage transition would.

### Commission on the Leased suite

Computed with the convention `buildRentSchedule()` uses: base annual rent
(`leaseRate × availableSqFt`) split into 12-month periods, escalated annually by
the rate parsed from `rentEscalators`, times the deal's `commissionPct`.

The math is replicated inline in the fixture rather than imported —
`rentSchedule.ts` pulls in `dealDisplay`, and `seed.ts` is loaded from
`dataStore.ts` at module init, where a new import edge risks the same cycle that
already keeps `createListing.ts` out of the seed. A test pins the two together
(see Testing).

## Consequence: the deals board count changes

`/listings` filters umbrellas off the board:

```ts
sorted.filter((l) => !isUmbrella(l.id))
```

So both shells disappear from the board and their 7 children appear as `Space`
cards — the visible deal count goes **20 → 25**. `commissionForecast` likewise
counts the children, not the shells.

The shells remain reachable via their space cards (`dealCardLinkProps` routes a
child to `/listings/$parentId/spaces?space=<id>`), via the property detail page,
and directly by URL.

This is existing board behavior, not something this change introduces — but this
is the first seeded data that makes it visible. Called out here so it isn't
mistaken for a regression.

## Testing

New `src/data/leaseSpaceFixtures.test.ts`:

1. Both shells resolve and `dealShape(shell) === 'shell'`.
2. Neither shell retains any `spaceLeaseTerms`.
3. Every child's `unitId` resolves to a real unit on the parent's property.
4. Every child has exactly one `spaceLeaseTerms` row, for its own `unitId`.
5. `buildingAvailability('107')` yields all four `SpaceAvailability` states.
6. `spaceVouchers('107')`: the Leased suite has a tenant name and a non-zero
   `commissionAmount`; the `proposal` suite has neither.
7. That commission equals `buildRentSchedule(child).total.commissionAmount` —
   pinning the inlined math to the real derivation.
8. No child sits on a `residential` unit (the lease residential guardrail).
9. Shell B is seller-side, and `canAddSpaces()` is true for both shells.

Regression: `seed.test.ts`, `seed.rosaHero.test.ts`, and `seed.delgado.test.ts`
pass **unchanged**. That is the whole point of the faker-free pass — if any of
them shift, a faker draw leaked in.

Gates: `bun --bun run test` and `bunx tsc --noEmit` (vite build does not
type-check).

## Not doing

- No new properties or contacts — both shells reuse seeded records.
- No change to `leaseSpaces.ts`, `dealShape.ts`, `buildingAvailability.ts`, or
  any UI. If a surface renders badly with this data, that is a separate finding.
- The other three lease deals (`102` land, `113` closed, `118` inactive) stay
  flat. `availableStages('shell')` is `proposal`/`active` only, so the closed and
  inactive ones could not be shells regardless — and keeping them flat preserves
  coverage of `dealShape`'s `flat-lease` branch.
