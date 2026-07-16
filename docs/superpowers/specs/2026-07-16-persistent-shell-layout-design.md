# Persistent Shell Layout — Design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan

## Problem

When the user opens the AI assistant rail and then navigates to a page in a
different top-level section, the chat session resets — the panel reopens empty
instead of preserving the conversation.

### Root cause

`AppShell` (which renders `<AssistantSidebar />`) is not mounted once at a shared
root. It is set as the `component` of **each top-level section route** — seven
sibling routes directly under `__root`, each with its own `AppShell` instance:

- `src/routes/suite.tsx`
- `src/routes/listings.tsx`
- `src/routes/email.tsx`
- `src/routes/backoffice.tsx`
- `src/routes/editor.tsx`
- `src/routes/properties.tsx`
- `src/routes/app.tsx`

Consequences:

- **Within a section** (e.g. `/listings` → `/listings/$listingId`): the same
  `AppShell` instance stays mounted, only the `<Outlet/>` content swaps — the
  chat persists. ✅
- **Across sections** (e.g. `/listings` → `/email`): TanStack Router unmounts the
  old section's `AppShell` subtree and mounts a new one, remounting
  `AssistantSidebar`. Its conversation lives in `useChat`'s local React state
  (`AssistantSidebar.tsx:227`), not in a store, so it is destroyed. The `open`
  flag survives (it lives in the module-level Zustand store `useAssistant`), so
  the panel reopens — but empty. ❌

There is no explicit "close on navigation" code; the reset is purely a side
effect of the cross-section remount. The same remount also rebuilds the global
navbar, omni-search, and global modals on every cross-section navigation.

## Goals

- The AI assistant rail and its live chat session persist across **all**
  navigation, including between top-level sections.
- Per-section content layout stays free to vary (contained pages, full-bleed
  editor). We are **not** unifying page layouts.
- Minimal, low-risk change: no page's internal layout is rewritten.

## Non-goals

- Persisting in-flight streaming state across a hard reload (out of scope; the
  fix targets client-side navigation).
- Introducing a central layout-config system. Each page keeps owning its own
  content shape (decided in an earlier design discussion — "Option A").
- Changing `/` (prototype directory) or `/login`, which intentionally render
  without app chrome.

## Approach

Insert **one pathless layout route**, `_shell.tsx`, between `__root` and the
section routes. It mounts the persistent chrome once. All sections nest under it,
so navigating between them swaps only the `<Outlet/>` content — the navbar, the
AI rail, and its `useChat` session never unmount.

### Why not edit `__root.tsx`?

`__root.tsx` is the only other common ancestor, but it is **CLI-managed** — the
bo-spark CLI overwrites it (see the banner comment at the top of the file). Any
durable shell code there would be wiped. A pathless layout route is a normal,
CLI-safe route file we own.

`_shell` is pathless (its name starts with `_`), so it contributes no URL
segment: `/listings`, `/backoffice/contacts/123`, etc. resolve exactly as today.

## Design

### Route structure

```
routes/
  __root.tsx                 (unchanged — auth beforeLoad + HTML shell)
  index.tsx                  (unchanged — prototype directory, no chrome)
  login.tsx                  (unchanged — no chrome)
  _shell.tsx                 NEW  → component: AppShell (persistent chrome, ONE mount)
  _shell/
    suite.tsx      + suite/…
    listings.tsx   + listings/…
    backoffice.tsx + backoffice/…
    email.tsx      + email/…
    editor.tsx     + editor/…
    properties.tsx + properties/…
    app.tsx        + app/…
```

Every section directory and its layout file move verbatim from `routes/` into
`routes/_shell/`. URLs are unchanged because `_shell` is pathless.

### Component changes

- **`src/components/layout/AppShell.tsx`** — unchanged in content. It already
  renders `GlobalNavbar` + `<main className="app-shell__main flex-grow-1
  overflow-auto"><Outlet/></main>` + `<AssistantSidebar/>` + `OmniSearch` +
  global modals, all behind the `hydrated` gate. It changes only in *where* it is
  mounted: once, by `_shell.tsx`, instead of per-section. `<main>` stays the bare
  scroll slot so pages keep owning their own layout (contained / full-bleed).

- **`src/routes/_shell.tsx`** (new):
  ```tsx
  import { createFileRoute } from "@tanstack/react-router";
  import { AppShell } from "#/components/layout/AppShell";

  export const Route = createFileRoute("/_shell")({
    component: AppShell,
  });
  ```

- **Each moved section layout file** (`_shell/listings.tsx`, `_shell/email.tsx`,
  `_shell/backoffice.tsx`, `_shell/editor.tsx`, `_shell/properties.tsx`,
  `_shell/suite.tsx`, `_shell/app.tsx`) — drops `component: AppShell` and becomes
  a bare `<Outlet/>` passthrough so its child routes still render:
  ```tsx
  import { createFileRoute, Outlet } from "@tanstack/react-router";

  export const Route = createFileRoute("/_shell/listings")({
    component: Outlet,
  });
  ```
  (The `createFileRoute` path string is auto-managed by the router plugin and
  regenerates to match the new file location.)

### Data flow (unchanged, now correct)

- `open` / `pendingPrompt` continue to live in the module-level `useAssistant`
  Zustand store.
- Chat messages continue to live in `useChat` local state inside
  `AssistantSidebar` — but that component is now under a shell that never
  remounts across sections, so the messages survive navigation.

## What this fixes

- **Primary:** the AI chat session persists through every page change, including
  cross-section navigation.
- **Incidental:** the global navbar, omni-search, and global modals also stop
  remounting on cross-section navigation.

## Risks & mitigations

- **`routeTree.gen.ts` is auto-generated** — never hand-edited. It regenerates on
  `bun --bun run dev` / `build`, and the plugin rewrites the moved routes' path
  strings automatically.
- **File moves** use `git mv` at the directory level to preserve history and
  avoid missing nested files (e.g. the ~15 files under
  `listings/$listingId/`).
- **Stale generated tree** — if the dev server is running during the move, a
  restart may be needed to regenerate cleanly.

## Verification

Run `bun --bun run dev`, then:

1. **Session persistence (the bug):** open the AI rail, send a message, then
   navigate listings → back office → editor → dashboard. The conversation must
   remain intact throughout.
2. **Within-section still works:** navigate `/listings` → a specific deal → a
   deal sub-tab; confirm no regressions.
3. **URLs unchanged:** every section loads at its existing URL
   (`/suite`, `/listings`, `/backoffice/contacts`, `/editor/$listingId`, etc.).
4. **Chrome-less routes unaffected:** `/` (prototype directory) and `/login`
   render without nav/rail as before.
5. **No new TypeScript / dev-server warnings** introduced by the move.
