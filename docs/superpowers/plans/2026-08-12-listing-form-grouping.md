# Listing Form Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `/listings/:id/listing` from 14 flat sections into ~5 spaced, clearly-grouped sections — using spacing and field width rather than type size — and delete the Transit and Visual Media sections.

**Architecture:** A new `FieldGroup` / `SubGroup` / `AdditionalFields` primitive trio plus a scoped `listing-form` stylesheet supplies the rhythm (72px between groups, 40px between subgroups, 16px between fields). Each existing `sections/*.tsx` file stops rendering its own `<Section>` heading and instead emits labeled `<SubGroup>` blocks; `ListingFormEditor` composes them into top-level `FieldGroup`s. Which groups render for a given deal moves out of inline JSX conditionals into a pure, tested `listingFormGroups.ts`, mirroring the existing `dealNav.ts` / `visibleNavGroups` pattern.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Blueprint React (`@buildoutinc/blueprint-react`) · Bootstrap 5 utilities · SCSS · Vitest · FontAwesome Pro

## Global Constraints

- **Do not change the type scale.** It stays 24px deal name / 20px page title / 17px section (`fs-large`) / 14px field label, all weight 600. Hierarchy comes from spacing and field width only. Raising a section heading to 20px collides with the page title.
- **Do not modify `Section` in `src/components/listings/listingWidgets.tsx`.** `DealEditor.tsx` and `DealFinancialsSection.tsx` import it. New components go in a new file.
- **No type changes, no `SEED_VERSION` move.** `Listing`, `Property`, and `DealMarketing` are untouched. Removal is presentational; `savePatches.ts` already preserves stored keys a draft does not carry.
- **`Occupancy %` must never sit inside a collapsed `AdditionalFields`.** It is the page's only ingestion-conflict field (`fieldKey="occupancyPct"`, the sole `"listing"` entry in `CONFLICT_PAGE`), and `?review=ingestion` scrolls to it via `document.getElementById(conflictRowId(...))`. An element inside a closed Blueprint `Collapsible` is not in the DOM, so the scroll target would not resolve.
- **Keep these fields.** Lots/Condos `Status`, `Close Date`, `Sale Price`, `Buyer / Referral Source` (per-record, `types.ts:66`/`:84`, PRD §13/§14) and Sale `Commission %` / Lease `Commission Split %` (`marketing.saleCommissionPct` / `marketing.leaseCommissionSplitPct` — published co-broke commission, edited nowhere else). See the spec's "rejected on inspection" section.
- **Preserve gating.** `propertyTypeEffects(property.propertyType)` and `showBuyerSection(dealType, status)` from `src/data/listingFormLogic.ts` keep driving what renders.
- **Preserve draft machinery.** `ListingEditor`'s `dirty` tracking, `useBlocker` guard, and ingestion re-seed effect are not touched. All work happens in `ListingFormEditor` and below.
- **`LeaseSection` imports from `SpaceTermsSection`** — do not break that import; `SpaceDetails.tsx` is a separate surface and is out of scope.
- **Gates:** `bunx tsc --noEmit` (note: `vite build` does *not* type-check) and `bun --bun run test`. Biome output and a `react`/module Vitest stderr line are known non-gates.
- **No committed E2E suite.** Do not add `@playwright/test` or `playwright.config.ts`. Browser checks are interactive, via the `playwright` MCP server.

---

## File Structure

**Create:**
- `src/components/listings/edit/listingFormGroups.ts` — pure "which groups render" logic
- `src/components/listings/edit/listingFormGroups.test.ts` — Vitest for the above
- `src/components/listings/edit/FieldGroup.tsx` — `FieldGroup`, `SubGroup`, `AdditionalFields`
- `src/components/listings/edit/listingForm.scss` — scoped spacing/width rhythm

**Modify:**
- `src/components/listings/edit/ListingFormEditor.tsx` — compose 5 groups, drop 13 `<Separator />`
- `src/components/listings/edit/fieldWidgets.tsx` — `Col` gains a `span` prop
- All 12 surviving `src/components/listings/edit/sections/*.tsx` — drop own `<Section>`, emit `<SubGroup>`

**Delete:**
- `src/components/listings/edit/sections/TransitSection.tsx`
- `src/components/listings/edit/sections/VisualMediaSection.tsx`

---

### Task 1: `listingFormGroups.ts` — which groups render

Pure logic, extracted from `ListingFormEditor`'s inline conditionals so the rules are testable without rendering a form. Mirrors `src/components/properties/dealNav.ts` (`visibleNavGroups`), which has a sibling `dealNav.test.ts` — follow that shape.

**Files:**
- Create: `src/components/listings/edit/listingFormGroups.ts`
- Test: `src/components/listings/edit/listingFormGroups.test.ts`

**Interfaces:**
- Consumes: `propertyTypeEffects`, `showBuyerSection` from `#/data/listingFormLogic`; `DealType`, `PropertyStatus`, `PropertyType` from `#/data/types`
- Produces: `type ListingGroupId`, `type ListingGroup`, `visibleListingGroups(opts): ListingGroup[]`, `showsLandSubgroup(propertyType): boolean`. Task 8 imports `visibleListingGroups`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/listings/edit/listingFormGroups.test.ts
import { describe, expect, it } from "vitest";
import { visibleListingGroups } from "#/components/listings/edit/listingFormGroups";

const ids = (o: Parameters<typeof visibleListingGroups>[0]) =>
  visibleListingGroups(o).map((g) => g.id);

describe("visibleListingGroups", () => {
  it("always shows location, asset, units, marketing, and notes", () => {
    expect(ids({ dealType: "Lease", propertyType: "Office", status: "Active" }))
      .toEqual(["location", "asset", "units", "marketing", "notes"]);
  });

  it("adds condos for a Sale but never for a Lease", () => {
    expect(ids({ dealType: "Sale", propertyType: "Office", status: "Active" }))
      .toContain("condos");
    expect(ids({ dealType: "Lease", propertyType: "Office", status: "Active" }))
      .not.toContain("condos");
  });

  it("adds lots only for a land property type", () => {
    expect(ids({ dealType: "Sale", propertyType: "Land", status: "Active" }))
      .toContain("lots");
    expect(ids({ dealType: "Sale", propertyType: "Office", status: "Active" }))
      .not.toContain("lots");
  });

  it("orders groups location → asset → units → lots → condos → marketing → notes", () => {
    expect(ids({ dealType: "Sale", propertyType: "Land", status: "Active" })).toEqual([
      "location", "asset", "units", "lots", "condos", "marketing", "notes",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test -- listingFormGroups`
Expected: FAIL — cannot resolve `#/components/listings/edit/listingFormGroups`.

- [ ] **Step 3: Confirm the real `PropertyType` land values before implementing**

Run: `grep -n "PropertyType\b" src/data/types.ts | head -3` then read that union, and
`grep -n "landSections" src/data/listingFormLogic.ts`.

Use whatever land value(s) `propertyTypeEffects(...).landSections` is true for. If
the union's land member is not literally `"Land"`, fix the test's `propertyType`
values in Step 1 to match — the test asserts behavior, not a guessed spelling.

- [ ] **Step 4: Write the implementation**

```ts
// src/components/listings/edit/listingFormGroups.ts
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faLocationDot,
  faBuilding,
  faTableCells,
  faMap,
  faLayerGroup,
  faBullhorn,
  faNoteSticky,
} from "@fortawesome/pro-regular-svg-icons";
import { propertyTypeEffects } from "#/data/listingFormLogic";
import type { DealType, PropertyStatus, PropertyType } from "#/data/types";

export type ListingGroupId =
  | "location" | "asset" | "units" | "lots" | "condos" | "marketing" | "notes";

export type ListingGroup = {
  id: ListingGroupId;
  label: string;
  icon: IconDefinition;
};

/** Every group the Listing form can show, in display order. */
const ALL_GROUPS: ListingGroup[] = [
  { id: "location", label: "Location", icon: faLocationDot },
  { id: "asset", label: "The Asset", icon: faBuilding },
  { id: "units", label: "Units", icon: faTableCells },
  { id: "lots", label: "Lots", icon: faMap },
  { id: "condos", label: "Condos", icon: faLayerGroup },
  { id: "marketing", label: "Marketing", icon: faBullhorn },
  { id: "notes", label: "Disclaimer & Notes", icon: faNoteSticky },
];

/** Whether the Land subgroup renders inside The Asset. */
export function showsLandSubgroup(propertyType: PropertyType): boolean {
  return propertyTypeEffects(propertyType).landSections;
}

/**
 * The groups this listing actually shows. Lives beside the group list so a rule
 * and the group it governs cannot drift apart, and so the rules are testable
 * without rendering a form — the same split `visibleNavGroups` uses in
 * `properties/dealNav.ts`.
 *
 * `units` is unconditional, matching the previous form: `UnitsSection` renders
 * its own Include/Syndicate switches whether or not a unit mix exists, so
 * gating it here would remove the only way to turn one on.
 */
export function visibleListingGroups(opts: {
  dealType: DealType;
  propertyType: PropertyType;
  status: PropertyStatus;
}): ListingGroup[] {
  return ALL_GROUPS.filter((group) => {
    if (group.id === "lots") return showsLandSubgroup(opts.propertyType);
    if (group.id === "condos") return opts.dealType === "Sale";
    return true;
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun --bun run test -- listingFormGroups`
Expected: PASS, 4 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
bunx tsc --noEmit
git add src/components/listings/edit/listingFormGroups.ts src/components/listings/edit/listingFormGroups.test.ts
git commit -m "feat(listing-form): extract which-groups-render into tested pure logic"
```

---

### Task 2: Layout primitives and scoped stylesheet

The rhythm the whole restructure depends on. No section consumes it yet, so the page is unchanged after this task — that is expected.

**Files:**
- Create: `src/components/listings/edit/FieldGroup.tsx`
- Create: `src/components/listings/edit/listingForm.scss`
- Modify: `src/components/listings/edit/fieldWidgets.tsx` (the `Col` at the bottom)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `<FieldGroup title icon>`, `<SubGroup label?>`, `<AdditionalFields label>`, and `<Col span?>`. Tasks 4–8 consume all four.

- [ ] **Step 1: Write the stylesheet**

```scss
// src/components/listings/edit/listingForm.scss
//
// The Listing form's spacing rhythm. The type scale is deliberately untouched
// (24/20/17/14, all weight 600) — raising a section heading to 20px would
// collide with the page title, and there is no gap between 17px and 14px for a
// subsection tier. Hierarchy is carried by space instead:
//
//   group → group      72px
//   subgroup → subgroup 40px
//   field → field       16px  (Bootstrap `g-3`, unchanged)
//
// The defect this replaces: subgroup spacing used to equal field spacing (both
// 16px), so the ~30 authored FieldGrid clusters rendered as one column.
//
// Scoped under `.listing-form` so no other form in the app is affected.
.listing-form {
  &__group + &__group {
    margin-top: 4.5rem; // 72px
  }

  &__group-title {
    margin-bottom: 1.5rem;
  }

  &__subgroup + &__subgroup {
    margin-top: 2.5rem; // 40px
  }

  // A label, not a heading — it sits below the 14px field label in the scale so
  // it cannot compete with the 17px group title above it.
  &__subgroup-label {
    margin-bottom: 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  // The disclosure toggle. Deliberately not a heading: it used to be an <h3>,
  // the same level as the group titles it sat among.
  &__more {
    margin-top: 2.5rem;
  }

  &__more-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    border: 0;
    background: none;
    font-size: 0.875rem;
    font-weight: 500;
  }

  &__more-chevron {
    transition: transform 0.15s ease;
  }

  &__more-toggle[data-panel-open] &__more-chevron,
  &__more-toggle[aria-expanded="true"] &__more-chevron {
    transform: rotate(90deg);
  }

  &__more-body {
    margin-top: 1.5rem;
  }
}
```

- [ ] **Step 2: Write the primitives**

`Collapsible` is the same Blueprint component `ReorderableAccordion.tsx` already uses in this folder — follow its import path exactly.

```tsx
// src/components/listings/edit/FieldGroup.tsx
import type { ReactNode } from "react";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import "#/components/listings/edit/listingForm.scss";

/**
 * One top-level group on the Listing form — Location, The Asset, Marketing.
 *
 * Deliberately NOT the `Section` in `listingWidgets.tsx`: that one is shared
 * with the Deal editor, and this needs its own spacing rhythm without changing
 * how the Deal editor looks. The heading keeps `fs-large` (17px) — the scale is
 * full at 24/20/17/14 and 20px would collide with the page title, so the 72px
 * gap between groups does the separating instead of a size bump.
 */
export function FieldGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: IconDefinition;
  children: ReactNode;
}) {
  return (
    <section className="listing-form__group">
      <h3 className="listing-form__group-title fs-large fw-semibold mb-0 d-flex align-items-center gap-2">
        {icon && <FontAwesomeIcon icon={icon} className="text-primary" />}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

/**
 * One labeled cluster of related fields inside a group.
 *
 * These clusters already existed as separate `<FieldGrid>` blocks — roughly 30
 * of them across the form — but consecutive grids were separated by the same
 * 16px that separates two fields, so the grouping never rendered. This draws it.
 *
 * `label` is optional: a group with a single cluster needs the spacing but not a
 * redundant restatement of the group title.
 */
export function SubGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="listing-form__subgroup">
      {label && (
        <div className="listing-form__subgroup-label text-muted">{label}</div>
      )}
      {children}
    </div>
  );
}

/**
 * The long-tail disclosure at the end of a group.
 *
 * Replaces the old `<Accordion>` whose trigger was an `<h3>` reading
 * "Show/Hide Additional Fields" — the same heading level as the group titles it
 * competed with, and the same 14px/600 as the field labels it sat between. This
 * is a muted ghost toggle named for its contents.
 *
 * Never put an ingestion-conflict field in here: a closed `Collapsible` keeps
 * its content out of the DOM, so `?review=ingestion`'s `getElementById` scroll
 * target would not resolve.
 */
export function AdditionalFields({
  label,
  children,
}: {
  /** Names the contents, e.g. "Show 14 more building fields". */
  label: string;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={false} className="listing-form__more">
      <Collapsible.Trigger className="listing-form__more-toggle text-muted">
        <FontAwesomeIcon
          icon={faChevronRight}
          className="listing-form__more-chevron"
        />
        {label}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="listing-form__more-body">{children}</div>
      </Collapsible.Content>
    </Collapsible>
  );
}
```

- [ ] **Step 3: Give `Col` a width**

Replace the `Col` at the bottom of `src/components/listings/edit/fieldWidgets.tsx`
(currently `return <div className="col-md-6">{children}</div>`) with:

```tsx
/**
 * One cell in a `FieldGrid`. `span` is Bootstrap's 12-column scale at the `md`
 * breakpoint; it defaults to 6 so every existing caller is unchanged.
 *
 * Widths are what let related short fields share a row — City / State / Zip on
 * one line rather than three half-width rows — which chunks the form visually
 * without any type change. Bootstrap ships every `col-md-*` class, so building
 * the name at runtime is safe here (this is not Tailwind; nothing is purged).
 */
export function Col({
  children,
  span = 6,
}: {
  children: React.ReactNode;
  span?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12;
}) {
  return <div className={`col-md-${span}`}>{children}</div>;
}
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: clean. `Col`'s new prop is optional, so no call site breaks.

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/FieldGroup.tsx src/components/listings/edit/listingForm.scss src/components/listings/edit/fieldWidgets.tsx
git commit -m "feat(listing-form): add FieldGroup/SubGroup primitives and spacing rhythm"
```

---

### Task 3: Delete the Transit and Visual Media sections

**Files:**
- Delete: `src/components/listings/edit/sections/TransitSection.tsx`
- Delete: `src/components/listings/edit/sections/VisualMediaSection.tsx`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: nothing — pure removal.

- [ ] **Step 1: Confirm nothing else imports them**

Run: `grep -rn "TransitSection\|VisualMediaSection" src`
Expected: only `ListingFormEditor.tsx` and the two files themselves. If anything
else appears, stop and report it rather than deleting.

- [ ] **Step 2: Delete the files and their usage**

```bash
git rm src/components/listings/edit/sections/TransitSection.tsx
git rm src/components/listings/edit/sections/VisualMediaSection.tsx
```

In `ListingFormEditor.tsx` remove both imports, the `<TransitSection />` line and
the `<Separator />` above it, and the `<VisualMediaSection ... />` block together
with its preceding `<Separator />` and the comment above it ("Unscoped here by
construction: only a non-space shape reaches this branch…").

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/listings/edit/
git commit -m "refactor(listing-form): delete the Transit and Visual Media sections

Transit rendered a hardcoded array of four fake transit lines, identical on
every listing, with no editable state — a read-only fiction inside an edit
form. Visual Media edited marketing.visualMedia through three raw fields;
Marketing → Media already owns that same array through VisualMediaGallery,
with a real gallery UI."
```

---

### Task 4: Strip per-section headings and compose five groups

The structural pivot. Each section stops owning a heading; `ListingFormEditor`
owns them. After this task the page renders 5 group titles with the existing
field content beneath them, unlabeled inside — subgroup labels and widths land in
Tasks 5–8.

**Files:**
- Modify: all 12 files in `src/components/listings/edit/sections/`
- Modify: `src/components/listings/edit/ListingFormEditor.tsx`

**Interfaces:**
- Consumes: `FieldGroup` (Task 2), `visibleListingGroups` (Task 1)
- Produces: every section component now returns a fragment with no heading; Tasks 5–8 fill them with `SubGroup`s.

- [ ] **Step 1: Strip the `<Section>` wrapper from each section file**

For each of the 12 surviving files in `sections/`, replace the outer
`<Section title="…" icon={…}>…</Section>` with a `<>…</>` fragment, and delete
the now-unused `Section` and icon imports. Add a one-line doc comment noting the
component emits subgroups and its caller owns the heading.

Worked example — `BuyerSection.tsx` before:

```tsx
return (
  <Section title="Buyer" icon={faUser}>
    <TextField label="Buyer" … />
    <TextField label="Referral Source" … />
  </Section>
);
```

after:

```tsx
// Emits subgroups only — `ListingFormEditor` owns the group heading.
return (
  <>
    <TextField label="Buyer" … />
    <TextField label="Referral Source" … />
  </>
);
```

Leave each file's internal `<FieldGrid>` / `<Accordion>` structure alone for now.

- [ ] **Step 2: Recompose `ListingFormEditor`**

Replace the body of the returned `<div>` with the five groups below. Note there
is **no `<Separator />` anywhere** — all 13 are gone; the 72px group gap replaces
them. The wrapper gains `listing-form` (which scopes the stylesheet) and drops
`gap-6` (spacing now comes from the stylesheet, not a utility class).

```tsx
const effects = propertyTypeEffects(property.propertyType);
const groups = visibleListingGroups({
  dealType,
  propertyType: property.propertyType,
  status,
});
const groupById = (id: ListingGroupId) => groups.find((g) => g.id === id);

const location = groupById("location");
const asset = groupById("asset");
const units = groupById("units");
const lots = groupById("lots");
const condos = groupById("condos");
const marketingGroup = groupById("marketing"); // not `marketing` — that prop is the draft
const notes = groupById("notes");

return (
  <div className="listing-form">
    {location && (
      <FieldGroup title={location.label} icon={location.icon}>
        <LocationSection
          property={property}
          patchProperty={patchProperty}
          marketing={marketing}
          patchMarketing={patchMarketing}
        />
      </FieldGroup>
    )}

    {asset && (
      <FieldGroup title={asset.label} icon={asset.icon}>
        <PropertySection property={property} patchProperty={patchProperty} />
        <BuildingSection property={property} patchProperty={patchProperty} />
        {effects.landSections && (
          <LandSection property={property} patchProperty={patchProperty} />
        )}
      </FieldGroup>
    )}

    {units && (
      <FieldGroup title={units.label} icon={units.icon}>
        <UnitsSection
          property={property}
          patchProperty={patchProperty}
          marketing={marketing}
          patchMarketing={patchMarketing}
          rentRoll={rentRoll}
          setRentRoll={setRentRoll}
        />
      </FieldGroup>
    )}

    {lots && (
      <FieldGroup title={lots.label} icon={lots.icon}>
        <LotsSection property={property} patchProperty={patchProperty} />
      </FieldGroup>
    )}

    {condos && (
      <FieldGroup title={condos.label} icon={condos.icon}>
        <CondosSection property={property} patchProperty={patchProperty} />
      </FieldGroup>
    )}

    {marketingGroup && (
      <FieldGroup title={marketingGroup.label} icon={marketingGroup.icon}>
        {dealType === "Sale" ? (
          <SaleSection marketing={marketing} patchMarketing={patchMarketing} />
        ) : (
          <LeaseSection marketing={marketing} patchMarketing={patchMarketing} />
        )}
        <MarketingVisibilitySection
          dealType={dealType}
          status={status}
          marketing={marketing}
          patchMarketing={patchMarketing}
        />
        {showBuyerSection(dealType, status) && (
          <BuyerSection
            dealType={dealType}
            status={status}
            marketing={marketing}
            patchMarketing={patchMarketing}
          />
        )}
      </FieldGroup>
    )}

    {notes && (
      <FieldGroup title={notes.label} icon={notes.icon}>
        <DisclaimerNotesSection
          marketing={marketing}
          patchMarketing={patchMarketing}
          internalNotes={internalNotes}
          setInternalNotes={setInternalNotes}
        />
      </FieldGroup>
    )}
  </div>
);
```

Delete the now-unused `Separator` import.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Verify in the browser**

Follow the CLAUDE.md Playwright rules: never `waitUntil: "networkidle"` (Vite's
HMR socket never idles), scope selectors to `main.app-shell__main` (TanStack
devtools inject their own DOM), and `browser_close` when done.

1. `browser_navigate` to `/listings`, then `browser_wait_for` text `"Displaying"`.
2. Open a Sale listing's `/listing` page; `browser_wait_for` text `"Disclaimer"`.
3. Confirm exactly the expected group titles render and no field content is lost.
4. `browser_console_messages` — expect no errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/listings/edit/
git commit -m "refactor(listing-form): compose 12 sections into five groups

Sections no longer own their heading — ListingFormEditor does — and all 13
Separators are gone. A rule between every pair of items tiles the page rather
than grouping it; the 72px gap between groups separates them instead."
```

---

### Task 5: Location subgroups and widths

**Files:**
- Modify: `src/components/listings/edit/sections/LocationSection.tsx`

**Interfaces:**
- Consumes: `SubGroup`, `AdditionalFields` (Task 2), `Col` with `span` (Task 2)
- Produces: nothing consumed downstream.

- [ ] **Step 1: Wrap the existing clusters in `SubGroup`s**

The clusters already exist as separate `<FieldGrid>` blocks. Wrap each and give
it a label. Exact mapping — the field list identifies each cluster unambiguously:

| SubGroup label | Fields (in order) |
| --- | --- |
| `Address` | Address · City · State · Zip · Hide Address · Display Address As |
| `Map` | Override Map Location · Latitude · Longitude |
| `Market` | County · Market · Submarket · Cross Streets · Location Description · Display Location Description for Syndication |

Move the two switches (`Hide Address`, `Override Map Location`) so each sits at
the **end** of its subgroup rather than between grid rows. `Hide Address` and
`Display Address As` join Address; `Override Map Location` leads Map.

- [ ] **Step 2: Move the locale cluster into the disclosure**

The first `<FieldGrid>` — Country · Measurement System · Country Name Override ·
Currency · Currency Format · Language — currently opens the page: six locale
settings ahead of the street address. Move that whole grid inside the
disclosure, so Address is the first thing on the form.

Replace the existing `<Accordion>` with:

```tsx
<AdditionalFields label="Show 16 more location fields">
  <SubGroup label="Locale">{/* the six locale fields */}</SubGroup>
  <SubGroup label="Legal & Frontage">
    {/* Township · Range · Section · Side of Street · Street Parking ·
        Signal Intersection · Road Type · Market Type · Nearest Highway ·
        Nearest Airport */}
  </SubGroup>
</AdditionalFields>
```

- [ ] **Step 3: Apply field widths**

```tsx
<FieldGrid>
  <Col span={6}><TextField label="Address" … /></Col>
  <Col span={3}><TextField label="City" … /></Col>
  <Col span={3}>{/* State */}</Col>
</FieldGrid>
```

Then: Zip on its own row at `span={3}`, or promote City to `span={2}` and keep
all four on one row — pick whichever holds without wrapping at the `md`
breakpoint when you check it in the browser. Latitude / Longitude become
`span={3}` each. `Location Description` (a textarea) becomes `span={12}`.

- [ ] **Step 4: Typecheck and verify**

Run: `bunx tsc --noEmit`, then reload the page in the browser and confirm
Location leads with Address, the subgroup labels read as labels rather than
headings, and nothing wraps awkwardly at a narrow window width
(`browser_resize` to 1024 wide).

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/sections/LocationSection.tsx
git commit -m "refactor(listing-form): draw Location's subgroups and set field widths

Also demotes the six locale fields (Country, Measurement System, Currency,
Currency Format, Language, Country Name Override) into the disclosure. They
were the first six fields on the page, ahead of the street address."
```

---

### Task 6: The Asset subgroups and widths

The largest group — Property (23 fields), Building (38), Land (15).

**Files:**
- Modify: `sections/PropertySection.tsx`, `sections/BuildingSection.tsx`, `sections/LandSection.tsx`

**Interfaces:**
- Consumes: `SubGroup`, `AdditionalFields`, `Col span` (Task 2)
- Produces: nothing consumed downstream.

- [ ] **Step 1: `PropertySection` subgroups**

| SubGroup label | Fields |
| --- | --- |
| `Identity` | Primary Property Type · Primary Property Subtype · Property Type Label Override · Property Name · Alias |
| `Parcel` | Zoning · APN# · Lot Size Unit |

The existing type/subtype repeater rows (`Type`, `Subtype`, `Remove type`) stay
where they are inside Identity, unchanged.

Its disclosure becomes:

```tsx
<AdditionalFields label="Show 12 more property fields">
  <SubGroup label="Site">
    {/* Lot Frontage · Lot Depth · Corner Property · Traffic Count ·
        Site Description · Amenities · Waterfront */}
  </SubGroup>
  <SubGroup label="Records & Utilities">
    {/* MLS ID# · Thomas Guide Page # · Power Description · Rail Access ·
        Gas/Propane Description */}
  </SubGroup>
</AdditionalFields>
```

- [ ] **Step 2: `BuildingSection` subgroups**

| SubGroup label | Fields |
| --- | --- |
| `Size & Age` | Building Size · **Occupancy %** · Year Built · Year Renovated |
| `Structure` | Number of Floors · Average Floor Size · Ceiling Height · Min Ceiling Height · Office Space |
| `Class & Tenancy` | Building Class · Tenancy · Retail Clientele |
| `Loading` | Grade Level Doors · Dock High Doors · Drive-in Bays · Number of Cranes · Dock Description · Crane Description · Sprinkler Description |

**`Occupancy %` stays in `Size & Age`, outside the disclosure** — it is the
page's only ingestion-conflict field and `?review=ingestion` must be able to
scroll to it. Do not move it.

Its disclosure becomes:

```tsx
<AdditionalFields label="Show 19 more building fields">
  <SubGroup label="Measurements">
    {/* Overhead Door Height · Column Space · Gross Leasable Area · Load Factor */}
  </SubGroup>
  <SubGroup label="Parking & Construction">
    {/* Construction Status · Parking Ratio · Parking Type · Warehouse % ·
        Construction Description · Parking Description */}
  </SubGroup>
  <SubGroup label="Systems & Condition">
    {/* Condition · Number of Elevators · Roof · Freight Elevator ·
        Central HVAC · Free Standing · LEED Certified ·
        Utilities Description · Loading Description */}
  </SubGroup>
</AdditionalFields>
```

- [ ] **Step 3: `LandSection` subgroups**

| SubGroup label | Fields |
| --- | --- |
| `Land` | Number of Lots · Best Use |

Its disclosure:

```tsx
<AdditionalFields label="Show 13 more land fields">
  <SubGroup label="Utilities">
    {/* Irrigation · Irrigation Description · Water · Water Description ·
        Telephone · Telephone Description · Cable · Cable Description · Sewer */}
  </SubGroup>
  <SubGroup label="Site Conditions">
    {/* Environmental Issues · Topography · Soil Type · Easements Description */}
  </SubGroup>
</AdditionalFields>
```

- [ ] **Step 4: Apply field widths**

Short numeric fields go narrow and share rows — this is what makes a cluster read
as a group without a label:

- `Grade Level Doors` · `Dock High Doors` · `Drive-in Bays` · `Number of Cranes` → `span={3}` each, one row.
- `Year Built` · `Year Renovated` → `span={3}`; `Building Size` · `Occupancy %` → `span={3}`. All four on one row.
- `Ceiling Height` · `Min Ceiling Height` · `Number of Floors` · `Average Floor Size` → `span={3}`.
- `Office Space` → `span={3}` (it currently orphans a half-column).
- Every description/textarea (`Site Description`, `Construction Description`, `Parking Description`, `Utilities Description`, `Loading Description`, `Easements Description`) → `span={12}`.

- [ ] **Step 5: Typecheck and verify**

Run: `bunx tsc --noEmit`. In the browser, load an **Office** Sale listing and a
**Land** Sale listing; confirm the Land subgroup appears only on the latter and
that Occupancy % is visible without expanding anything.

- [ ] **Step 6: Commit**

```bash
git add src/components/listings/edit/sections/PropertySection.tsx src/components/listings/edit/sections/BuildingSection.tsx src/components/listings/edit/sections/LandSection.tsx
git commit -m "refactor(listing-form): draw The Asset's subgroups and set field widths

Occupancy % deliberately stays in Size & Age, outside the disclosure: it is
the page's only ingestion-conflict field, and a closed Collapsible keeps its
content out of the DOM, so ?review=ingestion could not scroll to it."
```

---

### Task 7: Marketing subgroups and widths

**Files:**
- Modify: `sections/SaleSection.tsx`, `sections/LeaseSection.tsx`, `sections/MarketingVisibilitySection.tsx`, `sections/BuyerSection.tsx`

**Interfaces:**
- Consumes: `SubGroup`, `AdditionalFields`, `Col span` (Task 2)
- Produces: nothing consumed downstream.

- [ ] **Step 1: `SaleSection` subgroups**

| SubGroup label | Fields |
| --- | --- |
| `Headline` | Sale Title · Sale Description · Sale Bullets |
| `Terms` | Property Use · Investment Type · Sale Terms · Reimbursement · Sale Closing Info · Includes real estate |
| `Lease & Commission` | Years Left on Lease · NNN Lease Expiration · **Commission %** · Tax per Unit |
| `Auction` | Auction · Auction Date · Auction Time · Auction Location · Auction Starting Bid · Auction URL |

`Commission %` stays — see Global Constraints.

Its disclosure:

```tsx
<AdditionalFields label="Show 10 more sale fields">
  <SubGroup label="Financing">
    {/* Capital Costs · Loan Due Date · Loan Description */}
  </SubGroup>
  <SubGroup label="Taxes & Assessment">
    {/* Taxes · Tax Value - Land · Tax Value - Improvements ·
        Tax Value - Personal · Assessed Value */}
  </SubGroup>
  <SubGroup label="Exchange & Ownership">
    {/* 1031 Exchange · Consider Exchange · Land Ownership ·
        Land Legal Description */}
  </SubGroup>
</AdditionalFields>
```

- [ ] **Step 2: `LeaseSection` subgroups**

| SubGroup label | Fields |
| --- | --- |
| `Headline` | Lease Title · Lease Description · Lease Bullets |
| `Terms` | Commission Split % · Available SF Term · Lease Closing Information |

Do not touch its import from `SpaceTermsSection` — `SpaceDetails.tsx` depends on
that module and is out of scope.

- [ ] **Step 3: Visibility and Buyer**

Both are tiny (1 field and 2 fields). Wrap each in a single `<SubGroup>` —
`Visibility` and `Buyer` respectively — so they read as clusters of the
Marketing group rather than as former sections that lost their heading.

- [ ] **Step 4: Apply field widths**

- `Tax Value - Land` · `Tax Value - Improvements` · `Tax Value - Personal` → `span={4}`, one row.
- `Auction Date` · `Auction Time` → `span={3}`; `Auction Starting Bid` → `span={3}`.
- `Auction Location` · `Auction URL` → `span={6}`.
- `Sale Description` / `Lease Description` / `Sale Terms` / `Land Legal Description` → `span={12}`.

- [ ] **Step 5: Typecheck and verify**

Run: `bunx tsc --noEmit`. In the browser check a Sale listing and a Lease
listing — the Marketing group must show the Sale variant on one and the Lease
variant on the other, never both.

- [ ] **Step 6: Commit**

```bash
git add src/components/listings/edit/sections/SaleSection.tsx src/components/listings/edit/sections/LeaseSection.tsx src/components/listings/edit/sections/MarketingVisibilitySection.tsx src/components/listings/edit/sections/BuyerSection.tsx
git commit -m "refactor(listing-form): draw Marketing's subgroups and set field widths"
```

---

### Task 8: Units, Lots, Condos, and Notes subgroups

**Files:**
- Modify: `sections/UnitsSection.tsx`, `sections/LotsSection.tsx`, `sections/CondosSection.tsx`, `sections/DisclaimerNotesSection.tsx`

**Interfaces:**
- Consumes: `SubGroup`, `Col span` (Task 2)
- Produces: nothing consumed downstream.

- [ ] **Step 1: `UnitsSection`**

| SubGroup label | Fields |
| --- | --- |
| `Unit Mix` | Include Unit Mix · Syndicate Unit Mix + the unit-mix rows |
| `Rent Roll` | Include Rent Roll · Syndicate Rent Roll + the rent-roll rows |

- [ ] **Step 2: `LotsSection` and `CondosSection`**

These render repeating per-record cards through `ReorderableAccordion` /
`CollapsibleCard`. Do **not** add subgroup labels inside each card — the cards
are already visually bounded, and a label per card would repeat N times.

Wrap each section's card list in a single unlabeled `<SubGroup>` for the spacing,
and apply widths **inside** the card body:

- Lots: `Status` · `Close Date` · `Buyer / Referral Source` → `span={4}` each, one row. `Lot Number` · `APN` · `Subtype` → `span={4}`. `Sale Price` · `Price Units` · `Size` · `Size Units` → `span={3}`. `Description` → `span={12}`.
- Condos: `Status` · `Close Date` → `span={6}`. `Sale Price` · `Price Units` · `Size` · `Size Units` → `span={3}`. `Description` → `span={12}`.

Keep every one of these fields — see Global Constraints.

- [ ] **Step 3: `DisclaimerNotesSection`**

| SubGroup label | Fields |
| --- | --- |
| `Disclaimer` | Override Disclaimer · Custom Disclaimer |
| `Internal` | Internal Notes · Admin Notes |

All four are textareas → `span={12}`.

- [ ] **Step 4: Typecheck and verify**

Run: `bunx tsc --noEmit`. In the browser, expand a lot card and a condo card and
confirm the per-record fields still render and still save.

- [ ] **Step 5: Commit**

```bash
git add src/components/listings/edit/sections/UnitsSection.tsx src/components/listings/edit/sections/LotsSection.tsx src/components/listings/edit/sections/CondosSection.tsx src/components/listings/edit/sections/DisclaimerNotesSection.tsx
git commit -m "refactor(listing-form): draw Units, Lots, Condos, and Notes subgroups"
```

---

### Task 9: Full verification pass

**Files:** none modified unless a defect is found.

**Interfaces:**
- Consumes: everything above
- Produces: a verified branch ready for `/ship`.

- [ ] **Step 1: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: tsc clean; all tests pass, including the pre-existing `savePatches` and
`reseedDraft` suites and the new `listingFormGroups` suite. `vite build` is not a
typecheck — do not substitute it. Ignore Biome output and the known `react`
module Vitest stderr line.

- [ ] **Step 2: Verify each deal shape in the browser**

For each of a **Sale (Office)**, a **Lease**, and a **Sale (Land)** listing:
navigate to `/listings/<id>/listing`, `browser_wait_for` on text unique to that
page (`"Disclaimer"`), then confirm the expected groups render, expand each
`AdditionalFields` toggle, and check `browser_console_messages` for errors.

Land must show the Lots group and the Land subgroup; Office must show neither.
Lease must show the Lease headline and no Condos group.

- [ ] **Step 3: Verify the ingestion path still works**

This is the constraint most at risk. Find a listing with an unresolved
`occupancyPct` conflict, navigate to
`/listings/<id>/listing?review=ingestion`, and confirm the page scrolls to the
Occupancy % arbitration row and that Use/Keep resolve it and count the badge
down. If the scroll does not land, `Occupancy %` has been moved inside a
collapsed `AdditionalFields` — move it back into `Size & Age`.

- [ ] **Step 4: Verify save and the unsaved-changes guard**

Edit a field in each of two different groups, confirm the footer reads "Unsaved
changes" and Save enables, click Save, and confirm the toast appears and the
value persists across a reload. Then make an edit and click a sidebar item —
the "Leave without saving?" dialog must still appear.

- [ ] **Step 5: Close the browser**

`browser_close`. It does not exit on its own — leaving it running orphans ~8
Chrome processes and a temp profile. Leave the MCP server itself running.

- [ ] **Step 6: Delete the spec and plan, then ship**

Per CLAUDE.md, a spec is in-flight only. Move anything worth keeping that is not
already in a commit body into the PR description first — chiefly the two
withdrawn removals and why.

```bash
git rm docs/superpowers/specs/2026-08-12-listing-form-grouping-design.md
git rm docs/superpowers/plans/2026-08-12-listing-form-grouping.md
git commit -m "chore(docs): remove the shipped listing-form grouping spec and plan"
```

Then run `/ship`. Do not merge.
