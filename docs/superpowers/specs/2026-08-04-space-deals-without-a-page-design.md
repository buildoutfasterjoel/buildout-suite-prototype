# Space Deals Without a Page — Design

**Status:** Approved design (2026-08-04), pending spec review.
**Supersedes parts of:** `2026-07-31-lease-space-marketing-scope-design.md` — specifically its
Navigation section: the space deal sidebar, the Property Marketing hub, and return context. All three
are deleted below. Its scope model and stage-ladder reasoning survive.
**History:** `2026-08-03-suite-panel-over-building-design.md` was built, struck down, and reverted in
`b1a04e3`; its spec and plan were deleted with it. What that attempt taught is recorded below so the
next reader does not have to re-derive it.
**Prerequisite, already landed:** `e31f8a6` capped a shell at Pitching/Active and relabelled a space's
`proposal` from Draft to Inactive.
**Scope:** Landlord rep lease only. Sale deals and buy-side are untouched.

---

## The constraint this resolves

A broker working a building works the building and its suites in one sitting. They set a suite's rate,
then reach for the building's brochure, then come back to the next suite. The prototype makes each of
those a round trip, because a space deal is a full page whose content almost entirely belongs to the
building — so the page spends its existence borrowing, and machinery grew to manage the borrowing: a
hub page explaining a hop, a `from` param to get back from it, a scope bar naming who sent you, and two
filter sets hiding building things from a suite.

The goal is that a building and its spaces feel like **one thing** rather than a pair of places with a
commute between them.

The complication is that spaces must stay child deals. Per-space pipeline is the invention worth
keeping: a space appears on the board with its own stage, and the parent shows a rollup. That is net-new
value and this design does not touch it.

## The spine

> **The building is the only page. A space is a deal without a page — its three surfaces are sections
> of the building, not a place you travel to.**

## What the panel attempt taught

The reverted design also made the building the only page, and was right about that. It failed on the
other half: it put **all eight** space surfaces behind one space-major overlay, so a suite became a
rival page to the building, the building's nav had to be filtered to pretend spaces did not exist, and
the broker still travelled — just into a drawer instead of a route.

This design transposes it. Instead of one space-major container holding every section, the small number
of genuinely per-space surfaces become **space-aware sections of the building**. Section-major, not
space-major. Only one section drills down, it renders inline in the shell's content area rather than
over it, and the shell's nav never changes shape.

Two facts from that attempt are load-bearing and carried forward:

- **Canonicalizing a URL must be reactive, not in `beforeLoad`** (`cf5676c`). The store is client-owned
  (Zustand + IndexedDB); during `beforeLoad` on a cold load the listings map is empty, so `parentDealId`
  reads as undefined. This design needs no redirect at all, but the constraint applies to anything that
  resolves a parent from a route.
- **A space's money must be scoped to its building** (`ab7b6be`). A suite rendering under the wrong
  building's frame painted the wrong voucher and commission over it. The one guard this design keeps.

## The scope model

Revises the table in the 07-31 design. Three surfaces belong to a space; everything else is the
building's.

| Scope | Surfaces | Where it lives |
|---|---|---|
| **Space-owned** | Space terms; voucher/commission; invoices | Terms on the roster row. Voucher and invoices on the Vouchers section. |
| **Building-level** | Documents, Website, Email, Demographics, Grids, Plans, Media, Leads, Notes, Files, Underwriting, Client Report, Activity, History | The shell's own sections, unfiltered. Leads already names the inquired space in its rows. |

Media and Leads move from "unit-filtered" to plain building-level. The building's leads list already
names which space each inquiry is about (`4ed51a3`), which is the orientation a filter was standing in
for.

## Routing

No redirect. `DealCard` already holds `listing.parentDealId`, so a space card links straight to the
roster.

| Route | What it is |
|---|---|
| `/listings/{shellId}` + existing sections | The building. The only page. |
| `/listings/{shellId}/spaces?space={spaceId}` | The roster; `?space=` seeds which row is open |
| `/listings/{shellId}/vouchers` | Index of every space's money |
| `/listings/{shellId}/vouchers/{spaceId}` | One space's voucher and invoices |

`?space=` is a search param rather than a child route because expansion is view state *on* the roster,
not a separate view. It is read with `Route.useSearch()` and passed to a controlled `Collapsible`; local
state takes over after arrival, so a broker can still open several rows at once.

**Deliberately not built:** a guard on `/listings/{spaceId}`. The deal-page routes are shared with
normal deals, so there is no space-specific page to remove and no dead code behind that URL — it is the
ordinary deal page with an id nothing hands it any more. In a prototype, updating the links is the whole
job. Link sites to update: `DealCard` (the only one that definitely renders space cards) and
`TimelineEvent` (a space id can appear in an activity association).

## The roster is the space's control surface

`/listings/{shellId}/spaces` already edits terms inline. It gains stage, and loses its exit.

| Change | Detail |
|---|---|
| `DealStageBadge` → `DealStageSelect` per row | Free: `DealStageSelect` takes a plain `Listing`, calls the global `requestStageChange`, and `GlobalStageGateModal` is already mounted in `AppShell`. Its wrapper was built in `5ec0f17` not to crush neighbours in a flex row. |
| "Open deal" button removed | Nothing to open. |
| Link to that space's voucher added | Points at `/listings/{shellId}/vouchers/{spaceId}`, so the two per-space surfaces reach each other without a trip through the nav. |
| `?space=` seeds the open row | Board arrivals land with the right row already expanded. Needs a `validateSearch` on the route declaring `space?: string`, following the pattern `leads.tsx` already uses for `q`. |

The gate needs no changes: it is Zustand-driven and globally mounted, so a roster row triggers a publish
or commit gate exactly as a page header did. Stage sits next to the terms the gate validates, which is
the argument for putting it here rather than in the voucher.

## Vouchers

### Nav is shape-dependent

The sidebar already hides `financials` for a shell. This extends that rather than inventing a mechanism.

| Deal shape | Back Office items |
|---|---|
| shell | **Vouchers** · Notes |
| everything else | Voucher · Invoices · Notes |

`financials.tsx` and `financial-documents.tsx` **stay** — sale deals, flat leases and tenant-rep deals
still need them. Only their shell guards go, since a shell now navigates to `vouchers`.

### The index — `/listings/{shellId}/vouchers`

```
Vouchers                                    3 spaces · $100,000 total
─────────────────────────────────────────────────────────────────────
Space        Tenant       Commission   Stage
Suite 100    Acme Corp    $42,000      Closed            →
Suite 210    —            —            Inactive          →
Suite 305    Globex       $58,000      Under Contract    →
```

Every space is listed and clickable, including ones with no money yet — a voucher exists before it is
filled, and an em-dash is honest about that. Ordered by suite label, matching the roster, so the two
pages never disagree.

The summary line is the one aggregate a shell can legitimately show. A shell holds no rate and earns no
commission of its own, but the sum of what its spaces are earning is exactly the question an index
exists to answer. One line, not a dashboard.

### The detail — `/listings/{shellId}/vouchers/{spaceId}`

```
← breadcrumb: All Deals / 400 Market St / Vouchers / Suite 305

Voucher — Suite 305                    [Deal Sheet] [Submit Financials]
  … DealFinancials, unchanged …

Invoices — Suite 305                              [Invoice History]
  … DealInvoices, unchanged …
```

`DealFinancials({ listing })` and `DealInvoices({ listing })` both take a plain `Listing`, so they mount
against the space with no internal changes. The only edit either needs is an optional `heading` prop
defaulting to today's hardcoded `"Voucher"` / `"Invoices"`, so the suite can be named. Two stacked
sections, each with its own header.

**The one guard kept:** if `{spaceId}` is not a child of `{shellId}`, render nothing. Per `ab7b6be`
above, this is not defensive URL-handling — it prevents showing one landlord's money on another's page.

## Breadcrumbs

The deal name becomes a link and the current section appends:

```
All Deals  /  400 Market St  /  Vouchers  /  Suite 305
   link          link             link        current

All Deals  /  400 Market St  /  Leads
   link          link           current
```

Section labels come from `NAV_GROUPS`, which requires **extracting it out of `PropertyDetailSidebar`**
into a shared `src/components/properties/dealNav.ts` that the sidebar and header both import. One source
of truth for a section's name, so a renamed nav item cannot disagree with the breadcrumb.

The section is the first path segment after the listing id; the space is the second. Same "read the
first segment, not the last" principle the deleted `buildingSectionHref` was built on.

Derivation is a pure function so it is testable without rendering. It returns the section's **label**
(from the static `NAV_GROUPS`) and the detail's **id** (a route param) — resolving that id to a suite
label needs the store, so the header does it, and the function stays pure:

```ts
dealBreadcrumbTrail(pathname, listingId) → { sectionLabel: string | null, detailId: string | null }
```

The `Vouchers` crumb is the way back to the index, so the voucher detail gets **no separate back link** —
two back affordances a few pixels apart is noise.

Edges: `/listings/{id}` with no section keeps today's `All Deals / {name}`; a section absent from
`NAV_GROUPS` (such as `edit`) shows no section crumb rather than inventing a label from its slug.

## Data and code changes

### Add

| File | What |
|---|---|
| `src/data/spaceVouchers.ts` | `spaceVouchers(shellDealId): SpaceVoucherRow[]` — `{ dealId, label, tenantName: string \| null, commissionAmount: number \| null, stage: PropertyStatus }`. Walks `getChildDeals`, reads `child.transaction.commissionAmount` and resolves the first of `tenantContactIds`. `stage` is the raw status; the index renders it through `dealStageLabel(stage, 'space')` so a `proposal` row reads "Inactive". Deliberately mirrors `buildingAvailability`, and sits beside it. |
| `src/routes/_shell/listings/$listingId/vouchers.tsx` | Layout + index |
| `src/routes/_shell/listings/$listingId/vouchers/$spaceId.tsx` | Voucher + invoices for one space, with the child-of-shell guard |
| `src/components/properties/dealNav.ts` | `NAV_GROUPS` extracted; plus `dealBreadcrumbTrail` |

### Change

| File | What |
|---|---|
| `spaces.tsx` | `DealStageSelect` per row; read `?space=`; drop "Open deal"; add voucher link |
| `PropertyDetailSidebar.tsx` | Import `NAV_GROUPS` from `dealNav`; swap Voucher/Invoices → Vouchers for a shell |
| `PropertyDetailHeader.tsx` | Breadcrumb gains section + detail crumbs; deal name becomes a link |
| `DealFinancials.tsx`, `DealInvoices.tsx` | Optional heading prop, defaulting to current strings |
| `DealCard.tsx`, `TimelineEvent.tsx` | Space links point at the roster |
| `buildingAvailability.ts` | Doc comment says "Draft or Lost"; `Draft` is now `Inactive` |

### Delete

Dead because a space never renders a page.

| File / code | Why |
|---|---|
| `MarketingScopeBar.tsx` | Return bar for a trip that no longer happens |
| `PropertyMarketingHub.tsx` + `property-marketing.tsx` route | Explained a hop that no longer exists |
| `from` param across 8 routes + the sidebar's carry logic | Carried an origin there is no returning to |
| Sidebar's `shape === 'space'` filtering (`PROPERTY_ONLY`, `SHELL_ONLY`) | The sidebar never renders for a space |
| `PropertyDetailHeader`'s `parentDeal` breadcrumb branch | No building > suite crumb without a suite page |
| `DealContextRail`'s `LinkedParentDeal` + its `parent` lookup | Existed only to link a space back up |
| `ListingFormEditor`'s space-terms section | Terms live on the roster |
| Shell guards in `financials.tsx` and `financial-documents.tsx` | A shell navigates to `vouchers` instead |

The first three and the space-terms section are what `026767f` deleted and `b1a04e3` restored. Restoring
them was not wasted: it returned the branch to a known-good state that passes its tests, which is what
makes deleting them again safe to reason about. This time they go because they are unnecessary, not
because something replaced them.

## Suggested build order

1. `spaceVouchers` derivation + its tests. Pure data, no UI.
2. `dealNav.ts`: extract `NAV_GROUPS`, add `dealBreadcrumbTrail` + tests.
3. Vouchers index route, wired to the derivation.
4. Vouchers detail route, with the child-of-shell guard and the heading props.
5. Sidebar: shape-dependent Back Office.
6. Breadcrumb: section + detail crumbs.
7. Roster: stage select, `?space=`, voucher link, drop "Open deal".
8. Link sites: `DealCard`, `TimelineEvent`.
9. Deletions, last — so nothing is removed before its replacement works.

## Non-goals

- **No per-space marketing.** Production publishes per building; that constraint is upheld, not worked around.
- **No change to the pipeline board's treatment of spaces.** Suite label, Space chip, and the parent's stage rollup all stay as they are.
- **No guard on `/listings/{spaceId}`.** Reasoning under Routing.
- **No shell commission of its own.** The index's total is a sum of its spaces, not a figure the shell owns.
- **Sale and buy-side deals are untouched.**

## Verification

| Check | How |
|---|---|
| `spaceVouchers` rows | `spaceVouchers.test.ts`: derived from children, tenant resolution, null commission pre-transaction, ordering, empty for a non-shell |
| Breadcrumb derivation | `dealBreadcrumbTrail` unit tests: no section, known section, section + detail, unknown slug |
| Voucher scoping | A `spaceId` that is not a child of `{shellId}` renders nothing |
| Nothing else broke | `bunx tsc --noEmit` and the full `vitest run` — `routeTree.gen.ts` carries `@ts-nocheck`, so neither typecheck nor build catches a stale route tree; only regeneration does |
| The flow itself | Manual: board → space card → roster row open → set stage through its gate → Vouchers → a space's voucher → breadcrumb back |

Two edges that need no handling, recorded so they are not mistaken for bugs:

- **A shell that loses its last space reverts to `flat-lease`** (`dealShape` derives from
  `children.length > 0`). The nav swaps Vouchers back to Voucher on its own and the roster shows its
  empty state.
- **The Vouchers index cannot be empty** — only a shell gets the item, and a shell has at least one
  child by definition.
