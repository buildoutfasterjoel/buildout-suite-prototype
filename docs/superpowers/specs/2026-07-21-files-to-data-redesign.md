# Files → Data section redesign

**Date:** 2026-07-21
**Component:** `src/components/properties/PropertyDetailFiles.tsx` (route: `_shell/listings/$listingId/files`)

## Goal

Rebrand the deal "Files" workspace as **"Data"** — the home for all contextual
data on a deal — and clean up its layout. This pass stays scoped to the existing
files workspace; no scaffolding for other data types yet.

## Changes

### 1. Rename Files → Data
- Page title (`ListingPageHeader`): `"Files"` → `"Data"`.
- Breadcrumb root crumb: `"Files"` → `"Data"` (both the `Breadcrumb.Page` root
  and the `Breadcrumb.Link` root label).
- Move dialog root option: `"Files (root)"` → `"Data (root)"`.
- Sidebar nav is already labeled "Data" — no change.

### 2. Header + upload
- Collapse the "New ▾" `DropdownMenu` into a single **"New Folder"** button using
  the **outline** variant. It opens the existing Create-Folder dialog. The
  "Upload File" menu item is removed (uploading now lives in the dropzone).
- Add an **always-visible dropzone** above the table: dashed border,
  `faCloudArrowUp`, "Drop files here or click to upload" (styled after the
  dropzone in `CreateDealModal.tsx`). Clicking it triggers the existing hidden
  file input; drag-and-drop reuses the existing `addFiles`/`handleDrop` handlers.
  It stays visible whether or not the folder has files.
- Keep drag-and-drop onto the table region working.

### 3. Layout order (top → bottom)
1. Page header — "Data" title + right-aligned "New Folder" outline button.
2. **Search bar**, moved to the **left** (was right-aligned).
3. **Breadcrumb**, moved to sit **underneath** the search bar (was on the same row).
4. **Dropzone** (always visible).
5. **File table** — footer removed.
6. **Recycle Bin section** where the footer used to be (see below).

### 4. Recycle Bin → button + modal
- Remove `Table.Footer` entirely.
- Below the table, render a **"Recycle Bin (N)"** button showing the trashed
  count.
- Clicking it opens a **modal** listing trashed items with **Restore** and
  **Delete forever** actions per row, plus an empty state ("Recycle Bin is
  empty").
- Remove the old full-page `view` state (`"files" | "recycle-bin"`) and the
  recycle-bin branch of the breadcrumb — the recycle bin is now modal-only.

## Out of scope
- Other data types (notes, links, etc.).
- Data-layer changes — all existing `dealFilesActions` reused as-is.
