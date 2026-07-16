# Persistent Shell Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount the app chrome (global nav + AI assistant rail + global modals) once via a single pathless layout route so the AI chat session persists across all navigation, including between top-level sections.

**Architecture:** Introduce one pathless layout route `_shell.tsx` (`component: AppShell`) between `__root` and the seven top-level section routes. Move every section (`suite`, `listings`, `email`, `backoffice`, `editor`, `properties`, `app`) — layout file plus its directory — under `routes/_shell/`, and convert each section's layout file from `component: AppShell` to a bare `component: Outlet` passthrough. Because `_shell` is pathless it adds no URL segment, so all existing URLs are unchanged; because `AppShell` is now mounted once, `AssistantSidebar` (and its `useChat` state) never remounts on cross-section navigation.

**Tech Stack:** TanStack Start / React Router (file-based routing, Vite plugin auto-generates `routeTree.gen.ts`), React 19, TypeScript, Bun, Biome.

## Global Constraints

- **Package manager:** always use `bun --bun run <script>` (Bun native engine).
- **URLs must not change.** `/suite`, `/listings`, `/listings/$listingId`, `/backoffice/contacts`, `/backoffice/contacts/$contactId`, `/email`, `/email/$emailId`, `/editor/$listingId`, `/properties`, `/properties/$propertyId`, `/app` must all resolve exactly as before.
- **Never hand-edit `src/routes/routeTree.gen.ts`** — it is auto-generated; the Vite plugin regenerates it (and rewrites moved files' `createFileRoute("/…")` id strings) on dev/build.
- **Never edit `src/routes/__root.tsx`** — it is CLI-managed (bo-spark overwrites it).
- **Do not modify any page component's internals.** This refactor only moves files and changes the seven section layout files' `component`. Page bodies, JSX, logic, and imports stay untouched.
- **No Playwright.** Run what can be run (`build`, `check`); the human performs the interactive smoke test.
- **Use `git mv`** for all relocations to preserve history.

---

### Task 1: Create `_shell` and move all sections under it (single commit)

Create the persistent-chrome mount point **and** relocate the seven sections under it in one atomic change. These cannot be split: a pathless `_shell` route with **no children** matches `/` and collides with the root `index.tsx` (the build fails, or the router ambiguously serves `/`). `_shell` must be born with real-path children, and `index.tsx` must stay at the root (chrome-less). A half-moved state would also nest `AppShell` inside `AppShell` (double nav/rail) for any section still self-mounting. After this task, `AppShell` is mounted exactly once (by `_shell`) and `/` still renders without chrome.

**Files:**
- Create: `src/routes/_shell.tsx` (`component: AppShell`)
- Move (layout files): `src/routes/{suite,listings,email,backoffice,editor,properties,app}.tsx` → `src/routes/_shell/{…}.tsx`
- Move (directories, with all nested children): `src/routes/{suite,listings,email,backoffice,editor,properties,app}/` → `src/routes/_shell/{…}/`
- Modify (after move): each of the seven moved layout files — change `component: AppShell` → `component: Outlet`, update imports, update the `createFileRoute` id.
- **Stays put (do NOT move):** `src/routes/index.tsx` (prototype directory, `/`, chrome-less), `src/routes/login.tsx`, `src/routes/__root.tsx`.
- Regenerated: `src/routes/routeTree.gen.ts`
- Untouched: every page/leaf file's body (only their auto-managed `createFileRoute` id string is rewritten by the plugin).

**Interfaces:**
- Consumes: `AppShell` from `#/components/layout/AppShell` (existing; renders `GlobalNavbar` + `<main><Outlet/></main>` + `<AssistantSidebar/>` + `OmniSearch` + global modals behind the `hydrated` gate — used as-is, not modified).
- Produces: a pathless layout route `/_shell` rendering `AppShell`, with sections nested at ids `/_shell/suite`, `/_shell/listings`, etc. URL paths unchanged (`/suite`, `/listings`, …); `/` unchanged and chrome-less.

- [ ] **Step 1: Create the pathless layout route file**

Create `src/routes/_shell.tsx` with exactly:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "#/components/layout/AppShell";

export const Route = createFileRoute("/_shell")({
  component: AppShell,
});
```

- [ ] **Step 2: Move every section into `_shell/` (keep `index.tsx` at root)**

```bash
mkdir -p src/routes/_shell
for s in suite listings email backoffice editor properties app; do
  git mv "src/routes/$s.tsx" "src/routes/_shell/$s.tsx"
  git mv "src/routes/$s"      "src/routes/_shell/$s"
done
```

- [ ] **Step 3: Verify the move — sections moved, `index.tsx` still at root**

Run:
```bash
ls src/routes/_shell
test -f src/routes/index.tsx && echo "OK: index.tsx still at root (chrome-less)" || echo "ERROR: index.tsx missing from root"
ls src/routes | grep -E '^(suite|listings|email|backoffice|editor|properties|app)(\.tsx)?$' || echo "OK: no section files remain at routes/ top level"
```
Expected: `src/routes/_shell` lists all 7 `.tsx` files and 7 directories; `index.tsx` is still at root; no section files remain directly under `routes/`. If `index.tsx` is NOT at root, move it back: `git mv src/routes/_shell/index.tsx src/routes/index.tsx`.

- [ ] **Step 4: Convert each moved section layout file to an Outlet passthrough**

For each of the seven files `src/routes/_shell/<section>.tsx`, replace the entire contents so it renders `<Outlet/>` instead of `AppShell`. Example for `src/routes/_shell/listings.tsx`:

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/listings")({
  component: Outlet,
});
```

Apply the identical pattern to the other six, changing only the id string:
- `src/routes/_shell/suite.tsx` → `createFileRoute("/_shell/suite")`
- `src/routes/_shell/email.tsx` → `createFileRoute("/_shell/email")`
- `src/routes/_shell/backoffice.tsx` → `createFileRoute("/_shell/backoffice")`
- `src/routes/_shell/editor.tsx` → `createFileRoute("/_shell/editor")`
- `src/routes/_shell/properties.tsx` → `createFileRoute("/_shell/properties")`
- `src/routes/_shell/app.tsx` → `createFileRoute("/_shell/app")`

- [ ] **Step 5: Regenerate the route tree (also rewrites child `createFileRoute` ids)**

Start the dev server so the plugin regenerates `routeTree.gen.ts` and auto-updates the `createFileRoute("/…")` id in every moved child file to include the `_shell` prefix:

Run: `bun --bun run dev` (in the background; wait until it logs the server is ready at http://localhost:3000, then stop it)

- [ ] **Step 6: Confirm no stale route ids remain in moved files**

Run:
```bash
grep -rn 'createFileRoute("/' src/routes/_shell | grep -v '"/_shell' || echo "OK: all moved routes are under /_shell"
```
Expected: prints `OK: …`. If any line is listed, the plugin did not rewrite it — manually change that file's `createFileRoute("/<path>")` to `createFileRoute("/_shell/<path>")` and re-run this step.

- [ ] **Step 7: Confirm AppShell is mounted only once**

Run: `grep -rln "AppShell" src/routes`
Expected: only `src/routes/_shell.tsx` (no section file imports `AppShell` anymore).

- [ ] **Step 8: Build to verify types and route resolution**

Run: `bun --bun run build`
Expected: build succeeds. `routeTree.gen.ts` nests the sections under `_shell`, and `IndexRoute` remains a direct child of the root route (not under `_shell`). (This project has pre-existing TypeScript issues unrelated to this change; `vite build` does not fail on them — success = the command completes and produces the build output.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: mount AppShell once via _shell so the AI rail persists across navigation"
```

---

### Task 2: Verification pass

Confirm the bug is fixed and nothing regressed. The interactive check is performed by the human (no Playwright).

**Files:** none (verification only).

- [ ] **Step 1: Static checks**

Run: `bun --bun run build && bun --bun run check`
Expected: build succeeds; Biome reports no new errors introduced by this change.

- [ ] **Step 2: Route-id sanity**

Run:
```bash
grep -rn 'createFileRoute("/' src/routes/_shell | grep -v '"/_shell' || echo "OK"
grep -rln "AppShell" src/routes
```
Expected: first prints `OK`; second lists only `src/routes/_shell.tsx`.

- [ ] **Step 3: Hand off the interactive smoke test to the human**

Start the app (`bun --bun run dev`) and ask the human to confirm:
1. **The bug is fixed:** open the AI assistant rail, send a message, then navigate listings → back office → editor → dashboard. The conversation stays intact throughout (no reset to empty).
2. **Within-section navigation still works:** `/listings` → a specific deal → a deal sub-tab; no regressions.
3. **URLs unchanged:** every section loads at its existing URL (`/suite`, `/listings`, `/backoffice/contacts`, `/editor/$listingId`, `/properties`, `/app`, …).
4. **Chrome-less routes unaffected:** `/` (prototype directory) and `/login` render without nav/rail as before.

- [ ] **Step 4: Leave the branch for the human to merge**

Do not push, merge, or open a PR. Report completion and the verification results; the human owns integration.

---

## Self-Review

**Spec coverage:**
- Root cause (per-section `AppShell` mount) → fixed by Task 1 (single `_shell` mount) + Task 2 (sections nested, section files → `Outlet`). ✅
- Goal: AI rail/session persists across sections → Task 2 + Task 3 Step 3.1. ✅
- Goal: per-section layouts unchanged → guaranteed by "do not modify page internals" constraint; only section layout files change. ✅
- Non-goal: no central layout config, no page rewrites → honored (Option A: `AppShell`'s `<main>` stays a bare scroll slot). ✅
- Non-goal: `/` and `/login` untouched → verified in Task 3 Step 3.4; they were never moved. ✅
- Risk: `routeTree.gen.ts` regeneration → handled in Task 2 Steps 4–5, never hand-edited. ✅
- Risk: file moves preserve history → `git mv` used throughout. ✅
- Impact on moved files (only auto-managed id string changes; imports use `#/` alias; no route-id references; navigation uses URL paths) → confirmed during design; reflected in the "Untouched" note and Step 5/6 guards. ✅

**Placeholder scan:** no TBD/TODO; every code step shows exact file contents or exact commands. ✅

**Type/name consistency:** `_shell` id used consistently (`/_shell`, `/_shell/<section>`); `component: Outlet` (from `@tanstack/react-router`) used consistently; `AppShell` import path `#/components/layout/AppShell` matches the existing file. ✅
