---
name: prototype-review
description: Run a consistency check on the prototype before handing it off for human review. Audits icon weight usage, Blueprint component adoption, styling conventions (Bootstrap vs Tailwind), route structure, and design quality signals. Catches the mechanical rule violations so human reviewers can focus on design and UX feedback.
---

This skill audits the codebase against the rules established in this template. It does not replace human review — it eliminates the noise (wrong icon weight, raw HTML elements, Tailwind leftovers) so the human reviewer can focus on whether the prototype actually works and looks right.

## When to use

Trigger this skill when:
- A prototype page or feature is complete and ready for review
- The user asks "is this ready?" or "can you check this?"
- Before any handoff or demo

## How to run the audit

Read every file in `src/routes/` and any component files in `src/`. Then check each category below. Report findings at the end using the format in the final section.

---

## Category 1: Icons

**What to look for:**

1. **Wrong package for Alert or Banner** — Any `<Alert>` or `<Banner>` component using an icon imported from `pro-regular-svg-icons` or `pro-solid-svg-icons`. These must use `pro-duotone-svg-icons`.

2. **Missing `withIcon` on Alert** — Any `<Alert>` that contains a `<FontAwesomeIcon>` but does not have the `withIcon` prop. Without it the icon overlaps the text.

3. **Light icons imported** — Any import from `@fortawesome/pro-light-svg-icons`. This package is not installed and will cause a build error.

4. **Free icons used instead of Pro** — Any import from `@fortawesome/free-solid-svg-icons`, `@fortawesome/free-regular-svg-icons`, or `@fortawesome/free-brands-svg-icons` (except brands, which is acceptable for brand logos). Pro packages are installed — use them.

5. **Solid icons used without justification** — Any import from `@fortawesome/pro-solid-svg-icons`. Flag these as needing a deliberate reason. Solid is not a default weight.

6. **Icon not first child in Alert/Banner** — `FontAwesomeIcon` must be the first child inside `<Alert>` (with `withIcon`) and inside `<BannerContent>`. If it appears after text, the layout breaks.

---

## Category 2: Blueprint component adoption

**What to look for:**

1. **Raw HTML form elements** — Any lowercase `<button`, `<input`, `<textarea`, `<select` in JSX. These should be replaced with `<Button>`, `<Input>`, `<Textarea>`, `<Select>` from Blueprint.
   > Exception: elements inside a Blueprint component's internal render are fine — only flag ones the developer wrote directly.

2. **Raw table elements** — Any `<table`, `<tr`, `<td`, `<th` written directly in JSX. Use `<Table>` from Blueprint.

3. **Barrel imports from Blueprint** — Any import from `@buildoutinc/blueprint-react` without a subpath (e.g., `from '@buildoutinc/blueprint-react'`). All imports must use subpaths: `@buildoutinc/blueprint-react/ui/ComponentName`.

4. **Custom primitives that duplicate Blueprint** — Any hand-rolled card wrapper, button component, or input wrapper when Blueprint already ships that component. Check for components named things like `MyButton`, `CustomCard`, `FormInput`.

---

## Category 3: Styling

All spacing, layout, typography, and color should be done with **Bootstrap utility classes** or **Blueprint custom utilities** — not inline styles or arbitrary values. The Blueprint theme extends Bootstrap 5 and may add its own utility classes on top.

**What to look for:**

1. **Inline style overrides that should be utilities** — Any `style={{ ... }}` prop using values that have a Bootstrap or Blueprint equivalent. Common cases:
   - `style={{ display: 'flex' }}` → use `d-flex`
   - `style={{ gap: '1rem' }}` → use `gap-3` or `gap-4`
   - `style={{ padding: '...' }}` → use `p-*`, `py-*`, `px-*`
   - `style={{ marginTop: '...' }}` → use `mt-*`
   - `style={{ fontWeight: 'bold' }}` → use `fw-bold`
   - `style={{ color: '...' }}` → use `text-primary`, `text-muted`, `text-body`, etc.
   - `style={{ backgroundColor: '...' }}` → use `bg-*` utilities

   `style` is acceptable for values that have no utility equivalent (e.g., `maxWidth` for a constrained form container, `style={{ maxWidth: 640 }}`).

2. **Hardcoded colors** — Any hex (`#3d5a80`), rgb, or hsl value in a `style` prop or passed as a `className` string. These bypass the design token system entirely. Use Bootstrap semantic color utilities (`text-primary`, `text-success`, `text-danger`, `text-muted`, `bg-light`, `bg-primary`) or Blueprint CSS token variables from the theme.

3. **Missing theme import** — Check `src/main.scss`. It must contain:
   ```scss
   @import "@buildoutinc/blueprint-theme/scss/theme";
   ```
   If this line is missing or commented out, all Blueprint components will render unstyled.

---

## Category 4: Route structure

**What to look for:**

1. **Edited `routeTree.gen.ts`** — Check git diff or file modification time if possible. This file is auto-generated and should never be manually edited. If it looks like it has hand-written route entries, flag it.

2. **Routes not using `createFileRoute`** — Every file in `src/routes/` (except `__root.tsx`) must export a `Route` constant created with `createFileRoute`. Flag any route file missing this pattern.

3. **Route path mismatch** — The path string in `createFileRoute('/path')` should match the file's location under `src/routes/`. A file at `src/routes/listings.tsx` should have `createFileRoute('/listings')`. Mismatches cause 404s.

---

## Category 5: Design quality signals

These are softer checks — flag them as warnings, not errors. They indicate the prototype may read as generic.

1. **Multiple primary buttons on one page** — More than one `variant="primary"` on the same visible page. There should be at most one clear primary action per view. Others should be `secondary`, `outline`, or `ghost`.

2. **Flat heading hierarchy** — All headings using the same size class (e.g., every title is `h3`, no variation). A well-structured page uses a clear typographic scale.

3. **Identical card sizes throughout** — Every card the same width and padding with no visual hierarchy. At least one deliberate size or density variation makes the layout feel considered.

4. **No identifiable design direction** — If the page looks like default Bootstrap grid (equal-spaced cards, primary button at the bottom, standard heading), note it as a signal to revisit design direction. Refer the user to section 8 of the `/blueprint` skill.

---

## Report format

Produce a report in this structure. For each finding include the file path and a one-line fix.

```
## Prototype Review

### Icons  ✅ / ⚠️ / ❌
[List findings, or "No issues found."]

### Blueprint components  ✅ / ⚠️ / ❌
[List findings, or "No issues found."]

### Styling  ✅ / ⚠️ / ❌
[List findings, or "No issues found."]

### Route structure  ✅ / ⚠️ / ❌
[List findings, or "No issues found."]

### Design quality  ✅ / ⚠️ / ❌
[List findings, or "No issues found."]

---
**Summary:** X error(s), Y warning(s).
[One sentence on overall readiness, e.g. "Fix the 2 icon errors before handoff; design warnings are optional but worth a pass."]
```

Use ✅ when a category has no findings, ⚠️ for design quality signals (subjective, non-blocking), and ❌ for rule violations that should be fixed before handoff.
