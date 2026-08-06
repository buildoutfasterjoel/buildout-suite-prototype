# Space Deal Pages — Design

**Status:** Approved design (2026-08-06), pending spec review.
**Supersedes:** `2026-08-04-space-deals-without-a-page-design.md` — its spine ("the building is the
only page") is reversed by stakeholder feedback. What that design built and this one keeps is listed
under *What survives* below.
**Scope:** Landlord rep lease only. Sale deals and buy-side are untouched.
**Phase:** 1 of 2. Phase 1 makes the space page exist and be walkable. Phase 2 decides which sections
are building-level and which are per-space, and fixes the marketing divergence that comes with giving a
space **every** section — see *Phase 2 backlog* for the full deferred list, which is accepted scope for
a later pass rather than an oversight.

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
  changes" affordances. They move to the space page's Details section, so there is **one** editor for
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

### Every link, and the three that are not

Phase 1 brings every section. Two exclusions are mechanical; the third is the one deliberate
judgement, and it is there to stop a data hazard rather than to tidy the nav.

| Excluded | Why |
|---|---|
| `spaces` | A space has no spaces. `visibleNavGroups` already gates this on `leaseParent`, which a space is not. |
| `vouchers` | The shell's rollup index. A space gets `financials` + `financial-documents`, which `visibleNavGroups` already gives every non-shell shape. |
| `listing` | **Replaced by `details`** — the space's own form. See below. |

The first two fall out of `visibleNavGroups('space', { leaseParent: false, showsUnderwriting })` **as it
already exists**. That leaves 17 existing sections:

`overview` · `client-report` · `activities` · `history` · `files` · `underwriting` · `leads` ·
`documents` · `website` · `email` · `media` · `demographics` · `grids` · `plans` · `financials` ·
`financial-documents` · `notes`

Plus `details`, which is new (see below) — 18 sections, so 18 route files.

**The duplication that remains is deliberate and is phase 2's whole subject.** A building's Documents
render at both `/listings/{shellId}/documents` and `/listings/{shellId}/spaces/{spaceId}/documents`,
showing the same content. Phase 1 accepts that; phase 2 decides which sections a space keeps.

### Eighteen route files, one per section

Every existing section route is a thin wrapper: read the id, resolve the listing, render a component
that takes a `Listing`. The space versions are the same wrapper reading `spaceId`:

```tsx
// src/routes/_shell/listings/$listingId_/spaces/$spaceId/media.tsx
export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/media",
)({ component: SpaceMediaRoute });

function SpaceMediaRoute() {
  const { spaceId } = Route.useParams();
  const listing = getListing(spaceId);
  if (!listing) return null;
  return <ListingMedia listing={listing} />;
}
```

A slug → component map behind a single `$section.tsx` route was considered and **rejected**: it would
have collapsed the glue into one file and made phase 2 a one-file edit, but at the cost of an untyped
`$section` param, per-section `validateSearch` collapsing into a union on the layout route, and
sections becoming un-greppable. Typed routes and repo uniformity won. Phase 2 pays for it by touching
18 files instead of one — a known, accepted cost.

What this buys:

- `Route.useParams()` is typed per route, and a literal `<Link to="/listings/$listingId/spaces/$spaceId/leads">`
  from anywhere in the app is checked against the generated tree.
- Per-route `validateSearch` stays natural: `leads` keeps its own `q`, `listing` keeps its `review`.
- The pattern matches every other section route in `src/routes/`, so nothing new has to be learned to
  read it.

**The guard is duplicated, so it is extracted.** Each of the 18 needs the child-of-shell check, and 18
hand-written copies is 18 chances to omit one — which is the `ab7b6be` bug (a suite painting one
landlord's money under another's frame). A `useSpaceRoute(listingId, spaceId)` hook returns
`{ listing, property, unit } | null`, doing the lookup and the guard in one place. Each route file
calls it and returns `null` on null.

**What typing does *not* cover:** the sidebar navigates with an interpolated string —
`navigate({ to: \`/listings/${listingId}/${item.href}\` })` — so a nav href pointing at a section that
does not exist is a runtime blank page, not a compile error. That is equally true today for the
building's own sidebar. A test pins `NAV_GROUPS` hrefs against the routes that actually exist (see
Verification); per-section files do not remove the need for it.

### Details is the space's own form, in the Listing slot

**The parallel is the point:** a parent deal's own marketing form is **Listing**. A space's own
marketing form is **Details**. Same slot in the Marketing group, same job for a different record.
`details` is therefore a *replacement*, not an addition — a space never shows both.

```
PARENT DEAL              SPACE DEAL
───────────              ──────────
Deal                     Deal
  Overview                 Overview
  Spaces                   —
Marketing                Marketing
  Listing        →         Details          ← the space's own form
  Leads                    Leads
  Media                    Media
  …                        …
```

Two rules in `visibleNavGroups`, which is a swap pair rather than a new mechanism — it mirrors exactly
how a shell gets **Vouchers** while every other shape gets **Voucher** + **Invoices**:

```ts
if (item.href === "details") return shape === "space"
if (item.href === "listing") return shape !== "space"
```

`Details` is added to `NAV_GROUPS` in the Marketing group, immediately before `Listing`, so the two
occupy one position in display order.

#### Why Listing is excluded, and what that does not fix

`addSpaceToDeal` builds the child with `marketing: { ...parent.marketing, … }` — **the space clones the
building's entire marketing blob at creation.** `ListingEditor` saves through `listingSavePatch` to the
listing's *own* marketing. So rendering the building's Listing form on a space page would let a broker
edit the space's divergent copy of the building's marketing: change the property description there and
the building's stays as it was, silently, with no indication which one a public surface will read.

That is a data hazard, not an aesthetic one, which is why this one section is decided now rather than
deferred to phase 2. It is also the section a broker is most likely to open *expecting* to edit the
building, which makes it the worst place to leave the ambiguity.

**It does not fix the hazard everywhere, and the spec should not pretend otherwise.** Every other
marketing-backed section a space now renders — `media`, `website`, `email`, `documents`, `grids`,
`plans`, `demographics` — reads that same cloned `marketing`, so editing one on a space still diverges
it from the building. Excluding `listing` removes the largest and most inviting instance; the rest are
accepted for phase 1 and are precisely what phase 2 exists to resolve.

#### What Details contains

**Exactly the set of fields already editable per space today** — the ~70 `SpaceLeaseTerms` fields
(space type, tenant name, rate and rate mode, lease type, term, date available, min/max divisible, TI,
free rent, sublease, the utility and industrial clusters, and the additional-fields accordion), plus
`marketing.availableSqFt`. Nothing is added or removed; the fields change address.

`SpaceTermsSection` already renders all of them and already takes `{ unit, property, terms, onChange,
availableSqFt, onAvailableSqFtChange }`. `SpaceDetails.tsx` wraps it with the page frame and the same
Save/Cancel contract it has today (`b1aad55`), lifted out of the roster's per-row draft machinery into
ordinary page state. The component keeps its name — it is the *section* that is called Details, and
renaming a working component to match a nav label buys nothing.

The fields arrive populated. `addSpaceToDeal` seeds the row with `spaceTermsFromUnit(unit)` (space
name, suite, floor, ceiling height, offices, conference rooms, furnished) and `availableSqFt` from
`unit.sqft` — or migrates the parent's existing row for that unit when the broker already priced it. A
new space deal opens on a filled form, not a blank one.

Two of those fields are not what they look like, and both are already true today:

- **Space Size is not on the terms row.** It is `marketing.availableSqFt` on the space's own deal —
  what the publish gate, deal cards, financials and website copy all read — and is passed to
  `SpaceTermsSection` separately. A `spaceSize` field on the row was removed in `553282a` precisely
  because nothing read it, so a broker could fill it in, save, and still be told Available SF was
  missing. Do not reintroduce it.
- **Availability is not a field.** `SpaceLeaseTerms.status` exists on the type and is deliberately
  never rendered; the editor prints "Availability follows this space's deal stage" instead. That rule
  is `spaceAvailability`, and `suiteStatus` (§1) is built on it.

**The two forms do not overlap in fields**, which is why the swap loses nothing. For a Lease deal the
listing form's lease content is `LeaseSection` ("Lease Marketing" — lease title, description, bullets,
commission split, available-SF term, closing info): marketing copy for the listing, sharing no field
with `SpaceLeaseTerms`. What 08-04 removed from that form was a section listing *every* unit's terms on
the building's form, not the per-space editor.

**On the name:** `SpacePanelDetails` (`c8a84ca`) used "Details" for a suite's headline facts, but it was
deleted in the `86990cc` revert, so there is no live collision. Slug `details`, label `Details`.

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
| `StageGate.tsx` | "Back to editing" for a space goes to the space page's `details` (the space's own form, where a publish gate's flagged fields live) rather than the roster. |
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
| `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx` | Layout: header, sidebar, `<Outlet />` |
| `src/routes/_shell/listings/$listingId_/spaces/$spaceId/index.tsx` | Redirect to `overview` |
| `src/routes/_shell/listings/$listingId_/spaces/$spaceId/*.tsx` | 18 section routes — `overview`, `details`, `client-report`, `activities`, `history`, `files`, `underwriting`, `leads`, `documents`, `website`, `email`, `media`, `demographics`, `grids`, `plans`, `financials`, `financial-documents`, `notes`. No `listing`, no `spaces`, no `vouchers`. |
| `src/components/deals/useSpaceRoute.ts` | Lookup + child-of-shell guard, shared by all 18 |
| `src/components/deals/SpaceDetailHeader.tsx` | Suite title, building link, stage select, breadcrumb |
| `src/components/deals/SpaceDetails.tsx` | `SpaceTermsSection` behind the page frame and its Save/Cancel |

### Change

| File | What |
|---|---|
| `src/routes/_shell/listings/$listingId/spaces.tsx` | Becomes the directory: `buildingSuites` rows, links, Start-a-deal, inline tenant override. Drops terms, drafts, `?space=`, `Collapsible`, per-row stage select and voucher link |
| `src/components/deals/AddSpaceModal.tsx` | New-suite form only; drop the existing-units checkbox list |
| `src/components/properties/PropertyDetailSidebar.tsx` | `basePath` prop, defaulting to current behaviour |
| `src/components/properties/dealNav.ts` | `Details` item in the Marketing group before `Listing`; the `details`/`listing` swap pair in `visibleNavGroups`; `dealBreadcrumbTrail` gains `subsectionLabel` |
| `src/data/types.ts` | `PropertyUnit` occupancy fields |
| `src/data/createListing.ts` | Three unit factories default the new fields |
| `src/data/store.ts` | `addPropertyUnit` defaults them |
| `src/data/seed.ts` | Its unit construction defaults them |
| `src/data/leaseSpaceFixtures.ts` | `occupiedSuites`; occupancy set coherently |
| `src/data/persistence.ts` | `SEED_VERSION` → 38 |
| `src/components/deals/dealCardLink.ts` | A space resolves to its page |
| `src/ai/tools.ts` | `rewriteSpaceDealPath` targets the space page |
| `src/components/deals/StageGate.tsx` | Space "Back to editing" → the space page's Details |
| `src/routes/_shell/listings/$listingId/vouchers.tsx` | Index rows link to the space page |
| `src/components/deals/DealContextRail.tsx` | Restore `LinkedParentDeal` from `86990cc` |
| `src/components/deals/dealCardLink.invariant.test.ts` | Premise rewritten; `ALLOWED` retained |
| `src/components/properties/dealNav.test.ts` | Third-level crumb; the `details`/`listing` swap |

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
4. `dealNav.ts`: `Details` item, the `details`/`listing` swap, `subsectionLabel`, tests.
5. `PropertyDetailSidebar` `basePath` prop — additive, nothing consumes it yet.
6. The space page's frame: `useSpaceRoute`, the layout route, `SpaceDetailHeader`, and three section
   routes wired end to end (`overview`, `details` with `SpaceDetails`, `media`) — enough to prove the
   nesting, the guard and the sidebar's `basePath` before repeating the pattern.
7. The remaining 16 section routes, mechanically.
8. Roster → directory, including Start-a-deal and the tenant override.
9. `AddSpaceModal` shrinks.
10. Links: `dealCardLinkProps`, `rewriteSpaceDealPath`, `StageGate`, Vouchers index rows,
    `DealContextRail`. Rewrite the invariant test's premise.
11. Delete the vouchers detail route.

---

## Non-goals

- **No phase-2 marketing split.** Every section renders for a space, duplication included. Deciding
  which are building-level is the next phase, and it will mean revisiting all 18 route files plus
  `visibleNavGroups` — the cost accepted when per-section files won over a map.
- **No hard rule against a deal on an occupied suite.** Unoffered, not forbidden.
- **No change to the pipeline board.** Suite label, Space chip, and the parent's stage rollup stay.
- **No shell commission of its own.** The Vouchers index total stays a sum of its spaces.
- **No revival of `MarketingScopeBar` / `PropertyMarketingHub` / the `from` param.**
- **No new occupancy source of truth beyond the unit.** Rent roll stays deal-scoped pitch data.
- **Sale and buy-side deals are untouched.**

---

## Phase 2 backlog

Deferred deliberately, not overlooked. Phase 1 is meant to make the space page exist and be walkable;
these are what turn it into a flow that holds up. Recorded here so the next session inherits the list
rather than rediscovering it.

**1. Marketing divergence — the one with teeth.** A space holds a *clone* of the building's marketing
(`addSpaceToDeal` spreads `...parent.marketing`), and seven sections a space now renders read and write
that clone: `media`, `website`, `email`, `documents`, `grids`, `plans`, `demographics`. Editing any of
them on a space silently diverges it from the building, with nothing indicating which copy a public
surface reads. Excluding `listing` (§2) removed the largest instance; these seven ship as-is in phase 1.

Three shapes a fix could take, in rough order of cost:

- Render them read-only on a space, with a link up to the building to edit.
- Drop them from a space's nav entirely, so the building is the only place they exist.
- Make a space's marketing a *reference* to its parent's rather than a clone, so there is one copy.
  The real fix, and the one that touches the data model.

**2. The building-vs-space scope table.** The full version of the above: for each of the 17 inherited
sections, decide whether it is the building's, the space's, or genuinely both. `2026-07-31-lease-space-marketing-scope-design.md`
has a first attempt at this table; it needs redoing against a space that has a page. Output is edits to
`visibleNavGroups` plus deletions among the 18 route files.

**3. Duplicate URLs for the same content.** While a section renders at both
`/listings/{shellId}/documents` and `/listings/{shellId}/spaces/{spaceId}/documents`, two URLs show the
same thing. Resolved as a consequence of (2), but worth naming separately because it also affects
`buildingSectionListingId`, whose contract ("a building-level section belongs to the building") may
change.

**4. Smaller, once the flow is walkable:** whether an occupied suite should be blockable rather than
merely unoffered; whether the Vouchers index survives now that each space has its own Voucher section,
or becomes redundant; and whether `dealShape`'s `flat-lease` → `shell` flip still reads correctly when
the directory lists units that have no deals.

---

## Verification

| Check | How |
|---|---|
| `buildingSuites` rows | `buildingSuites.test.ts`: a unit with a deal, a unit without; occupied vs vacant; the override preferred over the asset fact; label sort with numeric collation; empty for a non-lease-parent |
| `suiteStatus` precedence | A deal at each stage outranks occupancy; occupancy answers only with no deal |
| Breadcrumb derivation | `dealNav.test.ts`: three-deep space path, plus every existing case unchanged |
| Nav rules | A space gets `details` and never `listing`; every other shape gets `listing` and never `details` — the two are never both shown, and never both absent. A space still gets no `spaces` and no `vouchers` |
| Nav ↔ routes agree | A test asserting every href `visibleNavGroups('space', …)` emits has a matching route file under `$listingId_/spaces/$spaceId/`, and that no such route is unreachable from the nav. The sidebar interpolates its hrefs, so typing cannot catch this. |
| Space scoping | `useSpaceRoute` returns null when `parentDealId !== listingId`, and every one of the 18 routes calls it |
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
