# Suite as a Panel Over the Building — Design

**Status:** Approved design (2026-08-03), pending spec review.
**Supersedes parts of:** `2026-07-31-lease-space-marketing-scope-design.md` — specifically the space
deal's standalone page, its own sidebar, and the Property Marketing hub. The scope model in that
document (property-level / unit-filtered / space-owned) survives unchanged and is load-bearing here.
**Scope:** Landlord rep lease only. Sale deals, buy-side, and flat lease deals are untouched.

---

## The problem

A space deal today is a full page: its own header, its own sidebar, its own routes. But almost
everything a suite would want to show belongs to the building — the brochure, the website, the email
campaign, the photo library, the files. So the suite's page spends its existence borrowing, and the
prototype has accumulated machinery to manage the borrowing:

- A hub page whose only job is to explain that marketing lives on the building.
- A `from` search param threaded through the sidebar so the broker can find their way back.
- A scope bar that appears on the building's marketing tabs to say who sent you.
- Two filter sets (`PROPERTY_ONLY`, `SHELL_ONLY`) hiding building things from a suite.

The cost lands on the broker as a round trip. Reaching the building's website editor from Suite 200
means suite → hub → building, with the entire frame swapping on the last hop, and two clicks back.
The observed workflow makes this worse: a broker bounces — fix Suite 200's rate, glance at the
brochure, fix Suite 300, resend the email — so the trip is paid repeatedly in one sitting.

The deeper failure is a safety one. Any design that renders a shared editor inside a suite's frame
must then warn the user that what looks local is not, and the warning is the only thing standing
between them and editing the whole building's brochure believing they are editing one suite's. A
banner that load-bearing is a patch.

## The principle

> **The frame declares the scope. Disclosure belongs before the click, not after it.**

With a corollary that decides the architecture:

> **Overlay direction determines whether the frame lies.** Narrow scope layered over broad scope is
> honest — the thing on top is the focus, the thing underneath is the context it belongs to. Broad
> over narrow lies: a building-wide editor floating above a suite's header and breadcrumb contradicts
> the frame behind it.

This is why a drawer holding *shared marketing* over a *suite* page was rejected, and a panel holding
a *suite* over the *building* page is correct. Same mechanism, opposite truth value.

## The constraint

Production may not change to match the prototype. In production a lease listing is **one record**:
spaces are rows inside its edit form, and one brochure, one website, and one email campaign hang off
it. There is no per-suite marketing and no near-term plan for any.

This rules out every design that gives a suite its own marketing surfaces. It does *not* rule out the
design below — a building page holding shared assets plus a roster of space rows is a close
description of what production already is. The prototype's genuine invention, and the part worth
keeping, is that each space runs its own pipeline and earns its own commission.

---

## The model

**The building is the only page.** One sidebar, always the building's. No shape-dependent navigation,
no scope banners, nothing that can be mislabeled.

**A suite is a panel over it.**

```
/listings/{shellId}/spaces/{suiteId}
```

A child route of `spaces`, so the roster and the building's chrome are the *parent* route and never
unmount. The background is preserved structurally rather than restored — the same effect Zillow
achieves by intercepting routes, obtained here for free because we do not need the standalone
rendering that forces interception. A suite standing alone is the bug being fixed.

Consequences, all desirable:

| Behavior | Result |
|---|---|
| Back button | Pops to the parent; the panel closes, background untouched |
| Deep link / refresh | Building + roster render, panel opens over them |
| Sharing a suite | Works — the URL is real, not UI state |
| Renderings of a suite | Exactly one |

**`/listings/{suiteId}` redirects in**, to `/listings/{shellId}/spaces/{suiteId}`. Board cards, contact
record links, and the Spaces roster's "Open deal" button keep working with no changes at their call
sites.

### Route changes

- `$listingId/spaces.tsx` keeps the roster and gains an `<Outlet />`, becoming a layout that still
  renders content. No index route is needed.
- New `$listingId/spaces/$spaceId.tsx` renders the panel.
- The redirect belongs in `$listingId.tsx`'s `beforeLoad`: if the listing has a `parentDealId`,
  redirect to the nested panel URL. Placing it on the layout catches every sub-route at once, so
  `/listings/{suiteId}/financials` resolves too rather than 404ing.

## What the panel holds

| Section | Scope category | Notes |
|---|---|---|
| Stage + gate actions | space-owned | The pipeline is why a suite is a deal at all |
| Tenant + brokers on the deal | space-owned | The parties to *this* letting |
| Terms (`SpaceTermsSection`) | space-owned | The component already exists and moves as-is |
| Financials / commission | space-owned | Money is earned per suite |
| Back office — voucher, invoices, notes, attachments | space-owned | The one place suite-level attachments live |
| Leads — this suite only | unit-filtered | Shared store, scoped view |
| Media — this suite only | unit-filtered | Shared store, scoped view |
| Activity + history | space-owned | Each child already keeps its own `history` |

There is no "Overview" section, because the panel *is* the suite's overview. What the suite's Overview
page carried that remains suite-level — stage, tenant, brokers — appears as the panel's own top
content, and the four headline facts rescued from the deleted hub sit alongside them.

**No landlord or seller in the panel.** The owning party is known at the building level, so repeating
it in every suite is noise. This makes `addSpaceToDeal`'s current copy of `sellerContactIds` onto each
child questionable — resolve during planning rather than carrying it forward by inertia.

The unit-filtered rows need no new data plumbing: Media and Leads were already scoped by space deal id
(`07e0214`, `baee651`). That scope category, defined in the 2026-07-31 spec, is what makes the panel
cheap to build.

## What stays at the building

Documents and files · Website · Email · Demographics · Grids · Plans · Client Report · Underwriting ·
the Spaces roster, which is now the panel's index.

## What gets deleted

Not refactored — deleted. Each of these exists only to sustain a suite pretending to be a page:

- `PropertyMarketingHub.tsx` and the `property-marketing` route
- `MarketingScopeBar.tsx` and the `from` param threaded through the sidebar's `handleTabChange`
- `PROPERTY_ONLY` and `SHELL_ONLY` filtering for space deals in `PropertyDetailSidebar`
- The Listing-tab collapse special case for a space deal (`b8da273`)
- The `parentDeal` breadcrumb branch in `PropertyDetailHeader`
- The Spaces roster's inline row expansion, replaced by the panel

The suite's own routes go with them — `overview`, `activities`, `history`, `leads`, `media`,
`financials`, `financial-documents`, `notes` no longer resolve for a space deal, because the layout
redirect catches them before they render. Their surviving content is listed in the panel table above.

**`dealShape` stays.** `'space'` still drives the truncated stage ladder and the Draft/Pitching
relabel. What is being removed is navigation machinery, not the model.

## Also in scope

The building's Leads list gains a **Space** column. A landlord rep needs every inquiry on the building
in one place; the panel's filtered view serves the per-suite question. Both, not either.

## Stage gates stay modals

Advancing a suite means a modal over the panel over the page, and that is accepted rather than worked
around. A gate is a quick review-and-confirm — it is not a surface the broker sits in — so a
short-lived third layer is cheaper than inlining gate logic into the panel or inventing a second gate
presentation for suites only.

Two things make it safe: `GlobalStageGateModal` is mounted once in `AppShell.tsx`, so the gate is
portaled at the root rather than nested inside the panel's DOM; and `requestStageChange` already
refuses any target outside the shape's ladder (`c7620a9`), so the backstop is independent of how the
gate is presented. Stacking order still wants a visual check.

## Deferred: panel internals

Eight sections is a lot for a panel, and refining them against a sketch is guesswork. The panel's
width, whether the sections stack in one scroll or get internal navigation, and which of them collapse
or merge are **deliberately left to a follow-on design**, to be settled once there is something to
click through. The expectation is that sections will merge, not that eight is right.

## Risks

**Eight sections approaches a page inside an overlay** — the failure mode this design exists to
escape. Two things argue it still holds: the background persists, so the broker never loses the
building; and the eight are materially narrower than today's suite page, which additionally carries
six marketing surfaces, client report, underwriting, and files. This is the first thing to judge from
a real click-through, and it argues for a wide sheet over a narrow drawer.

**Voucher and invoices are tabular** and want width the panel may not give them. They are also the
section most firmly space-owned, so they cannot be moved to the building to solve it.

**Losing the inline roster editor removes a fast lane.** Editing four suites' rates from the roster
was quick. If the panel proves slower for that specific task, a compact inline path may need to come
back — but not alongside the panel as a second editor for the same fields.

## Alternatives considered

| Approach | Why not |
|---|---|
| Rename the sidebar groups only | Fixes the naming collision, leaves the round trip and the frame swap entirely in place |
| Render shared surfaces inside the suite's frame | Makes shared editing look local, then relies on a banner to undo the impression it created |
| Drawer holding a shared asset over a suite page | Same objection, slightly worse — the suite's header and breadcrumb stay visible behind the shared editor |
| A building-level marketing workspace page | Sound and production-shaped, but re-homes six working pages to solve a problem the panel solves without moving them |
| Suite keeps `/listings/{suiteId}` via route masking | Requires maintaining two renderings of a suite, and the standalone one is exactly where the deleted machinery would have to survive |
| Search param instead of a child route | Avoids route surgery, but reads as UI state rather than a resource, and the roster/panel relationship is genuinely parent/child |

## Implementation notes

- **Route moves have bitten this repo before.** `PropertyDetailSidebar` and `MarketingScopeBar` use
  hardcoded `useParams({ from: "/_shell/listings/$listingId" })`, and `vite build` does not type-check.
  Converting `spaces.tsx` into a layout needs a deliberate pass over every `from:` string, and
  `bunx tsc --noEmit` is the gate.
- **The deals board navigates cross-record now.** A space card resolves through the redirect to the
  building with the panel open. Worth confirming this reads as intentional rather than as a bug.
- **No component test infrastructure exists** (no testing-library, no jsdom), so route and redirect
  behavior gets pinned at the data layer plus manual verification, as with the `dealShape` subscription
  guard in `413dda8`.
