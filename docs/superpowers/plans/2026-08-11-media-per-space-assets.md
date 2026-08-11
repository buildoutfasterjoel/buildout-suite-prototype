# Media — per-space assets (Phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Media a real structure — four sections at the building, the same four scoped to a suite on a space page, plus a read-only block for what the building owns — backed by a modelled asset library instead of a hash-derived photo grid.

**Architecture:** Three lists on `DealMarketing` (`photos`, `links`, and the existing `visualMedia`) all carry the same `unitId: string | null` discriminator, so all eight surfaces are filters over them. One component set serves both pages via a single `MediaScope` interface — `{ marketing, patchMarketing, unitId, readOnly }` — where `patchMarketing` *always* targets the building's listing. That one detail is the "one home per asset" rule: on a space page the scope is built from `shell.marketing` and writes to `shell.id`, so a suite's Media tab is a filtered editor onto its building rather than an editor of a divergent clone.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Vite 8 · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Vitest · Bun · IndexedDB via `idb-keyval`

**Spec:** `docs/superpowers/specs/2026-08-11-media-per-space-assets-design.md`

**Branch:** `joel/space-media-per-space-assets` (off `main` at the Phase A merge, `e7b78ec`)

## Global Constraints

- Package manager is Bun; always `bun --bun run <script>`. Tests: `bun --bun run test`.
- `vite build` does **not** type-check. The type gate is `bunx tsc --noEmit`.
- `tsconfig.json` sets `noUnusedLocals: true` and `noUnusedParameters: true` — an import kept only for a JSDoc reference fails the build.
- Biome output, and a `module is not defined` React line on Vitest's stderr, are known non-gates — ignore both.
- Never hand-edit `src/routeTree.gen.ts`; it regenerates on dev/build.
- Do **not** add `@playwright/test`, `playwright.config.ts`, or any committed E2E suite. Do **not** add a component-test harness (jsdom, `@testing-library`) — this repo has zero `.test.tsx` files by design. Logic goes in Vitest; UI is verified in a real browser.
- Blueprint React components for all UI, imported from the `ui` subpath, e.g. `@buildoutinc/blueprint-react/ui/Card`. Available and used here: `Card`, `Collapsible`, `Alert`, `Button`, `Input`, `Select`, `Empty`, `Separator`, `Field`.
- FontAwesome: default to `pro-regular`. `pro-duotone` **only** for `Alert` and `Banner`. Never pass `fixedWidth` to `FontAwesomeIcon` — deprecated.
- `Field.Label` / `Field.Description` crash at runtime outside a `Field.Root`. Detached helper text uses the `form-text` class instead.
- No margin utilities on `Badge` icons — `Badge` already has a flex gap.
- Bootstrap 5 utilities for spacing/layout. Blueprint's SCSS prefix is `--bp-`, so `--bs-*` custom-property overrides silently do nothing.
- Never pair a `Foo.tsx` with a `foo.ts` — macOS resolves case-only collisions to the wrong file and rollup fails.
- House style is substantial *why* comments on non-obvious decisions. Match each file's existing quote style (`src/data/*.ts` uses single quotes and no semicolons; `src/components/**/*.tsx` uses double quotes and semicolons).
- `leaseSpaceFixtures.ts` must take **no `faker` draws** — `generateDataset` keeps drawing after it, so one draw shifts every downstream value the seed tests pin (`leaseSpaceFixtures.ts:458`).
- Commit after each task. Never merge; PRs open via `/ship` on Joel's approval.

---

### Task 1: Model the two lists and the scoping helpers

Pure data layer, fully unit-testable, no behaviour change to anything existing.

**Files:**
- Modify: `src/data/types.ts` — add `MediaAssetKind`, `MediaAsset`, `MediaLink`; add two optional fields to `DealMarketing`
- Modify: `src/data/unitScopedMarketing.ts` — generalise, add two exports
- Test: `src/data/unitScopedMarketing.test.ts` (exists, 42 lines — extend it)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `MediaAssetKind = 'photo' | 'floorPlan'`
  - `MediaAsset { id: string; url: string; kind: MediaAssetKind; caption: string; unitId: string | null }`
  - `MediaLink { id: string; url: string; kind: 'video' | 'matterport' | 'virtualTour'; unitId: string | null }`
  - `DealMarketing.photos?: MediaAsset[]`, `DealMarketing.links?: MediaLink[]`
  - `ownedByUnit<T extends { unitId: string | null }>(list: T[], unitId: string | null): T[]`
  - `buildingWide<T extends { unitId: string | null }>(list: T[]): T[]`
  - `mediaForUnit` — unchanged signature and behaviour

- [ ] **Step 1: Write the failing tests**

Append to `src/data/unitScopedMarketing.test.ts`. Note the existing file imports from `./unitScopedMarketing`; extend that import to include the two new names.

```ts
describe('ownedByUnit', () => {
  const list = [
    { unitId: null, tag: 'building' },
    { unitId: 'u1', tag: 'u1-a' },
    { unitId: 'u1', tag: 'u1-b' },
    { unitId: 'u2', tag: 'u2' },
  ]

  it("returns only the unit's own, never the building-wide ones", () => {
    // The whole point of this helper: the Media editor shows what a suite OWNS
    // separately from what it merely inherits, so it must not fall back.
    expect(ownedByUnit(list, 'u1').map((x) => x.tag)).toEqual(['u1-a', 'u1-b'])
  })

  it('returns nothing for a unit with no assets of its own', () => {
    expect(ownedByUnit(list, 'u3')).toEqual([])
  })

  it('returns the whole list for a null unit, matching mediaForUnit', () => {
    // A null scope means "not scoped to a suite" — the caller wants everything.
    expect(ownedByUnit(list, null)).toEqual(list)
  })
})

describe('buildingWide', () => {
  const list = [
    { unitId: null, tag: 'building-a' },
    { unitId: 'u1', tag: 'u1' },
    { unitId: null, tag: 'building-b' },
  ]

  it('returns only the assets that belong to no unit', () => {
    expect(buildingWide(list).map((x) => x.tag)).toEqual(['building-a', 'building-b'])
  })

  it('returns nothing when every asset is unit-scoped', () => {
    expect(buildingWide([{ unitId: 'u1' }, { unitId: 'u2' }])).toEqual([])
  })
})

describe('the three helpers together', () => {
  const list = [
    { unitId: null, tag: 'building' },
    { unitId: 'u1', tag: 'u1' },
    { unitId: 'u2', tag: 'u2' },
  ]

  it('ownedByUnit and buildingWide are disjoint, and their union is mediaForUnit', () => {
    // This is the invariant the editor relies on: it renders the two sets in two
    // separate blocks and must not drop or double-count anything between them.
    const own = ownedByUnit(list, 'u1')
    const wide = buildingWide(list)
    expect(own.some((a) => wide.includes(a))).toBe(false)
    expect([...own, ...wide].map((x) => x.tag).sort()).toEqual(
      mediaForUnit(list, 'u1').map((x) => x.tag).sort(),
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test unitScopedMarketing`
Expected: FAIL — `ownedByUnit` and `buildingWide` are not exported from `./unitScopedMarketing`.

- [ ] **Step 3: Add the model types**

In `src/data/types.ts`, add immediately after the existing `VisualMediaLink` interface (around line 126) so the three media shapes sit together:

```ts
export type MediaAssetKind = 'photo' | 'floorPlan'

/**
 * An uploaded image or document. Real file upload is not modelled anywhere in
 * this prototype, so `url` points at an already-hosted image — the same shape
 * `VisualMediaLink` uses.
 */
export interface MediaAsset {
  id: string
  url: string
  kind: MediaAssetKind
  caption: string
  /** The space this asset depicts, when it depicts one. Null = whole building. */
  unitId: string | null
}

/**
 * One of the three named marketing destinations. Modelled as a list rather than
 * three fields so it needs no per-unit grain of its own — the UI renders exactly
 * one row per `kind` per scope, so singularity is a presentation rule, not a
 * type-level one.
 */
export interface MediaLink {
  id: string
  url: string
  kind: 'video' | 'matterport' | 'virtualTour'
  /** The space this destination is for, when it is for one. Null = whole building. */
  unitId: string | null
}
```

Then add to `DealMarketing`, beside the existing `visualMedia?: VisualMediaLink[]` in the "Visual media + disclaimer/notes" group (around line 932):

```ts
  /** Uploaded photos and floor plans, building-wide and per suite. */
  photos?: MediaAsset[]
  /** Video / Matterport / virtual-tour destinations, building-wide and per suite. */
  links?: MediaLink[]
```

**Optional, not required**, matching `visualMedia?`. Six sites construct a `marketing:` literal (`timeline.ts:312`, `savePatches.ts:55`, `leaseSpaces.ts:71`, `seed.ts:1451`, `leaseSpaceFixtures.ts:242`, `createListing.ts:700`); required fields would force all six to grow two empty arrays for no gain.

- [ ] **Step 4: Generalise the scoping helpers**

Rewrite `src/data/unitScopedMarketing.ts`. Keep the existing `leadsForSpaceDeal` exactly as it is, including its comment.

```ts
/**
 * A space shows its own assets plus the building-wide ones — a suite with no
 * photos of its own should still show the building's.
 *
 * Generic over `{ unitId }` rather than `VisualMediaLink[]` because `photos` and
 * `links` carry the same discriminator and want the same three rules.
 *
 * The Media *editor* deliberately does NOT use this one. It renders what a suite
 * owns and what it inherits in two visibly separate blocks — that boundary is the
 * whole point of the page — so it needs `ownedByUnit` and `buildingWide` apart.
 * This merged view is for public and preview surfaces, where the fallback is what
 * matters and the distinction is not.
 */
export function mediaForUnit<T extends { unitId: string | null }>(
  links: T[],
  unitId: string | null,
): T[] {
  if (!unitId) return links
  return links.filter((l) => l.unitId === unitId || l.unitId == null)
}

/**
 * Strictly the unit's own — no building-wide fallback. Powers a suite's four
 * editable Media sections: a suite may only edit what it owns.
 *
 * A null `unitId` means "not scoped to a suite", so it returns everything, which
 * keeps it interchangeable with `mediaForUnit` at an unscoped call site.
 */
export function ownedByUnit<T extends { unitId: string | null }>(
  list: T[],
  unitId: string | null,
): T[] {
  if (!unitId) return list
  return list.filter((l) => l.unitId === unitId)
}

/**
 * Only the assets that belong to no unit. Powers the building's own four
 * sections, and a suite's read-only "From the building" block.
 */
export function buildingWide<T extends { unitId: string | null }>(list: T[]): T[] {
  return list.filter((l) => l.unitId == null)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
bun --bun run test unitScopedMarketing
bunx tsc --noEmit
```
Expected: all pass, `tsc` clean. `mediaForUnit`'s existing tests must still pass — its behaviour is unchanged, only its type widened.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/unitScopedMarketing.ts src/data/unitScopedMarketing.test.ts
git commit -m "$(cat <<'EOF'
feat(media): model photos and links, and split owned from inherited

`photos` and `links` join `visualMedia` on `DealMarketing`, all three carrying
the same `unitId: string | null` discriminator `VisualMediaLink` introduced. That
is what lets all eight Media surfaces be filters over three uniform lists rather
than eight bespoke shapes.

Optional fields, matching `visualMedia?` — six sites construct a `marketing:`
literal and requiring these would make all six grow two empty arrays for nothing.

`unitScopedMarketing` generalises over `{ unitId }` and gains two helpers. The
editor needs `ownedByUnit` and `buildingWide` kept apart because it renders what
a suite owns separately from what it inherits, and that boundary is the point of
the page. `mediaForUnit` keeps its merging fallback unchanged for the public and
preview surfaces, where the fallback is what matters.
EOF
)"
```

---

### Task 2: One home per asset — stop cloning media onto a space

**Files:**
- Modify: `src/data/leaseSpaces.ts:71-75` — the child's `marketing` literal
- Test: `src/data/leaseSpaces.test.ts` (exists — append)

**Interfaces:**
- Consumes: `MediaAsset` / `MediaLink` from Task 1 (only via `DealMarketing`; no direct import needed).
- Produces: the guarantee every later task depends on — a space's own `marketing.photos`, `.links` and `.visualMedia` are always empty, so the only copy of a unit's media is the building's.

- [ ] **Step 1: Write the failing test**

Append to `src/data/leaseSpaces.test.ts`. Match the file's existing setup style — it already imports `addPropertyUnit` and `addSpaceToDeal` and builds a parent with `createProposalListing` / `emptyDraft`.

```ts
describe('a space never holds its own copy of the building s media', () => {
  it('starts with all three media lists empty even when the parent has all three', () => {
    const parent = createProposalListing({ ...emptyDraft(), name: 'Plaza', dealType: 'Lease' })
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 200',
      sqft: 1200,
      unitType: 'office',
    })!

    // Populate every media list on the parent, so a plain `...parent.marketing`
    // spread would visibly carry all three onto the child.
    updateDealMarketing(parent.id, {
      photos: [
        { id: 'p1', url: 'https://example.com/a.jpg', kind: 'photo', caption: '', unitId: null },
      ],
      links: [
        { id: 'l1', url: 'https://example.com/tour', kind: 'video', unitId: null },
      ],
      visualMedia: [
        {
          id: 'v1',
          url: 'https://example.com/matterport',
          mediaType: 'Matterport Tour',
          unitId: null,
        },
      ],
    })

    const child = addSpaceToDeal(parent.id, unit.id)!.deal

    // A unit's media has exactly one home — the building's marketing. If a space
    // held a clone, editing it on the suite would diverge from the building and
    // nothing would say which copy a public surface reads.
    expect(child.marketing.photos).toEqual([])
    expect(child.marketing.links).toEqual([])
    expect(child.marketing.visualMedia).toEqual([])
  })

  it('leaves the parent s own media untouched', () => {
    const parent = createProposalListing({ ...emptyDraft(), name: 'Center', dealType: 'Lease' })
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 300',
      sqft: 900,
      unitType: 'office',
    })!
    updateDealMarketing(parent.id, {
      photos: [
        { id: 'p9', url: 'https://example.com/b.jpg', kind: 'photo', caption: '', unitId: null },
      ],
    })

    addSpaceToDeal(parent.id, unit.id)

    expect(getListing(parent.id)!.marketing.photos).toHaveLength(1)
  })
})
```

Add `updateDealMarketing` and `getListing` to the file's imports from `#/data/actions` and `#/data/store` respectively if they are not already there — check first, the file may already import `getListing`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test leaseSpaces`
Expected: FAIL — `child.marketing.photos` is the parent's one-element array, not `[]`, because `...parent.marketing` copies it.

- [ ] **Step 3: Empty the three lists on the child**

In `src/data/leaseSpaces.ts`, the child's `marketing` literal (currently lines 71-75) becomes:

```ts
    marketing: {
      ...parent.marketing,
      availableSqFt: unit.sqft,
      spaceLeaseTerms: [existingRow ? { ...existingRow } : spaceTermsFromUnit(unit)],
      // A unit's media has exactly ONE home: the building's marketing. A space's
      // Media tab is a filtered editor onto its parent, not an owner of its own
      // copy — so the child starts with all three lists empty and nothing ever
      // writes to them. Left populated, an edit made on the suite would diverge
      // from the building, and the building's Media -> Spaces section (which reads
      // the building's lists) would never see it.
      photos: [],
      links: [],
      visualMedia: [],
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun --bun run test leaseSpaces
bun --bun run test
bunx tsc --noEmit
```
Expected: the new cases pass. Run the **full** suite here, not just `leaseSpaces` — `addSpaceToDeal` is used by `dealShape`, `useStageGate`, `spaceVouchers`, `clientTools` and `buildingSuites` tests, and emptying a field it used to copy could surface elsewhere. If anything else fails, report it rather than adjusting the new behaviour to suit it.

- [ ] **Step 5: Commit**

```bash
git add src/data/leaseSpaces.ts src/data/leaseSpaces.test.ts
git commit -m "$(cat <<'EOF'
fix(spaces): give a unit's media exactly one home

`addSpaceToDeal` spreads `...parent.marketing`, so a child space held a clone of
`visualMedia` — and would have held clones of `photos` and `links` the moment
those existed. The child now starts with all three empty.

This is what makes a suite's Media tab a filtered editor onto its building rather
than an editor of a divergent copy. Left cloned, an edit on the suite would never
appear in the building's Media -> Spaces section, which reads the building's
lists, and nothing would say which copy a public surface reads.

It is the space-deal backlog's "make a space's marketing a reference to its parent
rather than a clone", scoped to the three media fields. The rest of the clone is
out of scope and unchanged.
EOF
)"
```

---

### Task 3: Seed the media fixtures and bump `SEED_VERSION`

**Files:**
- Modify: `src/data/leaseSpaceFixtures.ts` — a new faker-free seeding helper, called from `applyLeaseSpaces`
- Modify: `src/data/persistence.ts:5` — `SEED_VERSION` 40 → 41
- Test: `src/data/leaseSpaceFixtures.test.ts` (exists, 303 lines — append)
- Test: `src/data/persistence.test.ts` (exists — verify, likely no change needed)

**Interfaces:**
- Consumes: `MediaAsset`, `MediaLink` (Task 1); the empty-lists guarantee (Task 2).
- Produces: seeded media on the two lease shells and their ten units, so every later UI task has real content to render. Deterministic ids of the form `${unit.id}-photo-0`, `${shell.id}-photo-0`, `${unitId ?? 'building'}-${linkKind}`.

- [ ] **Step 1: Write the failing tests**

Append to `src/data/leaseSpaceFixtures.test.ts`. It already builds a seeded dataset; reuse whatever accessor the existing cases use to reach the two shells and their properties.

```ts
describe('seeded media', () => {
  it('gives each lease shell building-wide photos and visual media', () => {
    for (const shell of shells) {
      const photos = (shell.marketing.photos ?? []).filter((p) => p.unitId == null)
      expect(photos.length, shell.name).toBeGreaterThan(0)
      expect(photos.every((p) => p.kind === 'photo'), shell.name).toBe(true)

      const media = (shell.marketing.visualMedia ?? []).filter((v) => v.unitId == null)
      expect(media.length, shell.name).toBeGreaterThan(0)
    }
  })

  it('never seeds a building-wide floor plan, which has no section to render in', () => {
    for (const shell of shells) {
      const strayPlans = (shell.marketing.photos ?? []).filter(
        (p) => p.kind === 'floorPlan' && p.unitId == null,
      )
      expect(strayPlans, shell.name).toEqual([])
    }
  })

  it('spreads unit media unevenly, so the UI meets all three states', () => {
    // Deliberately uneven: the grid, the empty state and the partially-filled
    // case all need to be reachable in a demo without editing anything first.
    //
    // Asserted PER INDEX against the final unit list, not with `some(n > 0)`.
    // A `some` check is trivially true whether the seeding works or not, and an
    // earlier version of this passed against a build where eight of ten units
    // got nothing because the seeding ran before `resliceUnits` had created them.
    for (const shell of shells) {
      const property = propertyFor(shell)
      const photos = shell.marketing.photos ?? []
      const links = shell.marketing.links ?? []

      property.units.forEach((unit, i) => {
        const own = photos.filter((p) => p.unitId === unit.id)
        const where = `${shell.name} / ${unit.label} (i=${i})`
        if (i % 3 === 0) {
          expect(own.filter((p) => p.kind === 'photo').length, where).toBeGreaterThan(0)
          expect(own.filter((p) => p.kind === 'floorPlan').length, where).toBe(1)
          expect(links.filter((l) => l.unitId === unit.id).length, where).toBe(1)
        } else if (i % 3 === 1) {
          expect(own.filter((p) => p.kind === 'photo').length, where).toBeGreaterThan(0)
          expect(own.filter((p) => p.kind === 'floorPlan').length, where).toBe(0)
        } else {
          expect(own.length, where).toBe(0)
          expect(links.filter((l) => l.unitId === unit.id).length, where).toBe(0)
        }
      })
    }
  })

  it('gives at least one unit a floor plan', () => {
    const anyPlan = shells.some((s) =>
      (s.marketing.photos ?? []).some((p) => p.kind === 'floorPlan' && p.unitId != null),
    )
    expect(anyPlan).toBe(true)
  })

  it('scopes every seeded asset to a real unit of its own property', () => {
    // A dangling unitId would render nowhere and be invisible in the UI.
    for (const shell of shells) {
      const ids = new Set(propertyFor(shell).units.map((u) => u.id))
      const scoped = [
        ...(shell.marketing.photos ?? []),
        ...(shell.marketing.links ?? []),
        ...(shell.marketing.visualMedia ?? []),
      ].filter((a) => a.unitId != null)
      for (const a of scoped) {
        expect(ids.has(a.unitId!), `${shell.name} / ${a.unitId}`).toBe(true)
      }
    }
  })

  it('leaves every child space holding no media of its own', () => {
    // The one-home rule, verified against the seeded data rather than only the
    // factory — a fixture that populated a child directly would bypass Task 2.
    for (const child of childSpaces) {
      expect(child.marketing.photos ?? [], child.name).toEqual([])
      expect(child.marketing.links ?? [], child.name).toEqual([])
      expect(child.marketing.visualMedia ?? [], child.name).toEqual([])
    }
  })
})
```

Wire `shells`, `propertyFor` and `childSpaces` to the file's existing fixtures — read the top of the file and reuse its setup rather than building a second dataset.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test leaseSpaceFixtures`
Expected: FAIL — no media is seeded, so the "greater than 0" assertions fail.

- [ ] **Step 3: Add the seeding helper**

In `src/data/leaseSpaceFixtures.ts`, add above `applyLeaseSpaces`:

```ts
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
 * the seed tests pin. `listingGallery` and `crypto` are not faker.
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
```

Extend the file's type import to include `MediaAsset`, `MediaLink` and `VisualMediaType`, and import `listingGallery` from `#/components/properties/propertyDisplay`.

> If importing a component-directory module into `src/data/` breaks a lint boundary or creates a cycle, stop and report it rather than duplicating `listingGallery`. The two must not drift.

Then call it inside `applyLeaseSpaces` — **immediately after `fillTermsForUnits(shell, property)`**, not after the `if (!shell || !property || …) continue` guard:

```ts
    applyShellMedia(shell, property)
```

**The placement is load-bearing and easy to get wrong.** `property.units` at the top of the loop is still a pre-slice placeholder array of ~2 units; `resliceUnits` is what builds the real 6 and 4 suites, and `fillTermsForUnits` runs after it. Seeding before those two means iterating units that are about to be replaced — the assets land on records nothing renders, and eight of the ten final units get nothing. Verify by asserting the per-index distribution below rather than by eye.

- [ ] **Step 4: Bump `SEED_VERSION`**

`src/data/persistence.ts:5`:

```ts
export const SEED_VERSION = 41;
```

Without this, an existing IndexedDB snapshot keeps serving media-less data and the new fixtures never appear in a browser — a failure mode that has cost sessions before.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
bun --bun run test leaseSpaceFixtures
bun --bun run test persistence
bun --bun run test
bunx tsc --noEmit
```
Expected: all pass. Run the **full** suite — `seed.test.ts`, `seed.delgado.test.ts` and `seed.rosaHero.test.ts` pin values that shift if a faker draw sneaks in. If any of those three fail, a faker draw was added; find and remove it rather than updating their expectations.

- [ ] **Step 6: Commit**

```bash
git add src/data/leaseSpaceFixtures.ts src/data/leaseSpaceFixtures.test.ts src/data/persistence.ts
git commit -m "$(cat <<'EOF'
feat(media): seed a real media library on the two lease shells

Building-wide photos, visual media and a video link per shell, plus an uneven
scatter across their ten units: every third unit gets photos, a floor plan and a
Matterport link, the next photos only, the next nothing. Uneven on purpose — a
full grid, a partial one and an empty state all have to be reachable in a demo
without editing anything first.

Photo URLs come from `listingGallery`, so the modelled library and the photos
already on deal cards, in the publish preview and on `SpaceDetailHeader` agree by
construction rather than coincidence. `listingGallery` keeps every current caller;
this adds a library beside it rather than replacing the derivation.

No faker draws, per the note on `applyLeaseSpaces` — the dataset keeps drawing
after this pass, so one draw here would shift every value the seed tests pin.
Asset ids derive from the unit and kind for the same reason: stable across runs.

SEED_VERSION 40 -> 41, or an existing IndexedDB snapshot keeps serving
media-less data and none of this shows up in a browser.
EOF
)"
```

---

### Task 4: The scope contract and the asset grid

**Files:**
- Create: `src/components/listings/media/mediaScope.ts` — the shared interface plus the pure list helpers
- Create: `src/components/listings/media/mediaScope.test.ts`
- Create: `src/components/listings/media/MediaAssetGrid.tsx`
- Create: `src/components/listings/media/visualMediaTypes.ts`
- Modify: `src/components/listings/edit/sections/VisualMediaSection.tsx:17-25` — import the extracted list instead of inlining it

**Interfaces:**
- Consumes: `MediaAsset`, `MediaAssetKind`, `DealMarketing` (Task 1); `ownedByUnit`, `buildingWide` (Task 1).
- Produces:
  - `MediaScope { marketing: DealMarketing; patchMarketing: (patch: Partial<DealMarketing>) => void; unitId: string | null; readOnly?: boolean }`
  - `assetsInScope(marketing: DealMarketing, unitId: string | null, kind: MediaAssetKind): MediaAsset[]`
  - `addAsset(all: MediaAsset[], asset: MediaAsset): MediaAsset[]`
  - `removeAsset(all: MediaAsset[], id: string): MediaAsset[]`
  - `VISUAL_MEDIA_TYPES: VisualMediaType[]` (from `visualMediaTypes.ts`)
  - `<MediaAssetGrid scope={…} kind="photo" title="…" emptyHint="…" />`

**`MediaScope` is the load-bearing idea of this whole phase.** `patchMarketing` always targets the **building's** listing — the building page builds it from its own listing, a space page builds it from `shell`. Every component below is therefore identical on both pages, and the one-home rule is expressed once, at the two call sites, rather than in each component.

- [ ] **Step 1: Write the failing tests for the pure helpers**

Create `src/components/listings/media/mediaScope.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { DealMarketing, MediaAsset } from "#/data/types";
import { addAsset, assetsInScope, removeAsset } from "./mediaScope";

const asset = (over: Partial<MediaAsset>): MediaAsset => ({
  id: "x",
  url: "https://example.com/x.jpg",
  kind: "photo",
  caption: "",
  unitId: null,
  ...over,
});

const marketing = (photos: MediaAsset[]) => ({ photos }) as unknown as DealMarketing;

describe("assetsInScope", () => {
  const m = marketing([
    asset({ id: "b1", unitId: null }),
    asset({ id: "u1", unitId: "unit-1" }),
    asset({ id: "u1-plan", unitId: "unit-1", kind: "floorPlan" }),
    asset({ id: "u2", unitId: "unit-2" }),
  ]);

  it("returns a unit's own photos and never the building's", () => {
    expect(assetsInScope(m, "unit-1", "photo").map((a) => a.id)).toEqual(["u1"]);
  });

  it("filters by kind, so a floor plan never lands in the photo grid", () => {
    expect(assetsInScope(m, "unit-1", "floorPlan").map((a) => a.id)).toEqual(["u1-plan"]);
  });

  it("returns building-wide photos for a null scope", () => {
    expect(assetsInScope(m, null, "photo").map((a) => a.id)).toEqual(["b1"]);
  });

  it("ignores a building-wide floor plan, which has no section to render in", () => {
    const stray = marketing([asset({ id: "stray", kind: "floorPlan", unitId: null })]);
    expect(assetsInScope(stray, null, "photo")).toEqual([]);
  });

  it("treats absent photos as empty rather than throwing", () => {
    expect(assetsInScope({} as DealMarketing, null, "photo")).toEqual([]);
  });
});

describe("addAsset / removeAsset", () => {
  it("appends without mutating the input", () => {
    const all = [asset({ id: "a" })];
    const next = addAsset(all, asset({ id: "b" }));
    expect(next.map((a) => a.id)).toEqual(["a", "b"]);
    expect(all.map((a) => a.id)).toEqual(["a"]);
  });

  it("removes by id and leaves the rest in order", () => {
    const all = [asset({ id: "a" }), asset({ id: "b" }), asset({ id: "c" })];
    expect(removeAsset(all, "b").map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("is a no-op for an id that is not there", () => {
    const all = [asset({ id: "a" })];
    expect(removeAsset(all, "zzz").map((a) => a.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --bun run test mediaScope`
Expected: FAIL — `./mediaScope` does not exist.

- [ ] **Step 3: Write `mediaScope.ts`**

```ts
import type { DealMarketing, MediaAsset, MediaAssetKind } from "#/data/types";
import { buildingWide, ownedByUnit } from "#/data/unitScopedMarketing";

/**
 * What every Media section needs, and the reason one component set serves both
 * the building's page and a suite's.
 *
 * `patchMarketing` ALWAYS targets the building's listing — the building page
 * builds this from its own listing, a space page builds it from its shell. That
 * is the one-home rule: a unit's media lives in the building's `marketing`, and a
 * suite's Media tab is a filtered editor onto it. Expressed here, once, instead of
 * in every component.
 */
export interface MediaScope {
  /** The BUILDING's marketing, whichever page is rendering. */
  marketing: DealMarketing;
  /** Patches the BUILDING's marketing. Never a space's. */
  patchMarketing: (patch: Partial<DealMarketing>) => void;
  /** null = the building's own assets; a unit id = that suite's own. */
  unitId: string | null;
  /** Renders without upload or per-item controls. Used for the inherited block. */
  readOnly?: boolean;
}

/**
 * The assets of one kind in one scope — strictly owned, never inherited.
 *
 * Filters on `kind` rather than assuming, so a `floorPlan` with a null `unitId`
 * (which has no section to render in) is silently ignored instead of appearing in
 * the building's photo grid.
 */
export function assetsInScope(
  marketing: DealMarketing,
  unitId: string | null,
  kind: MediaAssetKind,
): MediaAsset[] {
  const all = marketing.photos ?? [];
  const scoped = unitId ? ownedByUnit(all, unitId) : buildingWide(all);
  return scoped.filter((a) => a.kind === kind);
}

export function addAsset(all: MediaAsset[], asset: MediaAsset): MediaAsset[] {
  return [...all, asset];
}

export function removeAsset(all: MediaAsset[], id: string): MediaAsset[] {
  return all.filter((a) => a.id !== id);
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
bun --bun run test mediaScope
bunx tsc --noEmit
```
Expected: pass, clean.

- [ ] **Step 5: Extract the preset type list**

Create `src/components/listings/media/visualMediaTypes.ts`:

```ts
import type { VisualMediaType } from "#/data/types";

/**
 * The preset embed types Visual Media offers, in display order.
 *
 * Extracted so the listing form's `VisualMediaSection` and the Media tab's
 * `VisualMediaGallery` cannot drift — two dropdowns offering different subsets of
 * the same union would be invisible until a broker noticed one was missing.
 */
export const VISUAL_MEDIA_TYPES: VisualMediaType[] = [
  "Interactive Site Plan",
  "Aerial 360 Map",
  "Aerial 360 Rendering",
  "360 Rendering",
  "Property Marketing Video",
  "Matterport Tour",
  "360 Tour",
];
```

Then in `src/components/listings/edit/sections/VisualMediaSection.tsx`, delete the local `const VISUAL_MEDIA_TYPES` (lines 17-25) and import it instead:

```tsx
import { VISUAL_MEDIA_TYPES } from "#/components/listings/media/visualMediaTypes";
```

Note that file uses **tabs** for indentation — match it.

- [ ] **Step 6: Write `MediaAssetGrid.tsx`**

```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import type { MediaAsset, MediaAssetKind } from "#/data/types";
import { addAsset, assetsInScope, removeAsset, type MediaScope } from "./mediaScope";

/**
 * A grid of uploaded assets for one kind in one scope.
 *
 * Serves Property Photos, Space Photos and Floor Plan — they differ only by
 * `kind`, `title` and scope, so they are one component rather than three.
 *
 * "Add" appends a record pointing at a URL rather than uploading a file: real
 * upload is not modelled anywhere in this prototype, and `VisualMediaLink`
 * already works this way.
 */
export function MediaAssetGrid({
  scope,
  kind,
  title,
  emptyHint,
}: {
  scope: MediaScope;
  kind: MediaAssetKind;
  title: string;
  /** Shown in place of the grid when the scope holds nothing. */
  emptyHint: string;
}) {
  const assets = assetsInScope(scope.marketing, scope.unitId, kind);
  const all = scope.marketing.photos ?? [];

  const add = () => {
    const next: MediaAsset = {
      // A uuid, not an id derived from counts: `seq` and `all.length` are both
      // recomputed from current state, so add A, add B, remove A, add C mints C
      // with B's id — and `setField`/`remove` match on `a.id`, so both records get
      // hit. Determinism is only wanted in the seed fixtures, which are
      // snapshotted and asserted against; these are minted by a user clicking Add.
      id: crypto.randomUUID(),
      url: "",
      kind,
      caption: "",
      unitId: scope.unitId,
    };
    scope.patchMarketing({ photos: addAsset(all, next) });
  };

  const remove = (id: string) =>
    scope.patchMarketing({ photos: removeAsset(all, id) });

  const setField = (id: string, patch: Partial<MediaAsset>) =>
    scope.patchMarketing({
      photos: all.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="fs-6 fw-semibold mb-0">{title}</h3>
        {!scope.readOnly && (
          <Button variant="ghost" size="sm" onClick={add}>
            <FontAwesomeIcon icon={faPlus} />
            Add
          </Button>
        )}
      </div>

      {assets.length === 0 ? (
        <div className="form-text">{emptyHint}</div>
      ) : (
        <div className="row g-3">
          {assets.map((a) => (
            <div key={a.id} className="col-6 col-md-4 col-xl-3">
              <Card>
                {a.url ? (
                  <img
                    src={a.url}
                    alt={a.caption || title}
                    className="w-100 rounded-top"
                    style={{ aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div
                    className="w-100 rounded-top bg-body-secondary d-flex align-items-center justify-content-center text-muted"
                    style={{ aspectRatio: "4 / 3" }}
                  >
                    No image URL
                  </div>
                )}
                <Card.Body className="p-2 d-flex flex-column gap-2">
                  {scope.readOnly ? (
                    <div className="text-truncate small" title={a.caption}>
                      {a.caption || <span className="text-muted">Untitled</span>}
                    </div>
                  ) : (
                    <>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Image URL"
                        value={a.url}
                        onChange={(e) => setField(a.id, { url: e.target.value })}
                      />
                      <input
                        className="form-control form-control-sm"
                        placeholder="Caption"
                        value={a.caption}
                        onChange={(e) => setField(a.id, { caption: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="align-self-start"
                        onClick={() => remove(a.id)}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                        Remove
                      </Button>
                    </>
                  )}
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

> **Use Blueprint's `Input`, not a raw `<input>`.** Import it as `import { Input } from "@buildoutinc/blueprint-react/ui/Input";` and replace both `<input className="form-control form-control-sm" …>` occurrences above with `<Input size="sm" …>` carrying the same `placeholder`, `value` and `onChange`. Blueprint's `Input` is a thin wrapper that just adds `form-control` (`blueprint-react/src/components/Input/index.tsx:5-16`), so it needs no `Field.Root` and is a strict drop-in. Raw `form-control` markup appears in exactly one file in this whole codebase; three new files doing it would be against the grain and the Global Constraints say Blueprint components for all UI.
>
> If `size="sm"` is not a valid prop on it, pass `className="form-control-sm"` instead and note which you used.

- [ ] **Step 7: Verify the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```
Expected: clean, and the full suite still passes — `VisualMediaSection` now imports the extracted list, so a wrong path would surface in `listingFormLogic` or an editor test.

- [ ] **Step 8: Commit**

```bash
git add src/components/listings/media/ src/components/listings/edit/sections/VisualMediaSection.tsx
git commit -m "$(cat <<'EOF'
feat(media): add the scope contract and the asset grid

`MediaScope` is the load-bearing idea of this phase: `{ marketing,
patchMarketing, unitId, readOnly }`, where `patchMarketing` ALWAYS targets the
building's listing. The building page builds it from its own listing, a space page
from its shell — so one component set serves both, and the one-home rule lives at
two call sites instead of inside every component.

`MediaAssetGrid` serves Property Photos, Space Photos and Floor Plan, which differ
only by kind, title and scope. It filters on `kind` rather than assuming, so a
building-wide floor plan — a shape with no section to render in — is ignored
rather than misplaced in the building's photo grid.

`VISUAL_MEDIA_TYPES` is extracted from the listing form's `VisualMediaSection` so
the form's dropdown and the Media tab's cannot drift; two dropdowns offering
different subsets of the same union would go unnoticed until a broker missed one.

"Add" appends a record pointing at a URL. Real upload is not modelled anywhere in
this prototype, and `VisualMediaLink` already works this way.
EOF
)"
```

---

### Task 5: Links and the visual-media gallery

**Files:**
- Create: `src/components/listings/media/mediaLinks.ts` — the pure upsert helper
- Create: `src/components/listings/media/mediaLinks.test.ts`
- Create: `src/components/listings/media/MediaLinksSection.tsx`
- Create: `src/components/listings/media/VisualMediaGallery.tsx`

**Interfaces:**
- Consumes: `MediaScope` (Task 4), `VISUAL_MEDIA_TYPES` (Task 4), `MediaLink` / `VisualMediaLink` (Task 1), `ownedByUnit` / `buildingWide` (Task 1).
- Produces:
  - `LINK_KINDS: readonly { kind: MediaLink['kind']; label: string }[]`
  - `linkInScope(all: MediaLink[], kind: MediaLink['kind'], unitId: string | null): MediaLink | undefined`
  - `upsertLink(all: MediaLink[], kind: MediaLink['kind'], unitId: string | null, url: string): MediaLink[]`
  - `<MediaLinksSection scope={…} />`
  - `<VisualMediaGallery scope={…} />`

- [ ] **Step 1: Write the failing tests**

Create `src/components/listings/media/mediaLinks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { MediaLink } from "#/data/types";
import { LINK_KINDS, linkInScope, upsertLink } from "./mediaLinks";

const link = (over: Partial<MediaLink>): MediaLink => ({
  id: "x",
  url: "https://example.com/x",
  kind: "video",
  unitId: null,
  ...over,
});

describe("LINK_KINDS", () => {
  it("names exactly the three destinations, in display order", () => {
    expect(LINK_KINDS.map((k) => k.kind)).toEqual(["video", "matterport", "virtualTour"]);
  });
});

describe("linkInScope", () => {
  const all = [
    link({ id: "b-video", kind: "video", unitId: null }),
    // The building HAS a virtualTour and unit-1 does not. Without this row the
    // no-fallback test below is vacuous — there would be nothing to fall back to,
    // so it would pass whether or not `linkInScope` falls back.
    link({ id: "b-tour", kind: "virtualTour", unitId: null }),
    link({ id: "u-video", kind: "video", unitId: "unit-1" }),
    link({ id: "u-mp", kind: "matterport", unitId: "unit-1" }),
  ];

  it("finds the one link of a kind in a unit's scope", () => {
    expect(linkInScope(all, "video", "unit-1")?.id).toBe("u-video");
  });

  it("does not fall back to the building's link for a unit", () => {
    // Links are single-value per scope. Falling back would make a suite look like
    // it has its own video when it is showing the building's.
    expect(linkInScope(all, "virtualTour", "unit-1")).toBeUndefined();
  });

  it("finds a building-wide link for a null scope", () => {
    expect(linkInScope(all, "video", null)?.id).toBe("b-video");
  });
});

describe("upsertLink", () => {
  it("adds a link when the scope has none of that kind", () => {
    const next = upsertLink([], "video", "unit-1", "https://v/1");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ kind: "video", unitId: "unit-1", url: "https://v/1" });
  });

  it("updates in place rather than adding a second of the same kind", () => {
    // The UI renders one row per kind, so two records of a kind in one scope would
    // make the second unreachable and silently authoritative-or-not.
    const all = [link({ id: "keep", kind: "video", unitId: "unit-1", url: "old" })];
    const next = upsertLink(all, "video", "unit-1", "new");
    expect(next).toHaveLength(1);
    expect(next[0].url).toBe("new");
    expect(next[0].id).toBe("keep");
  });

  it("removes the record when the url is cleared", () => {
    const all = [link({ id: "gone", kind: "video", unitId: "unit-1" })];
    expect(upsertLink(all, "video", "unit-1", "")).toEqual([]);
  });

  it("treats whitespace as cleared", () => {
    const all = [link({ id: "gone", kind: "video", unitId: "unit-1" })];
    expect(upsertLink(all, "video", "unit-1", "   ")).toEqual([]);
  });

  it("is a no-op when clearing a kind that was never set", () => {
    expect(upsertLink([], "video", "unit-1", "")).toEqual([]);
  });

  it("leaves other kinds and other scopes alone", () => {
    const all = [
      link({ id: "b-video", kind: "video", unitId: null }),
      link({ id: "u-mp", kind: "matterport", unitId: "unit-1" }),
    ];
    const next = upsertLink(all, "video", "unit-1", "https://v/new");
    expect(next.map((l) => l.id).sort()).toEqual(["b-video", "u-mp", "unit-1-video"].sort());
  });

  it("does not mutate the input", () => {
    const all = [link({ id: "a", kind: "video", unitId: null })];
    upsertLink(all, "video", null, "changed");
    expect(all[0].url).toBe("https://example.com/x");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun --bun run test mediaLinks`
Expected: FAIL — `./mediaLinks` does not exist.

- [ ] **Step 3: Write `mediaLinks.ts`**

```ts
import type { MediaLink } from "#/data/types";
import { buildingWide, ownedByUnit } from "#/data/unitScopedMarketing";

/**
 * The three named destinations, in display order.
 *
 * Links is deliberately separate from Visual Media even though the underlying
 * types overlap: Visual Media is a repeatable gallery of preset embeds, Links is
 * three specific destinations a broker fills in once each.
 */
export const LINK_KINDS: readonly { kind: MediaLink["kind"]; label: string }[] = [
  { kind: "video", label: "Video URL" },
  { kind: "matterport", label: "Matterport Link" },
  { kind: "virtualTour", label: "Virtual Tour Link" },
];

/**
 * The single link of a kind in a scope, if set.
 *
 * No building-wide fallback for a unit, unlike `mediaForUnit`: these render as
 * single-value fields, and inheriting the building's would make a suite look like
 * it had its own.
 */
export function linkInScope(
  all: MediaLink[],
  kind: MediaLink["kind"],
  unitId: string | null,
): MediaLink | undefined {
  const scoped = unitId ? ownedByUnit(all, unitId) : buildingWide(all);
  return scoped.find((l) => l.kind === kind);
}

/**
 * Set, replace or clear the one link of a kind in a scope.
 *
 * The model is a list so it needs no per-unit grain of its own, but the UI shows
 * exactly one row per kind — so this upserts rather than appends. Two records of
 * one kind in one scope would leave the second unreachable in the UI while still
 * sitting in the data.
 *
 * An empty or whitespace url removes the record rather than storing a blank,
 * so "cleared" and "never set" are the same state.
 */
export function upsertLink(
  all: MediaLink[],
  kind: MediaLink["kind"],
  unitId: string | null,
  url: string,
): MediaLink[] {
  const existing = linkInScope(all, kind, unitId);
  if (url.trim() === "") {
    return existing ? all.filter((l) => l.id !== existing.id) : all;
  }
  if (!existing) {
    return [...all, { id: `${unitId ?? "building"}-${kind}`, url, kind, unitId }];
  }
  return all.map((l) => (l.id === existing.id ? { ...l, url } : l));
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
bun --bun run test mediaLinks
bunx tsc --noEmit
```
Expected: pass, clean.

- [ ] **Step 5: Write `MediaLinksSection.tsx`**

```tsx
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import type { MediaScope } from "./mediaScope";
import { LINK_KINDS, linkInScope, upsertLink } from "./mediaLinks";

/**
 * The three named destinations for one scope — one row each, not an add-more list.
 * `upsertLink` is what keeps that true in the data.
 */
export function MediaLinksSection({ scope }: { scope: MediaScope }) {
  const all = scope.marketing.links ?? [];

  return (
    <div className="d-flex flex-column gap-2">
      <h3 className="fs-6 fw-semibold mb-0">Links</h3>
      <div className="d-flex flex-column gap-3">
        {LINK_KINDS.map(({ kind, label }) => {
          const current = linkInScope(all, kind, scope.unitId);
          if (scope.readOnly) {
            return (
              <div key={kind} className="d-flex flex-column">
                <span className="small fw-semibold">{label}</span>
                {current?.url ? (
                  <a href={current.url} target="_blank" rel="noreferrer" className="text-truncate">
                    {current.url}
                  </a>
                ) : (
                  <span className="text-muted small">Not set</span>
                )}
              </div>
            );
          }
          return (
            <Field key={kind}>
              <Field.Label>{label}</Field.Label>
              <input
                className="form-control"
                placeholder="https://"
                value={current?.url ?? ""}
                onChange={(e) =>
                  scope.patchMarketing({
                    links: upsertLink(all, kind, scope.unitId, e.target.value),
                  })
                }
              />
            </Field>
          );
        })}
      </div>
    </div>
  );
}
```

`Field.Label` is inside a `<Field>` here — a `Field.*` part rendered outside one throws at runtime and `tsc` does not catch it.

> Write `<Field>`, **not** `<Field.Root>`. Blueprint exports `Object.assign(FieldRoot, { Label, Description, … })`, so `Field` *is* the root and has no `.Root` property. The trap: Base UI's runtime error says "Field parts must be placed within `<Field.Root>`", naming the primitive it wraps rather than Blueprint's export. Every call site in this repo uses bare `<Field>`.

> **Use Blueprint's `Input` for the editable row**, not a raw `<input>` — `import { Input } from "@buildoutinc/blueprint-react/ui/Input";` and swap `<input className="form-control" …>` for `<Input …>` with the same props. It only adds `form-control`, so it is a strict drop-in and needs no extra wrapper. Same reasoning as Task 4: raw `form-control` markup exists in one file in the entire codebase.

- [ ] **Step 6: Write `VisualMediaGallery.tsx`**

```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan, faArrowUpRight } from "@fortawesome/pro-regular-svg-icons";
import type { VisualMediaLink, VisualMediaType } from "#/data/types";
import { buildingWide, ownedByUnit } from "#/data/unitScopedMarketing";
import { VISUAL_MEDIA_TYPES } from "./visualMediaTypes";
import type { MediaScope } from "./mediaScope";

/**
 * Visual Media for one scope: repeatable rows of preset embed types.
 *
 * Shares `VISUAL_MEDIA_TYPES` with the listing form's `VisualMediaSection` so the
 * two dropdowns cannot offer different subsets of the same union.
 */
export function VisualMediaGallery({ scope }: { scope: MediaScope }) {
  const all = scope.marketing.visualMedia ?? [];
  const rows = scope.unitId ? ownedByUnit(all, scope.unitId) : buildingWide(all);

  const add = () =>
    scope.patchMarketing({
      visualMedia: [
        ...all,
        {
          // A uuid, not an id derived from `all.length`: a derived index is
          // recomputed from current state each time, so remove-then-add reuses a
          // live id, and both `update` and `remove` match on `l.id`. Determinism
          // is only wanted in the seed fixtures, which are snapshotted; ids minted
          // by a user clicking Add are not. Same reason `addSpaceToDeal` and
          // `emptyVisualMediaLink` use `crypto.randomUUID()`.
          id: crypto.randomUUID(),
          url: "",
          mediaType: VISUAL_MEDIA_TYPES[0],
          unitId: scope.unitId,
        } satisfies VisualMediaLink,
      ],
    });

  const update = (id: string, patch: Partial<VisualMediaLink>) =>
    scope.patchMarketing({
      visualMedia: all.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });

  const remove = (id: string) =>
    scope.patchMarketing({ visualMedia: all.filter((l) => l.id !== id) });

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="fs-6 fw-semibold mb-0">Visual Media</h3>
        {!scope.readOnly && (
          <Button variant="ghost" size="sm" onClick={add}>
            <FontAwesomeIcon icon={faPlus} />
            Add media
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="form-text">No visual media yet.</div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((l) => (
            <div key={l.id} className="d-flex align-items-center gap-2">
              {scope.readOnly ? (
                <>
                  <span className="small fw-semibold" style={{ minWidth: 160 }}>
                    {l.mediaType}
                  </span>
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-truncate">
                      {l.url} <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 12 }} />
                    </a>
                  ) : (
                    <span className="text-muted small">Not set</span>
                  )}
                </>
              ) : (
                <>
                  {/* MEDIA_TYPE_SELECT — see the note below this code block */}
                  <div style={{ maxWidth: 200, width: "100%" }}>{/* type picker */}</div>
                  <Input
                    placeholder="https://"
                    value={l.url}
                    onChange={(e) => update(l.id, { url: e.target.value })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => remove(l.id)}>
                    <FontAwesomeIcon icon={faTrashCan} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**MEDIA_TYPE_SELECT — the type picker.** Replace that placeholder `<div>` with Blueprint's `Select`, not a raw `<select>`. **Read `src/components/listings/edit/fieldWidgets.tsx:236-262` first** — its `SelectField` shows this repo's exact `Select.Root` / `Trigger` / `Value` / `Content` / `Item` composition, including how `Select.Value`'s render-prop callback works. Copy that inner structure but **drop the `Field` and `Field.Label` wrapper**: these rows are unlabelled, and one label per row would be noise.

The wiring you need: `value={l.mediaType}`, `onValueChange={(v) => v && update(l.id, { mediaType: v as VisualMediaType })}`, one `Select.Item` per entry in `VISUAL_MEDIA_TYPES`, and `style={{ maxWidth: 200 }}` on the trigger so the url input keeps the rest of the row.

Do not reuse `SelectField` itself — it renders a `Field.Label`, which is exactly what does not belong here.

- [ ] **Step 7: Verify the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

- [ ] **Step 8: Commit**

```bash
git add src/components/listings/media/
git commit -m "$(cat <<'EOF'
feat(media): add the links section and the visual-media gallery

Links renders three single-value rows — Video URL, Matterport, Virtual Tour —
while the model stays a list, so it needs no per-unit grain of its own.
`upsertLink` is what makes that safe: it replaces rather than appends, because two
records of one kind in one scope would leave the second unreachable in the UI
while still sitting in the data. Clearing a url removes the record, so "cleared"
and "never set" are one state.

Neither Links nor Visual Media falls back to the building for a unit, unlike
`mediaForUnit`. A suite showing the building's video URL in its own single-value
field would read as the suite's own.

`VisualMediaGallery` shares `VISUAL_MEDIA_TYPES` with the listing form so the two
dropdowns cannot drift apart.
EOF
)"
```

---

### Task 6: The building's Media page

**Files:**
- Create: `src/components/listings/media/BuildingMediaSpaces.tsx`
- Rewrite: `src/components/listings/ListingMedia.tsx` (currently 40 lines)
- Modify: `src/routes/_shell/listings/$listingId/media.tsx` — pass `property`, and switch to a reactive store read

**Interfaces:**
- Consumes: `MediaScope`, `MediaAssetGrid` (Task 4); `MediaLinksSection`, `VisualMediaGallery` (Task 5).
- Produces: `<ListingMedia listing={…} property={…} />` — the building's four-section composition. Note the **changed signature**: it takes `property` now, and Task 7 stops using it for the space page entirely.

- [ ] **Step 1: Write `BuildingMediaSpaces.tsx`**

```tsx
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import { useState } from "react";
import type { DealMarketing, Property } from "#/data/types";
import { MediaAssetGrid } from "./MediaAssetGrid";
import { MediaLinksSection } from "./MediaLinksSection";
import { VisualMediaGallery } from "./VisualMediaGallery";
import type { MediaScope } from "./mediaScope";

/**
 * Per-suite media at the building level: one collapsible per unit, each holding
 * the same four sections a space's own Media tab shows.
 *
 * Iterates `Property.units`, including units with no deal. Media describes
 * physical space, which exists whether or not a deal sits on it — a broker
 * photographing a vacant unworked suite needs somewhere to put the photo.
 */
export function BuildingMediaSpaces({
  property,
  marketing,
  patchMarketing,
}: {
  property: Property;
  marketing: DealMarketing;
  patchMarketing: (patch: Partial<DealMarketing>) => void;
}) {
  const [open, setOpen] = useState<string | null>(property.units[0]?.id ?? null);

  return (
    <div className="d-flex flex-column gap-2">
      <h3 className="fs-6 fw-semibold mb-0">Spaces</h3>
      {property.units.map((unit) => {
        const scope: MediaScope = { marketing, patchMarketing, unitId: unit.id };
        const isOpen = open === unit.id;
        const counts = [
          (marketing.photos ?? []).filter((p) => p.unitId === unit.id).length,
          (marketing.visualMedia ?? []).filter((v) => v.unitId === unit.id).length,
          (marketing.links ?? []).filter((l) => l.unitId === unit.id).length,
        ];
        const total = counts.reduce((a, b) => a + b, 0);

        return (
          <Collapsible
            key={unit.id}
            open={isOpen}
            onOpenChange={(o) => setOpen(o ? unit.id : null)}
            className="border rounded"
          >
            <Collapsible.Trigger className="d-flex align-items-center gap-2 w-100 border-0 bg-transparent p-2 text-body">
              <FontAwesomeIcon
                icon={faChevronRight}
                style={{
                  fontSize: 12,
                  transition: "transform 0.15s ease",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
              <span className="fw-semibold">{unit.label}</span>
              <span className="text-muted small ms-auto">
                {total === 0 ? "No media" : `${total} item${total === 1 ? "" : "s"}`}
              </span>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div className="d-flex flex-column gap-4 p-3 pt-0">
                <MediaAssetGrid
                  scope={scope}
                  kind="photo"
                  title="Space Photos"
                  emptyHint="No photos of this suite yet."
                />
                <MediaAssetGrid
                  scope={scope}
                  kind="floorPlan"
                  title="Floor Plan"
                  emptyHint="No floor plan uploaded for this suite."
                />
                <VisualMediaGallery scope={scope} />
                <MediaLinksSection scope={scope} />
              </div>
            </Collapsible.Content>
          </Collapsible>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `ListingMedia.tsx`**

```tsx
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import type { DealMarketing, Listing, Property } from "#/data/types";
import { updateDealMarketing } from "#/data/actions";
import { ListingPageHeader } from "./ListingPageHeader";
import { MediaAssetGrid } from "./media/MediaAssetGrid";
import { MediaLinksSection } from "./media/MediaLinksSection";
import { VisualMediaGallery } from "./media/VisualMediaGallery";
import { BuildingMediaSpaces } from "./media/BuildingMediaSpaces";
import type { MediaScope } from "./media/mediaScope";

/**
 * A building's Media library: its own photos and embeds, its suites' media, and
 * its three named destinations.
 *
 * This page owns the write path for EVERY asset on the property, including each
 * suite's — a unit's media lives in the building's `marketing` and nowhere else.
 * A space's Media tab is a filtered editor onto this same data (see `SpaceMedia`).
 */
export function ListingMedia({
  listing,
  property,
}: {
  listing: Listing;
  property: Property;
}) {
  const patchMarketing = (patch: Partial<DealMarketing>) => {
    updateDealMarketing(listing.id, patch);
  };
  const buildingScope: MediaScope = {
    marketing: listing.marketing,
    patchMarketing,
    unitId: null,
  };

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Media" />

      <MediaAssetGrid
        scope={buildingScope}
        kind="photo"
        title="Property Photos"
        emptyHint="No property photos yet."
      />

      <Separator />
      <VisualMediaGallery scope={buildingScope} />

      {/* Only when the property is actually divided. A listing with no units has
          no suites to show, and an empty "Spaces" heading reads as a bug. */}
      {property.units.length > 0 && (
        <>
          <Separator />
          <BuildingMediaSpaces
            property={property}
            marketing={listing.marketing}
            patchMarketing={patchMarketing}
          />
        </>
      )}

      <Separator />
      <MediaLinksSection scope={buildingScope} />
    </div>
  );
}
```

The old `listingGallery` import goes; the modelled library replaces the derived grid **on this page only**. `listingGallery` keeps every other caller.

- [ ] **Step 3: Fix the route — it must subscribe to the store**

`src/routes/_shell/listings/$listingId/media.tsx` currently reads `getStore().listings.get(listingId)`, a **non-reactive snapshot**. That was fine for a read-only grid, but an editable page will not re-render after an edit, so uploads and caption changes would appear to do nothing.

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { ListingMedia } from "#/components/listings/ListingMedia";

export const Route = createFileRoute("/_shell/listings/$listingId/media")({
  component: MediaRoute,
});

function MediaRoute() {
  const { listingId } = Route.useParams();
  // `useDataStore`, not `getStore()`: this page writes, so it has to re-render on
  // its own edits. A snapshot read leaves an upload looking like a no-op.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;
  const property = getProperty(listing.propertyId);
  if (!property) return null;

  return <ListingMedia listing={listing} property={property} />;
}
```

If `updateDealMarketing` does not produce a new `Listing` object identity, a `.get()` selector will compare equal and skip the re-render — check `patchListing` and report if so; the fix is to select the map (`(s) => s.listings`) the way `useSpaceRoute` does, and it documents exactly this hazard.

- [ ] **Step 4: Verify the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```
Expected: clean. `tsc` will flag the space route (`spaces/$spaceId/media.tsx`) because `ListingMedia` now requires `property` — that is expected and Task 7 fixes it. **If you need a green `tsc` to commit, pass `property={record.property}` there as a stopgap and note it**; Task 7 replaces that call entirely.

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/ListingMedia.tsx src/components/listings/media/BuildingMediaSpaces.tsx 'src/routes/_shell/listings/$listingId/media.tsx' 'src/routes/_shell/listings/$listingId_/spaces/$spaceId/media.tsx'
git commit -m "$(cat <<'EOF'
feat(media): give the building a real four-section Media page

Property Photos, Visual Media, Spaces and Links, replacing forty lines that
rendered a hash-derived photo grid and a non-functional Upload button.

This page owns the write path for every asset on the property, including each
suite's, because a unit's media lives in the building's marketing and nowhere
else. Spaces iterates `Property.units` rather than child deals — media describes
physical space, which exists whether or not a deal sits on it, so a vacant
unworked suite still has somewhere to put a photo. The section hides entirely when
a property has no units, since an empty "Spaces" heading reads as a bug.

The route had to change too: it read `getStore().listings.get(id)`, a
non-reactive snapshot. Fine for a read-only grid, wrong for a page that writes —
an upload would have appeared to do nothing.

`listingGallery` is no longer read on this page but keeps every other caller;
the modelled library sits beside the derivation rather than replacing it.
EOF
)"
```

---

### Task 7: The space's Media page

**Files:**
- Create: `src/components/listings/media/SpaceMedia.tsx`
- Modify: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/media.tsx`

**Interfaces:**
- Consumes: `MediaScope`, `MediaAssetGrid` (Task 4); `MediaLinksSection`, `VisualMediaGallery` (Task 5).
- Produces: `<SpaceMedia shell={…} unitId={…} unitLabel={…} />`.

**The whole one-home rule is one line here:** the scope is built from `shell.marketing` and patches `shell.id`, so a suite edits its building's data.

- [ ] **Step 1: Write `SpaceMedia.tsx`**

```tsx
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRight } from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import type { DealMarketing, Listing } from "#/data/types";
import { updateDealMarketing } from "#/data/actions";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { MediaAssetGrid } from "./MediaAssetGrid";
import { MediaLinksSection } from "./MediaLinksSection";
import { VisualMediaGallery } from "./VisualMediaGallery";
import type { MediaScope } from "./mediaScope";

/**
 * A suite's Media tab: the four sections it owns, editable, then a separated
 * read-only block for what it inherits from the building.
 *
 * Both scopes read and write the SHELL's marketing — a unit's media has one home,
 * and this page is a filtered editor onto it, not an owner of a copy. That is why
 * `patchMarketing` targets `shell.id` and not the space's own id.
 *
 * The two blocks are separated rather than merged, which is a deliberate
 * departure from `mediaForUnit`'s fallback: the editable/read-only boundary is the
 * entire point of the page, and merging the lists into one grid would hide exactly
 * what this exists to communicate.
 */
export function SpaceMedia({
  shell,
  unitId,
  unitLabel,
}: {
  shell: Listing;
  unitId: string;
  unitLabel: string;
}) {
  const patchMarketing = (patch: Partial<DealMarketing>) => {
    updateDealMarketing(shell.id, patch);
  };
  const own: MediaScope = { marketing: shell.marketing, patchMarketing, unitId };
  const inherited: MediaScope = {
    marketing: shell.marketing,
    patchMarketing,
    unitId: null,
    readOnly: true,
  };

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Media" />

      <MediaAssetGrid
        scope={own}
        kind="photo"
        title="Space Photos"
        emptyHint={`No photos of ${unitLabel} yet.`}
      />

      <Separator />
      <MediaAssetGrid
        scope={own}
        kind="floorPlan"
        title="Floor Plan"
        emptyHint="No floor plan uploaded for this suite."
      />

      <Separator />
      <VisualMediaGallery scope={own} />

      <Separator />
      <MediaLinksSection scope={own} />

      <Separator />
      <div className="d-flex flex-column gap-3">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <h2 className="fs-6 fw-semibold mb-0">From the building</h2>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/listings/$listingId/media" params={{ listingId: shell.id }} />}
          >
            Manage
            <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 12 }} />
          </Button>
        </div>
        <Alert severity="info" withIcon>
          <FontAwesomeIcon icon={faCircleInfo} />
          These are {shell.name}'s own assets, shown alongside this suite. They are
          managed on the building.
        </Alert>
        <MediaAssetGrid
          scope={inherited}
          kind="photo"
          title="Property Photos"
          emptyHint="The building has no property photos yet."
        />
        <VisualMediaGallery scope={inherited} />
      </div>
    </div>
  );
}
```

`pro-duotone` for the `Alert` icon, `pro-regular` everywhere else — the repo's rule. Building-wide **Links** are deliberately not mirrored here: the block shows the marketing imagery a prospect sees beside this suite, and a building-level video URL is a property destination rather than something that reads as the suite's.

- [ ] **Step 2: Point the route at it**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { getListing } from "#/data/store";
import { SpaceMedia } from "#/components/listings/media/SpaceMedia";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/media",
)({ component: SpaceMediaRoute });

function SpaceMediaRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  const shell = getListing(listingId);
  if (!record || !shell) return null;

  // Media is keyed to a suite — every asset here is scoped by `unitId`. A space
  // whose `unitId` is dangling has no suite to scope to, so it says so rather
  // than rendering an editor bound to nothing. Same treatment as `details.tsx`.
  if (!record.unit) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No suite" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>This space is not linked to a suite</Empty.Title>
            Its media is scoped to a unit on the property record, and that unit is
            missing.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return <SpaceMedia shell={shell} unitId={record.unit.id} unitLabel={record.label} />;
}
```

`useSpaceRoute` already subscribes to the store, so edits re-render here without further work.

- [ ] **Step 3: Verify the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```
Expected: clean, and any stopgap `property=` prop added to this route in Task 6 is now gone.

- [ ] **Step 4: Commit**

```bash
git add src/components/listings/media/SpaceMedia.tsx 'src/routes/_shell/listings/$listingId_/spaces/$spaceId/media.tsx'
git commit -m "$(cat <<'EOF'
feat(media): give a suite its own four editable sections

Space Photos, Floor Plan, Visual Media and Links — the suite's own assets, so
editable here per "ownership follows the asset, not the page" — then a separated
read-only block for the building's property photos and visual media, with a
pointer up.

Both scopes read and write the SHELL's marketing. That single detail is the
one-home rule: a unit's media lives in the building's marketing, and this page is
a filtered editor onto it rather than the owner of a second copy. Edit a suite
photo here and it appears under that unit in the building's Media -> Spaces,
because it is the same record.

The two blocks are separated rather than merged, a deliberate departure from
`mediaForUnit`'s fallback semantics: the editable/inherited boundary is the entire
point of the page, and one merged grid would hide exactly what this exists to
communicate.

Building-wide Links are not mirrored — the block shows the imagery a prospect sees
beside this suite, and a building-level video URL is a property destination rather
than the suite's. A space with a dangling `unitId` gets the same empty state
`details.tsx` uses, since every asset here is scoped by unit.
EOF
)"
```

---

### Task 8: Browser verification, then retire the spec

**Files:**
- Delete: `docs/superpowers/specs/2026-08-11-media-per-space-assets-design.md`

- [ ] **Step 1: Start the dev server**

```bash
bun --bun run dev
```
Serves at `http://localhost:3000`. Joel may already have one running — check `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` first and reuse it rather than starting a second.

- [ ] **Step 2: Clear IndexedDB before trusting anything**

`SEED_VERSION` moved to 41, which *should* invalidate the old snapshot — but stale IndexedDB masking seed edits has burned sessions here before. The Playwright MCP server runs `--isolated`, so each browser session starts from a clean profile and re-seeds; confirm the seeded media actually rendered rather than assuming the bump did its job.

- [ ] **Step 3: Verify the building's page**

Navigate to a seeded lease shell's Media section (e.g. "Meridian Business Park"). Confirm:
- Four sections render: Property Photos, Visual Media, Spaces, Links.
- Property Photos shows real seeded images, and the building's Links has the seeded video URL.
- Spaces lists **all** units, including ones with no deal, and each expands to the four sub-sections.
- At least one unit shows photos + a floor plan; at least one shows nothing ("No media").

Playwright gotchas, each of which has already cost a session: never `waitUntil: "networkidle"` (Vite's HMR websocket never idles); `browser_navigate` returns before hydration, so always follow it with `browser_wait_for` on destination-unique text; scope selectors to `main.app-shell__main` (devtools inject a hidden `<h3>Tanstack Router</h3>`); don't wait on generic "page has text" during client-side nav; lists are Blueprint cards, not tables; snapshots run ~580 lines and are written to `.playwright-mcp/` — grep them rather than reading whole.

- [ ] **Step 4: Verify a suite's page**

Open a suite of that shell → Media. Confirm the four editable sections, then the separated **"From the building"** block with its info Alert, `Manage ↗` button, and the building's property photos rendered read-only (no Add button, no Remove, no URL inputs).

- [ ] **Step 5: Verify the one-home rule through the UI**

This is the check the whole phase exists for:
1. On the suite's Media, add a Space Photo and give it a URL and caption.
2. Navigate to the building's Media → Spaces → that unit.
3. The same asset must be there.

Then the reverse: edit the caption at the building, return to the suite, confirm the change shows. If either direction fails, the scope is patching the wrong listing — report it, don't patch around it.

- [ ] **Step 6: Check the console and close the browser**

Run `browser_console_messages` and confirm no errors. Then `browser_close` — **required**; the browser does not exit on its own and orphans ~8 Chrome processes plus a temp profile. Leave the MCP server running.

- [ ] **Step 7: Run both gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

- [ ] **Step 8: Retire the spec**

Anything tried-and-reverted goes into the PR body **before** this delete — that lesson is the one thing a deleted spec takes with it.

```bash
git rm docs/superpowers/specs/2026-08-11-media-per-space-assets-design.md
git commit -m "$(cat <<'EOF'
chore(docs): retire the shipped per-space media spec

A spec in docs/superpowers/specs/ means the work is live, so a shipped one is
deleted with its branch. Its reasoning lives in the commit bodies on this branch
and in the PR description.

Recover with
`git show <this-commit>^:docs/superpowers/specs/2026-08-11-media-per-space-assets-design.md`.
EOF
)"
```

- [ ] **Step 9: Hand off**

Do not merge. Report the gate output to Joel and open the PR via `/ship` on his approval.

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task:

| Spec section | Task |
|---|---|
| Model — `MediaAsset`, `MediaLink`, optional `DealMarketing` fields | 1 |
| `unitScopedMarketing` — `ownedByUnit`, `buildingWide`, `mediaForUnit` unchanged | 1 |
| One home per asset — `addSpaceToDeal` empties the three lists | 2 |
| Seed fixtures, uneven distribution, `listingGallery`-derived, faker-free | 3 |
| `SEED_VERSION` 40 → 41 | 3 |
| `visualMediaTypes.ts` extraction | 4 |
| `MediaAssetGrid` (Property Photos, Space Photos, Floor Plan; readOnly variant) | 4 |
| Building-wide floor plan is not a surface | 4 (`assetsInScope` filters on `kind`; test asserts it) |
| `MediaLinksSection` — three single-value rows | 5 |
| `VisualMediaGallery` — 7 preset types | 5 |
| Building → Media: four sections | 6 |
| `BuildingMediaSpaces` — iterates `Property.units`, not deals | 6 |
| Space → Media: four editable + separated read-only block | 7 |
| `Manage ↗` pointing at `/listings/{shellId}/media` | 7 |
| Building-wide Links not mirrored on the space | 7 |
| Testing — helpers, no-clone, fixtures, persistence | 1, 2, 3 |
| Browser verification incl. the one-home round-trip | 8 |
| Gates | every task |

Three things the spec did not anticipate, added here:

1. **The building's media route is non-reactive** (`getStore()`), so an editable page would not re-render on its own edits. Fixed in Task 6.
2. **`ListingMedia` gains a `property` prop**, which transiently breaks the space route's `tsc` between Tasks 6 and 7 — called out in Task 6 Step 4 with a stopgap.
3. **Spaces hides when `property.units` is empty.** The spec said "one collapsible per unit" without saying what a unit-less listing shows; an empty heading reads as a bug. Stated as an assumption.

**Placeholder scan.** No "TBD", "TODO", "similar to Task N", or "add appropriate error handling". Every code step carries real code. Two steps deliberately hand a judgment back rather than guessing — the `Input`-vs-`form-control` note in Task 4 Step 6 and the store-identity note in Task 6 Step 3 — and both name the concrete fallback.

**Type consistency.** `MediaScope` is declared in Task 4 and consumed by name in Tasks 4–7. `assetsInScope(marketing, unitId, kind)`, `addAsset(all, asset)`, `removeAsset(all, id)`, `upsertLink(all, kind, unitId, url)`, `linkInScope(all, kind, unitId)` and `LINK_KINDS` are each declared once and used with those exact signatures. `MediaAsset.caption` is non-optional throughout, so every construction site sets it (`""` where empty). `ListingMedia`'s new two-prop signature is used consistently in Task 6. `SpaceMedia({ shell, unitId, unitLabel })` matches its single call site.
