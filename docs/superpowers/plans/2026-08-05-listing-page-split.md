# Listing Page Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the two-tab deal edit form into a `Marketing → Listing` page that owns the listing form and a `/edit` page that owns the deal fields alone.

**Architecture:** `DealMarketingEditor` (926 lines, one draft behind a tab bar) is retired. Its inline sub-editors move to `src/components/deals/edit/`, the listing half becomes `ListingEditor` on a new `/listings/$listingId/listing` route, and the deal half becomes `DealEditor` on the existing `/edit` route. The one object both halves touch — `financials` — is protected by two pure save-patch functions that write only the keys their page owns. Ingestion-conflict routing moves from a tab lookup to a page lookup.

**Tech Stack:** React 19 · TypeScript · TanStack Start (file-based routing) · Zustand store (`useDataStore`) · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-08-05-listing-page-split-design.md`

## Global Constraints

- Package manager is Bun. Always `bun --bun run <script>`.
- Tests: `bun --bun run test` (Vitest). Type gate: `bunx tsc --noEmit`. **`vite build` does not type-check** — it is not the gate. A biome complaint and one react/module Vitest stderr line are known non-gates; ignore them.
- **Do not use Playwright.** Run what you can; hand the visual checks to Joel (Task 9).
- All UI uses Blueprint React components imported from the `ui/` subpath, plus Bootstrap 5 utility classes. No Tailwind.
- FontAwesome: default to `@fortawesome/pro-regular-svg-icons`. **Never pass `fixedWidth` to `FontAwesomeIcon`** — it is deprecated in this codebase. No margin utilities on icons inside a `Badge` (Badge already has flex gap).
- `src/routeTree.gen.ts` is auto-generated. Never edit it; regenerate with `bun --bun run build`.
- Blueprint `Field.Label` / `Field.Description` must be inside a `Field.Root`/`Field`; standalone parts crash at runtime and tsc will not catch it.
- No unsolicited visual redesign. These tasks move and re-home existing markup; they do not restyle it.
- Existing files use tabs for indentation in `src/components/deals/DealMarketingEditor.tsx`, `src/components/listings/edit/ListingFormEditor.tsx`, and `src/components/listings/edit/sections/*`; two spaces elsewhere. Match the file you are editing.
- Commit after each task with the `type(scope): summary` convention already in the log (e.g. `refactor(deals): …`).

---

### Task 1: Save-patch rules

The two pages each hold their own draft. `Listing.financials` is the only object both touch — the deal form owns every field on it except `rentRoll`, which the listing form's Units section owns. If each page passed its own whole `financials` snapshot to `updateDeal`, whichever saved second would silently revert the other's numbers. These two pure functions are the fix: each builds a patch containing only the keys its page owns, reading the other side's value from the live record at save time.

**Files:**
- Create: `src/components/deals/edit/savePatches.ts`
- Test: `src/components/deals/edit/savePatches.test.ts`

**Interfaces:**
- Consumes: `Listing`, `DealMarketing`, `DealPitchFinancials`, `DealTransaction`, `DealBroker`, `DealType`, `PropertyStatus`, `RentRollRow` from `#/data/types`.
- Produces: `ListingDraft`, `DealDraft`, `listingSavePatch(current: Listing, draft: ListingDraft): Partial<Listing>`, `dealSavePatch(current: Listing, draft: DealDraft): Partial<Listing>`. Task 6 uses the first pair, Task 7 the second.

- [ ] **Step 1: Write the failing test**

Create `src/components/deals/edit/savePatches.test.ts`. It leans on the seeded store the way `src/data/actions.test.ts` does — the app boots with fixture listings, so there is no fixture to hand-build.

```ts
import { describe, expect, it } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { updateDeal } from "#/data/actions";
import type { Listing, RentRollRow } from "#/data/types";
import { dealSavePatch, listingSavePatch } from "./savePatches";

/** The first seeded deal. Read fresh per test — these tests write to the store. */
function seededDeal(): Listing {
  return [...useDataStore.getState().listings.values()][0];
}

function current(id: string): Listing {
  const deal = useDataStore.getState().listings.get(id);
  if (!deal) throw new Error(`no deal ${id}`);
  return deal;
}

function rentRow(id: string): RentRollRow {
  return {
    id,
    unitId: null,
    tenant: "Tenant",
    actualRent: 0,
    marketRent: 0,
    rentPerSf: null,
    securityDeposit: 0,
    leaseStart: null,
    leaseEnd: null,
    suite: "",
    size: null,
    annualRent: null,
  };
}

describe("listingSavePatch", () => {
  it("writes the rent roll without disturbing deal-side financials", () => {
    const deal = seededDeal();
    updateDeal(deal.id, {
      financials: { ...deal.financials, askingPrice: 4_250_000, rentRoll: [] },
    });
    const record = current(deal.id);

    const patch = listingSavePatch(record, {
      marketing: record.marketing,
      internalNotes: "a note",
      rentRoll: [rentRow("row-1")],
    });

    expect(patch.financials?.rentRoll.map((r) => r.id)).toEqual(["row-1"]);
    // The number the Deal page owns survives a Listing page save.
    expect(patch.financials?.askingPrice).toBe(4_250_000);
  });

  it("names only the keys the Listing page owns", () => {
    const record = seededDeal();
    const patch = listingSavePatch(record, {
      marketing: record.marketing,
      internalNotes: "",
      rentRoll: [],
    });
    expect(Object.keys(patch).sort()).toEqual([
      "financials",
      "internalNotes",
      "marketing",
    ]);
  });
});

describe("dealSavePatch", () => {
  it("preserves the stored rent roll over a stale draft snapshot", () => {
    const deal = seededDeal();
    updateDeal(deal.id, {
      financials: { ...deal.financials, rentRoll: [rentRow("row-2")] },
    });
    const record = current(deal.id);

    const patch = dealSavePatch(record, {
      status: record.status,
      dealType: record.dealType,
      internalBrokers: record.internalBrokers,
      outsideBrokers: record.outsideBrokers,
      transaction: record.transaction,
      // A draft that mounted before that rent-roll row existed.
      financials: { ...record.financials, rentRoll: [], askingPrice: 9_000_000 },
    });

    expect(patch.financials?.rentRoll.map((r) => r.id)).toEqual(["row-2"]);
    expect(patch.financials?.askingPrice).toBe(9_000_000);
  });

  it("names only the keys the Deal page owns", () => {
    const record = seededDeal();
    const patch = dealSavePatch(record, {
      status: record.status,
      dealType: record.dealType,
      internalBrokers: record.internalBrokers,
      outsideBrokers: record.outsideBrokers,
      transaction: record.transaction,
      financials: record.financials,
    });
    expect(Object.keys(patch).sort()).toEqual([
      "dealType",
      "financials",
      "internalBrokers",
      "outsideBrokers",
      "status",
      "transaction",
    ]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun --bun run test savePatches`
Expected: FAIL — cannot resolve `./savePatches`.

- [ ] **Step 3: Write the implementation**

Create `src/components/deals/edit/savePatches.ts`:

```ts
import type {
  DealBroker,
  DealMarketing,
  DealPitchFinancials,
  DealTransaction,
  DealType,
  Listing,
  PropertyStatus,
  RentRollRow,
} from "#/data/types";

/**
 * Who owns which deal fields now that the edit form is two pages.
 *
 * `Listing.financials` is the seam: the Deal page owns every field on it except
 * `rentRoll`, which the Listing page's Units section owns. Each page holds its
 * own draft, so each save must write only its own keys and take the other side's
 * from the live record — otherwise the second save to land reverts the first.
 */

/** The Listing page's draft (`/listings/:id/listing`). */
export interface ListingDraft {
  marketing: DealMarketing;
  internalNotes: string;
  rentRoll: RentRollRow[];
}

/** The Deal page's draft (`/listings/:id/edit`). */
export interface DealDraft {
  status: PropertyStatus;
  dealType: DealType;
  internalBrokers: DealBroker[];
  outsideBrokers: DealBroker[];
  transaction: DealTransaction;
  financials: DealPitchFinancials;
}

/** `current` is the record as stored *at save time*, not at mount. */
export function listingSavePatch(
  current: Listing,
  draft: ListingDraft,
): Partial<Listing> {
  return {
    marketing: draft.marketing,
    internalNotes: draft.internalNotes,
    // Only `rentRoll` is ours; the rest of financials comes off the record.
    financials: { ...current.financials, rentRoll: draft.rentRoll },
  };
}

/** `current` is the record as stored *at save time*, not at mount. */
export function dealSavePatch(
  current: Listing,
  draft: DealDraft,
): Partial<Listing> {
  return {
    status: draft.status,
    dealType: draft.dealType,
    internalBrokers: draft.internalBrokers,
    outsideBrokers: draft.outsideBrokers,
    transaction: draft.transaction,
    // Everything but `rentRoll` is ours; that one stays as stored.
    financials: { ...draft.financials, rentRoll: current.financials.rentRoll },
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `bun --bun run test savePatches`
Expected: PASS, 4 tests.

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/edit/savePatches.ts src/components/deals/edit/savePatches.test.ts
git commit -m "feat(deals): state which edit page owns which deal fields"
```

---

### Task 2: Ingestion conflict page routing

`DealMarketingEditor` holds `CONFLICT_TAB`, a `Record<IngestionFieldKey, "deal" | "listing">` that decides which tab an ingestion conflict opens on. With the tabs gone, the same lookup has to name a *page*, and three callers need it: the banner (which link to render), and each page (which conflicts to count and which field to scroll to).

Verified field homes: `askingPrice` and `noi` render `fieldKey` on the deal Financials section; `occupancyPct` renders it in `src/components/listings/edit/sections/BuildingSection.tsx:51`. `IngestionFieldKey` is exactly those three (`src/data/types.ts:465`).

**Files:**
- Create: `src/components/deals/ingestionRouting.ts`
- Test: `src/components/deals/ingestionRouting.test.ts`

**Interfaces:**
- Consumes: `IngestionConflict`, `IngestionFieldKey` from `#/data/types`.
- Produces: `ConflictPage = "deal" | "listing"`, `CONFLICT_PAGE`, `conflictKeysOn(page)`, `ingestionReviewTarget(conflicts)`, `firstUnresolvedOn(conflicts, page)`. Tasks 6, 7, and 8 all consume these.

- [ ] **Step 1: Write the failing test**

Create `src/components/deals/ingestionRouting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { IngestionConflict, IngestionFieldKey } from "#/data/types";
import {
  CONFLICT_PAGE,
  conflictKeysOn,
  firstUnresolvedOn,
  ingestionReviewTarget,
} from "./ingestionRouting";

function conflict(
  fieldKey: IngestionFieldKey,
  resolution?: "doc" | "current",
): IngestionConflict {
  return {
    fieldKey,
    label: fieldKey,
    docValue: "1",
    currentValue: "2",
    docSource: "T-12.pdf",
    currentSource: "Property record",
    docRaw: 1,
    currentRaw: 2,
    ...(resolution ? { resolution } : {}),
  };
}

describe("CONFLICT_PAGE", () => {
  it("routes every conflict field to exactly one page", () => {
    // A field with no page would be unreachable — the broker could never
    // resolve it, and the publish gate would block forever.
    expect(CONFLICT_PAGE).toEqual({
      askingPrice: "deal",
      noi: "deal",
      occupancyPct: "listing",
    });
  });
});

describe("conflictKeysOn", () => {
  it("partitions the keys between the two pages", () => {
    expect(conflictKeysOn("deal").sort()).toEqual(["askingPrice", "noi"]);
    expect(conflictKeysOn("listing")).toEqual(["occupancyPct"]);
  });
});

describe("ingestionReviewTarget", () => {
  it("picks the page holding the first unresolved conflict", () => {
    expect(ingestionReviewTarget([conflict("occupancyPct")])).toBe("listing");
    expect(ingestionReviewTarget([conflict("noi")])).toBe("deal");
  });

  it("skips resolved conflicts when choosing", () => {
    const conflicts = [conflict("noi", "doc"), conflict("occupancyPct")];
    expect(ingestionReviewTarget(conflicts)).toBe("listing");
  });

  it("falls back to the listing page when nothing is unresolved", () => {
    expect(ingestionReviewTarget([])).toBe("listing");
    expect(ingestionReviewTarget([conflict("noi", "current")])).toBe("listing");
  });
});

describe("firstUnresolvedOn", () => {
  it("returns only a conflict the page owns", () => {
    const conflicts = [conflict("occupancyPct"), conflict("noi")];
    expect(firstUnresolvedOn(conflicts, "deal")).toBe("noi");
    expect(firstUnresolvedOn(conflicts, "listing")).toBe("occupancyPct");
  });

  it("returns null when the page owns nothing unresolved", () => {
    expect(firstUnresolvedOn([conflict("noi", "doc")], "deal")).toBeNull();
    expect(firstUnresolvedOn([], "listing")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun --bun run test ingestionRouting`
Expected: FAIL — cannot resolve `./ingestionRouting`.

- [ ] **Step 3: Write the implementation**

Create `src/components/deals/ingestionRouting.ts`:

```ts
import type { IngestionConflict, IngestionFieldKey } from "#/data/types";

/** The two pages the deal edit form was split into. */
export type ConflictPage = "deal" | "listing";

/**
 * Which edit page each ingestion-conflict field lives on. Replaces the two-tab
 * `CONFLICT_TAB`: the fields did not move, the tabs became pages.
 *
 * Stated exactly once, and read three ways — the banner picks a link with it,
 * each page counts its own badge with it, and each page picks its scroll target
 * with it. A field missing here would be unresolvable.
 */
export const CONFLICT_PAGE: Record<IngestionFieldKey, ConflictPage> = {
  askingPrice: "deal",
  noi: "deal",
  occupancyPct: "listing",
};

/** The conflict field keys a page owns. */
export function conflictKeysOn(page: ConflictPage): IngestionFieldKey[] {
  return (Object.keys(CONFLICT_PAGE) as IngestionFieldKey[]).filter(
    (key) => CONFLICT_PAGE[key] === page,
  );
}

/**
 * Where "Review fields" should land: the page holding the first conflict the
 * broker has not settled, so they are not left hunting across two pages.
 *
 * Falls back to the listing page, which is where the bulk of ingested content
 * lands — the banner only renders while something is unresolved, so the
 * fallback is a formality rather than a real destination.
 */
export function ingestionReviewTarget(
  conflicts: IngestionConflict[],
): ConflictPage {
  const first = conflicts.find((c) => !c.resolution);
  return first ? CONFLICT_PAGE[first.fieldKey] : "listing";
}

/** The first unresolved conflict *this* page owns — the review-mode scroll target. */
export function firstUnresolvedOn(
  conflicts: IngestionConflict[],
  page: ConflictPage,
): IngestionFieldKey | null {
  const keys = conflictKeysOn(page);
  return (
    conflicts.find((c) => !c.resolution && keys.includes(c.fieldKey))?.fieldKey ??
    null
  );
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `bun --bun run test ingestionRouting`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/ingestionRouting.ts src/components/deals/ingestionRouting.test.ts
git commit -m "feat(deals): route ingestion conflicts to a page instead of a tab"
```

---

### Task 3: The Listing nav item

`NAV_GROUPS` is the single source of truth for a deal's sections — the sidebar renders it and the breadcrumb looks labels up in it, so adding the item here is the whole nav change. `faSign` is the icon the retired Listing *tab* used, so the association carries over.

**Files:**
- Modify: `src/components/properties/dealNav.ts:47-59` (the Marketing group), plus the icon import block at the top
- Test: `src/components/properties/dealNav.test.ts`

**Interfaces:**
- Produces: a Marketing nav item with `href: "listing"`, which Task 6's route must match.

- [ ] **Step 1: Write the failing test**

Append to the `describe("NAV_GROUPS", …)` block in `src/components/properties/dealNav.test.ts`:

```ts
  it("leads Marketing with the Listing page", () => {
    const marketing = NAV_GROUPS.find((g) => g.label === "Marketing");
    expect(marketing?.items[0]).toMatchObject({
      label: "Listing",
      href: "listing",
    });
  });
```

And append to the `describe("visibleNavGroups", …)` block:

```ts
  it("shows Listing for every shape that has a page", () => {
    // Not filtered by shape: the listing fields are the deal's marketing content
    // whatever the deal's shape. A space has no page at all, so it never asks.
    for (const shape of ["sale", "flat-lease", "shell"] as const) {
      expect(hrefs(shape, { leaseParent: true, showsUnderwriting: true }), shape).toContain(
        "listing",
      );
    }
  });
```

Also add a breadcrumb case inside `describe("dealBreadcrumbTrail", …)`:

```ts
  it("labels the listing section", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/listing`, ID)).toEqual({
      sectionLabel: "Listing",
      detailId: null,
    });
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun --bun run test dealNav`
Expected: FAIL — three failures: `items[0]` is the Leads item, `hrefs(...)` lacks `"listing"`, and the breadcrumb reports `sectionLabel: null`.

- [ ] **Step 3: Write the implementation**

In `src/components/properties/dealNav.ts`, add `faSign` to the `@fortawesome/pro-regular-svg-icons` import list (keep it alphabetically loose like the existing list — append it after `faNoteSticky`), then make it the first item of the Marketing group:

```ts
  {
    label: "Marketing",
    items: [
      // The listing's own field data — the form that used to be the Listing tab
      // of `/edit`. First in the group: it is the content every other Marketing
      // section (Website, Documents, syndication) reads from.
      { label: "Listing", href: "listing", icon: faSign },
      { label: "Leads", href: "leads", icon: faAddressBook },
      { label: "Documents", href: "documents", icon: faFileLines },
      { label: "Website", href: "website", icon: faGlobe },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Media", href: "media", icon: faImage },
      { label: "Demographics", href: "demographics", icon: faMapLocationDot },
      { label: "Grids", href: "grids", icon: faTableCells },
      { label: "Plans", href: "plans", icon: faRulerCombined },
    ],
  },
```

Leave `visibleNavGroups` alone — it filters only `vouchers`, `financials`, `financial-documents`, `spaces`, and `underwriting`, so an unlisted href shows for every shape, which is what the test above asserts.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `bun --bun run test dealNav`
Expected: PASS. The pre-existing "has unique hrefs" test also still passes — `listing` collides with nothing (`listings` is the URL prefix, not a section href).

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/dealNav.ts src/components/properties/dealNav.test.ts
git commit -m "feat(deals): add a Listing section to the Marketing nav group"
```

Note: the sidebar will now render a Listing item that 404s until Task 6 lands. That is intentional — Task 6 is the next task, and shipping the nav entry with its own test keeps the two reviewable separately.

---

### Task 4: Narrow the rent-roll props

`ListingFormEditor` takes `financials` + `patchFinancials` and threads them to `UnitsSection`, which is the only section that touches financials — and touches only `financials.rentRoll`. Narrowing the props to exactly that is what lets the Listing page hold a `rentRoll` draft instead of a whole `financials` snapshot it does not own.

This task keeps both surfaces working: `DealMarketingEditor` still renders the Listing tab, now passing the narrower props from its own draft.

**Files:**
- Modify: `src/components/listings/edit/sections/UnitsSection.tsx:187-203` (props), `:207` (`rentRoll` derivation), `:233`, `:317-322` (the three `patchFinancials` calls)
- Modify: `src/components/listings/edit/ListingFormEditor.tsx:31-53` (props), `:71-78` (the `UnitsSection` call)
- Modify: `src/components/deals/DealMarketingEditor.tsx:896-907` (the `ListingFormEditor` call)

**Interfaces:**
- Produces: `UnitsSection` and `ListingFormEditor` both take `rentRoll: RentRollRow[]` and `setRentRoll: (v: RentRollRow[]) => void` in place of `financials` / `patchFinancials`. Task 6 relies on this.

- [ ] **Step 1: Narrow `UnitsSection`**

These files indent with tabs. In `src/components/listings/edit/sections/UnitsSection.tsx`, replace the two financials props:

```tsx
export function UnitsSection({
	property,
	patchProperty,
	marketing,
	patchMarketing,
	rentRoll,
	setRentRoll,
}: {
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	/** Rent roll only. It lives on `financials.rentRoll`, but it is the sole
	 *  financials field this form owns — the Deal page owns the rest, and taking
	 *  the whole object here would let a stale draft revert it. */
	rentRoll: RentRollRow[];
	setRentRoll: (v: RentRollRow[]) => void;
}) {
```

Delete the `const rentRoll = financials.rentRoll ?? [];` line at `:207` (the prop replaces it; `rentRoll` is non-optional on `DealPitchFinancials`, so the `?? []` was already defensive). Then replace the three call sites:

- in `editRentRow`: `patchFinancials({ rentRoll: next });` → `setRentRoll(next);`
- `onAdd`: `patchFinancials({ rentRoll: [...rentRoll, emptyRentRow()] })` → `setRentRoll([...rentRoll, emptyRentRow()])`
- `onRemove`: `patchFinancials({ rentRoll: rentRoll.filter((r) => r.id !== id) })` → `setRentRoll(rentRoll.filter((r) => r.id !== id))`

Fix the imports: drop `DealPitchFinancials` from the type import if nothing else in the file uses it, and make sure `RentRollRow` is imported (it is already used by `editRentRow` and `emptyRentRow`). Update the doc comment's "stored on `financials.rentRoll`" to note the page split:

```
 * and Rent Roll (which lives on `financials.rentRoll`, passed in narrowed to
 * `rentRoll`/`setRentRoll` — see savePatches.ts for why).
```

- [ ] **Step 2: Narrow `ListingFormEditor`**

In `src/components/listings/edit/ListingFormEditor.tsx`, swap the props and the `UnitsSection` call:

```tsx
export function ListingFormEditor({
	dealType,
	status,
	marketing,
	patchMarketing,
	property,
	patchProperty,
	rentRoll,
	setRentRoll,
	internalNotes,
	setInternalNotes,
}: {
	dealType: DealType;
	status: PropertyStatus;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
	property: Property;
	patchProperty: (p: Partial<Property>) => void;
	rentRoll: RentRollRow[];
	setRentRoll: (v: RentRollRow[]) => void;
	internalNotes: string;
	setInternalNotes: (v: string) => void;
}) {
```

```tsx
				<UnitsSection
					property={property}
					patchProperty={patchProperty}
					marketing={marketing}
					patchMarketing={patchMarketing}
					rentRoll={rentRoll}
					setRentRoll={setRentRoll}
				/>
```

Swap `DealPitchFinancials` for `RentRollRow` in the type import block.

- [ ] **Step 3: Update the current call site**

In `src/components/deals/DealMarketingEditor.tsx:896`, feed the narrowed props from the existing `financials` draft so the Listing tab keeps working:

```tsx
				<ListingFormEditor
					dealType={dealType}
					status={status}
					marketing={marketing}
					patchMarketing={patchMarketing}
					property={propertyDraft}
					patchProperty={patchProperty}
					rentRoll={financials.rentRoll}
					setRentRoll={(v) => patchFinancials({ rentRoll: v })}
					internalNotes={internalNotes}
					setInternalNotes={setInternalNotes}
				/>
```

- [ ] **Step 4: Type-check and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors; the full suite passes. tsc is the real check here — it is what proves no other consumer passed the old props (there are none: `ListingFormEditor` and `UnitsSection` each have exactly one caller).

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/sections/UnitsSection.tsx src/components/listings/edit/ListingFormEditor.tsx src/components/deals/DealMarketingEditor.tsx
git commit -m "refactor(listings): narrow the listing form's financials prop to the rent roll"
```

---

### Task 5: Extract the shared editor pieces

`DealMarketingEditor.tsx` is 926 lines holding three module-level sub-editors, two formatters, a draft-merge helper, and a banner — all of which either belong to the deal half or are needed by both new pages. Move them out first, as a pure refactor with the two-tab editor still assembling them, so Tasks 6 and 7 are small and the move is reviewable on its own.

**Files:**
- Create: `src/components/deals/edit/reseedDraft.ts` (from `DealMarketingEditor.tsx:81-98`)
- Create: `src/components/deals/edit/BrokerEditor.tsx` (from `:100-170`)
- Create: `src/components/deals/edit/LineItemEditor.tsx` (from `:172-243`)
- Create: `src/components/deals/edit/ScenarioEditor.tsx` (from `:245-355`)
- Create: `src/components/deals/edit/DealFinancialsSection.tsx` (from `:71-79` formatters and `:718-891` markup)
- Create: `src/components/deals/edit/PendingPublishBanner.tsx` (from `:400-401` + `:552-576`)
- Modify: `src/components/deals/DealMarketingEditor.tsx` — delete the moved code, import it instead

**Interfaces:**
- Produces:
  - `reseedDraft<T extends object>(draft: T, base: T, next: T): T`
  - `BrokerEditor({ title, brokers, side, onChange })` — `side: "internal" | "outside"`, `onChange: (v: DealBroker[]) => void`
  - `LineItemEditor<T extends IncomeLineItem | ExpenseLineItem>({ title, items, onChange })`
  - `ScenarioEditor({ scenarios, onChange })`
  - `DealFinancialsSection({ financials, patchFinancials })` — `patchFinancials: (p: Partial<DealPitchFinancials>) => void`
  - `PendingPublishBanner({ listing })` — renders nothing unless `pendingPublishDealId === listing.id`
- Tasks 6 and 7 import `reseedDraft` and `PendingPublishBanner`; Task 7 imports the other four.

- [ ] **Step 1: Move the four mechanical pieces**

Create `reseedDraft.ts`, `BrokerEditor.tsx`, `LineItemEditor.tsx`, and `ScenarioEditor.tsx` by cutting each block verbatim — including its doc comment — and adding the imports it needs. Keep the tab indentation. For example `BrokerEditor.tsx` needs:

```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import type { DealBroker } from "#/data/types";
import { NumberField, TextField } from "#/components/listings/edit/fieldWidgets";
```

`LineItemEditor.tsx` needs `Button`, `Input`, `FontAwesomeIcon`, `faPlus`, `faTrashCan`, and `type { ExpenseLineItem, IncomeLineItem }`. `ScenarioEditor.tsx` needs `Button`, `Input`, `FontAwesomeIcon`, `faArrowUp`, `faArrowDown`, `faPlus`, `faTrashCan`, `type { FinancialScenario }`, and `{ Col, FieldGrid, NumberField }` from `#/components/listings/edit/fieldWidgets`. `reseedDraft.ts` needs no imports.

- [ ] **Step 2: Move the Financials section**

Create `src/components/deals/edit/DealFinancialsSection.tsx`. It takes the `formatCalcAmount` / `formatCalcPercent` helpers (keep them module-private — this is their only consumer) and the whole `<Section title="Financials" …>` element from `:719-890`, including the read-only calc grid, the Hide price switch, both `LineItemEditor`s, and the `ScenarioEditor`:

```tsx
/**
 * The Deal page's Financials block: the editable pitch numbers, the four
 * read-only computed rows beneath them, the hide-price switch, and the income /
 * expense / scenario editors. Sale-only — the caller decides whether to render it.
 */
export function DealFinancialsSection({
	financials,
	patchFinancials,
}: {
	financials: DealPitchFinancials;
	patchFinancials: (p: Partial<DealPitchFinancials>) => void;
}) {
	return (
		<Section title="Financials" icon={faChartLine}>
			{/* Cut and paste lines 720-889 of the pre-Task-5 DealMarketingEditor.tsx
			    here verbatim: the eleven-field FieldGrid, the four read-only calc
			    Fields, the Hide price SwitchRow, both LineItemEditors, and the
			    ScenarioEditor. Change nothing inside — every `financials.x` read and
			    every `patchFinancials({...})` call already matches this component's
			    props, because they were the enclosing component's locals with the
			    same names. */}
		</Section>
	);
}
```

Verify the move by diffing against the old file before deleting it in Task 7: the section's rendered output must be identical, including the two `fieldKey` props.

Imports it needs: `Field`, `Input` from Blueprint; `FontAwesomeIcon` + `faChartLine`; `type { DealPitchFinancials }`; `{ capRate, grossIncome, totalScheduledIncome, vacancyCost }` from `#/data/listingFinancials`; `{ Section }` from `#/components/listings/listingWidgets`; `{ Col, FieldGrid, NumberField, SwitchRow }` from `#/components/listings/edit/fieldWidgets`; and the two sibling editors. **Keep the `fieldKey="askingPrice"` and `fieldKey="noi"` props** — those are what render the ingestion arbitration rows.

- [ ] **Step 3: Move the pending-publish banner**

Create `src/components/deals/edit/PendingPublishBanner.tsx`, folding in the `useStageGate` read that gates it:

```tsx
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRocketLaunch } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing } from "#/data/types";
import {
	requestSetupCompletion,
	requestStageChange,
	useStageGate,
} from "#/components/deals/useStageGate";

/**
 * Shown on both edit pages after the broker steps out of the publish review to
 * make changes: the way back into the gate. Renders nothing otherwise, so a page
 * can mount it unconditionally.
 */
export function PendingPublishBanner({ listing }: { listing: Listing }) {
	const pendingPublishDealId = useStageGate((s) => s.pendingPublishDealId);
	if (pendingPublishDealId !== listing.id) return null;
	return (
		<Alert severity="info" withIcon>
			{/* `withIcon` only reserves the gutter — the icon must be a direct child. */}
			<FontAwesomeIcon icon={faRocketLaunch} />
			<Alert.Title>Finish up, then publish</Alert.Title>
			<div className="d-flex align-items-center justify-content-between gap-3">
				<span>
					You stepped out of the publish review to make changes. Save them, then
					head back to publish.
				</span>
				<Button
					variant="primary"
					size="sm"
					className="flex-shrink-0"
					onClick={() =>
						listing.status === "proposal"
							? requestStageChange(listing.id, "active")
							: requestSetupCompletion(listing.id)
					}
				>
					Review &amp; publish
				</Button>
			</div>
		</Alert>
	);
}
```

- [ ] **Step 4: Rewire `DealMarketingEditor` to the extracted pieces**

Delete the moved code from `DealMarketingEditor.tsx` and import it. Replace the `showPublishBanner` local and its JSX with `<PendingPublishBanner listing={listing} />`, and the inline Financials `<Section>` with `<DealFinancialsSection financials={financials} patchFinancials={patchFinancials} />`. Drop the now-unused imports (`Alert`, `faRocketLaunch`, `faChartLine`, the `listingFinancials` calc imports, `SwitchRow` if unused, `faArrowUp`/`faArrowDown`/`faTrashCan`/`faPlus` if unused). The file should land near 400 lines with identical behavior.

- [ ] **Step 5: Verify nothing changed behaviorally**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, full suite passes. Read the tsc output for *warnings* as well as errors — unused imports are the likely fallout of a move like this.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/edit src/components/deals/DealMarketingEditor.tsx
git commit -m "refactor(deals): extract the edit form's sub-editors and banner"
```

---

### Task 6: The Listing page

The new home for the listing form: a Marketing section that *is* the form. Save only — no Cancel, because a nav section has nowhere to return to and navigating away already discards. Save commits, stays put, and fires a toast. `src/routes/_shell/listings/$listingId/spaces.tsx` is the precedent for the dirty/Save/`notify` pattern; follow it.

**Files:**
- Create: `src/components/listings/edit/ListingEditor.tsx`
- Create: `src/routes/_shell/listings/$listingId/listing.tsx`

**Interfaces:**
- Consumes: `listingSavePatch`, `ListingDraft` (Task 1); `conflictKeysOn`, `firstUnresolvedOn` (Task 2); `reseedDraft`, `PendingPublishBanner` (Task 5); `ListingFormEditor`'s narrowed props (Task 4).
- Produces: `ListingEditor({ listing, property, review })` with `review?: "ingestion"`.

- [ ] **Step 1: Write `ListingEditor`**

Create `src/components/listings/edit/ListingEditor.tsx`. Tabs for indentation, matching `ListingFormEditor` beside it.

```tsx
import { useEffect, useRef, useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import type { DealMarketing, Listing, Property, RentRollRow } from "#/data/types";
import { resolveIngestionConflict, updateDeal } from "#/data/actions";
import { updateProperty } from "#/data/store";
import { notify } from "#/lib/notify";
import { ListingFormEditor } from "#/components/listings/edit/ListingFormEditor";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { listingSavePatch } from "#/components/deals/edit/savePatches";
import { reseedDraft } from "#/components/deals/edit/reseedDraft";
import { PendingPublishBanner } from "#/components/deals/edit/PendingPublishBanner";
import {
	conflictRowId,
	countConflictsFor,
	IngestionConflictProvider,
} from "#/components/deals/ingestionConflictContext";
import { conflictKeysOn, firstUnresolvedOn } from "#/components/deals/ingestionRouting";

/**
 * Marketing → Listing: the listing's own field data, editable in place. This is
 * the form that used to be the Listing tab of `/edit`; the website editor reads
 * the same data from a separate section.
 *
 * Save only, by design — a nav section has nowhere for Cancel to return to, and
 * navigating away already discards. Save is disabled until something changes, so
 * the bar says "nothing to save" rather than sitting there dead.
 */
export function ListingEditor({
	listing,
	property,
	/** When "ingestion", scroll to the first conflicting field this page owns. */
	review,
}: {
	listing: Listing;
	property: Property;
	review?: "ingestion";
}) {
	const [marketing, setMarketing] = useState<DealMarketing>(listing.marketing);
	const [propertyDraft, setPropertyDraft] = useState<Property>(property);
	const [rentRoll, setRentRollState] = useState<RentRollRow[]>(
		listing.financials.rentRoll,
	);
	const [internalNotes, setInternalNotes] = useState(listing.internalNotes);
	const [dirty, setDirty] = useState(false);

	// Every broker-facing edit marks the draft dirty. The ingestion re-seed below
	// deliberately does not: it brings the draft *to* what is stored, so there is
	// nothing new to save.
	const patchMarketing = (patch: Partial<DealMarketing>) => {
		setMarketing((m) => ({ ...m, ...patch }));
		setDirty(true);
	};
	const patchProperty = (patch: Partial<Property>) => {
		setPropertyDraft((p) => ({ ...p, ...patch }));
		setDirty(true);
	};
	const setRentRoll = (v: RentRollRow[]) => {
		setRentRollState(v);
		setDirty(true);
	};
	const patchInternalNotes = (v: string) => {
		setInternalNotes(v);
		setDirty(true);
	};

	// An ingestion run can commit while the broker is already in this form, writing
	// marketing straight to the store — values this draft snapshotted at mount, so
	// saving would silently revert them. Re-seed on that ONE transition out of
	// `processing`, and only for keys untouched since mount.
	const ingestionStatus = listing.ingestion?.status;
	const previousIngestionStatus = useRef(ingestionStatus);
	const mountedListing = useRef(listing);
	useEffect(() => {
		const previous = previousIngestionStatus.current;
		previousIngestionStatus.current = ingestionStatus;
		if (previous !== "processing" || ingestionStatus === "processing") return;
		const base = mountedListing.current;
		setMarketing((d) => reseedDraft(d, base.marketing, listing.marketing));
	}, [ingestionStatus, listing]);

	const conflicts = listing.ingestion?.conflicts ?? [];
	const conflictCount = countConflictsFor(conflicts, conflictKeysOn("listing"));

	// Review mode: bring the first disputed field this page owns into view. Mount
	// only, held in a ref so re-renders as conflicts resolve cannot yank the page
	// around mid-edit. Effects do not run during SSR; the `document` guard covers
	// the rest.
	const scrollTarget = useRef(
		review === "ingestion" ? firstUnresolvedOn(conflicts, "listing") : null,
	);
	useEffect(() => {
		const fieldKey = scrollTarget.current;
		if (!fieldKey || typeof document === "undefined") return;
		document
			.getElementById(conflictRowId(fieldKey))
			?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, []);

	const save = () => {
		// `listing` is the route's reactive store record, not a draft snapshot — so
		// the patch keeps the Deal page's financials exactly as stored, even if they
		// moved while this form was open. See savePatches.ts.
		updateDeal(listing.id, listingSavePatch(listing, { marketing, internalNotes, rentRoll }));
		updateProperty(property.id, propertyDraft);
		setDirty(false);
		notify({ title: "Listing saved" });
	};

	const saveBar = (
		<>
			{dirty && <span className="text-muted me-auto">Unsaved changes</span>}
			<Button variant="primary" disabled={!dirty} onClick={save}>
				Save
			</Button>
		</>
	);

	return (
		<IngestionConflictProvider
			conflicts={conflicts}
			onResolve={(fieldKey, side) =>
				resolveIngestionConflict(listing.id, fieldKey, side)
			}
		>
			<div className="d-flex flex-column gap-6 p-4">
				<PendingPublishBanner listing={listing} />

				<ListingPageHeader
					title="Listing"
					actions={
						<>
							{conflictCount > 0 && (
								<Badge variant="outline" className="ingestion-conflict__badge">
									{conflictCount}
								</Badge>
							)}
							{saveBar}
						</>
					}
				/>

				<ListingFormEditor
					dealType={listing.dealType}
					status={listing.status}
					marketing={marketing}
					patchMarketing={patchMarketing}
					property={propertyDraft}
					patchProperty={patchProperty}
					rentRoll={rentRoll}
					setRentRoll={setRentRoll}
					internalNotes={internalNotes}
					setInternalNotes={patchInternalNotes}
				/>

				<div className="d-flex justify-content-end align-items-center gap-2 border-top pt-4">
					{saveBar}
				</div>
			</div>
		</IngestionConflictProvider>
	);
}
```

Note `listing.dealType` and `listing.status` are read straight off the record rather than held as draft state — the Deal page is the only place they are set.

- [ ] **Step 2: Write the route**

Create `src/routes/_shell/listings/$listingId/listing.tsx`, mirroring `edit.tsx`'s reactive-selector convention:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { ListingEditor } from "#/components/listings/edit/ListingEditor";

export const Route = createFileRoute("/_shell/listings/$listingId/listing")({
  /** `?review=ingestion` arrives from the document-ingestion banner when the
   * first unresolved conflict is one this page owns. */
  validateSearch: (
    search: Record<string, unknown>,
  ): { review?: "ingestion" } => ({
    review: search.review === "ingestion" ? "ingestion" : undefined,
  }),
  component: ListingRoute,
});

function ListingRoute() {
  const { listingId } = Route.useParams();
  const { review } = Route.useSearch();
  // Reactive selectors (not getStore()) so resolving an ingestion conflict —
  // which patches the listing mid-edit — clears that arbitration row and counts
  // the badge down immediately. The editor's drafts are seeded from these as
  // initial state only, so a re-render never discards unsaved edits.
  const listing = useDataStore((s) => s.listings.get(listingId));
  const property = useDataStore((s) =>
    s.properties.get(listing?.propertyId ?? ""),
  );

  if (!listing || !property) return null;

  return <ListingEditor listing={listing} property={property} review={review} />;
}
```

- [ ] **Step 3: Regenerate the route tree**

Run: `bun --bun run build`
Expected: build succeeds and `src/routeTree.gen.ts` now contains the `listing` route. Do not hand-edit that file. (`vite build` does not type-check — Step 4 is the type gate.)

- [ ] **Step 4: Type-check and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, full suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/ListingEditor.tsx 'src/routes/_shell/listings/$listingId/listing.tsx' src/routeTree.gen.ts
git commit -m "feat(listings): give the listing form its own Marketing page"
```

---

### Task 7: The Deal page

`/edit` keeps its route and its pencil-icon entry, loses its tab bar and its listing half, and becomes the deal form alone. Its Save/Cancel behavior is unchanged — both still return to Overview, and Cancel still clears the pending publish, because leaving this page really does mean abandoning the publish flow. It gains a save toast.

**Files:**
- Create: `src/components/deals/edit/DealEditor.tsx`
- Modify: `src/routes/_shell/listings/$listingId/edit.tsx` (point at `DealEditor`)
- Delete: `src/components/deals/DealMarketingEditor.tsx`
- Modify: `src/components/deals/dealCardLink.invariant.test.ts` (allowlist)

**Interfaces:**
- Consumes: `dealSavePatch`, `DealDraft` (Task 1); `conflictKeysOn`, `firstUnresolvedOn` (Task 2); `BrokerEditor`, `DealFinancialsSection`, `PendingPublishBanner`, `reseedDraft` (Task 5).
- Produces: `DealEditor({ listing, review })`. Note it no longer takes `property` — the property draft went to the Listing page.

- [ ] **Step 1: Write `DealEditor`**

Create `src/components/deals/edit/DealEditor.tsx` from what is left of `DealMarketingEditor` after Task 5: the draft state for the six deal keys, the bi-directional sale-price/commission setters, Setup & Status, both `BrokerEditor`s, Transaction Terms, and `DealFinancialsSection`. Keep the tab indentation and every existing comment on the moved code. The changes from the old file:

- Drop `propertyDraft` / `patchProperty` / `updateProperty`, `marketing` / `patchMarketing`, `internalNotes` / `setInternalNotes`, the `Tabs` block, the `tab` state, `CONFLICT_TAB`, `conflictKeysOn` (the local one), and the `ListingFormEditor` render.
- `dealType` stays a `useState` with no setter and a read-only `Input`, as today.
- Title becomes `Edit Deal`; use `ListingPageHeader` for it (`import { ListingPageHeader } from "#/components/listings/ListingPageHeader"`) so it matches the sibling pages, with the conflict badge and the action buttons in `actions`.
- Save becomes:

```tsx
	const save = () => {
		updateDeal(
			listing.id,
			dealSavePatch(listing, {
				status,
				dealType,
				internalBrokers,
				outsideBrokers,
				transaction,
				financials,
			}),
		);
		notify({ title: "Deal saved" });
		back();
	};
```

- The re-seed effect keeps only the two drafts this page owns:

```tsx
	useEffect(() => {
		const previous = previousIngestionStatus.current;
		previousIngestionStatus.current = ingestionStatus;
		if (previous !== "processing" || ingestionStatus === "processing") return;
		const base = mountedListing.current;
		setTransaction((d) => reseedDraft(d, base.transaction, listing.transaction));
		setFinancials((d) => reseedDraft(d, base.financials, listing.financials));
	}, [ingestionStatus, listing]);
```

- **Add a second re-seed effect, for a stage-gate commit.** This page renders
  `PendingPublishBanner`, whose "Review & publish" opens the gate as a modal — so the
  gate can commit while this form is still mounted, and `commitStageTransition` writes
  three of the six keys this page owns: `status` (the target stage), `transaction`
  (`closeProbability`, `nextCriticalDate`, plus every field the gate captured), and
  `financials` (`src/data/actions.ts:177-202`). Without this, Save afterwards reverts
  the publish. Key-exclusion is the wrong tool here — unlike the Listing page's
  `marketing`, these three ARE this page's to own — so re-seed instead, on the same
  "only keys untouched since mount" rule:

```tsx
	// The gate always appends a history entry, so a change in its length is the
	// signal that a commit landed — including a publish-in-place, where the status
	// does not move. Only untouched keys are re-seeded, so a broker who already
	// changed Status or a Transaction field keeps their edit.
	//
	// Its own base ref, advanced on every fire — NOT the mount snapshot the
	// ingestion effect uses. The stage picker sits in the page header above this
	// form, so a broker can commit twice without leaving; against a frozen mount
	// base, the first commit moves the draft off its mount value and every later
	// commit is then rejected as "the broker touched this", reverting a live stage
	// change on the next Save. The ingestion effect is immune only because its
	// transition out of `processing` happens once per lifecycle.
	const historyLength = listing.history.length;
	const previousHistoryLength = useRef(historyLength);
	const gateBase = useRef(listing);
	useEffect(() => {
		const previous = previousHistoryLength.current;
		previousHistoryLength.current = historyLength;
		if (historyLength === previous) return;
		const base = gateBase.current;
		gateBase.current = listing;
		setStatus((d) => (d === base.status ? listing.status : d));
		setTransaction((d) => reseedDraft(d, base.transaction, listing.transaction));
		setFinancials((d) => reseedDraft(d, base.financials, listing.financials));
	}, [historyLength, listing]);
```

  `status` is a scalar, so it gets the identity comparison inline rather than
  `reseedDraft`, which iterates an object's keys.

- The conflict count and scroll target use `"deal"`:

```tsx
	const conflicts = listing.ingestion?.conflicts ?? [];
	const conflictCount = countConflictsFor(conflicts, conflictKeysOn("deal"));
	const scrollTarget = useRef(
		review === "ingestion" ? firstUnresolvedOn(conflicts, "deal") : null,
	);
```

- The body keeps its `shape !== "shell"` guard around Transaction Terms and Financials, and the `isSale` guard around `<DealFinancialsSection />`, exactly as today.
- `back()`, the `actions` bar (Cancel ghost + Save primary, Cancel calling `useStageGate.getState().clearPendingPublish()` first), and the bottom `border-top` action row all stay as they are.

- [ ] **Step 2: Point the route at it**

In `src/routes/_shell/listings/$listingId/edit.tsx`, swap the import and the render. `property` is no longer needed, so drop that selector and the guard on it:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealEditor } from "#/components/deals/edit/DealEditor";

export const Route = createFileRoute("/_shell/listings/$listingId/edit")({
  /** `?review=ingestion` arrives from the document-ingestion banner when the
   * first unresolved conflict is one this page owns. */
  validateSearch: (
    search: Record<string, unknown>,
  ): { review?: "ingestion" } => ({
    review: search.review === "ingestion" ? "ingestion" : undefined,
  }),
  component: EditRoute,
});

function EditRoute() {
  const { listingId } = Route.useParams();
  const { review } = Route.useSearch();
  // Reactive (not getStore()) so resolving an ingestion conflict — which patches
  // the listing mid-edit — clears that arbitration row and counts the badge down
  // immediately. The editor's drafts are seeded from this as initial state only.
  const listing = useDataStore((s) => s.listings.get(listingId));

  if (!listing) return null;

  return <DealEditor listing={listing} review={review} />;
}
```

- [ ] **Step 3: Delete the old editor and fix the allowlist**

```bash
git rm src/components/deals/DealMarketingEditor.tsx
```

In `src/components/deals/dealCardLink.invariant.test.ts`, replace the `DealMarketingEditor` entry in `ALLOWED` with the new file. That test has an assertion ("has no allowlist entry that has stopped needing one") that fails on a stale key, so this is not optional:

```ts
  "src/components/deals/edit/DealEditor.tsx": "the open deal's own edit form, back to its overview",
```

- [ ] **Step 4: Type-check and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors; full suite passes, including both `dealCardLink.invariant` assertions.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/deals src/routes/_shell/listings
git commit -m "feat(deals): reduce the edit form to the deal fields alone"
```

---

### Task 8: Rewire the inbound links

Three places sent brokers to the old two-tab form. Two of them now have to choose a page.

**Files:**
- Modify: `src/components/deals/IngestionBanner.tsx:66-79` (the "Review fields" link)
- Modify: `src/components/deals/StageGate.tsx:588-603` (the "Back to editing" navigate)
- Modify: `src/components/deals/dealCardLink.invariant.test.ts` (the `StageGate` reason string)

**Interfaces:**
- Consumes: `ingestionReviewTarget` (Task 2), the `listing` route (Task 6).

- [ ] **Step 1: Route the ingestion banner per field**

In `src/components/deals/IngestionBanner.tsx`, import the helper and branch the link target. Both branches keep `search={{ review: "ingestion" }}`:

```tsx
import { ingestionReviewTarget } from "#/components/deals/ingestionRouting";
```

Inside the `needs-review` branch, above the returned JSX:

```tsx
    // Whichever page holds the first field the broker has not settled — the
    // conflicts are split across the two edit pages now.
    const target =
      ingestionReviewTarget(ingestion.conflicts) === "deal"
        ? "/listings/$listingId/edit"
        : "/listings/$listingId/listing";
```

and render:

```tsx
              <Link
                to={target}
                params={{ listingId: listing.id }}
                search={{ review: "ingestion" }}
              />
```

- [ ] **Step 2: Send the publish gate to the Listing page**

In `src/components/deals/StageGate.tsx`, the non-space branch of the "Back to editing" navigate becomes the Listing page — publish gaps are listing content (photos, description, required marketing fields), so that is the page the broker wants. Update the comment to say so:

```tsx
                // A space's terms live on its building's roster, not on an edit
                // form. Everything else goes to the listing form: what the publish
                // gate flags is marketing content, which lives there now, not on
                // the deal form.
                void navigate(
                  deal.parentDealId
                    ? {
                        to: "/listings/$listingId/spaces",
                        params: { listingId: deal.parentDealId },
                        search: { space: deal.id },
                      }
                    : {
                        to: "/listings/$listingId/listing",
                        params: { listingId: deal.id },
                      },
                );
```

- [ ] **Step 3: Correct the invariant test's reason string**

In `src/components/deals/dealCardLink.invariant.test.ts`, the `StageGate` entry and the comment above it still describe the old destination. The key stays; the prose changes:

```ts
  // Pattern C — a space's terms moved to the roster, so the publish gate's
  // "Back to editing" branches on `parentDealId` instead of assuming a page.
  "src/components/deals/StageGate.tsx": "publish gate branches space → roster, deal → /listing",
```

- [ ] **Step 4: Type-check and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, full suite passes. TanStack's typed `to` is the check that both route strings exist — a typo fails tsc.

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/IngestionBanner.tsx src/components/deals/StageGate.tsx src/components/deals/dealCardLink.invariant.test.ts
git commit -m "feat(deals): point the ingestion and publish entry points at the split pages"
```

---

### Task 9: Verification pass

Playwright is off-limits in this repo, so the visual confirmation is Joel's. Everything mechanical gets checked here first.

**Files:** none — this task only runs things.

- [ ] **Step 1: Full type check**

Run: `bunx tsc --noEmit`
Expected: no errors and no warnings. Warnings count — scan the output, do not just check the exit code.

- [ ] **Step 2: Full test suite**

Run: `bun --bun run test`
Expected: all pass. Known non-gates: a biome complaint, and one react/module line on Vitest's stderr.

- [ ] **Step 3: Production build**

Run: `bun --bun run build`
Expected: succeeds, and `git status` shows `src/routeTree.gen.ts` either unchanged or already committed in Task 6.

- [ ] **Step 4: Confirm no orphans**

```bash
grep -rn "DealMarketingEditor\|CONFLICT_TAB" src --include='*.ts' --include='*.tsx'
```

Expected: no output. Any hit is a stale reference to the retired editor.

- [ ] **Step 5: Hand the visual checks to Joel**

Start the dev server (`bun --bun run dev`, http://localhost:3000) and ask Joel to confirm, on a deal with spaces and a deal without:

1. Sidebar → Marketing leads with **Listing**; it opens the form.
2. Save is disabled until a field changes, then commits, shows the "Listing saved" toast, and stays on the page. No Cancel button.
3. Header pencil opens **Edit Deal** — Setup & Status, Brokers, Transaction Terms, Financials, no tab bar, no listing fields. Save toasts and returns to Overview; Cancel returns without saving.
4. Editing the rent roll on the Listing page and saving leaves the Deal page's Asking Price / NOI intact, and vice versa.
5. On a deal with an ingestion run in `needs-review`: "Review fields" lands on the page holding the first unresolved conflict, scrolled to it, with the count badge in that page's header.
6. Publish gate → "Back to editing" lands on Marketing → Listing with the "Finish up, then publish" banner, and "Review & publish" reopens the gate.

---

## Notes for the implementer

- **Why `savePatches` is a pure module and not two inline save handlers:** the rule it encodes ("who owns `financials.rentRoll`") is invisible at both call sites and only breaks in a sequence — save one page, then the other. A pure function is the only part of this that can be tested without rendering, and it is the part most likely to regress.
- **Why Task 5 is a separate commit:** moving 500 lines and changing behavior in one commit makes the review useless. Task 5 must be behavior-identical; if the app looks different after it, something was dropped in the move.
- **The Listing nav item is live from Task 3 but 404s until Task 6.** If you are running the tasks out of order, do 3 and 6 together.
