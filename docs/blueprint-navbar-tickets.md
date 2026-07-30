# Blueprint tickets — Navbar dropdown composition

Draft JIRA tickets, **not yet filed.** Two tickets, split bug vs enhancement.

Source of findings: `docs/superpowers/specs/2026-07-30-account-dropdown-design.md`
("Blueprint capability assessment"), produced while building the account dropdown
in suite-prototype against `@buildoutinc/blueprint-react@1.3.0`.

All line citations are against the installed package sources
(`node_modules/@buildoutinc/blueprint-react/src/`,
`node_modules/@buildoutinc/blueprint-theme/scss/`, `node_modules/@base-ui/react/`).

**Classification notes before filing:**

- `NavbarGroup` silently dropping `className` came out of the gap-9 analysis, an
  enhancement, but it is a bug — a documented prop typed and accepted, then
  ignored. It is filed under the **bug** ticket as item 5. Move it if you'd
  rather keep it beside the submenu work.
- Findings 3 and 8 are both "a navbar surface doesn't reach its own child" and
  share one fix shape, so they are adjacent items in the bug ticket rather than
  merged — they're separate one-line changes in different files.
- The spec's gap 6 (`GroupMenu` hardcodes `minWidth`) was written up as a missing
  width prop. Verifying it for this ticket showed the real defect is a
  spread-order bug that silently discards the component's own `minWidth`
  whenever a consumer passes `style`. It moved from the enhancement to the
  **bug** ticket as item 6, and the spec was corrected to match.
- The spec's gap 7 originally claimed the JS and CSS breakpoint scales came from
  different design systems (Tailwind's vs Bootstrap's). **That was wrong** — the
  theme overrides `$grid-breakpoints` from Blueprint's own tokens, and the values
  match the JS map exactly. Item 4 below is the corrected, narrower finding: a
  listener/predicate off-by-one in `useMobileBreakpoint` that can strand
  `isMobile` at `false`. Do not file the "two scales" version.

So: **bug ticket = 6 items** (spec gaps 2, 3, 8, 7, 6 + the `className` drop),
**enhancement ticket = 4 items** (spec gaps 9, 1, 5, 4).

---

# Ticket 1 — BUG: Navbar dropdown drops context, tokens, and props in nested surfaces

**Type:** Bug
**Component:** blueprint-react / Navbar, blueprint-theme / navbar
**Affects version:** 1.3.0
**Priority suggestion:** item 1 is a crash, the rest are silent-wrong

## Summary

Five independent defects that all surface when composing anything richer than a
flat list inside `Navbar.GroupMenu`. Each is small and independently fixable.

## Item 1 — Mobile branch drops `Menu.Root`, so menu parts crash

`Navbar.Group` renders a `DropdownMenu` (Base UI `Menu.Root`) on desktop but a
`Collapsible` below `expand` (`Navbar/index.tsx:227-247`). `GroupMenu` likewise
swaps to `CollapsibleContent` (`:293-306`). Only `GroupMenuItem` forks for the
mobile branch (`:334-350`).

Consequence: any Base UI menu part placed in a `GroupMenu` — `GroupLabel`,
`RadioGroup`, `RadioItem`, `CheckboxItem`, `Sub`, `SubTrigger`, `SubContent` —
has no `Menu.Root` ancestor on mobile and throws or no-ops. Only
`DropdownMenu.Separator` survives, and only because it happens to be a bare
`<hr>` with no Base UI context dependency (`DropdownMenu/index.tsx:198-205`).

**Repro:** put a `DropdownMenu.RadioGroup` in a `Navbar.GroupMenu`, render below
`expand`. **Expected:** renders, or a documented mobile equivalent.
**Actual:** context error.

**Proposed fix:** fork the remaining parts the way `GroupMenuItem` already does —
`Navbar.GroupMenuLabel`, `GroupMenuRadioGroup`, `GroupMenuRadioItem`,
`GroupMenuCheckboxItem` — each delegating to the `DropdownMenu` part on desktop
and to plain markup inside the `Collapsible` on mobile. Where a mobile analogue
is genuinely impossible, document the part as desktop-only and export a
`useNavbar().isMobile` fork as the sanctioned pattern (consumers are writing
this by hand today).

**Acceptance criteria**
- [ ] Every `DropdownMenu` part usable inside `GroupMenu` on desktop either has a
      mobile-safe `Navbar.*` equivalent or is documented as desktop-only.
- [ ] Rendering each below `expand` produces no console error and no crash.
- [ ] A test covers at least one context-dependent part in both branches.

## Item 2 — `.navbar-dropdown` doesn't re-token its divider color

`.navbar-dropdown` re-tokens `--bp-dropdown-bg`, `--bp-dropdown-color`, and
`--bp-dropdown-border-color` for the navbar's surface
(`blueprint-theme/scss/components/navbar/_index.scss:115-121`) but not
`--bp-dropdown-divider-bg`, so `.dropdown-divider` keeps the base dropdown value
`oklch(94.87% 0.01 264.53)` — near-white — on the navbar's dark surface.

This is an internal inconsistency, not a theming request: Blueprint has no
light/dark modes. The navbar simply has a dark surface as part of its own design,
and `$navbar-divider-color` (= `$sidebar-divider-color` = `$buildout-blue-900`)
is the value that goes with it. `.navbar-separator` already binds to exactly that
(`navbar/_index.scss:109-113`). The navbar's own separator knows what a rule on
this surface should look like; its dropdown's divider doesn't.

**Proposed fix** — one line in the existing `&.navbar-dropdown` block:

```scss
.dropdown-menu {
  &.navbar-dropdown {
    --#{$prefix}dropdown-bg: #{$navbar-bg};
    --#{$prefix}dropdown-color: #{$navbar-light-color};
    --#{$prefix}dropdown-border-color: #{$navbar-divider-color};
    --#{$prefix}dropdown-divider-bg: #{$navbar-divider-color}; // add
```

**Acceptance criteria**
- [ ] `DropdownMenu.Separator` inside a `Navbar.GroupMenu` renders at
      `$navbar-divider-color`.
- [ ] No consumer-side `--bp-dropdown-divider-bg` override is needed.
- [ ] Dropdowns outside a navbar are unchanged.

## Item 3 — `DropdownMenu.SubContent` doesn't inherit `.navbar-dropdown`

`SubContent` delegates to the same `DropdownMenuContent` as the top-level popup
but does not forward the parent popup's `.navbar-dropdown`
(`DropdownMenu/index.tsx:179-196`). A submenu opened from inside a navbar
dropdown therefore renders on the base light surface, directly beside its own
dark parent.

**Repro:** `Navbar.GroupMenu` > `DropdownMenu.Sub` > `SubContent`, no className.
**Actual:** light popup beside a dark one. **Workaround in use:**
`<DropdownMenu.SubContent className="navbar-dropdown">`.

**Proposed fix:** have the popup publish its surface class through context and
have `SubContent` re-apply it, so a submenu inherits its parent's surface by
default. A `data-surface` attribute on the popup that `SubContent` reads and
mirrors would also work. Either way the consumer shouldn't restate it.

**Acceptance criteria**
- [ ] A `SubContent` with no `className` matches its parent popup's surface.
- [ ] An explicit `className` on `SubContent` still wins.
- [ ] Submenus outside a navbar are unchanged.

## Item 4 — `useMobileBreakpoint` can miss the transition it exists to detect

**Not a values problem.** The theme's `$grid-breakpoints` is built from
Blueprint's own tokens (`bridge/_vars.scss:124-131` → `$breakpoints-sm: 40rem` …
`$breakpoints-2xl: 96rem`) and equals the JS `BREAKPOINTS` map
(`hooks/use-mobile.ts:3-9`) at a 16px root: 640/768/1024/1280/1536. Bootstrap's
defaults are fully overridden and never apply. The bug is the hook's mechanism.

```ts
const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`); // matches ≤ 1024
const onChange = () => { setIsMobile(window.innerWidth < breakpoint); }; // true ≤ 1023
mediaQuery.addEventListener('change', onChange);
```

`use-mobile.ts:19-27`. The listener's boundary (1024↔1025) and the predicate's
boundary (1023↔1024) are off by one, and there is no `resize` listener — only
this one media-query subscription. So:

- Shrinking 1025 → 1024 fires `change`; the handler computes
  `1024 < 1024` → `false`.
- Shrinking further, 1024 → 900, does **not** fire `change` — the query still
  matches — so the handler never re-runs and `isMobile` stays `false`.

The navbar can therefore sit in its desktop branch at 900px wide. Which value
sticks depends on the `innerWidth` the browser reported at that single crossing
event, so it reproduces inconsistently — coalesced resizes that jump past 1024
happen to set it correctly, slow drags do not.

**Repro:** load at ≥1025px, slowly drag the window narrower to ~900px.
**Expected:** `isMobile` becomes `true`; the navbar collapses.
**Actual:** frequently stays `false`. Reloading at 900px is correct, because the
`useState` initializer computes the predicate directly — only the resize path is
broken.

**Proposed fix** — one source of truth for the boundary, using Bootstrap's own
`0.02px` subtraction convention so the query edge matches the CSS edge:

```ts
const query = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`);
const onChange = () => setIsMobile(query.matches);
query.addEventListener('change', onChange);
onChange();
```

Reading `query.matches` rather than re-measuring `innerWidth` makes it
impossible for the two to drift again.

**Secondary:** the CSS breakpoints are authored in `rem` and the JS ones in `px`.
Media-query `rem` resolves against the browser's default font size, so a user who
raises it moves the CSS boundary while the JS boundary stays at a fixed pixel
value. Deriving the JS map from the tokens (or expressing the query in `rem`)
would close that.

**Acceptance criteria**
- [ ] Slowly resizing from above the breakpoint to well below it flips `isMobile`
      exactly once, at the breakpoint.
- [ ] `isMobile` is `true` for every width below the breakpoint, regardless of
      how the viewport got there.
- [ ] The JS boundary and the corresponding `.navbar-expand-*` CSS boundary agree
      at the exact breakpoint width.
- [ ] A test covers the resize path, not just the initial mount.

## Item 5 — `NavbarGroup` accepts `className` and silently ignores it

```tsx
const NavbarGroup = ({ children }: ComponentProps<'li'>): ReactElement => {
```

`Navbar/index.tsx:215` destructures only `children`. The props type is
`ComponentProps<'li'>`, so `className` (and every other `li` prop) type-checks,
is accepted, and is then dropped — nothing is spread onto the rendered
`<NavbarItem className="dropdown">`. Consumers cannot style or target the
`<li class="nav-item dropdown">` wrapper, and get no error telling them why.

**Proposed fix:**

```tsx
const NavbarGroup = ({ className, children, ...props }: ComponentProps<'li'>) => {
  // ...
  <NavbarItem className={cn('dropdown', className)} {...props}>
```

applied to both the mobile and desktop branches.

**Acceptance criteria**
- [ ] `className` on `Navbar.Group` reaches the rendered `<li>`, merged with
      `dropdown`.
- [ ] Other `li` props pass through.
- [ ] Both the `isMobile` and desktop branches behave the same way.

## Item 6 — `GroupMenu`'s prop spread clobbers its own `minWidth`

```tsx
const NavbarGroupMenu = ({ className, children, align, alignOffset, side,
  sideOffset, container, ...props }) => {
  // ...
  <DropdownMenuContent
    style={{ ...props.style, minWidth: 'var(--anchor-width)' }}   // :316
    {...props}                                                    // :317  ← clobbers it
```

`style` is not destructured out of `props` (`Navbar/index.tsx:281-289`), so it
remains in `props` and the spread on line 317 lands *after* the computed `style`
on line 316 and overwrites it wholesale. The `...props.style` merge inside line
316 is dead — it can never survive.

Consequence: a consumer who passes `style` to `Navbar.GroupMenu` silently loses
the `minWidth: var(--anchor-width)` floor the component intends to guarantee.
Pass nothing and the floor applies; pass `style={{ width: 320 }}` and it
disappears. Nothing warns.

**Repro:** `<Navbar.GroupMenu style={{ width: 320 }}>` — inspect the popup;
`min-width` is absent. **Expected:** `width: 320px` *and* the anchor-width floor.

**Proposed fix:** destructure `style` and merge it explicitly, so intent and
override order are both visible:

```tsx
const NavbarGroupMenu = ({ className, children, align, alignOffset, side,
  sideOffset, container, style, ...props }) => {
  // ...
  <DropdownMenuContent
    style={{ minWidth: 'var(--anchor-width)', ...style }}
    {...props}
```

That also makes consumer `style` genuinely able to override the floor, which is
the more useful default given the floor is measured off the trigger — a 28px
avatar trigger makes it meaningless anyway.

**Acceptance criteria**
- [ ] Passing `style` to `GroupMenu` no longer discards `minWidth`.
- [ ] An explicit `minWidth` in consumer `style` wins over the default.
- [ ] Passing no `style` keeps today's anchor-width behavior.
- [ ] The mobile branch (`:301`) handles `style` consistently.

---

# Ticket 2 — ENHANCEMENT: Navbar needs first-class menu composition parts

**Type:** Enhancement / Story
**Component:** blueprint-react / Navbar
**Affects version:** 1.3.0

## Summary

`Navbar.GroupMenu` forwards arbitrary children into Base UI's `Menu.Popup`, so a
rich navbar menu is *possible* today — but every structural element beyond a flat
item has to be assembled from `ui/DropdownMenu` and hand-restyled. Building a
standard account menu (identity header, grouped links, a persona submenu) took
four separate workarounds. These are the parts that should exist.

## Item 1 — No submenu parts, and `Navbar.Group` can't be nested to fake one

The most surprising gap, because `Navbar.GroupMenu` is *already* the
correctly-surfaced dropdown, so nesting a second `Navbar.Group` inside one looks
like it should produce a correctly-surfaced submenu for free. It doesn't.

`Navbar.Group` renders a plain `DropdownMenu` = Base UI `Menu.Root`
(`Navbar/index.tsx:242`). Base UI establishes the parent/child menu relationship
*only* when `isSubmenu` is set, which comes solely from `MenuSubmenuRootContext`
(`@base-ui/react/menu/root/MenuRoot.js:57-62`) — a context only
`Menu.SubmenuRoot` provides
(`@base-ui/react/menu/submenu-root/MenuSubmenuRoot.js:26-35`). A nested
`Menu.Root` is therefore a second **independent** menu:

- `parent.type` stays `undefined`, so the nested menu takes `modal` semantics
  (`MenuRoot.js:129`). Base UI's own "modal is not supported on nested menus"
  warning cannot fire here, because it is guarded on `parent.type !== undefined`
  (`MenuRoot.js:118`) — so the misuse is silent.
- With no parent store link the parent doesn't know the child is open, and the
  child's popup portals outside the parent's DOM, so the parent's outside-press
  dismissal treats interaction in the child as outside.
- `Navbar.GroupTrigger` renders `.nav-link` (min-height `$spacers` 8), not
  `.dropdown-item`, so it reads as a navbar link sitting inside a menu.

**Proposed API** — thin wrappers over the Base UI submenu parts, forwarding the
navbar surface, mirroring how `GroupMenuItem` already wraps `DropdownMenuItem`:

```tsx
Navbar.GroupSubmenu        // wraps DropdownMenu.Sub
Navbar.GroupSubmenuTrigger // wraps DropdownMenu.SubTrigger, styled .dropdown-item
Navbar.GroupSubmenuMenu    // wraps DropdownMenu.SubContent + .navbar-dropdown
```

With Ticket 1 item 3 fixed, `GroupSubmenuMenu` needs no explicit class. On
mobile these should fork to a nested `Collapsible` rather than throwing
(Ticket 1 item 1).

**Acceptance criteria**
- [ ] A submenu inside `Navbar.GroupMenu` is expressible without importing from
      `ui/DropdownMenu`.
- [ ] Trigger is styled as a menu item, not a nav link.
- [ ] Submenu popup matches the parent's surface with no consumer className.
- [ ] Keyboard navigation and dismissal behave as a submenu: arrow-right/left,
      parent stays open while the child is open, one Escape closes the child only.
- [ ] Works, or degrades documentedly, below `expand`.

## Item 2 — No menu-level separator, label, or header

There is no `Navbar.GroupMenuSeparator`, `GroupMenuLabel`, or
`GroupMenuHeader`, so consumers mix component families inside a Navbar subtree.

For separators specifically, the two existing options each solve half the
problem, so *both* require hand-tuning:

| | color | vertical margin |
|---|---|---|
| `Navbar.Separator` (`orientation="horizontal"`) | correct — binds `--bp-separator-color` to `$navbar-divider-color` | none |
| `DropdownMenu.Separator` | wrong on this surface (Ticket 1 item 2) | correct — `--bp-dropdown-divider-margin-y` |

Note `Navbar.Separator` *does* accept `orientation="horizontal"` despite
defaulting to `vertical` (`Navbar/index.tsx:364-374`) — that part works, it just
carries no spacing for menu use.

**Proposed API:** `Navbar.GroupMenuSeparator` — horizontal, `$navbar-divider-color`,
`--bp-dropdown-divider-margin-y` spacing, mobile-safe. Plus
`Navbar.GroupMenuLabel` for section headings, re-tokening
`--bp-dropdown-header-color` for the navbar surface (the base value is the
light-surface grey).

**Acceptance criteria**
- [ ] A separator inside `GroupMenu` needs no consumer CSS for either color or spacing.
- [ ] A group label is legible on the navbar surface with no consumer CSS.
- [ ] Both render in the mobile branch.

## Item 3 — No account/user-menu pattern

`GroupMenuItem` has no icon, label, or description sub-parts, and `GroupMenu` has
no header slot. An identity header (avatar + name + email + role) is therefore
bespoke markup styled against `.dropdown-*` internals, and every menu item with
an icon is a hand-rolled `d-flex align-items-center gap-2`.

**Proposed API:**

```tsx
Navbar.GroupMenuHeader       // non-interactive, not in the item traversal order
Navbar.GroupMenuItemIcon     // matches GroupMenuItem's own spacing
Navbar.GroupMenuItemLabel
Navbar.GroupMenuItemDescription  // muted second line
```

An account menu is common enough across products to be worth a documented recipe
composed from these, rather than each consumer re-deriving it.

**Acceptance criteria**
- [ ] An icon + label item needs no utility classes.
- [ ] A header is announced to screen readers but skipped by menu arrow-key
      traversal.
- [ ] A worked account-menu example lands in the docs.

## Item 4 — `GroupTrigger` force-injects a caret with no opt-out

`NavbarGroupTrigger` always appends a `faCaretDown` (desktop) or `faCaretRight`
(mobile) inside a `NavbarItemLinkIcon` (`Navbar/index.tsx:250-279`). An
avatar-only or icon-only trigger has to hide it in CSS. suite-prototype does
exactly that for two triggers:

```scss
.navbar-new-trigger .nav-link-icon:last-child,
.navbar-user-trigger .nav-link-icon:last-child { display: none; }
```

**Proposed API:** `<Navbar.GroupTrigger caret={false}>`, or accept a
`caret?: ReactNode` so it can be replaced as well as removed. Default stays
current behavior.

**Acceptance criteria**
- [ ] The caret can be suppressed via prop, no CSS required.
- [ ] Default behavior unchanged for existing consumers.
- [ ] Applies to both the mobile and desktop branches.

*(The `GroupMenu` width issue originally scoped here turned out to be a
spread-order bug rather than a missing feature — see Ticket 1 item 6.)*
