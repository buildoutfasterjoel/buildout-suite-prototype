# Deal Form Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Deal edit form (`/listings/:id/edit`) the Listing form's group/cluster hierarchy, and move the shared form shell into a neutral home so the two forms stop depending on each other by accident.

**Architecture:** The shell (`FieldGroup`/`SubGroup`/`AdditionalFields`, `fieldWidgets`, `EditableTable`, and the shell SCSS) moves to `src/components/common/recordForm/` with the BEM prefix renamed `listing-form__` → `record-form__`. `DealEditor` then swaps its three `Section`s for `FieldGroup`s and distributes its 21 fields into 11 clusters. Presentation only — no data-model, route, or state-logic change.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-08-14-deal-form-grouping-design.md` — read it first; it carries the four decisions and their rejected alternatives.

**Branch:** `joel/deal-form-grouping` (already created, spec committed at `e5e9713`).

## Global Constraints

- **Package manager is Bun**, always `bun --bun run <script>`.
- **Gates:** `bunx tsc --noEmit` must be clean. `vite build` does **not** type-check — it is not a gate. `bun --bun run test` must stay at **940 passing**. A `react` / `module is not defined` line on Vitest's stderr is a known non-gate; ignore it.
- **This repo has zero component tests** (120 `.test.ts`, 0 `.test.tsx`). Do **not** add `@testing-library/*` or a component-test harness. Per CLAUDE.md: logic goes in Vitest, UI is verified interactively in the browser. TDD therefore applies to Tasks 3 and 5 (pure logic) and the remaining tasks are gated on `tsc` + Playwright verification.
- **Do not add a committed E2E suite** (`@playwright/test`, `playwright.config.ts`). Use the `playwright` MCP server interactively.
- **Playwright gotchas:** never `waitUntil: "networkidle"` (HMR hangs it); scope selectors to `main.app-shell__main` (devtools inject DOM); after `browser_navigate` always `browser_wait_for` on text unique to the destination; always `browser_close` when done.
- **No `fixedWidth` on `FontAwesomeIcon`** — deprecated.
- **No margin utilities on Badge icons** — Blueprint's Badge already has flex gap.
- **Icons:** `@fortawesome/pro-regular-svg-icons` by default.
- **Blueprint's CSS var prefix is `--bp-`**, not `--bs-`. Use `tokens.*` SCSS variables, never raw values.
- **Match each file's existing indentation.** `deals/edit/*` uses tabs; `listings/edit/*` uses 2 spaces. Biome output is not a gate.
- **Never place an ingestion-conflict field inside `AdditionalFields`** — Blueprint's `Collapsible` keeps closed content mounted at `display:none`, so `scrollIntoView` becomes a silent no-op.

---

## File Structure

**Created:**
- `src/components/common/recordForm/FieldGroup.tsx` — `FieldGroup`, `SubGroup`, `AdditionalFields` (moved from `listings/edit/`)
- `src/components/common/recordForm/fieldWidgets.tsx` — all field widgets (moved), plus `Readout` and `ReadOnlyField`
- `src/components/common/recordForm/EditableTable.tsx` — `EditableTable`, `Column`, `ColKind` (extracted from `UnitsSection`)
- `src/components/common/recordForm/recordForm.scss` — shell rules, prefix renamed
- `src/components/deals/edit/dealFormGroups.ts` — group list + visibility rule
- `src/components/deals/edit/dealFormGroups.test.ts` — its test
- `src/components/deals/edit/calcFormat.ts` — `formatCalcAmount` / `formatCalcPercent` (extracted from `DealFinancialsSection`)
- `src/components/deals/edit/calcFormat.test.ts` — its test

**Modified:**
- `src/components/listings/edit/listingForm.scss` — trimmed to the 3 listing-only rules
- `src/components/listings/edit/sections/UnitsSection.tsx` — consumes shared `EditableTable`
- 15 files importing `FieldGroup` / `fieldWidgets` — import paths only
- `src/components/deals/edit/DealEditor.tsx` — groups and clusters
- `src/components/deals/edit/DealFinancialsSection.tsx` — clusters, readouts
- `src/components/deals/edit/BrokerEditor.tsx` — stacked flex rows
- `src/components/deals/edit/LineItemEditor.tsx` — `EditableTable`
- `src/components/deals/edit/ScenarioEditor.tsx` — one card per scenario
- `CLAUDE.md` — two conventions

**Deleted:** `src/components/listings/edit/FieldGroup.tsx`, `src/components/listings/edit/fieldWidgets.tsx`

---

### Task 1: Move the shell to `common/recordForm/`

Pure relocation and rename. Nothing should look different afterward — that is the test.

**Files:**
- Create: `src/components/common/recordForm/FieldGroup.tsx`, `src/components/common/recordForm/fieldWidgets.tsx`, `src/components/common/recordForm/recordForm.scss`
- Delete: `src/components/listings/edit/FieldGroup.tsx`, `src/components/listings/edit/fieldWidgets.tsx`
- Modify: `src/components/listings/edit/listingForm.scss`, `CLAUDE.md`, and the 18 importers listed in Step 3

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `#/components/common/recordForm/FieldGroup` exporting `FieldGroup`, `SubGroup`, `AdditionalFields`; `#/components/common/recordForm/fieldWidgets` exporting `TextField`, `NumberField`, `DateField`, `SelectField`, `ComboField`, `YesNoNaField`, `SwitchRow`, `FieldGrid`, `Col`, `BulletsField`, `DATE_FORMAT`, `parseDate`, `toISODate`, `YES_NO_NA_OPTIONS`. All signatures unchanged from their current definitions.

- [ ] **Step 1: Move the two component files with git, preserving history**

```bash
mkdir -p src/components/common/recordForm
git mv src/components/listings/edit/FieldGroup.tsx src/components/common/recordForm/FieldGroup.tsx
git mv src/components/listings/edit/fieldWidgets.tsx src/components/common/recordForm/fieldWidgets.tsx
```

- [ ] **Step 2: Create `recordForm.scss` with the shell rules only**

Create `src/components/common/recordForm/recordForm.scss`. Copy these blocks out of `listings/edit/listingForm.scss` verbatim except for the prefix, keeping every explanatory comment — they record why each value is what it is:

- `&__subgroup-label`, `&__subgroup-desc`
- `&__grid-table`
- `&__more-toggle`, `&__more-chevron`, `&__more-toggle[data-panel-open] &__more-chevron`, `&__more-body`

Keep both `@use` lines. The file header should read:

```scss
// src/components/common/recordForm/recordForm.scss
//
// Structure for the app's LONG record forms — the Listing form and the Deal
// form. Hierarchy is drawn, not spaced: an earlier pass carried all four tiers
// on whitespace alone and the form still read as one wall, because every cluster
// looked identical no matter how far apart it sat. Each tier has its own device:
//
//   group     an icon + 17px title over a stack of tiles
//   cluster   a name in a left gutter, fields right, each cluster its own tile
//   bound     8px  — a control and the field it reveals (`gap-2`, in the TSX)
//   peer      16px — fields sharing a FieldGrid (`g-4`, in the TSX)
//
// NOT for short forms. Modals, filter flyouts, and anything under roughly six
// fields keep plain stacked Blueprint `Field`s: the 164px gutter and the tile
// stack earn their cost across twenty-plus fields and lose money on four.
//
// Every value resolves to a Blueprint token — `tokens.*` for spacing, type, and
// borders, `motion.*` for the disclosure (same precedent as editor.scss).
//
// Rules are flat `.record-form__x` class selectors, not descendants: `&__x`
// inside `.record-form` compiles to a single class, and there is no
// `.record-form` wrapper element anywhere. Containment comes from the prefix.
```

- [ ] **Step 3: Repoint every import and rename the 8 class usages**

`FieldGroup.tsx` — change its SCSS import to `./recordForm.scss` and rename its 7 class strings (`listing-form__subgroup`, `__subgroup-label`, `__subgroup-desc`, `__more`, `__more-toggle`, `__more-chevron`, `__more-body`) to the `record-form__` prefix.

`UnitsSection.tsx:99` — rename `listing-form__grid-table` → `record-form__grid-table`.

Then repoint imports in these 18 files, replacing `#/components/listings/edit/FieldGroup` with `#/components/common/recordForm/FieldGroup` and `#/components/listings/edit/fieldWidgets` with `#/components/common/recordForm/fieldWidgets`. (17 import `fieldWidgets`; `ListingFormEditor` imports only `FieldGroup`.)

```
src/components/listings/edit/ListingFormEditor.tsx
src/components/listings/edit/sections/BuildingSection.tsx
src/components/listings/edit/sections/BuyerSection.tsx
src/components/listings/edit/sections/CondosSection.tsx
src/components/listings/edit/sections/DisclaimerNotesSection.tsx
src/components/listings/edit/sections/LandSection.tsx
src/components/listings/edit/sections/LeaseSection.tsx
src/components/listings/edit/sections/LocationSection.tsx
src/components/listings/edit/sections/LotsSection.tsx
src/components/listings/edit/sections/MarketingVisibilitySection.tsx
src/components/listings/edit/sections/PropertySection.tsx
src/components/listings/edit/sections/SaleSection.tsx
src/components/listings/edit/sections/SpaceTermsSection.tsx
src/components/listings/edit/sections/UnitsSection.tsx
src/components/deals/edit/BrokerEditor.tsx
src/components/deals/edit/DealEditor.tsx
src/components/deals/edit/DealFinancialsSection.tsx
src/components/deals/edit/ScenarioEditor.tsx
```

Verify none are left behind:

```bash
grep -rn "listings/edit/fieldWidgets\|listings/edit/FieldGroup" src
```

Expected: no output.

- [ ] **Step 4: Trim `listingForm.scss` to the listing-only rules**

Leave exactly three blocks under `.listing-form`, with their comments intact: `&__coord-map`, `&__channel-card` (and its `--selected` / `:focus-within` nesting), `&__channel-icon` (and its `--selected`). Delete everything now living in `recordForm.scss`. Replace the file header with:

```scss
// src/components/listings/edit/listingForm.scss
//
// Listing-form-only rules. The shared record-form shell — groups, clusters, the
// disclosure, the editable-grid floor — lives in
// src/components/common/recordForm/recordForm.scss and is used by the Deal form
// too. What stays here is what only the Listing form has: the coordinate
// picker's map and the marketing-channel cards.
```

`listingForm.scss` is imported by `FieldGroup.tsx` today. That import moves with the file, so add the import to the two components that now need it — `CoordinatePickerMap.tsx` and `MarketingVisibilitySection.tsx`:

```tsx
import "#/components/listings/edit/listingForm.scss";
```

- [ ] **Step 5: Delete the dead commented-out `TextField` body**

In `src/components/common/recordForm/fieldWidgets.tsx`, delete the commented-out block after `TextField`'s unconditional `return` (was `fieldWidgets.tsx:71-92` before the move). It is unreachable duplicate code.

- [ ] **Step 6: Add the scope guardrail to `FieldGroup.tsx`**

Prepend this module header above the existing imports:

```tsx
/**
 * The record-form shell: groups, clusters, and the long-tail disclosure.
 *
 * For the app's two LONG record forms only — the Listing form
 * (`/listings/:id/listing`) and the Deal form (`/listings/:id/edit`).
 *
 * Do NOT reach for this in a short form. Modals, filter flyouts, and anything
 * under roughly six fields keep plain stacked Blueprint `Field`s: the 164px
 * label gutter and the tile stack pay for themselves across twenty-plus fields
 * and cost more than they return on four.
 */
```

- [ ] **Step 7: Record both conventions in CLAUDE.md**

Append to the **Design System** section, after the Bootstrap-utilities paragraph:

```markdown
### Record forms

Long record forms — the Listing form and the Deal form — are built from the
shared shell in `src/components/common/recordForm/`: a **group** (icon + title
over a stack of tiles), a **cluster** (`SubGroup` — name in a left gutter,
fields right, its own tile), and two spacing tiers, *bound* (8px, a control and
the field it reveals) and *peer* (16px, fields sharing a `FieldGrid`).

Two rules:

1. **The shell is for long forms only.** Modals, filter flyouts, and anything
   under roughly six fields use plain stacked Blueprint `Field`s. The 164px
   label gutter and the tile stack earn their cost across twenty-plus fields and
   lose money on four.
2. **A repeater becomes a table only when it is read down a column** — many
   rows, values compared downward (Unit Mix, Rent Roll, income/expense line
   items). Field count per row is *not* the test: `AdditionalTypesEditor` has
   two fields per row and stays stacked flex, because at two rows there is
   nothing to compare and a header row costs more than it returns. Single-field
   repeaters (Sale Bullets, Alias) take one label for the whole set.
```

- [ ] **Step 8: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: `tsc` silent (exit 0); 120 files / 940 tests passing.

- [ ] **Step 9: Verify the Listing form is pixel-unchanged**

Start the dev server (`bun --bun run dev`), then with the Playwright MCP server: navigate to `/listings`, wait for text `Displaying`, grab a listing id, navigate to `/listings/<id>/listing`, wait for text `Marketing`, and screenshot. The form must render exactly as before this task — group titles, gutter labels, tiles, marketing channel cards, and the coordinate picker map all intact. Check `browser_console_messages` for new errors (one pre-existing `GlobalNavbar.tsx:172` hydration mismatch at narrow widths is expected and out of scope). `browser_close` when finished.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(forms): promote the record-form shell out of listings/edit

FieldGroup, fieldWidgets, and the shell SCSS move to
src/components/common/recordForm/, and the BEM prefix becomes record-form__.
Both long record forms now import one shell from one place.

The Deal form has imported fieldWidgets from listings/edit/ all along, which
is how #146's label-gutter redesign reached a page nobody was reviewing. A
neutral home makes the sharing deliberate and the class names honest.

listingForm.scss keeps the three rules only the Listing form has — the
coordinate picker's map and the marketing-channel cards. Its import moves to
the two components that use them.

Also documents the guardrail in CLAUDE.md: this shell is for long forms only,
and a repeater becomes a table only when it is read down a column. Both live
in CLAUDE.md rather than only in the spec, which is deleted on ship."
```

---

### Task 2: Promote `EditableTable` into the shell

`UnitsSection` has a generic editable table the Deal form's line items need. Move it out rather than write a second one.

**Files:**
- Create: `src/components/common/recordForm/EditableTable.tsx`
- Modify: `src/components/listings/edit/sections/UnitsSection.tsx`

**Interfaces:**
- Consumes: `record-form__grid-table` from Task 1's `recordForm.scss`
- Produces:
  ```ts
  export type ColKind = "text" | "number" | "date"
  export type Column<T> = { key: keyof T; label: string; kind: ColKind }
  export function EditableTable<T extends { id: string }>(props: {
    columns: Column<T>[]
    rows: T[]
    onEdit: (id: string, patch: Partial<T>) => void
    onAdd: () => void
    onRemove: (id: string) => void
    addLabel: string
    emptyLabel: string
    /** Rendered as a table footer row spanning the value columns. */
    footer?: ReactNode
  }): JSX.Element
  ```

- [ ] **Step 1: Create the shared module**

Create `src/components/common/recordForm/EditableTable.tsx`. Move `ColKind`, `Column<T>`, and the `EditableTable` function body from `UnitsSection.tsx:24-26` and `:76-181` verbatim — keep the comment at `:95-98` explaining `dense` and `.table-container`. Export all three. Add the `footer` prop, rendered between `Table.Body` and the add button:

```tsx
{footer && (
  <Table.Footer>
    <Table.Row>
      <Table.Cell colSpan={columns.length + 1}>{footer}</Table.Cell>
    </Table.Row>
  </Table.Footer>
)}
```

Add this to the module's doc comment:

```tsx
/**
 * A repeatable grid of rows with add/remove — Unit Mix, Rent Roll, income and
 * expense line items.
 *
 * Reach for this only when the repeater is read DOWN a column: many rows whose
 * values get compared to each other. A repeater with a handful of rows does not
 * earn a header row — see `AdditionalTypesEditor` in PropertySection.tsx, which
 * carries two fields per row and stays stacked flex on purpose.
 */
```

- [ ] **Step 2: Point `UnitsSection` at the shared table**

Delete the local `ColKind`, `Column`, and `EditableTable` definitions from `UnitsSection.tsx` and import instead:

```tsx
import {
	type Column,
	EditableTable,
} from "#/components/common/recordForm/EditableTable";
```

Drop any imports that are now unused in `UnitsSection` (`Table`, and `faPlus`/`faTrashCan` if nothing else there uses them). `tsc` will not flag unused imports — check by hand.

- [ ] **Step 3: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean; 940 passing.

- [ ] **Step 4: Verify Unit Mix and Rent Roll still work**

In the browser, open a **multifamily** deal's Listing page (the 10-column Unit Mix set is the widest case — the seed has "Villas at Place" and "Villas at Lofts"). Confirm under the Units group: both Include toggles reveal their tables, the tables scroll horizontally inside their own container rather than pushing the page sideways, adding and removing a row works, and the Rent Roll size/rate/annual trio still auto-fills the third value. `browser_close` when done.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(forms): move EditableTable into the record-form shell

UnitsSection's generic editable grid becomes part of the shared shell so the
Deal form's line-item tables use it rather than a second implementation, and
gains an optional footer slot for a totals row.

Its doc comment carries the rule that decides when to use it: only when the
repeater is read down a column. AdditionalTypesEditor is the counter-example
worth naming — two fields per row, deliberately not a table."
```

---

### Task 3: Deal form group model

TDD — this is pure logic with real branching, so the test comes first.

**Files:**
- Create: `src/components/deals/edit/dealFormGroups.ts`, `src/components/deals/edit/dealFormGroups.test.ts`

**Interfaces:**
- Consumes: `DealShape` from `#/data/dealShape`
- Produces:
  ```ts
  export type DealGroupId = "setup" | "terms" | "financials"
  export type DealGroup = { id: DealGroupId; label: string; icon: IconDefinition }
  export function visibleDealGroups(shape: DealShape): DealGroup[]
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/deals/edit/dealFormGroups.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { visibleDealGroups } from "#/components/deals/edit/dealFormGroups";

const ids = (shape: Parameters<typeof visibleDealGroups>[0]) =>
  visibleDealGroups(shape).map((g) => g.id);

describe("visibleDealGroups", () => {
  it("shows every group for a sale", () => {
    expect(ids("sale")).toEqual(["setup", "terms", "financials"]);
  });

  it("drops financials for every lease shape", () => {
    expect(ids("flat-lease")).not.toContain("financials");
    expect(ids("space")).not.toContain("financials");
    expect(ids("shell")).not.toContain("financials");
  });

  it("drops terms for a shell, whose spaces carry the transactions", () => {
    expect(ids("shell")).toEqual(["setup"]);
  });

  it("keeps terms for a flat lease and a space", () => {
    expect(ids("flat-lease")).toEqual(["setup", "terms"]);
    expect(ids("space")).toEqual(["setup", "terms"]);
  });

  it("always leads with setup", () => {
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      expect(ids(shape)[0]).toBe("setup");
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
bun --bun run test dealFormGroups
```

Expected: FAIL — cannot resolve `#/components/deals/edit/dealFormGroups`.

- [ ] **Step 3: Write the implementation**

Create `src/components/deals/edit/dealFormGroups.ts`:

```ts
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
	faGear,
	faFileContract,
	faChartLine,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealShape } from "#/data/dealShape";

export type DealGroupId = "setup" | "terms" | "financials";

export type DealGroup = {
	id: DealGroupId;
	label: string;
	icon: IconDefinition;
};

/** Every group the Deal form can show, in display order. */
const ALL_GROUPS: DealGroup[] = [
	{ id: "setup", label: "Setup & Status", icon: faGear },
	{ id: "terms", label: "Transaction Terms", icon: faFileContract },
	{ id: "financials", label: "Financials", icon: faChartLine },
];

/**
 * The groups this deal actually shows. Lives beside the group list so a rule and
 * the group it governs cannot drift apart, and so the rules are testable without
 * rendering a form — the same split `visibleListingGroups` uses.
 *
 * `shape` alone decides both rules, which is why it is the only argument:
 * `dealShape` returns "sale" for exactly the listings whose `dealType` is not
 * "Lease", so the old `isSale = dealType !== "Lease"` test and `shape === "sale"`
 * select the same deals. A shell shows neither Terms nor Financials — its spaces
 * carry the transactions, so it has no price, no commission, and nothing to
 * close.
 */
export function visibleDealGroups(shape: DealShape): DealGroup[] {
	return ALL_GROUPS.filter((group) => {
		if (group.id === "terms") return shape !== "shell";
		if (group.id === "financials") return shape === "sale";
		return true;
	});
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
bun --bun run test dealFormGroups
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean; **945** passing (940 + 5).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(deal-form): model the three groups and their visibility

Mirrors listingFormGroups: the group list and the rule that hides groups live
together, so a rule and its group cannot drift, and both are testable without
rendering a form.

Takes DealShape alone rather than shape plus dealType. dealShape returns 'sale'
for exactly the listings whose dealType is not 'Lease', so the form's existing
isSale test and shape === 'sale' select the same deals — one argument, one
source of truth."
```

---

### Task 4: Responsive floor for the label gutter

The gutter is a hard 164px with no floor, so any narrow container clips its control. This is what collapsed the broker Split % input to 16px, and it clips `Property Use` to `O(` on the Listing form at a 900px viewport. Fixed once, in the shell, for both forms.

The floor must respond to the **container**, not the viewport: the failure happens at 900px wide, which is above the `md` breakpoint, because the container is a `col-md-4` inside a padded card. A media query cannot see that. A container query can.

**Files:**
- Modify: `src/components/common/recordForm/recordForm.scss`, `src/components/common/recordForm/fieldWidgets.tsx`

**Interfaces:**
- Consumes: Task 1's `recordForm.scss` and `fieldWidgets.tsx`
- Produces: CSS classes `record-form__field`, `record-form__gutter`, `record-form__control`. Every widget's public prop signature is unchanged.

- [ ] **Step 1: Add the gutter rules to `recordForm.scss`**

```scss
  // ── Label gutter ──────────────────────────────────────────────────────────
  // The gutter is a fixed measure so labels align down the whole form, but a
  // fixed measure with no floor is what collapsed a `col-md-4` broker row's
  // input to 16px: 164px of label inside a ~200px column leaves nothing for
  // the control.
  //
  // The floor is a CONTAINER query, not a media query. The failure happens at a
  // 900px viewport — above `md` — because the container is a narrow grid column
  // inside a padded tile, and a media query cannot see that. Each field is its
  // own inline-size container, so a field stacks when ITS OWN box is too narrow
  // for a gutter plus a usable control, wherever it sits.
  &__field {
    container-type: inline-size;
  }

  &__gutter {
    width: 164px;
  }

  // 22rem = 352px: the 164px gutter plus a ~140px control plus the addon's own
  // padding. Below that the pair stops fitting, so the gutter takes the full
  // width and the control wraps under it — the label ends up on top, which is
  // the layout this form used before the gutter and is still correct when there
  // is no room for a column of its own.
  @container (max-width: 22rem) {
    &__gutter {
      width: 100%;
    }
  }

  &__control {
    min-width: 7rem; // 112px — a number input's floor before digits clip
  }
```

Because `&__gutter` inside the `@container` block must still compile to `.record-form__gutter`, keep the `@container` block nested inside `.record-form` exactly as written above.

- [ ] **Step 2: Let the input group wrap**

Also inside `.record-form`, so a full-width gutter pushes the control to the next line instead of overflowing:

```scss
  // `flex-wrap` is what makes the container query's full-width gutter actually
  // stack: Bootstrap's `.input-group` is `flex-wrap: wrap` already, but the
  // addon and control both carry `flex: 1 1 auto` overrides in the theme, so
  // the wrap only takes effect once the gutter claims the whole line.
  &__field .input-group {
    flex-wrap: wrap;
  }
```

- [ ] **Step 3: Apply the classes in `fieldWidgets.tsx`**

In each of `TextField`, `NumberField`, `DateField`, `SelectField`, and `ComboField`:

- Add `className="record-form__field"` to the wrapping `<Field>`.
- Replace `style={{ width: 164 }}` on `InputGroup.Addon` with `className="record-form__gutter"`.
- Add `className="record-form__control"` to the `Input` / `Textarea` / `Select.Trigger` / `Combobox.Input`. Where one already has a class, append: `Select.Trigger` becomes `className="bg-card record-form__control"`, `Combobox.Input` becomes `className="flex-grow-0 record-form__control"`.

There are five `style={{ width: 164 }}` occurrences. Confirm none remain:

```bash
grep -rn "width: 164" src
```

Expected: no output.

- [ ] **Step 4: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean; 945 passing.

- [ ] **Step 5: Verify at a narrow viewport**

Dev server running, Playwright MCP: `browser_resize` to 900×900, open a **sale** deal's Listing page (`/listings/<id>/listing`), wait for text `Marketing`. Then measure every control:

```js
() => {
  const els = [...document.querySelectorAll('main.app-shell__main input, main.app-shell__main [role="combobox"]')];
  return JSON.stringify(
    els.map(e => ({ w: Math.round(e.getBoundingClientRect().width), v: (e.value || '').slice(0, 12) }))
       .filter(x => x.w > 0 && x.w < 100)
  );
}
```

Expected: `[]`. Before this task the same probe returns entries at 16px and 24px. Screenshot to confirm `Property Use` and `Investment Type` now show their full values instead of `O(` and `Va A`, and that stacked fields still read as label-over-control rather than overlapping. Re-check at 1440 wide that nothing regressed. `browser_close`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(forms): give the label gutter a floor so narrow containers stop clipping

The gutter was a hard 164px with nothing protecting the control beside it. In a
col-md-4 inside a padded tile that left a 16px input — the broker Split % field
held a value that could not be read or edited — and on the Listing form it
clipped Property Use to 'O(' at a 900px viewport.

The floor is a container query, not a media query, because the failure is a
function of the field's own box and not the viewport: 900px is above md, and the
squeeze comes from the grid column it sits in. Each field is now its own
inline-size container and stacks its label on top when it is too narrow to carry
a gutter plus a usable control.

Fixes both forms at once — same shell, same bug."
```

---

### Task 5: `Readout` and the calc formatters

The four computed figures stop pretending to be inputs. Formatters come out of `DealFinancialsSection` into a tested module first.

**Files:**
- Create: `src/components/deals/edit/calcFormat.ts`, `src/components/deals/edit/calcFormat.test.ts`
- Modify: `src/components/common/recordForm/fieldWidgets.tsx`, `src/components/common/recordForm/recordForm.scss`

**Interfaces:**
- Consumes: Task 4's `record-form__` classes
- Produces:
  ```ts
  // calcFormat.ts
  export function formatCalcAmount(v: number | null): string
  export function formatCalcPercent(v: number | null): string
  ```
  ```tsx
  // fieldWidgets.tsx
  export function Readout(props: { label: string; value: string }): JSX.Element
  export function ReadOnlyField(props: { label: string; value: string }): JSX.Element
  ```

- [ ] **Step 1: Write the failing formatter test**

Create `src/components/deals/edit/calcFormat.test.ts`. These cases pin the behavior the current inline helpers have — blank rather than zero for an absent value, which is what keeps an un-entered figure from reading as a real 0:

```ts
import { describe, expect, it } from "vitest";
import { formatCalcAmount, formatCalcPercent } from "#/components/deals/edit/calcFormat";

describe("formatCalcAmount", () => {
  it("is blank, not '0', when there is no value", () => {
    expect(formatCalcAmount(null)).toBe("");
  });

  it("rounds and groups thousands", () => {
    expect(formatCalcAmount(3412282.4)).toBe("3,412,282");
    expect(formatCalcAmount(170614.5)).toBe("170,615");
  });

  it("formats a real zero as 0", () => {
    expect(formatCalcAmount(0)).toBe("0");
  });
});

describe("formatCalcPercent", () => {
  it("is blank, not '0.00%', when there is no value", () => {
    expect(formatCalcPercent(null)).toBe("");
  });

  it("carries two decimals and a percent sign", () => {
    expect(formatCalcPercent(5.5)).toBe("5.50%");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
bun --bun run test calcFormat
```

Expected: FAIL — cannot resolve `#/components/deals/edit/calcFormat`.

- [ ] **Step 3: Create the module**

Create `src/components/deals/edit/calcFormat.ts`, moving both helpers out of `DealFinancialsSection.tsx:22-30` unchanged:

```ts
// ── Read-only computed-field display formatting ─────────────────────────────

/** Rounded, comma-formatted currency-ish figure; blank (not "0") when null. */
export function formatCalcAmount(v: number | null): string {
	return v == null ? "" : Math.round(v).toLocaleString();
}

/** Percentage with 2 decimals; blank (not "0.00") when null. */
export function formatCalcPercent(v: number | null): string {
	return v == null ? "" : `${v.toFixed(2)}%`;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
bun --bun run test calcFormat
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Add the `Readout` styles**

In `recordForm.scss`, inside `.record-form`:

```scss
  // ── Computed readout ──────────────────────────────────────────────────────
  // A derived figure, not a field. These used to render as read-only `Input`s
  // with a top label, which put a disabled-looking text box next to eleven live
  // ones and invited a broker to type in it.
  //
  // Indented by the gutter's width so figures line up under the controls whose
  // values produce them — the alignment is what ties a readout to its inputs.
  //
  // `min()` rather than a container query, deliberately. A readout is a SIBLING
  // of the fields it belongs to, not a descendant, so it cannot query the
  // `__field` container that Task 4 established — the query would resolve
  // against an ancestor with no `container-type` and never match, leaving the
  // indent permanently at 164px. Adding a second container on the cluster just
  // to make a query work buys less than this: 45% holds the alignment at normal
  // widths and gives way on its own when the cluster is too narrow to spare
  // 164px.
  &__readout {
    display: flex;
    justify-content: space-between;
    gap: tokens.$spacing-4;
    padding-left: min(164px, 45%);
  }
```

- [ ] **Step 6: Add `Readout` and `ReadOnlyField` to `fieldWidgets.tsx`**

```tsx
/**
 * A derived figure — the output of a calculation, not something to type into.
 *
 * Deliberately not a read-only `Input`: a disabled-looking text box beside a
 * column of live ones reads as a field that is merely switched off, and invites
 * a click. A label and a figure read as a result. Body-size bold rather than a
 * KPI tile, because these sit inside a form that already stacks many headings
 * and numbers.
 *
 * Renders nothing when `value` is blank, so an un-entered input does not leave a
 * dangling label with no figure beside it.
 */
export function Readout({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="record-form__readout">
      <span className="fs-small text-muted">{label}</span>
      <span className="fw-semibold">{value}</span>
    </div>
  );
}

/**
 * A field whose value is fixed — Deal Type, which a listing cannot change.
 *
 * Exists so a fixed value still sits in the gutter like every field around it.
 * Rendering it as a bare `Field` + readOnly `Input` is what left Deal Type as
 * the one top-labeled row in a form of gutter-labeled ones.
 */
export function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Field className="record-form__field">
      <InputGroup>
        <InputGroup.Addon asText className="record-form__gutter">
          <Field.Label>{label}</Field.Label>
        </InputGroup.Addon>
        <Input className="record-form__control" readOnly value={value} />
      </InputGroup>
    </Field>
  );
}
```

- [ ] **Step 7: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean; **950** passing (945 + 5).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(forms): add Readout and ReadOnlyField; extract the calc formatters

Readout renders a derived figure as a label and a number rather than a
read-only input. A disabled-looking text box beside eleven live ones reads as a
field that is merely switched off and invites a click; these are results. It is
indented by the gutter width so each figure lines up under the controls that
produce it, and the indent collapses when the gutter does.

ReadOnlyField gives a fixed value — Deal Type — the same gutter as its
neighbours instead of leaving it the one top-labeled row on the form.

The two calc formatters move out of DealFinancialsSection into a tested module.
Their real contract is that an absent value formats as blank rather than '0', so
an un-entered figure cannot read as a real zero; that is now pinned by tests."
```

---

### Task 6: Setup & Status group

**Files:**
- Modify: `src/components/deals/edit/DealEditor.tsx`, `src/components/deals/edit/BrokerEditor.tsx`

**Interfaces:**
- Consumes: `FieldGroup`/`SubGroup` (Task 1), `visibleDealGroups` (Task 3), `ReadOnlyField` (Task 5)
- Produces: `BrokerEditor` keeps its current props exactly — `{ title, brokers, side, onChange }` — so `DealEditor`'s two call sites are unchanged.

- [ ] **Step 1: Rewrite `BrokerEditor`'s rows as stacked flex**

Replace the `row g-2 align-items-end` grid (`BrokerEditor.tsx:47`) with the `AdditionalTypesEditor` pattern from `PropertySection.tsx:89-121`. The title and Add button move out — the cluster's gutter names the repeater now — so `title` is no longer rendered as a heading but still accepted and used as the empty-state noun.

```tsx
	return (
		<div className="d-flex flex-column gap-2">
			{brokers.length === 0 ? (
				<p className="text-muted mb-0">No {side} brokers on this deal.</p>
			) : (
				brokers.map((b) => (
					// Flex with `flexBasis: 0`, not a 7/4/1 grid. The grid gave Split %
					// a `col-md-4` — 164px of label gutter inside a ~200px column left a
					// 16px input holding a value nobody could read. Basis 0 is what
					// makes the two fields split evenly; `flex-grow-1` alone shares out
					// only the leftover space, so they would keep their unequal
					// intrinsic widths. The remove button hugs at the 8px bound tier
					// instead of being parked at the far edge of its own column.
					<div key={b.id} className="d-flex align-items-center gap-2">
						<div className="flex-grow-1" style={{ flexBasis: 0 }}>
							<TextField
								label="Name"
								value={b.name}
								onChange={(v) => update(b.id, { name: v })}
							/>
						</div>
						<div className="flex-grow-1" style={{ flexBasis: 0 }}>
							<NumberField
								label="Split %"
								value={b.commissionSplitPct}
								onChange={(v) => update(b.id, { commissionSplitPct: v ?? 0 })}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="flex-shrink-0"
							aria-label="Remove broker"
							onClick={() => onChange(brokers.filter((x) => x.id !== b.id))}
						>
							<FontAwesomeIcon icon={faTrashCan} />
						</Button>
					</div>
				))
			)}
			<div>
				<Button variant="ghost" size="sm" onClick={add}>
					<FontAwesomeIcon icon={faPlus} />
					Add broker
				</Button>
			</div>
		</div>
	);
```

Keep `update`, `add`, and the `crypto.randomUUID()` row shape exactly as they are.

- [ ] **Step 2: Swap the Setup section for a group of clusters**

In `DealEditor.tsx`, replace the `<Section title="Setup & Status" icon={faGear}>` block (`:304-352`) with a `FieldGroup` carrying four `SubGroup`s. Imports change: drop `Section`, `Field`, `Input`, `faGear`, `faFileContract`; add `FieldGroup`/`SubGroup`, `ReadOnlyField`, and `visibleDealGroups`.

**First, rename the financials state.** `DealEditor.tsx:94` holds
`const [financials, setFinancials] = useState<DealPitchFinancials>(…)`, and the
group object resolved below also wants the name `financials` — declaring both is
a redeclaration that will not compile. Rename the state to `financialsDraft` /
`setFinancialsDraft` throughout the file **now**, in this task: the two re-seed
effects that call `setFinancials`, `onResolveConflict`, `patchFinancials`, and
the `dealSavePatch` call (where the patch key stays `financials: financialsDraft`).
Nothing about the effects' logic changes — this is a rename only. `tsc` is the
safety net: any missed reference is a type error.

Then resolve the groups once, above the return:

```tsx
	const groups = visibleDealGroups(shape);
	const groupById = (id: DealGroupId) => groups.find((g) => g.id === id);
	const setup = groupById("setup");
	const terms = groupById("terms");
	const financials = groupById("financials");
```

`DealGroupId` is a type-only import: `import { visibleDealGroups, type DealGroupId } from "#/components/deals/edit/dealFormGroups";`

```tsx
				{setup && (
					<FieldGroup title={setup.label} icon={setup.icon}>
						<SubGroup
							label="Classification"
							description="What kind of deal this is, and where it stands."
						>
							<FieldGrid>
								<Col>
									<ReadOnlyField label="Deal Type" value={dealType} />
								</Col>
								<Col>
									<SelectField
										label="Status"
										value={status}
										options={availableStages(shape)}
										labels={Object.fromEntries(
											availableStages(shape).map((s) => [
												s,
												dealStageLabel(s, shape),
											]),
										)}
										onChange={setStatus}
									/>
								</Col>
							</FieldGrid>
						</SubGroup>

						<SubGroup
							label="Listing Dates"
							description="When the listing agreement starts and ends."
						>
							<FieldGrid>
								<Col>
									<DateField
										label="Listed On"
										value={transaction.listedOnDate}
										onChange={(v) => patchTransaction({ listedOnDate: v })}
									/>
								</Col>
								<Col>
									<DateField
										label="Listing Expiration"
										value={transaction.listingExpirationDate}
										onChange={(v) =>
											patchTransaction({ listingExpirationDate: v })
										}
									/>
								</Col>
							</FieldGrid>
						</SubGroup>

						<SubGroup
							label="Internal Brokers"
							description="Who at your brokerage is on this deal."
						>
							<BrokerEditor
								title="Internal Brokers"
								brokers={internalBrokers}
								side="internal"
								onChange={setInternalBrokers}
							/>
						</SubGroup>

						<SubGroup
							label="Outside Brokers"
							description="Co-brokers outside your brokerage."
						>
							<BrokerEditor
								title="Outside Brokers"
								brokers={outsideBrokers}
								side="outside"
								onChange={setOutsideBrokers}
							/>
						</SubGroup>
					</FieldGroup>
				)}
```

Replace the outer `gap-6` wrapper with `gap-12` to match `ListingFormEditor.tsx:85` — the group tier has to outrank the spacing inside a group. Delete the two `<Separator />` elements and the `Separator` import: a group's own title and tile stack draw the boundary now.

- [ ] **Step 3: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean; 950 passing. `tsc` will flag any import left dangling from Step 2.

- [ ] **Step 4: Verify in the browser**

Open a sale deal's `/listings/<id>/edit`, wait for text `Setup & Status`. Confirm: one icon + title over four tiles; each tile has its gutter name and description; Deal Type sits in the gutter like its neighbours rather than top-labeled; broker rows show Name and Split % side by side with a readable Split % value; Add broker and the remove buttons work; Status still lists only the stages `availableStages` allows. Then `browser_resize` to 900×900 and confirm no control is narrower than its content. `browser_close`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(deal-form): group Setup & Status into four clusters

Deal Type and Status, the listing dates, and each broker side become their own
gutter-labeled tile under one group title. Deal Type moves to ReadOnlyField so
it stops being the only top-labeled row in a form of gutter-labeled ones.

BrokerEditor's rows lose the 7/4/1 grid for the flexBasis:0 split
AdditionalTypesEditor already uses. That grid is what produced the 16px Split %
input: 164px of gutter inside a col-md-4. The repeater also loses its own bold
title, which the cluster's gutter now carries, and the remove button hugs the
row at the bound tier rather than sitting at the far edge of a column.

Separators go away — a group's title and its stack of tiles draw the boundary,
so a rule between them drew it twice. Group spacing goes to gap-12 to match the
Listing form, where the group tier has to outrank the spacing within a group."
```

---

### Task 7: Transaction Terms group

**Files:**
- Modify: `src/components/deals/edit/DealEditor.tsx`

**Interfaces:**
- Consumes: `FieldGroup`/`SubGroup`, the `terms` group from Task 6's `groupById`
- Produces: nothing new

- [ ] **Step 1: Replace the Transaction Terms section with two clusters**

Swap the `<Section title="Transaction Terms" …>` block (`:359-408`) for the group below. The `shape !== "shell"` guard is now carried by `visibleDealGroups`, so drop the wrapping `{shape !== "shell" && (<>…</>)}` fragment — but keep the `isSale` guard on `DealFinancialsSection` until Task 8 replaces it.

The three commission setters (`setSalePrice`, `setCommissionPct`, `setCommissionAmount`) must be passed through untouched. They are the bi-directional math the stage gate and the Edit Transaction dialog share.

```tsx
				{terms && (
					<FieldGroup title={terms.label} icon={terms.icon}>
						<SubGroup
							label="Price & Commission"
							description="What it sells for, and what you earn on it."
						>
							<FieldGrid>
								<Col>
									<NumberField
										label="Sale Price"
										value={transaction.salePrice || null}
										onChange={setSalePrice}
									/>
								</Col>
								<Col>
									<NumberField
										label="Gross Commission %"
										value={transaction.commissionPct || null}
										onChange={setCommissionPct}
									/>
								</Col>
								<Col>
									<NumberField
										label="Gross Commission $"
										value={transaction.commissionAmount || null}
										onChange={setCommissionAmount}
									/>
								</Col>
							</FieldGrid>
						</SubGroup>

						<SubGroup
							label="Milestones"
							description="Confidence, and the dates that close it out."
						>
							<FieldGrid>
								<Col>
									<NumberField
										label="Close Probability (%)"
										value={transaction.closeProbability || null}
										onChange={(v) =>
											patchTransaction({ closeProbability: v ?? 0 })
										}
									/>
								</Col>
								<Col>
									<DateField
										label="Contract Executed"
										value={transaction.contractExecutedDate}
										onChange={(v) =>
											patchTransaction({ contractExecutedDate: v })
										}
									/>
								</Col>
								<Col>
									<DateField
										label="Close Date"
										value={transaction.closeDate}
										onChange={(v) => patchTransaction({ closeDate: v })}
									/>
								</Col>
							</FieldGrid>
						</SubGroup>
					</FieldGroup>
				)}
```

- [ ] **Step 2: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean; 950 passing.

- [ ] **Step 3: Verify the commission math and the shell gate**

On a sale deal's edit page: type a Sale Price and confirm Gross Commission $ recomputes from the %; change the % and confirm $ follows; change $ and confirm % follows. Then open a **shell** deal — a lease listing with child spaces; the seed has "West Land" (`space-107-*` children) and "Patriot Industrial Park" (`space-104-*`) — and confirm Transaction Terms and Financials are both absent while Setup & Status renders. Also open a **flat lease** deal (a Lease listing with no children) and confirm Terms is present and Financials is not. `browser_close`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(deal-form): split Transaction Terms into price and milestones

Two clusters: what it sells for and what you earn on it, then the confidence
and dates that close it out. The shape guard moves to visibleDealGroups, so the
inline 'shape !== shell' fragment goes away and the rule lives with the group
list where it is tested.

The three commission setters pass through untouched — Sale Price, % and \$ stay
bi-directional, the same math the stage gate and the Edit Transaction dialog
use."
```

---

### Task 8: Financials group

The largest task: five clusters, four readouts, two tables, and the scenario cards.

**Files:**
- Modify: `src/components/deals/edit/DealFinancialsSection.tsx`, `src/components/deals/edit/LineItemEditor.tsx`, `src/components/deals/edit/ScenarioEditor.tsx`, `src/components/deals/edit/DealEditor.tsx`

**Interfaces:**
- Consumes: `SubGroup`, `Readout`, `EditableTable`/`Column`, `formatCalcAmount`/`formatCalcPercent`, the `financials` group from Task 6's `groupById`
- Produces: `DealFinancialsSection` keeps `{ financials, patchFinancials }` and now emits `SubGroup`s only — `DealEditor` owns the group heading, matching how `ListingFormEditor` owns it for the Listing sections. `LineItemEditor` and `ScenarioEditor` keep their current props.

- [ ] **Step 1: Convert `LineItemEditor` to the shared table**

Rewrite the body using `EditableTable`. The title and the running Total move into the footer; the cluster's gutter names it.

```tsx
const COLUMNS: Column<IncomeLineItem | ExpenseLineItem>[] = [
	{ key: "label", label: "Item", kind: "text" },
	{ key: "amount", label: "Amount", kind: "number" },
];

export function LineItemEditor<T extends IncomeLineItem | ExpenseLineItem>({
	title,
	items,
	onChange,
}: {
	title: string;
	items: T[];
	onChange: (v: T[]) => void;
}) {
	const total = items.reduce((sum, i) => sum + i.amount, 0);
	return (
		<EditableTable<T>
			columns={COLUMNS as Column<T>[]}
			rows={items}
			onEdit={(id, patch) =>
				onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
			}
			onAdd={() =>
				onChange([
					...items,
					{ id: crypto.randomUUID(), label: "", amount: 0 } as T,
				])
			}
			onRemove={(id) => onChange(items.filter((x) => x.id !== id))}
			addLabel="Add line item"
			emptyLabel={`No ${title.toLowerCase()} line items yet.`}
			footer={
				<div className="d-flex justify-content-between">
					<span className="fw-semibold">Total</span>
					<span className="fw-semibold">${total.toLocaleString()}</span>
				</div>
			}
		/>
	);
}
```

One correction to the block above, which supersedes the `onEdit` shown in it — implement this version, not that one. `EditableTable`'s number cells write `null` for an empty input, but `amount` is a non-nullable `number`, so an emptied cell must land as 0:

```tsx
			onEdit={(id, patch) =>
				onChange(
					items.map((x) =>
						x.id === id
							? { ...x, ...patch, amount: (patch.amount ?? x.amount) ?? 0 }
							: x,
					),
				)
			}
```

- [ ] **Step 2: Convert `ScenarioEditor` to one card per scenario**

Keep the name input as the card title with the reorder controls beside it. Replace each `col-md-4` wrapper with the `flexBasis: 0` split so the three numbers keep readable controls.

```tsx
				<div key={s.id} className="bg-card border rounded p-3">
					<div className="d-flex align-items-center gap-2 mb-2">
						<div className="d-flex flex-column">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Move scenario up"
								disabled={i === 0}
								onClick={() => move(i, -1)}
							>
								<FontAwesomeIcon icon={faArrowUp} />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Move scenario down"
								disabled={i === scenarios.length - 1}
								onClick={() => move(i, 1)}
							>
								<FontAwesomeIcon icon={faArrowDown} />
							</Button>
						</div>
						<div className="flex-grow-1">
							<Input
								value={s.name}
								onChange={(e) => update(s.id, { name: e.target.value })}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remove scenario"
							onClick={() => onChange(scenarios.filter((x) => x.id !== s.id))}
						>
							<FontAwesomeIcon icon={faTrashCan} />
						</Button>
					</div>
					{/* `flexBasis: 0` for the same reason as the broker rows: three
					    `col-md-4`s inside a cluster left each number a clipped control. */}
					<div className="d-flex gap-2">
						<div className="flex-grow-1" style={{ flexBasis: 0 }}>
							<NumberField
								label="NOI"
								value={s.noi}
								onChange={(v) => update(s.id, { noi: v ?? 0 })}
							/>
						</div>
						<div className="flex-grow-1" style={{ flexBasis: 0 }}>
							<NumberField
								label="Cap Rate %"
								value={s.capRate}
								onChange={(v) => update(s.id, { capRate: v ?? 0 })}
							/>
						</div>
						<div className="flex-grow-1" style={{ flexBasis: 0 }}>
							<NumberField
								label="Cash Flow"
								value={s.cashFlow}
								onChange={(v) => update(s.id, { cashFlow: v ?? 0 })}
							/>
						</div>
					</div>
				</div>
```

Drop the `style={{ borderRadius: 6 }}` — `rounded` already supplies it from the token scale. Keep the "Scenarios" header row with its Add button: it sits inside the cluster above the cards.

- [ ] **Step 3: Rebuild `DealFinancialsSection` as five clusters**

Delete the local `formatCalcAmount` / `formatCalcPercent` (now imported from `./calcFormat`) and the `Section`, `Field`, and `Input` imports. Return a fragment of `SubGroup`s rather than a `Section`, and update the doc comment to say it emits subgroups only.

```tsx
	const totalScheduled = totalScheduledIncome(
		financials.grossScheduledIncome,
		financials.otherIncome,
	);
	const vacancy = vacancyCost(
		financials.grossScheduledIncome,
		financials.vacancyPct,
	);

	return (
		<>
			<SubGroup label="Pricing" description="What the asset is priced at.">
				<FieldGrid>
					<Col>
						<NumberField
							label="Asking Price"
							value={financials.askingPrice}
							onChange={(v) => patchFinancials({ askingPrice: v ?? 0 })}
							fieldKey="askingPrice"
						/>
					</Col>
					<Col>
						<NumberField
							label="NOI"
							value={financials.noi}
							onChange={(v) => patchFinancials({ noi: v ?? 0 })}
							fieldKey="noi"
						/>
					</Col>
					<Col>
						<NumberField
							label="Cap Rate %"
							value={financials.capRate}
							onChange={(v) => patchFinancials({ capRate: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
				{/* NOI lives here, not under Income: it is the numerator of the
				    computed cap rate, and `noi()` (gross − opex) is never called on
				    this form, so NOI is entered rather than derived. */}
				<Readout
					label="Computed cap rate"
					value={formatCalcPercent(capRate(financials.noi, financials.askingPrice))}
				/>
				<SwitchRow
					label="Hide price"
					checked={financials.hidePrice}
					onChange={(v) => patchFinancials({ hidePrice: v })}
				/>
			</SubGroup>

			<SubGroup label="Income" description="What the asset takes in.">
				<FieldGrid>
					<Col>
						<NumberField
							label="Gross Scheduled Income"
							value={financials.grossScheduledIncome || null}
							onChange={(v) => patchFinancials({ grossScheduledIncome: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Other Income"
							value={financials.otherIncome || null}
							onChange={(v) => patchFinancials({ otherIncome: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Vacancy %"
							value={financials.vacancyPct || null}
							onChange={(v) => patchFinancials({ vacancyPct: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
				<LineItemEditor
					title="Income"
					items={financials.income}
					onChange={(v) => patchFinancials({ income: v })}
				/>
				<Readout
					label="Total scheduled income"
					value={formatCalcAmount(totalScheduled)}
				/>
				<Readout label="Vacancy cost" value={formatCalcAmount(vacancy)} />
				<Readout
					label="Gross income"
					value={formatCalcAmount(grossIncome(totalScheduled, vacancy))}
				/>
			</SubGroup>

			<SubGroup label="Expenses" description="What it costs to run.">
				<FieldGrid>
					<Col>
						<NumberField
							label="Operating Expenses"
							value={financials.operatingExpenses}
							onChange={(v) => patchFinancials({ operatingExpenses: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
				<LineItemEditor
					title="Expenses"
					items={financials.expenses}
					onChange={(v) => patchFinancials({ expenses: v })}
				/>
			</SubGroup>

			<SubGroup label="Debt" description="How the purchase is financed.">
				<FieldGrid>
					<Col>
						<NumberField
							label="Loan Amount"
							value={financials.loanAmount || null}
							onChange={(v) => patchFinancials({ loanAmount: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Down Payment"
							value={financials.downPayment || null}
							onChange={(v) => patchFinancials({ downPayment: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Debt Service"
							value={financials.debtService || null}
							onChange={(v) => patchFinancials({ debtService: v ?? 0 })}
						/>
					</Col>
					<Col>
						<NumberField
							label="Cash Flow"
							value={financials.cashFlow || null}
							onChange={(v) => patchFinancials({ cashFlow: v ?? 0 })}
						/>
					</Col>
				</FieldGrid>
			</SubGroup>

			<SubGroup label="Scenarios" description="Alternate underwriting cases.">
				<ScenarioEditor
					scenarios={financials.scenarios}
					onChange={(v) => patchFinancials({ scenarios: v })}
				/>
			</SubGroup>
		</>
	);
```

`askingPrice` and `noi` keep their `fieldKey`, so the ingestion arbitration rows still render. Neither may go inside an `AdditionalFields` — there is none in this group, and that is deliberate.

- [ ] **Step 4: Wrap it in its group in `DealEditor`**

Replace `{isSale && (<DealFinancialsSection … />)}` with:

```tsx
				{financials && (
					<FieldGroup title={financials.label} icon={financials.icon}>
						<DealFinancialsSection
							financials={financialsDraft}
							patchFinancials={patchFinancials}
						/>
					</FieldGroup>
				)}
```

The `financialsDraft` rename already happened in Task 6 — the group name would not have compiled beside the old state name — so `financialsDraft` is what exists here. Delete the now-unused `isSale`.

- [ ] **Step 5: Run the gates**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: clean; 950 passing.

- [ ] **Step 6: Verify the calculations and the conflict rows**

On a sale deal's edit page (the seed's "Urban Commons" is a Sale with populated financials): confirm five tiles under one Financials title; the computed cap rate appears under Pricing and updates when NOI or Asking Price changes; the three income readouts appear under Income and update with GSI / Other Income / Vacancy %; a readout disappears rather than showing a stray label when its inputs are cleared; both line-item tables edit, add, remove, and show a Total; scenarios reorder, edit, add, and remove.

Then verify ingestion: find a deal whose `ingestion.conflicts` includes `askingPrice` or `noi`, open `/listings/<id>/edit?review=ingestion`, and confirm the page scrolls to the arbitration row, the row renders under the field inside its cluster, the warning triangle shows beside the label, and both Use / Keep buttons resolve. `browser_close`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(deal-form): group Financials into five clusters with computed readouts

Pricing, Income, Expenses, Debt, and Scenarios each become a tile. The four
computed figures stop being read-only inputs and become readouts inside the
cluster whose inputs produce them, so the computed cap rate sits under the
entered one — the comparison a broker actually wants — and the three income
figures sit under the fields that drive them.

NOI moves to Pricing rather than Income: it is the numerator of the computed cap
rate, and noi() (gross − opex) is never called here, so it is entered, not
derived. Hide price joins Pricing at the bound tier, since it governs whether
that price shows, and loses the maxWidth:360 wrapper the old SwitchRow needed.

Line items become tables — they were already headerless ones, with a Total that
now sits in the footer. Scenarios become one card each: a named case with three
numbers is not a row in a list. Both lose their col-md-4 wrappers for the
flexBasis:0 split.

askingPrice and noi keep their fieldKey so the ingestion arbitration rows still
render, and the group deliberately has no AdditionalFields — a closed
Collapsible is display:none, which would make the review scroll a silent no-op.

The financials state is renamed financialsDraft to free the name for the group;
the three re-seed effects and dealSavePatch are otherwise untouched."
```

---

### Task 9: Full verification sweep

Nothing new is built here. This task exists because the five render states are the deliverable, and a reviewer should be able to reject the branch on any one of them.

**Files:** none modified unless a defect is found

- [ ] **Step 1: Run the gates one final time**

```bash
bunx tsc --noEmit
bun --bun run test
```

Expected: `tsc` silent; 950 passing.

- [ ] **Step 2: Confirm the containment invariant still holds**

```bash
grep -rn "recordForm\|fieldWidgets\|FieldGroup" src/components/contacts src/components/properties src/components/tasks
```

Expected: **no output.** This is the invariant the whole audit was about — the shell must not have reached contacts, properties, or tasks. Also confirm no short form picked it up:

```bash
grep -rln "common/recordForm" src | sort
```

Expected: only `listings/edit/*` and `deals/edit/*` files.

- [ ] **Step 3: Verify all five deal render states**

For each, `browser_navigate` then `browser_wait_for` on text unique to the destination, and screenshot:

1. **Sale deal** — all three groups; 11 tiles total.
2. **Flat lease** (Lease, no children) — Setup & Status and Transaction Terms; no Financials.
3. **Shell** (Lease with `space-*` children) — Setup & Status only.
4. **Space deal** (`/listings/<shellId>/spaces/<spaceId>/…` has its own routes; reach the space's own edit page) — Setup and Terms, no Financials.
5. **`?review=ingestion`** — scrolls to and renders the arbitration row.

- [ ] **Step 4: Verify both forms at 900px**

`browser_resize` to 900×900 and run the narrow-control probe from Task 4 Step 5 on both `/listings/<id>/edit` and `/listings/<id>/listing`. Expected `[]` on both.

- [ ] **Step 5: Check the console on both forms**

`browser_console_messages` on each. The only acceptable error is the pre-existing `GlobalNavbar.tsx:172` hydration mismatch at collapsed-navbar widths, which is out of scope. Anything else is a defect to fix before shipping. `browser_close`.

- [ ] **Step 6: Commit any fixes, then hand off**

If Steps 1-5 were clean there is nothing to commit. Report the verification results, then stop — **do not** open the PR. Per CLAUDE.md, `/ship` runs the gates, pushes, and opens the PR once Joel approves, and never merges.

Before `/ship` runs, the spec and this plan are deleted in a `chore(docs):` commit that goes out with the branch, and anything worth keeping that is not already in a commit body — chiefly anything tried and reverted — is written into the PR body first.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: module layout → Tasks 1-2; the two CLAUDE.md conventions → Task 1 Step 7; group/cluster map → Tasks 6-8; `Readout` → Task 5; repeater treatments → Tasks 6 (brokers), 8 (line items, scenarios); responsive floor → Task 4; read-only variant → Task 5; dead-code deletion → Task 1 Step 5; the `dealFormGroups` split → Task 3; every invariant → Task 9 Steps 2-5, with the `fieldKey` and no-disclosure invariants also enforced in Task 8 Step 3.

**Two spec deviations, both deliberate:**

1. The spec's file list did not include `EditableTable.tsx` or `calcFormat.ts`. Both were added once the code was read: `UnitsSection` already had the generic table the line items need, so promoting it beats writing a second one, and the formatters had to leave `DealFinancialsSection` to be testable. Neither changes any decision.
2. The spec described the responsive floor as "a stacked-label collapse below `md`." That would not have worked — the clipping happens at a 900px viewport, which is *above* `md`, because the squeeze comes from the grid column, not the window. Task 4 uses a container query instead. Same intent, correct mechanism.

**Placeholder scan.** No TBD/TODO, no "add error handling", no "similar to Task N". Every code step carries real code; every verification step names the exact probe or interaction.

**Type consistency.** `visibleDealGroups(shape: DealShape): DealGroup[]` is used with one argument in Task 6. `Column<T>`/`EditableTable<T extends {id: string}>` from Task 2 are consumed with those exact names in Task 8. `Readout({label, value}: {label: string; value: string})` from Task 5 is called with two string props throughout Task 8 — every call site wraps its number in `formatCalcAmount`/`formatCalcPercent` first. `BrokerEditor`'s props are unchanged, so Task 6's two call sites still compile. The `financials` name collision between the state variable and the group object is caught explicitly in Task 8 Step 4 rather than left to discovery.
