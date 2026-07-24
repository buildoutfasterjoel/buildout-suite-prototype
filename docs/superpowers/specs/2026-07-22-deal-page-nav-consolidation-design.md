# Deal Page Nav Consolidation — Phase 1 Design

**Date:** 2026-07-22
**Branch:** `joel/phase-1-deal-page`

## Goal

Phase 1 of the consolidated Deal page merges the navigation of three
historically separate products into a single deal sidebar. This spec covers
**consolidating the sidebar links** and **scaffolding placeholder pages** for
every net-new link, so the full navigation is wired and clickable end-to-end.
It does **not** build out the real content of the net-new pages — those are
intentional placeholders for later phases.

## Source material

Three legacy product navs are being folded into one:

- **Image 1** — Project (Leads, Client Report, Attachments, Tasks, Activities)
  and Listing (Documents, Web Activity, Website, Email, Syndication, Grids,
  Plans, Media, Demographics). Source for the **Deal** and **Marketing**
  sections.
- **Image 2** — Deal (Overview, Contacts, Planner, Attachments, Activities,
  History), Marketing (Listing, Leads), Back Office (Voucher).
- **Image 3** — the Voucher product: Voucher, Attachments (Uploaded,
  Invoices), Notes (Pinned, Additional), History (All History). Source, with
  Image 2's Back Office, for the **Back Office** section.

## Decisions

- **Scope:** full union of legacy links, mapped into the existing three-section
  structure. Every distinct link becomes a nav item; net-new links get
  placeholder pages.
- **Section labels:** keep the current labels — **Deal**, **Marketing**, **Back
  Office**. (The first section is conceptually "Project" but keeps the "Deal"
  label.)
- **Leads:** single link, stays in **Marketing** (matches current sidebar +
  Image 2).
- **Web Activity:** dropped — already folded into the **Website** page.
- **Tasks vs Planner:** they are the same thing; keep **Planner**, drop Tasks.
- **Attachments/Invoices (Image 3):** these are financial documents for the
  back office → one **Financial Documents** link under **Back Office**.
- **History:** deal-level History (Image 2) and voucher "All History" (Image 3)
  fold into a single **History** link under **Deal**.

## Final sidebar structure

Order within each section matters (top-to-bottom as listed). ★ = net-new
placeholder page.

### Deal
1. Overview — exists
2. Contacts — ★ new
3. Planner — ★ new
4. Client Report — exists
5. Activity — exists
6. History — ★ new
7. Spaces — exists (conditional: Lease deals without a parent)
8. Data — exists
9. Underwriting — exists (conditional: qualifying properties)

### Marketing
1. Leads — exists
2. Documents — exists
3. Website — exists
4. Email — exists
5. Syndication — ★ new
6. Media — exists
7. Demographics — exists
8. Grids — exists
9. Plans — ★ new

### Back Office
1. Transaction — exists
2. Financials — exists (= legacy "Voucher")
3. Financial Documents — ★ new
4. Notes — ★ new

**Net-new placeholder pages (7):** Contacts, Planner, History, Syndication,
Plans, Financial Documents, Notes.

## Implementation

### 1. Shared placeholder component

Add a small reusable component (e.g.
`src/components/deals/DealPagePlaceholder.tsx`) that renders a consistent
"coming soon" state using Blueprint's `Empty` component (already the repo's
convention — see `ListingNotFound` in `$listingId.tsx`). Props: `title`,
`icon`, and optional `description`. Renders inside the existing content `Card`
that the `$listingId` layout provides via `<Outlet />`, so no extra chrome is
needed.

### 2. New routes

Create one route file per net-new page under
`src/routes/_shell/listings/$listingId/`, each following the existing minimal
route pattern (see `grids.tsx`): guard on the listing existing, then render
`<DealPagePlaceholder … />`.

| Route file | Title | Section |
|---|---|---|
| `contacts.tsx` | Contacts | Deal |
| `planner.tsx` | Planner | Deal |
| `history.tsx` | History | Deal |
| `syndication.tsx` | Syndication | Marketing |
| `plans.tsx` | Plans | Marketing |
| `financial-documents.tsx` | Financial Documents | Back Office |
| `notes.tsx` | Notes | Back Office |

`routeTree.gen.ts` regenerates automatically on dev/build — never edited by
hand.

### 3. Sidebar wiring

Update `src/components/properties/PropertyDetailSidebar.tsx`:

- Add the 7 new items to `NAV_GROUPS` in the positions above, each with a
  FontAwesome Pro **regular** icon (selected via the `/icons` skill; no
  `fixedWidth`).
- No new conditional-visibility logic — the new items always show.
- Existing conditional filters (`spaces`, `underwriting`) are unchanged.

### Icon choices (regular weight; finalize via `/icons`)

- Contacts → address/people icon
- Planner → schedule/plan icon
- History → clock-rotate-left
- Syndication → broadcast/share icon
- Plans → floor-plan / drafting icon (distinct from Spaces' `faVectorSquare`)
- Financial Documents → receipt/invoice icon (distinct from Financials'
  `faFileInvoiceDollar`)
- Notes → note/sticky icon

## Out of scope

- Real content for any placeholder page.
- Any change to existing pages' content.
- Data-model or store changes.
- Renaming or restructuring existing links beyond the additions above.

## Verification

- `bun --bun run dev` compiles with no new TS warnings.
- All 7 new links appear in the sidebar in the specified order and sections.
- Clicking each navigates to its route and renders the placeholder without
  errors.
- Existing links and conditional visibility (Spaces, Underwriting) still work.
