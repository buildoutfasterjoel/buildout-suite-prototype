# Spaces on the Property Record — Implementation Plan

> Work task-by-task, in order. Every task ends with `bunx tsc --noEmit` and `bun --bun run test` green (see *Gates* below for the two known noises). Steps use `- [ ]` for tracking. Do not commit until Zach has reviewed; batch commits before the PR.

**Goal:** The Property record becomes the place you see every space in a building and what's happening with each: a Spaces tab with a derived-availability roster, a property-level availability headline, an asset page per space, a Create Space modal, and a "Create deal from this space" flow.

**Architecture:** Nothing is added to `PropertyUnit`. A new property-keyed helper `propertySpaces.ts` derives each space's status from its child deal (else occupancy) and rolls the set up by precedence. `/properties/$propertyId` becomes a layout route (top rail + 180px section nav + `Outlet`) with `overview` and `spaces` children; the space asset page lives at `$propertyId_/spaces/$unitId` and escapes the layout via the trailing underscore. Physical facts get one home — the unit — by a write-through from the deal's Details save.

**Tech Stack:** React 19 · TypeScript · TanStack Start / Router (file routes) · Zustand + IndexedDB · Vitest · Blueprint React · FontAwesome Pro

**Design spec:** `docs/superpowers/specs/2026-09-09-spaces-on-property-design.md` — section numbers below (§) refer to it.

---

## Global Constraints

- **Bun.** `bun --bun run <script>`. Tests: `bun --bun run test`. Typecheck: `bunx tsc --noEmit` (`vite build` does **not** type-check).
- **`src/routeTree.gen.ts` is generated, never edited.** It regenerates only on `dev`/`build`. After adding route files, run `bun --bun run build` (or start the dev server) **before** `tsc`, or the new `Route` ids won't exist and `createFileRoute("…")` literals fail to type.
- **Blueprint only, `ui` subpath imports.** Bootstrap utilities for layout. **`fs-7` does not exist** — the scale is `fs-6` (20) then `fs-large` 17 · `fs-body` 14 · `fs-small` 12 · `fs-xs` 10.
- **Blueprint `Field` parts need a `Field` root.** Detached helper text is `<div className="form-text">`.
- **Icons:** `pro-regular` everywhere; `pro-duotone` only inside `Alert`/`Banner`. Never `fixedWidth`.
- **`Link` takes a typed route literal**; interpolated strings go only through `navigate({ to })`. A union of `{to, params}` objects does **not** narrow into `navigate` — keep a literal `to` at `navigate` sites (`dealCardLink.ts` doc).
- **No store reads in `beforeLoad`** (`cf5676c`). Redirects are param → param only. Guards render `null`/`Empty`, never redirect.
- **The seed post-pass is faker-free.** `propertySpaceFixtures.ts` must not import `faker` or draw from it; a single draw shifts every downstream pinned value.
- **`SEED_VERSION` moves** (`src/data/persistence.ts`, 78 → 79) in the same change as the fixtures, or IndexedDB serves the old snapshot and the browser looks like a code bug.
- **No committed E2E.** Browser checks are interactive via the `playwright` MCP. Never `networkidle`; scope selectors to `main.app-shell__main`; wait on text unique to the destination; **never wipe IndexedDB on a live page** mid-run; `browser_close` when done.
- **Never pair `Foo.tsx` with `foo.ts`** in one directory (macOS case-insensitive resolution breaks rollup).
- **No `Co-Authored-By` trailers** in commits.

### Gates — what "green" means here

- `bunx tsc --noEmit`: compare against `main`'s output. Three pre-existing, unrelated errors exist on `main` (memory: *known tsc errors*); anything **new** is yours.
- `bun --bun run test`: the biome indent noise and one react/module stderr line are not failures. Vitest's globs also pick up stale nested-worktree copies, so when a test you edited seems to disagree with its file, **confirm the path Vitest printed is the real tree**.

---

## File Structure

**New — data (pure, Vitest-covered):**
- `src/data/propertySpaces.ts` — `SpaceStatus`, `SPACE_STATUS_PRECEDENCE`, `spaceStatus()`, `SpaceRow`, `propertySpaces()`, `PropertyAvailability`, `propertyAvailability()`, `formatAvailabilityHeadline()`, `isDuplicateSpaceLabel()`, `leaseShellForProperty()`
- `src/data/propertySpaces.test.ts`
- `src/data/propertySpaceRoute.ts` — `resolvePropertySpaceRoute()`; `src/data/propertySpaceRoute.test.ts`
- `src/data/propertySpaceFixtures.ts` — `applyPropertySpaceFixtures(trackedProperties)` + named fixture ids

**New — components (`src/components/properties/`):**
- `propertySpaceDisplay.ts` — `SPACE_STATUS_COLORS`, `UNIT_TYPE_LABELS`, `formatAskingRent()`, `SpaceStatusDot`
- `propertyNav.ts` + `propertyNavRoutes.test.ts`
- `PropertyRecordSidebar.tsx`, `PropertyAvailabilityBar.tsx`, `PropertyOverviewRail.tsx`, `SpacesSummaryStrip.tsx`, `SpacesRoster.tsx`, `CreateSpaceModal.tsx`, `SpaceRecordHeader.tsx`, `SpaceFactsCard.tsx`, `SpaceLeaseTermsCard.tsx`, `SpaceContextRail.tsx`, `usePropertyDetail.ts`, `usePropertySpaceRoute.ts`

**New — routes:**
- `src/routes/_shell/properties/$propertyId/index.tsx` (redirect), `overview.tsx`, `spaces.tsx`
- `src/routes/_shell/properties/$propertyId_/spaces/$unitId.tsx`

**Modified:**
- `src/routes/_shell/properties/$propertyId.tsx` → layout
- `src/data/store.ts` — `addPropertyUnit` widened; `updatePropertyUnit` added
- `src/data/actions.ts` — `saveSpaceDetails` (write-through)
- `src/data/leaseSpaceFixtures.ts` — one new `SHELL_SPECS` entry
- `src/data/seed.ts` — call `applyPropertySpaceFixtures`; `src/data/seed.test.ts` — narrowed unit invariant + fixture assertions
- `src/data/persistence.ts` — `SEED_VERSION` 79
- `src/data/useCreateDeal.ts` (+ test) — `spaceUnitId`, `lockLease`
- `src/components/deals/CreateDealModal.tsx` — locked-Lease notice + post-create branch
- `src/components/deals/SpaceDetails.tsx` — saves through `saveSpaceDetails`
- `src/components/deals/dealCardLink.ts` — `spaceAssetLink`; `dealCardLink.invariant.test.ts` — allowlist if a `/listings/` builder is added
- `src/components/deals/DealContextRail.tsx`, `SpaceDetailHeader.tsx` — property-record back-links
- `src/components/properties/PropertyRecordHeader.tsx` — reworked (breadcrumb, headline, bar)
- `src/routes/_shell/listings/$listingId/spaces.tsx`, `src/components/deals/AddSpaceModal.tsx` — copy pass suite → space
- `src/components/changelog/changelogEntries.ts` — entry

**Absorbed (deleted once nothing imports them):** `PropertyDealsPanel.tsx`, `PropertyOwnersCard.tsx` → bodies move into `PropertyOverviewRail.tsx`.

---

## Task 1: `propertySpaces.ts` — the derived-availability helper (§3)

**Files:** create `src/data/propertySpaces.ts`, `src/data/propertySpaces.test.ts`

- [ ] `SpaceStatus = SpaceAvailability | 'Occupied' | 'Vacant'` (import `SpaceAvailability`, `spaceAvailability` from `./dealShape`). Doc comment states it is deliberately **not** `SuiteStatus` and why (§3.1); add the reciprocal sentence to `buildingSuites.ts`'s `SuiteStatus` doc.
- [ ] `spaceStatus(deal, unit)` — deal wins via `spaceAvailability(deal.status)`, else occupancy.
- [ ] `SPACE_STATUS_PRECEDENCE` — `['Available','Under Contract','Vacant','Leased','Occupied','Not advertised']`, with the "what can a broker do next" rationale in the doc.
- [ ] `childDealsByUnit(propertyId)` (module-private): every listing with `propertyId === id && parentDealId != null && unitId` → `Map<unitId, Listing>`. **Top-level deals never enter the map** (§3.4) — say so in the comment, citing `seed.ts:2138`.
- [ ] `leaseShellForProperty(propertyId): Listing | null` — top-level, `dealType === 'Lease'`, `dealSide === 'seller'`, `canAddSpaces()`; prefer one with children (`getChildDeals().length > 0`), else newest `createdAt`.
- [ ] `propertySpaces(propertyId): SpaceRow[]` — walk `property.units`, skip `WHOLE_PROPERTY_LABEL` (import from `./createListing`, as `buildingSuites` does), left-join; terms = `deal.marketing.spaceLeaseTerms?.[0]` else `shell?.marketing.spaceLeaseTerms?.find(unitId)`; `tenantName = terms?.tenantName?.trim() || unit.tenantName`; `shellId = deal?.parentDealId ?? null`. Sort **here**: precedence rank → `floor` asc, nulls last → `label` with `localeCompare(…, 'en', { numeric: true })`.
- [ ] `propertyAvailability(propertyId): PropertyAvailability | null` — null when no rows; `counts`, `statuses` (Set), `headline` = first precedence entry with count > 0, `headlineCount`, `uniform`, `totalSqft`, `availableSqft` (Available + Vacant).
- [ ] `formatAvailabilityHeadline(a)` — `"Available"` / `"Leased · 6 spaces"` / `"Available · 3 of 6 spaces"`. Singular `space` for 1 is unreachable (1 → bare status) — assert that in a test rather than branch for it.
- [ ] `isDuplicateSpaceLabel(property, label, excludeUnitId?)` — trim + `toLocaleLowerCase()`; checks **all** units including the whole-property stub.
- [ ] Tests, using the `buildingSuites.test.ts` pattern (`createProposalListing` + `addPropertyUnit` + `addSpaceToDeal` + `commitStageTransition`): deal-wins; occupancy fallback; stub excluded; **a top-level deal's `unitId` does not claim the unit** (create a flat Lease via `createProposalListing({ attachAs:'space', unitId })` and assert the row is `Vacant`); each headline shape (0 → null, 1, uniform, mixed); precedence picks Vacant over Leased; sort with a null floor and `Suite 20` vs `Suite 100`; duplicate label case/whitespace and `excludeUnitId`; `leaseShellForProperty` prefers the shell with children and returns null for a Sale-only property.

**Gate:** tsc + tests.

---

## Task 2: Route resolver + the asset link (§4.1, §4.2 rule 2)

**Files:** create `src/data/propertySpaceRoute.ts`, `src/data/propertySpaceRoute.test.ts`; modify `src/components/deals/dealCardLink.ts`

- [ ] `resolvePropertySpaceRoute(propertyId, unitId): { property, unit, row: SpaceRow } | null` — `getProperty`, find unit in `property.units`, `row = propertySpaces(propertyId).find(...)`. Doc: null-not-redirect (`cf5676c`); cannot cross properties because the lookup is inside `property.units`.
- [ ] Tests: dangling unit id → null; a unit id from *another* property → null; a real one → row with matching status.
- [ ] `spaceAssetLink(propertyId, unitId): { to: "/properties/$propertyId/spaces/$unitId"; params }` in `dealCardLink.ts`, doc'd as the one rule for the asset-side crossing. (Type-checks only after Task 8's route file exists — write it now with the literal, expect tsc to fail on it until then, **or** add it in Task 8. Prefer adding it in Task 8 to keep every task green.)
- [ ] Read `dealCardLink.invariant.test.ts`'s allowlist. No `/listings/` builder is added in this task; note for Task 10 that the back-links go through `dealCardLinkProps` / typed `Link`s and so need no allowlist entry.

**Gate:** tsc + tests.

---

## Task 3: Store + the write-through (§2, §2.1)

**Files:** modify `src/data/store.ts`, `src/data/actions.ts`, `src/components/deals/SpaceDetails.tsx`; tests in `store.test.ts`, `actions.test.ts`

- [ ] `addPropertyUnit(propertyId, { label, sqft, unitType, suite?, floor? })` — optional keys default to `null`. Existing callers unchanged.
- [ ] `updatePropertyUnit(propertyId, unitId, patch: Partial<Omit<PropertyUnit,'id'>>): PropertyUnit | undefined` — map over units, persist via `updateProperty`.
- [ ] `saveSpaceDetails(spaceId, { terms, availableSqFt })` in `actions.ts`: (1) `updateDealMarketing(spaceId, { spaceLeaseTerms: [terms], availableSqFt })` exactly as `SpaceDetails.save` does today; (2) resolve `space.propertyId` + `space.unitId`; (3) `updatePropertyUnit` with the physical keys only: `suite` (`terms.suite ?? null`), `floor`, `ceilingHeight`, `offices`, `conferenceRooms`, `furnished` (`?? false`). **Not** `spaceName`, `tenantName`, `spaceType`, `availableSqFt` (§2.1 table). Doc comment names §2.1's rule and the seed's unit → terms direction so the next reader sees both arrows.
- [ ] `SpaceDetails.tsx` `save()` → `saveSpaceDetails(space.id, draft)`. Nothing else in the component changes.
- [ ] Tests: `updatePropertyUnit` patches only the named unit; `saveSpaceDetails` with `ceilingHeight: 14` updates `units[i].ceilingHeight` **and** `spaceLeaseTerms[0].ceilingHeight`; `leaseRate` / `spaceName` change leaves the unit untouched; `propertySpaces()` afterwards reflects the new value.

**Gate:** tsc + tests.

---

## Task 4: Seed fixtures + `SEED_VERSION` 79 (§9)

**Files:** create `src/data/propertySpaceFixtures.ts`; modify `src/data/leaseSpaceFixtures.ts`, `src/data/seed.ts`, `src/data/seed.test.ts`, `src/data/persistence.ts`

- [ ] `propertySpaceFixtures.ts` exports `PROPERTY_SPACE_FIXTURES` (ids by role: `zeroSpaces`, `singleOccupied`, `uniformVacant`, `density`) and `applyPropertySpaceFixtures(tracked: Property[])`. Faker-free; deterministic tenant pool; unit ids `unit-fx-<role>-<n>`.
  - `tracked[0]` → `units = []`
  - `tracked[1]` → one unit, `occupied`, tenant *Halvorsen Dental*, `leaseExpiration = isoDate(300)` (reuse `isoDate` from `leaseSpaceFixtures.ts`)
  - `tracked[2]` → four units, all `vacant`, labels `Suite 100…400`, floors 1–4
  - `tracked[3]` → 24 units, floors 1–6 × 4, labels `Suite ${floor}0${n}` (`101…604`), `suite` = the number, 16 occupied from a fixed tenant pool, vacant at indices `{2, 5, 9, 12, 14, 18, 21, 23}` so vacancies interleave by floor. `sqft` = `Math.round(buildingSqFt / 24)`.
  - Every unit gets the full `PropertyUnit` shape (`saleHistory: []`, `beds/baths: null`, etc.) — `tsc` enumerates the keys.
- [ ] `seed.ts`: call `applyPropertySpaceFixtures(trackedProperties)` right after `trackedProperties` is built (line ~2789), **before** `properties` is spread. Tracked properties have no deals, so no rent-roll rebuild is needed.
- [ ] `leaseSpaceFixtures.ts`: add a `ShellSpec` for the pipeline's **closed Lease** entry (`DEAL_PIPELINE`'s `{ stage:'closed', dealType:'Lease', voucherStatus:'Draft' }` — resolve its `dealId` by reading how ids are assigned; do not guess). `suiteProportions: [0.36, 0.33]`, `childStages: ['closed','closed','closed']`, `occupiedSuites: []`, `shellStatus: 'active'`. Check `leaseSpaceFixtures.test.ts` for anything pinning the spec count or that dealId's shape and update it.
- [ ] `seed.test.ts:176`: narrow *every property has ≥1 unit* to properties that carry a deal; add a `describe('property space fixtures')` asserting: the zero-space fixture has `units.length === 0`; the single one is `occupied` with a tenant; the uniform one has 4 vacant; the density one has 24 units, 6 distinct floors, 16 occupied; the closed-Lease shell has 3 children all `closed`.
- [ ] `persistence.ts`: `SEED_VERSION = 79`.

**Gate:** tsc + full test run (seed tests are the slow ones — this is the task where a stray faker draw shows up as twenty unrelated failures).

---

## Task 5: Display primitives (§5.4, §5.5)

**Files:** create `src/components/properties/propertySpaceDisplay.ts`, `PropertyAvailabilityBar.tsx`

- [ ] `SPACE_STATUS_COLORS: Record<SpaceStatus, string>` — `Available: 'var(--stage-active)'`, `'Under Contract': 'var(--stage-under-contract)'`, `Leased: 'var(--stage-closed)'`, `'Not advertised': 'var(--stage-inactive)'`, `Vacant: 'var(--stage-proposal)'`, `Occupied: 'var(--bp-storm-grey-400)'` — verify the grey token name against `styles/colors.mdx` (Blueprint's prefix is `--bp-`, not `--bs-`) before committing to it; fall back to a `storm-grey-400` utility class on the dot if no CSS var exists.
- [ ] `UNIT_TYPE_LABELS: Record<UnitType, string>` — `Residential / Office / Retail / Industrial / Other`.
- [ ] `formatAskingRent(rate: number | null, units: LeaseRateUnits): string | null` — `$48.00/SF/yr`, `/SF/mo`, `/mo`; `null` → caller renders `—`.
- [ ] `SpaceStatusDot({ status })` — 8px `rounded-circle d-inline-block` + label, the `ContactsTable` `Dot` convention; `aria-hidden` on the dot.
- [ ] `PropertyAvailabilityBar({ availability })` — returns null when `spaceCount <= 1`; flex row, `height: 6`, `borderRadius: 4`, `gap: 2`, segment `flex: count`, colours from the map, segments in precedence order; wrapped in Blueprint `Tooltip` whose content lists non-zero counts in precedence order joined by ` · `. `role="img"` + `aria-label` = the same text.

**Gate:** tsc.

---

## Task 6: Property record restructure — layout, nav, header, Overview (§5.1–5.3)

**Files:** modify `src/routes/_shell/properties/$propertyId.tsx`, `PropertyRecordHeader.tsx`; create `$propertyId/index.tsx`, `$propertyId/overview.tsx`, `propertyNav.ts`, `propertyNavRoutes.test.ts`, `PropertyRecordSidebar.tsx`, `PropertyOverviewRail.tsx`, `usePropertyDetail.ts`; delete `PropertyDealsPanel.tsx`, `PropertyOwnersCard.tsx` when unreferenced

- [ ] `usePropertyDetail(id)` — subscribe to `properties`, `listings`, `contacts`, `comps` maps (`void useDataStore(...)` × 4, the `useSpaceRoute` pattern), then return `getPropertyDetailClient(id)`.
- [ ] `propertyNav.ts` — `PROPERTY_NAV_ITEMS: NavItem[]` (`Overview` → `faGaugeHigh`, `Spaces` → `faVectorSquare`; reuse `NavItem` from `dealNav.ts`) and `propertySectionLabel(pathname, propertyId): string | null` (segment after the id, looked up in the items).
- [ ] `propertyNavRoutes.test.ts` — clone `spaceNavRoutes.test.ts`: every nav `href` has a route file in `routes/_shell/properties/$propertyId/`, every non-`index` route file is in the nav.
- [ ] `PropertyRecordSidebar({ propertyId, activeLabel })` — one `Tabs orientation="vertical"` + `Tabs.List variant="pills" orientation="vertical"`, `onValueChange` → `navigate({ to: \`/properties/${propertyId}/${href}\` })`. No groups, no collapse, no localStorage.
- [ ] `$propertyId.tsx` becomes the layout: `usePropertyDetail` → not-found `Empty` (keep the existing one) → `h-100 overflow-y-auto overflow-x-hidden` → `<PropertyRecordHeader property availability sectionLabel />` → `container d-flex align-items-start gap-4 py-4` → sticky 180px `Card` with the sidebar → `Card flex-grow-1 shadow` `minWidth: 0` with `<Outlet />`. Keep `head()`.
- [ ] `$propertyId/index.tsx` — `beforeLoad: ({ params }) => { throw redirect({ to: '/properties/$propertyId/overview', params, replace: true }) }`. **No store read.**
- [ ] `PropertyRecordHeader` rework: 164px thumbnail column (`getPhotoUrl(property.id, 328, 200)`), `Breadcrumb` (`Properties` with `faBuilding` → `/properties`; property name as `Link` to `/properties/$propertyId` when a section label exists, else `Breadcrumb.Page`; section as `Page`), h1 `fs-5 fw-semibold`, address, badge row: type icon+label · existing `property.status` badge · **availability headline** as `SpaceStatusDot` + `formatAvailabilityHeadline` · `PropertyAvailabilityBar` (width ~120). Zero spaces → headline and bar absent. Right: `Create Deal` primary, unchanged.
- [ ] `overview.tsx` — `usePropertyDetail`; `d-flex align-items-stretch`: main column (`flex-grow-1`, `p-4`) renders `PropertyFactsCard`'s groups in two columns (extract the `groups` builder from `PropertyFactsCard` into `propertyFactGroups(property)` so both the card and the wide layout share it); right column `flex-shrink-0 d-none d-xl-block border-start` width 340 → `PropertyOverviewRail`.
- [ ] `PropertyOverviewRail({ property, deals, contacts, comps })` — `Card.Body` with `Accordion multiple variant="inline" defaultValue={['comps','deals','contacts']}`; triggers carry the muted count `Badge`; bodies are the moved `PropertyDealsPanel` list (+ *New deal* button) and `PropertyOwnersCard` lists verbatim. Delete the two old files once unreferenced (`grep -rn PropertyDealsPanel src`).
- [ ] Run `bun --bun run build` to regenerate `routeTree.gen.ts`, then tsc + tests. All eight existing `to: "/properties/$propertyId"` sites still type-check (the route id is unchanged; only its children are new).

**Browser check (quick):** `/properties/{any id}` → lands on `/overview`; sidebar shows two pills; header unchanged for a zero-space property.

---

## Task 7: Spaces tab — strip, roster, Create/Edit Space modal (§5.4, §6)

**Files:** create `$propertyId/spaces.tsx`, `SpacesSummaryStrip.tsx`, `SpacesRoster.tsx`, `CreateSpaceModal.tsx`

- [ ] `spaces.tsx` — subscribe to `properties` + `listings`; `rows = propertySpaces(propertyId)`, `availability = propertyAvailability(propertyId)`; `const [modal, setModal] = useState<{ mode:'create' } | { mode:'edit'; unit } | null>(null)`. Renders strip → roster or `Empty` (`faVectorSquare`, *No spaces on this property yet*, single `+ Add Space` action) → modal.
- [ ] `SpacesSummaryStrip({ availability, onAddSpace })` — left text per §5.4 (`3 of 6 spaces available · 24,500 SF available` when headline is Available/Vacant, else `6 spaces · 24,500 SF`), bar, `+ Add Space` primary with `faPlus`. Renders only when `availability` is non-null (the empty state carries the add button otherwise).
- [ ] `SpacesRoster({ rows, propertyId })` — Blueprint `Table`; columns exactly §5.4's table. `useOpenableSpaces(shellId)` is per-shell: compute once per distinct `shellId` in the rows (a tiny `useOpenableSpacesFor(shellIds)` wrapper or call per row — rows are ≤ 24, per-row is fine; keep it simple). Row: `onClick` → `navigate({ to: '/properties/$propertyId/spaces/$unitId', params })`, `style={{ cursor:'pointer' }}`, `role="link"`, `tabIndex=0`, Enter key handled. Linked-deal `Link` calls `e.stopPropagation()`. Locked → `DealStageBadge shape="space"` + `faLock`, no link.
- [ ] `CreateSpaceModal({ propertyId, unit?, open, onOpenChange })` — `Modal.Content size="md" centered`; five stacked `Field`s (§6 table); unit-type `Select` over all five `UnitType`s, default from `property.propertyType` (multifamily → residential; office/retail/industrial → same; else other); duplicate check via `isDuplicateSpaceLabel(property, label, unit?.id)` → `Field.Error errors={[…]}`; Add/Save disabled until label + sqft > 0 and no duplicate. Create → `addPropertyUnit` → `notify({ title:'Space added' })`; edit → `updatePropertyUnit` → `notify({ title:'Space saved' })`. Reset local state on open (the `AddSpaceModal` seededOpen pattern).
- [ ] Tests (Vitest, pure): none new beyond Task 1's `isDuplicateSpaceLabel`; the roster's sort is the helper's.

**Browser check:** shell 107's property → 6 rows in precedence order, one linked deal per worked suite; density fixture → 24 rows, floors ascending within a status band; duplicate label blocked inline; a valid add appears in sorted position **and the header headline count moves without reload**.

---

## Task 8: The space asset page (§7)

**Files:** create `src/routes/_shell/properties/$propertyId_/spaces/$unitId.tsx`, `usePropertySpaceRoute.ts`, `SpaceRecordHeader.tsx`, `SpaceFactsCard.tsx`, `SpaceLeaseTermsCard.tsx`, `SpaceContextRail.tsx`; modify `dealCardLink.ts` (add `spaceAssetLink`, deferred from Task 2)

- [ ] Route file: `createFileRoute("/_shell/properties/$propertyId_/spaces/$unitId")`, `head` reads the unit label from `getStore()` (allowed in `head`, as `$listingId.tsx` does). Component: `usePropertySpaceRoute(propertyId, unitId)` (subscribes to `properties` + `listings`, returns `resolvePropertySpaceRoute`) → null → `Empty` *Space not found* with `Back to Spaces` → `/properties/$propertyId/spaces`. Otherwise `h-100 overflow-y-auto` → `SpaceRecordHeader` → `container py-4 d-flex align-items-start gap-4` → main column → 340px rail.
- [ ] `SpaceRecordHeader({ property, unit, row, onEdit })` — thumbnail seeded on `unit.id`; `Breadcrumb`: `Properties` → `/properties`; `{property.name}` → `/properties/$propertyId/spaces`; `Page` = `unit.label`. h1 label; address; badge row: `UNIT_TYPE_LABELS`, `formatSqFt(unit.sqft)`, `SpaceStatusDot`. Actions: *Edit space* ghost icon `faPencil` (`aria-label` on the button); then `Open deal` (`Button variant="secondary" nativeButton={false} render={<Link {...dealCardLinkProps(deal)} />}`) when `row.dealId` and openable; else **`Create deal from this space`** primary `faHandshake` — wired in Task 9; render it disabled with a `Tooltip` *Coming in the next step* until then, or land Tasks 8 and 9 together.
- [ ] `SpaceFactsCard({ unit })` — reuse the `group()` row shape from `PropertyFactsCard` (export it or move it to `propertyDisplay.ts`): Space (label, suite, floor, type, size), Build-out (ceiling height, offices, conference rooms, furnished), Occupancy (occupancy, tenant, lease expiration via `formatMonthYear`).
- [ ] `SpaceLeaseTermsCard({ row, deal })` — only when `deal` and openable: asking rent (`formatAskingRent`), term, min divisible / max contiguous, tenant override, `spaceAvailability(deal.status)`; `Card.Header` right slot: `Edit on deal` `Link` to `/listings/$listingId/spaces/$spaceId/details` (typed literal; params `{ listingId: row.shellId, spaceId: row.dealId }`). Locked deal → muted *Terms are on a deal you don't have access to.* No deal → not rendered.
- [ ] `SpaceContextRail({ property, availability, row, deal })` — parent property card (photo `getPhotoUrl(property.id)`, type, name, address, headline dot + bar, `View all spaces` → Spaces tab) then `Card.Body` + `Accordion multiple variant="inline"`: **Comps** shell text; **Deals** → `DealCardById listingId={row.dealId} showStatus` or *No deal on this space yet* + the create button (same handler as the header); **Contacts** → tenant row or shell text.
- [ ] `spaceAssetLink(propertyId, unitId)` in `dealCardLink.ts`; use it in the roster's row navigation (Task 7 — switch the literal to it now) so there is one builder.
- [ ] Rebuild route tree → tsc → tests (`propertyNavRoutes.test.ts` must **not** scan `$propertyId_` — confirm its directory glob is the `$propertyId/` children only).

**Browser check:** roster row → asset page renders facts; `Open deal` lands on the child's `details`; edit pencil → change floor → header of roster reflects; bad `unitId` → *Space not found*; `/properties/{p}/spaces/{unit of another property}` → *Space not found*.

---

## Task 9: Create deal from this space (§8)

**Files:** modify `src/data/useCreateDeal.ts` (+ `useCreateDeal.test.ts`), `src/components/deals/CreateDealModal.tsx`, `SpaceRecordHeader.tsx` / `SpaceContextRail.tsx`

- [ ] `useCreateDeal`: add optional `spaceUnitId?: string` and `lockLease?: boolean` to state and `openFor`'s ctx; `close()` clears them. Test: `openFor({ property, lockLease: true, spaceUnitId })` sets both; `close()` clears.
- [ ] `createFromSpace(propertyId, unitId, navigate)` — a small handler in `propertySpaces`-adjacent UI code (e.g. `src/components/properties/createDealFromSpace.ts`): `shell = leaseShellForProperty(propertyId)`; if shell → `addSpaceToDeal(shell.id, unitId)` → `navigate({ to: '/listings/$listingId/spaces/$spaceId/details', params })`; else → `useCreateDeal.getState().openFor({ property, lockLease: true, spaceUnitId: unitId })`. Return `{ kind: 'started' | 'modal' | 'blocked', reason? }` — `blocked` when a landlord-rep lease exists but `canAddSpaces` is false (Closed/Lost), with the reason string for the tooltip.
- [ ] `CreateDealModal`: read `spaceUnitId`/`lockLease` from the store. When `lockLease`: initial `dealType = 'Lease'`, Sale tab disabled with tooltip *This space needs a lease assignment*; `wholeBuilding = true` and the unit picker hidden; an `Alert severity="info" withIcon` (duotone `faCircleInfo`) above the form: *This starts {property.name}'s lease assignment. {unit.label} is added to it as its first space when you finish.* After `createDeal(draft)`: `if (spaceUnitId) { const child = addSpaceToDeal(listing.id, spaceUnitId); navigate to the child's details } else { existing navigate }`. Cancel creates nothing.
- [ ] Wire the header/rail button: disabled + `Tooltip` when `blocked`; otherwise calls the handler.
- [ ] Tests: `leaseShellForProperty` already covered; add one for `createFromSpace`'s three outcomes if it is kept pure enough (pass `navigate`/`openFor` as params so it is).

**Browser check:** on shell 107's property, an unworked suite's *Create deal from this space* → lands on a new child's `details`, and the property roster row now links to it; on the uniform-vacant tracked fixture → modal opens on Lease, whole-building locked, notice visible; finishing lands on the new child's `details`; cancelling leaves the roster unchanged.

---

## Task 10: Deal-side back-links + copy pass (§8.3, §10)

**Files:** modify `DealContextRail.tsx`, `SpaceDetailHeader.tsx`, `src/routes/_shell/listings/$listingId/spaces.tsx`, `AddSpaceModal.tsx`

- [ ] `DealContextRail.LinkedProperty`: resolve the `TODO` — wrap the card in a `Link to="/properties/$propertyId"`; for a space (`listing.unitId && listing.parentDealId`) add a second row *Property record* → `spaceAssetLink(listing.propertyId, listing.unitId)` (`Link {...spaceAssetLink(...)}`).
- [ ] `SpaceDetailHeader`: a `faBuilding` ghost icon button (`aria-label="Property record"`, `Tooltip` *Property record*) → `spaceAssetLink`, placed in the actions cluster before the pencil. Render only when `space.unitId` resolves to a unit.
- [ ] Copy pass, strings only: `spaces.tsx` — *No spaces on this property yet* / *Add a space to put it on the building and start its deal.* / `aria-label="No spaces"`; `AddSpaceModal` — *Add a space to {property.name} and start its deal. Spaces already on the property are listed on the Spaces page.* / *A new space is added to the property record, then spun into a deal.* Leave identifiers (`buildingSuites`, `SuiteRow`, `suiteStatus`) alone. `grep -rn -i "suite" src/routes/_shell/listings/\$listingId/spaces.tsx src/components/deals/AddSpaceModal.tsx` afterwards should show only labels like `Suite 300` in placeholders.
- [ ] Run `dealCardLink.invariant.test.ts` — both new links are typed `Link`s to `/properties/…`, so no allowlist change; confirm.

**Gate:** tsc + tests.

---

## Task 11: Verification pass

- [ ] `bun --bun run build` (route tree + bundle) → `bunx tsc --noEmit` (diff against `main`'s three known errors) → `bun --bun run test` (check the Vitest paths are the real tree).
- [ ] Playwright, from a fresh isolated profile (re-seeds at v79). Scope to `main.app-shell__main`; wait on unique text; zero console errors is the bar:
  1. `/properties/{107's property}` → redirected to `/overview`; header shows `Available · 1 of 6 spaces` + bar; Deals/Contacts/Comps accordion open.
  2. Spaces tab → 6 rows, precedence order; the Under Contract and Leased rows link to their deals.
  3. Density fixture → 24 rows; the first Vacant row precedes the first Occupied row; within Occupied, floor 1 precedes floor 2.
  4. Zero-space fixture → header without headline; Spaces tab `Empty`; `+ Add Space` → duplicate of a label typed twice blocked; valid add → row appears, header now `Vacant`.
  5. Asset page from a row → facts; edit floor → Save → roster shows the new floor.
  6. Shell 107: open a child deal's Details, change ceiling height, Save → the property's asset page shows the new height (the write-through).
  7. Create-from-space on both branches (Task 9's checks).
  8. Uniform-Leased shell → header `Leased · 3 spaces`, no Vacant row.
  9. `browser_close`.
- [ ] Screenshots of 1, 2, 3, 5 for the PR body — breakage proof only; design review is Zach's.

---

## Task 12: Changelog + spec retirement

- [ ] `changelogEntries.ts`: prepend an entry — `area: "Deals"` is wrong for this; use a new `"Properties"` area only if `changeKindMeta.ts` doesn't enumerate areas (check; otherwise pick the closest existing). `summary` in the app-user voice; highlights one per `feat`/`fix` commit.
- [ ] Write the PR body: the §2.1 finding (physical fields were cloned and the deal's copy was the only editable one), the §3.1 vocabulary choice against #130, the §4.2 hazard and its three rules, and the resolved open questions. Anything worth keeping that lives only in the spec goes in here **before** the next step.
- [ ] `chore(docs): retire the spaces-on-property spec and plan` — delete both files.
- [ ] `/ship` when Zach says so. Never merge.
