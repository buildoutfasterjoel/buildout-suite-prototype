# Account dropdown in the global navigation

**Date:** 2026-07-30
**Branch:** `joel/account-settings`

## Goal

Replace the flat account menu in the global navbar with a three-zone dropdown: an
identity header card, product settings links, and a zone for prototype-only
controls. The prototype zone gives us somewhere to put demo scaffolding without
mixing it into rows that look like real product.

## Scope

In scope: the dropdown itself. "Profile settings" and "Company settings" are
links that dead-end for now — the settings screens are separate work.

Out of scope: settings pages, sign out, theme toggle.

## Current state

`src/components/layout/GlobalNavbar.tsx:306-341` renders the account menu as a
`Navbar.Group` whose `GroupMenu` holds four flat items: three persona rows
(Principal / Broker / Marketing, active state faked with
`className={r === role ? "active" : undefined}`) and a Reset demo row separated
only by a `border-top` utility.

## Blueprint capability assessment

`Navbar.GroupMenu` forwards arbitrary children into Base UI's `Menu.Popup`, so
the three-zone layout composes on desktop with no Blueprint change. Six gaps
came out of reading `blueprint-react/src/components/Navbar/index.tsx`,
`DropdownMenu/index.tsx`, and `blueprint-theme/scss/components/navbar/`:

1. **No menu-level parts on `Navbar`.** `Navbar.Separator` is the vertical navbar
   rule (`.separator.navbar-separator`), not a dropdown divider. There is no
   `Navbar.GroupMenuSeparator`, `GroupMenuLabel`, or `GroupMenuHeader`, so a
   consumer must reach into `ui/DropdownMenu` and mix component families inside a
   Navbar subtree.
2. **The mobile branch breaks composition.** Below `expand`, `Navbar.Group`
   becomes a `Collapsible` and `GroupMenu` becomes `CollapsibleContent`. Only
   `GroupMenuItem` forks for mobile (`Navbar/index.tsx:332`). Any Base UI menu
   part dropped in — `GroupLabel`, `RadioGroup`/`RadioItem`, `CheckboxItem`,
   `Sub*` — has no `Menu.Root` context there and throws or no-ops.
   `DropdownMenu.Separator` survives only because it is a bare `<hr>`.
3. **Divider is mis-themed in the navbar dropdown.** `.navbar-dropdown`
   re-tokens `--bs-dropdown-bg`, `-color`, and `-border-color`
   (`navbar/_index.scss:116`) but not `--bs-dropdown-divider-bg`, so a
   `dropdown-divider` renders in the light-theme color on the dark surface.
   `.dropdown-inline` (mobile) also zeroes padding and border, so a header card
   gets no container styling.
4. **`GroupTrigger` force-injects a caret** (`faCaretDown`, `Navbar/index.tsx:273`)
   with no opt-out. This repo already hides it in CSS at `src/main.scss:3342`.
5. **No account-menu pattern.** No `GroupMenuItem` icon/label/description
   sub-parts and no header slot, so the identity card is bespoke markup styled
   against `.dropdown-*` internals.
6. **`GroupMenu` hardcodes `minWidth: var(--anchor-width)`** off the 28px avatar
   with no width prop, so the ~280px card needs an inline style or class.

These become a Blueprint ticket, tracked separately. Gaps 2, 3, and 4 are worked
around in this implementation.

## Design

### Placement

Extract the account block into `src/components/layout/AccountMenu.tsx`.
`GlobalNavbar` is already 345 lines; the `role` state, `handleRoleChange`, and
`handleResetDemo` are used only by this menu, so they move with it.
`GlobalNavbar` renders `<AccountMenu />` inside `Navbar.Footer`.

### Zone 1 — identity header

An inert `div` (not a menu item, not focusable): 40px `Avatar`, then name, email,
and a `{activePersona} · Buildout` line.

Data comes from `CURRENT_USER` in `src/data/teammates.ts:34`, extended with a
`company: "Buildout"` field so the string is not hardcoded in the view.

The role line reflects the **active persona**, not `CURRENT_USER.role` — switching
to Marketing shows "Marketing · Buildout", making the switcher's effect visible
without opening the submenu.

Typography: the name inherits `--bs-dropdown-color`, which `.navbar-dropdown`
already sets from `$sidebar-item-color` = `$buildout-blue-50`. The email and role
lines use `text-buildout-blue-200` — Blueprint generates `.text-{palette}-{shade}`
utilities in `blueprint-theme/scss/lib/_colors.scss:112`, and this repo already
uses that family. Bootstrap's `text-body-secondary` is wrong here because it
pulls a grey into an all-blue surface. There is no `text-accent-subtle` utility.

### Zone 2 — product settings

`DropdownMenu.Separator`, then two `Navbar.GroupMenuItem`s: `faGear` → Profile
settings, `faBuildings` → Company settings. Both `href="#"` with
`preventDefault`, matching how Notifications already dead-ends at
`GlobalNavbar.tsx:267`.

### Zone 3 — prototype

`DropdownMenu.Separator`, then, with no group label:

- `DropdownMenu.Sub` / `SubTrigger` — "Viewing as: {persona}" with `faUser`.
  `SubContent` holds a `DropdownMenu.RadioGroup` bound to `role` with three
  `RadioItem`s, so the check indicator and controlled value come from Blueprint
  instead of the current `className` hack.
- `faList` → Prototype index, navigating to `/`. Otherwise unreachable from
  inside the app shell.
- `faArrowsRotate` → Reset demo, last because it is the destructive one.
  Behavior unchanged: `reset()` then `window.location.reload()`.

### Mobile fallback

`const { isMobile } = useNavbar()` — when true, Zone 3 renders the three personas
as flat `Navbar.GroupMenuItem`s (today's markup) instead of `Sub*`, because Base
UI's submenu parts have no `Menu.Root` in Navbar's collapsible branch (gap 2).
Separators are safe in both branches.

### Styling

Two additions to `src/main.scss`, beside the existing navbar block:

- `.navbar-dropdown { --bs-dropdown-divider-bg: #{colors.$buildout-blue-900}; }`
  to fix the mis-themed divider (gap 3), matching
  `$navbar-divider-color` = `$sidebar-divider-color` = `$buildout-blue-900`.
  `main.scss` already has `@use "@buildoutinc/blueprint-tokens/scss/colors" as colors`
  at line 1.
- `.account-menu__card` for the header's padding, gap, and ~280px width (gap 6),
  with the email truncating rather than wrapping.

## Verification

No unit test — this is presentational, and the persona and reset logic are
unchanged. Verification is `bunx tsc --noEmit` (note: `vite build` does not
type-check) plus manual click-through of the menu on desktop.
