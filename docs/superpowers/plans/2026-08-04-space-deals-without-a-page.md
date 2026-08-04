# Space Deals Without a Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a lease building and its spaces feel like one page — a space stays a child deal on the pipeline board but has no page of its own; its three surfaces (terms, voucher, invoices) become space-aware sections of the building.

**Architecture:** Section-major, not space-major. The roster (`spaces.tsx`) owns a space's terms, stage and gate. Back Office swaps `Voucher`/`Invoices` for one `Vouchers` index that drills into `vouchers/{spaceId}`. Breadcrumbs carry the drill-down. Nine pieces of borrow-and-return machinery — which existed only so a *space page* could reach the building's marketing — are deleted last, after their replacements work.

**Tech Stack:** React 19 · TypeScript · TanStack Start (file-based routing) · Zustand + IndexedDB store · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Vitest

**Spec:** `docs/superpowers/specs/2026-08-04-space-deals-without-a-page-design.md`

## Global Constraints

- **Package manager is Bun.** Run everything as `bun --bun run <script>`, or `bunx <tool>` for one-offs.
- **Never hand-edit `src/routeTree.gen.ts`.** It carries `// @ts-nocheck`, so neither `tsc` nor `vite build` catches a stale route tree — only regeneration does. Run `bunx vite build` after adding or removing a route file, and commit the regenerated result.
- **Gates are `bunx tsc --noEmit` and `bunx vitest run`.** `vite build` does *not* type-check. Biome disagrees with this repo's spaces-vs-tabs across the board — it is not a gate; ignore it. A `react/module` stderr line from Vitest is also a known non-gate.
- **Do not use Playwright.** Run what you can; ask the user to click through the rest.
- **Blueprint components only** — import from the `ui` subpath, e.g. `@buildoutinc/blueprint-react/ui/Table`. Use Bootstrap utility classes for spacing/layout. Blueprint's CSS var prefix is `--bp-`, so `--bs-*` overrides silently do nothing.
- **Icons:** FontAwesome Pro, `@fortawesome/pro-regular-svg-icons` by default. **Never pass `fixedWidth`** — it is deprecated.
- **No `margin` utility classes on icons inside a Blueprint `Badge`** — Badge already has flex gap.
- **Money format:** `` `$${Math.round(n).toLocaleString("en-US")}` `` — matches `src/features/editor/dynamic.ts`.
- **Contact display name:** `` `${c.firstName} ${c.lastName}`.trim() `` — matches `BuyerSection.tsx`.
- **Blueprint `Field` parts require a `Field.Root` ancestor.** A standalone `Field.Description` or `Field.Label` crashes at runtime and `tsc` will not catch it. Use the `form-text` class for detached helper text.
- **Files in `src/data/` use 2-space indent and no semicolons** (see `buildingAvailability.ts`). Files in `src/components/` and `src/routes/` use semicolons. Match the file you are editing.
- **Commit after every task.** Do not merge, push, or open a PR — the user handles that.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/data/spaceVouchers.ts` | Derive the Vouchers index rows from a shell's children | 1 |
| `src/data/spaceVouchers.test.ts` | Tests for the above | 1 |
| `src/components/properties/dealNav.ts` | `NAV_GROUPS` (extracted) + `dealBreadcrumbTrail` — one source of truth for section names | 2 |
| `src/components/properties/dealNav.test.ts` | Tests for `dealBreadcrumbTrail` | 2 |
| `src/routes/_shell/listings/$listingId/vouchers/index.tsx` | The per-space money index | 3 |
| `src/routes/_shell/listings/$listingId/vouchers/$spaceId.tsx` | One space's voucher + invoices, scoped to its building | 4 |
| `src/components/deals/DealFinancials.tsx` | Gains optional `heading` | 4 |
| `src/components/deals/DealInvoices.tsx` | Gains optional `heading` | 4 |
| `src/components/properties/PropertyDetailSidebar.tsx` | Imports `NAV_GROUPS`; Back Office varies by shape | 2, 5 |
| `src/components/properties/PropertyDetailHeader.tsx` | Breadcrumb gains section + detail crumbs | 6 |
| `src/routes/_shell/listings/$listingId/spaces.tsx` | Roster owns terms + stage + gate | 7 |
| `src/components/deals/dealCardLink.ts` | One rule for where a deal card goes — a space's card opens its building's roster | 8 |
| `src/components/deals/dealCardLink.test.ts` | Tests for the above | 8 |
| `src/components/deals/DealCard.tsx`, `src/components/contacts/TimelineEvent.tsx` | Three card `Link`s adopt that rule | 8 |
| *deletions* | The borrow-and-return machinery | 9 |

No `vouchers.tsx` layout file is needed — this repo already nests `listings/index.tsx` alongside `listings/$listingId.tsx` with no `listings.tsx`, so TanStack creates the intermediate route itself.

---

### Task 1: `spaceVouchers` derivation

Pure data, no UI. Deliberately mirrors `buildingAvailability` — same source, same `flatMap`-over-children shape — and sits beside it.

**Files:**
- Create: `src/data/spaceVouchers.ts`
- Create: `src/data/spaceVouchers.test.ts`

**Interfaces:**
- Consumes: `getListing`, `getProperty`, `getContact` from `./store`; `getChildDeals` from `./leaseSpaces`; `PropertyStatus` from `./types`
- Produces: `SpaceVoucherRow` and `spaceVouchers(shellDealId: string): SpaceVoucherRow[]`, used by Task 3

- [ ] **Step 1: Write the failing test**

Create `src/data/spaceVouchers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition, createContact } from './actions'
import { spaceVouchers } from './spaceVouchers'

function makeParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('spaceVouchers', () => {
  it('returns one row per child, with tenant and commission once transacted', () => {
    const parent = makeParent()
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite 210', sqft: 2000, unitType: 'office' })!
    const childA = addSpaceToDeal(parent.id, a.id)!.deal
    addSpaceToDeal(parent.id, b.id)

    const { contact } = createContact({ firstName: 'Ada', lastName: 'Nunez', company: 'Acme Corp' })
    commitStageTransition({
      dealId: childA.id,
      targetStage: 'closed',
      actor: 'T',
      tenantContactId: contact.id,
      transaction: { commissionAmount: 42000 },
    })

    const rows = spaceVouchers(parent.id)
    expect(rows).toHaveLength(2)

    const rowA = rows.find((r) => r.dealId === childA.id)!
    expect(rowA.label).toBe('Suite 100')
    expect(rowA.tenantName).toBe('Ada Nunez')
    expect(rowA.commissionAmount).toBe(42000)
    expect(rowA.stage).toBe('closed')
  })

  it('reports no tenant and no commission for a space that has not transacted', () => {
    const parent = makeParent()
    const u = addPropertyUnit(parent.propertyId, { label: 'Suite 305', sqft: 900, unitType: 'retail' })!
    addSpaceToDeal(parent.id, u.id)

    const row = spaceVouchers(parent.id)[0]!
    expect(row.tenantName).toBeNull()
    expect(row.commissionAmount).toBeNull()
    expect(row.stage).toBe('proposal')
  })

  it('sorts by suite label so the index and the roster agree', () => {
    const parent = makeParent()
    // Added out of order on purpose: getChildDeals returns store-insertion order.
    const c = addPropertyUnit(parent.propertyId, { label: 'Suite 305', sqft: 300, unitType: 'retail' })!
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 100, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite 210', sqft: 200, unitType: 'retail' })!
    addSpaceToDeal(parent.id, c.id)
    addSpaceToDeal(parent.id, a.id)
    addSpaceToDeal(parent.id, b.id)

    expect(spaceVouchers(parent.id).map((r) => r.label)).toEqual([
      'Suite 100', 'Suite 210', 'Suite 305',
    ])
  })

  it('returns nothing for a deal with no children', () => {
    expect(spaceVouchers(makeParent().id)).toEqual([])
  })

  it('returns nothing for an unknown deal id', () => {
    expect(spaceVouchers('nope')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/data/spaceVouchers.test.ts`
Expected: FAIL — `Failed to resolve import "./spaceVouchers"`.

- [ ] **Step 3: Write the implementation**

Create `src/data/spaceVouchers.ts`:

```ts
import type { PropertyStatus } from './types'
import { getListing, getProperty, getContact } from './store'
import { getChildDeals } from './leaseSpaces'

export interface SpaceVoucherRow {
  dealId: string
  /** The suite's label, falling back to the child deal's name. */
  label: string
  /** The first accepted tenant, or null before one is captured. */
  tenantName: string | null
  /** Null until the space transacts — an index row shows an em-dash for it. */
  commissionAmount: number | null
  /** Raw status. Render through `dealStageLabel(stage, 'space')`. */
  stage: PropertyStatus
}

/**
 * Every space's money, for the shell's Vouchers index. Mirrors
 * `buildingAvailability`: same source (the shell's child deals), same shape, so
 * the two derivations stay recognisable as siblings.
 *
 * Sorted by suite label. `getChildDeals` returns store-insertion order, which is
 * arbitrary to a broker, and the roster applies the same sort — the two pages
 * must not disagree about ordering.
 */
export function spaceVouchers(shellDealId: string): SpaceVoucherRow[] {
  const shell = getListing(shellDealId)
  if (!shell) return []
  const property = getProperty(shell.propertyId)

  return getChildDeals(shellDealId)
    .map((child) => {
      const unit = property?.units.find((u) => u.id === child.unitId)
      const tenantId = child.tenantContactIds[0]
      const tenant = tenantId ? getContact(tenantId) : undefined
      const commission = child.transaction.commissionAmount
      return {
        dealId: child.id,
        label: unit?.label ?? child.name,
        tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : null,
        // `createProposalListing` seeds commissionAmount to 0 and the type is
        // `number`, so 0 — not null — is what "has not transacted yet" looks
        // like. Hence a positive test rather than a null check. The prototype
        // records no genuine $0 commission, and the index prints this row's
        // stage right beside the figure, so "—" is never ambiguous in practice.
        // Do NOT widen DealTransaction.commissionAmount to make this nullable:
        // that taxes every call site app-wide for a distinction nothing makes.
        commissionAmount: commission > 0 ? commission : null,
        stage: child.status,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run src/data/spaceVouchers.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Fix the stale label in the sibling file**

In `src/data/buildingAvailability.ts:15`, the doc comment says `Draft or Lost`. `Draft` was renamed to `Inactive` in `e31f8a6`. Change:

```ts
  /** False for a space the building is not currently advertising (Inactive or Lost). */
```

- [ ] **Step 6: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; all tests pass (665 + 5 = 670).

- [ ] **Step 7: Commit**

```bash
git add src/data/spaceVouchers.ts src/data/spaceVouchers.test.ts src/data/buildingAvailability.ts
git commit -m "feat(vouchers): derive every space's money for a shell's index"
```

---

### Task 2: Extract `NAV_GROUPS` and add `dealBreadcrumbTrail`

The breadcrumb needs section labels that cannot drift from the sidebar's, so both read one module.

**Files:**
- Create: `src/components/properties/dealNav.ts`
- Create: `src/components/properties/dealNav.test.ts`
- Modify: `src/components/properties/PropertyDetailSidebar.tsx` (remove the local `NAV_GROUPS`, import it)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `NavItem`, `NavGroup`, `NAV_GROUPS`, and `dealBreadcrumbTrail(pathname: string, listingId: string): { sectionLabel: string | null; detailId: string | null }`. Task 5 filters `NAV_GROUPS`; Task 6 calls `dealBreadcrumbTrail`.

- [ ] **Step 1: Write the failing test**

Create `src/components/properties/dealNav.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dealBreadcrumbTrail, NAV_GROUPS } from './dealNav'

const ID = 'deal-1'

describe('dealBreadcrumbTrail', () => {
  it('reports no section on the deal root', () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    })
  })

  it('tolerates a trailing slash on the deal root', () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    })
  })

  it('labels a known single-level section from NAV_GROUPS', () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/leads`, ID)).toEqual({
      sectionLabel: 'Leads',
      detailId: null,
    })
  })

  it('carries the detail id on a drill-down', () => {
    // Asserted through `financials` rather than `vouchers`: the Vouchers item
    // does not enter NAV_GROUPS until Task 5, so that href would not resolve
    // yet. The parsing under test is the same either way. Task 6 adds the real
    // vouchers/{spaceId} case once the item exists.
    expect(dealBreadcrumbTrail(`/listings/${ID}/financials/space-9`, ID)).toEqual({
      sectionLabel: 'Voucher',
      detailId: 'space-9',
    })
  })

  it('shows no crumb for a section absent from NAV_GROUPS, rather than inventing one', () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/edit`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    })
  })

  it('ignores a pathname for a different deal', () => {
    expect(dealBreadcrumbTrail('/listings/other/leads', ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    })
  })
})

describe('NAV_GROUPS', () => {
  it('has unique hrefs, so a breadcrumb lookup cannot be ambiguous', () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/components/properties/dealNav.test.ts`
Expected: FAIL — `Failed to resolve import "./dealNav"`.

- [ ] **Step 3: Create `dealNav.ts`**

Move the `NavItem`/`NavGroup` types and the whole `NAV_GROUPS` array out of `PropertyDetailSidebar.tsx:39-92` **verbatim** — no items added, removed, or reordered. Task 5 adds the `Vouchers` item. Create `src/components/properties/dealNav.ts`:

```ts
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGaugeHigh,
  faFileChartColumn,
  faBolt,
  faClockRotateLeft,
  faVectorSquare,
  faHardDrive,
  faCalculator,
  faAddressBook,
  faFileLines,
  faGlobe,
  faEnvelope,
  faImage,
  faMapLocationDot,
  faTableCells,
  faRulerCombined,
  faBuildingFlag,
  faFileInvoiceDollar,
  faReceipt,
  faNoteSticky,
} from "@fortawesome/pro-regular-svg-icons";

export type NavItem = { label: string; href: string; icon: IconDefinition };
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * Every section a deal can have, in display order. The single source of truth for
 * a section's name: the sidebar renders these, and the breadcrumb looks its label
 * up here, so a rename cannot leave the two disagreeing.
 *
 * This is the full set — `PropertyDetailSidebar` filters it by deal shape.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Deal",
    items: [
      { label: "Overview", href: "overview", icon: faGaugeHigh },
      { label: "Client Report", href: "client-report", icon: faFileChartColumn },
      { label: "Activity", href: "activities", icon: faBolt },
      { label: "History", href: "history", icon: faClockRotateLeft },
      { label: "Spaces", href: "spaces", icon: faVectorSquare },
      { label: "Files", href: "files", icon: faHardDrive },
      { label: "Underwriting", href: "underwriting", icon: faCalculator },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Leads", href: "leads", icon: faAddressBook },
      { label: "Documents", href: "documents", icon: faFileLines },
      { label: "Website", href: "website", icon: faGlobe },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Media", href: "media", icon: faImage },
      { label: "Demographics", href: "demographics", icon: faMapLocationDot },
      { label: "Grids", href: "grids", icon: faTableCells },
      { label: "Plans", href: "plans", icon: faRulerCombined },
      { label: "Property Marketing", href: "property-marketing", icon: faBuildingFlag },
    ],
  },
  {
    label: "Back Office",
    items: [
      { label: "Voucher", href: "financials", icon: faFileInvoiceDollar },
      { label: "Invoices", href: "financial-documents", icon: faReceipt },
      { label: "Notes", href: "notes", icon: faNoteSticky },
    ],
  },
];

/**
 * Which section — and, on a drill-down, which record — the current URL is on.
 *
 * Returns the section's *label* (from the static NAV_GROUPS) and the detail's
 * *id* (a route param). Resolving that id to a human name needs the store, so
 * the caller does it and this stays pure and testable.
 *
 * The section is the first segment after the listing id, never the last: a
 * drill-down appends its own segment, and matching the last one would report
 * the record as the section.
 */
export function dealBreadcrumbTrail(
  pathname: string,
  listingId: string,
): { sectionLabel: string | null; detailId: string | null } {
  const none = { sectionLabel: null, detailId: null };
  const prefix = `/listings/${listingId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return none;

  const [section, detail] = pathname.slice(prefix.length).replace(/^\//, "").split("/");
  if (!section) return none;

  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === section);
  if (!item) return none;

  return { sectionLabel: item.label, detailId: detail ?? null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run src/components/properties/dealNav.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Point the sidebar at the shared module**

In `src/components/properties/PropertyDetailSidebar.tsx`, delete the local `NavItem`/`NavGroup` types and the entire `NAV_GROUPS` const (lines 39-92), and import them instead:

```tsx
import { NAV_GROUPS } from "#/components/properties/dealNav";
```

Then remove every icon import that is now unused from this file. After the move, the sidebar's own JSX still uses `faChevronRight`, so keep that one; `tsc` will name any others via `noUnusedLocals`.

This task is a pure move plus one new pure function: the sidebar renders exactly the same nav afterwards. Nothing about the UI should change.

- [ ] **Step 6: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0 (fix any unused-import errors it names); all tests pass (670 + 7 = 677).

- [ ] **Step 7: Commit**

```bash
git add src/components/properties/dealNav.ts src/components/properties/dealNav.test.ts src/components/properties/PropertyDetailSidebar.tsx
git commit -m "refactor(nav): give the sidebar and breadcrumb one source of section names"
```

---

### Task 3: The Vouchers index route

**Files:**
- Create: `src/routes/_shell/listings/$listingId/vouchers/index.tsx`
- Modify: `src/routeTree.gen.ts` (**by regeneration only**)

**Interfaces:**
- Consumes: `spaceVouchers`, `SpaceVoucherRow` from Task 1
- Produces: the route `/listings/$listingId/vouchers`, linked to by Tasks 5 and 7

- [ ] **Step 1: Create the route**

Create `src/routes/_shell/listings/$listingId/vouchers/index.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleRight } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { dealStageLabel } from "#/data/dealShape";
import { spaceVouchers } from "#/data/spaceVouchers";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";

export const Route = createFileRoute("/_shell/listings/$listingId/vouchers/")({
  component: VouchersIndexRoute,
});

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Every space's money in one place. A shell holds no rate and earns no commission
 * of its own, so the only figure it can honestly show is the sum of what its
 * spaces are earning — which is the question this index exists to answer.
 */
function VouchersIndexRoute() {
  const { listingId } = Route.useParams();
  // Subscribe to the map: a row's commission and tenant live on the *child*
  // deals, so this must re-render when any of them changes, not just the shell.
  void useDataStore((s) => s.listings);
  const rows = spaceVouchers(listingId);
  const total = rows.reduce((sum, r) => sum + (r.commissionAmount ?? 0), 0);

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title="Vouchers"
        actions={
          <span className="text-muted">
            {rows.length} {rows.length === 1 ? "space" : "spaces"} · {money(total)} total
          </span>
        }
      />

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Space</Table.Head>
            <Table.Head>Tenant</Table.Head>
            <Table.Head>Commission</Table.Head>
            <Table.Head>Stage</Table.Head>
            <Table.Head style={{ width: 44 }} />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.dealId}>
              <Table.Cell className="fw-medium">
                <Link
                  to="/listings/$listingId/vouchers/$spaceId"
                  params={{ listingId, spaceId: row.dealId }}
                  className="text-reset"
                >
                  {row.label}
                </Link>
              </Table.Cell>
              {/* An em-dash, not a zero: a voucher exists before it is filled. */}
              <Table.Cell>{row.tenantName ?? "—"}</Table.Cell>
              <Table.Cell>
                {row.commissionAmount == null ? "—" : money(row.commissionAmount)}
              </Table.Cell>
              <Table.Cell>{dealStageLabel(row.stage, "space")}</Table.Cell>
              <Table.Cell>
                <FontAwesomeIcon icon={faAngleRight} className="text-muted" />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Regenerate the route tree**

Run: `bunx vite build`
Expected: builds clean. Then confirm the route registered:

Run: `grep -c "vouchers" src/routeTree.gen.ts`
Expected: a non-zero count.

- [ ] **Step 3: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; 677 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/vouchers/index.tsx src/routeTree.gen.ts
git commit -m "feat(vouchers): index every space's commission on the shell"
```

---

### Task 4: The per-space voucher detail

**Files:**
- Create: `src/routes/_shell/listings/$listingId/vouchers/$spaceId.tsx`
- Modify: `src/components/deals/DealFinancials.tsx:931-942`
- Modify: `src/components/deals/DealInvoices.tsx:56-66`
- Modify: `src/routeTree.gen.ts` (**by regeneration only**)

**Interfaces:**
- Consumes: `DealFinancials`, `DealInvoices` (both gain an optional `heading`)
- Produces: the route `/listings/$listingId/vouchers/$spaceId`, linked to by Tasks 3 and 7

- [ ] **Step 1: Give `DealFinancials` an optional heading**

In `src/components/deals/DealFinancials.tsx`, change the signature and the header's title. It is `title="Voucher"` today:

```tsx
export function DealFinancials({
  listing,
  heading = "Voucher",
}: {
  listing: Listing;
  /** Overridden on a shell's per-space voucher, so the suite is named. */
  heading?: string;
}) {
  return (
    <div className="d-flex flex-column gap-5 p-4">
      <ListingPageHeader
        title={heading}
```

Leave the rest of the component untouched.

- [ ] **Step 2: Give `DealInvoices` an optional heading**

Same edit in `src/components/deals/DealInvoices.tsx`, where the title is `"Invoices"`:

```tsx
export function DealInvoices({
  listing,
  heading = "Invoices",
}: {
  listing: Listing;
  /** Overridden on a shell's per-space voucher, so the suite is named. */
  heading?: string;
}) {
  const invoices: InvoiceRow[] = [draftInvoice(listing)];

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title={heading}
```

- [ ] **Step 3: Create the detail route**

Create `src/routes/_shell/listings/$listingId/vouchers/$spaceId.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { DealFinancials } from "#/components/deals/DealFinancials";
import { DealInvoices } from "#/components/deals/DealInvoices";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/vouchers/$spaceId",
)({
  component: SpaceVoucherRoute,
});

/**
 * One space's money, rendered inside its building. The `listingId` segment
 * declares which building this is scoped to, and a space whose parent differs
 * must never render under it — that would paint this suite's commission over
 * another landlord's frame, which is the bug ab7b6be caught during the reverted
 * panel work. Hence the `belongsHere` guard rather than a bare lookup.
 */
function SpaceVoucherRoute() {
  const { listingId, spaceId } = Route.useParams();
  // The map, not `.get(spaceId)`: the guard below reads the *parent*, so this
  // must re-render when any listing changes.
  const listings = useDataStore((s) => s.listings);
  const space = listings.get(spaceId);

  const belongsHere = !!space && space.parentDealId === listingId;
  if (!space || !belongsHere) return null;

  const property = getProperty(space.propertyId);
  const label =
    property?.units.find((u) => u.id === space.unitId)?.label ?? space.name;

  return (
    <div>
      <DealFinancials listing={space} heading={`Voucher — ${label}`} />
      <DealInvoices listing={space} heading={`Invoices — ${label}`} />
    </div>
  );
}
```

- [ ] **Step 4: Regenerate the route tree**

Run: `bunx vite build`
Expected: builds clean.

Run: `grep -c "VouchersSpaceId" src/routeTree.gen.ts`
Expected: a non-zero count.

- [ ] **Step 5: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; 677 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/vouchers/\$spaceId.tsx src/components/deals/DealFinancials.tsx src/components/deals/DealInvoices.tsx src/routeTree.gen.ts
git commit -m "feat(vouchers): open a space's voucher and invoices inside its building"
```

---

### Task 5: Back Office varies by deal shape

Adds the `Vouchers` item and, in the same task, moves the sidebar's shape rules into a tested pure function beside the nav data they filter. The rules were inline in JSX with no test file; putting them in `dealNav.ts` is what makes this task's one new rule verifiable at all.

**Files:**
- Modify: `src/components/properties/dealNav.ts` (add the `Vouchers` item; add `visibleNavGroups`)
- Modify: `src/components/properties/dealNav.test.ts` (tests for `visibleNavGroups`)
- Modify: `src/components/properties/PropertyDetailSidebar.tsx` (call `visibleNavGroups`)

**Interfaces:**
- Consumes: `NAV_GROUPS`, `NavGroup` from Task 2; the `vouchers` route from Task 3
- Produces: `visibleNavGroups(shape: DealShape, opts: { leaseParent: boolean; showsUnderwriting: boolean }): NavGroup[]` — Task 9 deletes two of its rules

- [ ] **Step 1: Write the failing tests**

Append to `src/components/properties/dealNav.test.ts`:

```ts
import { visibleNavGroups } from './dealNav'

function hrefs(shape: Parameters<typeof visibleNavGroups>[0], opts = {
  leaseParent: false,
  showsUnderwriting: false,
}) {
  return visibleNavGroups(shape, opts).flatMap((g) => g.items).map((i) => i.href)
}

describe('visibleNavGroups', () => {
  it('gives a shell the Vouchers index and neither Voucher nor Invoices', () => {
    const shown = hrefs('shell', { leaseParent: true, showsUnderwriting: false })
    expect(shown).toContain('vouchers')
    expect(shown).not.toContain('financials')
    expect(shown).not.toContain('financial-documents')
  })

  it('gives every other shape Voucher and Invoices but no Vouchers index', () => {
    for (const shape of ['sale', 'flat-lease', 'space'] as const) {
      const shown = hrefs(shape, { leaseParent: true, showsUnderwriting: false })
      expect(shown, shape).not.toContain('vouchers')
    }
    const sale = hrefs('sale')
    expect(sale).toContain('financials')
    expect(sale).toContain('financial-documents')
  })

  it('never shows the Vouchers index and the single Voucher together', () => {
    for (const shape of ['sale', 'flat-lease', 'shell', 'space'] as const) {
      const shown = hrefs(shape, { leaseParent: true, showsUnderwriting: true })
      expect(
        shown.includes('vouchers') && shown.includes('financials'),
        shape,
      ).toBe(false)
    }
  })

  it('shows Spaces only for a lease parent', () => {
    expect(hrefs('shell', { leaseParent: true, showsUnderwriting: false })).toContain('spaces')
    expect(hrefs('sale', { leaseParent: false, showsUnderwriting: false })).not.toContain('spaces')
  })

  it('shows Underwriting only when the property qualifies', () => {
    expect(hrefs('sale', { leaseParent: false, showsUnderwriting: true })).toContain('underwriting')
    expect(hrefs('sale', { leaseParent: false, showsUnderwriting: false })).not.toContain('underwriting')
  })

  it('drops a group that ends up empty', () => {
    for (const group of visibleNavGroups('space', { leaseParent: false, showsUnderwriting: false })) {
      expect(group.items.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run src/components/properties/dealNav.test.ts`
Expected: FAIL — `visibleNavGroups is not a function`.

- [ ] **Step 3: Add the Vouchers item**

In `dealNav.ts`, add it as the **first** item of the Back Office group, where `Voucher` sits today:

```ts
  {
    label: "Back Office",
    items: [
      // A shell's spaces each earn their own commission, so a shell gets this
      // index instead of the single Voucher/Invoices pair below. `visibleNavGroups`
      // picks one or the other by shape; they are never both shown.
      { label: "Vouchers", href: "vouchers", icon: faFileInvoiceDollar },
      { label: "Voucher", href: "financials", icon: faFileInvoiceDollar },
      { label: "Invoices", href: "financial-documents", icon: faReceipt },
      { label: "Notes", href: "notes", icon: faNoteSticky },
    ],
  },
```

- [ ] **Step 4: Move the filter into `dealNav.ts`**

Append to `dealNav.ts`. This is the sidebar's existing predicate (`PropertyDetailSidebar.tsx:142-166`) moved verbatim, plus the one new `vouchers` rule:

```ts
import type { DealShape } from "#/data/dealShape";

/** Property-level marketing surfaces — a space deal has none of these. */
const PROPERTY_ONLY = new Set([
  "documents", "website", "email", "demographics", "grids", "plans",
]);
/** Surfaces that only make sense on the building's own assignment. */
const SHELL_ONLY = new Set(["spaces", "underwriting", "client-report"]);

/**
 * The sections this deal actually shows, by shape. Lives beside NAV_GROUPS so a
 * rule and the item it governs cannot drift apart, and so the rules are testable
 * without rendering a sidebar.
 *
 * Groups that filter down to nothing are dropped, so no empty category renders.
 */
export function visibleNavGroups(
  shape: DealShape,
  opts: { leaseParent: boolean; showsUnderwriting: boolean },
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // A shell's spaces each earn their own commission, so it gets the Vouchers
      // index; every other shape keeps the single Voucher + Invoices pair. The
      // two are mutually exclusive — never show both.
      if (item.href === "vouchers") return shape === "shell";
      if (item.href === "property-marketing") return shape === "space";
      if (shape === "space") {
        if (PROPERTY_ONLY.has(item.href)) return false;
        if (SHELL_ONLY.has(item.href)) return false;
        return true;
      }
      // Money is earned per space, so a shell has no voucher and no invoices.
      if (
        shape === "shell" &&
        (item.href === "financials" || item.href === "financial-documents")
      ) {
        return false;
      }
      if (item.href === "spaces") return opts.leaseParent;
      if (item.href === "underwriting") return opts.showsUnderwriting;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bunx vitest run src/components/properties/dealNav.test.ts`
Expected: PASS, 13 tests (7 from Task 2 + 6 new).

- [ ] **Step 6: Call it from the sidebar**

In `PropertyDetailSidebar.tsx`, delete the local `PROPERTY_ONLY` and `SHELL_ONLY` consts and the whole `navGroups = NAV_GROUPS.map(...)` expression (lines 142-166), replacing them with:

```tsx
  const navGroups = visibleNavGroups(shape, { leaseParent, showsUnderwriting });
```

Change the import to bring in the function instead of the data:

```tsx
import { visibleNavGroups } from "#/components/properties/dealNav";
```

`NAV_GROUPS` is no longer referenced here — `tsc`'s `noUnusedLocals` will confirm.

- [ ] **Step 7: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; all tests pass (677 + 6 = 683).

- [ ] **Step 8: Commit**

```bash
git add src/components/properties/dealNav.ts src/components/properties/dealNav.test.ts src/components/properties/PropertyDetailSidebar.tsx
git commit -m "feat(nav): give a shell the Vouchers index instead of a single voucher"
```

---

### Task 6: Breadcrumbs carry the section and the drill-down

**Files:**
- Modify: `src/components/properties/PropertyDetailHeader.tsx:75-109`

**Interfaces:**
- Consumes: `dealBreadcrumbTrail` from Task 2
- Produces: nothing new

- [ ] **Step 1: Cover the real vouchers drill-down**

Task 2 asserted drill-down parsing through `financials`, because the `Vouchers` item did not exist in `NAV_GROUPS` until Task 5. It does now, so add the real case to `src/components/properties/dealNav.test.ts` beside the existing drill-down test (double quotes and semicolons, matching that file):

```ts
  it("labels the vouchers drill-down and carries the space id", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/vouchers/space-9`, ID)).toEqual({
      sectionLabel: "Vouchers",
      detailId: "space-9",
    });
  });
```

Run: `bunx vitest run src/components/properties/dealNav.test.ts`
Expected: PASS, 14 tests (13 from Tasks 2 and 5 + this one).

- [ ] **Step 2: Add the imports and derive the trail**

In `PropertyDetailHeader.tsx`, add to the existing `@tanstack/react-router` import and bring in the helper:

```tsx
import { Link, useLocation } from "@tanstack/react-router";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
```

Inside the component, after the existing `property`/`address` lines:

```tsx
  const { pathname } = useLocation();
  const { sectionLabel, detailId } = dealBreadcrumbTrail(pathname, listing.id);
  // The detail id is a space deal's id; its human name is the suite's label,
  // which lives on this same property's units. Resolved here because
  // dealBreadcrumbTrail is deliberately store-free.
  const detailLabel = detailId
    ? (() => {
        const space = getListing(detailId);
        return (
          property?.units.find((u) => u.id === space?.unitId)?.label ??
          space?.name ??
          null
        );
      })()
    : null;
```

Add `getListing` to this file's existing `#/data/store` import if it is not already there.

- [ ] **Step 3: Replace the breadcrumb list**

Replace the `<Breadcrumb.List>` body. The deal's own name becomes a link once a section follows it, and stays a plain page when it is the last crumb:

```tsx
              <Breadcrumb.List>
                <Breadcrumb.Item>
                  <Breadcrumb.Link render={<Link to="/listings" />}>
                    <FontAwesomeIcon icon={faHandshake} />
                    All Deals
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  {sectionLabel ? (
                    <Breadcrumb.Link
                      render={
                        <Link
                          to="/listings/$listingId"
                          params={{ listingId: listing.id }}
                        />
                      }
                    >
                      {listing.name}
                    </Breadcrumb.Link>
                  ) : (
                    <Breadcrumb.Page>{listing.name}</Breadcrumb.Page>
                  )}
                </Breadcrumb.Item>
                {sectionLabel && (
                  <>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      {/* The section is a link only when a record sits below it —
                          that link is how the detail view gets back to its index,
                          which is why the detail has no back button of its own. */}
                      {detailLabel ? (
                        <Breadcrumb.Link
                          render={
                            <Link
                              to="/listings/$listingId/vouchers"
                              params={{ listingId: listing.id }}
                            />
                          }
                        >
                          {sectionLabel}
                        </Breadcrumb.Link>
                      ) : (
                        <Breadcrumb.Page>{sectionLabel}</Breadcrumb.Page>
                      )}
                    </Breadcrumb.Item>
                  </>
                )}
                {detailLabel && (
                  <>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      <Breadcrumb.Page>{detailLabel}</Breadcrumb.Page>
                    </Breadcrumb.Item>
                  </>
                )}
              </Breadcrumb.List>
```

> Vouchers is the only section with a drill-down, so the section-link target is hardcoded to it. If a second drill-down section ever appears, that target moves into `NAV_GROUPS`.

- [ ] **Step 4: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; 684 tests pass (683 + the vouchers drill-down case added in Step 1).

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/PropertyDetailHeader.tsx
git commit -m "feat(breadcrumb): name the section and the space a broker is looking at"
```

---

### Task 7: The roster owns terms, stage and gate

**Files:**
- Modify: `src/routes/_shell/listings/$listingId/spaces.tsx`

**Interfaces:**
- Consumes: `DealStageSelect` (existing, unchanged); the `vouchers/$spaceId` route from Task 4
- Produces: the `?space=` param that Task 8's links target

- [ ] **Step 1: Declare the search param**

At the top of `spaces.tsx`, replace the bare route definition. Follow the pattern `leads.tsx` already uses for its `q` param:

```tsx
export const Route = createFileRoute("/_shell/listings/$listingId/spaces")({
  // `space` names which row opens on arrival — a space card on the pipeline
  // board links straight here rather than to a page of its own.
  validateSearch: (search: Record<string, unknown>): { space?: string } => ({
    ...(typeof search.space === "string" && search.space
      ? { space: search.space }
      : {}),
  }),
  component: SpacesTab,
});
```

- [ ] **Step 2: Seed the open row from the param, and sort the rows**

Inside `SpacesTab`, read the param and use it as the initial expanded set. Replace the existing `useState<Set<string>>(new Set())` and the `rows` line:

```tsx
  const { space: spaceParam } = Route.useSearch();
  const rows = [...buildingAvailability(listingId)].sort((a, b) =>
    a.label.localeCompare(b.label, "en", { numeric: true }),
  );
  // Seeded once, from the URL. Local state owns it afterwards, so a broker can
  // open several rows. Deterministic on server and client, so no hydration
  // mismatch. `buildingAvailability` is left unsorted for its marketing
  // consumers; the sort above keeps this page and the Vouchers index in step.
  const [openRows, setOpenRows] = useState<Set<string>>(
    () => new Set(spaceParam ? [spaceParam] : []),
  );
```

- [ ] **Step 3: Swap the stage badge for the stage select and replace "Open deal"**

Replace the `<DealStageBadge ... />` line with the select, and replace the "Open deal" `Button` with a voucher link. The stage select must sit **outside** the `Collapsible.Trigger` — nested inside, clicking it would toggle the row:

```tsx
                    <span className="d-flex align-items-center gap-3 ms-auto">
                      <span className="text-muted fw-normal">
                        {row.leaseRate != null
                          ? `$${row.leaseRate} ${row.leaseRateUnits}`
                          : "Rate TBD"}
                      </span>
                      <span className="text-muted fw-normal">
                        {row.availability}
                      </span>
                    </span>
                  </Collapsible.Trigger>
                  {/* Outside the Trigger on purpose: inside it, opening the
                      select would toggle the row. The gate it opens is the
                      globally-mounted GlobalStageGateModal, so no wiring here. */}
                  <DealStageSelect listing={child} />
                  <Button
                    variant="ghost"
                    nativeButton={false}
                    render={
                      <Link
                        to="/listings/$listingId/vouchers/$spaceId"
                        params={{ listingId, spaceId: row.dealId }}
                      />
                    }
                  >
                    Voucher
                  </Button>
```

- [ ] **Step 4: Fix the imports**

Add `DealStageSelect`, drop `DealStageBadge`, and drop `dealShape` if nothing else in the file uses it:

```tsx
import { DealStageSelect } from "#/components/deals/DealStageSelect";
```

Remove:

```tsx
import { DealStageBadge } from "#/components/deals/DealStageBadge";
```

`tsc`'s `noUnusedLocals` will name `dealShape` if it is now unused — remove it from the `#/data/dealShape` import if so, keeping `canAddSpaces` and `isLeaseParent`.

- [ ] **Step 5: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; 684 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/spaces.tsx
git commit -m "feat(spaces): make the roster a space's control surface, not a list of links"
```

---

### Task 8: Point space links at the roster

**Files:**
- Create: `src/components/deals/dealCardLink.ts`
- Modify: `src/components/deals/DealCard.tsx` — `DealCardById` (line 274) and `DealCard` (line 337)
- Modify: `src/components/contacts/TimelineEvent.tsx:133-145`

**Interfaces:**
- Consumes: the `?space=` param from Task 7
- Produces: `dealCardLinkProps(listing: Listing)`, used by both `DealCard.tsx` exports and by `TimelineEvent.tsx`

`DealCard.tsx` has **two** exports that wrap a card in a `Link`, and both can render a space: `DealCardById({ listingId, showStatus, action, footer })` at line 274, and the draggable board card `DealCard({ listing })` at line 337. `TimelineEvent.tsx` needs the same decision. Three call sites, one rule — so the rule goes in a helper rather than being written three times.

- [ ] **Step 1: Write the failing test**

Create `src/components/deals/dealCardLink.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './../../data/createListing'
import { addPropertyUnit, addSpaceToDeal } from './../../data/leaseSpaces'
import { dealCardLinkProps } from './dealCardLink'

describe('dealCardLinkProps', () => {
  it('sends a top-level deal to its own page', () => {
    const deal = createProposalListing({ ...emptyDraft(), name: 'Tower Sale', dealType: 'Sale' })
    expect(dealCardLinkProps(deal)).toEqual({
      to: '/listings/$listingId',
      params: { listingId: deal.id },
    })
  })

  it('sends a space deal to its building roster with its row named', () => {
    const parent = createProposalListing({ ...emptyDraft(), name: 'Mall', dealType: 'Lease' })
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 900, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal

    expect(dealCardLinkProps(child)).toEqual({
      to: '/listings/$listingId/spaces',
      params: { listingId: parent.id },
      search: { space: child.id },
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/components/deals/dealCardLink.test.ts`
Expected: FAIL — `Failed to resolve import "./dealCardLink"`.

- [ ] **Step 3: Write the helper**

Create `src/components/deals/dealCardLink.ts`:

```ts
import type { Listing } from "#/data/types";

/**
 * Where a card for this deal should go. A space deal has no page of its own, so
 * it opens its building's roster with its own row expanded — the roster is where
 * its terms, stage and gate live. Every card surface shares this one rule so a
 * space can never acquire a page by way of an un-updated link.
 */
export function dealCardLinkProps(listing: Listing):
  | { to: "/listings/$listingId"; params: { listingId: string } }
  | {
      to: "/listings/$listingId/spaces";
      params: { listingId: string };
      search: { space: string };
    } {
  if (listing.parentDealId) {
    return {
      to: "/listings/$listingId/spaces",
      params: { listingId: listing.parentDealId },
      search: { space: listing.id },
    };
  }
  return { to: "/listings/$listingId", params: { listingId: listing.id } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run src/components/deals/dealCardLink.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Use it in `DealCardById`**

In `DealCard.tsx`, replace the `<Link to="/listings/$listingId" params={{ listingId }}>` inside `DealCardById` (line 288) with a spread of the helper. Keep the props and the `DealCardView` child exactly as they are:

```tsx
  const listing = getListing(listingId);
  if (!listing) return null;
  return (
    <Link
      {...dealCardLinkProps(listing)}
      className="text-decoration-none text-reset d-block"
    >
      <DealCardView
        listing={listing}
        showStatus={showStatus}
        action={action}
        footer={footer}
      />
    </Link>
  );
```

- [ ] **Step 6: Use it in the board card**

In the same file, `DealCard({ listing })` at line 337 wraps `<BoardDealCard>` in a `Link` inside its draggable `div`. Replace only that `Link`'s `to`/`params`:

```tsx
      <Link
        {...dealCardLinkProps(listing)}
        className="text-decoration-none text-reset d-block"
      >
        <BoardDealCard listing={listing} />
      </Link>
```

Add the import:

```tsx
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
```

- [ ] **Step 7: Use it in the timeline**

In `TimelineEvent.tsx`, the association link at line 137 uses `a.id`, which can be a space deal's id. Read the existing `: (` fallback for an association with **no** `a.id` and preserve that branch's markup exactly — only the `a.id ?` branch changes:

```tsx
            {event.associations.map((a, i) => {
              const deal = a.id ? getListing(a.id) : undefined;
              return deal ? (
                <Link
                  key={i}
                  {...dealCardLinkProps(deal)}
                  className="tl-row__deal-link"
                >
                  {a.label}
                </Link>
              ) : (
                /* the file's existing no-id fallback, unchanged */
              );
            })}
```

Add `import { getListing } from "#/data/store";` and the `dealCardLinkProps` import if either is absent.

- [ ] **Step 2: Route a timeline association for a space to the roster**

In `TimelineEvent.tsx`, the association link uses `a.id`, which can be a space deal's id. Guard it the same way:

```tsx
            {event.associations.map((a, i) => {
              if (!a.id) return <span key={i}>{a.label}</span>;
              // A space deal has no page; its association opens the building's
              // roster with that row expanded.
              const deal = getListing(a.id);
              return deal?.parentDealId ? (
                <Link
                  key={i}
                  to="/listings/$listingId/spaces"
                  params={{ listingId: deal.parentDealId }}
                  search={{ space: deal.id }}
                  className="tl-row__deal-link"
                >
                  {a.label}
                </Link>
              ) : (
                <Link
                  key={i}
                  to="/listings/$listingId"
                  params={{ listingId: a.id }}
                  className="tl-row__deal-link"
                >
                  {a.label}
                </Link>
              );
            })}
```

Preserve whatever the existing `: (` fallback renders for an association with no `a.id` — read the file and keep that branch's markup rather than the `<span>` above if it differs. Add `import { getListing } from "#/data/store";` if absent.

- [ ] **Step 8: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; all tests pass (684 + 2 = 686).

- [ ] **Step 9: Commit**

```bash
git add src/components/deals/dealCardLink.ts src/components/deals/dealCardLink.test.ts src/components/deals/DealCard.tsx src/components/contacts/TimelineEvent.tsx
git commit -m "fix(links): send a space card to its building's roster, not a page"
```

---

### Task 9: Delete the borrow-and-return machinery

Last on purpose: nothing is removed before its replacement works. All of this existed so a *space page* could reach the building's marketing and get back. With no space page there is nothing to borrow and nowhere to return from.

**Files:**
- Delete: `src/components/deals/MarketingScopeBar.tsx`
- Delete: `src/components/deals/PropertyMarketingHub.tsx`
- Delete: `src/routes/_shell/listings/$listingId/property-marketing.tsx`
- Modify: `src/routes/_shell/listings/$listingId.tsx` (drop the `MarketingScopeBar` mount)
- Modify: `src/components/properties/dealNav.ts` (drop the `Property Marketing` item, and drop the `property-marketing` + `shape === "space"` rules from `visibleNavGroups`)
- Modify: `src/components/properties/dealNav.test.ts` (drop assertions about the deleted rules)
- Modify: `src/components/properties/PropertyDetailSidebar.tsx` (drop the `from` carry)
- Modify: `src/routes/_shell/listings/$listingId/{demographics,documents,email,grids,media,plans,website,leads}.tsx` (drop the `from` param)
- Modify: `src/components/properties/PropertyDetailHeader.tsx` (drop the `parentDeal` branch)
- Modify: `src/components/deals/DealContextRail.tsx` (drop `LinkedParentDeal` + its `parent` lookup)
- Modify: `src/components/listings/edit/ListingFormEditor.tsx` (drop the space-terms section)
- Modify: `src/components/deals/DealMarketingEditor.tsx` (drop the now-unused `listing` prop pass-through if `tsc` flags it)
- Modify: `src/routes/_shell/listings/$listingId/{financials,financial-documents}.tsx` (drop the shell guards)
- Modify: `src/routeTree.gen.ts` (**by regeneration only**)

**Interfaces:**
- Consumes: everything from Tasks 1-8 must be working first
- Produces: nothing

- [ ] **Step 1: Take the revert as the guide, then apply it forward**

Commit `026767f` deleted exactly the first group of these, and `b1a04e3` restored them. Read that diff to see the precise removals rather than re-deriving them:

```bash
git show 026767f --stat
git show 026767f -- src/components/properties/PropertyDetailSidebar.tsx
```

Do **not** revert `026767f` — it also contains the `parentDeal` breadcrumb removal, which Task 6 has since rewritten. Apply its removals by hand.

- [ ] **Step 2: Delete the three whole files and their mount**

```bash
git rm src/components/deals/MarketingScopeBar.tsx \
       src/components/deals/PropertyMarketingHub.tsx \
       src/routes/_shell/listings/\$listingId/property-marketing.tsx
```

In `src/routes/_shell/listings/$listingId.tsx`, remove the `MarketingScopeBar` import and its `<MarketingScopeBar />` line from inside the content `Card`.

In `src/components/properties/dealNav.ts`, remove the `Property Marketing` item from the Marketing group and its now-unused `faBuildingFlag` import.

- [ ] **Step 3: Strip the `from` param and the space nav rules**

In `PropertyDetailSidebar.tsx`, remove the `useSearch` import, the `rawSearch`/`from` lines, and the `inMarketing`/`search:` argument in `onValueChange`'s `navigate` call — leaving a plain `navigate({ to: ... })`.

In `dealNav.ts`'s `visibleNavGroups`, a space no longer renders a sidebar at all, so its rules are dead. Remove the `PROPERTY_ONLY` and `SHELL_ONLY` sets, the `property-marketing` rule, and the `shape === "space"` branch. What remains:

```ts
export function visibleNavGroups(
  shape: DealShape,
  opts: { leaseParent: boolean; showsUnderwriting: boolean },
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // A shell's spaces each earn their own commission, so it gets the Vouchers
      // index; every other shape keeps the single Voucher + Invoices pair. The
      // two are mutually exclusive — never show both.
      if (item.href === "vouchers") return shape === "shell";
      // Money is earned per space, so a shell has no voucher and no invoices.
      if (
        shape === "shell" &&
        (item.href === "financials" || item.href === "financial-documents")
      ) {
        return false;
      }
      if (item.href === "spaces") return opts.leaseParent;
      if (item.href === "underwriting") return opts.showsUnderwriting;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}
```

`DealShape` still includes `'space'`, and passing it now returns the ordinary non-shell nav. That is correct and unreachable rather than wrong: no sidebar renders for a space.

In `dealNav.test.ts`, update the two tests that assert space-specific behaviour. In *"gives every other shape Voucher and Invoices but no Vouchers index"*, keep `'space'` in the loop — it still must not get `vouchers`. Replace the *"drops a group that ends up empty"* test, which relied on a space filtering a whole group away, with one that no longer depends on space rules:

```ts
  it('drops a group that ends up empty', () => {
    // Back Office always keeps Notes, so force the emptiness through a group
    // whose every item is conditional: none exist today, so assert the
    // invariant instead — no rendered group is ever empty.
    for (const shape of ['sale', 'flat-lease', 'shell', 'space'] as const) {
      for (const group of visibleNavGroups(shape, { leaseParent: false, showsUnderwriting: false })) {
        expect(group.items.length, shape).toBeGreaterThan(0)
      }
    }
  })
```

In each of `demographics.tsx`, `documents.tsx`, `email.tsx`, `grids.tsx`, `media.tsx`, `plans.tsx`, `website.tsx`, remove the `validateSearch` that declares `from`. In `leads.tsx`, keep `q` and remove only the `from` half:

```tsx
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    ...(typeof search.q === "string" && search.q ? { q: search.q } : {}),
  }),
```

- [ ] **Step 4: Drop the dead parent affordances**

In `PropertyDetailHeader.tsx`, remove the `parentDeal` and `spaceLabel` consts. Task 6 already replaced the breadcrumb that consumed them, so nothing else references them — `tsc` will confirm.

In `DealContextRail.tsx`, remove the `LinkedParentDeal` function, the `const parent = listing.parentDealId ? ... : undefined` lookup, and the `{parent && (...)}` block that renders it.

In `ListingFormEditor.tsx`, remove the space-terms section and its `listing`/`parentDealId` plumbing. Terms live on the roster now.

- [ ] **Step 5: Drop the two shell guards**

In `financials.tsx` and `financial-documents.tsx`, remove the `if (dealShape(listing) === "shell") { ... }` block and its `Empty`. A shell now navigates to `vouchers`, so these are unreachable for one. Remove the `Empty`, `FontAwesomeIcon`, icon and `dealShape` imports that become unused.

- [ ] **Step 6: Regenerate the route tree**

Run: `bunx vite build`
Expected: builds clean.

Run: `grep -c "property-marketing" src/routeTree.gen.ts`
Expected: `0`.

- [ ] **Step 7: Confirm nothing dangles**

Run:

```bash
grep -rn "MarketingScopeBar\|PropertyMarketingHub\|property-marketing\|PROPERTY_ONLY\|SHELL_ONLY\|LinkedParentDeal" src/
```

Expected: no output.

- [ ] **Step 8: Run the gates**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: tsc exits 0; 686 tests pass. Fix every unused-import error `tsc` names — that is the deletion's own checklist.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(spaces): delete the machinery a space page needed to borrow and return"
```

- [ ] **Step 10: Hand the flow to the user for a manual pass**

`tsc` and Vitest cannot see a rendered page, and Playwright is off the table in this repo. Ask the user to walk:

1. Pipeline board → a space card → lands on the building's roster with that row expanded
2. Set the space's stage on the row → its gate opens and commits
3. Back Office → Vouchers → the index lists every space, with em-dashes on the ones that have not transacted, and a total
4. Click a space → its voucher and invoices, both naming the suite
5. Breadcrumb reads `All Deals / {building} / Vouchers / {suite}`, and the `Vouchers` crumb returns to the index
6. A non-shell deal (a sale, or a lease with no spaces) still shows `Voucher` and `Invoices`, and only one of the two Back Office shapes ever appears

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| Scope model (3 space-owned surfaces) | 1, 3, 4, 7 |
| Routing table | 3, 4, 7 |
| No guard on `/listings/{spaceId}` | 8 (links updated instead) |
| Roster is the space's control surface | 7 |
| Nav shape-dependent | 2, 5 |
| Vouchers index + total | 3 |
| Voucher detail + `heading` prop + child-of-shell guard | 4 |
| Breadcrumbs + `dealNav` extraction | 2, 6 |
| `spaceVouchers` derivation | 1 |
| All 8 deletions | 9 |
| `buildingAvailability` stale "Draft" comment | 1 |
| Roster/index ordering agreement | 1, 7 |
| Verification table | 1, 2, 4, 9 |

No gaps.

**Known deviations from the spec, deliberate**

- The spec's build order lists the sidebar swap (5) before breadcrumbs (6); this plan keeps that, but moves the `NAV_GROUPS` extraction into Task 2 so both consumers exist before either changes.
- Task 2 leaves a non-shell deal briefly showing both `Vouchers` and `Voucher`, closed by Task 5. Flagged inline; it keeps the extraction reviewable alone.

**Type consistency**

`spaceVouchers` / `SpaceVoucherRow` and its five fields are used identically in Tasks 1 and 3. `dealBreadcrumbTrail`'s `{ sectionLabel, detailId }` matches between Tasks 2 and 6. `heading` is the prop name in Task 4's two edits and nowhere else. `?space=` is the param name in Tasks 7 and 8, and `dealCardLinkProps` is the only thing that constructs it.

**Corrections made during self-review**

- Task 8 originally named one `DealCard` export and one `Link`. There are **two** exports — `DealCardById({ listingId, ... })` at line 274 and the draggable `DealCard({ listing })` at line 337 — and both wrap a card that can be a space. With `TimelineEvent` that is three call sites making the same decision, so the rule moved into a tested `dealCardLinkProps` helper instead of being written three times.
- The spec claimed the Vouchers index would be "ordered by suite label, matching the roster." `getChildDeals` returns store-insertion order, so the roster had no such sort to match. Both the spec and Tasks 1 and 7 now sort explicitly, leaving `buildingAvailability`'s contract alone for its marketing consumers.
