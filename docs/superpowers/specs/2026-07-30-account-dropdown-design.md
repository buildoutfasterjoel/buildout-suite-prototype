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
the three-zone layout composes on desktop with no Blueprint change. Nine gaps
came out of reading `blueprint-react/src/components/Navbar/index.tsx`,
`DropdownMenu/index.tsx`, `blueprint-theme/scss/components/navbar/`, and
Base UI's `menu/` internals (gaps 7 and 8 surfaced during the final review
pass; gap 9 while reviewing the shipped code):

1. **No menu-level parts on `Navbar`.** There is no `Navbar.GroupMenuSeparator`,
   `GroupMenuLabel`, or `GroupMenuHeader`, so a consumer must reach into
   `ui/DropdownMenu` and mix component families inside a Navbar subtree. The
   sharper version of the complaint is that the two available separators each
   solve half the problem: `Navbar.Separator` already binds
   `--bp-separator-color` to `$navbar-divider-color`, i.e. it is correct for the
   navbar's own surface, and it accepts `orientation="horizontal"` despite
   defaulting to vertical (`Navbar/index.tsx:364`) — but it carries no vertical
   margin. `DropdownMenu.Separator` has menu-appropriate
   `--bp-dropdown-divider-margin-y` but a color the navbar's dropdown never
   re-tokens (gap 3). So a horizontal rule inside a navbar dropdown always means
   hand-tuning one axis or the other.
2. **The mobile branch breaks composition.** Below `expand`, `Navbar.Group`
   becomes a `Collapsible` and `GroupMenu` becomes `CollapsibleContent`. Only
   `GroupMenuItem` forks for mobile (`Navbar/index.tsx:332`). Any Base UI menu
   part dropped in — `GroupLabel`, `RadioGroup`/`RadioItem`, `CheckboxItem`,
   `Sub*` — has no `Menu.Root` context there and throws or no-ops.
   `DropdownMenu.Separator` survives only because it is a bare `<hr>`.
3. **The navbar family is internally inconsistent about its own divider color.**
   Blueprint has no light/dark theme modes — the navbar simply has a dark surface
   as part of its own design, and `$navbar-divider-color` is the value that goes
   with it. `.navbar-separator` already binds to that value. But
   `.navbar-dropdown` re-tokens `--bp-dropdown-bg`, `-color`, and
   `-border-color` (`navbar/_index.scss:116`) and stops there, so
   `--bp-dropdown-divider-bg` keeps the base dropdown's near-white
   `oklch(94.87% …)`. The navbar's own separator knows what color a rule on this
   surface should be; its dropdown's divider doesn't. `.dropdown-inline` (mobile)
   also zeroes padding and border, so a header card gets no container styling.
4. **`GroupTrigger` force-injects a caret** (`faCaretDown`, `Navbar/index.tsx:273`)
   with no opt-out. This repo already hides it in CSS at `src/main.scss:3342`.
5. **No account-menu pattern.** No `GroupMenuItem` icon/label/description
   sub-parts and no header slot, so the identity card is bespoke markup styled
   against `.dropdown-*` internals.
6. **`GroupMenu` hardcodes `minWidth: var(--anchor-width)`** off the 28px avatar
   with no width prop, so the ~280px card needs an inline style or class.
7. **Two different "mobile" breakpoints disagree.** `useNavbar()`'s `isMobile`
   comes from Blueprint's JS media-query hook for `expand="lg"`
   (`@buildoutinc/blueprint-react/src/hooks/use-mobile.ts:5`), which fires at
   **1024px**, not Bootstrap's `lg` CSS breakpoint of 992px. Between 992px and
   1024px, `isMobile` is `true` (so this component renders its flat-row
   fallback) while Bootstrap's own `.navbar-expand-lg` CSS still considers the
   viewport desktop-width. There is no single source of truth for "mobile" to
   query against.
8. **`DropdownMenu.SubContent` doesn't inherit the `.navbar-dropdown` class.**
   `SubContent` delegates to the same `DropdownMenuContent` as the top-level
   popup but without forwarding `.navbar-dropdown` (`DropdownMenu/index.tsx:179`),
   so a submenu opened from inside a navbar dropdown falls back to the base
   dropdown's light surface — beside its own dark parent — unless the consumer
   re-applies the class by hand, as this implementation does on `SubContent` in
   Zone 3.

9. **`Navbar.Group` has no submenu equivalent, and can't be nested to fake one.**
   This is the sharpest gap, because `Navbar.GroupMenu` is *already* the
   correctly-surfaced dropdown — so nesting a second `Navbar.Group` inside one
   looks like it should give a correctly-surfaced submenu for free. It doesn't.
   `Navbar.Group` renders a plain `DropdownMenu` (= Base UI `Menu.Root`,
   `Navbar/index.tsx:242`), and Base UI establishes the parent/child link *only*
   when `isSubmenu` is set, which comes solely from `MenuSubmenuRootContext`
   (`menu/root/MenuRoot.js:57-62`) — a context only `Menu.SubmenuRoot` provides
   (`menu/submenu-root/MenuSubmenuRoot.js:26-35`). A nested `Menu.Root` is
   therefore a second *independent* menu, not a submenu:
   - `parent.type` stays `undefined`, so the nested menu takes `modal` semantics
     (`MenuRoot.js:129`). Base UI's own "modal is not supported on nested menus"
     warning is suppressed in exactly this case, because it only fires when
     `parent.type` *is* defined (`MenuRoot.js:118`).
   - With no parent store link, the parent doesn't know the child is open, and
     the child's popup portals outside the parent's DOM — so the parent's
     outside-press dismissal treats interactions in the child as outside.
   - `Navbar.GroupTrigger` renders `.nav-link` (min-height `$spacers` 8), not
     `.dropdown-item`, so it reads as a navbar link sitting inside a menu.
   - `NavbarGroup` destructures only `children` (`Navbar/index.tsx:215`), so it
     silently drops `className` — the `<li class="nav-item dropdown">` it emits
     can't be restyled by the consumer either.

   What's actually needed: `Navbar.GroupSubmenu` / `GroupSubmenuTrigger` /
   `GroupSubmenuMenu` wrapping `DropdownMenu.Sub` / `SubTrigger` / `SubContent`
   and forwarding `.navbar-dropdown` — i.e. what Zone 3 does by hand today.

These become a Blueprint ticket, tracked separately.

Worked around in this implementation: gaps 2, 4, 7, 8, and 9. Gap 3 is
*avoided* rather than worked around — the menu uses `Navbar.Separator`, which
already carries the right color, instead of `DropdownMenu.Separator` plus a
custom `--bp-dropdown-divider-bg` override. The bug in `.navbar-dropdown`
remains, and will bite the next consumer who reaches for the dropdown's own
separator. Gaps 1, 5, and 6 are absorbed as bespoke markup and utility classes.

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
settings, `faBuildings` → Company settings. Both are plain menu items with no
`href` — `GroupMenuItem` types its `render` prop against a `<div>`
(`@base-ui/react/menu/item/MenuItem.d.ts:20`), unlike the anchor-typed
`Navbar.ItemLink` used for Notifications at `GlobalNavbar.tsx:267`, so
`render={<a href="#" />}` would not type-check. Base UI still supplies
`role="menuitem"`, keyboard activation, and `closeOnClick`, so the items behave
correctly while there is no destination. This is gap 1 biting in practice: there
is no navbar-native menu-link part.

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
