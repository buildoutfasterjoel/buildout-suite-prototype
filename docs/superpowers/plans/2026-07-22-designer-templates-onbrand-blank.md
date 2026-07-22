# Designer Templates + On-Brand Blank Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the document editor a visual gallery of ~7 on-brand designer templates plus a new "on-brand blank" page kind, all driven by a single shared brand layer.

**Architecture:** A new `brand.ts` module is the single source of truth (fonts, palette, logo). `presets.ts` becomes a metadata-rich template registry that builds pages from `brand`. A `TemplateGallery` modal renders live scaled `PageView` previews and calls `addPage(key)`. The on-brand blank page seeds brand defaults + a light scaffold; `blockFactory` defaults and the color/font pickers also read `brand`.

**Tech Stack:** React 19, TypeScript, TanStack Start, Zustand store, Blueprint React (`Modal`, `Button`, `DropdownMenu`), FontAwesome Pro, Vitest.

## Global Constraints

- Package manager is Bun. Run tests with `bun --bun run test`. Dev server `bun --bun run dev`.
- All UI uses Blueprint React components and Bootstrap 5 utility classes (not Tailwind).
- Icons are FontAwesome Pro `pro-regular` by default. Never pass `fixedWidth`.
- **No Playwright.** Logic is covered by Vitest; UI is verified by `bun --bun run build` compiling and by asking the user to test in the running app.
- Demo brand name is exactly **"Meridian Point Real Estate"**.
- Brand logo reuses the existing asset `/assets/branding/gemini-logo.png` (its artwork reads "Meridian Point Real Estate").
- Images always come from `getPhotoUrl` / `crePhotoUrl` (curated CRE photos) — never picsum.
- `routeTree.gen.ts` is auto-generated; never edit it.
- Do not restructure component visual design beyond what a task specifies.

---

## File Structure

- **Create** `src/features/editor/brand.ts` — brand tokens (name, logo, fonts, palette) + `BRAND_SWATCHES`. Leaf module; imports only React-free constants.
- **Modify** `src/features/editor/blocks/blockFactory.ts` — move `SERIF`/`SANS` to `brand.ts` and re-export; point default styles at `BRAND` fonts/ink; drop-in image already uses `getPhotoUrl`.
- **Modify** `src/features/editor/presets.ts` — replace flat `PRESETS` with a `TEMPLATES` registry (`TemplateDef`), add brand helper builders and ~7 templates, add `buildOnBrandBlankPage`, keep `buildDocumentPages` working.
- **Modify** `src/features/editor/store.ts` — widen `addPage` kind to `"blank" | "onBrandBlank" | TemplateKey`.
- **Create** `src/features/editor/PagePreview.tsx` — non-interactive scaled `PageView` wrapper.
- **Create** `src/features/editor/panels/TemplateGallery.tsx` — the gallery modal.
- **Modify** `src/features/editor/panels/NavPanels.tsx` — Pages panel "Add Page" opens the gallery instead of the dropdown.
- **Modify** `src/features/editor/controls/SwatchGrid.tsx` — optional leading brand-swatch row.
- **Modify** `src/features/editor/panels/StyleControls.tsx` — font `FauxSelect` leads with brand fonts.
- **Create** `src/features/editor/brand.test.ts`, `src/features/editor/templates.test.ts` — Vitest for brand + registry + on-brand blank.

---

## Task 1: Brand layer (`brand.ts`)

**Files:**
- Create: `src/features/editor/brand.ts`
- Test: `src/features/editor/brand.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SERIF: string`, `SANS: string` (moved here; the canonical source)
  - `BRAND` — `{ name: string; logoSrc: string; fonts: { heading: string; body: string }; palette: { primary; secondary; accent; ink; neutral; surface: string } }`
  - `BRAND_SWATCHES: string[]` (the palette values, in order)

- [ ] **Step 1: Write the failing test**

Create `src/features/editor/brand.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BRAND, BRAND_SWATCHES, SERIF, SANS } from './brand'

describe('BRAND', () => {
  it('names the demo brand Meridian Point Real Estate', () => {
    expect(BRAND.name).toBe('Meridian Point Real Estate')
  })

  it('reuses the existing document logo asset', () => {
    expect(BRAND.logoSrc).toBe('/assets/branding/gemini-logo.png')
  })

  it('exposes heading and body fonts', () => {
    expect(BRAND.fonts.heading).toBe(SERIF)
    expect(BRAND.fonts.body).toBe(SANS)
  })

  it('derives BRAND_SWATCHES from the palette values', () => {
    expect(BRAND_SWATCHES).toEqual(Object.values(BRAND.palette))
    expect(BRAND_SWATCHES).toContain('#7422ce')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/features/editor/brand.test.ts`
Expected: FAIL — cannot resolve module `./brand`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/editor/brand.ts`:

```ts
/**
 * The demo brand — single source of truth for the editor's designer templates,
 * on-brand blank page, and brand-aware pickers. In production this comes from
 * the company-settings brand kit; here it is seeded for the prototype.
 *
 * Font constants live here (not blockFactory) so brand typography has one home;
 * blockFactory re-exports them for backward compatibility.
 */
export const SERIF = "'PT Serif', Georgia, serif";
export const SANS = "'proxima-nova', system-ui, sans-serif";

export const BRAND = {
  name: "Meridian Point Real Estate",
  logoSrc: "/assets/branding/gemini-logo.png",
  fonts: { heading: SERIF, body: SANS },
  palette: {
    primary: "#7422ce", // editor primary
    secondary: "#4b1a8f", // darker brand purple
    accent: "#00bc7d", // editor success/accent green
    ink: "#22262f", // editor ink
    neutral: "#506079", // editor muted
    surface: "#f9f5ff", // editor primarySoft
  },
} as const;

/** Brand palette as an ordered swatch list for the color pickers. */
export const BRAND_SWATCHES: string[] = Object.values(BRAND.palette);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/features/editor/brand.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/brand.ts src/features/editor/brand.test.ts
git commit -m "feat(editor): add brand layer (Meridian Point Real Estate)"
```

---

## Task 2: Point blockFactory fonts + defaults at BRAND

**Files:**
- Modify: `src/features/editor/blocks/blockFactory.ts:10-26`

**Interfaces:**
- Consumes: `SERIF`, `SANS`, `BRAND` from `../brand` (Task 1).
- Produces: `SERIF`, `SANS` re-exported (unchanged import path for existing consumers); `DEFAULT_TEXT_STYLE` now brand-fonted with brand ink.

- [ ] **Step 1: Replace the font-constant definitions with a re-export**

In `src/features/editor/blocks/blockFactory.ts`, change the top of the file. Replace lines 10-12:

```ts
/* ---- Shared font + style defaults (also used to seed the sample doc) ---- */
export const SERIF = "'PT Serif', Georgia, serif";
export const SANS = "'proxima-nova', system-ui, sans-serif";
```

with:

```ts
/* ---- Shared font + style defaults (also used to seed the sample doc) ----
 * SERIF/SANS now live in brand.ts (the brand typography source); re-exported
 * here so existing `from ".../blockFactory"` imports keep working. */
export { SERIF, SANS } from "../brand";
import { BRAND } from "../brand";
```

- [ ] **Step 2: Point the default text style at the brand font + ink**

Replace the `DEFAULT_TEXT_STYLE` block (lines 14-26) so new blocks start on-brand:

```ts
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: BRAND.fonts.body,
  fontSize: 14,
  bold: false,
  italic: false,
  underline: false,
  letterSpacing: 0,
  lineHeight: 0,
  align: "left",
  transform: "none",
  color: BRAND.palette.ink,
  background: null,
};
```

- [ ] **Step 3: Run the full test suite to verify nothing breaks**

Run: `bun --bun run test`
Expected: PASS — existing `underwritingPages.test.ts` and `brand.test.ts` still pass (font strings are unchanged values, just relocated).

- [ ] **Step 4: Typecheck the build**

Run: `bunx tsc --noEmit`
Expected: no errors (no circular import: `brand.ts` imports nothing from `blockFactory`).

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/blocks/blockFactory.ts
git commit -m "refactor(editor): source fonts from brand, default blocks to brand ink"
```

---

## Task 3: Template registry scaffold + brand helper builders

Refactor the two existing presets into a registry keyed by string, add brand-aware helper builders, and keep `PRESETS`/`buildPresetPage`/`buildDocumentPages` working via the registry.

**Files:**
- Modify: `src/features/editor/presets.ts`
- Test: `src/features/editor/templates.test.ts` (create)

**Interfaces:**
- Consumes: `BRAND` from `./brand`; `getPhotoUrl` from `#/components/properties/propertyDisplay`; block/style helpers already in `presets.ts` and `blockFactory`.
- Produces:
  - `type TemplateKey = string`
  - `interface TemplateDef { key: TemplateKey; name: string; category: TemplateCategory; description: string; build: (property?: Property) => Page }`
  - `type TemplateCategory = "Cover" | "Financials" | "Property" | "Location" | "Comparables" | "Team"`
  - `const TEMPLATES: TemplateDef[]`
  - `function buildTemplatePage(key: TemplateKey, property?: Property): Page`
  - Helper builders: `brandHeading(text, size?)`, `brandBody(text, size?)`, `brandLogoPage(...)` (internal)
  - Keep exporting `LOGO_SRC` (now `= BRAND.logoSrc`), `PresetKey` (aliased to `TemplateKey`), `PRESETS`, `buildPresetPage`, `buildBlankPage`, `buildDocumentPages`.

- [ ] **Step 1: Write the failing test**

Create `src/features/editor/templates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TEMPLATES, buildTemplatePage } from './presets'
import { BRAND } from './brand'

describe('TEMPLATES registry', () => {
  it('exposes at least 7 templates, each with unique key + metadata', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(7)
    const keys = TEMPLATES.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
      expect(t.category).toBeTruthy()
    }
  })

  it('builds every template without throwing and produces blocks', () => {
    for (const t of TEMPLATES) {
      const page = buildTemplatePage(t.key)
      expect(page.name.length).toBeGreaterThan(0)
      expect(Array.isArray(page.blocks)).toBe(true)
    }
  })

  it('covers the expected categories', () => {
    const cats = new Set(TEMPLATES.map((t) => t.category))
    for (const c of ['Cover', 'Financials', 'Property', 'Location', 'Comparables', 'Team']) {
      expect(cats.has(c as never)).toBe(true)
    }
  })

  it('styles headings with the brand heading font', () => {
    const cover = buildTemplatePage('cover')
    const heading = cover.blocks.find((b) => b.type === 'heading') as { style: { fontFamily: string } }
    expect(heading.style.fontFamily).toBe(BRAND.fonts.heading)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/features/editor/templates.test.ts`
Expected: FAIL — `TEMPLATES` / `buildTemplatePage` not exported.

- [ ] **Step 3: Add brand import, helpers, and swap LOGO_SRC**

In `presets.ts`, add near the top imports:

```ts
import { BRAND } from "./brand";
```

Change the `LOGO_SRC` definition to source the brand logo:

```ts
/** Brand header logo shown at the top of document pages (served from /public). */
export const LOGO_SRC = BRAND.logoSrc;
```

Add brand helper builders (place them next to the existing `heroImage` helper):

```ts
/** A heading block in the brand heading font + ink. */
function brandHeading(text: string, size = 28): HeadingBlock {
  return {
    id: uid("block"),
    type: "heading",
    text,
    style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.heading, fontSize: size, color: BRAND.palette.ink },
  };
}

/** A body-copy text block in the brand body font. */
function brandBody(text: string, size = 13): TextBlock {
  return {
    id: uid("block"),
    type: "text",
    text,
    style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.body, fontSize: size, lineHeight: 22, color: BRAND.palette.ink },
  };
}
```

(Ensure `HeadingBlock`, `TextBlock` are imported from `./types` — extend the existing type import list.)

- [ ] **Step 4: Introduce the registry and compatibility shims**

Replace the current `PresetKey` type and `PRESETS` array with:

```ts
export type TemplateCategory =
  | "Cover" | "Financials" | "Property" | "Location" | "Comparables" | "Team";

export interface TemplateDef {
  key: string;
  name: string;
  category: TemplateCategory;
  description: string;
  build: (property?: Property) => Page;
}

/** All designer templates, in gallery display order. Populated in Task 4. */
export const TEMPLATES: TemplateDef[] = [
  {
    key: "propertyOverview",
    name: "Property Overview",
    category: "Property",
    description: "Magazine-style two-column overview with a highlights table.",
    build: (property) => buildPropertyOverviewPage(property),
  },
  {
    key: "financialSummary",
    name: "Financial Summary",
    category: "Financials",
    description: "Address header with a data-bound financial summary table.",
    build: (property) => buildFinancialSummaryPage(property),
  },
];

/** Build a template page by key (falls back to the first template). */
export function buildTemplatePage(key: string, property?: Property): Page {
  const def = TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
  return def.build(property);
}

// --- Back-compat shims (existing callers) ---
export type PresetKey = string;
export const PRESETS: { key: string; label: string }[] = TEMPLATES.map((t) => ({ key: t.key, label: t.name }));
export function buildPresetPage(key: string, property?: Property): Page {
  return buildTemplatePage(key, property);
}
```

Remove the now-unused old `PresetKey = "financialSummary" | "propertyOverview"` union and the old `buildPresetPage` implementation (its ternary) — `buildTemplatePage` replaces it.

- [ ] **Step 5: Run tests + typecheck**

Run: `bun --bun run test src/features/editor/templates.test.ts`
Expected: category test FAILS (only Property + Financials exist so far) — that is expected until Task 4; the other three tests PASS.

Run: `bunx tsc --noEmit`
Expected: no errors. `store.ts` still imports `buildPresetPage`/`PresetKey` (now `string`) — compiles.

- [ ] **Step 6: Commit**

```bash
git add src/features/editor/presets.ts src/features/editor/templates.test.ts
git commit -m "refactor(editor): presets -> brand-aware TEMPLATES registry"
```

---

## Task 4: Add the five new designer templates

Add Cover, Financial Hero, Location & Map, Comparables Grid, Advisor Bios, and Section Divider builders and register them. Layouts use only existing block types and the brand helpers; exact spacing/size values are reasonable defaults to be tuned against the running app.

**Files:**
- Modify: `src/features/editor/presets.ts`

**Interfaces:**
- Consumes: `brandHeading`, `brandBody`, `heroImage` (already uses `getPhotoUrl`), `getPhotoUrl`, table helpers (`headerCell`, `valueCell`), `ColumnsBlock`, `SectionBlock` types, `BRAND`.
- Produces: builder functions `buildCoverPage`, `buildFinancialHeroPage`, `buildLocationMapPage`, `buildComparablesPage`, `buildAdvisorBiosPage`, `buildBrandDividerPage`, all registered in `TEMPLATES`.

- [ ] **Step 1: Add the builder functions**

Add to `presets.ts`. Extend the `./types` import to include `ColumnsBlock`, `SectionBlock`, `ContentBlock` (`ImageBlock`, `TableBlock`, `Cell`, `DynamicKey` are already imported). `getPhotoUrl` is already imported at the top of `presets.ts` (from the earlier CRE-photo migration) — do not re-import it.

```ts
/** Cover — full-width hero, logo, large serif title, address, deal-stat strip. */
function buildCoverPage(property?: Property): Page {
  const statCell = (key: DynamicKey, format?: Cell["format"]): Cell => ({
    ...valueCell("—", key, format),
    style: { ...DEFAULT_CELL_STYLE, fontFamily: BRAND.fonts.heading, fontSize: 18, color: BRAND.palette.primary, align: "center" },
    align: "center",
  });
  const statStrip: TableBlock = {
    id: uid("block"),
    type: "table",
    style: { borderWidth: 0, borderStyle: "none", borderColor: null },
    rows: [
      [headerCell("Asking Price"), headerCell("Building Size"), headerCell("Cap Rate")],
      [statCell("askingPrice", "currency"), statCell("buildingSqFt", "text"), statCell("capRate", "percent")],
    ],
  };
  return {
    id: uid("page"),
    name: "Cover Page",
    logoSrc: BRAND.logoSrc,
    locked: true,
    blocks: [
      { id: uid("block"), type: "image", src: getPhotoUrl(property?.id ?? "cover", 736, 340), alt: "Property photo" },
      brandHeading(property?.name ?? "Offering Memorandum", 40),
      brandBody(addressOf(property)),
      statStrip,
    ],
  };
}

/** Financial Hero — three metric callouts above the financial summary table. */
function buildFinancialHeroPage(property?: Property): Page {
  const metric = (label: string, key: DynamicKey, format?: Cell["format"]): SectionBlock => ({
    id: uid("block"),
    type: "section",
    padding: 16,
    background: BRAND.palette.surface,
    blocks: [
      brandBody(label, 11),
      { id: uid("block"), type: "dynamic", dynamicKey: key, format,
        style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.heading, fontSize: 22, color: BRAND.palette.primary } },
    ],
  });
  const callouts: ColumnsBlock = {
    id: uid("block"), type: "columns", columnCount: 3,
    columns: [[metric("Asking Price", "askingPrice", "currency")], [metric("NOI", "noi", "currency")], [metric("Cap Rate", "capRate", "percent")]],
  };
  return {
    id: uid("page"), name: "Financial Highlights", logoSrc: BRAND.logoSrc, locked: true,
    blocks: [brandHeading("Financial Highlights"), callouts, buildFinancialSummaryTable(property)],
  };
}

/** Location & Map — map image left, submarket/city narrative right. */
function buildLocationMapPage(property?: Property): Page {
  const row: ColumnsBlock = {
    id: uid("block"), type: "columns", columnCount: 2,
    columns: [
      [{ id: uid("block"), type: "image", src: getPhotoUrl((property?.id ?? "loc") + "-map", 380, 300), alt: "Location map" }],
      [brandHeading("Location", 22), brandBody(property?.city ? `Located in ${property.city}, ${property.state}.` : "A well-connected submarket with strong fundamentals."),
       { id: uid("block"), type: "dynamic", dynamicKey: "submarket", style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.body, fontSize: 13 } }],
    ],
  };
  return { id: uid("page"), name: "Location", logoSrc: BRAND.logoSrc, locked: true, blocks: [brandHeading("Location Information"), row] };
}

/** Comparables Grid — three comps, each a photo + label. */
function buildComparablesPage(property?: Property): Page {
  const comp = (i: number): ContentBlock[] => [
    { id: uid("block"), type: "image", src: getPhotoUrl((property?.id ?? "comp") + "-" + i, 240, 160), alt: "Comparable property" },
    brandBody(`Comparable ${i}`, 12),
  ];
  const grid: ColumnsBlock = { id: uid("block"), type: "columns", columnCount: 3, columns: [comp(1), comp(2), comp(3)] };
  return { id: uid("page"), name: "Sale Comparables", logoSrc: BRAND.logoSrc, locked: true, blocks: [brandHeading("Sale Comparables"), grid] };
}

/** Advisor Bios — two-advisor team layout: photo + name + role + blurb. */
function buildAdvisorBiosPage(_property?: Property): Page {
  const advisor = (seed: string, name: string, role: string): ContentBlock[] => [
    { id: uid("block"), type: "image", src: getPhotoUrl(seed, 200, 200), alt: "Advisor" },
    brandHeading(name, 18),
    brandBody(role, 12),
    brandBody("Senior advisor with deep experience across the submarket, representing owners and investors on institutional-quality assets."),
  ];
  const row: ColumnsBlock = { id: uid("block"), type: "columns", columnCount: 2, columns: [advisor("advisor-1", "Jordan Avery", "Managing Director"), advisor("advisor-2", "Sam Ellis", "Vice President")] };
  return { id: uid("page"), name: "Advisor Bios", logoSrc: BRAND.logoSrc, locked: true, blocks: [brandHeading("Meet the Team"), row] };
}

/** Section Divider — a big centered title on a brand-color band. */
function buildBrandDividerPage(name = "Section"): Page {
  const band: SectionBlock = {
    id: uid("block"), type: "section", padding: 48, background: BRAND.palette.primary,
    blocks: [{ id: uid("block"), type: "heading", text: name,
      style: { ...DEFAULT_TEXT_STYLE, fontFamily: BRAND.fonts.heading, fontSize: 34, align: "center", color: "#ffffff" } }],
  };
  return { id: uid("page"), name, logoSrc: BRAND.logoSrc, locked: true, blocks: [band] };
}
```

- [ ] **Step 2: Extract the financial table so two templates can share it**

The existing `buildFinancialSummaryPage` builds its table inline. Extract a `buildFinancialSummaryTable(property?)` returning the `TableBlock` (move the existing `financialTable` construction into it), and have both `buildFinancialSummaryPage` and `buildFinancialHeroPage` call it. Full extracted helper:

```ts
function buildFinancialSummaryTable(property?: Property): TableBlock {
  return {
    id: uid("block"),
    type: "table",
    title: "Financial Summary",
    style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
    rows: [
      [headerCell("Price"), valueCell("$2,000,000", "askingPrice", "currency")],
      [headerCell("Price per SF"), valueCell(pricePerSf(property))],
      [headerCell("Cap Rate"), valueCell("—", "capRate", "percent")],
      [headerCell("Net Operating Income"), valueCell("—", "noi", "currency")],
      [headerCell("Building Size"), valueCell("—", "buildingSqFt", "text")],
    ],
  };
}
```

Then in `buildFinancialSummaryPage`, delete the inline `const financialTable = {…}` and reference `buildFinancialSummaryTable(property)` in its `blocks` array instead.

- [ ] **Step 3: Register the new templates**

Extend `TEMPLATES` (insert Cover first so it leads the gallery):

```ts
export const TEMPLATES: TemplateDef[] = [
  { key: "cover", name: "Cover Page", category: "Cover", description: "Full-bleed hero, logo, title, and a deal-stat strip.", build: buildCoverPage },
  { key: "financialHero", name: "Financial Highlights", category: "Financials", description: "Headline metric callouts above the financial summary.", build: buildFinancialHeroPage },
  { key: "financialSummary", name: "Financial Summary", category: "Financials", description: "Address header with a data-bound financial summary table.", build: buildFinancialSummaryPage },
  { key: "propertyOverview", name: "Property Overview", category: "Property", description: "Magazine-style two-column overview with a highlights table.", build: buildPropertyOverviewPage },
  { key: "locationMap", name: "Location & Map", category: "Location", description: "Map image with submarket and city narrative.", build: buildLocationMapPage },
  { key: "comparables", name: "Sale Comparables", category: "Comparables", description: "A three-up grid of comparable properties with photos.", build: buildComparablesPage },
  { key: "advisorBios", name: "Advisor Bios", category: "Team", description: "Team layout: advisor photo, name, role, and blurb.", build: buildAdvisorBiosPage },
  { key: "brandDivider", name: "Section Divider", category: "Property", description: "A branded full-band section divider.", build: () => buildBrandDividerPage() },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --bun run test src/features/editor/templates.test.ts`
Expected: PASS — all four tests, including the category-coverage test (Cover, Financials, Property, Location, Comparables, Team all present).

Run: `bun --bun run test`
Expected: PASS — `underwritingPages.test.ts` unaffected.

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/editor/presets.ts
git commit -m "feat(editor): add 6 designer templates to the registry"
```

---

## Task 5: On-brand blank page builder

**Files:**
- Modify: `src/features/editor/presets.ts`
- Test: `src/features/editor/templates.test.ts`

**Interfaces:**
- Consumes: `BRAND`, `brandHeading`, `ColumnsBlock`.
- Produces: `export function buildOnBrandBlankPage(): Page`.

- [ ] **Step 1: Write the failing test**

Add to `templates.test.ts`:

```ts
import { buildOnBrandBlankPage } from './presets'

describe('buildOnBrandBlankPage', () => {
  it('is freeform (not locked) but carries the brand logo', () => {
    const page = buildOnBrandBlankPage()
    expect(page.locked ?? false).toBe(false)
    expect(page.logoSrc).toBe(BRAND.logoSrc)
  })

  it('seeds a brand-font title and a light scaffold', () => {
    const page = buildOnBrandBlankPage()
    const heading = page.blocks.find((b) => b.type === 'heading') as { style: { fontFamily: string } }
    expect(heading.style.fontFamily).toBe(BRAND.fonts.heading)
    expect(page.blocks.some((b) => b.type === 'columns')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/features/editor/templates.test.ts`
Expected: FAIL — `buildOnBrandBlankPage` not exported.

- [ ] **Step 3: Implement the builder**

Add to `presets.ts`:

```ts
/**
 * On-brand blank page — freeform (fully editable/rearrangeable), but seeded so
 * it never starts as an off-brand white void: brand logo header, a brand title,
 * and a faint two-column guide. Everything here is deletable.
 */
export function buildOnBrandBlankPage(): Page {
  const scaffold: ColumnsBlock = {
    id: uid("block"),
    type: "columns",
    columnCount: 2,
    columns: [
      [brandBody("Drag blocks here, or type to start.")],
      [brandBody("Your brand fonts and colors are already applied.")],
    ],
  };
  return {
    id: uid("page"),
    name: "New Page",
    logoSrc: BRAND.logoSrc,
    locked: false,
    blocks: [brandHeading("Untitled Section"), scaffold],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/features/editor/templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/presets.ts src/features/editor/templates.test.ts
git commit -m "feat(editor): add on-brand blank page builder"
```

---

## Task 6: Wire addPage to the new page kinds

**Files:**
- Modify: `src/features/editor/store.ts:12,85,217-234`

**Interfaces:**
- Consumes: `buildBlankPage`, `buildOnBrandBlankPage`, `buildTemplatePage` from `./presets`.
- Produces: `addPage(kind: "blank" | "onBrandBlank" | string, atIndex?: number)`.

- [ ] **Step 1: Update the import**

Change `store.ts:12`:

```ts
import { buildBlankPage, buildOnBrandBlankPage, buildTemplatePage } from "./presets";
```

- [ ] **Step 2: Widen the action type**

Change the type declaration (`store.ts:85`):

```ts
  addPage: (kind: "blank" | "onBrandBlank" | string, atIndex?: number) => void;
```

- [ ] **Step 3: Update the implementation**

Replace the page-construction line inside `addPage` (`store.ts:219-220`):

```ts
      const page =
        kind === "blank"
          ? buildBlankPage()
          : kind === "onBrandBlank"
            ? buildOnBrandBlankPage()
            : buildTemplatePage(kind, s.activeListing);
```

- [ ] **Step 4: Typecheck + test**

Run: `bunx tsc --noEmit`
Expected: no errors.

Run: `bun --bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/store.ts
git commit -m "feat(editor): addPage handles onBrandBlank + template keys"
```

---

## Task 7: PagePreview component (non-interactive scaled page)

**Files:**
- Create: `src/features/editor/PagePreview.tsx`

**Interfaces:**
- Consumes: `PageView` from `./blocks/PageView`; `PAGE_WIDTH`, `PAGE_HEIGHT`, `Page` from `./types`.
- Produces: `export function PagePreview({ page, width }: { page: Page; width: number })`.

- [ ] **Step 1: Implement the component**

Create `src/features/editor/PagePreview.tsx`:

```tsx
import { PageView } from "./blocks/PageView";
import { PAGE_WIDTH, PAGE_HEIGHT, type Page } from "./types";

/**
 * A non-interactive, scaled-down render of a real page — used for template
 * thumbnails. Wraps the live PageView (pointer-events off, no selection) so
 * previews never drift from the templates they represent.
 */
export function PagePreview({ page, width }: { page: Page; width: number }) {
  const scale = width / PAGE_WIDTH;
  return (
    <div
      aria-hidden
      style={{
        width,
        height: PAGE_HEIGHT * scale,
        overflow: "hidden",
        borderRadius: 6,
        border: "1px solid #d5dae2",
        background: "#fff",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <PageView page={page} selection={null} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/editor/PagePreview.tsx
git commit -m "feat(editor): add non-interactive scaled PagePreview"
```

---

## Task 8: TemplateGallery modal + Pages panel wiring

**Files:**
- Create: `src/features/editor/panels/TemplateGallery.tsx`
- Modify: `src/features/editor/panels/NavPanels.tsx` (Pages panel "Add Page" area, ~lines 286-314, and imports)

**Interfaces:**
- Consumes: `TEMPLATES`, `buildTemplatePage`, `TemplateCategory` from `../presets`; `PagePreview`; `useEditorStore` (`addPage`, `activeListing`); Blueprint `Modal`, `Button`; FontAwesome.
- Produces: `export function TemplateGallery({ open, onOpenChange, atIndex }: { open: boolean; onOpenChange: (o: boolean) => void; atIndex?: number })`.

- [ ] **Step 1: Implement the gallery modal**

Create `src/features/editor/panels/TemplateGallery.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faSwatchbook } from "@fortawesome/pro-regular-svg-icons";
import { useEditorStore } from "../store";
import { TEMPLATES, buildTemplatePage, type TemplateCategory } from "../presets";
import { PagePreview } from "../PagePreview";

const CATEGORIES: (TemplateCategory | "Blank")[] = [
  "Cover", "Financials", "Property", "Location", "Comparables", "Team", "Blank",
];

export function TemplateGallery({
  open,
  onOpenChange,
  atIndex,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  atIndex?: number;
}) {
  const addPage = useEditorStore((s) => s.addPage);
  const activeListing = useEditorStore((s) => s.activeListing);
  const [active, setActive] = useState<(TemplateCategory | "Blank")>("Cover");

  const templatesInCategory = useMemo(
    () => TEMPLATES.filter((t) => t.category === active),
    [active],
  );

  const pick = (kind: string) => {
    addPage(kind, atIndex);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="xl" scrollable centered>
        <Modal.Header>
          <Modal.Title>
            <FontAwesomeIcon icon={faSwatchbook} className="me-2" />
            Add a page
          </Modal.Title>
          <Modal.Description>
            Start from a designer template — or an on-brand blank page you control.
          </Modal.Description>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex gap-4">
            {/* Category rail */}
            <div className="d-flex flex-column gap-1" style={{ width: 160, flexShrink: 0 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`btn btn-sm text-start ${active === c ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActive(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Template grid */}
            <div className="d-flex flex-wrap gap-3 flex-grow-1">
              {active === "Blank" ? (
                <>
                  <BlankCard
                    icon={faFileLines}
                    title="Blank page"
                    desc="A truly empty page — full manual control."
                    onClick={() => pick("blank")}
                  />
                  <BlankCard
                    icon={faSwatchbook}
                    title="On-brand blank"
                    desc="Freeform, but your brand fonts, colors, and logo are pre-applied."
                    onClick={() => pick("onBrandBlank")}
                  />
                </>
              ) : (
                templatesInCategory.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className="d-flex flex-column gap-2 p-2 border rounded bg-transparent text-start"
                    style={{ width: 200, cursor: "pointer" }}
                    onClick={() => pick(t.key)}
                  >
                    <PagePreview page={buildTemplatePage(t.key, activeListing)} width={184} />
                    <span className="fw-semibold" style={{ fontSize: 14 }}>{t.name}</span>
                    <span className="fs-small" style={{ color: "#506079" }}>{t.description}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
}

function BlankCard({
  icon, title, desc, onClick,
}: { icon: typeof faFileLines; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="d-flex flex-column gap-2 p-3 border rounded bg-transparent text-start justify-content-center align-items-center"
      style={{ width: 200, height: 160, cursor: "pointer" }}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: 28, color: "#7422ce" }} />
      <span className="fw-semibold" style={{ fontSize: 14 }}>{title}</span>
      <span className="fs-small text-center" style={{ color: "#506079" }}>{desc}</span>
    </button>
  );
}
```

- [ ] **Step 2: Replace the Add Page dropdown in NavPanels**

In `NavPanels.tsx`, add imports near the other editor imports:

```ts
import { useState } from "react"; // if not already imported — merge into existing React import
import { TemplateGallery } from "./TemplateGallery";
```

In the Pages panel component (the one containing the `Add Page` `DropdownMenu` at ~286-314), add gallery state at the top of the component body:

```ts
  const [galleryOpen, setGalleryOpen] = useState(false);
```

Replace the entire `<DropdownMenu>…</DropdownMenu>` block (lines ~286-314) with:

```tsx
      <Button variant="secondary" className="w-100" onClick={() => setGalleryOpen(true)}>
        <FontAwesomeIcon icon={faPlus} />
        Add Page
      </Button>
      <TemplateGallery open={galleryOpen} onOpenChange={setGalleryOpen} />
```

`tsconfig.json` has `noUnusedLocals` + `noUnusedParameters`, so unused imports **fail the build**. After removing the dropdown, grep the file for each symbol and delete every import that no longer has a reference — expect this to include `PRESETS`, `DropdownMenu`, `faTableLayout`, and `faFileLines` (now used only in the gallery). Keep `faPlus` (still used by the button). Verify with:

```bash
grep -nE "PRESETS|DropdownMenu|faTableLayout|faFileLines" src/features/editor/panels/NavPanels.tsx
```

Expected after cleanup: no matches (or only genuinely-still-used ones).

- [ ] **Step 3: Typecheck + build**

Run: `bunx tsc --noEmit`
Expected: no errors (verify no leftover references to `PRESETS` in NavPanels; the dropdown that mapped `PRESETS` is gone).

Run: `bun --bun run build`
Expected: build succeeds.

- [ ] **Step 4: Ask the user to verify in the app**

Per repo policy (no Playwright): ask the user to run `bun --bun run dev`, open the editor, click **Add Page**, confirm the gallery shows category tabs, live template previews, and the Blank tab's two options; adding each kind inserts the right page.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/panels/TemplateGallery.tsx src/features/editor/panels/NavPanels.tsx
git commit -m "feat(editor): visual template gallery replaces Add Page dropdown"
```

---

## Task 9: Brand-aware pickers

**Files:**
- Modify: `src/features/editor/controls/SwatchGrid.tsx`
- Modify: `src/features/editor/panels/StyleControls.tsx:54-56`

**Interfaces:**
- Consumes: `BRAND`, `BRAND_SWATCHES` from `../brand`.
- Produces: `SwatchGrid` renders a leading brand row; font `FauxSelect` shows the brand font name.

- [ ] **Step 1: Add the brand row to SwatchGrid**

Rewrite `SwatchGrid.tsx` to render brand swatches first, then a thin divider, then the general palette:

```tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDoNotEnter } from "@fortawesome/pro-regular-svg-icons";
import { SWATCHES } from "../tokens";
import { BRAND_SWATCHES } from "../brand";

/**
 * Color swatch grid. Leads with the brand palette (so on-brand choices are the
 * default path), then a divider, then the general palette. A leading "none"
 * swatch clears the color. The selected color gets a primary outline.
 */
export function SwatchGrid({
  value,
  onChange,
}: {
  value: string | null;
  onChange?: (color: string | null) => void;
}) {
  const swatch = (color: string) => (
    <button
      key={color}
      type="button"
      className={`bo-editor-swatch${value === color ? " is-selected" : ""}`}
      style={{ background: color }}
      aria-label={color}
      onClick={() => onChange?.(color)}
    />
  );
  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex flex-wrap" style={{ gap: 2 }}>
        <button
          type="button"
          className={`bo-editor-swatch${value === null ? " is-selected" : ""}`}
          aria-label="No color"
          onClick={() => onChange?.(null)}
        >
          <FontAwesomeIcon icon={faDoNotEnter} style={{ fontSize: 12 }} />
        </button>
        {BRAND_SWATCHES.map(swatch)}
      </div>
      <div style={{ height: 1, background: "#eceef2" }} />
      <div className="d-flex flex-wrap" style={{ gap: 2 }}>
        {SWATCHES.map(swatch)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lead the font picker with brand fonts**

In `StyleControls.tsx`, add `import { BRAND } from "../brand";` and update the Font `FauxSelect` (line ~55) to name the brand fonts:

```tsx
          <FauxSelect value={style.fontFamily === BRAND.fonts.heading ? "PT Serif (Brand)" : "Proxima Nova (Brand)"} />
```

- [ ] **Step 3: Typecheck + build**

Run: `bunx tsc --noEmit`
Expected: no errors.

Run: `bun --bun run build`
Expected: build succeeds.

- [ ] **Step 4: Ask the user to verify in the app**

Ask the user to select a text block and confirm the Color picker shows a brand row above the general palette, and the Font field reads the brand font name.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/controls/SwatchGrid.tsx src/features/editor/panels/StyleControls.tsx
git commit -m "feat(editor): brand-aware color + font pickers"
```

---

## Task 10: Full regression pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `bun --bun run test`
Expected: PASS — `brand.test.ts`, `templates.test.ts`, `underwritingPages.test.ts`.

- [ ] **Step 2: Typecheck and build**

Run: `bunx tsc --noEmit && bun --bun run build`
Expected: both succeed with no errors or warnings.

- [ ] **Step 3: Ask the user for a final editor walkthrough**

Ask the user to confirm: the sample 25-page proposal still renders; Add Page → gallery works across all categories; on-brand blank inserts a scaffolded brand page; new blocks default to the brand font/ink; the color picker's brand row applies brand colors.

- [ ] **Step 4: Commit any final touch-ups (if needed)**

```bash
git add -A
git commit -m "chore(editor): regression fixes for templates + on-brand blank"
```

---

## Self-Review Notes

- **Spec coverage:** brand layer (Task 1-2), template registry + ~7 templates (Task 3-4), gallery modal with live previews (Task 7-8), on-brand blank with all four guardrails — brand defaults (Task 2), brand pickers (Task 9), logo header + scaffold (Task 5), store wiring (Task 6), tests (Tasks 1/3/5 + Task 10). All spec sections map to tasks.
- **Circular imports:** avoided by making `brand.ts` a leaf and having `blockFactory` re-export its fonts.
- **Back-compat:** `PresetKey`, `PRESETS`, `buildPresetPage`, `LOGO_SRC` all retained so `store.ts` / `NavPanels.tsx` / other consumers compile through the refactor.
- **Guardrail note:** the "brand palette in pickers" and "brand block defaults" apply globally (all pages), which is intentional for the demo; the on-brand-blank distinction is the logo + scaffold + freeform seed.
