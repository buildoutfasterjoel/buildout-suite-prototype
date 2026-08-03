# Suite Panel Over the Building — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a lease space deal ("suite") from a standalone page into a tabbed panel over its building, with a real URL per section.

**Architecture:** `spaces.tsx` becomes a layout that keeps the roster and renders an `<Outlet />`. A new child route `spaces/$spaceId.tsx` renders a Blueprint `Offcanvas` holding the panel chrome and two levels of tabs, plus its own `<Outlet />`. Each section is a leaf route whose slug matches the slug that section already has under `$listingId/`, which makes the legacy-URL redirect a single path rewrite. The building's page is never left, so no scope banner is needed.

**Tech Stack:** React 19 · TypeScript · TanStack Start / Router 1.170 · Blueprint React (`Offcanvas`, `Tabs`) · FontAwesome Pro · Vitest · Bun

**Design doc:** `docs/superpowers/specs/2026-08-03-suite-panel-over-building-design.md`

## Global Constraints

- Package manager is Bun. Tests: `bun --bun run test`. Type gate: `bunx tsc --noEmit`.
- **`vite build` does NOT type-check.** `bunx tsc --noEmit` is the only type gate. Run it at the end of every task.
- **Do not use Playwright.** Where a step needs visual confirmation, it says so and the human runs it.
- **No component test infrastructure exists** (no testing-library, no jsdom). Tests in this plan cover pure functions and store behavior only. Rendering is verified by hand.
- `src/routes/routeTree.gen.ts` is auto-generated. Never edit it; it regenerates on `bun --bun run dev`.
- UI uses Blueprint React via subpath imports: `@buildoutinc/blueprint-react/ui/<Component>`.
- FontAwesome: default to `@fortawesome/pro-regular-svg-icons`. **Never pass `fixedWidth`** — it is deprecated.
- Bootstrap utility classes for spacing/layout. Blueprint's CSS vars use the `--bp-` prefix, not `--bs-`.
- Major panel sections use `Tabs.List` default variant; sub-sections use `variant="pills"`.
- **No tab, group, or label may be named "Marketing"** inside the suite panel. The third tab is **Interest**.
- Never pair a `Component.tsx` with a `component.ts` differing only in case — macOS resolves the wrong file.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/components/deals/spacePanelTabs.ts` | The tab/leaf model: which leaves exist, which tab owns each, how to read the active leaf from a pathname |
| `src/components/deals/spacePanelTabs.test.ts` | Tests for the above |
| `src/components/deals/SpacePanelDetails.tsx` | Deal › Details content: headline facts, tenant, brokers |
| `src/data/suitePanelPath.ts` | Pure legacy-URL → panel-URL rewrite |
| `src/data/suitePanelPath.test.ts` | Tests for the above |
| `src/routes/_shell/listings/$listingId/spaces/$spaceId.tsx` | Panel layout: Offcanvas, chrome, two tab bars, `<Outlet />` |
| `src/routes/_shell/listings/$listingId/spaces/$spaceId/index.tsx` | Redirects bare panel URL to `overview` |
| `src/routes/_shell/listings/$listingId/spaces/$spaceId/{overview,activities,history,terms,leads,media,financials,financial-documents,notes}.tsx` | One thin leaf per section |

**Modified**

| File | Change |
|---|---|
| `src/routes/_shell/listings/$listingId/spaces.tsx` | Add `<Outlet />`; rows become links to the panel; retire the inline `Collapsible` |
| `src/routes/_shell/listings/$listingId.tsx` | `beforeLoad` rewrite for legacy suite URLs |
| `src/components/properties/PropertyDetailSidebar.tsx` | Delete space-deal filtering and `from` plumbing |
| `src/components/properties/PropertyDetailHeader.tsx` | Delete the `parentDeal` breadcrumb branch |
| `src/components/properties/PropertyDetailLeads.tsx` | Add a Space column |

**Deleted**

`src/components/deals/PropertyMarketingHub.tsx` · `src/routes/_shell/listings/$listingId/property-marketing.tsx` · `src/components/deals/MarketingScopeBar.tsx`

The building's own `$listingId/{leaf}.tsx` routes all **stay** — they serve the shell. The panel's leaves are separate thin routes that resolve a `spaceId`.

---

### Task 1: Tab model

**Files:**
- Create: `src/components/deals/spacePanelTabs.ts`
- Test: `src/components/deals/spacePanelTabs.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `SpacePanelLeaf`, `SpacePanelTab`, `SpacePanelTabDef`, `SPACE_PANEL_TABS: SpacePanelTabDef[]`, `DEFAULT_SPACE_PANEL_LEAF: SpacePanelLeaf`, `tabForLeaf(leaf: SpacePanelLeaf): SpacePanelTab`, `leafFromPathname(pathname: string): SpacePanelLeaf | null`, `SPACE_PANEL_LEAVES: SpacePanelLeaf[]`

- [ ] **Step 1: Write the failing test**

Create `src/components/deals/spacePanelTabs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  SPACE_PANEL_TABS,
  SPACE_PANEL_LEAVES,
  DEFAULT_SPACE_PANEL_LEAF,
  tabForLeaf,
  leafFromPathname,
} from './spacePanelTabs'

describe('SPACE_PANEL_TABS', () => {
  it('has four tabs in design order', () => {
    expect(SPACE_PANEL_TABS.map((t) => t.id)).toEqual([
      'deal', 'terms', 'interest', 'back-office',
    ])
  })

  it('never uses the word Marketing — that ambiguity is what the panel removes', () => {
    const labels = SPACE_PANEL_TABS.flatMap((t) => [
      t.label, ...t.leaves.map((l) => l.label),
    ])
    for (const label of labels) expect(label).not.toMatch(/marketing/i)
  })

  it('exposes nine leaves, each owned by exactly one tab', () => {
    expect(SPACE_PANEL_LEAVES).toHaveLength(9)
    expect(new Set(SPACE_PANEL_LEAVES).size).toBe(9)
  })

  it('keeps leaf slugs identical to the building routes they mirror', () => {
    expect(SPACE_PANEL_LEAVES).toEqual([
      'overview', 'activities', 'history',
      'terms',
      'leads', 'media',
      'financials', 'financial-documents', 'notes',
    ])
  })

  it('opens on Deal > Details', () => {
    expect(DEFAULT_SPACE_PANEL_LEAF).toBe('overview')
    expect(tabForLeaf(DEFAULT_SPACE_PANEL_LEAF)).toBe('deal')
  })
})

describe('tabForLeaf', () => {
  it('routes each leaf to its owning tab', () => {
    expect(tabForLeaf('activities')).toBe('deal')
    expect(tabForLeaf('terms')).toBe('terms')
    expect(tabForLeaf('media')).toBe('interest')
    expect(tabForLeaf('financial-documents')).toBe('back-office')
  })
})

describe('leafFromPathname', () => {
  it('reads the active leaf off the last segment', () => {
    expect(leafFromPathname('/listings/L1/spaces/S1/financials')).toBe('financials')
    expect(leafFromPathname('/listings/L1/spaces/S1/financial-documents')).toBe(
      'financial-documents',
    )
  })

  it('tolerates a trailing slash', () => {
    expect(leafFromPathname('/listings/L1/spaces/S1/leads/')).toBe('leads')
  })

  it('returns null when the last segment is not a leaf', () => {
    expect(leafFromPathname('/listings/L1/spaces/S1')).toBeNull()
    expect(leafFromPathname('/listings/L1/website')).toBeNull()
    expect(leafFromPathname('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/components/deals/spacePanelTabs.test.ts`
Expected: FAIL — `Failed to resolve import "./spacePanelTabs"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/deals/spacePanelTabs.ts`:

```ts
/**
 * Every leaf route under the suite panel. Each slug is **identical to the slug that
 * section already has** under `$listingId/`, which is what lets a legacy suite URL be
 * rewritten with one rule instead of a mapping table (see suitePanelPath.ts).
 */
export type SpacePanelLeaf =
  | 'overview'
  | 'activities'
  | 'history'
  | 'terms'
  | 'leads'
  | 'media'
  | 'financials'
  | 'financial-documents'
  | 'notes'

/**
 * The four major sections. Deliberately no "Marketing" tab: Leads and Media here are
 * unit-filtered views of the *property's* store, so that word would rebuild the
 * ambiguity the panel exists to remove. "Interest" names what they share — signals
 * that someone wants this space.
 */
export type SpacePanelTab = 'deal' | 'terms' | 'interest' | 'back-office'

export interface SpacePanelTabDef {
  id: SpacePanelTab
  label: string
  leaves: { leaf: SpacePanelLeaf; label: string }[]
}

export const SPACE_PANEL_TABS: SpacePanelTabDef[] = [
  {
    id: 'deal',
    label: 'Deal',
    leaves: [
      { leaf: 'overview', label: 'Details' },
      { leaf: 'activities', label: 'Activity' },
      { leaf: 'history', label: 'History' },
    ],
  },
  {
    id: 'terms',
    label: 'Terms',
    leaves: [{ leaf: 'terms', label: 'Terms' }],
  },
  {
    id: 'interest',
    label: 'Interest',
    leaves: [
      { leaf: 'leads', label: 'Leads' },
      { leaf: 'media', label: 'Media' },
    ],
  },
  {
    id: 'back-office',
    label: 'Back Office',
    leaves: [
      { leaf: 'financials', label: 'Voucher' },
      { leaf: 'financial-documents', label: 'Invoices' },
      { leaf: 'notes', label: 'Notes' },
    ],
  },
]

/** Flat leaf list in tab order. */
export const SPACE_PANEL_LEAVES: SpacePanelLeaf[] = SPACE_PANEL_TABS.flatMap((t) =>
  t.leaves.map((l) => l.leaf),
)

/** The leaf a suite panel opens on. */
export const DEFAULT_SPACE_PANEL_LEAF: SpacePanelLeaf = 'overview'

const LEAF_TO_TAB = new Map<SpacePanelLeaf, SpacePanelTab>(
  SPACE_PANEL_TABS.flatMap((t) => t.leaves.map((l) => [l.leaf, t.id] as const)),
)

export function tabForLeaf(leaf: SpacePanelLeaf): SpacePanelTab {
  return LEAF_TO_TAB.get(leaf) ?? 'deal'
}

/**
 * The active leaf, read from the URL's last segment. The panel derives both tab bars
 * from this rather than holding tab state, so a deep link and a click land in the same
 * place — the same approach PropertyDetailSidebar uses to compute activeInGroup.
 */
export function leafFromPathname(pathname: string): SpacePanelLeaf | null {
  const last = pathname.split('/').filter(Boolean).pop()
  if (!last) return null
  return LEAF_TO_TAB.has(last as SpacePanelLeaf) ? (last as SpacePanelLeaf) : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test -- src/components/deals/spacePanelTabs.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/spacePanelTabs.ts src/components/deals/spacePanelTabs.test.ts
git commit -m "feat(suite-panel): model the panel's four tabs and nine leaf routes"
```

---

### Task 2: Panel layout route + Details leaf

**Files:**
- Modify: `src/routes/_shell/listings/$listingId/spaces.tsx`
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId.tsx`
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/index.tsx`
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/overview.tsx`
- Create: `src/components/deals/SpacePanelDetails.tsx`

**Interfaces:**
- Consumes: `SPACE_PANEL_TABS`, `DEFAULT_SPACE_PANEL_LEAF`, `leafFromPathname`, `tabForLeaf` from Task 1
- Produces: route `/_shell/listings/$listingId/spaces/$spaceId` (panel layout) and `/_shell/listings/$listingId/spaces/$spaceId/overview`; `SpacePanelDetails({ listing }: { listing: Listing })`

- [ ] **Step 1: Add the Outlet to the spaces layout and turn rows into panel links**

In `src/routes/_shell/listings/$listingId/spaces.tsx`, replace the `Collapsible` import with `Outlet`, delete the `openRows` state and `setRowOpen`, and replace the whole `rows.map(...)` block plus the closing `<AddSpaceModal .../>` region so the file's render body reads:

```tsx
      {rows.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No spaces" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No spaces yet</Empty.Title>
            Add a space to spin an individual unit into its own deal. The
            building&apos;s marketing is shared by every space.
          </Empty.Content>
          {canAddSpace && (
            <Empty.Actions>
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                <FontAwesomeIcon icon={faPlus} /> Add space
              </Button>
            </Empty.Actions>
          )}
        </Empty>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((row) => {
            const child = getListing(row.dealId);
            const unit = property?.units.find((u) => u.id === row.unitId);
            if (!child || !unit || !property) return null;
            return (
              <Link
                key={row.dealId}
                to="/listings/$listingId/spaces/$spaceId"
                params={{ listingId, spaceId: row.dealId }}
                className="d-flex align-items-center gap-3 border rounded p-3 text-decoration-none text-body"
              >
                <span className="d-flex align-items-center gap-2 fw-semibold">
                  <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
                  {unit.label}
                  <span className="text-muted fw-normal">
                    {row.sqft.toLocaleString()} SF
                  </span>
                </span>
                <span className="d-flex align-items-center gap-3 ms-auto">
                  <span className="text-muted">
                    {row.leaseRate != null
                      ? `$${row.leaseRate} ${row.leaseRateUnits}`
                      : "Rate TBD"}
                  </span>
                  <span className="text-muted">{row.availability}</span>
                  <DealStageBadge stage={child.status} shape={dealShape(child)} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <AddSpaceModal
        parentDealId={listingId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* The suite panel renders here — a child route, so this roster and the
          building's chrome stay mounted behind it. */}
      <Outlet />
```

Then delete the now-unused imports (`Collapsible`, `SpaceTermsSection`, `emptySpaceLeaseTerms`, `updateDealMarketing`, `faAngleRight`) and the `openRows`/`setRowOpen` declarations.

- [ ] **Step 2: Create the panel layout route**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId.tsx`:

```tsx
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { dealShape } from "#/data/dealShape";
import { DealStageChip } from "#/components/deals/DealStageChip";
import { requestStageChange } from "#/components/deals/useStageGate";
import type { ListingStage } from "#/data/types";
import {
  SPACE_PANEL_TABS,
  DEFAULT_SPACE_PANEL_LEAF,
  leafFromPathname,
  tabForLeaf,
  type SpacePanelLeaf,
} from "#/components/deals/spacePanelTabs";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId",
)({
  component: SpacePanelRoute,
});

/**
 * A suite, rendered as a panel over its building. The route's presence *is* the
 * open state — closing navigates back to the roster — so a deep link and a click
 * arrive at exactly the same UI, and the building behind never unmounts.
 */
function SpacePanelRoute() {
  const { listingId, spaceId } = Route.useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Subscribe to the map, not `.get(spaceId)`: a suite's shape and its siblings are
  // derived from other listings (see 413dda8).
  const listings = useDataStore((s) => s.listings);
  const listing = listings.get(spaceId);
  const property = listing ? getProperty(listing.propertyId) : undefined;

  if (!listing || !property) return null;

  const unit = property.units.find((u) => u.id === listing.unitId);
  const activeLeaf = leafFromPathname(pathname) ?? DEFAULT_SPACE_PANEL_LEAF;
  const activeTab = tabForLeaf(activeLeaf);
  const pills =
    SPACE_PANEL_TABS.find((t) => t.id === activeTab)?.leaves ?? [];

  const goToLeaf = (leaf: SpacePanelLeaf) => {
    void navigate({
      to: `/listings/${listingId}/spaces/${spaceId}/${leaf}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  };

  const close = () =>
    void navigate({
      to: "/listings/$listingId/spaces",
      params: { listingId },
    });

  return (
    <Offcanvas open onOpenChange={(next) => !next && close()}>
      <Offcanvas.Content
        side="right"
        className="suite-panel"
        style={{ width: "min(78vw, 1100px)" }}
      >
        <Offcanvas.Header>
          <Offcanvas.Title>{unit?.label ?? listing.name}</Offcanvas.Title>
          <DealStageChip
            value={listing.status}
            shape={dealShape(listing)}
            onChange={(v) => requestStageChange(listing.id, v as ListingStage)}
          />
        </Offcanvas.Header>

        <Offcanvas.Body className="d-flex flex-column gap-3">
          {/* Major sections */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const tab = SPACE_PANEL_TABS.find((t) => t.id === v);
              if (tab) goToLeaf(tab.leaves[0].leaf);
            }}
          >
            <Tabs.List>
              {SPACE_PANEL_TABS.map((t) => (
                <Tabs.Tab key={t.id} value={t.id}>
                  {t.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          {/* Sub-sections. Rendered only when the active tab subdivides, so the
              Terms tab shows no redundant single pill. */}
          {pills.length > 1 && (
            <Tabs value={activeLeaf} onValueChange={(v) => goToLeaf(v as SpacePanelLeaf)}>
              <Tabs.List variant="pills">
                {pills.map((p) => (
                  <Tabs.Tab key={p.leaf} value={p.leaf}>
                    {p.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          )}

          <Outlet />
        </Offcanvas.Body>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
```

- [ ] **Step 3: Create the index redirect so the bare panel URL lands on Details**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/index.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_SPACE_PANEL_LEAF } from "#/components/deals/spacePanelTabs";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: `/listings/${params.listingId}/spaces/${params.spaceId}/${DEFAULT_SPACE_PANEL_LEAF}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  },
});
```

- [ ] **Step 4: Create the Details content component**

Create `src/components/deals/SpacePanelDetails.tsx`:

```tsx
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { getProperty, getStore } from "#/data/store";
import { spaceAvailability } from "#/data/dealShape";
import type { Contact, Listing } from "#/data/types";

/**
 * Deal > Details for a suite panel. Four headline facts (rescued from the deleted
 * PropertyMarketingHub), the tenant, and the brokers on this letting.
 *
 * Deliberately no landlord/seller: the owning party is known at the building level,
 * so repeating it on every suite is noise.
 */
export function SpacePanelDetails({ listing }: { listing: Listing }) {
  const property = getProperty(listing.propertyId);
  const { contacts } = getStore();
  const terms = listing.marketing.spaceLeaseTerms?.[0];

  const tenants = listing.tenantContactIds
    .map((id) => contacts.get(id))
    .filter((c): c is Contact => c != null);

  const brokers = [...listing.internalBrokers, ...listing.outsideBrokers];

  const facts: [string, string][] = [
    [
      "Lease rate",
      terms?.leaseRate != null
        ? `$${terms.leaseRate} ${terms.leaseRateUnits}`
        : "—",
    ],
    [
      "Available",
      listing.marketing.availableSqFt
        ? `${listing.marketing.availableSqFt.toLocaleString()} SF`
        : "—",
    ],
    [
      "Term",
      terms?.leaseTermMonths != null ? `${terms.leaseTermMonths} months` : "—",
    ],
    ["Availability", spaceAvailability(listing.status)],
  ];

  if (!property) return null;

  return (
    <div className="d-flex flex-column gap-4">
      <dl className="row mb-0">
        {facts.map(([label, value]) => (
          <div key={label} className="col-6 col-md-3 mb-2">
            <dt className="text-muted fw-normal">{label}</dt>
            <dd className="fw-semibold mb-0">{value}</dd>
          </div>
        ))}
      </dl>

      <Separator />

      <section>
        <h3 className="fs-6 fw-semibold mb-2">Tenant</h3>
        {tenants.length === 0 ? (
          <p className="text-muted mb-0">No tenant linked yet.</p>
        ) : (
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            {tenants.map((t) => (
              <li key={t.id} className="d-flex align-items-center gap-2">
                <span className="fw-semibold">
                  {`${t.firstName} ${t.lastName}`.trim()}
                </span>
                {t.company && <span className="text-muted">{t.company}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="fs-6 fw-semibold mb-2">Brokers</h3>
        {brokers.length === 0 ? (
          <p className="text-muted mb-0">No brokers on this space.</p>
        ) : (
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            {brokers.map((b) => (
              <li key={b.id} className="d-flex align-items-center gap-2">
                <span className="fw-semibold">{b.name}</span>
                <span className="text-muted">{b.role}</span>
                <span className="text-muted ms-auto">
                  {b.commissionSplitPct}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Create the Details leaf route**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/overview.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { SpacePanelDetails } from "#/components/deals/SpacePanelDetails";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/overview",
)({
  component: SpaceOverviewRoute,
});

function SpaceOverviewRoute() {
  const { spaceId } = Route.useParams();
  const listing = useDataStore((s) => s.listings).get(spaceId);
  if (!listing) return null;
  return <SpacePanelDetails listing={listing} />;
}
```

- [ ] **Step 6: Type-check and run the suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no tsc output; all tests pass. If tsc complains that `/listings/$listingId/spaces/$spaceId` is not a known route, start the dev server once (`bun --bun run dev`) to regenerate `routeTree.gen.ts`, stop it, and re-run.

- [ ] **Step 7: Verify by hand — ASK THE HUMAN**

Do not use Playwright. Ask the human to confirm, on a shell deal with at least one space:

1. The Spaces tab lists rows; clicking a row opens a right-side panel and the roster stays visible behind it.
2. The panel shows the unit label, a stage chip, four tabs (Deal / Terms / Interest / Back Office) and three pills under Deal.
3. Deal › Details shows the four facts plus Tenant and Brokers sections.
4. The URL reads `/listings/{shellId}/spaces/{suiteId}/overview`.
5. Closing the panel (backdrop, Esc, or close button) returns to the roster without a full page reload.
6. Confirm the panel is roughly 78% of viewport width. **If it is 800px instead**, `Offcanvas.Content` did not forward `style`; add to `src/main.scss` after the theme import:
   ```scss
   .offcanvas.suite-panel { width: min(78vw, 1100px); }
   ```
   and remove the inline `style` prop.

- [ ] **Step 8: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/spaces.tsx \
  src/routes/_shell/listings/\$listingId/spaces \
  src/components/deals/SpacePanelDetails.tsx
git commit -m "feat(suite-panel): open a suite as a tabbed panel over its building"
```

---

### Task 3: Deal tab — Activity and History leaves

**Files:**
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/activities.tsx`
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/history.tsx`

**Interfaces:**
- Consumes: the panel layout route from Task 2
- Produces: routes `.../spaces/$spaceId/activities` and `.../spaces/$spaceId/history`

- [ ] **Step 1: Create the Activity leaf**

The panel is narrower than a page, so the building's side-by-side messages rail is dropped here and `DealActivity` gets the full width.

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/activities.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealActivity } from "#/components/deals/DealStubs";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/activities",
)({
  component: SpaceActivitiesRoute,
});

function SpaceActivitiesRoute() {
  const { spaceId } = Route.useParams();
  const listing = getStore().listings.get(spaceId);
  if (!listing) return null;
  // No DealMessagesRail here: the building's Activity tab renders it beside the feed
  // at 420px, which the panel has no room for.
  return <DealActivity listing={listing} />;
}
```

- [ ] **Step 2: Create the History leaf**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/history.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faClockRotateLeft } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/history",
)({
  component: SpaceHistoryRoute,
});

function SpaceHistoryRoute() {
  const { spaceId } = Route.useParams();
  const listing = getStore().listings.get(spaceId);
  if (!listing) return null;
  return <DealPagePlaceholder title="History" icon={faClockRotateLeft} />;
}
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output. Regenerate the route tree via a dev-server start if the new routes are unknown.

- [ ] **Step 4: Verify by hand — ASK THE HUMAN**

Ask the human to confirm the Activity and History pills switch content, the URL changes to `.../activities` and `.../history`, and the panel stays open throughout.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/spaces/\$spaceId/activities.tsx \
  src/routes/_shell/listings/\$listingId/spaces/\$spaceId/history.tsx
git commit -m "feat(suite-panel): add the Deal tab's Activity and History leaves"
```

---

### Task 4: Terms leaf

**Files:**
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/terms.tsx`

**Interfaces:**
- Consumes: the panel layout from Task 2; `SpaceTermsSection({ unit, property, terms, onChange })`; `emptySpaceLeaseTerms(unitId)`; `updateDealMarketing(dealId, patch)`
- Produces: route `.../spaces/$spaceId/terms`

- [ ] **Step 1: Create the Terms leaf**

This is the editor the retired inline roster expansion used to host, now with one home.

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/terms.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { updateDealMarketing } from "#/data/actions";
import { SpaceTermsSection } from "#/components/listings/edit/sections/SpaceTermsSection";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/terms",
)({
  component: SpaceTermsRoute,
});

function SpaceTermsRoute() {
  const { spaceId } = Route.useParams();
  const listing = useDataStore((s) => s.listings).get(spaceId);
  const property = listing ? getProperty(listing.propertyId) : undefined;
  const unit = property?.units.find((u) => u.id === listing?.unitId);

  if (!listing || !property || !unit) return null;

  const terms =
    listing.marketing.spaceLeaseTerms?.[0] ?? emptySpaceLeaseTerms(unit.id);

  return (
    <SpaceTermsSection
      unit={unit}
      property={property}
      terms={terms}
      onChange={(patch) =>
        updateDealMarketing(listing.id, {
          spaceLeaseTerms: [{ ...terms, ...patch }],
        })
      }
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Verify by hand — ASK THE HUMAN**

Ask the human to confirm: the Terms tab shows the terms form with **no pills bar** above it; editing Lease Rate persists after closing and reopening the panel; and the Space Type typeahead's popover is usable inside the panel (it was previously only exercised in the roster row and on the edit page).

- [ ] **Step 4: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/spaces/\$spaceId/terms.tsx
git commit -m "feat(suite-panel): give space terms a single home on the Terms tab"
```

---

### Task 5: Interest tab — Leads and Media leaves

**Files:**
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/leads.tsx`
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/media.tsx`

**Interfaces:**
- Consumes: `PropertyDetailLeads({ property, initialSearch, spaceDealId })`; `ListingMedia({ listing })`
- Produces: routes `.../spaces/$spaceId/leads` and `.../spaces/$spaceId/media`

- [ ] **Step 1: Create the Leads leaf**

`spaceDealId` is what scopes the list — leads are matched by which listing a contact's `inquiredListingIds` names, and a space deal *is* one such listing.

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/leads.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/leads",
)({
  component: SpaceLeadsRoute,
});

function SpaceLeadsRoute() {
  const { spaceId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(spaceId);
  const property = listing && store.properties.get(listing.propertyId);
  if (!listing || !property) return null;
  // Shared store, scoped view: one lead library on the property, filtered here.
  return <PropertyDetailLeads property={property} spaceDealId={listing.id} />;
}
```

- [ ] **Step 2: Create the Media leaf**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/media.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingMedia } from "#/components/listings/ListingMedia";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/media",
)({
  component: SpaceMediaRoute,
});

function SpaceMediaRoute() {
  const { spaceId } = Route.useParams();
  const listing = getStore().listings.get(spaceId);
  if (!listing) return null;
  // ListingMedia already filters to the listing's unit for a space deal (07e0214).
  return <ListingMedia listing={listing} />;
}
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output. `PropertyDetailLeads` declares `initialSearch?` and `spaceDealId?` as optional (`PropertyDetailLeads.tsx:149-165`), so passing only `property` and `spaceDealId` type-checks.

- [ ] **Step 4: Verify by hand — ASK THE HUMAN**

Ask the human to confirm the Interest tab shows two pills; Leads lists only inquiries for that suite; Media shows only that unit's images.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/spaces/\$spaceId/leads.tsx \
  src/routes/_shell/listings/\$listingId/spaces/\$spaceId/media.tsx
git commit -m "feat(suite-panel): scope Leads and Media to the suite on an Interest tab"
```

---

### Task 6: Back Office tab — Voucher, Invoices, Notes leaves

**Files:**
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/financials.tsx`
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/financial-documents.tsx`
- Create: `src/routes/_shell/listings/$listingId/spaces/$spaceId/notes.tsx`

**Interfaces:**
- Consumes: `DealFinancials({ listing })`; `DealPagePlaceholder({ title, icon })`
- Produces: routes `.../spaces/$spaceId/{financials,financial-documents,notes}`

The building's `financials.tsx` guards against a shell rendering a voucher. That guard is unnecessary here — a space deal is never a shell — so it is not copied.

- [ ] **Step 1: Create the Voucher leaf**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/financials.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealFinancials } from "#/components/deals/DealFinancials";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/financials",
)({
  component: SpaceVoucherRoute,
});

function SpaceVoucherRoute() {
  const { spaceId } = Route.useParams();
  // Reactive so an Edit Transaction save re-renders the summary immediately.
  const listing = useDataStore((s) => s.listings.get(spaceId));
  if (!listing) return null;
  // No shell guard needed — a space deal is never a shell.
  return <DealFinancials listing={listing} />;
}
```

- [ ] **Step 2: Extract the invoices table into a component**

The invoices markup lives **inline** inside `InvoicesRoute` in
`src/routes/_shell/listings/$listingId/financial-documents.tsx`, alongside a local
`InvoiceRow` type and a `draftInvoice(listing)` helper. Two routes must render it, so extract
rather than copy.

Create `src/components/deals/DealInvoices.tsx` exporting `DealInvoices({ listing }: { listing: Listing })`. Move into it, unchanged: the `InvoiceRow` type, `draftInvoice`, the `formatDate`/timestamp helper the table uses, and everything `InvoicesRoute` returns **after** its `dealShape(listing) === "shell"` guard.

Leave the shell guard behind in the building's route, which becomes:

```tsx
function InvoicesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;

  if (dealShape(listing) === "shell") {
    // unchanged Empty state — a building listing has no invoices of its own
    return ( /* existing shell Empty block, left exactly as it is */ );
  }

  return <DealInvoices listing={listing} />;
}
```

- [ ] **Step 3: Create the Invoices leaf**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/financial-documents.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealInvoices } from "#/components/deals/DealInvoices";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/financial-documents",
)({
  component: SpaceInvoicesRoute,
});

function SpaceInvoicesRoute() {
  const { spaceId } = Route.useParams();
  const listing = useDataStore((s) => s.listings.get(spaceId));
  if (!listing) return null;
  return <DealInvoices listing={listing} />;
}
```

- [ ] **Step 4: Create the Notes leaf**

Create `src/routes/_shell/listings/$listingId/spaces/$spaceId/notes.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faNoteSticky } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/notes",
)({
  component: SpaceNotesRoute,
});

function SpaceNotesRoute() {
  const { spaceId } = Route.useParams();
  const listing = getStore().listings.get(spaceId);
  if (!listing) return null;
  return <DealPagePlaceholder title="Notes" icon={faNoteSticky} />;
}
```

- [ ] **Step 5: Type-check and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no tsc output; all tests pass.

- [ ] **Step 6: Verify by hand — ASK THE HUMAN**

Ask the human to confirm:

1. All three Back Office pills render, and the building's own Invoices tab still works after the extraction.
2. **Whether the voucher and invoice tables are legible at panel width** — the design flagged this as the most likely thing to need a wider panel or its own page. Report their answer; do not fix it here.
3. **A stage change from the panel's chip opens the gate modal correctly over the panel.** Gates stay modals by design; `GlobalStageGateModal` is portaled from `AppShell.tsx`, so it should layer above the Offcanvas — confirm it is not trapped behind the backdrop, and that completing the gate updates the chip.

- [ ] **Step 7: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/spaces/\$spaceId/financials.tsx \
  src/routes/_shell/listings/\$listingId/spaces/\$spaceId/financial-documents.tsx \
  src/routes/_shell/listings/\$listingId/spaces/\$spaceId/notes.tsx \
  src/components/deals/DealInvoices.tsx
git commit -m "feat(suite-panel): add the Back Office tab's voucher, invoices and notes"
```

---

### Task 7: Legacy suite URL rewrite

**Files:**
- Create: `src/data/suitePanelPath.ts`
- Test: `src/data/suitePanelPath.test.ts`
- Modify: `src/routes/_shell/listings/$listingId.tsx`

**Interfaces:**
- Consumes: `SPACE_PANEL_LEAVES`, `DEFAULT_SPACE_PANEL_LEAF` from Task 1
- Produces: `suitePanelPath(listing: Listing, subPath: string | null): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/data/suitePanelPath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { suitePanelPath } from './suitePanelPath'
import type { Listing } from './types'

const suite = { id: 'S1', parentDealId: 'L1' } as unknown as Listing
const topLevel = { id: 'L1', parentDealId: null } as unknown as Listing

describe('suitePanelPath', () => {
  it('returns null for a deal that is not a space — nothing to rewrite', () => {
    expect(suitePanelPath(topLevel, 'website')).toBeNull()
    expect(suitePanelPath(topLevel, null)).toBeNull()
  })

  it('sends a bare suite URL to the default leaf', () => {
    expect(suitePanelPath(suite, null)).toBe('/listings/L1/spaces/S1/overview')
    expect(suitePanelPath(suite, '')).toBe('/listings/L1/spaces/S1/overview')
  })

  it('rewrites a known leaf straight through, because the slugs are unchanged', () => {
    expect(suitePanelPath(suite, 'financials')).toBe(
      '/listings/L1/spaces/S1/financials',
    )
    expect(suitePanelPath(suite, 'financial-documents')).toBe(
      '/listings/L1/spaces/S1/financial-documents',
    )
    expect(suitePanelPath(suite, 'leads')).toBe('/listings/L1/spaces/S1/leads')
  })

  it('maps the edit form to Terms — the one slug that changed', () => {
    expect(suitePanelPath(suite, 'edit')).toBe('/listings/L1/spaces/S1/terms')
  })

  it('falls back to the default leaf for a building-only surface', () => {
    // A suite has no website of its own; land on Details rather than 404.
    expect(suitePanelPath(suite, 'website')).toBe(
      '/listings/L1/spaces/S1/overview',
    )
    expect(suitePanelPath(suite, 'property-marketing')).toBe(
      '/listings/L1/spaces/S1/overview',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/data/suitePanelPath.test.ts`
Expected: FAIL — cannot resolve `./suitePanelPath`.

- [ ] **Step 3: Write the implementation**

Create `src/data/suitePanelPath.ts`:

```ts
import type { Listing } from './types'
import {
  SPACE_PANEL_LEAVES,
  DEFAULT_SPACE_PANEL_LEAF,
} from '#/components/deals/spacePanelTabs'

/**
 * Where a legacy suite URL should land now that a suite is a panel over its building.
 *
 * Every panel leaf kept the slug its section already had, so this is one rewrite
 * rather than a mapping table. Two exceptions: a bare suite URL opens the default
 * leaf, and the edit form maps to Terms — the only genuinely new slug.
 *
 * Returns null when the listing is not a space deal, meaning there is nothing to
 * rewrite and the caller should let the route render normally.
 */
export function suitePanelPath(
  listing: Listing,
  subPath: string | null,
): string | null {
  const shellId = listing.parentDealId
  if (!shellId) return null

  const base = `/listings/${shellId}/spaces/${listing.id}`
  if (!subPath) return `${base}/${DEFAULT_SPACE_PANEL_LEAF}`
  if (subPath === 'edit') return `${base}/terms`
  if ((SPACE_PANEL_LEAVES as string[]).includes(subPath)) return `${base}/${subPath}`
  // A building-only surface (website, documents, the deleted hub). The suite has no
  // such section, so land on Details rather than 404.
  return `${base}/${DEFAULT_SPACE_PANEL_LEAF}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test -- src/data/suitePanelPath.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire the rewrite into the layout's beforeLoad**

In `src/routes/_shell/listings/$listingId.tsx`, add to the imports:

```tsx
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { suitePanelPath } from "#/data/suitePanelPath";
```

and give the route a `beforeLoad`, keeping the existing `component` and `head`:

```tsx
export const Route = createFileRoute("/_shell/listings/$listingId")({
  // A suite has no page of its own: rewrite any legacy suite URL onto the panel over
  // its building. Placed on the layout so every sub-route is caught by one rule —
  // board cards, contact links and shared deep links all keep working.
  beforeLoad: ({ params, location }) => {
    const listing = getStore().listings.get(params.listingId);
    if (!listing) return;
    const sub =
      location.pathname
        .split(`/listings/${params.listingId}/`)[1]
        ?.replace(/\/$/, "") ?? null;
    const to = suitePanelPath(listing, sub);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (to) throw redirect({ to } as any);
  },
  component: PropertyDetail,
  head: ({ params }) => {
    const listing = getStore().listings.get(params.listingId);
    return {
      meta: [{ title: `${listing?.name ?? "Listing"} | Buildout Suite` }],
    };
  },
});
```

- [ ] **Step 6: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no tsc output; all tests pass.

- [ ] **Step 7: Verify by hand — ASK THE HUMAN**

Ask the human to confirm, pasting URLs directly into the address bar:

1. `/listings/{suiteId}` → lands on the building with the panel open on Details.
2. `/listings/{suiteId}/financials` → panel open on Back Office › Voucher.
3. `/listings/{shellId}` → still the building's own page, no redirect.
4. Clicking a space card on the deals board opens the building with the panel. Confirm this reads as intentional rather than as a bug — the design flagged it.
5. The store is client-owned (Zustand + IndexedDB), so a redirect depending on `getStore()` must be checked on a **cold page load**, not just client-side navigation. If the listing is not yet hydrated at `beforeLoad`, the rewrite will silently no-op and the old page will flash. Report this if it happens rather than patching it here.

- [ ] **Step 8: Commit**

```bash
git add src/data/suitePanelPath.ts src/data/suitePanelPath.test.ts \
  src/routes/_shell/listings/\$listingId.tsx
git commit -m "feat(suite-panel): rewrite legacy suite URLs onto the panel"
```

---

### Task 8: Tear down the borrowing machinery

**Files:**
- Delete: `src/components/deals/PropertyMarketingHub.tsx`
- Delete: `src/routes/_shell/listings/$listingId/property-marketing.tsx`
- Delete: `src/components/deals/MarketingScopeBar.tsx`
- Modify: `src/components/properties/PropertyDetailSidebar.tsx`
- Modify: `src/components/properties/PropertyDetailHeader.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`
- Modify: `src/routes/_shell/listings/$listingId.tsx`

**Interfaces:**
- Consumes: the rewrite from Task 7 (must land first — otherwise suite URLs 404 mid-teardown)
- Produces: nothing; removal only

Do this task **only after Task 7 is verified**. `dealShape` and its `'space'` case stay — the stage ladder and the Draft/Pitching relabel still need them. What goes is navigation machinery.

- [ ] **Step 1: Delete the three files**

```bash
git rm src/components/deals/PropertyMarketingHub.tsx \
  src/routes/_shell/listings/\$listingId/property-marketing.tsx \
  src/components/deals/MarketingScopeBar.tsx
```

- [ ] **Step 2: Strip the space-deal branches from the sidebar**

In `src/components/properties/PropertyDetailSidebar.tsx`:

- Remove the `property-marketing` nav item from the Marketing group in `NAV_GROUPS`.
- Remove the `PROPERTY_ONLY` and `SHELL_ONLY` constants and every branch reading them.
- Remove the `rawSearch` / `from` reads and the `useSearch` import.
- Remove the `shape` variable if it becomes unused after the above.

The filter becomes:

```tsx
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // Money is earned per space, so a shell has no voucher and no invoices.
      if (
        shape === "shell" &&
        (item.href === "financials" || item.href === "financial-documents")
      ) {
        return false;
      }
      if (item.href === "spaces") return leaseParent;
      if (item.href === "underwriting") return showsUnderwriting;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
```

and `handleTabChange` loses the `from` carry entirely:

```tsx
  function handleTabChange(value: string) {
    const item = navGroups
      .flatMap((g) => g.items)
      .find((i) => i.label === value);
    if (!item) return;
    void navigate({
      to: `/listings/${listingId}/${item.href}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
```

Keep `shape` — the shell voucher rule above still uses it.

- [ ] **Step 3: Remove the MarketingScopeBar mount**

In `src/routes/_shell/listings/$listingId.tsx`, delete the `MarketingScopeBar` import and its `<MarketingScopeBar />` element inside the content `Card`.

- [ ] **Step 4: Remove the parent-deal breadcrumb branch**

In `src/components/properties/PropertyDetailHeader.tsx`, delete the `parentDeal` variable, the `spaceLabel` variable, and the conditional breadcrumb branch, leaving only:

```tsx
                <Breadcrumb.Item>
                  <Breadcrumb.Page>{listing.name}</Breadcrumb.Page>
                </Breadcrumb.Item>
```

Then remove the now-unused `getListing` import if nothing else in the file uses it.

- [ ] **Step 5: Remove the space-deal branch from the listing edit form**

`b8da273` collapsed a space deal's Listing tab to its own space terms. The rewrite from Task 7 sends `/listings/{suiteId}/edit` to the panel's Terms tab, so that branch is now unreachable.

In `src/components/listings/edit/ListingFormEditor.tsx`, delete the `isSpaceDeal` constant (`:65`), the unit lookup that depends on it (`:67`), and the whole `if (isSpaceDeal) { ... }` early return (`:80`). The editor keeps only its building path.

Do **not** touch `SpaceTermsSection` itself — Task 4's Terms leaf renders it.

- [ ] **Step 6: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no tsc output; all tests pass. tsc is the gate that catches every dangling import from the deletions — do not skip it.

- [ ] **Step 7: Confirm nothing references the deleted modules**

Run: `grep -rn "MarketingScopeBar\|PropertyMarketingHub\|property-marketing\|PROPERTY_ONLY\|SHELL_ONLY\|isSpaceDeal" src/ --include="*.tsx" --include="*.ts" | grep -v routeTree`
Expected: no output.

- [ ] **Step 8: Audit the hardcoded route strings**

Route moves have broken this repo before, and `vite build` does not catch it. Run:

`grep -rn 'useParams({ *from:\|useSearch({\|from: "/_shell' src/ --include="*.tsx" --include="*.ts"`

For each hit, confirm the quoted route path still exists in `src/routes/routeTree.gen.ts`. `"/_shell/listings/$listingId"` is unchanged by this work and stays valid; anything pointing at the deleted `property-marketing` route must go. Report any hit you are unsure about instead of guessing.

- [ ] **Step 9: Verify by hand — ASK THE HUMAN**

Ask the human to confirm: a shell's sidebar still shows every marketing surface and hides Voucher/Invoices; navigating Documents → Website no longer shows any scope bar; the building's own Edit form still renders every section; and no route 404s.

- [ ] **Step 10: Commit**

```bash
git add -A src/
git commit -m "refactor(suite-panel): delete the machinery a suite page needed"
```

---

### Task 9: Space column on the building's Leads list

**Files:**
- Modify: `src/components/properties/PropertyDetailLeads.tsx`

**Interfaces:**
- Consumes: `PropertyDetailLeads({ property, initialSearch, spaceDealId })` as it exists today
- Produces: same signature; a Space column rendered only when `spaceDealId` is absent

- [ ] **Step 1: Read the component and locate the table**

Read `src/components/properties/PropertyDetailLeads.tsx` in full before editing. The pieces this task builds on, already verified:

- `scopedContacts` (`:186`) holds the `Contact` records behind the rows; contacts carry `inquiredListingIds`.
- `leads = scopedContacts.map(toLead)` (`:191`), and `toLead` sets `id: contact.id` (`:116`) — so a row's `l.id` **is** the contact id.
- `filtered` (`:193`) is what the table body iterates.

- [ ] **Step 2: Build the lead → space label map**

Add this alongside the other `useMemo`s, after `scopedContacts` is defined. Keyed by contact id, which is the row id.

```tsx
  // The suite a lead inquired about, for the building-level table's Space column.
  // Keyed by contact id because `toLead` carries the contact's id straight through.
  const spaceLabels = useMemo(() => {
    const byLead = new Map<string, string>();
    for (const contact of scopedContacts) {
      for (const listingId of contact.inquiredListingIds ?? []) {
        const deal = getListing(listingId);
        // Only a child space deal names a unit; a building-level inquiry does not.
        if (!deal?.parentDealId) continue;
        const unit = property.units.find((u) => u.id === deal.unitId);
        if (unit) {
          byLead.set(contact.id, unit.label);
          break;
        }
      }
    }
    return byLead;
  }, [scopedContacts, property.units]);
```

Add `getListing` to the existing `#/data/store` import if it is not already there.

- [ ] **Step 3: Render the column, building-level only**

Inside the suite panel every row is that same suite, so the column would repeat one value. Gate it:

```tsx
  const showSpaceColumn = !spaceDealId;
```

Add a header cell in the table's header row:

```tsx
                {showSpaceColumn && <Table.Head>Space</Table.Head>}
```

and the matching body cell in the row renderer, in the same column position:

```tsx
                {showSpaceColumn && (
                  <Table.Cell className="text-muted">
                    {spaceLabels.get(l.id) ?? "—"}
                  </Table.Cell>
                )}
```

Match the surrounding code's actual Blueprint `Table` subcomponent names — read them off the neighbouring cells rather than assuming `Table.Head` / `Table.Cell`, and keep the header and body cells at the same index so columns stay aligned.

- [ ] **Step 4: Type-check and run the suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no tsc output; all tests pass.

- [ ] **Step 5: Verify by hand — ASK THE HUMAN**

Ask the human to confirm: the building's Leads tab shows a Space column naming the suite for space inquiries and an em dash otherwise; columns line up with their headers; and the panel's Leads pill shows no Space column.

- [ ] **Step 6: Commit**

```bash
git add src/components/properties/PropertyDetailLeads.tsx
git commit -m "feat(leads): name the inquired space on the building's leads list"
```

---

## Deferred — not in this plan

Recorded in the design doc's *Still deferred* section; do not implement speculatively:

- **Panel width and density**, beyond the initial `min(78vw, 1100px)`. Judge after Task 6's verification.
- **Whether four tabs and nine leaves survive use.** Terms having no pills and Back Office wanting table width are the two most likely to move.
- **`sellerContactIds` inheritance.** `addSpaceToDeal` copies the landlord onto every child, which looks vestigial now that no panel section shows a landlord. It may still feed the gates or Back Office. Investigate separately before removing.
