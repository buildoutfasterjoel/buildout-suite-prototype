# Account Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat account menu in the global navbar with a three-zone dropdown — identity card, product settings links, and prototype-only controls.

**Architecture:** Extract the account block out of `GlobalNavbar` into a new `AccountMenu` component, backed by a small tested pure module for persona labels and persistence. The menu composes Blueprint's `Navbar.Group*` parts with `ui/DropdownMenu` parts (separator, submenu, radio group), falling back to flat rows on mobile where Base UI's submenu has no `Menu.Root` context.

**Tech Stack:** React 19 · TypeScript · TanStack Router · Blueprint React (`@buildoutinc/blueprint-react`) · Blueprint theme SCSS · FontAwesome Pro · Vitest

**Spec:** `docs/superpowers/specs/2026-07-30-account-dropdown-design.md`

## Global Constraints

- Package manager is Bun. Always `bun --bun run <script>`.
- Type-check with `bunx tsc --noEmit`. `vite build` does **not** type-check.
- Icons default to `@fortawesome/pro-regular-svg-icons`. Never pass `fixedWidth` to `FontAwesomeIcon` — it is deprecated in this codebase.
- No margin utilities on Blueprint `Badge` icons (not relevant here, but holds repo-wide).
- Use Blueprint components and Bootstrap 5 utility classes. No Tailwind.
- Vitest runs in the **node** environment (no `test` block in `vite.config.ts`), so there is no `localStorage` or `window` global in tests. Anything storage-backed must accept an injectable store.
- Do not change the visual design of anything outside the account dropdown.
- Do not merge, push, or open a PR. Leave the branch as-is when done.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/layout/accountMenu.ts` | **Create.** Pure module: `Persona` type, labels, ordering, localStorage read/write, identity-line formatting. No React. |
| `src/components/layout/accountMenu.test.ts` | **Create.** Unit tests for the pure module. |
| `src/data/teammates.ts` | **Modify.** Add optional `company` to `Teammate`; set it on `CURRENT_USER`. |
| `src/components/layout/AccountMenu.tsx` | **Create.** The trigger + three-zone dropdown. Owns persona state and the reset-demo handler. |
| `src/components/layout/GlobalNavbar.tsx` | **Modify.** Delete the inline account block and its now-dead state/handlers/imports; render `<AccountMenu />`. |
| `src/main.scss` | **Modify.** Divider token fix and identity-card layout, both at top level (the dropdown is portaled to `body`, so it is **not** inside `.global-navbar`). |

---

## Task 1: Persona model and current-user company

**Files:**
- Create: `src/components/layout/accountMenu.ts`
- Create: `src/components/layout/accountMenu.test.ts`
- Modify: `src/data/teammates.ts:12-22` (interface), `src/data/teammates.ts:34-41` (`CURRENT_USER`)

**Interfaces:**
- Consumes: nothing.
- Produces, all imported by Task 2:
  - `type Persona = "principal" | "broker" | "marketing"`
  - `const PERSONA_ORDER: readonly Persona[]`
  - `const PERSONA_LABELS: Record<Persona, string>`
  - `type PersonaStore = Pick<Storage, "getItem" | "setItem">`
  - `function readPersona(store?: PersonaStore | null): Persona`
  - `function writePersona(persona: Persona, store?: PersonaStore | null): void`
  - `function identityLine(persona: Persona, company?: string): string`
  - `Teammate.company?: string` on `CURRENT_USER` (value `"Buildout"`)

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/accountMenu.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PERSONA_LABELS,
  PERSONA_ORDER,
  identityLine,
  readPersona,
  writePersona,
  type PersonaStore,
} from "./accountMenu";

/** Map-backed stand-in for localStorage — Vitest runs in the node env. */
function fakeStore(initial?: Record<string, string>): PersonaStore {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("persona labels", () => {
  it("labels every persona in display order", () => {
    expect(PERSONA_ORDER.map((p) => PERSONA_LABELS[p])).toEqual([
      "Principal",
      "Broker",
      "Marketing",
    ]);
  });
});

describe("readPersona", () => {
  it("defaults to principal when nothing is stored", () => {
    expect(readPersona(fakeStore())).toBe("principal");
  });

  it("returns the stored persona", () => {
    expect(readPersona(fakeStore({ dev_role: "marketing" }))).toBe("marketing");
  });

  it("falls back to principal when the stored value is not a persona", () => {
    expect(readPersona(fakeStore({ dev_role: "wizard" }))).toBe("principal");
  });

  it("falls back to principal when there is no store (SSR)", () => {
    expect(readPersona(null)).toBe("principal");
  });
});

describe("writePersona", () => {
  it("persists under the dev_role key", () => {
    const store = fakeStore();
    writePersona("broker", store);
    expect(store.getItem("dev_role")).toBe("broker");
  });

  it("is a no-op without a store", () => {
    expect(() => writePersona("broker", null)).not.toThrow();
  });
});

describe("identityLine", () => {
  it("joins the active persona and company", () => {
    expect(identityLine("marketing", "Buildout")).toBe("Marketing · Buildout");
  });

  it("shows the persona alone when there is no company", () => {
    expect(identityLine("broker")).toBe("Broker");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test -- accountMenu`
Expected: FAIL — cannot resolve `./accountMenu`.

- [ ] **Step 3: Write the implementation**

Create `src/components/layout/accountMenu.ts`:

```ts
/**
 * Persona switching for the account dropdown.
 *
 * The persona is prototype scaffolding, not product state: it decides which
 * role the demo presents as, and persists in localStorage under `dev_role` so a
 * reload keeps the chosen vantage point. Kept free of React and of a direct
 * `window` reference so it is testable in Vitest's node environment.
 */

export type Persona = "principal" | "broker" | "marketing";

/** Display order in the "Viewing as" submenu. */
export const PERSONA_ORDER: readonly Persona[] = [
  "principal",
  "broker",
  "marketing",
];

export const PERSONA_LABELS: Record<Persona, string> = {
  principal: "Principal",
  broker: "Broker",
  marketing: "Marketing",
};

/** The slice of the Storage API this module needs. */
export type PersonaStore = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "dev_role";
const DEFAULT_PERSONA: Persona = "principal";

/** localStorage when there is a document, null during SSR. */
function browserStore(): PersonaStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isPersona(value: string | null): value is Persona {
  return value !== null && value in PERSONA_LABELS;
}

/** The persisted persona, or Principal when absent, unrecognized, or on the server. */
export function readPersona(
  store: PersonaStore | null = browserStore(),
): Persona {
  if (!store) return DEFAULT_PERSONA;
  const stored = store.getItem(STORAGE_KEY);
  return isPersona(stored) ? stored : DEFAULT_PERSONA;
}

export function writePersona(
  persona: Persona,
  store: PersonaStore | null = browserStore(),
): void {
  store?.setItem(STORAGE_KEY, persona);
}

/** The identity card's third line, e.g. "Marketing · Buildout". */
export function identityLine(persona: Persona, company?: string): string {
  const label = PERSONA_LABELS[persona];
  return company ? `${label} · ${company}` : label;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test -- accountMenu`
Expected: PASS — 9 tests (10 after the inherited-object-key case added in the
final review pass, item 1 of `final-findings.md`).

- [ ] **Step 5: Add the company field to the current user**

In `src/data/teammates.ts`, add to the `Teammate` interface after the `avatarUrl` field (line 21):

```ts
  /** Employer, shown on the account dropdown's identity card. Only set for the current user. */
  company?: string;
```

And add to `CURRENT_USER` after `role: "Broker",`:

```ts
  company: "Buildout",
```

- [ ] **Step 6: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output. `company` is optional, so the eight `TEAMMATES` entries still satisfy the interface.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/accountMenu.ts src/components/layout/accountMenu.test.ts src/data/teammates.ts
git commit -m "feat(nav): add persona model for the account dropdown"
```

---

## Task 2: AccountMenu component

**Files:**
- Create: `src/components/layout/AccountMenu.tsx`
- Modify: `src/components/layout/GlobalNavbar.tsx` (imports, lines 1–56; state and handlers, lines 63–115; account block, lines 306–341)

**Interfaces:**
- Consumes from Task 1: `Persona`, `PERSONA_ORDER`, `PERSONA_LABELS`, `readPersona`, `writePersona`, `identityLine`, and `CURRENT_USER.company`.
- Consumes from the existing codebase:
  - `CURRENT_USER` from `#/data/teammates` — `{ id, name, email, role, initials, avatarUrl?, company? }`
  - `useDataStore` from `#/data/dataStore` — `s.reset` is an async thunk
  - `useNavbar` from `@buildoutinc/blueprint-react/ui/Navbar` — returns `{ isMobile?: boolean }`, throws outside a `Navbar`
- Produces: `export function AccountMenu(): ReactElement` — renders its own `Navbar.Nav`, so the caller supplies no wrapper.

**Why the mobile fork:** below `expand="lg"`, `Navbar.Group` renders a `Collapsible` instead of a `DropdownMenu` (`blueprint-react/src/components/Navbar/index.tsx:227`). `DropdownMenu.Sub`, `SubTrigger`, `RadioGroup`, and `RadioItem` are Base UI menu primitives that need `Menu.Root` context, which does not exist in that branch. `DropdownMenu.Separator` is a bare `<hr>` and is safe in both.

**Why no `href` on the settings items:** `Navbar.GroupMenuItem` types its `render` prop against a `<div>` (`@base-ui/react/menu/item/MenuItem.d.ts:20`), unlike `Navbar.ItemLink` whose render prop is anchor-typed — so `render={<a href="#" />}` fails `tsc`. Base UI already gives the item `role="menuitem"` and keyboard activation, and `closeOnClick` defaults to `true`, so a plain item is both correct and honest while there is no destination.

**Why `className="navbar-dropdown"` on `SubContent`:** `DropdownMenu.SubContent` delegates to `DropdownMenuContent` without the navbar class (`DropdownMenu/index.tsx:179`), so without it the submenu renders on the light dropdown surface while its parent is dark navy.

- [ ] **Step 1: Create the component**

Create `src/components/layout/AccountMenu.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Navbar, useNavbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBuildings,
  faGear,
  faList,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { CURRENT_USER } from "#/data/teammates";
import {
  PERSONA_LABELS,
  PERSONA_ORDER,
  identityLine,
  readPersona,
  writePersona,
  type Persona,
} from "./accountMenu";

/**
 * The account dropdown in the navbar footer.
 *
 * Three zones: an inert identity card, real product settings links, and
 * prototype-only controls (persona switcher, prototype index, reset). The zones
 * are separated so demo scaffolding never reads as shipped product.
 */
export function AccountMenu() {
  const navigate = useNavigate();
  const { isMobile } = useNavbar();
  const [persona, setPersona] = useState<Persona>(() => readPersona());
  const resetDemo = useDataStore((s) => s.reset);

  function changePersona(next: Persona) {
    writePersona(next);
    setPersona(next);
  }

  // Wipe the demo world back to the deterministic clean state, then reload so
  // every screen re-reads the fresh store. Reload fires even if the reset throws.
  async function handleResetDemo() {
    try {
      await resetDemo();
    } finally {
      window.location.reload();
    }
  }

  const personaRows = PERSONA_ORDER.map((p) => (
    <DropdownMenu.RadioItem key={p} value={p}>
      {PERSONA_LABELS[p]}
    </DropdownMenu.RadioItem>
  ));

  return (
    <Navbar.Nav className="ms-2">
      <Navbar.Group>
        <Navbar.GroupTrigger className="navbar-user-trigger" aria-label="Account">
          <Navbar.ItemLinkIcon>
            <Avatar style={{ width: 28, height: 28 }}>
              <Avatar.Image src={CURRENT_USER.avatarUrl} alt={CURRENT_USER.name} />
              <Avatar.Fallback>{CURRENT_USER.initials}</Avatar.Fallback>
            </Avatar>
          </Navbar.ItemLinkIcon>
        </Navbar.GroupTrigger>

        <Navbar.GroupMenu align="end">
          {/* Zone 1 — identity. Deliberately not a menu item: it states who you
              are, so it must not compete with Profile settings right below. */}
          <div className="account-menu__card d-flex align-items-center gap-3">
            <Avatar style={{ width: 40, height: 40 }}>
              <Avatar.Image src={CURRENT_USER.avatarUrl} alt="" />
              <Avatar.Fallback>{CURRENT_USER.initials}</Avatar.Fallback>
            </Avatar>
            <div className="account-menu__identity">
              <div className="fw-semibold text-truncate">{CURRENT_USER.name}</div>
              <div className="small text-truncate text-buildout-blue-200">
                {CURRENT_USER.email}
              </div>
              <div className="small text-truncate text-buildout-blue-200">
                {identityLine(persona, CURRENT_USER.company)}
              </div>
            </div>
          </div>

          {/* Zone 2 — real product settings. Both are placeholders until the
              settings screens exist, so they close the menu and go nowhere. */}
          <DropdownMenu.Separator />
          <Navbar.GroupMenuItem className="d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faGear} />
            Profile settings
          </Navbar.GroupMenuItem>
          <Navbar.GroupMenuItem className="d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faBuildings} />
            Company settings
          </Navbar.GroupMenuItem>

          {/* Zone 3 — prototype scaffolding. */}
          <DropdownMenu.Separator />
          {isMobile ? (
            // Base UI's submenu and radio parts have no Menu.Root in Navbar's
            // collapsible branch, so mobile gets flat rows instead.
            PERSONA_ORDER.map((p) => (
              <Navbar.GroupMenuItem
                key={p}
                onClick={() => changePersona(p)}
                className={p === persona ? "active" : undefined}
              >
                {PERSONA_LABELS[p]}
              </Navbar.GroupMenuItem>
            ))
          ) : (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faUser} />
                Viewing as: {PERSONA_LABELS[persona]}
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className="navbar-dropdown">
                <DropdownMenu.RadioGroup
                  value={persona}
                  onValueChange={(value) => changePersona(value as Persona)}
                >
                  {personaRows}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          )}
          <Navbar.GroupMenuItem
            className="d-flex align-items-center gap-2"
            onClick={() => navigate({ to: "/" })}
          >
            <FontAwesomeIcon icon={faList} />
            Prototype index
          </Navbar.GroupMenuItem>
          <Navbar.GroupMenuItem
            className="d-flex align-items-center gap-2"
            onClick={handleResetDemo}
          >
            <FontAwesomeIcon icon={faArrowsRotate} />
            Reset demo
          </Navbar.GroupMenuItem>
        </Navbar.GroupMenu>
      </Navbar.Group>
    </Navbar.Nav>
  );
}
```

- [ ] **Step 2: Wire it into GlobalNavbar and delete the dead code**

In `src/components/layout/GlobalNavbar.tsx`:

1. Replace the whole account block — from `{/* User profile */}` through the `</Navbar.Nav>` that closes it (lines 305–341) — with:

```tsx
        <AccountMenu />
```

2. Add the import beside the other local imports:

```tsx
import { AccountMenu } from "./AccountMenu";
```

3. Delete these, all now unused:
   - `useState` from the line 1 React import (keep `type MouseEvent`, so it becomes `import type { MouseEvent } from "react";`)
   - the `Avatar` import (line 4)
   - `faArrowsRotate` from the `pro-regular-svg-icons` import list (line 15)
   - the `useDataStore` import (line 24)
   - `type Role = "principal" | "broker" | "marketing";` (line 35)
   - the `ROLE_LABELS` constant (lines 52–56)
   - the `role` / `setRole` `useState` (lines 65–70)
   - `const resetDemo = useDataStore((s) => s.reset);` (line 73)
   - `handleRoleChange` (lines 100–105) and `handleResetDemo` with its comment (lines 107–115)

   Leave `useNavigate`, `handleNavClick`, `navContexts`, `isPathActive`, and everything else untouched.

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output. A "declared but never used" error here means a deletion in Step 2 was missed.

- [ ] **Step 4: Run the full test suite**

Run: `bun --bun run test`
Expected: all tests pass. Ignore the known non-gates: biome output, and the one react/module Vitest stderr line.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AccountMenu.tsx src/components/layout/GlobalNavbar.tsx
git commit -m "feat(nav): three-zone account dropdown with persona submenu"
```

---

## Task 3: Dropdown surface styling

**Files:**
- Modify: `src/main.scss` — insert after the `.global-navbar` block closes at line 3357, before the `// ── Tasks page` comment at line 3359

**Interfaces:**
- Consumes: `.account-menu__card` and `.account-menu__identity` from Task 2's markup; `colors` namespace already `@use`d at `src/main.scss:1`.
- Produces: no JS surface.

**Why top level, not nested:** `DropdownMenu.Content` wraps its popup in `MenuPrimitive.Portal` (`DropdownMenu/index.tsx:59`), so the menu is a child of `body`, not of `.global-navbar`. Nesting these rules inside `.global-navbar` would silently never match.

- [ ] **Step 1: Add the styles**

Insert into `src/main.scss` between line 3357 (`}`, closing `.global-navbar`) and line 3359 (`// ── Tasks page …`):

```scss
// ── Account dropdown ────────────────────────────────────────────────────────
// The navbar dropdown is portaled to <body>, so these rules sit at top level
// rather than inside .global-navbar.
.navbar-dropdown {
  // Blueprint's .navbar-dropdown re-tokens the dropdown's bg, color, and border
  // for the dark navy surface but not the divider, which otherwise falls back to
  // the light-theme grey. Matches $navbar-divider-color.
  --bs-dropdown-divider-bg: #{colors.$buildout-blue-900};
}

// Identity card: the inert header above the first divider.
.account-menu__card {
  padding: map-get($spacers, 3);
  min-width: 280px;
}

.account-menu__identity {
  // Lets the email and persona lines truncate instead of widening the menu.
  min-width: 0;
}
```

`map-get($spacers, 3)` matches `$dropdown-item-padding-x` (`blueprint-theme/scss/components/dropdown-menu/_setup.scss:17`), so the card's text aligns with the item labels below it. The global `map-get` is the theme's own idiom and its deprecation is silenced in `vite.config.ts:23` — no `sass:map` import needed.

- [ ] **Step 2: Verify the styles compile**

Run: `bun --bun run build`
Expected: build succeeds. A Sass error names `main.scss` and its line.

- [ ] **Step 3: Commit**

```bash
git add src/main.scss
git commit -m "style(nav): theme the account dropdown surface and identity card"
```

---

## Manual verification

Automated checks cannot see the rendered menu. After Task 3, run `bun --bun run dev` and confirm at `http://localhost:3000`:

1. The avatar in the navbar footer opens a menu with no stray caret.
2. Identity card: 40px avatar, name in near-white, email and "Principal · Buildout" in the dimmer blue — no grey text.
3. Both dividers are dark navy, not light grey.
4. "Profile settings" and "Company settings" hover and close the menu, but do not navigate.
5. "Viewing as: Principal" opens a submenu on the **same dark surface**, with a check on the active persona. Picking Marketing does **not** close the menu — Base UI's `Menu.RadioItem` defaults `closeOnClick` to `false` (unlike `Menu.Item`, which defaults to `true`) — and instead the identity line's third row updates in place, live, to "Marketing · Buildout" while the menu stays open.
6. The persona survives a page reload.
7. "Prototype index" navigates to `/`.
8. "Reset demo" wipes and reloads, as before.
9. Narrow the window below 1024px — Blueprint's JS breakpoint for `expand="lg"` (`@buildoutinc/blueprint-react/src/hooks/use-mobile.ts:5`), not Bootstrap's 992px CSS breakpoint: the menu becomes inline, and the three personas appear as flat rows with the active one emphasized — no console error. Between 992px and 1024px, expect the JS to report mobile while the CSS breakpoint still says desktop.

Report anything off rather than adjusting unrelated visual design.
