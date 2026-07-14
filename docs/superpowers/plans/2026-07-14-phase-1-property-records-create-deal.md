# Phase 1 — Property Records + Seamless Create-Deal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Property a first-class navigable record (`/properties` index + `/properties/$id` detail) and let a broker start a deal seamlessly from a Property, Contact, the navbar +New menu, or OmniSearch — mining the existing property↔contact graph to pre-fill the other side.

**Architecture:** Client-only prototype. New TanStack Start routes render existing `AppShell`. A new Zustand store (`useCreateDeal`) hoists the create-deal modal's open-state so any surface can launch it against one globally-mounted `CreateDealModal`. Data reads go through new selectors; the one new write is `createContact`. No backend.

**Tech Stack:** React 19 · TypeScript · TanStack Start/Router · Zustand + IndexedDB data layer · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro (pro-regular) · Bootstrap 5 utilities · Vitest.

## Global Constraints

- Package manager is Bun: run everything with `bun --bun run …`.
- **Do NOT use Playwright** (per CLAUDE.md). Run Vitest for logic; verify UI by hand in `bun --bun run dev` or ask the user to test.
- All UI uses Blueprint React components imported from the `ui/*` subpath; Bootstrap utility classes for layout/spacing.
- Icons are FontAwesome Pro **pro-regular** by default. **Never pass `fixedWidth`** to `FontAwesomeIcon` (deprecated).
- Path alias `#/` → `src/`.
- **Never edit** `src/routeTree.gen.ts` (auto-generated), `src/routes/login.tsx`, or `src/routes/__root.tsx` (CLI-managed).
- After edits, scan the dev-server / TS output and fix any new type warnings before considering a task done.
- Add a card to the prototype index (`src/routes/index.tsx`) only if a new top-level demo entry is wanted — not required here (surfaces are reached via the navbar).

---

## File Structure

**New files**
- `src/data/useCreateDeal.ts` — shared open-state store for the create-deal modal (context: `contact` / `property` / `initialAddress`).
- `src/components/deals/GlobalCreateDealModal.tsx` — store-connected wrapper that mounts one `CreateDealModal`.
- `src/components/properties/propertyIndexFilters.ts` — pure `filterProperties` helper (unit-tested).
- `src/components/properties/PropertyRecordCard.tsx` — Property-based card linking to `/properties/$id`.
- `src/components/properties/PropertyRecordHeader.tsx` — detail-page header + Create Deal CTA.
- `src/components/properties/PropertyFactsCard.tsx` — left column, read-only facts.
- `src/components/properties/PropertyDealsPanel.tsx` — center column, deals + activity.
- `src/components/properties/PropertyOwnersCard.tsx` — right column, owners/contacts + comps.
- `src/routes/properties.tsx` — layout route (renders `AppShell`).
- `src/routes/properties/index.tsx` — Properties index.
- `src/routes/properties/$propertyId.tsx` — Property record page.
- `src/components/properties/propertyIndexFilters.test.ts` — filter helper tests.

**Modified files**
- `src/data/types.ts` — add `PropertyDetail` interface.
- `src/data/actions.ts` + `src/data/actions.test.ts` — add `createContact`.
- `src/data/selectors.ts` + `src/data/selectors.test.ts` — add `listCompsForProperty`, `getPropertyDetailClient`.
- `src/components/deals/CreateDealModal.tsx` — add `property` + `initialAddress` props, owner suggestion, property lock, contact-owned property quick-picks.
- `src/components/layout/AppShell.tsx` — mount `GlobalCreateDealModal`.
- `src/components/contacts/ContactDealsPanel.tsx` — open via `useCreateDeal` instead of local state.
- `src/routes/listings/index.tsx` — open via `useCreateDeal` instead of local state.
- `src/components/search/OmniSearch.tsx` — route property → `/properties/$id`; add "Create deal for '‹query›'" row.
- `src/components/layout/GlobalNavbar.tsx` — wire "New Deal" menu item.
- `FEATURES.md` — document the new Properties surface + shared create-deal launcher.

---

## Task 1: `createContact` action

**Files:**
- Modify: `src/data/actions.ts`
- Test: `src/data/actions.test.ts`

**Interfaces:**
- Produces: `createContact(input: NewContactInput): { contact: Contact }` where
  `NewContactInput = { firstName: string; lastName: string; company?: string; email?: string; phone?: string; role?: ContactRole; propertyIds?: string[] }`.

- [ ] **Step 1: Write the failing test** — append to `src/data/actions.test.ts` (inside the existing `describe('actions', …)` block):

```ts
  it('createContact inserts a lightweight contact into the store', () => {
    const before = useDataStore.getState().contacts.size
    const { contact } = createContact({ firstName: 'Dana', lastName: 'Reed', company: 'Reed Holdings' })
    const stored = useDataStore.getState().contacts.get(contact.id)
    expect(useDataStore.getState().contacts.size).toBe(before + 1)
    expect(stored?.firstName).toBe('Dana')
    expect(stored?.company).toBe('Reed Holdings')
    expect(stored?.role).toBe('owner') // default role
    expect(stored?.propertyIds).toEqual([])
  })
```

Add `createContact` to the import from `./actions` at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/actions.test.ts`
Expected: FAIL — `createContact is not a function` / import undefined.

- [ ] **Step 3: Implement `createContact`** — add to `src/data/actions.ts`. Add `Contact, ContactRole` to the existing `import type { … } from './types'`.

```ts
export interface NewContactInput {
  firstName: string
  lastName: string
  company?: string
  email?: string
  phone?: string
  role?: ContactRole
  propertyIds?: string[]
}

/**
 * Create a lightweight CRM contact — enough to link as a deal party from the
 * create-deal flow when no existing contact matches. Non-essential CRM fields
 * default to blank/neutral values; the broker can enrich later.
 */
export function createContact(input: NewContactInput): { contact: Contact } {
  const now = new Date().toISOString()
  const contact: Contact = {
    id: crypto.randomUUID(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email ?? '',
    phone: input.phone ?? '',
    company: input.company ?? '',
    role: input.role ?? 'owner',
    propertyIds: input.propertyIds ?? [],
    assignedTo: 'You',
    source: 'Referral',
    relationship: 'active',
    side: null,
    dealStage: null,
    inquiries: 0,
    phoneStatus: 'unknown',
    doNotCall: false,
    title: '',
    createdAt: now,
    lastTouch: 'Added manually',
    street: '',
    city: '',
    state: '',
    zip: '',
    tags: [],
  }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contact.id, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/actions.test.ts`
Expected: PASS (all tests in the file green).

- [ ] **Step 5: Commit**

```bash
git add src/data/actions.ts src/data/actions.test.ts
git commit -m "feat(data): add createContact action for inline contact creation"
```

---

## Task 2: `PropertyDetail` type + `listCompsForProperty` + `getPropertyDetailClient`

**Files:**
- Modify: `src/data/types.ts`, `src/data/selectors.ts`
- Test: `src/data/selectors.test.ts`

**Interfaces:**
- Consumes: `listDealsForProperty` (existing, `selectors.ts`), `getContactsForProperty`/`getOwnersForProperty` (existing, `store.ts`).
- Produces:
  - `PropertyDetail = { property: Property; deals: Listing[]; owners: Contact[]; contacts: Contact[]; comps: Comp[] }` (in `types.ts`).
  - `listCompsForProperty(propertyId: string): Comp[]`
  - `getPropertyDetailClient(id: string): PropertyDetail | null`

- [ ] **Step 1: Add the `PropertyDetail` type** — append to `src/data/types.ts` after `ContactDetail`:

```ts
/** Everything the property record page needs, assembled client-side from the live store. */
export interface PropertyDetail {
  property: Property
  deals: Listing[]
  owners: Contact[]
  contacts: Contact[]
  comps: Comp[]
}
```

- [ ] **Step 2: Write the failing test** — append to `src/data/selectors.test.ts`:

```ts
describe('getPropertyDetailClient', () => {
  it('assembles the property, its deals, owners, contacts, and comps', () => {
    const { properties } = useDataStore.getState()
    // A property that has at least one deal (every seeded property has ≥2 contacts).
    const property = [...properties.values()].find(
      (p) => listDealsForProperty(p.id).length > 0,
    )!

    const detail = getPropertyDetailClient(property.id)
    expect(detail).not.toBeNull()
    expect(detail!.property.id).toBe(property.id)
    expect(detail!.deals.map((d) => d.id)).toEqual(
      listDealsForProperty(property.id).map((d) => d.id),
    )
    // Owners are a subset of the property's contacts.
    expect(detail!.contacts.length).toBeGreaterThan(0)
    for (const owner of detail!.owners) {
      expect(detail!.contacts.map((c) => c.id)).toContain(owner.id)
      expect(owner.role).toBe('owner')
    }
    // Comps all belong to this property.
    for (const comp of detail!.comps) {
      expect(comp.propertyId).toBe(property.id)
    }
  })

  it('returns null for an unknown property id', () => {
    expect(getPropertyDetailClient('nonexistent-property-id')).toBeNull()
  })
})
```

Add `getPropertyDetailClient` to the import from `./selectors` at the top of the test file.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun --bun run test src/data/selectors.test.ts`
Expected: FAIL — `getPropertyDetailClient is not a function`.

- [ ] **Step 4: Implement the selectors** — add to `src/data/selectors.ts`. Extend the top import to `import type { Comp, Contact, ContactDetail, DealSummary, Listing, Property, PropertyDetail } from './types'` and add `import { getContactsForProperty, getOwnersForProperty } from './store'`.

```ts
/** All comps recorded against a property. */
export function listCompsForProperty(propertyId: string): Comp[] {
  const { comps } = useDataStore.getState()
  return [...comps.values()].filter((c) => c.propertyId === propertyId)
}

/**
 * Everything the property record page needs, assembled client-side from the live
 * store so it always reflects client mutations. Property analogue of
 * {@link getContactDetailClient}.
 */
export function getPropertyDetailClient(id: string): PropertyDetail | null {
  const { properties } = useDataStore.getState()
  const property = properties.get(id)
  if (!property) return null
  return {
    property,
    deals: listDealsForProperty(id),
    owners: getOwnersForProperty(id),
    contacts: getContactsForProperty(id),
    comps: listCompsForProperty(id),
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --bun run test src/data/selectors.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/selectors.ts src/data/selectors.test.ts
git commit -m "feat(data): add getPropertyDetailClient + listCompsForProperty selectors"
```

---

## Task 3: `useCreateDeal` shared open-state store

**Files:**
- Create: `src/data/useCreateDeal.ts`
- Test: `src/data/useCreateDeal.test.ts`

**Interfaces:**
- Produces: `useCreateDeal` Zustand store with state `{ open: boolean; contact?: Contact; property?: Property; initialAddress?: string }` and actions `openFor(ctx?: { contact?: Contact; property?: Property; initialAddress?: string }): void` and `close(): void`.

- [ ] **Step 1: Write the failing test** — create `src/data/useCreateDeal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { useCreateDeal } from './useCreateDeal'

describe('useCreateDeal', () => {
  it('opens with context and closes clearing it', () => {
    useCreateDeal.getState().openFor({ initialAddress: '123 Main St' })
    expect(useCreateDeal.getState().open).toBe(true)
    expect(useCreateDeal.getState().initialAddress).toBe('123 Main St')

    useCreateDeal.getState().close()
    expect(useCreateDeal.getState().open).toBe(false)
    expect(useCreateDeal.getState().initialAddress).toBeUndefined()
    expect(useCreateDeal.getState().contact).toBeUndefined()
    expect(useCreateDeal.getState().property).toBeUndefined()
  })

  it('openFor with no context opens an empty create flow', () => {
    useCreateDeal.getState().openFor()
    expect(useCreateDeal.getState().open).toBe(true)
    expect(useCreateDeal.getState().contact).toBeUndefined()
    expect(useCreateDeal.getState().property).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/useCreateDeal.test.ts`
Expected: FAIL — cannot find module `./useCreateDeal`.

- [ ] **Step 3: Implement the store** — create `src/data/useCreateDeal.ts`:

```ts
import { create } from 'zustand'
import type { Contact, Property } from './types'

/**
 * Shared open-state for the create-deal modal, so any surface (property record
 * header, contact page, navbar +New, omni-search) can launch one globally-mounted
 * modal without prop-drilling. Mirrors the pattern used by `useOmniSearch`.
 */
interface CreateDealState {
  open: boolean
  /** When set, the deal is initiated for this contact (contact prefilled). */
  contact?: Contact
  /** When set, the deal is initiated for this property (property locked, owner suggested). */
  property?: Property
  /** Seed text for the property address field (e.g. an omni-search query). */
  initialAddress?: string
  openFor: (ctx?: { contact?: Contact; property?: Property; initialAddress?: string }) => void
  close: () => void
}

export const useCreateDeal = create<CreateDealState>((set) => ({
  open: false,
  contact: undefined,
  property: undefined,
  initialAddress: undefined,
  openFor: (ctx) =>
    set({
      open: true,
      contact: ctx?.contact,
      property: ctx?.property,
      initialAddress: ctx?.initialAddress,
    }),
  close: () =>
    set({ open: false, contact: undefined, property: undefined, initialAddress: undefined }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/useCreateDeal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/useCreateDeal.ts src/data/useCreateDeal.test.ts
git commit -m "feat(deals): add useCreateDeal shared open-state store"
```

---

## Task 4: Extend `CreateDealModal` — property lock, owner suggestion, quick-picks

**Files:**
- Modify: `src/components/deals/CreateDealModal.tsx`

**Interfaces:**
- Consumes: `getOwnersForProperty`, `getContactsForProperty` (`store.ts`); `Property` type.
- Produces: `CreateDealModal` now accepts `property?: Property` and `initialAddress?: string` in addition to the existing `open`, `onOpenChange`, `contact`.

This task has no unit test (UI/interaction). Verify by hand in Task 10's end-to-end pass. Keep the modal fully prop-controlled so `GlobalCreateDealModal` (Task 5) can drive it.

- [ ] **Step 1: Extend the props and imports**

Add to the `store` import: `getOwnersForProperty`. Add `Property` to the `#/data/types` import. Update the component signature:

```tsx
export function CreateDealModal({
  open,
  onOpenChange,
  contact,
  property,
  initialAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present, the deal is initiated for this contact (contact field prefilled + hidden). */
  contact?: Contact;
  /** When present, the deal is initiated for this property (property field prefilled + locked). */
  property?: Property;
  /** Seed text for the property address field when starting from a raw query. */
  initialAddress?: string;
}) {
```

- [ ] **Step 2: Seed property/owner/address in the open effect**

Replace the existing `useEffect(() => { if (!open) return; … }, [open, contact])` body with one that also handles `property` and `initialAddress`, and change its dependency array to `[open, contact, property, initialAddress]`:

```tsx
  useEffect(() => {
    if (!open) return;

    // Contact context: prefill the contact and infer the side from their deal.
    if (contact) {
      setContactOption({
        value: contact.id,
        label: contactName(contact),
        name: contactName(contact),
        company: contact.company,
        title: contact.title,
        relationship: contact.relationship,
      });
      setSide(contact.side);
    } else {
      setContactOption(null);
      setSide(null);
    }

    // Property context: lock the property, default to sell-side, and suggest the
    // property's primary owner as the seller (editable).
    if (property) {
      const label = [property.street, property.city, property.state]
        .filter(Boolean)
        .join(", ");
      setPropertyOption({
        value: property.id,
        label,
        propertyType: property.propertyType,
        subtype: property.propertySubtype,
        sizeLabel:
          property.buildingSqFt > 0
            ? `${property.buildingSqFt.toLocaleString()} SF`
            : null,
      });
      setPropertyInput(label);
      if (!contact) {
        setSide("seller");
        const owner = getOwnersForProperty(property.id)[0];
        if (owner) {
          setContactOption({
            value: owner.id,
            label: contactName(owner),
            name: contactName(owner),
            company: owner.company,
            title: owner.title,
            relationship: owner.relationship,
          });
        }
      }
    } else {
      setPropertyOption(null);
      setPropertyInput(initialAddress ?? "");
    }

    setFiles([]);
    setDragging(false);
  }, [open, contact, property, initialAddress]);
```

- [ ] **Step 3: Surface the contact's own properties as quick-picks**

When launched from a contact, float their owned properties to the top of the picker. Replace the `propertyOptions` memo:

```tsx
  const propertyOptions = useMemo<PropertyOption[]>(() => {
    const all = getPropertyOptions();
    if (!contact || contact.propertyIds.length === 0) return all;
    const owned = new Set(contact.propertyIds);
    // Contact's own properties first (likely the deal's subject), then the rest.
    return [...all].sort((a, b) => {
      const ao = owned.has(a.value) ? 0 : 1;
      const bo = owned.has(b.value) ? 0 : 1;
      return ao - bo || a.label.localeCompare(b.label);
    });
  }, [contact]);
```

- [ ] **Step 4: Lock the Property field when a property is provided**

Wrap the existing Property `<Field>` so it renders a read-only summary instead of the combobox when `property` is set. Replace the `{/* Property */}` field block with:

```tsx
          {/* Property */}
          {property ? (
            <Field>
              <Field.Label>Property</Field.Label>
              <div className="d-flex align-items-center gap-2 border rounded px-3 py-2">
                <FontAwesomeIcon
                  icon={TYPE_ICONS[property.propertyType]}
                  className="text-muted"
                />
                <span className="flex-grow-1 text-truncate">
                  {[property.street, property.city, property.state]
                    .filter(Boolean)
                    .join(", ") || property.name}
                </span>
                <Badge variant="secondary" appearance="muted" className="flex-shrink-0">
                  {TYPE_LABELS[property.propertyType]}
                </Badge>
              </div>
            </Field>
          ) : (
            <Field>
              <Field.Label>Property</Field.Label>
              {/* …existing Combobox block, unchanged… */}
            </Field>
          )}
```

Keep the existing `<Combobox>` markup verbatim inside the `else` branch. (`TYPE_ICONS`/`TYPE_LABELS`/`Badge`/`FontAwesomeIcon` are already imported.)

- [ ] **Step 5: Verify it builds (no unit test)**

Run: `bun --bun run dev` and open the Deals index. Confirm the existing "New Deal" flow still renders (side + contact + property + files) with no console/TS errors. Full behavioral verification happens in Task 10.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/CreateDealModal.tsx
git commit -m "feat(deals): CreateDealModal accepts property context + owner suggestion + quick-picks"
```

---

## Task 5: Mount one global modal; route existing launchers through the store

**Files:**
- Create: `src/components/deals/GlobalCreateDealModal.tsx`
- Modify: `src/components/layout/AppShell.tsx`, `src/components/contacts/ContactDealsPanel.tsx`, `src/routes/listings/index.tsx`

**Interfaces:**
- Consumes: `useCreateDeal` (Task 3), `CreateDealModal` (Task 4).
- Produces: `GlobalCreateDealModal` component (no props); the create-deal modal is now launched via `useCreateDeal.getState().openFor(...)` from anywhere.

- [ ] **Step 1: Create the store-connected wrapper** — `src/components/deals/GlobalCreateDealModal.tsx`:

```tsx
import { CreateDealModal } from "#/components/deals/CreateDealModal";
import { useCreateDeal } from "#/data/useCreateDeal";

/** The single, app-wide create-deal modal, driven by the useCreateDeal store. */
export function GlobalCreateDealModal() {
  const open = useCreateDeal((s) => s.open);
  const contact = useCreateDeal((s) => s.contact);
  const property = useCreateDeal((s) => s.property);
  const initialAddress = useCreateDeal((s) => s.initialAddress);
  const close = useCreateDeal((s) => s.close);

  return (
    <CreateDealModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      contact={contact}
      property={property}
      initialAddress={initialAddress}
    />
  );
}
```

- [ ] **Step 2: Mount it in `AppShell`** — in `src/components/layout/AppShell.tsx`, add the import and render it alongside `OmniSearch`:

```tsx
import { GlobalCreateDealModal } from "#/components/deals/GlobalCreateDealModal";
```

```tsx
      {hydrated && <OmniSearch />}
      {hydrated && <GlobalCreateDealModal />}
```

- [ ] **Step 3: Route the contact page through the store** — in `src/components/contacts/ContactDealsPanel.tsx`:
  - Remove `import { useState } from "react";` usage for `newDealOpen`, remove the `import { CreateDealModal } …` line, and add `import { useCreateDeal } from "#/data/useCreateDeal";`.
  - Delete the local `const [newDealOpen, setNewDealOpen] = useState(false);` and the `<CreateDealModal … />` element at the top of the returned JSX.
  - Replace the "New deal" button `onClick`:

```tsx
              onClick={() => useCreateDeal.getState().openFor({ contact })}
```

- [ ] **Step 4: Route the deals index through the store** — in `src/routes/listings/index.tsx`:
  - Add `import { useCreateDeal } from "#/data/useCreateDeal";`.
  - Remove the local create-deal `useState` and the mounted `<CreateDealModal … />` (search for `CreateDealModal` in the file), and remove the now-unused `import { CreateDealModal } …`.
  - Change the "New Deal" toolbar button's `onClick` to `() => useCreateDeal.getState().openFor()`.

- [ ] **Step 5: Verify**

Run: `bun --bun run dev`.
- Deals index → "New Deal" opens the modal (empty). Create a deal → navigates to its overview.
- A contact detail page → "New deal" opens the modal prefilled with that contact.
No duplicate modals, no console/TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/GlobalCreateDealModal.tsx src/components/layout/AppShell.tsx src/components/contacts/ContactDealsPanel.tsx src/routes/listings/index.tsx
git commit -m "refactor(deals): launch one global CreateDealModal via useCreateDeal store"
```

---

## Task 6: Properties index — filter helper (TDD) + route

**Files:**
- Create: `src/components/properties/propertyIndexFilters.ts`, `src/components/properties/propertyIndexFilters.test.ts`, `src/components/properties/PropertyRecordCard.tsx`, `src/routes/properties.tsx`, `src/routes/properties/index.tsx`

**Interfaces:**
- Consumes: `getStore` (`store.ts`), `listDealsForProperty` (`selectors.ts`), display helpers (`propertyDisplay.ts`).
- Produces:
  - `filterProperties(properties: Property[], f: { query: string; types: Set<PropertyType>; statuses: Set<PropertyStatus> }): Property[]`
  - `PropertyRecordCard({ property, dealCount }: { property: Property; dealCount: number })`
  - Routes `/properties` (layout) and `/properties/` (index).

- [ ] **Step 1: Write the failing filter test** — `src/components/properties/propertyIndexFilters.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Property, PropertyType, PropertyStatus } from '#/data/types'
import { filterProperties } from './propertyIndexFilters'

// Minimal fixture — only the fields filterProperties reads; cast keeps it small.
const base = () =>
  ({
    id: 'p1', name: 'Test Tower', slug: 'test-tower', status: 'active' as PropertyStatus,
    propertyType: 'office' as PropertyType, propertySubtype: 'Multi-Tenant',
    street: '100 Main St', city: 'Dallas', state: 'TX', zip: '75201', submarket: 'CBD',
    buildingSqFt: 10000,
  } as unknown as Property)

const emptyTypes = new Set<PropertyType>()
const emptyStatuses = new Set<PropertyStatus>()

describe('filterProperties', () => {
  it('returns all when query empty and no facets selected', () => {
    const props = [base(), { ...base(), id: 'p2', city: 'Austin' }]
    expect(filterProperties(props, { query: '', types: emptyTypes, statuses: emptyStatuses })).toHaveLength(2)
  })

  it('matches query against name/address/city (case-insensitive)', () => {
    const props = [base(), { ...base(), id: 'p2', name: 'Harbor Point', city: 'Austin' }]
    const out = filterProperties(props, { query: 'harbor', types: emptyTypes, statuses: emptyStatuses })
    expect(out.map((p) => p.id)).toEqual(['p2'])
  })

  it('filters by type and status facets', () => {
    const props = [
      base(),
      { ...base(), id: 'p2', propertyType: 'retail' as PropertyType },
      { ...base(), id: 'p3', status: 'closed' as PropertyStatus },
    ]
    expect(
      filterProperties(props, { query: '', types: new Set<PropertyType>(['retail']), statuses: emptyStatuses }).map((p) => p.id),
    ).toEqual(['p2'])
    expect(
      filterProperties(props, { query: '', types: emptyTypes, statuses: new Set<PropertyStatus>(['closed']) }).map((p) => p.id),
    ).toEqual(['p3'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/components/properties/propertyIndexFilters.test.ts`
Expected: FAIL — cannot find module `./propertyIndexFilters`.

- [ ] **Step 3: Implement the filter helper** — `src/components/properties/propertyIndexFilters.ts`:

```ts
import type { Property, PropertyType, PropertyStatus } from '#/data/types'

export interface PropertyIndexFilter {
  query: string
  types: Set<PropertyType>
  statuses: Set<PropertyStatus>
}

/** Pure filter for the Properties index: substring query + type/status facets. */
export function filterProperties(properties: Property[], f: PropertyIndexFilter): Property[] {
  const q = f.query.trim().toLowerCase()
  return properties.filter((p) => {
    if (f.types.size > 0 && !f.types.has(p.propertyType)) return false
    if (f.statuses.size > 0 && !f.statuses.has(p.status)) return false
    if (!q) return true
    const haystack = [p.name, p.street, p.city, p.state, p.zip, p.submarket]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/components/properties/propertyIndexFilters.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the Property record card** — `src/components/properties/PropertyRecordCard.tsx`:

```tsx
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatSqFt,
  getPhotoUrl,
} from "./propertyDisplay";

export function PropertyRecordCard({
  property,
  dealCount,
}: {
  property: Property;
  dealCount: number;
}) {
  return (
    <div
      className="bg-card rounded border overflow-hidden h-100 d-flex flex-column"
      style={{ borderRadius: 6 }}
    >
      <div style={{ padding: 12 }} className="d-flex flex-column gap-2">
        <div
          className="position-relative overflow-hidden"
          style={{ height: 150, borderRadius: 4 }}
        >
          <img
            src={getPhotoUrl(property.id)}
            alt={property.name}
            className="w-100 h-100"
            style={{ objectFit: "cover", display: "block" }}
          />
          <span
            className="position-absolute d-inline-flex align-items-center gap-1 fw-semibold text-white"
            style={{
              left: 12,
              bottom: 12,
              backgroundColor: STATUS_COLORS[property.status],
              borderRadius: 6,
              padding: "3px 6px",
              fontSize: 10,
            }}
          >
            {STATUS_LABELS[property.status]}
          </span>
        </div>

        <div className="d-flex flex-column" style={{ gap: 2 }}>
          <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: 10 }}>
            <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} style={{ fontSize: 10 }} />
            <span>{TYPE_LABELS[property.propertyType]}</span>
          </div>
          <div
            className="fw-bold text-truncate"
            style={{ fontSize: 14, lineHeight: "19px", color: "#22262f" }}
            title={property.name}
          >
            {property.name}
          </div>
          <div className="text-muted text-truncate" style={{ fontSize: 12 }}>
            {[property.street, property.city, property.state].filter(Boolean).join(", ")}
          </div>
        </div>
      </div>

      <div
        className="d-flex align-items-center border-top mt-auto"
        style={{ gap: 10, padding: 8 }}
      >
        <span className="text-muted flex-grow-1" style={{ fontSize: 11 }}>
          {property.buildingSqFt > 0 ? formatSqFt(property.buildingSqFt) : "—"}
        </span>
        <Badge variant="secondary" appearance="muted" className="d-inline-flex align-items-center gap-1">
          <FontAwesomeIcon icon={faHandshake} />
          {dealCount}
        </Badge>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create the layout route** — `src/routes/properties.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "#/components/layout/AppShell";

export const Route = createFileRoute("/properties")({
  component: AppShell,
});
```

- [ ] **Step 7: Create the index route** — `src/routes/properties/index.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faBuilding } from "@fortawesome/pro-regular-svg-icons";
import type { PropertyType, PropertyStatus } from "#/data/types";
import { getStore } from "#/data/store";
import { listDealsForProperty } from "#/data/selectors";
import { PropertyRecordCard } from "#/components/properties/PropertyRecordCard";
import { filterProperties } from "#/components/properties/propertyIndexFilters";
import {
  PROPERTY_TYPES,
  TYPE_LABELS,
  PROPERTY_STATUSES,
  STATUS_LABELS,
} from "#/components/properties/propertyDisplay";

export const Route = createFileRoute("/properties/")({
  component: PropertiesIndex,
  head: () => ({ meta: [{ title: "Properties | Buildout Suite" }] }),
});

function PropertiesIndex() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PropertyType | "all">("all");
  const [status, setStatus] = useState<PropertyStatus | "all">("all");

  const all = useMemo(() => [...getStore().properties.values()], []);
  const dealCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) m.set(p.id, listDealsForProperty(p.id).length);
    return m;
  }, [all]);

  const results = useMemo(
    () =>
      filterProperties(all, {
        query,
        types: type === "all" ? new Set() : new Set([type]),
        statuses: status === "all" ? new Set() : new Set([status]),
      }).sort((a, b) => a.name.localeCompare(b.name)),
    [all, query, type, status],
  );

  return (
    <div className="container py-4 d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h1 className="h4 mb-0">Properties</h1>
        <span className="text-muted fs-small">{results.length} of {all.length}</span>
      </div>

      <div className="d-flex flex-wrap gap-2">
        <InputGroup style={{ maxWidth: 320 }}>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-muted" />
          </InputGroup.Addon>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address, name, submarket…"
            aria-label="Search properties"
          />
        </InputGroup>

        <Select value={type} onValueChange={(v) => setType(v as PropertyType | "all")}>
          <Select.Trigger style={{ minWidth: 160 }}><Select.Value placeholder="Type" /></Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All types</Select.Item>
            {PROPERTY_TYPES.map((t) => (
              <Select.Item key={t} value={t}>{TYPE_LABELS[t]}</Select.Item>
            ))}
          </Select.Content>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus(v as PropertyStatus | "all")}>
          <Select.Trigger style={{ minWidth: 160 }}><Select.Value placeholder="Status" /></Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All statuses</Select.Item>
            {PROPERTY_STATUSES.map((s) => (
              <Select.Item key={s} value={s}>{STATUS_LABELS[s]}</Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      {results.length === 0 ? (
        <div className="d-flex align-items-center justify-content-center p-8">
          <Empty>
            <Empty.Media>
              <FontAwesomeIcon icon={faBuilding} aria-label="No properties" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No properties match your filters</Empty.Title>
              Try clearing the search or changing the type/status.
            </Empty.Content>
          </Empty>
        </div>
      ) : (
        <div className="row g-3">
          {results.map((p) => (
            <div key={p.id} className="col-md-6 col-lg-4 col-xl-3">
              <Link
                to="/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="text-decoration-none text-reset d-block h-100"
              >
                <PropertyRecordCard property={p} dealCount={dealCounts.get(p.id) ?? 0} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

> Note: the `Select` subcomponent API (`Select.Trigger`/`Value`/`Content`/`Item`) should match Blueprint's — if the dev server errors on the shape, check an existing `Select` usage (e.g. in `src/routes/listings/index.tsx`) and match it exactly. The `Link` to `/properties/$propertyId` will only typecheck after Task 7 creates that route; expect a transient type error until then (or create Task 7's route file first).

- [ ] **Step 8: Verify**

Run: `bun --bun run test src/components/properties/propertyIndexFilters.test.ts` → PASS.
Run: `bun --bun run dev` → navbar **Properties** loads a searchable, filterable grid of ~50 properties (no 404). Cards show type/status/size/# deals. (Row navigation is fully verified once Task 7 lands.)

- [ ] **Step 9: Commit**

```bash
git add src/components/properties/propertyIndexFilters.ts src/components/properties/propertyIndexFilters.test.ts src/components/properties/PropertyRecordCard.tsx src/routes/properties.tsx src/routes/properties/index.tsx
git commit -m "feat(properties): add Properties index route with search + type/status filters"
```

---

## Task 7: Property record page — header + 3-column reference hub

**Files:**
- Create: `src/components/properties/PropertyRecordHeader.tsx`, `PropertyFactsCard.tsx`, `PropertyDealsPanel.tsx`, `PropertyOwnersCard.tsx`, `src/routes/properties/$propertyId.tsx`

**Interfaces:**
- Consumes: `getPropertyDetailClient` (Task 2), `useCreateDeal` (Task 3), `DealCardById` (`DealCard.tsx`), display helpers.

- [ ] **Step 1: Header with Create Deal CTA** — `src/components/properties/PropertyRecordHeader.tsx`:

```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { useCreateDeal } from "#/data/useCreateDeal";
import { TYPE_ICONS, TYPE_LABELS, STATUS_LABELS, getPhotoUrl } from "./propertyDisplay";

export function PropertyRecordHeader({ property }: { property: Property }) {
  return (
    <div className="border-bottom bg-card">
      <div className="container py-4 d-flex align-items-center gap-3 flex-wrap">
        <img
          src={getPhotoUrl(property.id, 96, 96)}
          alt={property.name}
          style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }}
        />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 text-muted fs-small">
            <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
            {TYPE_LABELS[property.propertyType]}
            <Badge variant="secondary" appearance="muted">{STATUS_LABELS[property.status]}</Badge>
          </div>
          <h1 className="h4 mb-0 text-truncate">{property.name}</h1>
          <div className="text-muted text-truncate">
            {[property.street, property.city, property.state, property.zip].filter(Boolean).join(", ")}
          </div>
        </div>
        <Button variant="primary" onClick={() => useCreateDeal.getState().openFor({ property })}>
          <FontAwesomeIcon icon={faPlus} />
          Create Deal
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Facts card (left)** — `src/components/properties/PropertyFactsCard.tsx`:

```tsx
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import type { Property } from "#/data/types";
import { formatPrice, formatSqFt, formatPct } from "./propertyDisplay";

type Row = { label: string; value: string };

function group(title: string, rows: Row[]) {
  const shown = rows.filter((r) => r.value && r.value !== "—");
  if (shown.length === 0) return null;
  return { title, rows: shown };
}

export function PropertyFactsCard({ property: p }: { property: Property }) {
  const groups = [
    group("Property Information", [
      { label: "Type", value: p.propertySubtype },
      { label: "Building size", value: p.buildingSqFt > 0 ? formatSqFt(p.buildingSqFt) : "—" },
      { label: "Lot size", value: p.lotSqFt > 0 ? formatSqFt(p.lotSqFt) : "—" },
      { label: "Year built", value: p.yearBuilt > 0 ? String(p.yearBuilt) : "—" },
      { label: "Stories", value: p.stories > 0 ? String(p.stories) : "—" },
      { label: "Class", value: p.buildingClass },
    ]),
    group("Location", [
      { label: "Submarket", value: p.submarket },
      { label: "County", value: p.county },
      { label: "Zoning", value: p.zoning },
      { label: "APN", value: p.apn },
    ]),
    group("Tax", [
      { label: "Assessed value", value: p.assessedTaxValue > 0 ? formatPrice(p.assessedTaxValue) : "—" },
      { label: "Tax amount", value: p.taxAmount > 0 ? formatPrice(p.taxAmount) : "—" },
      { label: "Tax year", value: p.taxYear > 0 ? String(p.taxYear) : "—" },
    ]),
    group("Investment metrics", [
      { label: "Asking price", value: p.askingPrice > 0 ? formatPrice(p.askingPrice) : "—" },
      { label: "NOI", value: p.noi > 0 ? formatPrice(p.noi) : "—" },
      { label: "Cap rate", value: p.capRate > 0 ? formatPct(p.capRate) : "—" },
      { label: "Vacancy", value: p.vacancyRate > 0 ? formatPct(p.vacancyRate) : "—" },
    ]),
  ].filter(Boolean) as { title: string; rows: Row[] }[];

  return (
    <Card className="shadow-sm">
      <Card.Body className="d-flex flex-column gap-3">
        {groups.map((g) => (
          <div key={g.title} className="d-flex flex-column gap-1">
            <div className="text-uppercase text-muted fw-semibold fs-xs">{g.title}</div>
            {g.rows.map((r) => (
              <div key={r.label} className="d-flex justify-content-between gap-2">
                <span className="text-muted fs-small">{r.label}</span>
                <span className="fs-small fw-semibold text-end">{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </Card.Body>
    </Card>
  );
}
```

- [ ] **Step 3: Deals panel (center)** — `src/components/properties/PropertyDealsPanel.tsx`:

```tsx
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faHandshake } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, Property } from "#/data/types";
import { DealCardById } from "#/components/deals/DealCard";
import { useCreateDeal } from "#/data/useCreateDeal";

export function PropertyDealsPanel({
  property,
  deals,
}: {
  property: Property;
  deals: Listing[];
}) {
  return (
    <Card className="shadow-sm">
      <Card.Body className="d-flex flex-column gap-3">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
            Deals on this property
            <Badge variant="secondary" appearance="muted" className="fs-xs">{deals.length}</Badge>
          </Card.Title>
          <Button variant="outline" size="sm" onClick={() => useCreateDeal.getState().openFor({ property })}>
            <FontAwesomeIcon icon={faPlus} />
            New deal
          </Button>
        </div>
        {deals.length === 0 ? (
          <Empty className="py-4">
            <Empty.Media>
              <FontAwesomeIcon icon={faHandshake} aria-label="No deals" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No deals yet</Empty.Title>
              Start a deal from this property and it will show up here.
            </Empty.Content>
          </Empty>
        ) : (
          <div className="d-flex flex-column gap-3">
            {deals.map((d) => (
              <DealCardById key={d.id} listingId={d.id} showStatus />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
```

- [ ] **Step 4: Owners + comps card (right)** — `src/components/properties/PropertyOwnersCard.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/pro-regular-svg-icons";
import type { Comp, Contact } from "#/data/types";
import { formatPrice } from "./propertyDisplay";

function initials(c: Contact): string {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}

export function PropertyOwnersCard({
  contacts,
  comps,
}: {
  contacts: Contact[];
  comps: Comp[];
}) {
  return (
    <div className="d-flex flex-column gap-4">
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
            Contacts
            <Badge variant="secondary" appearance="muted" className="fs-xs">{contacts.length}</Badge>
          </Card.Title>
          {contacts.length === 0 ? (
            <span className="text-muted fs-small">No contacts linked to this property yet.</span>
          ) : (
            contacts.map((c) => (
              <Link
                key={c.id}
                to="/backoffice/contacts/$contactId"
                params={{ contactId: c.id }}
                className="text-decoration-none text-reset d-flex align-items-center gap-2"
              >
                <Avatar size="sm">
                  <Avatar.Fallback className="fw-semibold">
                    {initials(c) || <FontAwesomeIcon icon={faUser} />}
                  </Avatar.Fallback>
                </Avatar>
                <span className="d-flex flex-column" style={{ minWidth: 0 }}>
                  <span className="text-truncate">{c.firstName} {c.lastName}</span>
                  <span className="text-muted fs-small text-truncate">
                    {[c.role, c.company].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            ))
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
            Comps
            <Badge variant="secondary" appearance="muted" className="fs-xs">{comps.length}</Badge>
          </Card.Title>
          {comps.length === 0 ? (
            <span className="text-muted fs-small">No comps recorded.</span>
          ) : (
            comps.slice(0, 6).map((comp) => (
              <div key={comp.id} className="d-flex justify-content-between gap-2 fs-small">
                <span className="text-truncate">
                  {comp.compType === "sale" ? "Sale" : "Lease"} · {comp.sellerOrLandlordName}
                </span>
                <span className="text-muted flex-shrink-0">
                  {comp.salePrice ? formatPrice(comp.salePrice) : comp.leaseRate ? `$${comp.leaseRate}/SF` : "—"}
                </span>
              </div>
            ))
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: The record route** — `src/routes/properties/$propertyId.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getPropertyDetailClient } from "#/data/selectors";
import { PropertyRecordHeader } from "#/components/properties/PropertyRecordHeader";
import { PropertyFactsCard } from "#/components/properties/PropertyFactsCard";
import { PropertyDealsPanel } from "#/components/properties/PropertyDealsPanel";
import { PropertyOwnersCard } from "#/components/properties/PropertyOwnersCard";

export const Route = createFileRoute("/properties/$propertyId")({
  component: PropertyRecordPage,
  head: () => ({ meta: [{ title: "Property | Buildout Suite" }] }),
});

function PropertyNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faBuildingCircleExclamation} aria-label="Property not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Property not found</Empty.Title>
          We couldn&apos;t find that property. It may have been removed, or the link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" nativeButton={false} render={<Link to="/properties" />}>
            Back to Properties
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function PropertyRecordPage() {
  const { propertyId } = Route.useParams();
  const detail = getPropertyDetailClient(propertyId);
  if (!detail) return <PropertyNotFound />;
  const { property, deals, contacts, comps } = detail;

  return (
    <div className="d-flex flex-column h-100 overflow-auto">
      <PropertyRecordHeader property={property} />
      <div className="container py-4">
        <div className="row g-4">
          <div className="col-12 col-lg-3">
            <PropertyFactsCard property={property} />
          </div>
          <div className="col-12 col-lg-6">
            <PropertyDealsPanel property={property} deals={deals} />
          </div>
          <div className="col-12 col-lg-3">
            <PropertyOwnersCard contacts={contacts} comps={comps} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `bun --bun run dev`.
- From the Properties index, click a card → the record page loads with facts (left), deals via `DealCardById` (center), contacts + comps (right).
- **Create Deal** in the header opens the modal with the property locked and the primary owner pre-suggested as seller. Create → lands on the new deal's overview → return to the property page and the new deal now appears in "Deals on this property" (reciprocal, via the live store).
- Visit `/properties/bogus-id` → the not-found Empty renders.

- [ ] **Step 7: Commit**

```bash
git add src/components/properties/PropertyRecordHeader.tsx src/components/properties/PropertyFactsCard.tsx src/components/properties/PropertyDealsPanel.tsx src/components/properties/PropertyOwnersCard.tsx src/routes/properties/\$propertyId.tsx
git commit -m "feat(properties): add property record page (facts + deals + owners/comps) with Create Deal"
```

---

## Task 8: OmniSearch — route properties to the record page + "Create deal" row

**Files:**
- Modify: `src/components/search/OmniSearch.tsx`

**Interfaces:**
- Consumes: `useCreateDeal` (Task 3).

- [ ] **Step 1: Point property results at the record page**

Add `import { useCreateDeal } from "#/data/useCreateDeal";` near the other imports. Remove the now-unused `import { getListingsForProperty } from "#/data/store";`. In the properties loop, replace the `activate` (and drop the `listing` lookup):

```tsx
    for (const p of properties.slice(0, GROUP_CAP)) {
      list.push({
        kind: "record",
        key: `property-${p.id}`,
        group: "Properties",
        icon: faBuilding,
        title: p.name,
        meta: [p.street, [p.city, p.state].filter(Boolean).join(", ")]
          .filter(Boolean)
          .join(" · "),
        activate: () => navigate(`/properties/${p.id}`),
      });
    }
```

- [ ] **Step 2: Add a "Create deal" entry type**

Extend the `Entry` union with a `create` variant (alongside `record` and `ai`):

```tsx
  | {
      kind: "create";
      key: "create";
      icon: IconDefinition;
      title: string;
      activate: () => void;
    };
```

Import `faHandshakeAngle` (or reuse `faHandshake`) from `@fortawesome/pro-regular-svg-icons` for the row icon.

- [ ] **Step 3: Push the create row before the Ask-AI row**

Immediately before the `list.push({ kind: "ai", … })` call, add:

```tsx
    list.push({
      kind: "create",
      key: "create",
      icon: faHandshake,
      title: `Create deal for “${q}”`,
      activate: () => {
        useCreateDeal.getState().openFor({ initialAddress: q });
        close();
      },
    });
```

Add `faHandshake` to the icon import.

- [ ] **Step 4: Render the create row (reuse the AI-row styling)**

In the render, the `create` row is not a `record`, so the existing header/meta/badge guards already skip it. It needs the same top separator the AI row gets. Change the separator guard and the AI icon-color guard to treat `create` like `ai`:

```tsx
                const showTopSeparator =
                  (entry.kind === "ai" || entry.kind === "create") && index > 0 &&
                  entries[index - 1].kind === "record";
```

Replace `showAiSeparator` usages with `showTopSeparator`. For the icon color, change the ternary to:

```tsx
                        className={
                          entry.kind === "record" ? "text-muted" : "text-buildout-blue-700"
                        }
```

(The `entry.kind === "record" && entry.meta` and badge blocks already correctly render nothing for the create row.)

- [ ] **Step 5: Verify**

Run: `bun --bun run dev`, open OmniSearch (⌘K/Ctrl K).
- A property match → selecting it routes to `/properties/$id`.
- A trailing "Create deal for '‹query›'" row appears above "Ask AI"; selecting it opens the create-deal modal with the query seeded as the address, and closes the palette.
- Keyboard up/down/Enter still land on the right rows.

- [ ] **Step 6: Commit**

```bash
git add src/components/search/OmniSearch.tsx
git commit -m "feat(search): route property results to record page + add Create-deal quick action"
```

---

## Task 9: Navbar +New → Deal

**Files:**
- Modify: `src/components/layout/GlobalNavbar.tsx`

- [ ] **Step 1: Wire the menu item**

Add `import { useCreateDeal } from "#/data/useCreateDeal";`. Replace the "New Deal" menu item's handler:

```tsx
              <Navbar.GroupMenuItem onClick={() => useCreateDeal.getState().openFor()}>
                New Deal
              </Navbar.GroupMenuItem>
```

(Leave the other stubbed +New items as-is — out of scope.)

- [ ] **Step 2: Verify**

Run: `bun --bun run dev` → navbar **+ → New Deal** opens the empty create-deal modal from any page.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/GlobalNavbar.tsx
git commit -m "feat(nav): wire +New → Deal to the create-deal launcher"
```

---

## Task 10: Docs + full end-to-end verification

**Files:**
- Modify: `FEATURES.md`

- [ ] **Step 1: Run the whole test suite**

Run: `bun --bun run test`
Expected: PASS — including the new `actions`, `selectors`, `useCreateDeal`, and `propertyIndexFilters` tests; no regressions.

- [ ] **Step 2: End-to-end manual pass** (`bun --bun run dev`)

Walk the North Star flows and confirm each:
1. Navbar **Properties** → index loads (no 404), search + type/status filters work, card shows # deals.
2. Click a property → record page: facts / deals / contacts + comps.
3. Header **Create Deal** → property locked, owner pre-suggested as seller → create → deal overview → new deal shows back on the property page.
4. A **contact** page → "New deal" prefills the contact; that contact's own properties sort to the top of the property picker.
5. **+New → Deal** opens empty; creating works.
6. **OmniSearch**: property → `/properties/$id`; "Create deal for '‹query›'" opens the modal with the address seeded.
7. **Reset demo** (profile menu) still reseeds cleanly and every page re-reads the store.

Fix any console/TS errors before continuing.

- [ ] **Step 3: Update `FEATURES.md`**

Under a new "Properties" section (and amend "Search" + the "Known gaps" list), document: the `/properties` index (browse + filters), the `/properties/$id` record page (facts + deals + owners/comps + Create Deal), the shared `useCreateDeal` launcher wired to the property header, contact page, navbar +New, and OmniSearch, and remove "Properties … have navbar entries but no routes yet" from the gaps list. Keep the file's existing tone/format.

- [ ] **Step 4: Run `/prototype-review`**

Run the `prototype-review` skill and address any icon-weight / Blueprint-adoption / styling findings.

- [ ] **Step 5: Commit**

```bash
git add FEATURES.md
git commit -m "docs(features): document Properties surface + shared create-deal launcher"
```

---

## Self-Review Notes (coverage against the Phase 1 spec)

- **Properties index + detail** → Tasks 6, 7. **Reference-hub 3-column layout** mirroring contact detail → Task 7 Step 5.
- **Context-aware create (property lock + owner suggestion; contact quick-picks)** → Task 4. **Inline create-new** → property stub already exists in `createProposalListing`; contact via `createContact` (Task 1) — note: wiring an unmatched typed *name* into `createContact` inside the modal is a small follow-on; the modal today selects existing contacts and (from a property) pre-suggests the owner, which covers the primary seamless path. If inline contact-by-name is required for Phase 1 sign-off, add it to Task 4's contact Combobox `Empty` action.
- **Entry points** → property header (Task 7), contact (already wired; store-migrated in Task 5), navbar +New (Task 9), OmniSearch (Task 8). **Shared modal instance** → Tasks 3 + 5.
- **Data** → `getPropertyDetailClient` + `listCompsForProperty` (Task 2), `createContact` (Task 1). **No property editing** (spec: read-only this phase) — honored.
- **Verification** → data via Vitest (Tasks 1–3, 6); UI by hand + `/prototype-review` (Task 10), no Playwright.
