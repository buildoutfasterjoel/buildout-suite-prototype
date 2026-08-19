# AI Document Generation — Design

**Status:** approved, not yet implemented
**Branch:** `joel/ai-document-generation`

## Problem

The New Document modal is a template chooser: search plus three tabs of names,
and picking one navigates to `/editor/$listingId`, which always builds the same
fixed "Proposal" document. Nothing the broker knows about the deal — least of all
the files already sitting in the deal's Files workspace — reaches the document.

We want a flow where a broker selects (or uploads) deal files, says in their own
words what the document should emphasize, and gets a document whose **sections
actually reflect those inputs**, opened in the editor and filed on the deal's
Documents page.

## Vocabulary

| Term | Meaning |
| --- | --- |
| **Generated document** | A document Buildout drafted from source files plus instructions. A `DealDocument` with `aiGenerated: true` and a new `generation` payload. |
| **Source file** | A `DealFileItem` on the deal, selected as input to a generation. |
| **File kind** | A source file's classification, derived from its filename: `financials`, `rent-roll`, `photos`, `market`, `comps`, `legal`, `other`. |
| **Section** | One page of the outline, tagged with why it is there: `spine` (from the doc type), `file` (contributed by a source file's kind), or `instruction` (added by a recognized phrase in the prompt). |

`legal` and `other` files are legitimate selections that contribute no section.
The review screen says so explicitly rather than silently ignoring them.

## Decisions

**AI-first, template as the escape hatch.** The modal opens on the generation
screen. Today's search + three tabs is preserved verbatim, extracted into a
`TemplatePicker`, and reached by a "Choose from a template instead" link — where
it behaves exactly as it does today. Rejected: a two-card fork on open (makes the
broker pick a mode before they know what either does), and making the template
list step 1 of a wizard (buries the new capability behind the old path).

**Doc type sets a spine; files add sections.** The broker picks a document type,
which contributes a fixed spine, and each selected file contributes sections on
top, each credited to the file it came from. Rejected: files alone deciding
everything (one file yields a two-page document, and there is no way to ask for
an OM), and doc type alone deciding with files only feeding copy (choosing files
then has no visible effect, which is the whole point of the feature).

**The instructions textarea is the single source of truth for the prompt.**
Suggestion cards append their canonical sentence to the textarea; clicking again
removes it. `buildOutline` parses the textarea. So a clicked card and the same
phrase typed by hand go through one mechanism, and there is no hidden state
beside the text. Rejected: structured `Audience`/`Depth` selects — a parallel set
of controls beside the text, and not what was wanted.

**Every suggestion card states its consequence** ("adds Rent Roll Summary",
"6 pages instead of 9") and the review outline reflects it. Instructions that
match nothing recognized are still stored and echoed on review.

**Read-only review screen.** The outline is shown, not edited — the editor's page
rail already reorders and deletes pages. `Back` returns to screen 1 with all
inputs intact so the broker can adjust and re-generate.

**No orientation control.** The editor does not act on page orientation today, so
a control for it would be theater with no downstream effect.

**Search param, not a new route.** `/editor/$listingId` gains a `doc` search
param. No route moves — see CLAUDE.md on what those cost.

## The brain: one pure module

`src/data/documentGeneration.ts`. No React, no `Date.now()`, no `Math.random()` —
deterministic so the unit tests and SSR both hold, matching the constraint
`underwritingPages.ts` and `dealFiles.ts` already observe.

```
classifyFile(name)                             -> FileKind
SPINE[docType]                                 -> { openers, closers }
SECTIONS_FOR_KIND[kind]                        -> templateKey[]
INSTRUCTION_EFFECTS                            -> recognized phrase -> transform
buildOutline({ docType, files, instructions }) -> GeneratedSection[]
suggestionsFor({ files, docType, instructions }) -> SuggestionCard[]
```

Filename classification follows the regex idiom already established by
`recommendDocsFromUploads` in `src/data/uploadIntelligence.ts`:

| Kind | Matches |
| --- | --- |
| `financials` | `t-12`, `t12`, `operating statement`, `noi`, `pro ?forma` |
| `rent-roll` | `rent ?roll` |
| `photos` | `photo`, `image`, `.zip`, `.jpg`, `.png` |
| `market` | `submarket`, `market report`, `demographic`, `traffic` |
| `comps` | `comparable`, `comps` |
| `legal` | `lease`, `estoppel`, `agreement`, `psa`, `loi`, `nda`, `title` |
| `other` | anything else |

### Spine per document type

Each spine is split into `openers` and `closers` so sourced sections land in the
middle of the document rather than after the advisor bios.

| Document type | Openers | Closers |
| --- | --- | --- |
| Offering Memorandum | `cover`, `contents`, `propertySummary` | `advisorBios` |
| Proposal | `cover`, `contents`, `propertySummary` | `advisorBios` |
| Brochure | `cover`, `propertyDescription` | `advisorBios` |
| Flyer | `cover`, `propertyDescription` | — |
| Owner's Report | `cover`, `contents`, `financialSummary` | — |
| Executive Summary | `cover`, `propertySummary` | — |

### What each file kind contributes

| Kind | Sections |
| --- | --- |
| `financials` | `financialHero`, `financialSummary` |
| `rent-roll` | `rentRollSummary` |
| `photos` | `photoGallery` |
| `market` | `locationMap` |
| `comps` | `comparables` |
| `legal`, `other` | none — reported on review as reviewed without a section |

Sourced sections are emitted in a fixed kind order — `financials`, `rent-roll`,
`market`, `comps`, `photos` — so the same selection always produces the same
document. Duplicates dedupe on `templateKey`: two financial files, or an Owner's
Report whose spine already carries `financialSummary`, produce one of it.

### Recognized instruction phrases

| Canonical sentence | Recognized by | Effect |
| --- | --- | --- |
| Lead with the trailing-12 NOI growth. | `/lead with.*noi/i` | Ensure `financialHero`, move it directly after `cover` |
| Summarize the tenant roster. | `/tenant roster/i` | Add `rentRollSummary` |
| Emphasize the location and surrounding submarket. | `/emphasi\w+.*location/i` | Add `locationMap` |
| Keep it concise. | `/concise\|keep it short/i` | Cap at 6 sections, trimming sourced sections from the tail |
| Skip the sale comparables. | `/skip.*comps\|no comps/i` | Remove `comparables` |

Transforms apply in a fixed order — adds, then moves, then removes, then the
concise cap last — so the result never depends on the order phrases appear in
the text. Openers and closers are never trimmed by the cap.

### Suggestion deck

At most four cards, in this priority order, offered only when they would do
something:

1. **Lead with NOI** — a `financials` file is selected
2. **Summarize roster** — a `rent-roll` file is selected
3. **Emphasize location** — a `market` file is selected
4. **Skip comps** — the current outline contains `comparables`
5. **Keep it concise** — the current outline exceeds 6 sections

The deck and the outline both recompute whenever the file selection or the
document type changes, and a card whose sentence is already in the textarea
renders as selected.

## Data model

`DealDocument` gains one optional field, so every existing document is unaffected:

```ts
generation?: DocumentGeneration

interface DocumentGeneration {
  /** Which document type drove the spine — one of the six display names above, the same vocabulary as the template list. */
  docType: string
  sourceFileIds: string[]
  /** Captured at generation, so the outline still reads correctly if a file is later deleted. */
  sourceFileNames: string[]
  /** The broker's instructions, verbatim. */
  instructions: string
  /** The outline, in page order — what the editor builds. */
  sections: GeneratedSection[]
  generatedAt: string
}

interface GeneratedSection {
  /** A key from `features/editor/templates`. */
  templateKey: string
  name: string
  origin: 'spine' | 'file' | 'instruction'
  /** Set when origin is 'file'. */
  sourceFileName?: string
  /** Set when origin is 'instruction' — the phrase that added it. */
  instructionLabel?: string
}
```

A `createGeneratedDocument(listingId, input)` action in `src/data/actions.ts`
appends the `DealDocument` and returns its id, following the shape of the
existing deal mutations there.

## Seed

Seeded deals have no `listing.documents`, so a deal's Files workspace today holds
only the Leases and Correspondence fixtures — an estoppel, a master lease, a
buyer Q&A thread. Nothing a generator can act on. `buildInitialFiles` gains five
root-level files, deterministic and faker-free like the rest of that module, one
per interesting kind:

| File | Kind | Size |
| --- | --- | --- |
| `T-12 Operating Statement 2025.pdf` | `financials` | 1.4 MB |
| `Rent Roll 2026.xlsx` | `rent-roll` | 240 KB |
| `Submarket Report.pdf` | `market` | 3.1 MB |
| `Sale Comparables.xlsx` | `comps` | 96 KB |
| `Site Photos.zip` | `photos` | 18 MB |

`SEED_VERSION` moves 43 -> 44. The existing `dealFilesActions` tests assert
relative counts (`initial + 1`), so they are unaffected.

## The new template page

Ten of the eleven mapped sections already exist in
`features/editor/templates/designer.ts`. `rentRollSummary` does not — and mapping
`rent-roll` onto `financialSummary` would collapse the clearest demonstration of
the whole feature ("uncheck Rent Roll 2026.xlsx, watch that page disappear").

`underwritingPages.ts` already has a private `rentRollSection(ctx)` producing a
deterministic tenant table under the heading "Rent Roll Summary". Extract its
table construction into a shared helper rather than duplicating the fake tenant
data, then add `buildRentRollSummaryPage(property)` to `designer.ts` — heading,
address, table, in the shape of `buildFinancialSummaryPage` — and register it in
`TEMPLATES`. The numbers then agree between the rent roll page and the
underwriting section, which they would not if the data were written twice.

## Modal flow

`NewDocumentModal` becomes three screens with a step indicator following
`CreateDealModal`'s hand-built `StepIndicator` (Blueprint ships no stepper).

**Screen 1 — Generate a document.** A name input prefilled from the doc type and
the deal; a document-type select over the six types above; the source-file picker;
the instructions textarea and its suggestion deck; the "Choose from a template
instead" link; `Generate`.

The picker is one flat, searchable list of every non-deleted `DealFileItem` on
the deal, each row showing its kind badge and its folder as a subtitle, with a
running "3 of 8 selected" count. `Upload files` calls the real `addDealFile`, so
an uploaded file lands on the deal's Files page and auto-selects. `Generate` is
disabled until at least one file is selected.

**Screen 2 — Generating.** A staged checklist over a progress bar in the idiom of
`UnderwritingProgress`: steps derived from the actual selection ("Reading T-12
Operating Statement 2025.pdf", "Extracting financials", "Building 9 sections"),
each flipping pending -> working -> done, then handing off.

**Screen 3 — Review.** The outline in page order, each section labeled with its
origin and credited to its source file; the instructions echoed under "Your
instructions"; selected files that contributed nothing listed as reviewed.
`Back` and `Open in editor`.

## Editor integration

`initDocument` takes an optional fourth argument, the `DocumentGeneration`. When
present it builds pages from `sections` via `buildTemplatePage(templateKey,
property)` and names the document from the generated document's name. When
absent, it is today's `buildSampleDocument` path, untouched.

`/editor/$listingId` gains `doc?: string` in `validateSearch` alongside the
existing `focus`. Given `?doc=<id>`, `EditorRoot` resolves that document off the
listing and passes its `generation` to `initDocument`; without the param,
behaviour is exactly as today.

`PropertyDetailDocuments` already filters to `aiGenerated` documents, so a
generated document appears in its table with no change to the table itself. Its
`Edit` button gains `search: { doc: doc.id }`.

## Testing

Vitest against `documentGeneration.ts`, where all the logic lives:

- `classifyFile` for each kind, including the `other` fallback
- spine per document type, openers before sourced sections, closers after
- kind -> sections for each kind; `legal` and `other` contribute nothing
- dedupe: two financial files yield one `financialSummary`; an Owner's Report
  plus a financial file yields one
- each instruction effect, driven both by a clicked card's canonical sentence and
  by a hand-typed phrase
- the concise cap trims sourced sections only, never openers or closers
- transform order independence: phrases in any order give the same outline
- determinism: the same input twice gives an identical outline
- `suggestionsFor` offers a card only when it would change something, caps at four

Plus a test for `createGeneratedDocument`.

Then Playwright, to verify it renders rather than to pin it: open the modal,
select files, click a suggestion, generate, confirm the review outline matches
the selection, open the editor, confirm the page rail matches the outline and the
new row is on the Documents page.

## Out of scope

- Editing the outline on the review screen — the editor's page rail does that
- Re-generating an existing document in place, or per-section regeneration
- Anything on the space-level surfaces (Documents is building-level)
- Page orientation

## Files touched

| File | Change |
| --- | --- |
| `src/data/documentGeneration.ts` | new — classification, mapping, outline, suggestions |
| `src/data/documentGeneration.test.ts` | new |
| `src/data/types.ts` | `DocumentGeneration`, `GeneratedSection`, `DealDocument.generation` |
| `src/data/actions.ts` | `createGeneratedDocument` |
| `src/data/dealFiles.ts` | five root source files |
| `src/data/persistence.ts` | `SEED_VERSION` 44 |
| `src/components/properties/NewDocumentModal.tsx` | rewritten as the three-screen flow |
| `src/components/properties/TemplatePicker.tsx` | new — today's list, extracted |
| `src/components/properties/DocumentGenerationProgress.tsx` | new — screen 2 |
| `src/components/properties/PropertyDetailDocuments.tsx` | pass `listingId` into the modal (it does not receive it today), replace `onSelectTemplate` with the generated-document callback, `Edit` carries `?doc=` |
| `src/features/editor/templates/designer.ts` | `buildRentRollSummaryPage` |
| `src/features/editor/templates/index.ts` | register `rentRollSummary` |
| `src/features/editor/underwritingPages.ts` | extract the rent roll table helper |
| `src/features/editor/store.ts` | `initDocument` accepts a generation |
| `src/features/editor/EditorRoot.tsx` | resolve `?doc=` and pass it through |
| `src/routes/_shell/editor/$listingId.tsx` | `doc` search param |
