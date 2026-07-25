# Create-Deal polish — design

**Date:** 2026-07-24
**Surface:** `src/components/deals/CreateDealModal.tsx` (2-step wizard), with supporting
data-layer helpers in `src/data/createListing.ts`, `src/data/store.ts`, `src/data/actions.ts`.

Three independent polish changes to the New Deal flow. None restructure the wizard's
layout or step flow; they add behavior to existing controls.

---

## 1 — Contact field relabels to the side's role

The Contact combobox is only rendered when the modal is **not** already scoped to a
contact (`!contact`). Its `Field.Label` and input placeholder become driven by the
selected side + deal type, reusing the titles already defined in `SIDE_DISPLAY`.

| Side selected | Sale label | Lease label |
|---|---|---|
| seller | **Seller** | **Landlord** |
| buyer | **Buyer** | **Tenant** |
| none | **Contact** (fallback) | **Contact** |

- Label text: `side ? SIDE_DISPLAY[side][dealType].title : "Contact"`.
- Placeholder mirrors it: `Search sellers…` / `Search landlords…` / `Search buyers…` /
  `Search tenants…`, falling back to `Search contacts…` when no side is chosen.
- Pure display change. No data-model change. The label updates reactively as the broker
  flips the Side buttons or the Sale/Lease tab.

---

## 2 — Property dropdown groups the contact's owned properties first

**Trigger (per decision):** only when the selected side is **seller** (Sale) or
**landlord** i.e. `side === "seller"` **and** a contact is selected. Buyer/Tenant, or no
contact selected, keep the current flat alphabetical list.

**Presentation (per decision):** two labeled sections inside the dropdown, rendered with
Base-UI Combobox grouping primitives (`Combobox.Group` / `Combobox.GroupLabel` /
`Combobox.Collection`):

1. **`Owned by {contact name}`** — the contact's own properties
2. **`All properties`** — everything else

### Mechanics

- The contact's owned property ids come from `getContact(contactOption.value).propertyIds`.
- Build a grouped items structure `{ value: string; items: PropertyOption[] }[]`:
  - When grouping applies **and** the contact owns ≥1 property in the option set → two
    groups (owned first, rest second).
  - Otherwise → a single unlabeled group holding all options (so the render path is
    uniform and Base-UI filtering still works within the group).
- The Combobox `items` prop takes the grouped array; `Combobox.List` uses its render-prop
  to emit a `Combobox.Group` + `Combobox.GroupLabel` (label hidden when the single
  fallback group has no name) + `Combobox.Collection` that renders each `Combobox.Item`
  exactly as today (icon, label, type badge, subtype/size line).
- This **replaces** today's `propertyOptions` sort, which only elevated owned properties
  for the modal's initiating `contact` prop. The new logic keys off the live
  `contactOption` + `side`, so it also works for a contact chosen in the combobox.
- The pre-scoped `property` branch (locked property, read-only) is unaffected.

**Implementation risk:** grouped-items rendering with Base-UI Combobox filtering must be
validated during build (typecheck + run the modal). Fallback if grouping proves fiddly:
keep the flat list but render a non-selectable header row before the owned block. The
decision is section headers, so the grouped primitives are the primary path.

---

## 3 — Uploaded files fake an AI-prefilled, near-publish-ready deal

When the broker uploads files in step 1, Buildout "reads" them and (a) pre-selects the
documents it can now produce, marked as coming from the upload, and (b) pre-fills the
deal's content so it is **publish-ready except for the AI-doc review** — the one
checkpoint that stays the broker's click in the Approve & Publish gate (per decision).

Uploaded files in the demo are, for the most part, **T-12s, rent rolls, and listing
agreements**.

### 3a — Document recommendation (pure helper)

`recommendDocsFromUploads(files: DealDocument[]): string[]` in `createListing.ts` maps
uploaded filenames to suggested-doc `key`s:

| Filename matches (case-insensitive) | Recommends |
|---|---|
| `rent roll` | `rent-roll` |
| `t-12` / `t12` / `operating statement` | `t12`, `noi`, `proforma` |
| `listing agreement` | `listing-agreement` |
| any of the above financial files present | also `om`, `bov` (marketing deliverables the AI drafts) |

All recommended keys are guaranteed to exist in `SUGGESTED_DOCUMENTS`. The result is a
de-duplicated, catalog-ordered array.

### 3b — Modal state

- New state `aiPickedDocKeys: Set<string>`, recomputed reactively from `files`.
- On files change: `checkedDocKeys` is unioned with the recommendations, and
  `aiPickedDocKeys` is set to the recommendations. When `files` becomes empty,
  `aiPickedDocKeys` clears and the auto-added keys are removed (revert to the default
  suggested set — but keep any doc the broker checked by hand; track that the
  auto-added keys are the ones to peel back).
- **Step 2 marker:** docs whose key is in `aiPickedDocKeys` render auto-checked in the
  *Selected* list with a sparkle **"From your files"** `Badge` (FontAwesome
  `faWandMagicSparkles`, `pro-regular`). Default suggested docs are unmarked.

### 3c — Publish-ready field fill (pure helper + patch)

`buildPublishReadyPatch(deal, property, dealType)` computes the field values that make the
deal pass `publishReadiness()` **except** `aiDocsReviewed`:

- **Listing dates (both types):** `listedOnDate = today`, `listingExpirationDate = today
  + 6 months` — matching the existing signed-listing-agreement convention in
  `seedGateForm`. Written to `transaction`.
- **Sale:** `marketing.saleTitle` (property address/name), `marketing.saleDescription`
  (short generated blurb from property type/size), `financials.askingPrice` (linked
  property's `askingPrice` if > 0, else a size-derived estimate, else a believable
  fallback) + recomputed `pricePerSqFt`.
- **Lease:** `marketing.leaseTitle`, `marketing.leaseDescription`,
  `marketing.spaceLeaseTerms[0]` seeded via `emptySpaceLeaseTerms(unitId)` with a
  `leaseRate` + `leaseRateUnits: 'SF/Yr'`, and `marketing.availableSqFt`.

Applied in `handleCreate` **after** `createDeal(draft)` returns, only when
`files.length > 0`, via existing `updateDealMarketing` / `updateDealTransaction` plus a
new merge-patch action `updateDealFinancials(dealId, patch)` in `actions.ts` (mirrors the
marketing/transaction patch helpers). `createProposalListing` is left untouched so other
callers/tests are unaffected.

The AI-doc review is intentionally **not** satisfied: the deal lands with every field
filled, and the broker's only remaining step to publish is checking off the AI docs in
the Approve & Publish (or Complete setup) gate.

### 3d — Step-1 visible feedback (per decision)

When `files.length > 0`:

- The skip/create button (today "Create deal", secondary) becomes **"Create deal with
  AI"** with a sparkle icon and elevated emphasis (promoted to primary; "Next" steps down
  to secondary so the AI action reads as the highlighted path). With no files, the current
  hierarchy is unchanged (Create deal secondary, Next primary).
- A subtle banner appears below the upload dropzone: **"Buildout read your files and
  pre-filled this deal — it's ready to publish once you review the documents."** Rendered
  with a Blueprint `Alert`/`Banner` using a `pro-duotone` icon per icon conventions.

---

## Out of scope

- No change to the wizard step structure, the Side/Stage/Scope controls, the underwriting
  depth control, or the Documents step's search/selected/available layout beyond the AI
  marker badge.
- No new persistence fields; all changes reuse existing `Listing`/`DealMarketing`/
  `DealTransaction`/`DealDocument` shapes.

## Testing

- Unit-test the two pure helpers in `createListing.ts`:
  - `recommendDocsFromUploads` — filename → keys, including the `om`/`bov` fold and empty
    input.
  - `buildPublishReadyPatch` — Sale and Lease produce a patch that makes
    `publishReadiness()` report only `aiDocsReviewed` missing.
- Manual: run the modal, verify (1) label flips with side/type, (2) grouped property
  dropdown for a seller with owned properties, (3) upload → banner + "Create deal with AI"
  + step-2 badges + a created deal whose publish gate shows only the doc-review gap.
