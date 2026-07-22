# Deal Page Nav Consolidation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the deal sidebar into three sections (Deal, Marketing, Back Office) with the full union of legacy links, adding 7 net-new placeholder pages wired into the nav.

**Architecture:** A single shared `DealPagePlaceholder` component renders a consistent "coming soon" state via Blueprint's `Empty`. Seven new TanStack file-based routes under `src/routes/_shell/listings/$listingId/` each render that placeholder. The nav definition in `PropertyDetailSidebar.tsx` is extended with the 7 new items in their correct sections and order.

**Tech Stack:** React 19 · TypeScript · TanStack Start (file-based routing) · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro (regular weight)

## Global Constraints

- Package manager: run everything with `bun --bun run …`.
- All UI uses Blueprint React components; import from the `ui/*` subpath.
- Icons: FontAwesome Pro **regular** weight; **never** pass `fixedWidth` on `FontAwesomeIcon`.
- Do NOT edit `src/routes/routeTree.gen.ts` — it regenerates on dev/build.
- Do NOT use Playwright. Verify via `bun --bun run dev` compile output + manual click-through; ask the user to test what can't be run.
- Scan dev-server / tsc output for new warnings before claiming a task done.
- No unsolicited redesign of existing pages or links — additions only.

---

### Task 1: Shared `DealPagePlaceholder` component

**Files:**
- Create: `src/components/deals/DealPagePlaceholder.tsx`

**Interfaces:**
- Produces: `DealPagePlaceholder` — a named React component with props
  `{ title: string; icon: IconDefinition; description?: string }`. Route files
  in Task 2 import and render it.

- [ ] **Step 1: Create the component**

```tsx
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

type DealPagePlaceholderProps = {
  title: string;
  icon: IconDefinition;
  description?: string;
};

export function DealPagePlaceholder({
  title,
  icon,
  description,
}: DealPagePlaceholderProps) {
  return (
    <div className="py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={icon} aria-label={title} />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>{title}</Empty.Title>
          {description ?? "This section is coming soon."}
        </Empty.Content>
      </Empty>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun --bun run dev` (leave running) and confirm no TS error for the new file in the terminal output. Alternatively `bunx tsc --noEmit` if available.
Expected: No errors referencing `DealPagePlaceholder.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/deals/DealPagePlaceholder.tsx
git commit -m "feat(deals): shared DealPagePlaceholder for coming-soon deal pages"
```

---

### Task 2: Seven placeholder route files

**Files:**
- Create: `src/routes/_shell/listings/$listingId/contacts.tsx`
- Create: `src/routes/_shell/listings/$listingId/planner.tsx`
- Create: `src/routes/_shell/listings/$listingId/history.tsx`
- Create: `src/routes/_shell/listings/$listingId/syndication.tsx`
- Create: `src/routes/_shell/listings/$listingId/plans.tsx`
- Create: `src/routes/_shell/listings/$listingId/financial-documents.tsx`
- Create: `src/routes/_shell/listings/$listingId/notes.tsx`

**Interfaces:**
- Consumes: `DealPagePlaceholder` from `#/components/deals/DealPagePlaceholder`
  (Task 1).
- Produces: seven routes at paths
  `/listings/$listingId/{contacts,planner,history,syndication,plans,financial-documents,notes}`.

Each file follows the minimal existing route pattern (see `grids.tsx`): guard on
the listing existing, then render the placeholder with its title + icon.

- [ ] **Step 1: Create `contacts.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faUsers } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/contacts")({
  component: ContactsRoute,
});

function ContactsRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Contacts" icon={faUsers} />;
}
```

- [ ] **Step 2: Create `planner.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faListCheck } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/planner")({
  component: PlannerRoute,
});

function PlannerRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Planner" icon={faListCheck} />;
}
```

- [ ] **Step 3: Create `history.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faClockRotateLeft } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/history")({
  component: HistoryRoute,
});

function HistoryRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="History" icon={faClockRotateLeft} />;
}
```

- [ ] **Step 4: Create `syndication.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faTowerBroadcast } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/syndication")({
  component: SyndicationRoute,
});

function SyndicationRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Syndication" icon={faTowerBroadcast} />;
}
```

- [ ] **Step 5: Create `plans.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faRulerCombined } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/plans")({
  component: PlansRoute,
});

function PlansRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Plans" icon={faRulerCombined} />;
}
```

- [ ] **Step 6: Create `financial-documents.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faReceipt } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/financial-documents",
)({
  component: FinancialDocumentsRoute,
});

function FinancialDocumentsRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return (
    <DealPagePlaceholder title="Financial Documents" icon={faReceipt} />
  );
}
```

- [ ] **Step 7: Create `notes.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { faNoteSticky } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/notes")({
  component: NotesRoute,
});

function NotesRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Notes" icon={faNoteSticky} />;
}
```

- [ ] **Step 8: Verify routes register and compile**

Run: `bun --bun run dev` (dev server regenerates `routeTree.gen.ts`).
Expected: server starts with no TS errors; `routeTree.gen.ts` now contains the 7 new route paths. Do NOT hand-edit that file.

- [ ] **Step 9: Commit**

```bash
git add src/routes/_shell/listings/$listingId/contacts.tsx \
  src/routes/_shell/listings/$listingId/planner.tsx \
  src/routes/_shell/listings/$listingId/history.tsx \
  src/routes/_shell/listings/$listingId/syndication.tsx \
  src/routes/_shell/listings/$listingId/plans.tsx \
  src/routes/_shell/listings/$listingId/financial-documents.tsx \
  src/routes/_shell/listings/$listingId/notes.tsx \
  src/routes/routeTree.gen.ts
git commit -m "feat(deals): add 7 placeholder deal pages (contacts, planner, history, syndication, plans, financial-documents, notes)"
```

---

### Task 3: Wire new items into the sidebar

**Files:**
- Modify: `src/components/properties/PropertyDetailSidebar.tsx:5-21` (icon imports)
- Modify: `src/components/properties/PropertyDetailSidebar.tsx:29-66` (`NAV_GROUPS`)

**Interfaces:**
- Consumes: the 7 route paths from Task 2 (each `href` is the last path segment,
  e.g. `contacts`, `financial-documents`). The existing `handleTabChange`
  navigates to `/listings/${listingId}/${item.href}` — no change needed there.

- [ ] **Step 1: Add the new icon imports**

Add these to the existing `@fortawesome/pro-regular-svg-icons` import block (lines 5-21):

```tsx
  faUsers,
  faListCheck,
  faClockRotateLeft,
  faTowerBroadcast,
  faRulerCombined,
  faReceipt,
  faNoteSticky,
```

- [ ] **Step 2: Update `NAV_GROUPS`**

Replace the entire `NAV_GROUPS` constant (lines 29-66) with:

```tsx
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Deal",
    items: [
      { label: "Overview", href: "overview", icon: faGaugeHigh },
      { label: "Contacts", href: "contacts", icon: faUsers },
      { label: "Planner", href: "planner", icon: faListCheck },
      {
        label: "Client Report",
        href: "client-report",
        icon: faFileChartColumn,
      },
      { label: "Activity", href: "activities", icon: faBolt },
      { label: "History", href: "history", icon: faClockRotateLeft },
      { label: "Spaces", href: "spaces", icon: faVectorSquare },
      { label: "Data", href: "files", icon: faHardDrive },
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
      { label: "Syndication", href: "syndication", icon: faTowerBroadcast },
      { label: "Media", href: "media", icon: faImage },
      { label: "Demographics", href: "demographics", icon: faMapLocationDot },
      { label: "Grids", href: "grids", icon: faTableCells },
      { label: "Plans", href: "plans", icon: faRulerCombined },
    ],
  },
  {
    label: "Back Office",
    items: [
      { label: "Transaction", href: "transaction", icon: faHandshake },
      { label: "Financials", href: "financials", icon: faFileInvoiceDollar },
      {
        label: "Financial Documents",
        href: "financial-documents",
        icon: faReceipt,
      },
      { label: "Notes", href: "notes", icon: faNoteSticky },
    ],
  },
];
```

- [ ] **Step 3: Verify compile + no unused-import warnings**

Run: `bun --bun run dev`
Expected: no TS errors, no unused-import warnings for the new icons (all 7 are now referenced).

- [ ] **Step 4: Manual verification (or ask the user)**

Navigate to a deal detail page. Confirm:
- Deal section shows: Overview, Contacts, Planner, Client Report, Activity, History, [Spaces if Lease/no parent], Data, [Underwriting if qualifying].
- Marketing shows: Leads, Documents, Website, Email, Syndication, Media, Demographics, Grids, Plans.
- Back Office shows: Transaction, Financials, Financial Documents, Notes.
- Clicking each new link opens its placeholder page and highlights the active tab.

If it can't be run here, ask the user to click through and confirm.

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/PropertyDetailSidebar.tsx
git commit -m "feat(deals): consolidate deal sidebar with net-new nav items"
```

---

## Self-Review

- **Spec coverage:** All 7 net-new pages (Contacts, Planner, History, Syndication, Plans, Financial Documents, Notes) → Task 2 + Task 3. Shared placeholder → Task 1. Section labels/order (Deal, Marketing, Back Office) → Task 3 `NAV_GROUPS`. Leads-in-Marketing, no Web Activity, no Tasks, single History → reflected in the `NAV_GROUPS` block. Conditional Spaces/Underwriting untouched. ✓
- **Placeholder scan:** No TBD/TODO/"similar to"; every code step shows full code. ✓
- **Type consistency:** `DealPagePlaceholder` prop shape (`title`, `icon`, `description?`) matches every call site; every `href` matches a route's last path segment; every icon used in `NAV_GROUPS` is imported in Step 1. ✓
