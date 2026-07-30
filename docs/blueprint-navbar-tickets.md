# Blueprint tickets — Navbar dropdown composition

Two tickets, ready to file. Findings are against
`@buildoutinc/blueprint-react@1.3.0` and `@buildoutinc/blueprint-theme`, with
line citations to the installed package sources. Discovered while building an
account dropdown (identity header + grouped links + persona submenu) in
suite-prototype.

**Both are Medium priority. Nothing here is blocking anyone today.**
Blueprint's `Navbar` has no production consumers — shipping applications use the
existing hand-written HTML/CSS navbar. suite-prototype is currently its only
consumer, and it renders correctly. Treat these as fix-before-adoption: the work
to do before the component is picked up more widely, not a live incident.

Ordering, since the board has no epics: **BP-A item 1 before BP-B item 3** (the
menu separator needs the divider token fixed first). Otherwise independent — link
as *relates to* if useful.

On the mobile branch: `Navbar.Group` rendering a `Collapsible` below `expand`
instead of a `Menu` is deliberate architecture, and the per-part mobile fork in
`GroupMenuItem` (`Navbar/index.tsx:332-360`) is the pattern working as designed.
Nothing in either ticket asks for that to change. BP-B item 1 asks for the
pattern to be *completed* — `GroupMenuItem` is currently the only part that has
a mobile fork.

---

# BP-A — Navbar dropdown silently drops tokens and props

**Type:** Bug
**Component:** blueprint-react / Navbar, blueprint-theme / navbar
**Affects version:** 1.3.0
**Priority:** Medium

Six independent defects, each small and independently fixable. Common thread:
something is accepted or implied and then quietly discarded — no errors are
raised, the output is just wrong or the input ignored. Four of the six are
one-line changes.

## Item 1 — `.navbar-dropdown` doesn't re-token its divider color

`.navbar-dropdown` re-tokens `--bp-dropdown-bg`, `--bp-dropdown-color`, and
`--bp-dropdown-border-color` for the navbar's surface
(`scss/components/navbar/_index.scss:115-121`) but not
`--bp-dropdown-divider-bg`. `.dropdown-divider` therefore keeps the base dropdown
value `oklch(94.87% 0.01 264.53)` — near-white — on the navbar's dark surface.

The navbar family already has the right value and uses it elsewhere:
`.navbar-separator` binds `--bp-separator-color` to `$navbar-divider-color`
(`_index.scss:109-113`), which resolves to `$buildout-blue-900`. The dropdown's
divider is the one piece that doesn't get it.

**Reproduce:** place `DropdownMenu.Separator` in a `Navbar.GroupMenu`; the rule
renders near-white against the dark panel.

**Fix** — one declaration in the existing block:

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
- [ ] No consumer-side `--bp-dropdown-divider-bg` override is required.
- [ ] Dropdowns outside a navbar are visually unchanged.

## Item 2 — `DropdownMenu.SubContent` doesn't inherit `.navbar-dropdown`

`SubContent` delegates to the same `DropdownMenuContent` as the top-level popup
but does not carry over the parent popup's surface class
(`src/components/DropdownMenu/index.tsx:179-196`). A submenu opened from inside a
navbar dropdown renders on the base light surface, directly beside its dark
parent.

**Reproduce:** `Navbar.GroupMenu` → `DropdownMenu.Sub` → `SubContent` with no
`className`. **Expected:** matches the parent's surface. **Actual:** light popup
beside a dark one. **Current workaround:**
`<DropdownMenu.SubContent className="navbar-dropdown">`.

**Fix:** have the popup publish its surface class through context (or a
`data-surface` attribute) and have `SubContent` re-apply it, so a submenu
inherits its parent's surface by default.

**Acceptance criteria**
- [ ] `SubContent` with no `className` matches its parent popup's surface.
- [ ] An explicit `className` on `SubContent` still wins.
- [ ] Submenus outside a navbar are unchanged.

## Item 3 — `useMobileBreakpoint` misses the resize transition

```ts
const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`); // matches ≤ 1024
const onChange = () => { setIsMobile(window.innerWidth < breakpoint); }; // true ≤ 1023
mediaQuery.addEventListener('change', onChange);
```

`src/hooks/use-mobile.ts:19-27`. The subscription's boundary (1024↔1025) and the
predicate's boundary (1023↔1024) are off by one, and no `resize` listener backs
them up. Consequences at `expand="lg"`:

- 1025 → 1024 fires `change`; the handler computes `1024 < 1024` → `false`.
- 1024 → 900 fires nothing — the query still matches — so the handler never
  re-runs and `isMobile` stays `false`.

The navbar can sit in its desktop branch at 900px wide. Which value sticks
depends on the `innerWidth` reported at that single crossing event, so it
reproduces inconsistently: a coalesced resize that jumps past the breakpoint
lands correctly, a slow drag does not.

**Reproduce:** load at ≥1025px, drag the window slowly to ~900px.
**Expected:** `isMobile` becomes `true`, navbar collapses.
**Actual:** frequently stays `false`. Loading directly at 900px is correct — the
`useState` initializer computes the predicate directly, so only the resize path
is broken.

**Fix** — one boundary, one source of truth, using Bootstrap's `0.02px`
max-width convention so the JS edge matches the CSS edge:

```ts
const query = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`);
const onChange = () => setIsMobile(query.matches);
query.addEventListener('change', onChange);
onChange();
```

Reading `query.matches` instead of re-measuring `innerWidth` makes it impossible
for the two to drift again.

**Related, lower priority:** `$grid-breakpoints` is authored in `rem`
(`scss/bridge/_vars.scss:124-131`, from `$breakpoints-*` tokens) while the JS
`BREAKPOINTS` map is `px` (`use-mobile.ts:3-9`). The values agree at a 16px root,
but media-query `rem` resolves against the browser's default font size, so a user
who raises it moves the CSS boundary while the JS boundary stays fixed. Deriving
the JS map from the tokens would close that.

**Acceptance criteria**
- [ ] Slowly resizing from above the breakpoint to well below it flips `isMobile`
      exactly once, at the breakpoint.
- [ ] `isMobile` is `true` for every width below the breakpoint regardless of how
      the viewport got there.
- [ ] The JS boundary and the corresponding `.navbar-expand-*` CSS boundary agree
      at the exact breakpoint width.
- [ ] Coverage for the resize path, not just initial mount.

## Item 4 — `NavbarGroup` accepts `className` and discards it

```tsx
const NavbarGroup = ({ children }: ComponentProps<'li'>): ReactElement => {
```

`src/components/Navbar/index.tsx:215` destructures only `children`. The props type
is `ComponentProps<'li'>`, so `className` — and every other `li` prop —
type-checks, is accepted, and is then dropped: nothing is spread onto the
rendered `<NavbarItem className="dropdown">`. Consumers cannot style or target
the `<li class="nav-item dropdown">` wrapper, and get no error explaining why.

**Fix:**

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
- [ ] Both branches behave identically.

## Item 5 — `GroupMenu`'s prop spread clobbers its own `minWidth`

```tsx
const NavbarGroupMenu = ({ className, children, align, alignOffset, side,
  sideOffset, container, ...props }) => {
  // ...
  <DropdownMenuContent
    style={{ ...props.style, minWidth: 'var(--anchor-width)' }}   // :316
    {...props}                                                    // :317  ← overwrites
```

`src/components/Navbar/index.tsx:281-317`. `style` is never destructured out of
`props`, so it stays in `props` and the spread on line 317 lands after the
computed `style` on line 316 and replaces it wholesale. The `...props.style`
merge inside line 316 can never survive — it is dead code.

Result: a consumer who passes `style` silently loses the
`minWidth: var(--anchor-width)` floor the component intends to guarantee. Pass
nothing and the floor applies; pass `style={{ width: 320 }}` and it disappears,
with no warning.

**Reproduce:** `<Navbar.GroupMenu style={{ width: 320 }}>` and inspect the popup —
`min-width` is absent.

**Fix** — destructure `style` and merge explicitly, so precedence is visible:

```tsx
const NavbarGroupMenu = ({ className, children, align, alignOffset, side,
  sideOffset, container, style, ...props }) => {
  // ...
  <DropdownMenuContent
    style={{ minWidth: 'var(--anchor-width)', ...style }}
    {...props}
```

This also lets consumer `style` intentionally override the floor, which is the
more useful default given the floor is measured off the trigger — a 28px avatar
trigger makes it meaningless.

**Acceptance criteria**
- [ ] Passing `style` to `GroupMenu` no longer discards `minWidth`.
- [ ] An explicit `minWidth` in consumer `style` wins over the default.
- [ ] Passing no `style` preserves today's anchor-width behavior.
- [ ] The mobile branch (`:301`) handles `style` consistently.

## Item 6 — `NavbarGroupMenuItem` calls a hook conditionally

```tsx
function NavbarGroupMenuItem({ className, render, inset, ...props }, forwardedRef) {
  const { isMobile } = useNavbar();

  if (isMobile) {
    return useRender({ defaultTagName: 'button', /* ... */ });   // :335
  }

  return <DropdownMenuItem /* ... */ />;
}
```

`src/components/Navbar/index.tsx:326-362`. `useRender` is a hook — it calls
`useRenderElement` → `useRenderElementProps` → `useMergedRefs`
(`@base-ui/react/internals/useRenderElement.js:41-72`) — and it is called inside
`if (isMobile)`, so the number of hooks this component runs depends on the
viewport. That violates the Rules of Hooks.

**Why it doesn't currently crash:** when `isMobile` flips, `NavbarGroup` swaps
`Collapsible` for `DropdownMenu` at the same position in the tree (`:227-247`).
Those are different component types, so React unmounts the subtree and mounts a
fresh one — every `NavbarGroupMenuItem` instance is new, and each one's hook
order is internally consistent for its whole lifetime. The violation is masked by
an unrelated component's branching.

That makes it fragile rather than broken: it will trip
`react-hooks/rules-of-hooks` in any consumer or CI that runs the lint rule, and
it becomes a live "Rendered more hooks than during the previous render" crash the
moment `NavbarGroup` is refactored to keep one wrapper type across both branches
— which is a natural way to implement BP-B item 1.

**Fix** — call the hook unconditionally and branch on its result:

```tsx
const { isMobile } = useNavbar();
const mobileElement = useRender({
  defaultTagName: 'button',
  ref: forwardedRef,
  props: mergeProps<'button'>(
    { className: cn('navbar-dropdown-menu-item dropdown-item', className) },
    props as useRender.ComponentProps<'button'>,
  ),
  render: render as useRender.ComponentProps<'button'>['render'],
  state: { slot: 'navbar-group-menu-item' },
});

if (isMobile) return mobileElement;
return <DropdownMenuItem /* ... */ />;
```

Apply the same shape to any other part that gains a mobile fork under BP-B
item 1, so the pattern doesn't propagate.

**Acceptance criteria**
- [ ] No hook is called inside a conditional in `Navbar`.
- [ ] `react-hooks/rules-of-hooks` passes on `src/components/Navbar/index.tsx`.
- [ ] `GroupMenuItem` renders identically in both branches, before and after.

---

# BP-B — Navbar needs first-class menu composition parts

**Type:** Enhancement / Story
**Component:** blueprint-react / Navbar
**Affects version:** 1.3.0
**Priority:** Medium

`Navbar.GroupMenu` forwards arbitrary children into Base UI's `Menu.Popup`, so a
rich navbar menu is possible today — but every structural element beyond a flat
item must be assembled from `ui/DropdownMenu` and hand-restyled. Building a
standard account menu took four separate workarounds. These are the parts that
should exist.

## Item 1 — `GroupMenuItem` is the only part with a mobile fork

`Navbar.GroupMenuItem` renders a `<button class="navbar-dropdown-menu-item
dropdown-item">` inside the `Collapsible` on mobile and a `DropdownMenuItem` on
desktop (`src/components/Navbar/index.tsx:326-362`). That per-part fork is the
right pattern — `Navbar.Group` deliberately renders a `Collapsible` below
`expand` rather than a menu, and each part is responsible for having a form that
works in both. **No change requested there.**

The problem is that `GroupMenuItem` is the *only* part that implements it. There
is no `Navbar.GroupMenuLabel`, `GroupMenuRadioGroup`, `GroupMenuRadioItem`, or
`GroupMenuCheckboxItem`. A consumer who needs any of those inside a navbar menu
has no Navbar-level part to reach for, and the only alternative — importing
`DropdownMenu.RadioGroup` and friends — cannot work in the mobile branch, because
those are Base UI `Menu` primitives and there is no `Menu.Root` inside a
`Collapsible`. They throw at render once the viewport narrows.

So the consumer's options today are: hand-write a `useNavbar().isMobile` fork
around every such part (what suite-prototype's persona switcher does), or don't
use the part. Neither is a library-quality answer.

**Proposed API** — complete the pattern `GroupMenuItem` already establishes:

```
Navbar.GroupMenuLabel
Navbar.GroupMenuRadioGroup
Navbar.GroupMenuRadioItem
Navbar.GroupMenuCheckboxItem
```

each delegating to the `DropdownMenu` part on desktop and rendering the
equivalent plain markup inside the `Collapsible` on mobile. Where a mobile
analogue genuinely doesn't exist, document the part as desktop-only and publish
the `isMobile` fork as the sanctioned pattern, so consumers aren't inventing it.

Note BP-A item 6 when implementing: `GroupMenuItem`'s existing fork calls a hook
inside a conditional. Don't copy that shape into the new parts.

**Acceptance criteria**
- [ ] Every `DropdownMenu` part usable inside `GroupMenu` on desktop either has a
      mobile-safe `Navbar.*` equivalent or is documented as desktop-only.
- [ ] A label, radio group, and checkbox item each render in both branches with no
      consumer-side `isMobile` branching.
- [ ] Automated coverage for at least one such part in both branches.

## Item 2 — No submenu parts, and `Navbar.Group` can't be nested to fake one

`Navbar.GroupMenu` is already the correctly-surfaced dropdown, so nesting a
second `Navbar.Group` inside one looks like it should yield a correctly-surfaced
submenu for free. It doesn't.

`Navbar.Group` renders a plain `DropdownMenu` = Base UI `Menu.Root`
(`src/components/Navbar/index.tsx:242`). Base UI establishes the parent/child
menu relationship *only* when `isSubmenu` is set, which comes solely from
`MenuSubmenuRootContext` (`@base-ui/react/menu/root/MenuRoot.js:57-62`) — a
context only `Menu.SubmenuRoot` provides
(`@base-ui/react/menu/submenu-root/MenuSubmenuRoot.js:26-35`). A nested
`Menu.Root` is therefore a second independent menu:

- `parent.type` stays `undefined`, so the nested menu takes `modal` semantics
  (`MenuRoot.js:129`). Base UI's own "modal is not supported on nested menus"
  warning cannot fire, because it is guarded on `parent.type !== undefined`
  (`MenuRoot.js:118`) — the misuse is silent.
- With no parent store link the parent doesn't know the child is open, and the
  child's popup portals outside the parent's DOM, so the parent's outside-press
  dismissal treats interaction in the child as outside.
- `Navbar.GroupTrigger` renders `.nav-link` (min-height `$spacers` 8), not
  `.dropdown-item`, so it reads as a navbar link sitting inside a menu.

**Proposed API** — thin wrappers over the Base UI submenu parts, forwarding the
navbar surface, mirroring how `GroupMenuItem` already wraps `DropdownMenuItem`:

```
Navbar.GroupSubmenu        → wraps DropdownMenu.Sub
Navbar.GroupSubmenuTrigger → wraps DropdownMenu.SubTrigger, styled .dropdown-item
Navbar.GroupSubmenuMenu    → wraps DropdownMenu.SubContent + navbar surface
```

Once BP-A item 2 lands, `GroupSubmenuMenu` needs no explicit surface class. On
mobile these should fork to a nested `Collapsible` rather than throwing — see
BP-A.

**Acceptance criteria**
- [ ] A submenu inside `Navbar.GroupMenu` is expressible without importing from
      `ui/DropdownMenu`.
- [ ] The trigger is styled as a menu item, not a nav link.
- [ ] The submenu popup matches its parent's surface with no consumer className.
- [ ] Submenu keyboard behavior is correct: arrow-right/left, the parent stays
      open while the child is open, one Escape closes only the child.
- [ ] Works, or degrades documentedly, below `expand`.

## Item 3 — No menu-level separator, label, or header

There is no `Navbar.GroupMenuSeparator`, `GroupMenuLabel`, or `GroupMenuHeader`,
so consumers mix component families inside a Navbar subtree. For separators, the
two existing options each solve half the problem, so either choice needs
hand-tuning:

| | color | vertical margin |
|---|---|---|
| `Navbar.Separator orientation="horizontal"` | correct — `--bp-separator-color` = `$navbar-divider-color` | none |
| `DropdownMenu.Separator` | wrong on this surface (BP-A item 1) | correct — `--bp-dropdown-divider-margin-y` |

`Navbar.Separator` does accept `orientation="horizontal"` despite defaulting to
vertical (`src/components/Navbar/index.tsx:364-374`) — that works; it simply
carries no spacing for menu use.

**Proposed API:** `Navbar.GroupMenuSeparator` — horizontal,
`$navbar-divider-color`, `--bp-dropdown-divider-margin-y` spacing, mobile-safe.
Plus `Navbar.GroupMenuLabel` for section headings, re-tokening
`--bp-dropdown-header-color` for the navbar surface (the base value is tuned for
the light surface).

**Acceptance criteria**
- [ ] A separator inside `GroupMenu` needs no consumer CSS for color or spacing.
- [ ] A group label is legible on the navbar surface with no consumer CSS.
- [ ] Both render in the mobile branch.

## Item 4 — No account/user-menu pattern

`GroupMenuItem` has no icon, label, or description sub-parts, and `GroupMenu` has
no header slot. An identity header (avatar + name + email + role) is therefore
bespoke markup styled against `.dropdown-*` internals, and every icon-bearing
item is a hand-rolled `d-flex align-items-center gap-2`.

**Proposed API:**

```
Navbar.GroupMenuHeader          → non-interactive, outside item traversal order
Navbar.GroupMenuItemIcon        → matches GroupMenuItem's own spacing
Navbar.GroupMenuItemLabel
Navbar.GroupMenuItemDescription → muted second line
```

An account menu is common enough across products to warrant a documented recipe
composed from these, rather than each consumer re-deriving it.

**Acceptance criteria**
- [ ] An icon + label item needs no utility classes.
- [ ] A header is announced to screen readers but skipped by menu arrow-key
      traversal.
- [ ] A worked account-menu example lands in the docs.

## Item 5 — `GroupTrigger` force-injects a caret with no opt-out

`NavbarGroupTrigger` always appends a `faCaretDown` (desktop) or `faCaretRight`
(mobile) inside a `NavbarItemLinkIcon`
(`src/components/Navbar/index.tsx:250-279`). An avatar-only or icon-only trigger
must hide it in CSS:

```scss
.navbar-new-trigger .nav-link-icon:last-child,
.navbar-user-trigger .nav-link-icon:last-child { display: none; }
```

**Proposed API:** `<Navbar.GroupTrigger caret={false}>`, or a
`caret?: ReactNode` so it can be replaced as well as removed. Default unchanged.

**Acceptance criteria**
- [ ] The caret can be suppressed by prop, with no CSS.
- [ ] Default behavior unchanged for existing consumers.
- [ ] Applies to both branches.
