# Space Deal Pages — Design

**Status:** Approved design (2026-08-06), pending spec review.
**Supersedes:** `2026-08-04-space-deals-without-a-page-design.md` — its spine ("the building is the
only page") is reversed by stakeholder feedback. What that design built and this one keeps is listed
under *What survives* below.
**Scope:** Landlord rep lease only. Sale deals and buy-side are untouched.
**Phase:** 1 of 2. Phase 2 decides which sections are building-level and which are per-space; this
phase deliberately gives a space **every** section and accepts the duplication that creates.

---

## The constraint this resolves

Feedback from the 2026-08-06 review: brokers want a space deal to be a **page**. The 08-04 design put
a space's whole life on a row of its building's roster — terms inline, stage in the row, money one
section away. That is dense and efficient and it is not what was asked for.

Two things came with that feedback and neither existed before:

- The roster should show **every suite the building has**, not only the ones with deals. A broker
  needs to see that Suite 210 is occupied by a tenant through 2027, so they know not to work it.
- A broker who learns a new suite was carved out of the building should be able to add it here.

## The spine

> **A space is a deal with its own page, nested under its building. The building's Spaces section is a
> suite directory — every suite the property has, with or without a deal.**

Per-space pipeline is untouched. A space still appears on the board with its own stage, the parent
still shows a rollup, and `dealShape`, `availableStages`, `dealStageLabel` and every stage gate keep
working exactly as they do.

## History, so the next reader does not re-derive it

Three passes have now been made at this. Each was reverted or superseded, and the reasons are the
design constraints for this one.

| Pass | What it did | Why it went |
|---|---|---|
| Pre-08-04 (`86990cc` and earlier) | A space *was* the shared deal page at `/listings/{spaceId}`, plus `MarketingScopeBar`, `PropertyMarketingHub`, a `from` param threaded through 8 routes, and `PROPERTY_ONLY`/`SHELL_ONLY` sidebar filters | The machinery existed to fake building-level marketing on a space page — the phase-2 problem, solved badly and early |
| 08-03 (`c8a84ca`, reverted in `86990cc`) | Dedicated nested tree at `/listings/$listingId/spaces/$spaceId/*`, 9 leaf routes rendered in an Offcanvas over the building | A suite became a rival page *inside* the building's frame: two navs stacked, and the building's sidebar had to hide the sections the suite claimed |
| 08-04 (current) | No space page. Roster is the control surface | Stakeholders want a page |

**This design is not a revert of any of them.** Reverting 08-04 would drag back the `from`-param
machinery *and* throw away the Vouchers index, the section breadcrumbs, and the roster's stage
selects. Only one deleted thing is restored: `DealContextRail`'s parent link.

The 08-03 route *shape* is adopted, because the stakeholder asked for a nested URL. Its *layout* is
not: the space page escapes the building's frame rather than rendering inside it, which is the one
thing that pass got wrong.

### What survives from 08-04

Kept as-is: the Vouchers index and `spaceVouchers`; `dealBreadcrumbTrail` and the extracted
`dealNav.ts`; `DealStageSelect`; `visibleNavGroups`; the shell's shape-dependent Back Office; the
`ab7b6be` rule that a space's money must be scoped to its building; and the 08-06 seed fixtures.

Carried forward as a constraint: **canonicalizing a URL must be reactive, not in `beforeLoad`**
(`cf5676c`). The store is client-owned (Zustand + IndexedDB), so on a cold load the listings map is
empty during `beforeLoad` and `parentDealId` reads as undefined. This design needs no redirect, but
its child-of-shell guard must render nothing rather than redirect.

---

## 1. The suite directory

### The derivation

`buildingAvailability` walks *child deals*, so a suite with no deal is invisible to it. A new
derivation walks `property.units` and left-joins the child deal.

```ts
// src/data/buildingSuites.ts
export interface SuiteRow {
  unitId: string
  label: string
  sqft: number
  /** The child deal working this suite, or null when nobody has started one. */
  dealId: string | null
  stage: PropertyStatus | null
  /** What the row reports in its status column. One rule, stated in `suiteStatus`. */
  status: SuiteStatus
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  /** Marketing-facing tenant name: the override when set, else the asset fact. */
  tenantName: string | null
  leaseExpiration: string | null
}

export function buildingSuites(shellDealId: string): SuiteRow[]
```

Ordered by label with `localeCompare(…, { numeric: true })` — the same sort `spaces.tsx` and the
Vouchers index already apply, so the three surfaces cannot disagree.

`buildingAvailability` and `advertisedAvailability` are **left alone**. They answer "what does this
building advertise", which is still deal-derived and still what marketing surfaces consume. A suite
with no deal is not advertised, so it has no business in that list.

### One rule for a row's status

Two facts could disagree about a suite — its deal's stage and the unit's occupancy — so the rule is
stated once, in a pure function, rather than at each render site:

> **A deal, when one exists, is the truth. Occupancy answers only for a suite nobody is working.**

```ts
function suiteStatus(deal: Listing | null, unit: PropertyUnit): SuiteStatus {
  if (deal) return spaceAvailability(deal.status)   // Available | Under Contract | Leased | Not advertised
  return unit.occupancy === 'occupied' ? 'Occupied' : 'Vacant'
}
```

This is why occupancy on a suite that *has* a deal is never read. The seed still sets it truthfully
(see §5) so the asset record does not hold a lie, but the roster does not consult it.

### The row

```
Spaces · 400 Market St                                          [+ Add space]
──────────────────────────────────────────────────────────────────────────────
Suite 100   4,200 SF   $32 SF/Yr    Leased                                  →
Suite 210   2,800 SF                Occupied · Acme Holdings thru Mar 2027
Suite 305   3,100 SF   $30 SF/Yr    Available                               →
Suite 400   1,900 SF                Vacant                     [Start a deal]
```

| Row kind | Affordance |
|---|---|
| Has a deal | The whole row links to the space page |
| Vacant, no deal | **Start a deal** — calls the existing `addSpaceToDeal`, then navigates to the new space page |
| Occupied, no deal | No action. Shows tenant and lease expiration |

**Occupied is not forbidden, only unoffered.** An occupied row gets no Start-a-deal button, because
working an occupied suite is not the normal case. Nothing blocks it: `Add space` does not filter
occupied units out, and pre-marketing a suite whose lease expires next year is real work. Inventing a
gate here would be inventing a rule the feedback did not ask for.

### What the roster loses

Everything that made it a control surface, because those things now have a page:

- The inline `SpaceTermsSection` editor, its per-row draft/Save/Cancel machinery, and the "Unsaved
  changes" affordances. Terms move to the space page's Terms section, so there is **one** editor for
  a suite's terms rather than two that can drift.
- `?space=` and its `validateSearch`, the controlled `Collapsible`, and the `useEffect` that
  re-opened a named row. Nothing expands any more.
- The per-row `DealStageSelect` and the `Voucher` link — both live on the space page now.

The roster keeps its `isLeaseParent` empty state and its `canAddSpaces` gating of the Add button.

### Add space

The modal shrinks to its real job. Today it does two things: check existing units to spin into deals,
and describe a brand-new unit. Vacant rows now carry their own **Start a deal**, so the checkbox list
is redundant — and its "hide units that already have a deal" filter was standing in for the directory
this design builds.

What remains: name a suite that is not on the building yet, add it to the property record, spin its
deal. That is exactly the case the feedback named — a broker who knows a suite was carved out. The
existing `addPropertyUnit` → `addSpaceToDeal` pair already does it.

A unit added this way is `occupancy: 'vacant'`: it is being added *in order to* market it.

---

## 2. The space page

### Route shape

```
src/routes/_shell/listings/$listingId_/spaces/$spaceId/
```

The **trailing underscore** on `$listingId_` keeps the URL (`/listings/{shellId}/spaces/{spaceId}/…`)
while un-nesting from `$listingId.tsx`'s layout. Confirmed against the installed generator:
`removeLayoutSegmentsAndUnderscoresWithEscape` and `underscoreStartEndRegex = /(^_|_$)/gi` in
`@tanstack/router-generator`. The route still sits inside `_shell`, so the persistent app shell — nav,
AI rail, `GlobalStageGateModal` — is untouched.

This matters because `$listingId.tsx` renders `PropertyDetailHeader` + `PropertyDetailSidebar` around
its `<Outlet />`. Without the underscore, a space page would paint inside the building's chrome, which
is the 08-03 failure exactly.

`/listings/{shellId}/spaces` (the directory) stays nested under the building layout. The two coexist:
different paths, different layouts.

### Its own chrome

```
┌─ Suite 305 · 400 Market St ────────────────────── [Available ▾] ┐
│  All Deals / 400 Market St / Spaces / Suite 305 / Leads          │
├─────────────┬───────────────────────────────────────────────────┤
│ DEAL        │                                                   │
│  Overview   │            (space section content)                │
│  …          │                                                   │
│ MARKETING   │                                                   │
│  Listing    │                                                   │
│  Leads      │                                                   │
│  …          │                                                   │
│ BACK OFFICE │                                                   │
│  Voucher    │                                                   │
│  Invoices   │                                                   │
│  Notes      │                                                   │
└─────────────┴───────────────────────────────────────────────────┘
```

- **Header** — a `SpaceDetailHeader`: suite label as the title, building name as subtitle and a link,
  `DealStageSelect` for the space, and the breadcrumb. It does not reuse `PropertyDetailHeader`, which
  is built around a building's address, publish state and property facts.
- **Sidebar** — `PropertyDetailSidebar` gains a `basePath` prop. It builds hrefs as
  `/listings/{listingId}/{href}` today; the space page needs
  `/listings/{shellId}/spaces/{spaceId}/{href}`. One prop, defaulting to today's behaviour, rather
  than a second sidebar component.
- **The guard** — if `spaceId`'s `parentDealId !== listingId`, render nothing. Per `ab7b6be` this is
  not defensive URL handling: a suite rendering under the wrong building's frame paints the wrong
  landlord's voucher and commission. Render nothing, do not redirect (see the `cf5676c` constraint).

### Every link, and the two that are not

Phase 1 brings every section. The two exclusions are mechanical, not judgement:

| Excluded | Why |
|---|---|
| `spaces` | A space has no spaces. `visibleNavGroups` already gates this on `leaseParent`, which a space is not. |
| `vouchers` | The shell's rollup index. A space gets `financials` + `financial-documents`, which `visibleNavGroups` already gives every non-shell shape. |

Both fall out of `visibleNavGroups('space', { leaseParent: false, showsUnderwriting })` **as it
already exists**. No new filtering rule. That leaves 18 existing sections:

`overview` · `client-report` · `activities` · `history` · `files` · `underwriting` · `listing` ·
`leads` · `documents` · `website` · `email` · `media` · `demographics` · `grids` · `plans` ·
`financials` · `financial-documents` · `notes`

Plus `terms`, which is new (see below) — 19 entries in the map.

**The duplication is deliberate and is phase 2's whole subject.** A building's Documents render at
both `/listings/{shellId}/documents` and `/listings/{shellId}/spaces/{spaceId}/documents`, showing the
same content. Phase 1 accepts that; phase 2 decides which sections a space keeps.

### One route file, not nineteen

Every existing section route is a thin wrapper: read the id, resolve the listing, render a component
that takes a `Listing`. Nineteen copies of that under the space path would be nineteen files to edit
in phase 2.

Instead: **`$section.tsx` plus a `spaceSections.tsx` map** of slug → render function.

```ts
// src/components/deals/spaceSections.tsx
export const SPACE_SECTIONS: Record<string, (ctx: SpaceSectionContext) => ReactNode> = {
  overview: ({ listing }) => <SpaceOverview listing={listing} />,
  terms:    ({ listing, unit, property }) => <SpaceTerms … />,
  media:    ({ listing }) => <ListingMedia listing={listing} />,
  leads:    ({ property, listing, search }) => <PropertyDetailLeads property={property} spaceDealId={listing.id} initialSearch={search.q} />,
  // … 19 entries
}
```

The map is chosen over per-section files for one reason: **phase 2 is the question "which sections
belong to the building and which to the space", and a map is that question written down.** Deciding
it means editing one file.

Costs, accepted:

- `$section` is an untyped string param. An unknown slug renders a "section not found" state rather
  than throwing.
- Per-route `validateSearch` cannot be per-section. `leads`' `q` and `listing`'s `review` move to the
  `$spaceId` layout route's `validateSearch`, which declares the union of what any section reads.
- `Route.useParams()` typing for `$section` comes from the generated tree, so the map's keys and the
  sidebar's hrefs must agree. A test pins that (see Verification).

### Terms is a new section

The suite's own terms need a home now that the roster is a directory. `SpaceTermsSection` already
exists and already edits a `SpaceLeaseTerms` row plus `marketing.availableSqFt`; it moves onto the
space page behind the same Save/Cancel contract it has today (`b1aad55`), lifted out of the
per-row draft machinery into ordinary page state.

`Terms` is added to `NAV_GROUPS` under Deal, and gated in `visibleNavGroups` to `shape === 'space'` —
it is the one genuinely new nav rule this design adds.

---

## 3. Breadcrumbs go three deep

`dealBreadcrumbTrail(pathname, listingId)` returns `{ sectionLabel, detailId }` — two levels, which
was enough when the deepest thing was a voucher detail. The space page needs a third:

```
All Deals  /  400 Market St  /  Spaces  /  Suite 305  /  Leads
   link          link            link       link        current
```

It grows `subsectionLabel`, resolved from `NAV_GROUPS` the same way `sectionLabel` is. Still pure —
`detailId` stays an id and the header resolves it to a suite label against the store, exactly as it
does now.

Existing behaviour is unchanged: no section on the deal root, no crumb for a slug absent from
`NAV_GROUPS` (such as `edit`), a trailing slash yields no detail, and a pathname for a different deal
returns nothing.

---

## 4. Links

`dealCardLink.ts` is the single rule for where a deal card goes, and
`dealCardLink.invariant.test.ts` scans the whole source tree to keep it that way — it exists because
an earlier sweep grepped one link form and missed fourteen sites. That investment pays off here: the
sweep is essentially one function.

| Site | Change |
|---|---|
| `dealCardLinkProps` | A space returns `/listings/$listingId/spaces/$spaceId` (params `{ listingId: parentDealId, spaceId: id }`) instead of the roster + `?space=`. Its doc comment inverts. |
| `buildingSectionListingId` | **Unchanged.** It answers "which page owns a building-level section for this deal", and in phase 1 that is still the building. Phase 2 may revisit it. |
| `rewriteSpaceDealPath` (`src/ai/tools.ts`) | A model-supplied `/listings/{spaceId}` becomes `/listings/{shellId}/spaces/{spaceId}`; `/listings/{spaceId}/{section}` becomes `/listings/{shellId}/spaces/{spaceId}/{section}` instead of dropping the space. |
| `StageGate.tsx` | "Back to editing" for a space goes to the space page's `terms` (what a publish gate flags on a suite) rather than the roster. |
| `dealCardLink.invariant.test.ts` | Its header comment asserts "a space deal has no page of its own" as the reason the allowlist exists. That premise inverts: the allowlist still matters — a link must resolve a space to *its* page rather than assuming `/listings/{id}` — but the reason is rewritten. `ALLOWED` entries stay. |
| Roster rows, Vouchers index rows | Point at the space page. |

`ff74f7d`'s test ("make a space has no page fail out loud when a link drifts") is
`dealCardLink.invariant.test.ts`. It is **rewritten, not deleted** — the mechanism is still the only
thing keeping links honest.

### The vouchers detail route goes

`/listings/{shellId}/vouchers/{spaceId}` becomes a duplicate of the space page's own `financials`
section. Delete the route; the index's rows point at
`/listings/{shellId}/spaces/{spaceId}/financials`.

The **index** stays. A shell's money rollup is genuinely shell-level and answers a question no single
space can. `spaceVouchers` is unchanged. `DealFinancials`/`DealInvoices` keep the optional `heading`
prop the detail route introduced — the space page uses it to name the suite.

---

## 5. Data and seed

### `PropertyUnit` gains occupancy

```ts
export interface PropertyUnit {
  // …
  /** Whether a tenant is in place. The asset's own fact — a suite's deal, when it
   *  has one, overrides this for display (see `suiteStatus`). */
  occupancy: 'vacant' | 'occupied'
  /** In-place tenant, when occupied. Marketing may override per deal — see
   *  `SpaceLeaseTerms.tenantName`. */
  tenantName: string | null
  /** ISO date (YYYY-MM-DD) the in-place lease ends. */
  leaseExpiration: string | null
}
```

Required, not optional: every construction site must state a suite's occupancy rather than leave it
ambiguous. `createListing.ts`'s unit factories and `addPropertyUnit` default to
`{ occupancy: 'vacant', tenantName: null, leaseExpiration: null }`.

### The tenant-name override

`SpaceLeaseTerms.tenantName?: string` **already exists** and `SpaceTermsSection` already edits it. So
for a suite with a deal, the override is already there and needs no new field.

For an occupied suite with no deal, the shell keeps a `spaceLeaseTerms` row for that unit and its
`tenantName` is the override. This works without new plumbing because `addSpaceToDeal` already moves
the parent's row for a unit onto the child when a deal starts:

> *"The parent's row for this unit — if the broker already priced it, that row moves to the child
> rather than forking a blank copy. One editable home per unit."*

So the override follows the suite across the transition from no-deal to deal, automatically.

`buildingSuites` reads `override ?? unit.tenantName` for its `tenantName`. Resolution is one
expression in the derivation, so no render site decides it.

**Where it is edited:** an occupied row is not a link and has no page, so the override needs a small
inline affordance on the roster — an editable tenant name on occupied rows. This is the one piece of
editing the directory keeps, and it is deliberate: it is a property of the *building's* marketing of
that suite, not of a deal that does not exist.

**The row it writes to may not exist.** After 08-04 the shell holds no `spaceLeaseTerms` of its own —
`addSpaceToDeal` moves each row to its child, and nothing puts rows back. So an occupied suite with no
deal has no row to override. Saving one must **create** it: `emptySpaceLeaseTerms(unitId)` with
`tenantName` set, appended to the shell's `spaceLeaseTerms` via `updateDealMarketing`. Clearing the
override removes the row again, so a shell never accumulates rows holding nothing. This is the only
way the shell reacquires space terms, and it holds exactly one field's worth — not a reopening of the
building-holds-terms model that 08-04 closed.

### Seed

`ShellSpec.childStages` currently has one entry per suite, so every seeded suite has a deal and the
directory would have nothing new to show. It gains occupied suites that get **no** child:

```ts
export interface ShellSpec {
  dealId: string
  suiteProportions: number[]
  childStages: PropertyStatus[]
  /** Suites appended after the deal-bearing ones: on the building, occupied, no deal. */
  occupiedSuites: { tenant: string; expiresInDays: number }[]
}
```

Both seeded shells get at least one, so both demonstrate the directory. Meridian (`107`) also gets a
vacant suite with no deal, so **Start a deal** is reachable from a fresh seed.

Coherence rules the seed upholds:

- A deal-bearing suite at stage `closed` is `occupancy: 'occupied'` with that deal's tenant — the
  asset record must not claim a leased suite is vacant, even though `suiteStatus` reads the deal.
- Every other deal-bearing suite is `vacant`.
- An occupied suite's `tenantName` comes from the same `FIXTURE_TENANTS` pool the rent roll draws
  from, so the unit and `financials.rentRoll` name the same tenant for the same unit.
- `resliceUnits` resizes units **in place** because `financials.rentRoll[].unitId` references their
  ids. Adding occupied suites appends, which that function already handles.
- The pass stays **faker-free** — `leaseSpaceFixtures.test.ts` and `seed.test.ts` pin determinism.

`SEED_VERSION` moves from 37 to 38. Without it, IndexedDB serves the old snapshot and the new suites
never appear — a failure that reads as a bug in the code (`reference_indexeddb_masks_seed_edits`).

---

## 6. File-by-file

### Add

| File | What |
|---|---|
| `src/data/buildingSuites.ts` | `buildingSuites`, `suiteStatus`, `SuiteRow`, `SuiteStatus` |
| `src/data/buildingSuites.test.ts` | Its tests |
| `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx` | Layout: guard, header, sidebar, `validateSearch` union, `<Outlet />` |
| `src/routes/_shell/listings/$listingId_/spaces/$spaceId/index.tsx` | Redirect to `overview` |
| `src/routes/_shell/listings/$listingId_/spaces/$spaceId/$section.tsx` | Resolves the section from the map |
| `src/components/deals/spaceSections.tsx` | The slug → component map |
| `src/components/deals/SpaceDetailHeader.tsx` | Suite title, building link, stage select, breadcrumb |
| `src/components/deals/SpaceTerms.tsx` | `SpaceTermsSection` behind page-level Save/Cancel |

### Change

| File | What |
|---|---|
| `src/routes/_shell/listings/$listingId/spaces.tsx` | Becomes the directory: `buildingSuites` rows, links, Start-a-deal, inline tenant override. Drops terms, drafts, `?space=`, `Collapsible`, per-row stage select and voucher link |
| `src/components/deals/AddSpaceModal.tsx` | New-suite form only; drop the existing-units checkbox list |
| `src/components/properties/PropertyDetailSidebar.tsx` | `basePath` prop, defaulting to current behaviour |
| `src/components/properties/dealNav.ts` | `Terms` item, gated to `shape === 'space'`; `dealBreadcrumbTrail` gains `subsectionLabel` |
| `src/data/types.ts` | `PropertyUnit` occupancy fields |
| `src/data/createListing.ts` | Three unit factories default the new fields |
| `src/data/store.ts` | `addPropertyUnit` defaults them |
| `src/data/seed.ts` | Its unit construction defaults them |
| `src/data/leaseSpaceFixtures.ts` | `occupiedSuites`; occupancy set coherently |
| `src/data/persistence.ts` | `SEED_VERSION` → 38 |
| `src/components/deals/dealCardLink.ts` | A space resolves to its page |
| `src/ai/tools.ts` | `rewriteSpaceDealPath` targets the space page |
| `src/components/deals/StageGate.tsx` | Space "Back to editing" → the space page's Terms |
| `src/routes/_shell/listings/$listingId/vouchers.tsx` | Index rows link to the space page |
| `src/components/deals/DealContextRail.tsx` | Restore `LinkedParentDeal` from `86990cc` |
| `src/components/deals/dealCardLink.invariant.test.ts` | Premise rewritten; `ALLOWED` retained |
| `src/components/properties/dealNav.test.ts` | Third-level crumb; `Terms` visibility |

### Delete

| File | Why |
|---|---|
| `src/routes/_shell/listings/$listingId/vouchers/$spaceId.tsx` | The space page's `financials` section replaces it |

`MarketingScopeBar`, `PropertyMarketingHub` and the `from` param **stay deleted**. They existed to
fake building-level marketing on a space page — phase 2's subject, and this design does not pre-empt
it.

---

## Suggested build order

Data before UI, and nothing deleted before its replacement works.

1. `PropertyUnit` occupancy fields + factory/`addPropertyUnit` defaults. Typecheck-driven: every
   construction site surfaces as an error.
2. `buildingSuites` + `suiteStatus` + tests. Pure data, no UI.
3. Seed: `occupiedSuites`, coherent occupancy, `SEED_VERSION` → 38. Fixture tests updated.
4. `dealNav.ts`: `Terms` item, `subsectionLabel`, tests.
5. `PropertyDetailSidebar` `basePath` prop — additive, nothing consumes it yet.
6. The space page: layout route + guard + `SpaceDetailHeader` + `$section.tsx` + the map, with a
   handful of sections wired.
7. Fill out the map to all 19, plus `SpaceTerms`.
8. Roster → directory, including Start-a-deal and the tenant override.
9. `AddSpaceModal` shrinks.
10. Links: `dealCardLinkProps`, `rewriteSpaceDealPath`, `StageGate`, Vouchers index rows,
    `DealContextRail`. Rewrite the invariant test's premise.
11. Delete the vouchers detail route.

---

## Non-goals

- **No phase-2 marketing split.** Every section renders for a space, duplication included. Deciding
  which are building-level is the next phase and the map is where it happens.
- **No hard rule against a deal on an occupied suite.** Unoffered, not forbidden.
- **No change to the pipeline board.** Suite label, Space chip, and the parent's stage rollup stay.
- **No shell commission of its own.** The Vouchers index total stays a sum of its spaces.
- **No revival of `MarketingScopeBar` / `PropertyMarketingHub` / the `from` param.**
- **No new occupancy source of truth beyond the unit.** Rent roll stays deal-scoped pitch data.
- **Sale and buy-side deals are untouched.**

---

## Verification

| Check | How |
|---|---|
| `buildingSuites` rows | `buildingSuites.test.ts`: a unit with a deal, a unit without; occupied vs vacant; the override preferred over the asset fact; label sort with numeric collation; empty for a non-lease-parent |
| `suiteStatus` precedence | A deal at each stage outranks occupancy; occupancy answers only with no deal |
| Breadcrumb derivation | `dealNav.test.ts`: three-deep space path, plus every existing case unchanged |
| Nav rules | `Terms` visible only for `shape === 'space'`; a space still gets no `spaces` and no `vouchers` |
| Map ↔ sidebar agree | A test asserting every href `visibleNavGroups('space', …)` emits has a `SPACE_SECTIONS` key, and no key is unreachable. This is what replaces per-route typing. |
| Space scoping | A `spaceId` whose `parentDealId !== listingId` renders nothing |
| Link invariant | `dealCardLink.invariant.test.ts` passes with its rewritten premise; `dealCardLinkProps` returns the space page for a child and `/listings/{id}` otherwise |
| Seed determinism | `leaseSpaceFixtures.test.ts` + `seed.test.ts`; faker-free; `pricePerSf × sqft === price` still holds |
| Route tree | `routeTree.gen.ts` regenerated — it carries `@ts-nocheck`, so neither `tsc` nor `vite build` catches a stale tree. Only regeneration does. |
| Nothing else broke | `bunx tsc --noEmit` and a full `vitest run`. `vite build` does **not** type-check. |
| The flow itself | Playwright: board → space card → space page → set stage through its gate → Terms → Save → breadcrumb to the building → Spaces → an occupied row shows its tenant → Start a deal on a vacant row lands on the new space page |

Two edges that need no handling, recorded so they are not mistaken for bugs:

- **A shell that loses its last space reverts to `flat-lease`** (`dealShape` derives from
  `children.length > 0`). The nav swaps Vouchers back to Voucher on its own; the directory still lists
  every unit, now all without deals.
- **The directory is empty only for a property with no units.** Unlike the deal-derived roster it
  replaces, it does not depend on a child existing.
