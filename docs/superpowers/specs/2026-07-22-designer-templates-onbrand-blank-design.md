# Designer Templates + On-Brand Blank Pages — Design

**Date:** 2026-07-22
**Area:** Document editor (`src/features/editor/`)
**Status:** Approved, ready for implementation planning

## Goal

Improve the document editor prototype so it demonstrates two complementary
experiences and the spectrum between them:

1. **Designer/brand templates** — polished, on-brand pages made by the design
   team. Users add them and edit the *content*; the *layout* is fixed.
2. **On-brand blank pages** — a new authoring experience that gives users full
   control over look and placement, while smart defaults and curated choices
   keep anything they add from deviating much from their brand.

The narrative to land: the *same brand* drives both the locked templates and
the guardrails on the blank page. Users start fast from a professional
template, then customize — and when they do need a fresh page, it still looks
on-brand effortlessly.

## Scope

**In scope:** the editor experience only —
- A visual template gallery for discovering and adding designer templates.
- A curated library of ~7 designer templates.
- The on-brand blank page kind and its brand guardrails.
- A shared brand layer that both features read from.

**Out of scope (deferred):**
- The company-settings **brand kit** management UI. The brand lives there
  eventually; for this spec it is seeded/hardcoded in the editor and merely
  *referenced*.
- The deal-creation "opt into specific documents" step. That flow already
  largely exists (Create Deal wizard + Suggested Documents) and is treated as
  adjacent — we do not modify it here.

## Current state (context)

- `presets.ts` exposes a flat `PRESETS` list `[{key, label}]` with two locked
  templates (`financialSummary`, `propertyOverview`), plus `buildBlankPage()`,
  stub/divider builders, and `buildDocumentPages()` (the 25-page sample
  proposal).
- `store.ts` — `addPage: (kind: "blank" | PresetKey, atIndex?) => void`.
- `NavPanels.tsx` — the Pages panel's **Add Page** dropdown lists Blank + the
  presets as plain text items.
- Page model already distinguishes `locked` (designer/fixed layout, editable
  content) from freeform pages — the data foundation for the spectrum exists.
- Blocks: heading, text, image, table, dynamic, columns, section, spacer,
  divider. Images use `getPhotoUrl` (curated CRE photos).
- `SwatchGrid` (functional color picker) reads `SWATCHES` from `tokens.ts`.
  Font selection uses `FauxSelect` (display-only in the prototype).
- `PageView` renders a page; block views are store-coupled only via
  subscriptions and setters, so a non-interactive scaled wrapper can render a
  faithful preview without duplicating the renderer.

## Approach

Approach A — **central brand layer + live preview thumbnails**. One brand
module is the single source of truth; templates become a metadata-rich
registry; the gallery renders live scaled previews of the real pages; the
on-brand blank page and the pickers all read the brand. Chosen because it is
the only approach where the brand is a visible throughline, and live thumbnails
keep the prototype honest with minimal maintenance.

## Design

### 1. Brand layer — new `src/features/editor/brand.ts`

Single source of truth for the demo brand ("Meridian Point Real Estate,"
matching the name shown in the
existing document logo). Exports:

```ts
export const BRAND = {
  name: "Meridian Point Real Estate",
  logoSrc: "/assets/branding/gemini-logo.png",
  fonts: { heading: SERIF, body: SANS }, // reuse existing SERIF / SANS
  palette: {
    primary: "#7422ce",   // existing editor primary
    secondary: "#4b1a8f",  // darker brand purple (finalize at build)
    accent: "#00bc7d",     // existing editor success/accent green
    ink: "#22262f",        // existing editor ink
    neutral: "#506079",    // existing editor muted
    surface: "#f9f5ff",    // existing editor primarySoft
  },
};

/** Brand palette as an ordered swatch list for the pickers. */
export const BRAND_SWATCHES: string[] = [/* Object.values(BRAND.palette) */];
```

`SERIF`/`SANS` are reused (re-exported or imported) so brand fonts have one
home. This module is intentionally shaped to become the seed for the future
company-settings brand kit.

### 2. Template registry — refactor `presets.ts`

Replace the flat `PRESETS` list with a `TEMPLATES` registry. Each entry:

```ts
interface TemplateDef {
  key: string;
  name: string;
  category: "Cover" | "Financials" | "Property" | "Location" | "Comparables" | "Team";
  description: string;
  build: (property?: Property) => Page;
}
```

Curated **~7 templates**, each a genuinely distinct, more-designed layout built
from the existing block system and styled from `BRAND`:

1. **Cover** — full-bleed hero image, brand logo, large serif title, address,
   deal-stat strip.
2. **Financial Hero** — headline metric callouts + financial table.
3. **Property Overview** — evolve the current preset: magazine two-column +
   highlights table.
4. **Location & Map** — map image + submarket/city dynamic fields + narrative.
5. **Comparables Grid** — multi-column comps with photos.
6. **Advisor Bios** — team columns: photo + name + role + blurb.
7. **Section Divider** — branded divider (centered title on a brand-color band).

`buildDocumentPages()` continues to work by referencing registry entries
(the existing sample proposal must render unchanged).

### 3. Gallery modal — new `TemplateGallery.tsx`

A Blueprint `Modal`/`Dialog` opened by the Pages panel **Add Page** button,
replacing the current dropdown.

- Left: category list (Cover, Financials, Property, Location, Comparables,
  Team, Blank).
- Right: a grid of template cards. Each card shows a **live scaled preview** of
  the real page via a thin non-interactive `PagePreview` wrapper around
  `PageView` (CSS `transform: scale(...)`, `pointer-events: none`,
  `selection={null}`). Templates are built with the current `activeListing`.
- Clicking a card calls `addPage(key, atIndex)` and closes the modal.
- The **Blank** category holds two entries: plain **Blank** and **On-brand
  blank** (with a short "stays in your brand" note).

### 4. On-brand blank page + brand-aware pickers

- Store `addPage` kind widens to `"blank" | "onBrandBlank" | <templateKey>`.
- `buildOnBrandBlankPage()`: `locked: false`, `logoSrc: BRAND.logoSrc`, seeded
  with a brand title heading block + a **light column-guide scaffold** (a faint
  two-column hint) — everything deletable, so the user keeps full freeform
  control.
- **Brand-styled block defaults:** `blockFactory` / `DEFAULT_TEXT_STYLE` point
  at `BRAND.fonts` and `BRAND.palette.ink` so any newly added block starts
  on-brand. (Applies as the global default, which is intended.)
- **Brand palette in pickers:** `SwatchGrid` gains an optional leading
  **Brand** swatch row from `BRAND_SWATCHES`, a divider, then the existing
  general `SWATCHES`. The font `FauxSelect` leads with the brand fonts
  (display-only, matching current prototype fidelity).

### 5. Wiring & tests

- `store.addPage` switch handles the three kinds; the Pages panel opens the
  gallery instead of the dropdown.
- No new route — all changes live inside the existing editor.
- Tests (Vitest; **no Playwright**, per repo policy):
  - Every template in the registry builds without throwing.
  - `buildOnBrandBlankPage()` is `locked: false`, carries the brand logo, and
    its heading uses the brand heading font.
  - `buildDocumentPages()` still returns the expected page set.

## Units and boundaries

- **`brand.ts`** — pure data. No dependencies on editor state. Consumed by
  templates, blockFactory defaults, and pickers.
- **`presets.ts` template registry** — pure builders `(property?) => Page`.
  Depends on `brand.ts`, block builders, `getPhotoUrl`.
- **`TemplateGallery.tsx` / `PagePreview`** — presentation only. Depends on the
  registry (to enumerate/build) and `PageView` (to render). Emits an
  `addPage(key)` intent; owns no page state.
- **`store.addPage`** — the single mutation entry point for adding any page
  kind. Gallery and any other caller go through it.

## Risks / notes

- Live previews render real pages outside the document; the wrapper must be
  fully non-interactive (`pointer-events: none`, `selection={null}`) so store
  setters never fire and the `PageToolbar` popover stays closed.
- Template layouts must use only existing block types; if a template needs a
  layout the block system can't express, simplify the template rather than
  extend the block model (out of scope).
- Changing `DEFAULT_TEXT_STYLE` to brand fonts affects all new blocks globally —
  intended, but verify the sample proposal and existing pages still read
  correctly.
