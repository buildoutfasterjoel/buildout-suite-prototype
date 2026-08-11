# Space Marketing Ownership (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a leased space from showing — and silently forking — the six marketing sections its parent building owns, and point the space's sidebar at the building instead.

**Architecture:** One filter rule in `visibleNavGroups` hides the six building-owned sections for `shape === 'space'`; their six space route files are deleted in the same commit, because an existing test asserts nav items and route files match in both directions. A new optional `buildingLink` prop on `PropertyDetailSidebar` renders a single "Building ↗" link row at the foot of the Marketing group, targeting the building's Documents. No data model changes, no new routes, no seed changes.

**Tech Stack:** React 19 · TypeScript · TanStack Start (file-based routing) · Vite 8 · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-08-11-space-marketing-ownership-design.md`

## Global Constraints

- Package manager is Bun; always `bun --bun run <script>`. Tests: `bun --bun run test`.
- `vite build` does **not** type-check. The type gate is `bunx tsc --noEmit`.
- Biome output and a `react`/module Vitest stderr line are known non-gates — ignore both.
- Never edit `src/routeTree.gen.ts` — it regenerates on dev/build.
- Do **not** add `@playwright/test`, `playwright.config.ts`, or any committed E2E suite. Logic goes in Vitest; the browser is for interactive verification only. There are zero `.test.tsx` files and no jsdom/testing-library harness — do not add one.
- Blueprint React components for all UI; import from the `ui` subpath, e.g. `@buildoutinc/blueprint-react/ui/Button`.
- FontAwesome: default to `pro-regular`. `pro-duotone` only for Alert and Banner. Never pass `fixedWidth` to `FontAwesomeIcon` — it is deprecated.
- Bootstrap 5 utility classes for spacing and layout. Blueprint's SCSS prefix is `--bp-`, so `--bs-*` custom-property overrides silently do nothing.
- No unsolicited design changes. This plan changes navigation behavior; it does not restyle anything that isn't listed.
- Commit after each task. Do not merge; PRs are opened via `/ship` on Joel's approval.

---

### Task 1: Hide the six building-owned sections and delete their space routes

The nav filter and the route deletions **must be one commit.** `src/components/properties/spaceNavRoutes.test.ts` asserts a bidirectional invariant — every space nav item has a route file, *and* every space route file has a nav item. Filtering the nav without deleting the routes leaves six unreachable routes and a red suite; deleting the routes without filtering leaves six nav items pointing at blank pages. Neither half is independently shippable.

That test is also the strongest verification this task can have. After the change it should pass **unchanged**: the nav yields 12 hrefs for a space and 12 route files remain, and they are the same 12. Its `routeSlugs.length > 10` guard holds at 12.

**Files:**
- Modify: `src/components/properties/dealNav.ts` — add `BUILDING_OWNED_HREFS`, add one rule to `visibleNavGroups` (the filter callback begins at line 146)
- Test: `src/components/properties/dealNav.test.ts` — append one `describe` block
- Delete: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/documents.tsx`
- Delete: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/website.tsx`
- Delete: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/email.tsx`
- Delete: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/demographics.tsx`
- Delete: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/grids.tsx`
- Delete: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/plans.tsx`

**Interfaces:**
- Consumes: `visibleNavGroups(shape: DealShape, opts: { leaseParent: boolean; showsUnderwriting: boolean }): NavGroup[]` — existing, unchanged signature.
- Produces: `BUILDING_OWNED_HREFS: readonly string[]` exported from `dealNav.ts`, so Task 2's comment can reference it and the test can import it rather than restating the list.

- [ ] **Step 1: Write the failing test**

Append to the end of `src/components/properties/dealNav.test.ts`. Note the import on line 2 must grow to include `BUILDING_OWNED_HREFS`:

```ts
// Line 2 becomes:
// import { BUILDING_OWNED_HREFS, dealBreadcrumbTrail, NAV_GROUPS, visibleNavGroups } from "./dealNav";

describe("the building-owned marketing sections", () => {
  const opts = { leaseParent: false, showsUnderwriting: true };

  function shown(shape: Parameters<typeof visibleNavGroups>[0], o = opts) {
    return visibleNavGroups(shape, o).flatMap((g) => g.items.map((i) => i.href));
  }

  it("names the six sections a building owns", () => {
    // Asserted explicitly rather than trusting the constant, so widening the
    // list is a deliberate edit to a test rather than a silent behaviour change.
    expect([...BUILDING_OWNED_HREFS].sort()).toEqual([
      "demographics",
      "documents",
      "email",
      "grids",
      "plans",
      "website",
    ]);
  });

  it("hides every one of them from a space", () => {
    const hrefs = shown("space");
    for (const href of BUILDING_OWNED_HREFS) {
      expect(hrefs, href).not.toContain(href);
    }
  });

  it("keeps every one of them on a shell, which owns them", () => {
    const hrefs = shown("shell", { leaseParent: true, showsUnderwriting: true });
    for (const href of BUILDING_OWNED_HREFS) {
      expect(hrefs, href).toContain(href);
    }
  });

  it("keeps them on a sale and on a flat lease", () => {
    for (const shape of ["sale", "flat-lease"] as const) {
      const hrefs = shown(shape);
      for (const href of BUILDING_OWNED_HREFS) {
        expect(hrefs, `${shape} / ${href}`).toContain(href);
      }
    }
  });

  it("leaves a space exactly the three marketing sections it does own", () => {
    // Exact contents and order: Details is the space's own form, Leads and Media
    // are filtered views of the building's. Anything else appearing here is a
    // section that escaped the ownership rule.
    const marketing = visibleNavGroups("space", opts).find((g) => g.label === "Marketing");
    expect(marketing?.items.map((i) => i.href)).toEqual(["details", "leads", "media"]);
  });

  it("does not empty the Marketing group for a space", () => {
    // `visibleNavGroups` drops groups that filter down to nothing. Removing six
    // of Marketing's ten items must not trip that.
    const labels = visibleNavGroups("space", opts).map((g) => g.label);
    expect(labels).toContain("Marketing");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test dealNav`

Expected: FAIL. The first failure is a TypeScript/import error — `BUILDING_OWNED_HREFS` is not exported from `./dealNav`. Once the constant exists but the filter rule does not, the failures become `hides every one of them from a space` and `leaves a space exactly the three marketing sections it does own`.

- [ ] **Step 3: Add the constant and the filter rule**

In `src/components/properties/dealNav.ts`, add above `visibleNavGroups`:

```ts
/**
 * The marketing sections a building owns outright.
 *
 * A leased space is marketed as part of its building, so these are edited on the
 * building and nowhere else. Showing them on a space was not merely redundant: a
 * space holds a *clone* of its parent's `marketing` (see `addSpaceToDeal`), so
 * editing one on a suite silently forked it from the building with nothing
 * indicating which copy a public surface reads.
 *
 * A space's sidebar points at the building instead — see `buildingLink` in
 * `PropertyDetailSidebar`.
 *
 * Typed `readonly string[]` rather than a `const` tuple so `.includes(item.href)`
 * accepts an arbitrary href without a cast.
 */
export const BUILDING_OWNED_HREFS: readonly string[] = [
  'documents',
  'website',
  'email',
  'demographics',
  'grids',
  'plans',
]
```

Then add this rule inside the `items.filter` callback in `visibleNavGroups`, immediately after the existing `details`/`listing` swap block:

```ts
      // Marketing a suite is the building's job — see BUILDING_OWNED_HREFS.
      if (shape === 'space' && BUILDING_OWNED_HREFS.includes(item.href)) return false
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test dealNav`
Expected: PASS, all six new cases plus the existing `dealBreadcrumbTrail`, `NAV_GROUPS` and `visibleNavGroups` blocks.

- [ ] **Step 5: Confirm the route invariant now fails, which is what licenses the deletions**

Run: `bun --bun run test spaceNavRoutes`

Expected: FAIL on `has a nav item for every route`, listing exactly these six as unreachable: `demographics, documents, email, grids, plans, website`.

If the list is not exactly those six, stop — the filter rule is wrong. Do not proceed to deletion.

- [ ] **Step 6: Delete the six route files**

```bash
cd 'src/routes/_shell/listings/$listingId_/spaces/$spaceId'
git rm documents.tsx website.tsx email.tsx demographics.tsx grids.tsx plans.tsx
cd -
```

Nothing links inbound to these six paths — a grep found references only in the generated `routeTree.gen.ts` and in the files themselves. No component, no `useParams({ from })`, no `<a href>`. This check matters because `vite build` cannot catch a broken route link.

Do not edit `src/routeTree.gen.ts`. It regenerates on the next dev/build.

- [ ] **Step 7: Run the full suite and the type gate**

```bash
bun --bun run test
bunx tsc --noEmit
```

Expected: all tests pass, including `spaceNavRoutes` (now 12 nav hrefs against 12 route files) and `dealNav`. `tsc` clean.

If `spaceNavRoutes` fails on `finds the routes it is looking for at all`, the `> 10` guard has been breached — 12 files should remain, so more was deleted than intended.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/properties/dealNav.ts src/components/properties/dealNav.test.ts \
  'src/routes/_shell/listings/$listingId_/spaces/$spaceId' src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
feat(spaces): let the building own the marketing sections it controls

A leased suite's marketing is controlled by its parent building, but the
space page didn't say so: `visibleNavGroups` only swapped Listing -> Details,
so a suite rendered nearly the building's whole Marketing group.

They were also editable, which is the part with teeth. `addSpaceToDeal`
spreads `...parent.marketing`, so a space holds a clone — editing Website or
Documents on a suite silently forked it from the building, with nothing on
either surface indicating which copy a public surface reads.

Six sections now hide for `shape === 'space'` and their route files are
deleted in the same commit, because `spaceNavRoutes.test.ts` asserts the
invariant in both directions: a nav item without a route is a blank page, a
route without a nav item is dead code. Neither half ships alone. That test
passes unchanged afterwards — 12 nav hrefs against the same 12 route files —
which is what verifies the deletion set is exactly right.

Plans goes with them and stays a building-owned stub. It's an editor for
highlighting plans within the building, distinct from the floor-plan asset a
broker uploads against a suite; they share a word, not a purpose.
EOF
)"
```

---

### Task 2: Add the "Building" link row to a space's sidebar

**Files:**
- Modify: `src/components/properties/PropertyDetailSidebar.tsx` — new optional prop, new import, one rendered row
- Modify: `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx:91-95` — pass the new prop

**Interfaces:**
- Consumes: `BUILDING_OWNED_HREFS` from Task 1 (referenced in a comment only).
- Produces: `PropertyDetailSidebar`'s new optional prop `buildingLink?: { label: string; listingId: string }`. A building omits it; a space passes `{ label: "Building", listingId }` where `listingId` is the **shell's** id.

**No unit test.** The repo has zero `.test.tsx` files and no jsdom/testing-library harness — logic lives in Vitest, UI is verified in the browser (Task 4). Do not add a component-test harness for this.

- [ ] **Step 1: Add the prop and the imports**

In `src/components/properties/PropertyDetailSidebar.tsx`, extend the imports on lines 1–11:

```tsx
import { Link, useNavigate } from "@tanstack/react-router";
import { faArrowUpRight, faBuilding, faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import { BUILDING_OWNED_HREFS, visibleNavGroups } from "#/components/properties/dealNav";
```

`Link` is added to the existing `@tanstack/react-router` import (which currently brings in only `useNavigate`); `faArrowUpRight` and `faBuilding` join the existing `faChevronRight` import; `BUILDING_OWNED_HREFS` joins the existing `visibleNavGroups` import.

Add to the props destructure and the type, after `activeLabel`:

```tsx
  buildingLink,
}: {
  // … existing listing, basePath, activeLabel props unchanged …
  /**
   * The building that owns this record's marketing sections, when there is one.
   *
   * A space passes its shell here and this renders a link out to the building's
   * Documents at the foot of the Marketing group. The building owns the sections
   * in `BUILDING_OWNED_HREFS`, which `visibleNavGroups` hides for a space — so
   * the suite points at them rather than holding a second, divergent copy.
   *
   * Takes the shell's id rather than a URL so the `Link` target stays a typed
   * route literal; `basePath` above is an interpolated string only because
   * `navigate({ to })` accepts one and `Link`'s `to` does not.
   *
   * Omitted by a building, which has no parent to point at.
   */
  buildingLink?: { label: string; listingId: string };
}) {
```

- [ ] **Step 2: Render the row at the foot of the Marketing group**

Inside the `navGroups.map` callback, after the `const tabs = (…)` assignment and before the `if (!group.label)` early return, add:

```tsx
        // The link out sits at the foot of the group whose sections it replaces,
        // so it collapses with that group. Matched by label because Marketing is
        // the group whose items `BUILDING_OWNED_HREFS` removes.
        const linkRow =
          buildingLink && group.label === "Marketing" ? (
            <Link
              to="/listings/$listingId/documents"
              params={{ listingId: buildingLink.listingId }}
              className="nav-link d-flex align-items-center gap-2 text-decoration-none"
            >
              <FontAwesomeIcon icon={faBuilding} />
              <span className="flex-grow-1">{buildingLink.label}</span>
              <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 12 }} />
            </Link>
          ) : null;
```

Then render `{linkRow}` immediately after `{tabs}` inside `Collapsible.Content`:

```tsx
            <Collapsible.Content>
              {tabs}
              {linkRow}
            </Collapsible.Content>
```

Leave the `if (!group.label)` branch alone — it returns before `linkRow` is used, and no group is unlabelled today.

**Why a `Link` and not a `Tabs.Tab`:** each group's items render inside a `Tabs` whose `value` is the active item's *label*. An item targeting a different record can never match that value, so as a Tab it would occupy the value space while being permanently inactive, and `handleTabChange` would fail to find it in `navGroups`. A `Link` sidesteps both and is the honest control — it leaves the page.

**Do not add a "Building" entry to `NAV_GROUPS`.** `dealBreadcrumbTrail` resolves section labels by looking `href` up there, and `spaceNavRoutes.test.ts` requires every space nav href to have a route file — a pseudo-section with no URL segment would fail it.

- [ ] **Step 3: Pass the prop from the space layout route**

In `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx`, the `PropertyDetailSidebar` call at lines 91–95 becomes:

```tsx
          <PropertyDetailSidebar
            listing={record.space}
            basePath={`/listings/${listingId}/spaces/${spaceId}`}
            activeLabel={subsectionLabel}
            // `listingId` here is the shell's — the space's route is nested under
            // it — which is exactly the building that owns its marketing.
            buildingLink={{ label: "Building", listingId }}
          />
```

**Label is "Building", not "Building Marketing".** The sidebar is 180px wide with `px-3` padding (see the `style={{ width: 180 }}` Card wrapper in this same file); the longer label wraps.

Do **not** pass `buildingLink` from the building's own sidebar call site in `src/routes/_shell/listings/$listingId.tsx` — a building has no parent to point at.

- [ ] **Step 4: Verify the type gate and suite**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: both clean. `tsc` is the real check here — it validates the `Link` `to`/`params` pair against the generated route tree, which is the one thing that would silently break.

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/PropertyDetailSidebar.tsx \
  'src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx'
git commit -m "$(cat <<'EOF'
feat(spaces): point a suite's sidebar at the building that owns its marketing

Task 1 removed six sections from a space's nav; this gives the space
somewhere to send a broker who wants them. One row at the foot of the
Marketing group, labelled "Building", targeting the building's Documents —
the first marketing section, since editing marketing is why you follow this
link.

Rendered as a Link, not a Tabs.Tab. Each group's items sit in a Tabs keyed by
the active item's label, so an item targeting another record can never match
and would be permanently inactive while still occupying the value space —
and `handleTabChange` wouldn't find it in navGroups at all.

"Building" rather than "Building Marketing": the sidebar is 180px and the
longer label wraps.

No back-link and no `from` param. Leaving the space is signalled by the
breadcrumb collapsing from five crumbs to three, which the building's header
already paints for free. Threading `from` through these routes is the pass
reverted in 86990cc.
EOF
)"
```

---

### Task 3: Send a space's Leads to the space, not the building

**This task is cuttable.** It is the outbound-link half of the same ownership rule, but nothing in Tasks 1, 2 or 4 depends on it. If it reads as scope creep, skip it and drop it from the PR body — do not half-apply it.

Three call sites route a space's Leads up to its building via `buildingSectionListingId`. Under the ownership rule that is wrong: Leads stays on the space as a filtered view (`leadsForSpaceDeal`, which deliberately does *not* fall back to building-wide inquiries), so an inquiry recorded against Suite 300 should land on Suite 300's Leads, where that inquiry actually appears — not on the building's unfiltered list.

Two of the three call sites justify the current behaviour with a comment claiming *"a space's own page has no Leads route."* That is stale: `spaces/$spaceId/leads.tsx` exists and is one of the 12 routes Task 1 keeps.

**Files:**
- Modify: `src/components/deals/dealCardLink.ts` — add `spaceLeadsTarget`, amend `buildingSectionListingId`'s doc comment
- Test: `src/components/deals/dealCardLink.test.ts` — append one `describe` block
- Modify: `src/components/contacts/ContactInquiryCard.tsx:58-66`
- Modify: `src/components/contacts/NewContactInquiryCard.tsx:67-74`
- Modify: `src/components/contacts/NewContactDealCard.tsx:120-126`

**Interfaces:**
- Produces: `spaceLeadsTarget(listingId: string): { listingId: string; spaceId: string } | null` — the params for the space's Leads route when the listing is a space, else `null`.

Returning params-or-null rather than a `{ to, params }` union is deliberate: TanStack's `navigate` is generic over `to`, and spreading a union of link objects into it does not narrow `params` against the chosen route. Each call site keeps a literal `to`, which also keeps the destinations greppable.

- [ ] **Step 1: Write the failing test**

Append to `src/components/deals/dealCardLink.test.ts`. The import on line 4 grows to include `spaceLeadsTarget`:

```ts
describe("spaceLeadsTarget", () => {
  it("returns null for a top-level deal, which reads its own Leads", () => {
    const deal = createProposalListing({ ...emptyDraft(), name: "Tower Sale", dealType: "Sale" });
    expect(spaceLeadsTarget(deal.id)).toBeNull();
  });

  it("returns both ids for a space, so its own filtered Leads can be reached", () => {
    const parent = createProposalListing({ ...emptyDraft(), name: "Plaza", dealType: "Lease" });
    const unit = addPropertyUnit(parent.propertyId, {
      label: "Suite 200",
      sqft: 1200,
      unitType: "office",
    })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;

    expect(spaceLeadsTarget(child.id)).toEqual({
      listingId: parent.id,
      spaceId: child.id,
    });
  });

  it("returns null for an unknown id, rather than inventing a destination", () => {
    expect(spaceLeadsTarget("no-such-deal")).toBeNull();
  });

  it("disagrees with buildingSectionListingId for a space, which is the point", () => {
    // Leads is NOT a building-owned section. `buildingSectionListingId` resolves a
    // space to its parent because Documents and friends really do live there;
    // Leads does not, so the two helpers must diverge here.
    const parent = createProposalListing({ ...emptyDraft(), name: "Center", dealType: "Lease" });
    const unit = addPropertyUnit(parent.propertyId, {
      label: "Suite 400",
      sqft: 900,
      unitType: "office",
    })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;

    expect(buildingSectionListingId(child.id)).toBe(parent.id);
    expect(spaceLeadsTarget(child.id)?.spaceId).toBe(child.id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test dealCardLink`
Expected: FAIL — `spaceLeadsTarget` is not exported from `./dealCardLink`.

- [ ] **Step 3: Add the helper and correct the neighbouring doc comment**

In `src/components/deals/dealCardLink.ts`, add after `buildingSectionListingId`:

```ts
/**
 * The params for this listing's own Leads page, when it is a space — otherwise
 * null, meaning read Leads on the listing itself.
 *
 * Leads is deliberately NOT a building-owned section, so this is not
 * `buildingSectionListingId`. A space's Leads page shows the building's list
 * filtered to inquiries on that suite (`leadsForSpaceDeal`, which does not fall
 * back to building-wide inquiries), which is precisely where an inquiry on the
 * suite appears. Sending it to the building's unfiltered list instead loses that
 * scoping.
 *
 * Returns params rather than a `{ to, params }` pair on purpose: `navigate` is
 * generic over `to`, and a union of link objects spread into it does not narrow
 * `params` against the chosen route. Call sites keep a literal `to`.
 */
export function spaceLeadsTarget(
  listingId: string,
): { listingId: string; spaceId: string } | null {
  const parentDealId = getListing(listingId)?.parentDealId
  return parentDealId ? { listingId: parentDealId, spaceId: listingId } : null
}
```

Then amend `buildingSectionListingId`'s doc comment (currently at line 25) so it no longer claims Leads:

```ts
/**
 * The listing whose page owns a building-level section for this deal. Sections
 * like Documents and Website belong to the building, so a space resolves to its
 * parent and everything else to itself. Takes an id rather than a Listing
 * because most callers only hold the id.
 *
 * Not for Leads — see `spaceLeadsTarget`. A space's Leads page is a filtered view
 * of the building's, so it stays on the space.
 */
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test dealCardLink`
Expected: PASS, all four new cases plus the existing `dealCardLinkProps` and `buildingSectionListingId` blocks.

- [ ] **Step 5: Update `ContactInquiryCard.tsx`**

Replace the block at lines 58–66 (the stale comment and `openLeadsRow`):

```tsx
  // An inquiry recorded against a suite opens that suite's own Leads, where the
  // inquiry actually appears — a space's Leads is the building's list filtered to
  // it. See `spaceLeadsTarget`.
  const openLeadsRow = () => {
    const search = { q: contactFullName(contact) };
    const space = spaceLeadsTarget(listingId);
    void (space
      ? navigate({ to: "/listings/$listingId/spaces/$spaceId/leads", params: space, search })
      : navigate({ to: "/listings/$listingId/leads", params: { listingId }, search }));
  };
```

Update the import on line 11 from `buildingSectionListingId` to `spaceLeadsTarget`.

Both routes validate `q`: the space's is declared on the `$spaceId` layout route and inherited by its sections.

- [ ] **Step 6: Update `NewContactInquiryCard.tsx`**

Replace the block at lines 67–74 with the identical treatment — the code is the same as Step 5 because the two cards share this behaviour by design ("one contact × listing reads the same in either treatment"):

```tsx
  // An inquiry recorded against a suite opens that suite's own Leads, where the
  // inquiry actually appears — a space's Leads is the building's list filtered to
  // it. See `spaceLeadsTarget`.
  const openLeadsRow = () => {
    const search = { q: contactFullName(contact) };
    const space = spaceLeadsTarget(listingId);
    void (space
      ? navigate({ to: "/listings/$listingId/spaces/$spaceId/leads", params: space, search })
      : navigate({ to: "/listings/$listingId/leads", params: { listingId }, search }));
  };
```

Update the import on line 22 from `buildingSectionListingId` to `spaceLeadsTarget`.

- [ ] **Step 7: Update `NewContactDealCard.tsx`**

This one has no `search`. Replace the `onClick` at lines 120–126:

```tsx
        onClick: () => {
          const space = spaceLeadsTarget(listingId);
          void (space
            ? navigate({ to: "/listings/$listingId/spaces/$spaceId/leads", params: space })
            : navigate({ to: "/listings/$listingId/leads", params: { listingId } }));
        },
```

This file imports `buildingSectionListingId` as part of a multi-name import at line 23 — replace just that name with `spaceLeadsTarget`, and check whether `buildingSectionListingId` is still used elsewhere in the file before removing it. `ContactDealCard.tsx` (lines 309 and 321) also imports it and is **not** part of this task; leave it alone.

- [ ] **Step 8: Verify nothing still routes Leads to the building**

```bash
grep -rn "listings/\$listingId/leads" src/ --include='*.tsx'
bunx tsc --noEmit
bun --bun run test
```

Expected: the three call sites each show the building form only as the non-space branch of a ternary. `tsc` clean, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/deals/dealCardLink.ts src/components/deals/dealCardLink.test.ts \
  src/components/contacts/ContactInquiryCard.tsx \
  src/components/contacts/NewContactInquiryCard.tsx \
  src/components/contacts/NewContactDealCard.tsx
git commit -m "$(cat <<'EOF'
fix(leads): open a suite's inquiry on the suite's Leads, not the building's

Three call sites sent a space's Leads up to its building via
`buildingSectionListingId`. Two justified it with a comment claiming "a
space's own page has no Leads route" — stale; that route exists and is one of
the twelve a space keeps.

Leads is not a building-owned section. A space's Leads page is the building's
list filtered by `leadsForSpaceDeal`, which deliberately does not fall back to
building-wide inquiries — an inquiry on the building's own listing is not an
inquiry on Suite 300. So an inquiry recorded against a suite should open that
suite's Leads, where it actually appears, rather than the building's
unfiltered list.

New `spaceLeadsTarget` returns params-or-null rather than a `{ to, params }`
union: `navigate` is generic over `to`, and spreading a union into it doesn't
narrow `params` against the chosen route. Call sites keep a literal `to`,
which also keeps destinations greppable.

`buildingSectionListingId` keeps its other five call sites and loses Leads
from its doc comment.
EOF
)"
```

---

### Task 4: Verify in the browser, then retire the spec

**Files:**
- Delete: `docs/superpowers/specs/2026-08-11-space-marketing-ownership-design.md`

Do **not** delete `docs/superpowers/specs/2026-08-11-media-per-space-assets-design.md`. Phase B is planned but unbuilt, so that spec is still in flight and rides to main as live work.

- [ ] **Step 1: Start the dev server**

```bash
bun --bun run dev
```

Serves on `http://localhost:3000`.

- [ ] **Step 2: Open a seeded space and check the sidebar**

Use the `playwright` MCP server. Navigate to `/listings`, then into a seeded lease shell, then its Spaces tab, then a suite.

`browser_navigate` returns before the app hydrates — its snapshot shows only `main > status "Loading"`. Always follow it with `browser_wait_for` on text unique to the destination (e.g. `"Displaying 20 of 20 Deals"` on the index). Never use `waitUntil: "networkidle"` — Vite's HMR websocket holds a connection open forever and it always times out.

Scope every selector to `main.app-shell__main`. TanStack devtools inject their own DOM, including a hidden `<h3>Tanstack Router</h3>` that matches a bare `h1,h2,h3` query and hangs a visibility wait.

Lists are Blueprint cards, not tables — `tbody tr` matches nothing on `/listings`.

Verify on the suite's page:
- The Marketing group shows **Details, Leads, Media** and a **Building ↗** row.
- None of Documents, Website, Email, Demographics, Grids or Plans appears.
- The Deal and Back Office groups are unchanged.

Snapshots run ~580 lines and are written to `.playwright-mcp/` as files rather than inlined — grep them for what you need instead of reading them whole.

- [ ] **Step 3: Follow the Building link**

Click **Building ↗**. Verify:
- The URL is `/listings/{shellId}/documents`.
- The breadcrumb shows three crumbs (`All Deals / <building> / Documents`), not five — the `Spaces / <suite>` pair is gone. This collapse is the "you have left the space" cue.
- The building's own sidebar shows the full Marketing group, Documents included.

Don't wait on a generic "page has text" condition during this client-side nav: the previous view stays mounted, so the check passes instantly and you capture the *old* page. Wait for content unique to Documents.

- [ ] **Step 4: Check the console and close the browser**

Run `browser_console_messages` and confirm no errors — in particular no TanStack "route not found" warnings from the six deleted routes.

Then `browser_close`. **This is required.** The browser does not exit on its own; it outlives the session and orphans ~8 Chrome processes plus a temp profile in `/var/folders/`. Leave the MCP server running — that one is meant to be long-lived.

- [ ] **Step 5: Confirm the deleted URLs are genuinely gone**

Navigate directly to `/listings/{shellId}/spaces/{spaceId}/documents`. Expected: TanStack's not-found handling, not a rendered Documents page. This confirms the routes were deleted rather than merely hidden from the nav.

Then `browser_close` again.

- [ ] **Step 6: Run both gates one final time**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean. Biome output and a `react`/module Vitest stderr line are known non-gates.

- [ ] **Step 7: Retire the Phase A spec**

Per the repo's convention, a spec is a working document, not a standing record: when the work ships, the spec is deleted in a `chore(docs):` commit that goes out with the branch. Anything worth keeping that isn't already in a commit or PR body — chiefly "we tried X and reverted it" — goes into the PR body *first*.

For this branch, that means the cuttable Task 3 decision: if Task 3 was skipped, say so in the PR body along with why, so the next person doesn't rediscover the stale `buildingSectionListingId` comment as a bug.

```bash
git rm docs/superpowers/specs/2026-08-11-space-marketing-ownership-design.md
git commit -m "$(cat <<'EOF'
chore(docs): retire the Phase A space marketing ownership spec

Shipped. The rationale lives in the three feature commits on this branch and
in the PR body; recover the spec with
`git show <this-commit>^:docs/superpowers/specs/2026-08-11-space-marketing-ownership-design.md`
if it's ever wanted.

Phase B's spec (media-per-space-assets) stays — that work is planned but
unbuilt, so it's still in flight.
EOF
)"
```

- [ ] **Step 8: Hand off**

Do not merge. Report to Joel with the gate output, then open the PR via `/ship` on his approval.

---

## Self-Review

**Spec coverage.** Walking the spec section by section:

| Spec section | Task |
|---|---|
| The rule (ownership follows the asset) | Task 1 comment on `BUILDING_OWNED_HREFS`; commit bodies |
| Scope table — six sections removed | Task 1 |
| Scope table — Details/Leads/Media stay | Task 1, Step 1 (the exact-contents assertion) |
| Plans stays a building-owned stub | Task 1 (deleted from the space only); commit body states why |
| "Building" nav item, label and icons | Task 2, Steps 1–3 |
| Link row not a `Tabs.Tab`, with reasoning | Task 2, Step 2 |
| Target is the building's Documents | Task 2, Step 2 |
| Breadcrumb collapse as the cue; no `from` param | Task 4, Step 3; Task 2 commit body |
| `visibleNavGroups` change | Task 1, Step 3 |
| `PropertyDetailSidebar` `buildingLink` prop | Task 2, Step 1 |
| `$spaceId.tsx` passes it | Task 2, Step 3 |
| Six route deletions, verified safe | Task 1, Steps 5–6 |
| No Building entry in `NAV_GROUPS` | Task 2, Step 2 (stated with reasoning) |
| Leads call sites (cuttable) | Task 3 |
| `buildingSectionListingId` doc comment | Task 3, Step 3 |
| Testing — `visibleNavGroups` assertions | Task 1, Step 1 |
| Browser verification | Task 4, Steps 2–5 |
| Gates | Every task; Task 4, Step 6 |

No gaps. One thing the spec did not anticipate and this plan adds: `spaceNavRoutes.test.ts` binds the nav filter and the route deletions into a single commit, and its `> 10` guard needs checking at 12. That is reflected in Task 1's framing and Step 7.

**Placeholder scan.** No "TBD", "TODO", "similar to Task N", or "add appropriate error handling". Every code step carries the actual code. Task 3's Steps 5 and 6 repeat the same block verbatim rather than cross-referencing, because tasks may be read out of order.

**Type consistency.** `BUILDING_OWNED_HREFS: readonly string[]` is declared in Task 1 and consumed by name in Task 1's test and Task 2's import and comment. `buildingLink?: { label: string; listingId: string }` is declared in Task 2 Step 1 and passed in the same shape in Step 3. `spaceLeadsTarget(listingId: string): { listingId: string; spaceId: string } | null` is declared in Task 3 Step 3 and used in that exact shape at all three call sites in Steps 5–7. `visibleNavGroups`' signature is unchanged throughout.
