# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repo is the **Buildout Prototype Template** — use it to quickly build UI prototypes that match Buildout's branding and design system. New pages, components, and interactions should always use Blueprint React components and Buildout tokens.

## Important

DO NOT USE Playwright to test things. Run what you can, otherwise ask the user to test.

## Commands

**Package manager:** Bun — always use `bun --bun run` to use Bun's native JS engine.

```bash
bun install              # Install dependencies (requires tokens in .env)
bun --bun run dev        # Dev server at http://localhost:3000
bun --bun run build      # Production build → dist/ (self-contained Node server)
bun --bun run test       # Run tests (Vitest)
```

## Environment Setup

Copy `.env.sample` → `.env` and fill in before installing:
- `GITHUB_TOKEN` — GitHub PAT for `@buildoutinc` packages via GitHub npm registry
- `FONTAWESOME_PRO_TOKEN` — FontAwesome Pro token for `@fortawesome` Pro packages

Both are consumed by `bunfig.toml` to authenticate private registries.

## Architecture

**Stack:** React 19 · TypeScript · TanStack Start (SSR meta-framework) · Vite 8 · Nitro server adapter

**Routing** is file-based under `src/routes/`:
- `__root.tsx` — global shell (HTML head, Blueprint theme import, TanStack devtools)
- `index.tsx` — home page (`/`)
- `routeTree.gen.ts` — **auto-generated, never edit** (regenerated on dev/build)
- `router.tsx` — router instantiation

**Path aliases** (both work):
- `#/` → `src/`

**Server functions:** Use `createServerFn` from `@tanstack/start` to colocate server-side logic with routes. Nitro bundles a portable Node.js server into `dist/`.

## Prototype index

`src/routes/index.tsx` is the **prototype directory** — it lists every prototype in the project as a navigable card. Whenever a new prototype page is added, also add a card to the index that links to it. The card should show the prototype's name and a short description of what it demonstrates.

Use the TanStack Router `<Link>` component for navigation, not `<a>` tags:

```tsx
import { Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardBody } from '@buildoutinc/blueprint-react/ui/Card'

<Link to="/your-prototype-path">
  <Card>
    <CardHeader><CardTitle>Prototype Name</CardTitle></CardHeader>
    <CardBody>Short description of what this prototype demonstrates.</CardBody>
  </Card>
</Link>
```

> The app shell/layout will live in a separate folder. The index page and prototype routes should not include their own navigation chrome — that will be handled by the layout.

## Design System

All UI should use **Blueprint React** components (`@buildoutinc/blueprint-react`). Full documentation and component reference: **https://buildoutinc.github.io/blueprint/llms.txt**

Import components from the `ui` subpath:
```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/button"
import { Card } from "@buildoutinc/blueprint-react/ui/card"
```

Blueprint theme is globally applied via `src/main.scss`:
```scss
@import "@buildoutinc/blueprint-theme/scss/theme";
```

**Component categories available:** Buttons, Cards, Forms (Input, Textarea, Checkbox, RadioGroup, Select, Combobox, Switch), Layout (Accordion, Tabs, Table, List, Separator), Navigation (Breadcrumb, Navbar, Sidebar, Pagination), Overlays (Dialog, Modal, Popover, Tooltip), Feedback (Alert, Badge, Banner, Toast, Progress), Data display (Avatar, Calendar, Carousel, Empty, Placeholder).

Use Bootstrap utility classes for spacing, typography, and layout — the Blueprint theme extends Bootstrap 5.

## Icons

Use **FontAwesome Pro** icons. All four packages are available:
```tsx
import { faHouse } from "@fortawesome/pro-regular-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

<FontAwesomeIcon icon={faHouse} />
```

**Default to `pro-regular` for all icons.** Use `pro-duotone` for Alert and Banner components. Other weights (solid, light) are case-by-case.

## Skills

Use these skills when working in this prototype:
- `/new-page` — scaffold a new route with Blueprint layout
- `/blueprint` — get component guidance and usage examples, use this always first for UI before doing custom elements.
- `/icons` — find the right FontAwesome icon for a use case
- `/prototype-review` — check consistency and branding before shipping
