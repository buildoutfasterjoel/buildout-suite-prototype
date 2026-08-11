# Media — per-space assets — Phase B

**Status:** in flight. Delete this file with the branch (`chore(docs):`) once shipped; carry
anything tried-and-reverted into the PR body first.

**Companion spec:** `2026-08-11-space-marketing-ownership-design.md` (Phase A), which
establishes the ownership rule this spec relies on and removes the six building-owned
sections from the space nav. Phase A ships first. Phase B assumes its nav changes are in
place; nothing here re-opens them.

## Problem

Media is the thinnest section in the app and, as a result, the most confusing one. Today
`ListingMedia` is forty lines that render `listingGallery(listing.id)` — a photo grid derived
from an id hash — plus a non-functional Upload button. Nothing is modelled.

That derivation has a specific consequence for spaces: because the gallery is keyed to
`listing.id`, a suite shows a *different* set of photos from its building rather than a
subset of them. There is no way to see the photos that belong to a particular suite, and no
way to add one.

Separately, `addSpaceToDeal` spreads `...parent.marketing`, so a space holds a clone of
`visualMedia`. Any per-space media work has to resolve which copy is authoritative before it
can be correct.

## The rule this inherits

**Ownership follows the asset, not the page** (Phase A).

Media is the section that makes the rule earn its keep. A suite's photos, floor plan, visual
media and links are the *suite's own assets*, so they are editable on the space page. The
building's property photos and building-wide visual media are not, so on a space they render
read-only with a pointer up. Both live on one page, visibly separated.

## One home per asset

**A unit's media lives in the building's `marketing`, and nothing else.** The space's Media
tab is a filtered editor onto it: it reads `shell.marketing` and writes
`updateDealMarketing(shell.id, …)`.

This matters because the alternative is already latent in the code. If the space edited its
cloned `marketing`, the building's Media → Spaces section — which reads the *building's*
lists — would never see the change. Two homes for one suite's photos, and nothing to say
which one a public surface reads. That is the divergence Phase A closed for six sections by
removing them; Media cannot be closed that way because the space genuinely needs to edit
here, so it is closed by making the space a view onto the parent instead.

`addSpaceToDeal` therefore stops copying the three media lists onto the child and sets them
empty, so no stale copy can be read.

This is the space-deal backlog's "make a space's marketing a *reference* to its parent rather
than a clone — the real fix", scoped to the three media fields rather than all of
`DealMarketing`. The rest of the clone is out of scope and stays as it is.

## Structure

Eight surfaces, all filters over three uniform lists.

### Building → Media

| Section | Data |
|---|---|
| Property Photos | `photos` where `unitId == null`, `kind: 'photo'` |
| Visual Media | `visualMedia` where `unitId == null` — the 7 preset embed types, gallery presentation |
| Spaces | one collapsible per `Property.units` entry, each holding the four space sections |
| Links | `links` where `unitId == null` |

A building-wide floor plan — `kind: 'floorPlan'` with `unitId == null` — has no section to
render in and is therefore not a modelled surface. The seed must not create one, and the
upload controls cannot produce one, since `kind: 'floorPlan'` is only offered inside a
unit's scope. `MediaAssetGrid` filters on `kind` rather than assuming, so such a record would
be silently ignored rather than misplaced.

### Space → Media

The same four, scoped to `space.unitId`, all editable:

| Section | Data |
|---|---|
| Space Photos | `photos` where `unitId === space.unitId`, `kind: 'photo'` |
| Floor Plan | `photos` where `unitId === space.unitId`, `kind: 'floorPlan'` |
| Visual Media | `visualMedia` where `unitId === space.unitId` |
| Links | `links` where `unitId === space.unitId` |

Then a **"From the building"** block below: read-only, with an info Alert and a `[Manage ↗]`
action pointing at `/listings/{shellId}/media`.

It mirrors exactly two of the building's sections — **Property Photos and building Visual
Media**. Building-wide Links are omitted: the block exists to show the marketing imagery a
prospect sees alongside this suite, and a building-level video URL is a property-level
destination rather than something that reads as this suite's. If it turns out brokers expect
it there, adding it is a one-line filter change.

**Separated, not merged.** The editable/read-only boundary is the entire point of the page —
merging the two lists into one grid would hide exactly the thing this work exists to
communicate. This is a deliberate departure from `mediaForUnit`, whose fallback semantics
merge them; see below.

### Spaces lists units, not deals

The building's Spaces section iterates `Property.units`, including units with no deal.
`VisualMediaLink.unitId` already keys to `PropertyUnit` — the physical asset — and media
describes physical space, which exists whether or not a deal sits on it. A broker
photographing a vacant unworked suite should have somewhere to put the photo.

### Visual Media vs Links

They overlap in the model and are still separate sections, deliberately. Visual Media is a
gallery of preset embed types — `Interactive Site Plan`, `Aerial 360 Map`,
`Aerial 360 Rendering`, `360 Rendering`, `Property Marketing Video`, `Matterport Tour`,
`360 Tour` — added repeatably from a type dropdown. Links is three named destinations: Video
URL, Matterport Link, Virtual Tour Link.

Links renders **three single-value rows, one per `kind`** — not an add-more list. The model
stays a list so it needs no new per-unit grain; singularity is a UI property.

### Floor Plan is not Plans

Media's Floor Plan is an uploaded asset depicting a suite's layout. The `Plans` nav section
is an editor for highlighting plans within the building. They share a word, not a purpose.
Plans stays a building-owned stub and is not touched by either phase.

## Model

Added to `src/data/types.ts`:

```ts
export type MediaAssetKind = 'photo' | 'floorPlan'

/** An uploaded image or document. `unitId` null = the whole building. */
export interface MediaAsset {
  id: string
  url: string
  kind: MediaAssetKind
  caption: string
  /** The space this asset depicts, when it depicts one. Null = whole building. */
  unitId: string | null
}

/** One of the three named marketing destinations. `unitId` null = the whole building. */
export interface MediaLink {
  id: string
  url: string
  kind: 'video' | 'matterport' | 'virtualTour'
  unitId: string | null
}
```

`DealMarketing` gains `photos?: MediaAsset[]` and `links?: MediaLink[]`.

**Optional, matching `visualMedia?: VisualMediaLink[]`** in the same "Listing-form additions"
block. Six sites construct a `marketing:` literal (`timeline.ts:312`,
`savePatches.ts:55`, `leaseSpaces.ts:71`, `seed.ts:1451`, `leaseSpaceFixtures.ts:242`,
`createListing.ts:700`); required fields would force all six to grow two empty arrays for no
gain, and the existing precedent already says optional.

`VisualMediaLink` is unchanged. Every list carries the same `unitId: string | null`
discriminator it introduced.

### `src/data/unitScopedMarketing.ts`

Generalised over `{ unitId: string | null }`, the way `leadsForSpaceDeal` is already generic
over `{ inquiredListingIds }`. Three exports:

- `ownedByUnit(list, unitId)` — **strictly** the unit's own. Powers the space's four editable
  sections.
- `buildingWide(list)` — `unitId == null` only. Powers the building's four sections and the
  space's read-only block.
- `mediaForUnit(list, unitId)` — unchanged: the unit's own *plus* building-wide. Kept for
  public and preview surfaces, where a suite with no photos of its own should still show the
  building's. The Media *editor* deliberately does not use it, because it needs the two sets
  apart.

The file's existing comment explaining why Leads does not fall back and media does stays,
and gains a note on why the editor splits what `mediaForUnit` merges.

### `src/data/leaseSpaces.ts`

`addSpaceToDeal`'s `marketing` literal sets `photos: []`, `links: []`, `visualMedia: []` on
the child, overriding the `...parent.marketing` spread. Comment states the one-home rule.

### `src/data/seed.ts` + `SEED_VERSION`

`SEED_VERSION` moves from 40 to 41 (`src/data/persistence.ts:5`).

Seeded content, in `leaseSpaceFixtures.ts` alongside the existing per-unit rent roll and
lease terms: for each of the two lease shells, building-wide property photos and visual
media; and for each of their ten units, a couple of space photos, one floor plan, and a
subset of links — deliberately uneven, so the UI is exercised against units that have
everything, units that have only photos, and units that have nothing.

**Photo URLs derive from `listingGallery`**, so the modelled library and the photos already
shown on deal cards, in the publish preview and on `SpaceDetailHeader` agree by construction
rather than by coincidence. `listingGallery` stays exactly where it is and keeps its current
callers; this spec adds a modelled library beside it, it does not replace the derivation.

**No faker draws.** `leaseSpaceFixtures.ts:458` records why: `generateDataset` keeps drawing
after this pass, so any draw added here shifts every downstream draw and breaks unrelated
seed tests. `listingGallery` is deterministic, which is what makes this approach viable.

## Components

New folder `src/components/listings/media/`:

| File | Responsibility |
|---|---|
| `MediaAssetGrid.tsx` | A grid of `MediaAsset`s. `readOnly` variant drops the upload and per-item controls. Used by Property Photos, Space Photos and Floor Plan. |
| `MediaLinksSection.tsx` | The three named URL rows for one scope. |
| `VisualMediaGallery.tsx` | `VisualMediaLink`s in gallery presentation, with the preset type dropdown. |
| `BuildingMediaSpaces.tsx` | One `Collapsible` per `Property.units` entry, composing the four space sections. |
| `SpaceMedia.tsx` | The space page: four editable sections, then the read-only "From the building" block. |
| `visualMediaTypes.ts` | The 7-item preset list, extracted from where it is currently inlined in the edit form's `VisualMediaSection.tsx`, so the two presentations cannot drift. |

`src/components/listings/ListingMedia.tsx` becomes the building's four-section composition.

Filenames must not collide case-insensitively with each other — macOS resolves
`Component.tsx`/`component.ts` pairs to the wrong file and rollup fails. `visualMediaTypes.ts`
against `VisualMediaGallery.tsx` is fine; keep it that way if files are added.

`src/routes/_shell/listings/$listingId_/spaces/$spaceId/media.tsx` passes the shell and
`space.unitId` instead of `record.space`. `useSpaceRoute` already returns `unit`, and the
existing `details.tsx` precedent shows the empty state for a space whose `unitId` is
dangling — Media follows it.

Blueprint components throughout, `pro-regular` icons, `pro-duotone` only for Alert and
Banner. No margin utilities on Badge icons — Badge already has a flex gap. No `fixedWidth` on
`FontAwesomeIcon`. Any `Field.Label`/`Field.Description` must sit inside a `Field.Root`;
detached helper text uses `form-text`.

## Testing

Vitest, logic only — no committed E2E suite in this repo.

- `unitScopedMarketing`: `ownedByUnit` excludes building-wide assets; `buildingWide` excludes
  unit-scoped ones; the two are disjoint and their union is `mediaForUnit`; `mediaForUnit`'s
  existing fallback behaviour is unchanged; `leadsForSpaceDeal` still does not fall back.
- `leaseSpaces`: a child created by `addSpaceToDeal` has empty `photos`, `links` and
  `visualMedia` even when the parent has all three populated — the regression test for the
  one-home rule.
- `leaseSpaceFixtures`: the seeded shells have building-wide photos and visual media; the ten
  units have the intended uneven distribution; the pass still takes no faker draws.
- `persistence`: `SEED_VERSION` bump invalidates an older snapshot.
- Existing seed invariant tests updated for the new fields.

## Browser verification

Playwright MCP. Claude verifies breakage only; design review is Joel's.

**Delete the IndexedDB `keyval-store` first.** A moved `SEED_VERSION` should invalidate the
snapshot, but stale IndexedDB masking seed edits has burned sessions before — confirm the new
fixtures actually rendered rather than trusting that they did.

1. Building → Media renders four sections, with real seeded photos and links.
2. The Spaces section lists all units, including ones with no deal, and expands.
3. Space → Media renders the four editable sections plus the separated read-only "From the
   building" block.
4. Upload/add on a space section, then confirm the same asset appears under that unit in the
   building's Media → Spaces — the one-home rule, verified through the UI.
5. No console or page errors.

Per the repo's recorded gotchas: never `waitUntil: "networkidle"`; scope selectors to
`main.app-shell__main`; wait for destination-unique text after `browser_navigate`; snapshots
are large, so grep the files in `.playwright-mcp/` rather than reading them whole;
`browser_close` when finished.

## Gates

- `bunx tsc --noEmit` — `vite build` does **not** type-check
- `bun --bun run test`

## Out of scope

- Replacing `listingGallery` at its existing callers. The modelled library sits beside the
  derivation; rewiring deal cards, the publish preview and `SpaceDetailHeader` to read
  modelled photos is a separate, larger change.
- Real file upload. Uploads are not modelled anywhere in this prototype; "upload" adds a
  record pointing at a URL, consistent with how `VisualMediaLink` already works.
- The rest of the `...parent.marketing` clone. Only the three media lists stop being copied.
