# Pipeline Report — design

**Status:** in flight. Delete this file and its plan in a `chore(docs):` commit when the
work ships; move anything worth keeping into the PR body first.

## Why

The reports index (#149) lists eighteen pre-built reports and links none of them. This
builds the first one, the Pipeline Report, and in doing so settles the template the other
seventeen will wear.

The Pipeline Report goes first because it reports on deals, and in this prototype a deal
*is* a listing — the record everything else already revolves around. Getting the deal
report right means the shape is tested against the data model's centre rather than its edge.

**Explicit non-goal:** a report engine. This phase gets one report working and extracts
only what is unambiguously shared. Whether a descriptor-driven engine earns its cost is a
question for after the second or third report, when there is real evidence about what
repeats.

## Reconciling the reference design

The reference screenshots come from production Buildout, whose vocabulary has diverged from
this prototype's. Audited filter by filter:

| Reference filter | Resolution here |
|---|---|
| Name, Address or Identifier | Keep. Searches name, street, city, state, and `dealId`. |
| Office | Keep, **derived** — a deal has no office; resolve via lead internal broker → roster user → `office`. |
| Broker | Keep. `internalBrokers[]`. |
| Deal Stage | Keep the filter, **reject the reference's labels**. |
| Deal Type | Keep, **split into two filters**. |
| Property Type | Keep as-is. |
| Dirty Deals | **Dropped.** |
| Close Date | Keep, as presets rather than a raw picker. |

Three of those decisions need their reasoning recorded, because they are the ones a future
reader will otherwise try to "fix" back toward the screenshot.

### Deal Stage keeps this prototype's vocabulary

The reference offers Evaluating / On Market / Transacting / Closed / Dead. This prototype
has a single unified lifecycle — `proposal | active | under-contract | closed | inactive`
— shared by the Kanban board, the deal header's stage selector, the stage gates, and the
pipeline settings page.

Adopting the reference's labels would fork that vocabulary: the report would say "On
Market" about a deal the board calls "Active". CLAUDE.md treats new vocabulary other
surfaces must agree with as a spec-worthy wire precisely to stop this. The report reuses
`STATUS_LABELS` and renders stage with the existing badge component, so it can never drift
from the board.

### Deal Type splits into Deal Type + Deal Side

The reference's single "Deal Type" column mixes two orthogonal things: what kind of
transaction it is (Lease, Sale) and who the broker represents (Tenant Rep, Buyer Rep,
Landlord). This prototype already models those as separate fields — `dealType: Sale |
Lease` and `dealSide: buyer | seller` — and the Deals list already filters on both.

So the report gets two filters and two columns. A composite "Lease — Buyer Rep" string was
considered and rejected: it would need a derivation with four cases whose only purpose is
to imitate a column the source data does not have, and it would make the report the one
surface where side is not independently filterable.

### Dirty Deals is dropped

No concept in this codebase corresponds to it — not in the data model, the seed, or any
existing filter. Two definitions were considered and both rejected as inventing vocabulary
this phase has no mandate for:

- *Deals missing stage-required data*, reusing `stageGates.ts`. Plausible and useful, but
  it is a new product concept wearing a legacy name.
- *Deals whose `updatedAt` has gone stale.* Cheap, but "dirty" means something else in the
  real product, so the name would actively mislead.

A filter that cannot filter is worse than an absent one. If the concept is wanted later it
should arrive as its own decision, named for whatever it actually means.

## Routing

`src/routes/_shell/reports_/pipeline.tsx` → `/reports/pipeline`.

The trailing underscore on `reports_` un-nests the report from the `/reports` layout. This
is the load-bearing decision on the page and it is deliberate.

A report page carries its own header band — breadcrumb, report title, Actions, Save As —
and no section sidebar. Nesting it under `/reports` would render that band *inside* the
index's own "Reports / View and analyze data about your company" band, beside a sidebar
whose two tabs neither match nor apply. That is the exact failure the space/suite work hit
twice and reverted twice (see CLAUDE.md, "Space/suite routing is settled"): a child page
becoming a rival to its parent's frame, with two navs stacked and the parent hiding
whatever the child claimed. The escape hatch already exists in this repo —
`listings/$listingId_/spaces/` — so the report uses it rather than rediscovering the
problem.

A typed route file per report, rather than one `$reportId.tsx` behind a slug → component
map, follows the same call CLAUDE.md already made for deal sections: an untyped param and
un-greppable sections are not worth the saved files.

**Route-move caution:** adding a route is additive and safe, but `/reports/pipeline` is now
a public URL. Moving it later breaks the catalog link and any pasted demo URL, and
`vite build` catches neither.

## `ReportShell` — the shared template

The only thing extracted this phase. It owns the header band and nothing else:

- Breadcrumb: **Reports** (→ `/reports/standard`) → the report's own name.
- The report title as the page `h1`.
- **Actions** dropdown, with *Edit Columns* and *Export to PDF*.
- **Save As** button.

Both Actions items and Save As are **inert this phase**, and inert means precisely: the
Actions trigger opens its dropdown, both items render enabled, and choosing either closes
the dropdown and does nothing; Save As is clickable and does nothing. They are not rendered
`disabled` — a disabled control reads as "unavailable to you", when the truth is "not built
yet", and the point of showing them is to settle the band's shape. Column management and
report saving are later phases that fill these slots rather than redesign the band.

`ReportShell` takes a title and children. It is judged by whether the *second* report can
wear it unchanged, not by what Pipeline happens to need — which is why nothing
Pipeline-specific (its filters, its columns) goes anywhere near it.

Everything below `ReportShell` is Pipeline's own. No generic filter-spec renderer, no
column-def table. The second report will show which of those actually repeats; guessing now
against a single example is how abstractions come out mis-fitted.

## Filters

One row inside the content card:

| Filter | Source |
|---|---|
| Search | `name`, property `street`/`city`/`state`, `dealId` |
| Office | `OFFICES`, derived per deal via lead internal broker |
| Broker | distinct `internalBrokers[].name` across deals |
| Deal Stage | `PROPERTY_STATUSES` + `STATUS_LABELS` |
| Deal Type | `Sale` / `Lease` |
| Deal Side | `buyer` / `seller` |
| Property Type | `PROPERTY_TYPES` + `TYPE_LABELS` |
| Close Date | presets over `transaction.closeDate` |
| Reset Filter | clears all of the above |

Close Date is presets — Any date, This quarter, This year, Next 90 days, Past — rather than
a raw calendar. A pipeline question is "what closes this quarter", not "what closes on the
14th", and the presets answer it in one click.

Filters compose as AND across fields. Each is single-select ("Any" plus one value), matching
the reference's selects rather than the Deals list's multi-select facets — the reference is
the design being followed here, and a report row is narrower than a browsing surface.

### One row, with a modal for the rest

The row stays **one row** and never wraps. Eight controls plus Reset do not fit at every
width, so the row carries a lead set inline and an **All Filters** button opens a modal
holding every filter:

- **Inline:** Search, Deal Stage, Deal Type, Property Type, Close Date.
- **Modal only:** Office, Broker, Deal Side — the three that are either derived or
  secondary to a pipeline read.

The modal is *All* Filters, not *More* Filters: it contains the inline five as well, so it
is a complete control surface rather than a leftovers drawer, and a user who opens it never
has to remember which filters live where. Inline and modal controls write the same state,
so a value set in one shows in the other.

### Active-filter chips

**A filter set in the modal must be visible from the row.** Otherwise the row count changes
with no on-screen cause, which reads as a bug.

A row of muted chips sits directly beneath the filter row, one per active filter, each
removable. It reuses `ContactChip` with `appearance="muted"` — the grey variant, since these
sit under a control row that already carries the accent and do not need to compete with it.
`TaskFilterBar` already imports that component out of `components/contacts/`, so reports
doing the same follows an established path rather than cutting a new one.

The chips show **every** active filter, inline and modal alike, not only the modal ones. A
chips row that sometimes mirrors the controls above it and sometimes contradicts them is
harder to read than one that always states the whole filter state; and a chip for an inline
filter costs nothing.

This supersedes the count badge on All Filters, which is dropped — with every active filter
named in a chip, a number summarizing a subset of them is redundant.

Chip removal and Reset Filter both write the same state the row and modal do. Reset clears
everything.

## Table

Columns, left to right: Deal ID · Deal Name · Stage · Deal Type · Deal Side · Property
Type · City · State · Transaction Value · Brokerage Gross.

- **Summary row above the data**, as in the reference: `Count N`, plus column totals for
  Transaction Value and Brokerage Gross. It sits above rather than below because the
  reference puts it there and because the count answers the report's first question.
- **Sortable headers**, defaulting to Transaction Value descending — the reference's
  default, and the useful one for a pipeline read.
- **Formatting conventions from the reference:** `--` for a value the record does not have,
  `$0.00` for a real zero. The distinction carries information (no property vs. no money)
  and is worth preserving.
- **Deal ID and Deal Name both link to the deal**, through `dealCardLinkProps`. That helper
  is the single rule for where a deal card goes, it has an invariant test enforcing that
  every card surface uses it, and it routes a child space deal to its own space page rather
  than the building's. Hand-rolling `/listings/{id}` here would silently break space deals.
- **Pagination at 20 rows/page**, using the Blueprint `Pagination` already wired on the
  Tasks page. With 27 seeded deals this is two pages — thin, but it exercises the control.

### Umbrella shells are excluded

The Deals list already filters out umbrella shells (`isUmbrella`), and this report must too,
for a reason specific to reports: a shell and its child space deals would *both* appear, so
`Count` would overstate the pipeline and the Transaction Value and Brokerage Gross totals
would double-count the same money. A report whose totals are wrong is worse than no report.

## Data derivation

`pipelineRows.ts` holds everything that is logic rather than markup:

- `Listing` → a flat row: ids, name, stage, type, side, property type, city, state,
  transaction value (`transaction.salePrice`), brokerage gross
  (`transaction.commissionAmount`).
- Office resolution — the first entry in `internalBrokers` matched by name against
  `SEED_ROSTER` to read their `office`. A deal with no internal broker, or a broker with no
  roster match, resolves to `null`: the column renders `--`, and the row drops out whenever
  an Office filter is active. Resolving to a default office instead would silently file
  unassigned deals under a real office and make that office's numbers wrong.
- Totals across a row set.

`pipelineFilters.ts` sits beside it and owns the filter state shape, the predicate that
applies it, `pipelineFilterChips` (one `{ key, label, clear }` per active filter, following
the shape `taskFilterChips` and `contactFilterChips` already use), and reset. Filter state
lives in one module precisely because *three* surfaces write it — the inline row, the modal,
and chip removal; putting it in any one component would make the other two second-class.

This is the part that can be wrong in a way nobody sees on screen, so it is the part with
Vitest coverage: derivation, office resolution and its `null` fallback, each filter,
umbrella exclusion, the chip list a given filter state produces, and the totals. Per
CLAUDE.md logic lives in Vitest and the browser is for interactive verification only.

## Files

```
components/reports/ReportShell.tsx                    new — shared header band
components/reports/pipeline/PipelineFilterBar.tsx     new — the one-row inline set + chips
components/reports/pipeline/PipelineFilterModal.tsx   new — All Filters, every control
components/reports/pipeline/pipelineFilters.ts        new — filter state, chips, reset
components/reports/pipeline/PipelineReportTable.tsx   new
components/reports/pipeline/pipelineRows.ts           new — derivation, filters, totals
components/reports/pipeline/pipelineRows.test.ts      new
routes/_shell/reports_/pipeline.tsx                   new — composes the above
components/reports/ReportRow.tsx                      edit — optional `to` prop
routes/_shell/reports/standard.tsx                    edit — link the Pipeline card
```

No change to `src/data/` and no `SEED_VERSION` move: every value the report needs is
already on `Listing`, `Property`, or the roster.

## Verification

- `bunx tsc --noEmit` clean; `bun --bun run test` green, including the new
  `pipelineRows.test.ts`.
- Browser, per CLAUDE.md's split — Claude verifies breakage, Joel reviews design: the
  catalog's Pipeline card navigates to `/reports/pipeline`; the report renders outside the
  index's frame with exactly one header band and no section sidebar; the breadcrumb returns
  to the catalog; each filter narrows the row count; the summary row's count and totals track
  the filtered set; pagination moves between pages; a Deal Name link opens that deal, and a
  space deal's link opens its space page; console clean.
- The filter row, chips and modal specifically: the row holds one line at a narrow viewport,
  All Filters opens with the inline values already reflected, a value set in the modal shows
  as a chip and changes the row count, removing a chip restores those rows and clears the
  matching control, and Reset clears every surface at once.

## Settled during review

Both open questions were resolved before implementation:

1. **Filter row density** — the row stays one row, with an All Filters modal carrying the
   overflow. Written up under "One row, with a modal for the rest".
2. **Pagination depth** — 20 rows per page over the 27 seeded deals, giving two pages, is
   accepted for this phase. No seed change, so `SEED_VERSION` stays put.
