# Free-form block positioning

Bring the document editor to parity with production: a block can be dragged
anywhere on a page and resized, instead of being a row in a vertical stack.
Free positioning makes the Layout palette redundant — `columns` and `section`
exist only to fake side-by-side and grouping, which movement and resizing do
directly.

## Where we are

A `Page` is a flex column of `Block`s. Two container types, `columns` and
`section`, hold one level of children. Drag-and-drop resolves a pointer into a
`DropTarget` — a sibling list plus an index — and the store splices the block
into that list.

Every one of the 12 designer templates ships `locked: true`: structure fixed,
content editable. `buildBlankPage()` ships `locked: false`. Nothing in the UI
unlocks a page; only Otto does, silently, inside `addBlock`/`moveBlock`/
`removeBlock`.

Documents are not persisted. `buildSampleDocument` and `buildGeneratedDocument`
rebuild every page from code on load; IndexedDB stores a generation outline, not
blocks. **The model can change freely — no migration, `SEED_VERSION` does not
move.**

## Decisions

- **Scope:** blank pages are free from birth. Template pages stay stacked until
  the user presses a new *Unfreeze layout* button, which converts by measuring.
- **Precision:** free pixels. No grid, no snapping, no alignment guides.
- **Overlap:** allowed. Array order is paint order; the Layers panel is the
  z-order control.

## 1. Model

```ts
/** A block's box on a free page, in page space. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
```

On `Page`:

```ts
/**
 * Geometry for a free-canvas page, keyed by block id. Present = this page is
 * free: its blocks are absolutely positioned and `blocks` order is paint order
 * (first = back, last = front). Absent = the stacked layout every template
 * page still uses.
 */
frames?: Record<string, Rect>;
```

Geometry lives in one map on the page rather than a `rect` field added to all 11
block interfaces. Blocks stay portable, `blockFactory` stays ignorant of layout,
and "is this page free?" is one check instead of a scan.

Coordinates are page space: origin at the top-left of the 816×1056 sheet, before
`PAGE_PADDING`. A block may therefore sit over the logo header or the footer,
which is the point of a free canvas.

Orphan frames (a deleted block's entry) are pruned in `removeBlock`. A block
moved to another page gets a fresh frame from the drop point, and its old entry
is dropped with it.

## 2. Render

`PageView` branches on `page.frames`.

Absent: today's flex column, untouched. This is the path every template page
takes, so the whole existing render stays live rather than being rewritten.

Present: one `position: relative` box at page size, each block wrapped in
`FreeBlock` — `position: absolute`, `left/top` from the frame, plus:

| Block                                     | Height rule  | Why                                                        |
| ----------------------------------------- | ------------ | ---------------------------------------------------------- |
| `image`, `map`, `divider`, `spacer`       | `height`     | Resizing crops and scales, which is the expected behavior.  |
| `heading`, `text`, `list`, `table`, `contents` | `min-height` | Long bound values grow the box instead of being clipped.    |
| `section`                                 | `height`     | It is a background rectangle; its size is the whole point.  |

Width is always the frame's `w`.

`map` blocks on a free page take height from the frame, so the `size` preset
control (`sm`/`md`/`lg`/`full`) is hidden there. The stored `size` is left alone
so the block still renders correctly if it is on a stacked page.

## 3. Move and resize

One hook, `useFrameDrag`, on pointer events:

- Drag the block body to move. Drag one of 8 handles (4 corners, 4 edges) to
  resize; the handle's direction string drives one shared calculation.
- Local state during the gesture, one store commit on pointer-up — a drag is one
  state change, not one per frame.
- Deltas divide by `zoom` before they reach the model, so dragging is 1:1 with
  the pointer at any zoom.

Two guards, both in pure functions so they are testable without a renderer:

- Minimum size 24×16, so a block cannot be resized out of existence.
- Clamp into the sheet, so a block cannot be dragged off the page and lost.

dnd-kit keeps what already works: palette → page drops, the Layers panel, the
Pages panel. It does not drive free movement. Resize handles need raw pointer
math regardless, and moving is the same math with a different direction.

A palette drop onto a free page needs the drop point in page coordinates:
`EditorDndProvider` records the last pointer position during the drag and
converts it against the page element's bounding rect and the zoom.

New blocks land at a default size per type (text 400×80, image 320×220, and so
on) centered on the drop point.

## 4. Unfreeze

An **Unfreeze layout** button in the page toolbar, which today holds only
placeholder buttons. Pressing it:

1. **Measures.** Every `[data-block-id]` inside the page element, relative to
   the page, divided by zoom.
2. **Flattens.** A `columns` block disappears and its children become top-level
   blocks at their measured positions. A `section` keeps its frame and becomes a
   background rectangle with an empty `blocks` array; its children are promoted
   to sit after it, therefore in front of it. This is what keeps the cover
   page's navy title band and the brand divider page's colored band intact.
3. **Writes.** `frames` set, `locked: false`.

The page is pixel-identical the moment after unfreezing. Nothing is invented,
because every number came from what was already on screen.

Split for testing: `flattenForFree(page)` is pure and takes the measured rects
as input; `measureFrames(pageEl, zoom)` is the DOM half and has no logic worth
testing.

Otto is unchanged. Its silent unlock leaves the page stacked — its tools run
outside React and cannot measure the DOM. Both page kinds keep working under
every existing tool, so no tool definition changes in this pass.

## 5. Palette and z-order

The **Layout** section is deleted. Content gains:

- **Divider** — moved out of Layout, it is content, not structure.
- **Box** — `section` with no children: the colored rectangle you put behind
  text.

`columns` and `spacer` stop being offerable. Both stay in the model, because the
12 templates are built from them and still render in stacked layout.

The Layers panel lists `page.blocks` in array order. On a free page that reads
back-to-front, so the panel says so. The affordance people actually reach for is
a pair of **Bring to front** / **Send to back** actions on the selected block,
which reuse `moveBlock` — no new store machinery.

## 6. Seeded demo

Every page of the sample Proposal is a locked template, so without a change the
feature is invisible on open. One page in `presets.ts` ships free: `frames` are
written by hand against blocks placed to look deliberate — an overlapping image
and text band that could not be built in the stacked layout. It is the page you
open to see what changed.

## Files

| File                          | Change                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| `types.ts`                    | `Rect`, `Page.frames`                                         |
| `frames.ts` *(new)*           | Pure geometry: drag, resize, clamp, `flattenForFree`          |
| `FreeBlock.tsx` *(new)*       | Absolute wrapper, 8 handles, `useFrameDrag`                   |
| `store.ts`                    | `setFrame`, `freePage`, frame pruning, depth actions          |
| `blocks/PageView.tsx`         | Free branch, Unfreeze button in the page toolbar              |
| `blocks/BlockViews.tsx`       | Height rules per block type on a free page                    |
| `panels/NavPanels.tsx`        | Palette sections, Layers note                                 |
| `dnd/EditorDndProvider.tsx`   | Pointer tracking, palette drop onto a free page               |
| `presets.ts`                  | The seeded free page                                          |
| `editor.scss`                 | Frame outline, handle styling                                 |

## Tests

Vitest, on the pure half only — per CLAUDE.md, the browser is for interactive
verification, not a committed suite.

- `frames.test.ts` — move, all 8 resize directions, minimum size, page clamp,
  zoom division.
- `flatten.test.ts` — columns dissolve, children keep order, a section survives
  as an empty background box behind its promoted children, ids are stable.

Playwright verifies it renders: open the editor, drag a block on the seeded free
page, resize it, unfreeze a template page and confirm it does not visibly move.

## Out of scope

Snapping and alignment guides, multi-select, rotation, group/ungroup, undo,
free positioning inside Otto's tool schema, converting the 12 templates to fixed
boxes.
