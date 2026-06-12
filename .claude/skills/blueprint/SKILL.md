---
name: blueprint
description: Install, configure, and build polished pages with the Buildout Blueprint design system (@buildoutinc/blueprint-theme + @buildoutinc/blueprint-react) in a consuming app. Use when setting up registry auth, installing the packages, importing the theme SCSS, wiring FontAwesome Pro, choosing components, or composing pages/features that should look intentional and on-brand.
---

This skill covers two things at once: (1) **integrating** the Blueprint design system (`@buildoutinc/blueprint-theme` + `@buildoutinc/blueprint-react`) into a consuming app outside this monorepo, and (2) **using** those primitives to build pages that look intentional rather than generic.

## When to use

Trigger this skill when the user is:

- Setting up Blueprint in a new or existing app (Next.js, Vite, Remix, etc.).
- Asking how to authenticate against the GitHub Packages registry, install the packages, or import the theme.
- Debugging missing styles, missing icons, or import errors involving `@buildoutinc/...`.
- Building a UI page or feature in a project that already consumes Blueprint — even if the question is purely about layout, copy, or composition.
- The user mentions anything about using a component or mentions any name that matches a Blueprint component name.

## Looking up details (read this first)

This skill is deliberately short. For anything not covered inline — full component APIs, every prop variant, exact SCSS variable names, the color scale — fetch the live docs via `WebFetch`:

- **Index of every doc page**: `https://buildoutinc.github.io/blueprint/llms.txt`
- **Per-component pages**: `https://buildoutinc.github.io/blueprint/llm/docs/components/<kebab-name>.mdx` — e.g. `button.mdx`, `dropdown-menu.mdx`, `radio-group.mdx`. Each page contains props, variants, and working sample usage.
- **Style / theming pages**: `https://buildoutinc.github.io/blueprint/llm/docs/styles/<topic>.mdx` where `<topic>` is one of `customization`, `colors`, `typography`, `breakpoints`, `shadows`, `css-layers`, `bootstrap-classes`.

The MDX files include real import statements and live samples — adapt them directly rather than guessing.

## 1. Registry & auth (GitHub Packages)

The `@buildoutinc` packages are private and live on GitHub Packages. The consuming app needs an `.npmrc` at the project root:

```
@buildoutinc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` must be a Personal Access Token with `read:packages` scope. CI must export the same token before running install.

## 2. Install

```bash
pnpm add @buildoutinc/blueprint-theme @buildoutinc/blueprint-react \
  @fortawesome/fontawesome-pro \
  @fortawesome/react-fontawesome \
  @fortawesome/pro-regular-svg-icons \
  @fortawesome/pro-solid-svg-icons \
  @fortawesome/pro-duotone-svg-icons
```

(Or `npm install` / `yarn add` — same package list.)

Notes:

- `bootstrap` is a transitive dependency of the theme; do **not** install it directly.
- React peer deps: `react` and `react-dom` (any of 17, 18, or 19).
- The FontAwesome Pro packages are required peer deps of the React package; without them, components that render icons (Modal, Combobox, etc.) will fail to build.

## 3. Load the theme (SCSS only)

The consuming app **must** import the theme's SCSS source from its global stylesheet:

```scss
// e.g. app/globals.scss, src/styles.scss, app/root.scss
@import "@buildoutinc/blueprint-theme/scss/theme";
```

This requires a Sass compiler in the build pipeline — built into Next.js (with `sass` installed), Vite, and Remix. Without this import, every Blueprint component renders unstyled (the React package ships class names only, not styles).

Do **not** reference any compiled CSS artifact from the theme package. The pre-built `dist/theme.min.css` is being deprecated and will be removed in a future release; only the SCSS entry is supported going forward.

## 4. FontAwesome setup

Components import their icons inline (e.g., `import { faXmark } from '@fortawesome/pro-regular-svg-icons'`). There is **no library registration step** — once the FontAwesome Pro packages from §2 are installed, icons render automatically wherever a component uses one.

## 5. Importing components

Components use **subpath imports**, not a barrel — one import per component family:

```tsx
import { Button } from '@buildoutinc/blueprint-react/ui/Button';
import { Card } from '@buildoutinc/blueprint-react/ui/Card';
```

**Dot notation (preferred).** Compound components expose their subparts as static properties on the root, so you import only the root and access subcomponents via dot notation:

```tsx
import { Card } from '@buildoutinc/blueprint-react/ui/Card';
import { Button } from '@buildoutinc/blueprint-react/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/pro-regular-svg-icons';

export function AddItemCard() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>New item</Card.Title>
      </Card.Header>
      <Card.Body>Pick a name to get started.</Card.Body>
      <Card.Footer>
        <Button variant="primary">
          <FontAwesomeIcon icon={faPlus} />
          Add item
        </Button>
      </Card.Footer>
    </Card>
  );
}
```

The dotted name maps to the flat name by dropping the root prefix — `Card.Header` is `CardHeader`, `Card.Body` is `CardBody`, `Accordion.Item` is `AccordionItem`, `Tabs.List` is `TabsList`, and so on.

**Flat named imports still work** and remain fully supported, so existing code does not need to change:

```tsx
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@buildoutinc/blueprint-react/ui/Card';
```

Prefer dot notation for new code — it keeps import lines short and makes the component relationship explicit at the call site.

## 6. Available components

Accordion, Alert, Avatar, Badge, Banner, Breadcrumb, Button, ButtonGroup, Calendar, Card, Carousel, Checkbox, Collapsible, Combobox, Dialog, DropdownMenu, Empty, Field, Input, InputGroup, Label, List, Modal, Navbar, Offcanvas, Pagination, Placeholder, Popover, Progress, RadioGroup, Select, Separator, Sidebar, Switch, Table, Tabs, Textarea, Toast, Tooltip.

For each component's full prop API, variants, and samples, fetch the matching `/components/<kebab-name>.mdx` page.

## 7. Styling and overrides

Every component accepts a `className` prop. The package's internal `cn()` helper merges Bootstrap classes intelligently (later utilities win conflicts), so passing `className="mt-4 text-primary"` works as expected.

Bootstrap utility classes are **not prefixed** — use them as standard:

```tsx
<Card className="mt-4 d-flex flex-column gap-3 rounded-3 shadow-sm">
  <Card.Body className="text-primary">Hello</Card.Body>
</Card>
```

Component-level classes (`btn`, `card`, `modal`, etc.) also follow standard Bootstrap conventions. For tokens — colors, spacing, typography scales — read the relevant `/styles/<topic>.mdx` page rather than guessing variable names.

## 8. Designing with Blueprint (not against it)

Having a design system does not mean every page should look the same. It means primitives, color, spacing, and typography are decided for you so your creative effort can go into composition, hierarchy, and tone. Pages that ignore this — three evenly-spaced cards in a grid with the default heading and a primary button — read as generic regardless of how good the underlying components are.

Approach every UI task with a direction:

- **Pick a direction up front, before placing any component.** Editorial, dense/data-heavy, spacious/marketing, brutal/minimal, calm/utilitarian — name it. The same Blueprint primitives express very different tones depending on spacing, hierarchy, and color application.
- **Use the system's primitives, not raw HTML.** Prefer `<Button>`, `<Card>`, `<Field>`, `<Modal>` over hand-rolled equivalents. They carry accessibility, focus states, and visual conventions that match the rest of the product.
- **Make the distinctive choices in composition.** Asymmetric layouts. Deliberate negative space. A single grid-breaking element that draws the eye. A typography scale that escalates rather than sitting flat. The component library handles primitives; the work of *design* happens around them.
- **Use theme tokens, not hardcoded values.** Pull colors, spacing, and typography from documented Bootstrap utility classes and SCSS variables. This keeps the page cohesive with the rest of the product and survives theme changes.
- **Motion in service of clarity.** One well-orchestrated reveal or transition beats a dozen scattered micro-interactions. CSS-only when possible.
- **Match implementation effort to ambition.** A marketing landing page should feel crafted (typography scale, layered backgrounds, considered color application). A settings form should feel calm and functional. Both can use the same component library — the difference is intentionality.

Avoid the obvious AI defaults: Inter/Roboto everywhere, purple-gradient-on-white hero, three identical cards in a row, default heading sizes throughout. Avoid building custom button/input/card primitives when Blueprint already ships them.

## 9. Typography utilities quick reference

Blueprint extends Bootstrap's type scale with these size utilities:

| Class | Size | Use for |
|---|---|---|
| `fs-large` | 16px | Section headings, card titles, emphasis labels |
| *(default)* | 14px | Body text, table cells, form labels — **no class needed** |
| `fs-small` | 12px | Secondary metadata, timestamps, helper text |
| `fs-xs` | 10px | Badges, fine-print, tightest density |

These map directly to Figma's font-size variables. **When Figma shows `14px`, that is the default body size — do not add `fs-small`.** Only add a size class when the design intentionally steps down (12px → `fs-small`, 10px → `fs-xs`) or up (16px → `fs-large`).

Card and section header titles consistently use `fw-semibold fs-large`. Match that pattern for any `<span>` or `<p>` acting as a card section heading.

## 10. Common failure modes

- **Components render but have no styles** → the theme SCSS isn't imported, or the consuming app's build pipeline doesn't have a Sass compiler configured.
- **`401 Unauthorized` from `npm install`** → missing `.npmrc`, or `GITHUB_TOKEN` not set / lacks `read:packages`.
- **Icons render as boxes or blank glyphs** → the FontAwesome Pro packages from §2 weren't installed.
- **`Cannot find module '@buildoutinc/blueprint-react'`** → you used a barrel import. Switch to a subpath: `@buildoutinc/blueprint-react/ui/<Component>`.
- **Page looks like generic Bootstrap** → revisit §8. Pick a direction and commit to it.
