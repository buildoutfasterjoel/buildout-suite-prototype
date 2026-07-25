# Create-Deal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three polish changes to the New Deal wizard: relabel the contact field to the deal role, group a seller/landlord's owned properties first, and make an uploaded-file "AI read" pre-fill the deal to near-publish-ready.

**Architecture:** Pure, unit-tested data/logic helpers do the work; `CreateDealModal.tsx` wires them into existing controls with no layout restructuring. Doc recommendation and publish-ready field values live in a new `src/data/uploadIntelligence.ts`; the contact-label and property-grouping logic live in a new `src/components/deals/createDealHelpers.ts`. A new merge-patch action `updateDealFinancials` mirrors the existing marketing/transaction patchers.

**Tech Stack:** React 19 · TypeScript · Zustand store · Blueprint React (Base UI Combobox, Alert, Badge) · FontAwesome Pro · Vitest · Bun.

## Global Constraints

- Package manager is Bun: run tests with `bun --bun run test`, typecheck with `bunx tsc --noEmit`.
- `vite build` does NOT type-check — always gate UI tasks with `bunx tsc --noEmit`.
- FontAwesome: default `pro-regular`; never pass the deprecated `fixedWidth` prop.
- Blueprint `Badge` already has flex gap for icon/text — no margin utilities on its icon.
- Do NOT restructure the modal's visual design; add behavior only.
- `data` layer is client-owned Zustand; use existing action/store helpers, don't touch persistence internals.
- All work stays inside the project folder `suite-prototype/`.
- Leave the branch as-is when done (no merge/push/PR).

---

### Task 1: `recommendDocsFromUploads` — map uploaded filenames to suggested-doc keys

**Files:**
- Create: `src/data/uploadIntelligence.ts`
- Test: `src/data/uploadIntelligence.test.ts`

**Interfaces:**
- Consumes: `SUGGESTED_DOCUMENTS` from `./createListing`; `DealDocument` from `./types`.
- Produces: `recommendDocsFromUploads(files: DealDocument[]): string[]` — de-duplicated suggested-doc `key`s in catalog order.

- [ ] **Step 1: Write the failing test**

Create `src/data/uploadIntelligence.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { recommendDocsFromUploads } from './uploadIntelligence'
import type { DealDocument } from './types'

function doc(name: string): DealDocument {
  return { id: name, name, uploadedAt: '2026-07-24T00:00:00.000Z' }
}

describe('recommendDocsFromUploads', () => {
  it('returns nothing for no files', () => {
    expect(recommendDocsFromUploads([])).toEqual([])
  })

  it('maps a rent roll to the rent roll plus marketing deliverables, in catalog order', () => {
    expect(recommendDocsFromUploads([doc('2026 Rent Roll.xlsx')])).toEqual([
      'om',
      'bov',
      'rent-roll',
    ])
  })

  it('maps a T-12 to financials it derives plus marketing deliverables', () => {
    expect(recommendDocsFromUploads([doc('T-12 Operating Statement.pdf')])).toEqual([
      'om',
      'bov',
      't12',
      'proforma',
      'noi',
    ])
  })

  it('maps a listing agreement without adding marketing deliverables', () => {
    expect(recommendDocsFromUploads([doc('Listing Agreement.pdf')])).toEqual([
      'listing-agreement',
    ])
  })

  it('unions recommendations across multiple files with no duplicates', () => {
    const result = recommendDocsFromUploads([
      doc('Rent Roll.xlsx'),
      doc('Signed Listing Agreement.pdf'),
    ])
    expect(result).toEqual(['om', 'bov', 'rent-roll', 'listing-agreement'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/uploadIntelligence.test.ts`
Expected: FAIL — cannot find module `./uploadIntelligence` / `recommendDocsFromUploads` is not a function.

- [ ] **Step 3: Write minimal implementation**

Create `src/data/uploadIntelligence.ts`:

```ts
import { SUGGESTED_DOCUMENTS } from './createListing'
import type { DealDocument } from './types'

/**
 * The documents Buildout "extracts" from a broker's uploaded files. Uploads in
 * the demo are mostly T-12s, rent rolls, and listing agreements; each maps to
 * the catalog docs the AI can now produce. When any financial file is present,
 * the AI also drafts the core marketing deliverables (OM + BOV). Returned in
 * catalog order so the Selected list stays stable.
 */
export function recommendDocsFromUploads(files: DealDocument[]): string[] {
  const names = files.map((f) => f.name.toLowerCase())
  const has = (re: RegExp) => names.some((n) => re.test(n))

  const keys = new Set<string>()
  const hasRentRoll = has(/rent\s*roll/)
  const hasT12 = has(/t-?12|operating statement/)
  const hasListingAgreement = has(/listing agreement/)

  if (hasRentRoll) keys.add('rent-roll')
  if (hasT12) {
    keys.add('t12')
    keys.add('proforma')
    keys.add('noi')
  }
  if (hasListingAgreement) keys.add('listing-agreement')
  if (hasRentRoll || hasT12) {
    keys.add('om')
    keys.add('bov')
  }

  return SUGGESTED_DOCUMENTS.filter((d) => keys.has(d.key)).map((d) => d.key)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/uploadIntelligence.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/uploadIntelligence.ts src/data/uploadIntelligence.test.ts
git commit -m "feat(create-deal): recommend suggested docs from uploaded files"
```

---

### Task 2: `buildPublishReadyPatch` + `updateDealFinancials` — pre-fill a deal to publish-ready

**Files:**
- Modify: `src/data/uploadIntelligence.ts`
- Modify: `src/data/actions.ts` (add `updateDealFinancials`; extend the `./types` import)
- Test: `src/data/uploadIntelligence.test.ts` (add a describe block)

**Interfaces:**
- Consumes: `emptySpaceLeaseTerms` from `./createListing`; `Listing`, `Property`, `DealMarketing`, `DealTransaction`, `DealPitchFinancials` from `./types`; `createDeal`, `updateDealMarketing`, `updateDealTransaction`, `updateDealFinancials` from `./actions`; `getProperty`, `getListing` from `./store`; `publishReadiness` from `./stageGates`; `emptyDraft` from `./createListing`.
- Produces:
  - `interface PublishReadyPatch { marketing: Partial<DealMarketing>; transaction: Partial<DealTransaction>; financials: Partial<DealPitchFinancials> }`
  - `buildPublishReadyPatch(deal: Listing, property: Property | undefined): PublishReadyPatch`
  - `updateDealFinancials(dealId: string, patch: Partial<DealPitchFinancials>): { deal: Listing | null }`

- [ ] **Step 1: Add the `updateDealFinancials` action**

In `src/data/actions.ts`, add `DealPitchFinancials` to the existing type import (line 9):

```ts
import type { Contact, ContactRole, ContactSource, DealHistoryEntry, DealMarketing, DealPitchFinancials, DealTask, DealTransaction, Listing, PropertyStatus, Task } from './types'
```

Then add this action immediately after `updateDealTransaction` (after line 188):

```ts
/** Merge-patch the deal's pitch financials (asking price, price per SF, cap rate, …). */
export function updateDealFinancials(
  dealId: string,
  patch: Partial<DealPitchFinancials>,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      financials: { ...l.financials, ...patch },
      updatedAt: new Date().toISOString(),
    })),
  }
}
```

- [ ] **Step 2: Write the failing test**

Append to `src/data/uploadIntelligence.test.ts`:

```ts
import { createDeal, updateDealFinancials, updateDealMarketing, updateDealTransaction } from './actions'
import { emptyDraft } from './createListing'
import { getListing, getProperty } from './store'
import { publishReadiness } from './stageGates'
import { buildPublishReadyPatch } from './uploadIntelligence'

function applyPublishReadyPatch(dealId: string) {
  const deal = getListing(dealId)!
  const patch = buildPublishReadyPatch(deal, getProperty(deal.propertyId))
  updateDealMarketing(dealId, patch.marketing)
  updateDealTransaction(dealId, patch.transaction)
  updateDealFinancials(dealId, patch.financials)
}

describe('buildPublishReadyPatch', () => {
  it('makes a Sale deal publish-ready except for the AI-doc review', () => {
    const { deal } = createDeal({
      ...emptyDraft(),
      dealType: 'Sale',
      dealSide: 'seller',
      address: '500 Market St, Denver, CO',
    })
    applyPublishReadyPatch(deal.id)
    expect(publishReadiness(getListing(deal.id)!).missing).toEqual(['aiDocsReviewed'])
  })

  it('makes a Lease deal publish-ready except for the AI-doc review', () => {
    const { deal } = createDeal({
      ...emptyDraft(),
      dealType: 'Lease',
      dealSide: 'seller',
      address: '900 Broadway, Denver, CO',
    })
    applyPublishReadyPatch(deal.id)
    expect(publishReadiness(getListing(deal.id)!).missing).toEqual(['aiDocsReviewed'])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun --bun run test src/data/uploadIntelligence.test.ts`
Expected: FAIL — `buildPublishReadyPatch` is not a function (and `updateDealFinancials` import may already resolve from Step 1).

- [ ] **Step 4: Write minimal implementation**

Append to `src/data/uploadIntelligence.ts` (and extend the top imports):

```ts
import { emptySpaceLeaseTerms, SUGGESTED_DOCUMENTS } from './createListing'
import type {
  DealDocument,
  DealMarketing,
  DealPitchFinancials,
  DealTransaction,
  Listing,
  Property,
} from './types'
```

```ts
/** The field values that make a deal pass the Approve & Publish gate. */
export interface PublishReadyPatch {
  marketing: Partial<DealMarketing>
  transaction: Partial<DealTransaction>
  financials: Partial<DealPitchFinancials>
}

/** Local `YYYY-MM-DD` (no timezone drift), matching the stored date convention. */
function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * Compute the field values that make `deal` publish-ready — everything the
 * Approve & Publish gate requires EXCEPT `aiDocsReviewed`, which stays the
 * broker's one remaining review click. Stands in for the AI reading the
 * broker's uploaded documents (listing agreement → dates, financials → price).
 */
export function buildPublishReadyPatch(
  deal: Listing,
  property: Property | undefined,
): PublishReadyPatch {
  const now = new Date()
  const transaction: Partial<DealTransaction> = {
    listedOnDate: localISO(now),
    listingExpirationDate: localISO(
      new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()),
    ),
  }

  const address = property
    ? [property.street, property.city, property.state].filter(Boolean).join(', ') ||
      property.name
    : deal.name
  const sqft =
    property && property.buildingSqFt > 0
      ? property.buildingSqFt
      : deal.marketing.availableSqFt || 10000

  if (deal.dealType === 'Lease') {
    const unitId = deal.unitId ?? property?.units[0]?.id ?? ''
    const marketing: Partial<DealMarketing> = {
      leaseTitle: `${address} — Space for Lease`,
      leaseDescription: `Well-positioned space available at ${address}. Buildout drafted this listing from your uploaded documents.`,
      availableSqFt: sqft,
      spaceLeaseTerms: [
        {
          ...emptySpaceLeaseTerms(unitId),
          leaseRate: 28,
          leaseRateUnits: 'SF/Yr',
          leaseTermMonths: 60,
        },
      ],
    }
    return { marketing, transaction, financials: {} }
  }

  const askingPrice =
    property && property.askingPrice > 0
      ? property.askingPrice
      : Math.max(500000, sqft * 250)
  const marketing: Partial<DealMarketing> = {
    saleTitle: `${address} — For Sale`,
    saleDescription: `Investment opportunity at ${address}. Buildout drafted this listing from your uploaded documents.`,
  }
  const financials: Partial<DealPitchFinancials> = {
    askingPrice,
    pricePerSqFt: sqft > 0 ? Math.round((askingPrice / sqft) * 100) / 100 : 0,
  }
  return { marketing, transaction, financials }
}
```

Note: merge the new `import type { DealDocument }` line from Task 1 into the combined import block above (don't leave two `./types` imports).

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun --bun run test src/data/uploadIntelligence.test.ts`
Expected: PASS (7 tests). Then `bunx tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/uploadIntelligence.ts src/data/uploadIntelligence.test.ts src/data/actions.ts
git commit -m "feat(create-deal): build publish-ready field patch + updateDealFinancials action"
```

---

### Task 3: `createDealHelpers` — contact-role label and property grouping

**Files:**
- Create: `src/components/deals/createDealHelpers.ts`
- Test: `src/components/deals/createDealHelpers.test.ts`

**Interfaces:**
- Consumes: `DealSide`, `DealType` from `#/data/types`; `PropertyOption` from `#/data/store`.
- Produces:
  - `contactRoleLabel(side: DealSide | null, dealType: DealType): string`
  - `contactSearchPlaceholder(side: DealSide | null, dealType: DealType): string`
  - `interface PropertyGroup { value: string; label: string | null; items: PropertyOption[] }`
  - `buildPropertyGroups(options: PropertyOption[], ownedIds: readonly string[], ownerName: string | null): PropertyGroup[]`

- [ ] **Step 1: Write the failing test**

Create `src/components/deals/createDealHelpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildPropertyGroups,
  contactRoleLabel,
  contactSearchPlaceholder,
  type PropertyGroup,
} from './createDealHelpers'
import type { PropertyOption } from '#/data/store'

function opt(value: string): PropertyOption {
  return { value, label: value, propertyType: 'office', subtype: 'Multi-Tenant', sizeLabel: null }
}

describe('contactRoleLabel', () => {
  it('falls back to Contact with no side', () => {
    expect(contactRoleLabel(null, 'Sale')).toBe('Contact')
  })
  it('labels sale sides Seller / Buyer', () => {
    expect(contactRoleLabel('seller', 'Sale')).toBe('Seller')
    expect(contactRoleLabel('buyer', 'Sale')).toBe('Buyer')
  })
  it('labels lease sides Landlord / Tenant', () => {
    expect(contactRoleLabel('seller', 'Lease')).toBe('Landlord')
    expect(contactRoleLabel('buyer', 'Lease')).toBe('Tenant')
  })
})

describe('contactSearchPlaceholder', () => {
  it('is generic with no side', () => {
    expect(contactSearchPlaceholder(null, 'Sale')).toBe('Search contacts…')
  })
  it('pluralizes the role', () => {
    expect(contactSearchPlaceholder('seller', 'Lease')).toBe('Search landlords…')
  })
})

describe('buildPropertyGroups', () => {
  const options = [opt('a'), opt('b'), opt('c')]

  it('returns a single unlabeled group when there are no owned ids', () => {
    const groups = buildPropertyGroups(options, [], 'Jane Doe')
    expect(groups).toEqual<PropertyGroup[]>([{ value: 'all', label: null, items: options }])
  })

  it('returns a single unlabeled group when owner name is null', () => {
    const groups = buildPropertyGroups(options, ['a'], null)
    expect(groups).toEqual<PropertyGroup[]>([{ value: 'all', label: null, items: options }])
  })

  it('splits owned first, then the rest, with section labels', () => {
    const groups = buildPropertyGroups(options, ['b'], 'Jane Doe')
    expect(groups).toEqual<PropertyGroup[]>([
      { value: 'owned', label: 'Owned by Jane Doe', items: [opt('b')] },
      { value: 'all', label: 'All properties', items: [opt('a'), opt('c')] },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/components/deals/createDealHelpers.test.ts`
Expected: FAIL — cannot find module `./createDealHelpers`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/deals/createDealHelpers.ts`:

```ts
import type { DealSide, DealType } from '#/data/types'
import type { PropertyOption } from '#/data/store'

/** The role label for the contact field, given the chosen side + deal type. */
export function contactRoleLabel(side: DealSide | null, dealType: DealType): string {
  if (!side) return 'Contact'
  if (side === 'seller') return dealType === 'Lease' ? 'Landlord' : 'Seller'
  return dealType === 'Lease' ? 'Tenant' : 'Buyer'
}

/** Placeholder for the contact search input, matching the role label. */
export function contactSearchPlaceholder(side: DealSide | null, dealType: DealType): string {
  const role = contactRoleLabel(side, dealType)
  return role === 'Contact' ? 'Search contacts…' : `Search ${role.toLowerCase()}s…`
}

/** A section in the property dropdown. `label` null = render no header. */
export interface PropertyGroup {
  value: string
  label: string | null
  items: PropertyOption[]
}

/**
 * Split property options into "Owned by {name}" first, then "All properties".
 * Falls back to one unlabeled group holding everything when there's no owner
 * name or the owner has none of the listed properties — so the caller's render
 * path is uniform whether or not grouping applies.
 */
export function buildPropertyGroups(
  options: PropertyOption[],
  ownedIds: readonly string[],
  ownerName: string | null,
): PropertyGroup[] {
  const owned = new Set(ownedIds)
  const ownedOpts = options.filter((o) => owned.has(o.value))
  if (!ownerName || ownedOpts.length === 0) {
    return [{ value: 'all', label: null, items: options }]
  }
  const rest = options.filter((o) => !owned.has(o.value))
  return [
    { value: 'owned', label: `Owned by ${ownerName}`, items: ownedOpts },
    { value: 'all', label: 'All properties', items: rest },
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/components/deals/createDealHelpers.test.ts`
Expected: PASS (8 tests). Then `bunx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/createDealHelpers.ts src/components/deals/createDealHelpers.test.ts
git commit -m "feat(create-deal): contact-role label + property grouping helpers"
```

---

### Task 4: Wire contact relabel + property grouping into `CreateDealModal`

**Files:**
- Modify: `src/components/deals/CreateDealModal.tsx`

**Interfaces:**
- Consumes: `contactRoleLabel`, `contactSearchPlaceholder`, `buildPropertyGroups`, `PropertyGroup` from `./createDealHelpers`; `getContact` from `#/data/store`.
- Produces: no new exports; behavior change only.

- [ ] **Step 1: Add imports**

At the top of `CreateDealModal.tsx`, add to the `#/data/store` import (currently lines 42-49) the `getContact` helper:

```ts
import {
  getPropertyOptions,
  getContactOptions,
  getOwnersForProperty,
  getProperty,
  getContact,
  type PropertyOption,
  type ContactOption,
} from "#/data/store";
```

Add a new import for the helpers (after the `propertyDisplay` import, ~line 55):

```ts
import {
  contactRoleLabel,
  contactSearchPlaceholder,
  buildPropertyGroups,
  type PropertyGroup,
} from "./createDealHelpers";
```

- [ ] **Step 2: Replace the `propertyOptions` memo with grouped `propertyGroups`**

Replace the existing `propertyOptions` memo (lines 248-258) with:

```tsx
  const propertyGroups = useMemo<PropertyGroup[]>(() => {
    const all = getPropertyOptions();
    // Owned properties are elevated only for the owning side — Seller (Sale) or
    // Landlord (Lease) — and only once a contact is chosen.
    const owner =
      side === "seller" && contactOption
        ? getContact(contactOption.value)
        : undefined;
    const ownerName = owner
      ? `${owner.firstName} ${owner.lastName}`.trim()
      : null;
    return buildPropertyGroups(all, owner?.propertyIds ?? [], ownerName);
  }, [side, contactOption]);
```

- [ ] **Step 3: Relabel the contact field**

In the contact `<Field>` (the `!contact` branch, ~line 583), replace `<Field.Label>Contact</Field.Label>` with:

```tsx
<Field.Label>{contactRoleLabel(side, dealType)}</Field.Label>
```

And change the contact `<Combobox.Input>` placeholder (~line 596) from `placeholder="Search contacts…"` to:

```tsx
placeholder={contactSearchPlaceholder(side, dealType)}
```

- [ ] **Step 4: Render the property combobox as grouped sections**

In the non-locked property `<Combobox>` (the `else` of `property ?`, ~lines 677-739), change `items={propertyOptions}` to `items={propertyGroups}`, and replace the `<Combobox.List>` block (currently a flat `{(item: PropertyOption) => ( … )}`) with a grouped render. The full `<Combobox.Content>` becomes:

```tsx
<Combobox.Content>
  <Combobox.Empty className="text-muted">
    No match — we’ll create a new property from what you typed.
  </Combobox.Empty>
  <Combobox.List>
    {(group: PropertyGroup) => (
      <Combobox.Group key={group.value} items={group.items}>
        {group.label && (
          <Combobox.GroupLabel>{group.label}</Combobox.GroupLabel>
        )}
        <Combobox.Collection>
          {(item: PropertyOption) => (
            <Combobox.Item key={item.value} value={item}>
              <span
                className="d-flex gap-2 user-select-none"
                style={{ minWidth: 0 }}
              >
                <FontAwesomeIcon
                  icon={TYPE_ICONS[item.propertyType]}
                  className="text-muted flex-shrink-0 d-inline-block mt-1"
                />
                <span
                  className="d-flex flex-column"
                  style={{ minWidth: 0 }}
                >
                  <span className="d-flex align-items-center gap-2">
                    <span className="text-truncate">{item.label}</span>
                    <Badge
                      variant="secondary"
                      appearance="muted"
                      className="flex-shrink-0"
                    >
                      {TYPE_LABELS[item.propertyType]}
                    </Badge>
                  </span>
                  <span className="text-muted fs-small text-truncate">
                    {item.subtype}
                    {item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
                  </span>
                </span>
              </span>
            </Combobox.Item>
          )}
        </Combobox.Collection>
      </Combobox.Group>
    )}
  </Combobox.List>
</Combobox.Content>
```

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors. (If `Combobox.Group` / `Combobox.GroupLabel` / `Combobox.Collection` are missing on the `Combobox` type, confirm they're exported — they are, per `@buildoutinc/blueprint-react/ui/Combobox`.)

- [ ] **Step 6: Run the full test suite**

Run: `bun --bun run test`
Expected: PASS (no regressions).

- [ ] **Step 7: Manual verification (ask the user to check in the running app)**

Verify: (a) the contact field label flips Seller↔Landlord / Buyer↔Tenant as the Side buttons and Sale/Lease tab change, and reads "Contact" before a side is picked; (b) selecting a Seller/Landlord contact who owns properties shows an "Owned by {name}" section above "All properties" in the property dropdown; (c) a Buyer/Tenant selection shows the plain flat list; (d) typing to filter still works within the groups.

- [ ] **Step 8: Commit**

```bash
git add src/components/deals/CreateDealModal.tsx
git commit -m "feat(create-deal): relabel contact field by side; group owned properties first"
```

---

### Task 5: Wire the AI upload pre-fill into `CreateDealModal`

**Files:**
- Modify: `src/components/deals/CreateDealModal.tsx`

**Interfaces:**
- Consumes: `recommendDocsFromUploads`, `buildPublishReadyPatch` from `#/data/uploadIntelligence`; `updateDealMarketing`, `updateDealTransaction`, `updateDealFinancials` from `#/data/actions`; `getProperty` from `#/data/store` (already imported); `faWandMagicSparkles` from `@fortawesome/pro-regular-svg-icons`; `Alert` from `@buildoutinc/blueprint-react/ui/Alert`.
- Produces: no new exports; behavior change only.

- [ ] **Step 1: Add imports**

Add the Alert import near the other UI imports (~line 13):

```ts
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
```

Add `faWandMagicSparkles` to the `pro-regular-svg-icons` import block (lines 17-28).

Change the `createDeal` import (line 41) to pull the patch actions too:

```ts
import {
  createDeal,
  updateDealMarketing,
  updateDealTransaction,
  updateDealFinancials,
} from "#/data/actions";
```

Add the intelligence helpers import (after the helpers import from Task 4):

```ts
import {
  recommendDocsFromUploads,
  buildPublishReadyPatch,
} from "#/data/uploadIntelligence";
```

- [ ] **Step 2: Add AI-pick state and a ref for reversion**

Alongside the other `useState` hooks (after `checkedDocKeys`, ~line 235), add:

```tsx
  // Documents the AI "extracted" from the uploaded files — auto-checked and
  // badged in step 2. A ref holds the previous picks so removing files peels
  // back exactly what was auto-added, leaving hand-checked docs intact.
  const [aiPickedDocKeys, setAiPickedDocKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const prevPicksRef = useRef<Set<string>>(new Set());
```

- [ ] **Step 3: Reset AI picks when the modal (re)opens**

In the open-reset `useEffect` (the one that ends ~line 356 with `setDragging(false);`), add these two lines next to `setFiles([]);`:

```tsx
    setAiPickedDocKeys(new Set());
    prevPicksRef.current = new Set();
```

- [ ] **Step 4: Recompute picks reactively when files change**

Add a new `useEffect` after the open-reset effect (~line 357):

```tsx
  // When the broker's uploaded files change, refresh the AI's document picks:
  // add the new recommendations to the checked set and peel back any the AI
  // had auto-added before that no longer apply.
  useEffect(() => {
    if (!open) return;
    const recs = recommendDocsFromUploads(files);
    const recsSet = new Set(recs);
    setCheckedDocKeys((prev) => {
      const next = new Set(prev);
      for (const k of prevPicksRef.current) if (!recsSet.has(k)) next.delete(k);
      for (const k of recs) next.add(k);
      return next;
    });
    prevPicksRef.current = recsSet;
    setAiPickedDocKeys(recsSet);
  }, [files, open]);
```

- [ ] **Step 5: Apply the publish-ready patch on create**

In `handleCreate`, replace the create+navigate tail (currently lines 462-468) with:

```tsx
    const { deal: listing } = createDeal(draft);
    // A file upload stands in for the AI reading the broker's documents and
    // filling the deal out to publish-ready (all but the AI-doc review).
    if (files.length > 0) {
      const prop = getProperty(listing.propertyId);
      const patch = buildPublishReadyPatch(listing, prop);
      updateDealMarketing(listing.id, patch.marketing);
      updateDealTransaction(listing.id, patch.transaction);
      updateDealFinancials(listing.id, patch.financials);
    }
    onOpenChange(false);
    void navigate({
      to: "/listings/$listingId/overview",
      params: { listingId: listing.id },
    });
```

- [ ] **Step 6: Add the step-1 "Buildout read your files" banner**

In step 1, immediately after the uploaded-files list block (the `{files.length > 0 && ( … )}` list that ends ~line 898, still inside the "Add your own files" `<Field>`), add:

```tsx
                {files.length > 0 && (
                  <Alert severity="info" withIcon className="mt-2">
                    <Alert.Title>Buildout read your files</Alert.Title>
                    We pre-filled this deal from your documents — it’s ready to
                    publish once you review the generated documents.
                  </Alert>
                )}
```

- [ ] **Step 7: Badge the AI-picked docs in step 2**

In the step-2 *Selected* list, inside the `selectedDocs.map((d) => ( … ))` label (~lines 947-964), replace the trailing category `<span>` so an AI-picked doc shows the sparkle badge instead of the plain category. Change:

```tsx
                        <span className="text-muted fs-small flex-shrink-0">
                          {d.category}
                        </span>
```

to:

```tsx
                        {aiPickedDocKeys.has(d.key) ? (
                          <Badge
                            variant="secondary"
                            appearance="muted"
                            className="flex-shrink-0"
                          >
                            <FontAwesomeIcon icon={faWandMagicSparkles} />
                            From your files
                          </Badge>
                        ) : (
                          <span className="text-muted fs-small flex-shrink-0">
                            {d.category}
                          </span>
                        )}
```

- [ ] **Step 8: Elevate the step-1 create button to "Create deal with AI" when files are present**

In the `Modal.Footer`, replace the step-1 branch (the `step === 1 ?` block, buttons at lines 1040-1058) with a files-aware version. When files are present, the skip/create action becomes the highlighted "Create deal with AI" (primary) and Next steps down to secondary:

```tsx
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant={files.length > 0 ? "primary" : "secondary"}
                disabled={!canCreate}
                onClick={() => handleCreate(false)}
              >
                {files.length > 0 && (
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                )}
                {files.length > 0 ? "Create deal with AI" : "Create deal"}
              </Button>
              <Button
                variant={files.length > 0 ? "secondary" : "primary"}
                disabled={!canCreate}
                onClick={() => setStep(2)}
              >
                Next
                <FontAwesomeIcon icon={faArrowRight} />
              </Button>
            </>
```

- [ ] **Step 9: Typecheck + full test suite**

Run: `bunx tsc --noEmit` → no errors.
Run: `bun --bun run test` → PASS (no regressions).

- [ ] **Step 10: Manual verification (ask the user to check in the running app)**

Verify: (a) uploading a file named like "Rent Roll" / "T-12" / "Listing Agreement" shows the info banner and flips the button to "Create deal with AI"; (b) step 2's Selected list auto-checks the recommended docs, each with a "From your files" sparkle badge, defaults unbadged; (c) removing all files reverts the banner, the button, and the auto-added picks (hand-checked docs stay); (d) creating the deal lands on its overview and the Approve & Publish / Complete-setup gate shows only the document-review gap remaining.

- [ ] **Step 11: Commit**

```bash
git add src/components/deals/CreateDealModal.tsx
git commit -m "feat(create-deal): AI upload pre-fills deal to publish-ready with doc markers"
```

---

## Self-Review notes

- **Spec coverage:** §1 relabel → Task 3 (`contactRoleLabel`/placeholder) + Task 4 wiring. §2 grouping → Task 3 (`buildPropertyGroups`) + Task 4 wiring, Seller/Landlord-only via the caller's `side === "seller"` guard, section headers via `Combobox.Group`/`GroupLabel`/`Collection`. §3a doc recommendation → Task 1. §3b modal state + §3d step-1 feedback + step-2 badge → Task 5. §3c field fill → Task 2 (`buildPublishReadyPatch` + `updateDealFinancials`) applied in Task 5. Testing plan (pure-helper unit tests + publish-readiness integration + manual) → Tasks 1-5.
- **aiDocsReviewed left unsatisfied** by design (user decision): the integration tests in Task 2 assert `missing === ['aiDocsReviewed']`, encoding the "fields filled, doc review remains" contract.
- **Type consistency:** `PublishReadyPatch` fields (`marketing`/`transaction`/`financials`) are consumed verbatim in Task 5 Step 5; `PropertyGroup` (`value`/`label`/`items`) is produced in Task 3 and consumed in Task 4; `updateDealFinancials(dealId, Partial<DealPitchFinancials>)` defined in Task 2, used in Task 5.
- **Fallback:** if Base UI grouped rendering misbehaves at runtime, the single-group path (`label: null`) already renders as a flat list, so the flat case is safe; only the two-group case needs runtime confirmation (Task 4 Step 7).
