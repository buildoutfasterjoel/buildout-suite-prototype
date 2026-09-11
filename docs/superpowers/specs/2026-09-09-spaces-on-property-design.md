# Spaces on the Property record — Design

**Status:** Approved (2026-09-09). Q1 → (C), Q7 → editable + write-through, Q9 → yes; every other open question resolved to its stated recommendation. Plan: `docs/superpowers/plans/2026-09-09-spaces-on-property.md`.
**Branch:** `zach/spaces-on-property`
**Trips the wires:** data fixtures + `SEED_VERSION`, new routes, new vocabulary ("Space" on the asset side).
**Source:** the Spaces PRD as amended in the Cowork session; the decisions marked *settled* there are implemented here, not re-argued.

---

## The one-sentence version

> A property's spaces are its `PropertyUnit`s. The Property record grows a Spaces tab that lists every one of them with a status **derived** from its child deal (else its occupancy), a property-level availability headline derived from those statuses by precedence, an asset page per space at `/properties/{propertyId}/spaces/{unitId}`, and a "Create deal from this space" action that starts a child deal on the building's lease shell.

Nothing is added to `PropertyUnit`. Nothing changes on the deal-side space page.

---

## 1. What already exists, and what this builds on

| Fact | Where | Consequence for this design |
|---|---|---|
| A unit already has `label`, `unitType`, `sqft`, `suite`, `floor`, `occupancy`, `tenantName`, `leaseExpiration` | `PropertyUnit` in `types.ts` | The Create Space modal's five fields all exist. **Zero type delta.** |
| A unit's deal is a *child* listing: `parentDealId = shell.id`, `unitId = unit.id` | `leaseSpaces.ts`, `dealShape.ts` | The property-keyed join is `listing.propertyId === p.id && listing.parentDealId != null && listing.unitId === unit.id` |
| A deal, when one exists, is the truth; occupancy answers only for a suite nobody is working | `suiteStatus` in `buildingSuites.ts` | Reused as the *structure* of the status rule (§3) |
| `spaceAvailability(status)` → `Available / Under Contract / Leased / Not advertised` | `dealShape.ts` | Reused as the *vocabulary* of the status rule (§3) |
| The whole-property stub unit (`WHOLE_PROPERTY_LABEL`) is a flat-lease deal in disguise, not a suite | `buildingSuites.ts:79`, `createListing.ts:437` | Excluded from the roster the same way |
| Seeded **top-level** deals carry `unitId = property.units[0].id` as a marketing default; shells have it nulled | `seed.ts:2138`, `leaseSpaceFixtures.ts:952` | A top-level deal's `unitId` is *not* a claim on the unit. The join above ignores top-level deals on purpose (§3.4) |
| The Property record reads the store once, non-reactively | `getPropertyDetailClient` uses `getState()` | Must become a subscribed hook, or adding a space won't repaint |
| Asking rent lives on `SpaceLeaseTerms` — on the child once a deal exists, else possibly a pre-split row on the shell | `buildingSuites.ts:85-87` | Rent is **deal-sourced**, never stored on the unit |

---

## 2. Data-model delta

**On `PropertyUnit`: none.** Every field the feature reads or writes is already there. Availability stays derived (settled decision 1); asking rent stays on the deal's terms row.

Two small non-shape changes:

1. **`addPropertyUnit`** (`store.ts:94`) widens its input from `{ label, sqft, unitType }` to `{ label, sqft, unitType, suite?, floor? }`. Optional, so the deal-side `AddSpaceModal` caller is untouched.
2. **`Property` gains nothing.** The availability headline is computed, never stored — there is no `spaceCount`, no `availabilitySummary`. A stored copy is a second fact to keep in sync, which is exactly what decision 1 rules out at the unit level and applies equally one level up.
3. **A space deal's Details save writes physical facts through to the unit** (§2.1). New action `saveSpaceDetails(spaceId, { terms, availableSqFt })` in `actions.ts` replaces the bare `updateDealMarketing` call in `SpaceDetails.tsx`: it patches the deal's marketing as today *and* patches the unit's copy of every physical key in the same tick. No type changes; the `SpaceLeaseTerms` copies stay for the surfaces that read them.

Why "as little as possible" is the right answer here: the failure mode the PRD's original `status` field would have introduced is a unit that says `Available` while its deal says `Under Contract`. Every field this section declines to add is a field that could disagree with a deal.

### 2.1 Field ownership — who is the truth for what

This came out of review, and it is a latent bug this feature would have made visible rather than one it creates. `spaceTermsFromUnit` (`createListing.ts:117`) **clones seven physical fields** from the unit onto the space deal's `SpaceLeaseTerms` when the deal is created, and the deal's Details form (`SpaceIdentitySection`, `SpaceLeaseTermsSection`) edits those copies. Nothing in the app reads the unit's originals except the clone itself. So today the deal's copy is the only editable one and the asset record is write-once at creation, silently stale after the first Details edit. A property roster built on the unit would have shipped the stale copy as the record of truth: ceiling height 14 on the deal, 12 on the property.

The rule, stated once and applied on both pages:

| Layer | Fields | Owner | On the deal's Details form | On the asset page |
|---|---|---|---|---|
| **Physical** | `suite`, `floor`, `ceilingHeight`, `offices`, `conferenceRooms`, `furnished`, `unitType` | the **unit** | editable; a save **writes through** to the unit | editable (`CreateSpaceModal` in edit mode, §6) |
| **Commercial** | `leaseRate` + units, `leaseTermMonths`, `dateAvailable`, `minDivisibleSqFt`, `maxContiguousSqFt`, TI, free rent, escalators, expenses… and `marketing.availableSqFt` | the **deal** | editable, as today | **read-only**, with *Edit on deal* |
| **Display overrides** | `spaceName`, `tenantName`, `spaceType` label | the **deal**, as an override | editable, as today | shows `override ?? asset fact` (the `buildingSuites` tenant-name rule) |

Why not the other way around for everything: `spaceName`/`tenantName` are legitimately marketing — the asset says *Suite 200*, the listing may say *The Corner Suite* — and `availableSqFt` legitimately differs from `unit.sqft` when only part of a suite is offered. Those stay deal-side. Why not drop the physical copies from `SpaceLeaseTerms` and have the deal read the unit: cleaner, but it touches the type, the publish preview, website copy, fixtures and their tests — a phase-2 candidate, recorded in **Q7**. The write-through gets the same truth for one branch in one action.

`saveSpaceDetails` is the only place the physical → unit direction is written; the asset page's editor writes the unit directly and never touches a deal. The seed already flows unit → terms (`termsForUnit` in `leaseSpaceFixtures.ts`), so after this the two directions agree everywhere. A unit with **no** deal is unaffected: its facts were always the only copy.

---

## 3. The derived-availability helper

New module: **`src/data/propertySpaces.ts`**, property-keyed, alongside the shell-keyed `buildingSuites.ts` / `buildingAvailability.ts`. Pure functions over the store, tested in `propertySpaces.test.ts`.

### 3.1 A space's status

```ts
export type SpaceStatus = SpaceAvailability | 'Occupied' | 'Vacant'
//                       = 'Available' | 'Under Contract' | 'Leased' | 'Not advertised' | 'Occupied' | 'Vacant'

export function spaceStatus(deal: Listing | null, unit: PropertyUnit): SpaceStatus {
  if (deal) return spaceAvailability(deal.status)
  return unit.occupancy === 'occupied' ? 'Occupied' : 'Vacant'
}
```

This is `suiteStatus`'s structure with `spaceAvailability`'s vocabulary — which is **not** what `suiteStatus` does today, and PR #130 is the reason. That PR moved the *deal directory* off `spaceAvailability` because a directory of deals said "Not advertised" while the deal's own page said "Inactive": same record, two words. The fix was right for that surface and does not transfer to this one:

- The Property record is the **asset** view. Its question is "can this space be let?", and the answer set is availability, not pipeline position. The deal's stage lives in the roster's *Linked deal* column, next to the deal it belongs to, so both words appear on the row, each labelled.
- The property header already shows `property.status` through `STATUS_LABELS` (`Pitching / Active / Under Contract / Closed / Lost`). A space headline in the same vocabulary — `Active · 3 of 6 spaces` beside a `Active` stage badge — would collide with it. `Available` does not.
- The PRD's precedence list, the segmented bar, and a future index filter all need a small closed set. The four availability values plus two occupancy values are that set; six deal-stage labels plus two are not.

`SuiteStatus` (deal directory) and `SpaceStatus` (asset roster) are therefore deliberately distinct types, documented as such in both modules. See open question **Q2**.

### 3.2 Rows

```ts
export interface SpaceRow {
  unitId: string
  label: string
  suite: string | null
  floor: number | null
  sqft: number
  unitType: UnitType
  status: SpaceStatus
  /** The child deal working this space, or null. Never a top-level deal — see §3.4. */
  dealId: string | null
  /** The shell the deal hangs under; needed to build the deal's link. */
  shellId: string | null
  stage: PropertyStatus | null
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  tenantName: string | null
  leaseExpiration: string | null
}

export function propertySpaces(propertyId: string): SpaceRow[]
```

- Walks `property.units`, excludes `WHOLE_PROPERTY_LABEL`, left-joins the child deal.
- Terms resolve as `buildingSuites` does: the child's `spaceLeaseTerms[0]` when a deal exists; otherwise a pre-split row on the property's lease shell (`shell.marketing.spaceLeaseTerms.find(unitId)`), when there is a shell. Same `override ?? asset fact` rule for tenant name.
- **Order is fixed here, once**: precedence rank of `status` (Available first), then `floor` ascending with `null` last, then `label` with numeric collation. Every surface renders this order; no surface re-sorts.

### 3.3 The property-level summary

```ts
export const SPACE_STATUS_PRECEDENCE: SpaceStatus[] = [
  'Available', 'Under Contract', 'Vacant', 'Leased', 'Occupied', 'Not advertised',
]

export interface PropertyAvailability {
  spaceCount: number
  counts: Record<SpaceStatus, number>
  /** The set of statuses present — what an index filter matches against. */
  statuses: ReadonlySet<SpaceStatus>
  headline: SpaceStatus
  headlineCount: number
  uniform: boolean
  totalSqft: number
  availableSqft: number   // sum over Available + Vacant
}

/** Null when the property has no spaces — the caller falls back to `property.status`. */
export function propertyAvailability(propertyId: string): PropertyAvailability | null

export function formatAvailabilityHeadline(a: PropertyAvailability): string
// 1 space            → "Available"
// uniform            → "Leased · 6 spaces"
// mixed              → "Available · 3 of 6 spaces"
```

**No `Mixed` value exists anywhere.** `statuses` is the filterable fact; a building with 3 of 6 available is in the `Available` set. Mixedness is visible only through `uniform === false` and the segmented bar.

**Why `Vacant` ranks third.** The ladder orders statuses by *what a broker can do next from this page*: Available (show it), Under Contract (close it), Vacant (start it), Leased (collect), Occupied (wait for the expiration), Not advertised (the deal is parked — Inactive will surface as Available on its own timeline, Lost is over; either way the asset page has no move). Vacant sits above Leased and Occupied because it is the only no-deal state that is an *opportunity*: a building with five leased suites and one vacant should headline `Vacant · 1 of 6`, because that one is the reason to open the record. It sits below Available and Under Contract because those have an engagement and money moving, and the headline should name the state that does. One consequence worth checking before this ships is in **Q3**.

### 3.4 Why top-level deals never claim a unit

Seeded whole-building deals set `unitId` to the first unit as a marketing default (`seed.ts:2138`); `Listing.unitId`'s doc says null means whole property, and the seed violates that on every deal property. If the helper honoured `unitId` on top-level deals, the first suite of every deal property would report the *building* deal's stage — 24 wrong rows on a fresh seed.

So the join is child deals only, matching `buildingSuites` and `buildingAvailability`. Cost: a top-level Lease deal created through Create Deal with a unit picked (`attachAs: 'space'`) does not show as that unit's deal on the roster. That path produces a flat lease scoped to a unit, not a space deal, and this design doesn't try to make it one. The Deals section on Overview still lists it. See **Q13**.

### 3.5 Refactor `buildingSuites` / `buildingAvailability` onto this? **No — leave them alone.**

They are keyed by shell, answer shell-scoped questions ("what does *this deal's* building advertise", "which suites can *this shell* start a deal on"), use the deal-stage vocabulary #130 chose on purpose, and `buildingSuites` shares its order with the Vouchers index (`spaces.tsx` comment). Folding them onto a property-keyed helper would re-open exactly the vocabulary question #130 closed and couple the Vouchers order to this roster's. The duplication is one join and one two-line rule; the two modules cross-reference each other in their doc comments so the next reader sees both. Revisit only if a third consumer appears.

---

## 4. Routing — and #128/#130 addressed head-on

### 4.1 Shape

```
src/routes/_shell/properties/
  $propertyId.tsx                 ← becomes the layout: top rail + 180px section-nav Card + <Outlet>
  $propertyId/index.tsx           ← param-only redirect → /properties/$propertyId/overview
  $propertyId/overview.tsx
  $propertyId/spaces.tsx
  $propertyId_/spaces/$unitId.tsx ← the space's asset page; trailing underscore escapes the layout
```

- **`/properties/{id}` keeps working.** All eight existing `to: "/properties/$propertyId"` call sites (contact cards, list row, prospect flyout, Otto's rail, the index) land on the redirect. No `useParams({ from: "/_shell/properties/$propertyId" })` exists in the tree today, so nothing hardcodes the route id being restructured.
- **The redirect reads nothing from the store** — `cf5676c`: `beforeLoad` runs against an empty map on a cold load. Param → param only.
- **The param is `unitId`**, not `spaceId`. It keys a `PropertyUnit`; `/listings/…/spaces/$spaceId` keys a `Listing`. The two live in different directories, so TanStack's typed `params` cannot be handed the wrong one.
- **Guard:** `resolvePropertySpaceRoute(propertyId, unitId)` in `src/data/propertySpaceRoute.ts` returns `{ property, unit, row }` or `null` when the unit is not in `property.units`. It cannot render another property's unit because the lookup is inside that property's array. Null renders a *Space not found* `Empty` with "Back to Spaces" — never a redirect, for the `cf5676c` reason.

### 4.2 Is this the fourth surface that repeats a paid-for mistake?

I read the three failures in #128's table against this page. It does not repeat them, but it introduces one new hazard that they didn't have, and the design has to close it.

| Prior failure | Would this page repeat it? |
|---|---|
| **Pre-08-04** — a space page had to *fake building-level marketing* (`from` param over 8 routes, `PROPERTY_ONLY` / `SHELL_ONLY` filters) | No. This page carries **no marketing**. It renders asset facts the unit owns and, read-only, terms the child deal owns. There is no `from` param: the URL names the property, and the property is the only frame. |
| **`c8a84ca`** — the suite rendered *inside the building's frame*: two navs stacked, the building's sidebar hiding what the suite claimed | No. `$propertyId_` un-nests the page from the property layout (the exact `#128` mechanism). The space page paints its own top rail and has **no left sidebar at all**, so there is nothing to stack. |
| **#116** — no page; the roster was the control surface; stakeholders wanted a page | This *is* a page, and it exists for the unit nobody has started a deal on — the record #116's roster could show but never link. |

**The new hazard: a worked suite now has two pages.** `/properties/{p}/spaces/{unitId}` (asset) and `/listings/{shell}/spaces/{spaceId}/…` (deal). #128 already flagged the shape of this danger — `addSpaceToDeal` spreads `...parent.marketing`, so a space holds a *clone*, and any second editable surface lets the two diverge silently. Three rules close it:

1. **One editable home per fact — §2.1.** Physical facts have one store record, the unit; both the asset page and the deal's Details form write *that* record, so there is no clone to diverge. Commercial terms have one home, the deal; the asset page renders them **read-only** with an *Edit on deal* link. This is the `#128` "one rule per fact" line drawn one level up, and it closes the drift that already existed before this feature.
2. **One rule for the crossing.** New `spaceAssetLink(propertyId, unitId)` sits beside `dealCardLinkProps` in `dealCardLink.ts`; the roster's *Linked deal* cell uses `dealCardLinkProps(child)`, and the deal-side `SpaceDetailHeader` / `DealContextRail` gain a "Property record" link built from `spaceAssetLink`. `dealCardLink.invariant.test.ts` source-scans for hardcoded `/listings/…` targets, so the two deal-side back-links must either use `dealCardLinkProps` or be added to its allowlist with a reason. It does **not** scan `/properties/…` forms; keeping `spaceAssetLink` in the same file is the cheap guard, and extending `LINK_FORMS` to cover `/properties/$propertyId_/spaces` is a one-line follow-up if a second builder ever appears.
3. **The asset page answers a different question and says so in its chrome.** Breadcrumb `Properties / …`, status as availability, no stage select, no access avatars, no publish state. A broker cannot mistake it for the deal.

If Zach reads this and still thinks the second page is #116's mistake inverted — too many surfaces — the fallback that loses least is to ship §5 and §6 (tab + roster + modal + create-deal) and hold §7 (the page), with roster rows linking to the deal page when one exists and nowhere otherwise. Everything in §3 stands either way.

---

## 5. The Property record, restructured

> **Revised in review (2026-09-10).** Zach's read of the first build changed the shell: **no left section nav.** Overview and Spaces are underline tabs across the top of the main card (the shape Buildout's own property page uses), and the right rail — Deals, Contacts, Comps as the contact page's collapsible `ContactSection`s — **stays visible on both tabs**, 380px like the contact page's side columns. Deals render with the redesigned `NewDealCard` (which gained a Space type/glyph and the shell's spaces-count rollup badge) via `RecordDealCard`; comps get a matching `CompCard`. The Overview's facts, and the space page's facts and lease terms, use `RecordDetails` — Buildout's own details layout (filter box; purple-glyph 17px section headings; semibold label in the left half, value in the right, hairline rows, `--` for empty), with its groups and row order. §5.2–5.4 and §7 below describe the first build and are superseded where they conflict.


Mirrors `$listingId.tsx`: `h-100 overflow-y-auto` wrapper → top rail → `container d-flex align-items-start gap-4 py-4` → sticky 180px section-nav `Card` → `Card flex-grow-1` holding the `Outlet`. Each tab owns its inner columns, as the deal shell's tabs do.

### 5.1 Top rail — `PropertyRecordHeader` (reworked in place)

Same three-column shape as `PropertyDetailHeader` (164px thumbnail · identity · actions) so a property header and a deal header read as the same kind of page:

- **Breadcrumb** `Properties / {name}` + a section crumb (`Overview`, `Spaces`) using the same `Breadcrumb.List / Separator / Page` structure. `Properties` crumb icon: `faBuilding` (regular), the People/Deals convention.
- **h1** name · address line.
- **Badge row:** property type (icon + label, as today), existing `property.status` stage badge when non-null (unchanged), then the **availability headline** — `formatAvailabilityHeadline` as a dot + text in `SpaceStatus` colour, with the **segmented bar** beside it (§5.4). With zero spaces the headline and bar are simply absent: today's header, verbatim.
- **Actions:** `Create Deal` (primary, existing `useCreateDeal.openFor`). No Add Space here — it lives on the Spaces tab per the PRD.

### 5.2 Section nav — `PropertyRecordSidebar` (new, small)

`PropertyDetailSidebar` is a deal component: it filters `dealNav` groups by shape, access and underwriting. Reusing it would mean faking a `Listing`. Instead a ~40-line sibling renders one ungrouped `Tabs orientation="vertical" variant="pills"` list from `propertyNav.ts`:

```ts
export const PROPERTY_NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: 'overview', icon: faGaugeHigh },    // same glyph as the deal's Overview
  { label: 'Spaces',   href: 'spaces',   icon: faVectorSquare }, // same glyph as the deal's Spaces
]
```

Same icons as the deal nav on purpose: the concept is the same, the record differs. `propertyNavRoutes.test.ts` pins nav ↔ route files the way `spaceNavRoutes.test.ts` does, because the sidebar interpolates `${basePath}/${href}` and TypeScript can't check it.

### 5.3 Overview tab

- **Main column:** `PropertyFactsCard`'s groups, laid out for width (two `FieldGrid`-like columns rather than the 3-col card's single stack). Same data, same `group()` helper.
- **Right column (340px, `d-none d-xl-block border-start`, like `DealContextRail`):** one `Card` holding an `Accordion multiple variant="inline"` with three items, all open by default — **Comps**, **Deals**, **Contacts**. Bodies are today's `PropertyDealsPanel` list (`DealCardById showStatus`, plus the *New deal* button) and `PropertyOwnersCard`'s two lists, moved into accordion bodies. Those two components are absorbed; `PropertyFactsCard` survives. Counts stay in muted badges on the triggers.
- Data comes from a new **`usePropertyDetail(id)`** hook that subscribes to `properties`, `listings`, `contacts`, `comps` maps and calls `getPropertyDetailClient` — the current one-shot read is why adding a space wouldn't repaint.

### 5.4 Spaces tab

Full width — the tab renders no right column, which is what "hidden on this tab" means in this shell.

**Summary strip** (top of the card body, one row): `3 of 6 spaces available · 24,500 SF available` on the left (from `propertyAvailability`: `headlineCount`/`spaceCount` only when headline is Available or Vacant; otherwise `6 spaces · 24,500 SF`), the segmented bar beside it, `+ Add Space` (`Button variant="primary"`, `faPlus`) on the right.

**Segmented bar — `PropertyAvailabilityBar`** (new, ~30 lines). Blueprint `Progress` is single-value, so this is a flex row of segments, width ∝ count, 6px tall, 4px radius, 2px gaps, colours from `SPACE_STATUS_COLORS`, wrapped in a Blueprint `Tooltip` whose content is the full breakdown in precedence order (`3 Available · 1 Under Contract · 2 Leased`). Tokens only, no hex. Hidden when `spaceCount <= 1` (a one-segment bar says nothing).

**Roster — `SpacesRoster`**, a Blueprint `Table` (CLAUDE.md: values read down a column → table). Columns:

| Column | Renders | Empty |
|---|---|---|
| Space | `label`, semibold; `suite` beneath in `fs-small text-muted` when it differs from the label | — |
| Floor | number | `—` |
| Size (SF) | `formatSqFt`, right-aligned | — |
| Type | `UNIT_TYPE_LABELS[unitType]` | — |
| Status | 8px `rounded-circle` dot + text — the `ContactsTable` `Dot` convention, **not** `StatusPill` (that is the deal-stage pill; this column is deliberately not a stage) | — |
| Asking rent | `$48.00/SF/yr` via `formatAskingRent(rate, units)`: `SF/Yr → /SF/yr`, `SF/Mo → /SF/mo`, `Monthly → /mo` | `—` |
| Linked deal | `DealStageBadge shape="space"` + deal name as a `Link` from `dealCardLinkProps`; a deal this viewer may not open (`useOpenableSpaces(shellId)`) renders the badge and a `faLock` with no link, matching the deal directory's locked row | `—` (em dash, muted) |

Row click → the space's asset page (`spaceAssetLink`). The Linked-deal link stops propagation, the way the directory's stage select does. No actions column: the row *is* the action, and "Create deal" lives on the space page where the broker has read the facts first.

**Empty state:** Blueprint `Empty` — `faVectorSquare` media, title *No spaces on this property yet*, body *Add a space to track it here and start a deal on it when you're ready.*, single action `+ Add Space`. The tab is always in the nav; it is never hidden for zero spaces.

### 5.5 Colours — `SPACE_STATUS_COLORS` in `propertySpaceDisplay.ts`

Proposed mapping to existing stage tokens so a space that is Available and its deal that is Active share a colour: Available → `--stage-active`, Under Contract → `--stage-under-contract`, Leased → `--stage-closed`, Not advertised → `--stage-inactive`, Vacant → `--stage-proposal` (the amber "something could start here"), Occupied → `storm-grey-400` (one step lighter than Not advertised so the two greys separate). This is the design call flagged in **Q11**; the module isolates it to one edit.

---

## 6. Create Space modal — `CreateSpaceModal`

Opened from the strip and the empty state. Five fields, so plain stacked Blueprint `Field`s in a `Modal.Content size="md"` — not the `recordForm` shell (CLAUDE.md rule 1).

| Field | Control | Rule |
|---|---|---|
| Label | `Input`, placeholder *e.g. Suite 200, Bay 4, Pad C* | Required. Free text — this is where unit-type detail lives; no adaptive labels (settled) |
| Unit type | `Select` over all five `UnitType`s, default from the property's type via the seed's mapping | Includes `Residential`, unlike the deal-side modal — this is an asset record, nothing is spun into a lease |
| Size (SF) | `Input type="number"` | Required, `> 0` |
| Suite | `Input` | Optional |
| Floor | `Input type="number"` | Optional, integer |

**Duplicate label:** `isDuplicateSpaceLabel(property, label)` — trimmed, case-insensitive, against every unit including the whole-property stub (so nobody can name a suite "Whole Property" and vanish it from the roster). Inline `Field.Error errors={[…]}`: *A space named "Suite 200" already exists on this property.* Add stays disabled while it holds.

**Commit:** `addPropertyUnit(propertyId, { label, sqft, unitType, suite, floor })` → `notify({ title: 'Space added' })` → close. No navigation: a broker splitting a floor adds several in a row, and the new row appears in sorted position. Local state resets on open the way `AddSpaceModal` does.

**Edit mode.** The same component takes an optional `unit`; when present the title reads *Edit space*, fields seed from the unit, the duplicate-label check excludes the unit's own id, and commit calls a new `updatePropertyUnit(propertyId, unitId, patch)` in `store.ts`. It is the asset page's editor (§7) — ~20 lines on top of create.

The deal-side `AddSpaceModal` is left alone this phase; consolidating the two onto one form is **Q8**.

---

## 7. The space's asset page — `/properties/{propertyId}/spaces/{unitId}`

No left sidebar. One route file, no sections. Layout: top rail → `container py-4` → main column + 340px right column (`d-none d-xl-block`).

**Top rail — `SpaceRecordHeader`:** thumbnail seeded on `unitId` (as `SpaceDetailHeader` seeds on the space's id); breadcrumb `Properties / {Property} / {Space}` where *Properties* → `/properties` and *{Property}* → the property's **Spaces tab** (the crumb wears the property's name and lands on the surface the space was reached from — see **Q6**); h1 = `label`; address line; badge row = unit type · `formatSqFt` · status dot + text. Actions, right: an *Edit space* pencil (`Button variant="ghost" size="icon"`, `faPencil`, `aria-label` on the button) opening `CreateSpaceModal` in edit mode; then, when a child deal exists and is openable, `Open deal` (secondary, `Link` via `dealCardLinkProps`); when none, **`Create deal from this space`** (primary, `faHandshake`). No stage select, no avatars, no options menu — none of those are the asset's.

**Main column:**

- **Space facts** card: label, suite, floor, unit type, size, ceiling height, offices, conference rooms, furnished, occupancy, in-place tenant, lease expiration — the unit's own fields, through the same `group()` row helper as `PropertyFactsCard`. Edited through the header pencil (§6 edit mode); because the deal's Details form writes the same record (§2.1), a value changed on either page is the value on both.
- **Lease terms** card, only when a child deal exists **and** the viewer may open it: asking rent, lease term, min divisible / max contiguous, tenant override, availability — read from `deal.marketing.spaceLeaseTerms[0]`, read-only, header link *Edit on deal* → the child's `details` section. When a deal exists but is locked: a muted line *Terms are on a deal you don't have access to.* When no deal: the card is absent and the empty Deals section (below) carries the call to action.

**Right column — `SpaceContextRail`:**

1. **Parent property card** at the top — the page's orientation device: photo, name, address, type badge, availability headline + bar, link *View all spaces* → the Spaces tab.
2. `Accordion multiple variant="inline"`: **Comps** — *Space-level comps aren't tracked yet.* (shell); **Deals** — the linked child deal as `DealCardById showStatus`, or *No deal on this space yet* with the create action (this is where deliverable 4's "surface the existing relationship" lands); **Contacts** — the in-place tenant name from the unit as a plain row when present, else *No contacts linked to this space yet.* (shell).

Presentational shells only, per scope. No space-level comps, activity, or contact wiring.

---

## 7b. Contacts on a property and a space (added in review, 2026-09-10)

Production keeps contact roles on the **property**: the property record's Contacts tab has an Add Contact modal (search the book or create someone; a role from Owner / Landlord, Owner Agent, Owner Contact, Owner / User, Tenant, Tenant Contact, Tenant Agent, Buyer, …; visibility), and a deal's Contacts tab shows its own Seller / Buyer parties plus the connected property's contacts with their property role. Zach confirmed on production that adding a Seller to a deal does **not** attach them to the property. The prototype mirrors that:

- **Model.** `Contact.propertyLinks?: { propertyId, role: PropertyContactRole, unitId? }[]` beside the existing `propertyIds`, which every reader still joins on and which `linkContactToProperty` keeps in step. A contact with ids and no links reads as one building-level link per id with a role derived from its book role (`propertyContacts.ts`), so seeded records need nothing. `SEED_VERSION` 80.
- **Roles split by level.** Owner-side roles and `lender` describe the building and are **inherited by every space**; the tenant-side roles describe one suite and carry a `unitId`; `buyer` is a deal fact and is never inherited. The space modal offers only tenant-side roles.
- **Space contacts** = the unit's own links, then the deal's tenant party when nobody has attached them to the unit yet (tagged *Deal*), then inherited owner-side contacts (tagged *Property*). The lease-shell fixtures link each Under Contract / Leased suite's tenant to its unit.
- **Deal rail** gains a *Property contacts* section: the property's contacts minus the deal's own parties, each with their property role. Suite-scoped contacts are scoped by deal shape — a **shell shows none** (it delegates each suite to its space deal, where the tenant is a party), a **space deal shows only its own suite's**, a **sale or flat lease shows every suite's** (in-place tenants matter to a buyer). The rail's Tenant section now also reads `tenantContactIds`, the list a space's accepted tenant lives on.
- **Deal parties stay deal-only.** `linkContactToDeal` is unchanged and writes nothing to the property.

## 8. Deal linkage

### 8.1 Property has a lease shell that can take a space

Same call the deal directory's *Start a deal* makes: `addSpaceToDeal(shell.id, unitId)` → navigate to `/listings/{shell}/spaces/{child}/details`. The shell is found by `leaseShellForProperty(propertyId)` in `propertySpaces.ts`: top-level `dealType === 'Lease'`, `dealSide === 'seller'`, `canAddSpaces(shell)`; prefer one that already has children, else the most recently created. Two candidates that both qualify is **Q10**.

If a shell exists but `canAddSpaces` is false (Closed, Lost, or tenant-rep), the button is disabled with a `Tooltip`: *This building's lease assignment is {Lost}; reopen it to add spaces.*

### 8.2 Property has **no** lease shell yet — the case the PRD asked about

A space deal is always a child in this model (`dealShape`); there is no such thing as a space deal without a shell. So the shell has to come into being. Two honest ways were considered; **(C) is the decision** (Zach, 2026-09-09):

- **(C) Decided — through the Create Deal modal, pre-scoped.** `useCreateDeal.openFor({ property, lockLease: true, spaceUnitId })`. The modal opens on the Lease tab (Sale tab disabled with the reason), *Whole building* on and locked, with a `Banner variant="info"`: *This starts {Property}'s lease assignment. {Space} is added to it as its first space when you finish.* The broker still picks the things the seed cannot guess — the broker, the landlord contact, the starting stage. On create, the modal calls `addSpaceToDeal(created.id, spaceUnitId)` and navigates to the child's `details` instead of the shell's overview. One flow, two records, nothing silent.
- **(A) Rejected — create the shell silently.** `createProposalListing({ ...emptyDraft(), dealType: 'Lease', dealSide: 'seller', propertyId, brokerId: currentUser })` then `addSpaceToDeal`. One click, but it invents a landlord-less, broker-defaulted building assignment the broker never saw, and that record then sits on the Deals board.

(C) costs a small extension to `useCreateDeal` (two optional fields) and one post-create branch in `CreateDealModal`. Two details to pin at implementation: the Banner is `variant="info"` with a duotone `faCircleInfo` per the icons rule, and if the broker cancels the modal nothing is created — the space stays unworked and the button stays live.

### 8.3 From the deal side

The existing relationship already renders on the new pages (roster's Linked-deal column, the space page's Deals section and header). The reverse crossing is added in two places, both via `spaceAssetLink`: a *Property record* row in the deal-side space's `DealContextRail` beneath *Linked property*, and a `faBuilding` ghost icon-button in `SpaceDetailHeader`'s action cluster. Both are one `Link` each; no layout change.

### 8.4 Sale deals on a unit

A Sale deal with `unitId` (a condo, a pad) is not a lease child and does not feed availability. It appears in the Overview's Deals section like any deal on the property. **Q13.**

---

## 9. Seed fixtures — `SEED_VERSION` 78 → 79

Deterministic, faker-free post-pass in a new `src/data/propertySpaceFixtures.ts`, applied in `generateDataset` after `applyLeaseSpaces`. Each fixture is named so a test can find it.

| Shape | Fixture | What it exercises |
|---|---|---|
| **Zero spaces** | `trackedProperties[0]` → `units: []` | Header falls back to `property.status` (null → no badge); Spaces tab shows the `Empty`; the modal's first add |
| **Single space** | `trackedProperties[1]` → one unit, `occupied`, tenant *Halvorsen Dental*, expires +300d | Headline is the bare status `Occupied`; no bar |
| **Uniform, no deal** | `trackedProperties[2]` → four units, all `vacant` | `Vacant · 4 spaces`; **the no-shell create-deal flow** (§8.2) — the property has no deal at all |
| **Uniform, all leased** | ~~new `ShellSpec` on the closed Lease entry~~ **Dropped in implementation:** deal 113's property is multifamily (residential units fail the shell test and the modal blocks Lease there), and 122 is the pipeline's only Lost lease. The helper's uniform-Leased path is unit-tested in `propertySpaces.test.ts`. | — |
| **Mixed** | existing shells 107 (6 spaces, one per state) and 102 (5, two brokers) — unchanged | `Available · 1 of 6 spaces`; the locked-row case on 102 |
| **Density, 24 spaces** | `trackedProperties[3]` → 24 units over 6 floors, labels `Suite 101…604`, 16 occupied with tenants from a fixed pool, 8 vacant scattered so the vacancies interleave by floor | Roster at density; the floor-then-label sort; `Vacant · 8 of 24 spaces` |

Why the density building is a *tracked* property and not a shell: giving it 24 child deals would need either the pipeline's only Lost Lease entry forced `active` or a 25th `DEAL_PIPELINE` row (which moves `PROPERTY_COUNT` and the hero claims). A no-deal tower is the honest density case for an *asset* roster, and it doubles as a second no-shell fixture.

**Test impact:** `seed.test.ts:176` asserts every property has ≥1 unit. The zero-space fixture breaks it by design. Narrow the invariant to deal-bearing properties plus prospects, and add an explicit assertion that exactly the named fixture has none. Alternative if that invariant is load-bearing for something I didn't find: give the fixture a lone `WHOLE_PROPERTY_LABEL` stub instead (the roster already filters it). **Q5.**

`leaseSpaceFixtures.ts` gains nothing but one `SHELL_SPECS` entry. The tracked-property fixtures don't touch rent rolls because tracked properties have no deals.

---

## 10. Vocabulary

**Space / Spaces** is the word on every property-side surface: tab, strip, roster, modal, page, empty states, toasts. Never "unit" or "suite" as the object — those are label content.

The deal side already calls its tab *Spaces* but its copy says "suite" (`No suites on this property yet`, `Add a suite to…`, `Suites already on the property…`). **Decided (Q9):** a copy-only pass on `$listingId/spaces.tsx` and `AddSpaceModal` to *space* ships in this branch (commit 6) so the two rosters agree. Text only; no behaviour, no identifiers — `buildingSuites`, `SuiteRow`, `suiteStatus` keep their names, since renaming code for a copy change is churn the invariant tests would have to follow.

`Vacant` and `Occupied` keep their deal-directory meaning. `Under LOI` and `Off Market` from the PRD are not introduced anywhere.

---

## 11. Verification

**Vitest** (the logic; no committed E2E):

- `propertySpaces.test.ts` — `spaceStatus` deal-wins rule; whole-property exclusion; top-level deals never claim a unit (a seeded deal property's first suite is `Vacant`, not the building's stage); precedence and `formatAvailabilityHeadline` for zero / one / uniform / mixed; sort order incl. `null` floors last and numeric labels; `isDuplicateSpaceLabel` case/whitespace; `leaseShellForProperty` preference.
- `propertySpaceRoute.test.ts` — null for a unit from another property; null for a dangling id.
- `propertyNavRoutes.test.ts` — nav ↔ route files.
- `store.test.ts` — `addPropertyUnit` with and without `suite`/`floor`; `updatePropertyUnit` patches only the named unit.
- `actions.test.ts` — **the write-through**: `saveSpaceDetails` with a changed `ceilingHeight` updates both `space.marketing.spaceLeaseTerms[0]` and `property.units[i]`; a changed `leaseRate` or `spaceName` touches the deal only; `propertySpaces()` read afterwards shows the new physical value.
- `seed.test.ts` — the six fixtures by name; the narrowed unit invariant.
- `dealCardLink.invariant.test.ts` — still green with `spaceAssetLink` added.

**Playwright** (breakage only — Zach reviews design): `/properties/{107's property}` redirects to `/overview`; Spaces tab renders 6 rows in precedence order with one Linked-deal link per worked suite; density fixture renders 24 rows; `+ Add Space` → duplicate label blocked → valid add appears sorted and the header count moves without reload; `/properties/{p}/spaces/{unitId}` renders and *Open deal* lands on the child's `details`; `Create deal from this space` on the no-deal tracked property opens the modal locked to Lease (if Q1 = C) and finishes on the new child's `details`; on shell 107, change a suite's floor on the deal's Details, Save, then open the property's Spaces tab and see the new floor in the row; a bad `unitId` renders *Space not found*; zero console errors throughout. Scope selectors to `main.app-shell__main`; wait on text unique to the destination; close the browser.

**Ship gates:** `bunx tsc --noEmit`, `bun --bun run test`, a `docs(changelog)` entry (CI-enforced), and the `chore(docs)` commit that deletes this spec and its plan.

---

## 12. Suggested commit order (one branch, reviewable steps)

1. `feat(data)`: `propertySpaces.ts` + `propertySpaceRoute.ts` + tests; `addPropertyUnit` widening + `updatePropertyUnit`; `saveSpaceDetails` write-through + test; `spaceAssetLink`.
2. `seed`: fixtures module, the closed-Lease `ShellSpec`, `seed.test` changes, `SEED_VERSION` 79.
3. `feat(properties)`: layout route, redirect, `PropertyRecordSidebar`, reworked header, Overview with the accordion rail, `usePropertyDetail`.
4. `feat(properties)`: Spaces tab — strip, bar, roster, `CreateSpaceModal`.
5. `feat(properties)`: the space asset page.
6. `feat(deals)`: `SpaceDetails.tsx` saves through `saveSpaceDetails`; create-from-space via the pre-scoped modal (§8.2 C); the two deal-side back-links; the suite → space copy pass (§10).
7. `docs(changelog)` + `chore(docs)` spec delete.

---

## 13. Open questions — all resolved 2026-09-09

Zach took Q1 (C), Q7 (editable + write-through) and Q9 (yes) explicitly, and accepted the recommendation column for every other row. Kept for the record of *why*; the PR body inherits the ones worth keeping.

| # | Question | My recommendation |
|---|---|---|
| **Q1** | *Resolved:* **(C)** — the pre-scoped Create Deal modal adds the space on completion (§8.2). | — |
| **Q2** | Status vocabulary on the asset side is `spaceAvailability`'s (`Available/Under Contract/Leased/Not advertised`), which #130 moved the *deal* directory off. Confirm the asset roster is the right home for it, with the deal's stage shown in the Linked-deal column. | Yes, for the three reasons in §3.1. If not, the roster's Status column becomes `SuiteStatus` and the property headline needs a different word than the stage badge beside it. |
| **Q3** | With `Not advertised` last, the just-split building (shell 104: 3 Inactive children + 1 occupied) headlines **`Occupied · 1 of 4 spaces`**, not `Not advertised · 3 of 4`. Is that acceptable, or should `Not advertised` outrank `Occupied`? | Accept as specified. `Not advertised` is a marketing fact about a parked deal; `Occupied` is an asset fact. But it reads oddly on 104 and Zach should see it in the browser before deciding. |
| **Q4** | A **Lost** child deal on a physically vacant unit reports `Not advertised` (deal-wins), hiding that the space is vacant and re-workable. Keep the rule for consistency with `buildingSuites`, or let `inactive` fall through to occupancy? | Keep deal-wins this phase; one rule in two places is worth more than the edge case. Flag for the next pass. |
| **Q5** | Zero-space fixture as `units: []` with `seed.test.ts:176` narrowed, or a lone `WHOLE_PROPERTY_LABEL` stub? | `[]`. It's the shape the code must handle anyway, and a prospect with an unknown breakdown is real. |
| **Q6** | The `{Property}` breadcrumb on the space page: land on the property's **Spaces tab** or its **Overview**? | Spaces tab — it's where the broker came from and where the sibling spaces are. One-line change either way. |
| **Q7** | *Resolved in review:* physical facts are editable on the asset page and the deal's Details writes them through (§2.1). **Still open:** should phase 2 remove the seven physical copies from `SpaceLeaseTerms` entirely so the deal reads the unit? | Yes, as a follow-up — it deletes the last place the two could disagree, but it touches the publish preview, website copy and fixtures, so not this branch. |
| **Q8** | Consolidate the deal-side `AddSpaceModal` onto `CreateSpaceModal` (`onCreated` → `addSpaceToDeal`)? | Follow-up, not this branch. Their copy differs on purpose and #128's modal is stable. |
| **Q9** | *Resolved:* **yes** — the deal-side suite → space copy pass ships in this branch (§10). | — |
| **Q10** | Two eligible lease shells on one property (not a seeded case): prefer the one with children, else newest? Or ask? | Prefer-with-children, else newest, and note it in the helper's doc. Not worth a picker for a case the seed can't produce. |
| **Q11** | Status colours — the §5.5 token mapping, especially Vacant = `--stage-proposal` amber and Occupied one grey lighter than Not advertised. | Design call; the mapping is isolated to `SPACE_STATUS_COLORS`. |
| **Q12** | Should the Properties index list row show the derived headline in place of / beside `property.status`? | Out of scope per the PRD's exclusions; noted as the obvious next surface because `statuses` is already the filterable set. |
| **Q13** | Top-level deals never claim a unit (§3.4), so a Lease created via Create Deal with a unit picked won't appear as that unit's deal on the roster. Accept, or should `attachAs: 'space'` on a Lease start creating shell + child? | Accept this phase. Changing what `attachAs: 'space'` creates is a Create Deal design question, not a Spaces one. |
| **Q14** | The property page has no access gate today; the roster gates only the *link* on a locked suite (asking rent stays visible, matching the deal directory). Correct? | Yes — rent is marketing, and the directory already shows it on locked rows. |
