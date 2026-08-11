# Space marketing ownership — Phase A

**Status:** in flight. Delete this file with the branch (`chore(docs):`) once shipped; carry
anything tried-and-reverted into the PR body first.

**Companion spec:** `2026-08-11-media-per-space-assets-design.md` (Phase B). Phase A ships
first and stands alone. Phase B assumes Phase A's nav changes are in place but does not
otherwise depend on them.

## Problem

A leased suite's marketing is controlled by its parent building, but the space page does not
say so. `visibleNavGroups` only swaps Listing → Details for a space, so a space renders very
nearly the building's whole Marketing group: Documents, Website, Email, Media, Demographics,
Grids and Plans all appear on the suite.

Worse, they are editable. `addSpaceToDeal` spreads `...parent.marketing`, so a space holds a
full *clone* of `DealMarketing`. Editing Website or Documents on a suite silently forks it
from the building, with nothing on either surface indicating which copy a public surface
reads.

This is item 1 of the space-deal Phase 2 backlog ("marketing divergence — the one with
teeth") plus item 2 (the building-vs-space scope table).

## The rule

**Ownership follows the asset, not the page.**

A building-wide asset is edited on the building no matter where you are standing. An asset
the suite itself owns is edited wherever you can see it.

This is the formulation that makes Phase B coherent: Media stays editable on a space without
contradicting "the building owns marketing", because the things a space edits there are
things the *suite* owns, not things the building lent it.

The codebase already encodes half of this rule. `buildingSectionListingId`
(`src/components/deals/dealCardLink.ts:31`) resolves a space to its parent for
building-level sections, and eight call sites use it. Phase A makes the sidebar agree with
what the outbound links already believed.

## Scope table

| Section | Owner | On a space |
|---|---|---|
| Documents, Website, Email, Demographics, Grids, Plans | Building | **Removed from nav** |
| Listing (the marketing form) | Building | Already hidden — swapped for Details |
| Details | Space | Stays — edits the suite's own fields |
| Leads | Both | Stays, filtered by `leadsForSpaceDeal` — no fallback |
| Media | Both | Stays, filtered — see Phase B |
| Deal group, Back Office group | — | Unchanged |

**Plans stays building-owned and stays a stub.** It is an editor for highlighting plans
within the building — a different thing from the floor-plan asset a broker uploads against a
lease space, which Phase B puts in Media. The two share a word, not a purpose. Both Plans
routes are currently identical `Empty`-state stubs with no component and no data model;
neither is touched.

## The "Building" nav item

The six removed items are replaced by a single item in the Marketing group:

- Label: **Building** — not "Building Marketing". The sidebar is 180px wide with `px-3`
  padding; the longer label wraps.
- Leading icon `faBuilding`, trailing `faArrowUpRight`.
- Target: `/listings/{shellId}/documents`. Documents rather than the building's Overview,
  because the user's intent in following this link is to edit marketing, and Documents is
  the first marketing section.

**It is rendered as a `Link` row, not a `Tabs.Tab`.** `PropertyDetailSidebar` renders each
group's items inside a `Tabs`/`Tabs.List` whose `value` is the active item's label. An item
that navigates to a *different record* can never match that value, so as a Tab it would
occupy the value space while being permanently inactive. A Link row sidesteps the mismatch
and is also the honest control: it leaves the page.

`Tabs.Tab` exposes a leading `icon` prop plus `children`
(`node_modules/@buildoutinc/blueprint-react/src/components/Tabs/index.tsx:60`), so a trailing
arrow would have to live in children. Not needed given the above, but recorded because it
was checked.

### The "you have left the space" cue

The breadcrumb collapse is the cue, and it is free. A space section paints five crumbs
(`All Deals / 1200 Market St. / Spaces / Suite 300 / Documents`); the building's Documents
page paints three (`All Deals / 1200 Market St. / Documents`). The `Spaces / Suite 300` pair
dropping away is the signal.

**No back-link and no `from` param.** Threading a `from` param through the space routes to
preserve provenance is exactly the pass that was reverted in `86990cc` — it required
`PROPERTY_ONLY`/`SHELL_ONLY` sidebar filters to fake building-level marketing on a space
page. Do not revisit it. The breadcrumb already links back down to the building, and from
there to Spaces.

## Changes

### `src/components/properties/dealNav.ts`

`visibleNavGroups` gains one rule: the six building-owned hrefs (`documents`, `website`,
`email`, `demographics`, `grids`, `plans`) return `false` when `shape === 'space'`. Written
as a single array membership test beside the existing `details`/`listing` swap, so the rule
and the items it governs stay in one file.

`NAV_GROUPS` is **not** given a Building entry. `dealBreadcrumbTrail` resolves section
labels by looking `href` up in `NAV_GROUPS`, and a pseudo-section that no URL segment
corresponds to has no business there.

### `src/components/properties/PropertyDetailSidebar.tsx`

New optional prop:

```ts
/**
 * A link out of this record's own sections, rendered at the foot of the Marketing
 * group. A space passes its building here: the building owns Documents, Website,
 * Email, Demographics, Grids and Plans, so the space's sidebar points at them
 * rather than pretending to hold them. Omitted by a building, which has no parent.
 */
buildingLink?: { label: string; to: string }
```

Rendered inside the Marketing group's `Collapsible.Content`, after that group's `Tabs`, so
it collapses with the group it belongs to. The group is matched by `group.label ===
"Marketing"`, with a comment saying why.

### `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx`

Passes `buildingLink={{ label: "Building", to: `/listings/${listingId}/documents` }}`.

### Deletions

Six route files under `src/routes/_shell/listings/$listingId_/spaces/$spaceId/`:
`documents.tsx`, `website.tsx`, `email.tsx`, `demographics.tsx`, `grids.tsx`, `plans.tsx`.

Deleted rather than left redirecting: a live route is a live divergence path, and in a
prototype nothing bookmarks these URLs.

**Verified safe.** A grep for inbound references to these six paths returns only
`routeTree.gen.ts` (auto-generated, regenerates on dev/build) and the route files
themselves. No component, no `useParams({ from })`, no `<a href>` targets one. This check
matters because `vite build` does not catch a broken route link.

### Leads call sites *(cuttable — cut this section, not the rest, if it feels like scope creep)*

`buildingSectionListingId`'s doc comment claims "Sections like Documents and Leads belong to
the building". Under this rule Leads does not — it stays on the space as a filtered view.
Three call sites send a space's Leads to the building:

- `src/components/contacts/ContactInquiryCard.tsx:62`
- `src/components/contacts/NewContactInquiryCard.tsx:71`
- `src/components/contacts/NewContactDealCard.tsx:124`

An inquiry recorded against Suite 300 should land on Suite 300's filtered Leads, where that
inquiry actually appears, rather than on the building's unfiltered list.

The three call sites cannot simply swap the `to`: a space's Leads route needs *both*
`listingId` (the parent) and `spaceId` (the space), and these callers hold only one id. So add
a `leadsSectionLink(listingId)` export to `src/components/deals/dealCardLink.ts`, returning a
`{ to, params }` pair — the same shape, and for the same reason, as the existing
`dealCardLink` at line 12, which already resolves a space to
`{ to: "/listings/$listingId/spaces/$spaceId/overview", params: { listingId: parentDealId,
spaceId: listing.id } }`. A space yields the space's Leads; everything else yields
`/listings/$listingId/leads` with its own id.

Then drop Leads from `buildingSectionListingId`'s doc comment, which will no longer be true
of it.

`EditorRoot.tsx:61` (Documents) and `PublishPreview.tsx:172` (Documents) and
`ai/tools.ts:405` (Client Report) are correct as-is and are not touched.

## Testing

Vitest, logic only — no committed E2E suite in this repo.

- `dealNav`: `visibleNavGroups` omits all six building-owned hrefs for `shape === 'space'`;
  retains all six for `shape === 'shell'` and for a plain deal; the existing
  `details`/`listing` swap and `vouchers`/`financials` swap still behave.
- A space's Marketing group is not emptied by the filter — Details, Leads and Media survive,
  so the group still renders.

## Browser verification

Playwright MCP. Claude verifies breakage only; design review is Joel's.

1. Navigate to a seeded lease shell's Spaces tab, open a space.
2. Sidebar's Marketing group shows Details, Leads, Media, and a **Building ↗** row — and
   none of the six removed sections.
3. Click Building ↗ → lands on `/listings/{shellId}/documents`, breadcrumb shows three
   crumbs.
4. No console or page errors.

Per the repo's recorded gotchas: never `waitUntil: "networkidle"`; scope selectors to
`main.app-shell__main`; wait for destination-unique text after `browser_navigate` rather
than a generic "page has text"; `browser_close` when finished.

## Gates

- `bunx tsc --noEmit` — `vite build` does **not** type-check
- `bun --bun run test`
