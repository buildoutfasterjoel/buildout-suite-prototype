# AI Document Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the New Document modal's template-chooser with an AI-first flow where a broker selects or uploads deal files, describes what to emphasize, and gets a document whose sections reflect those inputs — opened in the editor and filed on the deal's Documents page.

**Architecture:** All decision logic lives in one pure, deterministic module (`src/data/documentGeneration.ts`) that maps filenames to kinds, kinds to document sections, and recognized instruction phrases to outline transforms. The React layer is a three-screen modal that calls into it. The editor gains an optional `generation` argument that builds pages from the stored outline; without it, today's fixed Proposal path is untouched.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Zustand (editor store) · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-08-19-ai-document-generation-design.md` (committed at `001b321`)

## Global Constraints

- **Package manager is Bun.** Run everything as `bun --bun run <script>`. Tests: `bun --bun run test`.
- **`vite build` does NOT type-check.** The type gate is `bunx tsc --noEmit`. Run it after every task that touches `.tsx`.
- **No `Date.now()`, `new Date()`, or `Math.random()` in `src/data/documentGeneration.ts`, `src/data/dealFiles.ts`, or anything under `src/features/editor/templates/`.** These modules must be deterministic — the editor rebuilds documents repeatedly and holds no persistence, and SSR output must match the first client render. Timestamps are stamped by the action/UI layer only.
- **Blueprint components only**, imported from the `ui` subpath: `import { Button } from "@buildoutinc/blueprint-react/ui/Button"`. Bootstrap 5 utility classes for spacing and layout. No Tailwind.
- **FontAwesome `pro-regular` by default.** Never pass `fixedWidth` — it is deprecated.
- **`Field.Label` must be nested inside a `<Field>`.** A standalone `Field.Label` or `Field.Description` crashes at runtime and `tsc` will not catch it. For detached helper text use `className="form-text"`.
- **No margin utility classes on icons inside a `Badge`** — Blueprint's Badge already applies a flex gap.
- **There are no component tests in this repo** (every test is a `.test.ts` logic test; there is no `.test.tsx`). React surfaces are verified by `bunx tsc --noEmit` plus Playwright. Do not add `@playwright/test` or a committed E2E suite.
- **Never move or rename a route file.** Route moves break hardcoded `useParams({ from })` and full-reload `<a href>` navigation, and `vite build` catches neither.
- **`SEED_VERSION` must move when seed shape changes**, or IndexedDB serves stale data and the browser will show old fixtures no matter what the code says.
- Non-gates to ignore: biome warnings, and a React/module `stderr` line Vitest prints.

---

### Task 1: File classification, spine, and the base outline

The pure module's foundation: classify a filename into a kind, map a document type to its spine, map each kind to the sections it contributes, and assemble a base outline. Instruction phrases come in Task 2.

**Files:**
- Create: `src/data/documentGeneration.ts`
- Create: `src/data/documentGeneration.test.ts`
- Modify: `src/data/types.ts` (append near the existing `DealDocument`, around line 480)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type FileKind = 'financials' | 'rent-roll' | 'photos' | 'market' | 'comps' | 'legal' | 'other'`
  - `type DocType = 'Offering Memorandum' | 'Proposal' | 'Brochure' | 'Flyer' | "Owner's Report" | 'Executive Summary'`
  - `const DOC_TYPES: DocType[]`
  - `const KIND_LABEL: Record<FileKind, string>`
  - `function classifyFile(name: string): FileKind`
  - `interface SourceFileRef { id: string; name: string }`
  - `interface OutlineInput { docType: DocType; files: SourceFileRef[]; instructions: string }`
  - `function buildOutline(input: OutlineInput): GeneratedSection[]`
  - `interface DocumentGeneration` and `interface GeneratedSection` in `src/data/types.ts`
  - `DealDocument.generation?: DocumentGeneration`

- [ ] **Step 1: Add the persisted types**

In `src/data/types.ts`, directly after the existing `DealDocument` interface:

```ts
/**
 * One page of a generated document's outline, carrying why it is there so the
 * review screen can credit it back to its source.
 */
export interface GeneratedSection {
  /** A key from `features/editor/templates` — see the registry in templates/index.ts. */
  templateKey: string
  name: string
  origin: 'spine' | 'file' | 'instruction'
  /** Set when origin is 'file' — the display name of the file that contributed it. */
  sourceFileName?: string
  /** Set when origin is 'instruction' — the phrase that added it. */
  instructionLabel?: string
}

/**
 * The record of one AI document generation: what the broker fed it, what they
 * asked for, and the outline it produced. Stored on the DealDocument so the
 * editor can rebuild the same pages and the review screen stays truthful.
 */
export interface DocumentGeneration {
  /** Which document type drove the spine — a display name, the same vocabulary as the template list. */
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
```

Then add one optional field to `DealDocument` (immediately after `aiGenerated`):

```ts
  /** Present when this document came from the AI generation flow. */
  generation?: DocumentGeneration
```

- [ ] **Step 2: Write the failing tests**

Create `src/data/documentGeneration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildOutline, classifyFile, DOC_TYPES } from './documentGeneration'

describe('classifyFile', () => {
  it('recognizes financial statements', () => {
    expect(classifyFile('T-12 Operating Statement 2025.pdf')).toBe('financials')
    expect(classifyFile('t12.xlsx')).toBe('financials')
    expect(classifyFile('NOI Statement.pdf')).toBe('financials')
    expect(classifyFile('Pro Forma Cash Flow.xlsx')).toBe('financials')
  })

  it('recognizes a rent roll ahead of the generic financial match', () => {
    expect(classifyFile('Rent Roll 2026.xlsx')).toBe('rent-roll')
    expect(classifyFile('rentroll.csv')).toBe('rent-roll')
  })

  it('recognizes photos, market material, and comps', () => {
    expect(classifyFile('Site Photos.zip')).toBe('photos')
    expect(classifyFile('exterior.jpg')).toBe('photos')
    expect(classifyFile('Submarket Report.pdf')).toBe('market')
    expect(classifyFile('Demographics Report.pdf')).toBe('market')
    expect(classifyFile('Sale Comparables.xlsx')).toBe('comps')
  })

  it('recognizes legal paperwork', () => {
    expect(classifyFile('Master Lease Agreement.docx')).toBe('legal')
    expect(classifyFile('Tenant Estoppel - Suite 100.pdf')).toBe('legal')
  })

  it('falls back to other', () => {
    expect(classifyFile('Buyer Q&A Thread.pdf')).toBe('other')
    expect(classifyFile('')).toBe('other')
  })
})

describe('buildOutline base structure', () => {
  const noFiles = { docType: 'Offering Memorandum' as const, files: [], instructions: '' }

  it('produces the spine alone when no files are selected', () => {
    const keys = buildOutline(noFiles).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'contents', 'propertySummary', 'advisorBios'])
  })

  it('marks every spine section with the spine origin', () => {
    expect(buildOutline(noFiles).every((s) => s.origin === 'spine')).toBe(true)
  })

  it('builds a non-empty outline for every document type', () => {
    for (const docType of DOC_TYPES) {
      const sections = buildOutline({ docType, files: [], instructions: '' })
      expect(sections.length).toBeGreaterThan(0)
      expect(sections[0].templateKey).toBe('cover')
    }
  })

  it('inserts sourced sections between the openers and the closers', () => {
    const keys = buildOutline({
      docType: 'Offering Memorandum',
      files: [{ id: 'f1', name: 'Site Photos.zip' }],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'contents', 'propertySummary', 'photoGallery', 'advisorBios'])
  })

  it('credits each sourced section to the file that contributed it', () => {
    const sections = buildOutline({
      docType: 'Brochure',
      files: [{ id: 'f1', name: 'Rent Roll 2026.xlsx' }],
      instructions: '',
    })
    const rentRoll = sections.find((s) => s.templateKey === 'rentRollSummary')
    expect(rentRoll?.origin).toBe('file')
    expect(rentRoll?.sourceFileName).toBe('Rent Roll 2026.xlsx')
  })

  it('emits sourced sections in a fixed kind order regardless of selection order', () => {
    const forward = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'a', name: 'Site Photos.zip' },
        { id: 'b', name: 'T-12.pdf' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    const reversed = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'b', name: 'T-12.pdf' },
        { id: 'a', name: 'Site Photos.zip' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(forward).toEqual(reversed)
    expect(forward.indexOf('financialSummary')).toBeLessThan(forward.indexOf('photoGallery'))
  })

  it('contributes nothing for legal and other files', () => {
    const keys = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'a', name: 'Master Lease Agreement.docx' },
        { id: 'b', name: 'Buyer Q&A Thread.pdf' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'propertyDescription', 'advisorBios'])
  })

  it('deduplicates when two files contribute the same section', () => {
    const keys = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'a', name: 'T-12 2025.pdf' },
        { id: 'b', name: 'NOI Statement.pdf' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(keys.filter((k) => k === 'financialSummary')).toHaveLength(1)
  })

  it('lets the spine keep a section a file would also have contributed', () => {
    const sections = buildOutline({
      docType: "Owner's Report",
      files: [{ id: 'a', name: 'T-12 2025.pdf' }],
      instructions: '',
    })
    const summaries = sections.filter((s) => s.templateKey === 'financialSummary')
    expect(summaries).toHaveLength(1)
    expect(summaries[0].origin).toBe('spine')
  })

  it('is deterministic across repeated calls', () => {
    const input = {
      docType: 'Proposal' as const,
      files: [{ id: 'a', name: 'Rent Roll 2026.xlsx' }],
      instructions: '',
    }
    expect(buildOutline(input)).toEqual(buildOutline(input))
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun --bun run test src/data/documentGeneration.test.ts`
Expected: FAIL — cannot resolve `./documentGeneration`.

- [ ] **Step 4: Write the module**

Create `src/data/documentGeneration.ts`:

```ts
import type { GeneratedSection } from './types'

/**
 * The AI document generation brain: what a source file is, what each kind of
 * file contributes to a document, and how a document type's spine is shaped.
 *
 * Deliberately pure and deterministic — no Date, no Math.random, and no imports
 * from `features/editor`. The editor consumes the `templateKey` strings this
 * module emits; the coupling runs one way and is guarded by a test that every
 * emittable key resolves in the editor's TEMPLATES registry.
 */

export type FileKind =
  | 'financials'
  | 'rent-roll'
  | 'photos'
  | 'market'
  | 'comps'
  | 'legal'
  | 'other'

/** Badge copy for each kind, shown beside a file in the picker. */
export const KIND_LABEL: Record<FileKind, string> = {
  financials: 'Financials',
  'rent-roll': 'Rent Roll',
  photos: 'Photos',
  market: 'Market',
  comps: 'Comps',
  legal: 'Legal',
  other: '—',
}

/**
 * Filename patterns, in priority order — first match wins. Rent roll is tested
 * before the generic financial patterns so "Rent Roll 2026.xlsx" does not land
 * in `financials`. Follows the regex idiom of `recommendDocsFromUploads`.
 */
const KIND_PATTERNS: { kind: FileKind; re: RegExp }[] = [
  { kind: 'rent-roll', re: /rent\s*roll/i },
  { kind: 'comps', re: /comparable|comps/i },
  { kind: 'financials', re: /t-?12|operating statement|\bnoi\b|pro\s*forma/i },
  { kind: 'market', re: /submarket|market report|demographic|traffic/i },
  { kind: 'photos', re: /photo|image|\.zip$|\.jpe?g$|\.png$/i },
  { kind: 'legal', re: /lease|estoppel|agreement|\bpsa\b|\bloi\b|\bnda\b|title/i },
]

export function classifyFile(name: string): FileKind {
  for (const { kind, re } of KIND_PATTERNS) {
    if (re.test(name)) return kind
  }
  return 'other'
}

export type DocType =
  | 'Offering Memorandum'
  | 'Proposal'
  | 'Brochure'
  | 'Flyer'
  | "Owner's Report"
  | 'Executive Summary'

export const DOC_TYPES: DocType[] = [
  'Offering Memorandum',
  'Proposal',
  'Brochure',
  'Flyer',
  "Owner's Report",
  'Executive Summary',
]

/**
 * A document type's fixed pages, split so sourced sections land in the body of
 * the document rather than after the advisor bios.
 */
interface Spine {
  openers: string[]
  closers: string[]
}

const SPINE: Record<DocType, Spine> = {
  'Offering Memorandum': {
    openers: ['cover', 'contents', 'propertySummary'],
    closers: ['advisorBios'],
  },
  Proposal: {
    openers: ['cover', 'contents', 'propertySummary'],
    closers: ['advisorBios'],
  },
  Brochure: { openers: ['cover', 'propertyDescription'], closers: ['advisorBios'] },
  Flyer: { openers: ['cover', 'propertyDescription'], closers: [] },
  "Owner's Report": { openers: ['cover', 'contents', 'financialSummary'], closers: [] },
  'Executive Summary': { openers: ['cover', 'propertySummary'], closers: [] },
}

/** What each kind of source file contributes. Legal and other contribute nothing. */
const SECTIONS_FOR_KIND: Record<FileKind, string[]> = {
  financials: ['financialHero', 'financialSummary'],
  'rent-roll': ['rentRollSummary'],
  market: ['locationMap'],
  comps: ['comparables'],
  photos: ['photoGallery'],
  legal: [],
  other: [],
}

/**
 * The order sourced sections appear in, independent of the order files were
 * selected — financials before photography, the way an OM actually reads.
 */
const KIND_ORDER: FileKind[] = ['financials', 'rent-roll', 'market', 'comps', 'photos'];

/** Display name per section key. Kept here so this module never imports the editor. */
export const SECTION_NAME: Record<string, string> = {
  cover: 'Cover Page',
  contents: 'Table of Contents',
  propertySummary: 'Property Summary',
  propertyDescription: 'Property Description',
  financialHero: 'Financial Highlights',
  financialSummary: 'Financial Summary',
  rentRollSummary: 'Rent Roll Summary',
  locationMap: 'Location & Map',
  comparables: 'Sale Comparables',
  photoGallery: 'Photo Gallery',
  advisorBios: 'Advisor Bios',
}

export interface SourceFileRef {
  id: string
  name: string
}

export interface OutlineInput {
  docType: DocType
  files: SourceFileRef[]
  instructions: string
}

function spineSection(templateKey: string): GeneratedSection {
  return { templateKey, name: SECTION_NAME[templateKey] ?? templateKey, origin: 'spine' }
}

/**
 * The sections the selected files contribute, in KIND_ORDER, skipping any key
 * the spine already carries and any key an earlier file already contributed.
 */
function sourcedSections(files: SourceFileRef[], taken: Set<string>): GeneratedSection[] {
  const out: GeneratedSection[] = []
  for (const kind of KIND_ORDER) {
    // The first selected file of this kind gets the credit.
    const file = files.find((f) => classifyFile(f.name) === kind)
    if (!file) continue
    for (const templateKey of SECTIONS_FOR_KIND[kind]) {
      if (taken.has(templateKey)) continue
      taken.add(templateKey)
      out.push({
        templateKey,
        name: SECTION_NAME[templateKey] ?? templateKey,
        origin: 'file',
        sourceFileName: file.name,
      })
    }
  }
  return out
}

/**
 * Assemble the outline: the document type's openers, then whatever the selected
 * files contribute, then its closers. Instruction phrases are applied in Task 2.
 */
export function buildOutline(input: OutlineInput): GeneratedSection[] {
  const spine = SPINE[input.docType] ?? SPINE.Proposal
  const taken = new Set<string>([...spine.openers, ...spine.closers])
  const body = sourcedSections(input.files, taken)
  return [
    ...spine.openers.map(spineSection),
    ...body,
    ...spine.closers.map(spineSection),
  ]
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun --bun run test src/data/documentGeneration.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/data/documentGeneration.ts src/data/documentGeneration.test.ts src/data/types.ts
git commit -m "feat(docs): classify source files and build a base document outline

The generation brain's foundation: a filename maps to a kind, a document
type contributes a spine split into openers and closers, and each kind
contributes sections that land between them.

Sourced sections are emitted in a fixed kind order rather than selection
order, so the same set of files always produces the same document.
Deduplication lets the spine keep a section a file would also have
contributed — an Owner's Report plus a T-12 yields one Financial Summary,
credited to the spine.

Kept free of Date, Math.random, and any features/editor import: the editor
consumes the templateKey strings, so the coupling runs one way."
```

---

### Task 2: Instruction phrases and the suggestion deck

Recognized phrases in the instructions textarea transform the outline; the suggestion deck offers the phrases that would do something.

**Files:**
- Modify: `src/data/documentGeneration.ts`
- Modify: `src/data/documentGeneration.test.ts`

**Interfaces:**
- Consumes: `buildOutline`, `OutlineInput`, `SECTION_NAME`, `classifyFile` from Task 1.
- Produces:
  - `interface SuggestionCard { id: string; title: string; sentence: string; effect: string }`
  - `function suggestionsFor(input: OutlineInput): SuggestionCard[]`
  - `const MAX_CONCISE_SECTIONS = 6`
  - `buildOutline` now applies instruction effects.

- [ ] **Step 1: Write the failing tests**

Append to `src/data/documentGeneration.test.ts`:

```ts
import { MAX_CONCISE_SECTIONS, suggestionsFor } from './documentGeneration'

const ALL_KINDS = [
  { id: 'f1', name: 'T-12 2025.pdf' },
  { id: 'f2', name: 'Rent Roll 2026.xlsx' },
  { id: 'f3', name: 'Submarket Report.pdf' },
  { id: 'f4', name: 'Sale Comparables.xlsx' },
  { id: 'f5', name: 'Site Photos.zip' },
]

describe('instruction effects', () => {
  it('moves financial highlights directly after the cover', () => {
    const keys = buildOutline({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Lead with the trailing-12 NOI growth.',
    }).map((s) => s.templateKey)
    expect(keys[0]).toBe('cover')
    expect(keys[1]).toBe('financialHero')
  })

  it('adds financial highlights when no financial file was selected', () => {
    const sections = buildOutline({
      docType: 'Brochure',
      files: [],
      instructions: 'Lead with the trailing-12 NOI growth.',
    })
    const hero = sections.find((s) => s.templateKey === 'financialHero')
    expect(hero?.origin).toBe('instruction')
    expect(hero?.instructionLabel).toBeTruthy()
  })

  it('adds the rent roll summary on request', () => {
    const sections = buildOutline({
      docType: 'Brochure',
      files: [],
      instructions: 'Summarize the tenant roster.',
    })
    const rentRoll = sections.find((s) => s.templateKey === 'rentRollSummary')
    expect(rentRoll?.origin).toBe('instruction')
  })

  it('adds the location page on request', () => {
    const keys = buildOutline({
      docType: 'Flyer',
      files: [],
      instructions: 'Emphasize the location and surrounding submarket.',
    }).map((s) => s.templateKey)
    expect(keys).toContain('locationMap')
  })

  it('removes the comparables on request', () => {
    const keys = buildOutline({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Skip the sale comparables.',
    }).map((s) => s.templateKey)
    expect(keys).not.toContain('comparables')
  })

  it('recognizes a hand-typed phrase, not just the canonical sentence', () => {
    const keys = buildOutline({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'no comps please, and keep it short',
    }).map((s) => s.templateKey)
    expect(keys).not.toContain('comparables')
    expect(keys.length).toBeLessThanOrEqual(MAX_CONCISE_SECTIONS)
  })

  it('caps a concise outline and trims only sourced sections', () => {
    const sections = buildOutline({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Keep it concise.',
    })
    expect(sections.length).toBe(MAX_CONCISE_SECTIONS)
    const keys = sections.map((s) => s.templateKey)
    // Openers and the closer survive the trim.
    expect(keys.slice(0, 3)).toEqual(['cover', 'contents', 'propertySummary'])
    expect(keys).toContain('advisorBios')
  })

  it('ignores unrecognized instructions without changing the outline', () => {
    const base = buildOutline({ docType: 'Proposal', files: ALL_KINDS, instructions: '' })
    const withText = buildOutline({
      docType: 'Proposal',
      files: ALL_KINDS,
      instructions: 'Make it feel premium and mention the roof deck.',
    })
    expect(withText).toEqual(base)
  })

  it('does not depend on the order phrases appear in the text', () => {
    const a = buildOutline({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Keep it concise. Skip the sale comparables.',
    })
    const b = buildOutline({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Skip the sale comparables. Keep it concise.',
    })
    expect(a).toEqual(b)
  })

  it('never emits a duplicate section key', () => {
    const keys = buildOutline({
      docType: "Owner's Report",
      files: ALL_KINDS,
      instructions: 'Lead with the trailing-12 NOI growth. Summarize the tenant roster.',
    }).map((s) => s.templateKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('suggestionsFor', () => {
  it('offers the NOI card only when a financial file is selected', () => {
    const withFin = suggestionsFor({
      docType: 'Brochure',
      files: [{ id: 'a', name: 'T-12 2025.pdf' }],
      instructions: '',
    })
    expect(withFin.some((c) => c.id === 'lead-with-noi')).toBe(true)

    const without = suggestionsFor({
      docType: 'Brochure',
      files: [{ id: 'a', name: 'Buyer Q&A Thread.pdf' }],
      instructions: '',
    })
    expect(without.some((c) => c.id === 'lead-with-noi')).toBe(false)
  })

  it('offers the roster card only when a rent roll is selected', () => {
    expect(
      suggestionsFor({
        docType: 'Brochure',
        files: [{ id: 'a', name: 'Rent Roll 2026.xlsx' }],
        instructions: '',
      }).some((c) => c.id === 'tenant-roster'),
    ).toBe(true)
  })

  it('offers at most four cards', () => {
    expect(
      suggestionsFor({ docType: 'Offering Memorandum', files: ALL_KINDS, instructions: '' }).length,
    ).toBeLessThanOrEqual(4)
  })

  it('keeps offering a card whose effect has already been applied', () => {
    // Judged against the base outline, so "skip comps" does not vanish the
    // moment it is added — otherwise the selected card would disappear.
    const cards = suggestionsFor({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Skip the sale comparables.',
    })
    expect(cards.some((c) => c.id === 'skip-comps')).toBe(true)
  })

  it('gives every card a sentence and a stated effect', () => {
    for (const card of suggestionsFor({
      docType: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: '',
    })) {
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.sentence.length).toBeGreaterThan(0)
      expect(card.effect.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test src/data/documentGeneration.test.ts`
Expected: FAIL — `suggestionsFor` and `MAX_CONCISE_SECTIONS` are not exported.

- [ ] **Step 3: Add the effects and the deck**

In `src/data/documentGeneration.ts`, add after `sourcedSections`:

```ts
/** Total sections a "keep it concise" outline is allowed. */
export const MAX_CONCISE_SECTIONS = 6

/**
 * When each effect runs. Adds land before moves so a moved section exists;
 * removals run after both; the concise cap runs last, over whatever survived.
 */
type Phase = 'add' | 'move' | 'remove' | 'cap'

export interface SuggestionCard {
  id: string
  title: string
  sentence: string
  effect: string
}

interface InstructionEffect {
  id: string
  /** Card title in the deck. */
  title: string
  /** The sentence a card appends to the textarea — also what it is recognized by. */
  sentence: string
  /** The consequence, stated on the card. */
  effect: string
  /** Recognizes both the canonical sentence and the way a broker would type it. */
  matches: RegExp
  phase: Phase
  /** Offered only when this holds, judged against the BASE outline (see suggestionsFor). */
  offerWhen: (base: string[], kinds: Set<FileKind>) => boolean
}

const INSTRUCTION_EFFECTS: InstructionEffect[] = [
  {
    id: 'lead-with-noi',
    title: 'Lead with NOI',
    sentence: 'Lead with the trailing-12 NOI growth.',
    effect: 'Moves Financial Highlights to page 2',
    matches: /lead with.*noi|noi.*first/i,
    phase: 'move',
    offerWhen: (_base, kinds) => kinds.has('financials'),
  },
  {
    id: 'tenant-roster',
    title: 'Summarize roster',
    sentence: 'Summarize the tenant roster.',
    effect: 'Adds Rent Roll Summary',
    matches: /tenant roster/i,
    phase: 'add',
    offerWhen: (base, kinds) => kinds.has('rent-roll') && !base.includes('rentRollSummary'),
  },
  {
    id: 'emphasize-location',
    title: 'Emphasize location',
    sentence: 'Emphasize the location and surrounding submarket.',
    effect: 'Adds Location & Map',
    matches: /emphasi\w+.*location/i,
    phase: 'add',
    offerWhen: (base, kinds) => kinds.has('market') && !base.includes('locationMap'),
  },
  {
    id: 'skip-comps',
    title: 'Skip comps',
    sentence: 'Skip the sale comparables.',
    effect: 'Removes Sale Comparables',
    matches: /skip.*comps|skip.*comparables|no comps/i,
    phase: 'remove',
    offerWhen: (base) => base.includes('comparables'),
  },
  {
    id: 'concise',
    title: 'Keep it concise',
    sentence: 'Keep it concise.',
    effect: `Trims the document to ${MAX_CONCISE_SECTIONS} pages`,
    matches: /concise|keep it short/i,
    phase: 'cap',
    offerWhen: (base) => base.length > MAX_CONCISE_SECTIONS,
  },
]

/** Which effects the instructions text asks for. */
function activeEffects(instructions: string): InstructionEffect[] {
  return INSTRUCTION_EFFECTS.filter((e) => e.matches.test(instructions))
}

function instructionSection(templateKey: string, label: string): GeneratedSection {
  return {
    templateKey,
    name: SECTION_NAME[templateKey] ?? templateKey,
    origin: 'instruction',
    instructionLabel: label,
  }
}

/** Which section each 'add'-phase effect contributes. */
const ADDS: Record<string, string> = {
  'tenant-roster': 'rentRollSummary',
  'emphasize-location': 'locationMap',
}
```

Then replace `buildOutline` with the version that applies them:

```ts
export function buildOutline(input: OutlineInput): GeneratedSection[] {
  const spine = SPINE[input.docType] ?? SPINE.Proposal
  const taken = new Set<string>([...spine.openers, ...spine.closers])
  let body = sourcedSections(input.files, taken)
  const active = activeEffects(input.instructions)
  const has = (key: string) =>
    taken.has(key) || body.some((s) => s.templateKey === key)

  // Phase 'add' — append to the body, never duplicating an existing section.
  for (const effect of active.filter((e) => e.phase === 'add')) {
    const key = ADDS[effect.id]
    if (!key || has(key)) continue
    body.push(instructionSection(key, effect.sentence))
  }

  // Phase 'remove' — body only; the spine is the document type's promise.
  for (const effect of active.filter((e) => e.phase === 'remove')) {
    if (effect.id === 'skip-comps') body = body.filter((s) => s.templateKey !== 'comparables')
  }

  // Phase 'cap' — trim sourced sections from the tail so the openers and the
  // closers, which the document type guarantees, always survive.
  if (active.some((e) => e.phase === 'cap')) {
    const fixed = spine.openers.length + spine.closers.length
    body = body.slice(0, Math.max(0, MAX_CONCISE_SECTIONS - fixed))
  }

  let sections = [
    ...spine.openers.map(spineSection),
    ...body,
    ...spine.closers.map(spineSection),
  ]

  // Phase 'move' — operates on the assembled list, since it positions relative
  // to the cover.
  for (const effect of active.filter((e) => e.phase === 'move')) {
    if (effect.id !== 'lead-with-noi') continue
    const existing = sections.find((s) => s.templateKey === 'financialHero')
    const hero = existing ?? instructionSection('financialHero', effect.sentence)
    sections = sections.filter((s) => s.templateKey !== 'financialHero')
    const coverAt = sections.findIndex((s) => s.templateKey === 'cover')
    sections.splice(coverAt + 1, 0, hero)
  }

  return sections
}

/**
 * The suggestion deck: at most four cards, in declaration order, offered only
 * when they would change something.
 *
 * Judged against the BASE outline — the one built from the doc type and files
 * with no instructions applied — so a card does not vanish the moment its own
 * effect lands. Judging against the live outline would make "Skip comps"
 * disappear as soon as it was selected.
 */
export function suggestionsFor(input: OutlineInput): SuggestionCard[] {
  const base = buildOutline({ ...input, instructions: '' }).map((s) => s.templateKey)
  const kinds = new Set(input.files.map((f) => classifyFile(f.name)))
  return INSTRUCTION_EFFECTS.filter((e) => e.offerWhen(base, kinds))
    .slice(0, 4)
    .map((e) => ({ id: e.id, title: e.title, sentence: e.sentence, effect: e.effect }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test src/data/documentGeneration.test.ts`
Expected: PASS, all tests green including Task 1's.

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/documentGeneration.ts src/data/documentGeneration.test.ts
git commit -m "feat(docs): apply recognized instruction phrases to the outline

Five phrases move, add, remove, or trim sections. Each is recognized by a
regex, so a suggestion card's canonical sentence and the same thing typed
by hand go through one mechanism and the textarea stays the single source
of truth for the prompt.

Effects run in fixed phases — add, move, remove, cap — so the outline never
depends on the order phrases appear in the text. The concise cap trims only
sourced sections: a document type's openers and closers are its promise.

The suggestion deck is judged against the base outline rather than the live
one. Judging against the live outline would make Skip comps vanish the
instant it was selected, since its own effect removes what qualified it."
```

---

### Task 3: Seed source files worth generating from

Seeded deals carry no `listing.documents`, so a deal's Files workspace holds only an estoppel, a master lease, and a buyer Q&A thread — nothing the generator can act on. Add one root file per interesting kind.

**Files:**
- Modify: `src/data/dealFiles.ts`
- Modify: `src/data/persistence.ts:5`
- Create: `src/data/dealFiles.test.ts`

**Interfaces:**
- Consumes: `classifyFile`, `FileKind` from Task 1.
- Produces: no new exports — `buildInitialFiles` returns five more items.

- [ ] **Step 1: Write the failing test**

Create `src/data/dealFiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildInitialFiles } from './dealFiles'
import { classifyFile, type FileKind } from './documentGeneration'
import type { Listing } from './types'

/** A minimal listing — buildInitialFiles reads only these three fields. */
const listing = {
  id: 'deal-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  documents: undefined,
} as unknown as Listing

describe('buildInitialFiles', () => {
  it('seeds one source file for every kind the generator acts on', () => {
    const kinds = new Set<FileKind>(
      buildInitialFiles(listing)
        .filter((i) => i.kind === 'file')
        .map((i) => classifyFile(i.name)),
    )
    for (const kind of ['financials', 'rent-roll', 'market', 'comps', 'photos'] as FileKind[]) {
      expect(kinds.has(kind)).toBe(true)
    }
  })

  it('gives every seeded file a size so the picker can show one', () => {
    for (const item of buildInitialFiles(listing).filter((i) => i.kind === 'file')) {
      expect(item.sizeBytes).toBeGreaterThan(0)
    }
  })

  it('uses unique ids', () => {
    const ids = buildInitialFiles(listing).map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is deterministic', () => {
    expect(buildInitialFiles(listing)).toEqual(buildInitialFiles(listing))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/data/dealFiles.test.ts`
Expected: FAIL — `financials`, `rent-roll`, `market`, `comps`, and `photos` are all missing.

- [ ] **Step 3: Add the seed files**

In `src/data/dealFiles.ts`, insert immediately before the `const leasesId = ...` line:

```ts
  // Source files the document generator can act on — one per kind it maps to a
  // section, so a fresh deal can produce an interesting document. Sizes are
  // literal byte counts; formatBytes renders them in the picker.
  items.push(
    {
      id: `${listingId}-file-t12`,
      name: 'T-12 Operating Statement 2025.pdf',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 1),
      sizeBytes: 1_468_006,
    },
    {
      id: `${listingId}-file-rent-roll`,
      name: 'Rent Roll 2026.xlsx',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 1),
      sizeBytes: 245_760,
    },
    {
      id: `${listingId}-file-submarket`,
      name: 'Submarket Report.pdf',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 4),
      sizeBytes: 3_250_586,
    },
    {
      id: `${listingId}-file-sale-comps`,
      name: 'Sale Comparables.xlsx',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 6),
      sizeBytes: 98_304,
    },
    {
      id: `${listingId}-file-site-photos`,
      name: 'Site Photos.zip',
      kind: 'file',
      parentId: null,
      createdAt: daysAfter(createdAt, 5),
      sizeBytes: 18_874_368,
    },
  )
```

Also extend that module's doc comment — it currently says only deal-creation uploads and two folders seed the workspace:

```
 * Seeds a listing's Files workspace: the deal-creation-time uploads (offering
 * memorandum, financials, notes), a set of source files the document generator
 * can act on (one per kind it maps to a section), plus a couple of standard
 * folders so the page isn't empty on first visit.
```

- [ ] **Step 4: Move SEED_VERSION**

In `src/data/persistence.ts:5`, change `43` to `44`. Without this, IndexedDB serves the old fixtures and the new files never appear in the browser no matter what the code says.

```ts
export const SEED_VERSION = 44;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun --bun run test src/data/dealFiles.test.ts src/data/dealFilesActions.test.ts`
Expected: PASS. The existing `dealFilesActions` tests assert relative counts (`initial + 1`), so they are unaffected by the new files.

- [ ] **Step 6: Run the full suite**

Run: `bun --bun run test`
Expected: PASS. If a test asserts an absolute deal-file count, update it to a relative one rather than reverting the seed.

- [ ] **Step 7: Commit**

```bash
git add src/data/dealFiles.ts src/data/persistence.ts src/data/dealFiles.test.ts
git commit -m "feat(files): seed source files the document generator can use

A seeded deal's Files workspace held an estoppel, a master lease, and a
buyer Q&A thread — all of which classify as legal or other, so the
generator had nothing to build a document from on a fresh deal.

Adds one root file per kind that maps to a section: a T-12, a rent roll, a
submarket report, sale comparables, and a photo set. Deterministic and
faker-free like the rest of the module.

SEED_VERSION 43 -> 44, or IndexedDB keeps serving the old fixtures and none
of this shows up in the browser."
```

---

### Task 4: The createGeneratedDocument action

Persist a generated document onto the deal.

**Files:**
- Modify: `src/data/actions.ts`
- Create: `src/data/generatedDocuments.test.ts`

**Interfaces:**
- Consumes: `DocumentGeneration`, `GeneratedSection` from Task 1; the private `patchListing` helper at `src/data/actions.ts:50`.
- Produces:
  - `function createGeneratedDocument(dealId: string, input: NewGeneratedDocument): { documentId: string | null }`
  - `interface NewGeneratedDocument { name: string; docType: string; sourceFileIds: string[]; sourceFileNames: string[]; instructions: string; sections: GeneratedSection[] }`
  - `function resolveGeneratedDocument(deal: Listing | undefined, documentId: string | undefined): DocumentGeneration | undefined`

- [ ] **Step 1: Write the failing test**

Create `src/data/generatedDocuments.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGeneratedDocument, resolveGeneratedDocument } from './actions'
import { useDataStore } from './dataStore'
import type { GeneratedSection } from './types'

const SECTIONS: GeneratedSection[] = [
  { templateKey: 'cover', name: 'Cover Page', origin: 'spine' },
  {
    templateKey: 'financialSummary',
    name: 'Financial Summary',
    origin: 'file',
    sourceFileName: 'T-12 2025.pdf',
  },
]

/** The store is seeded in the test environment; this is the idiom the other action tests use. */
function anyDealId(): string {
  return [...useDataStore.getState().listings.values()][0].id
}

const input = {
  name: 'Offering Memorandum — Test',
  docType: 'Offering Memorandum',
  sourceFileIds: ['f1'],
  sourceFileNames: ['T-12 2025.pdf'],
  instructions: 'Lead with the trailing-12 NOI growth.',
  sections: SECTIONS,
}

describe('createGeneratedDocument', () => {
  it('appends an aiGenerated document carrying its generation', () => {
    const dealId = anyDealId()
    const before = useDataStore.getState().listings.get(dealId)?.documents?.length ?? 0

    const { documentId } = createGeneratedDocument(dealId, input)
    expect(documentId).toBeTruthy()

    const deal = useDataStore.getState().listings.get(dealId)
    expect(deal?.documents?.length).toBe(before + 1)

    const doc = deal?.documents?.find((d) => d.id === documentId)
    expect(doc?.name).toBe(input.name)
    expect(doc?.aiGenerated).toBe(true)
    expect(doc?.generation?.sections).toEqual(SECTIONS)
    expect(doc?.generation?.instructions).toBe(input.instructions)
    expect(doc?.generation?.generatedAt).toBeTruthy()
  })

  it('returns a null id for an unknown deal and writes nothing', () => {
    expect(createGeneratedDocument('no-such-deal', input).documentId).toBeNull()
  })

  it('gives each generated document a distinct id', () => {
    const dealId = anyDealId()
    const a = createGeneratedDocument(dealId, input).documentId
    const b = createGeneratedDocument(dealId, input).documentId
    expect(a).not.toBe(b)
  })
})

describe('resolveGeneratedDocument', () => {
  it('finds the generation for a document id', () => {
    const dealId = anyDealId()
    const { documentId } = createGeneratedDocument(dealId, input)
    const deal = useDataStore.getState().listings.get(dealId)
    expect(resolveGeneratedDocument(deal, documentId ?? undefined)?.docType).toBe(
      'Offering Memorandum',
    )
  })

  it('returns undefined for a missing id, a missing deal, or a plain document', () => {
    const deal = useDataStore.getState().listings.get(anyDealId())
    expect(resolveGeneratedDocument(deal, undefined)).toBeUndefined()
    expect(resolveGeneratedDocument(deal, 'no-such-doc')).toBeUndefined()
    expect(resolveGeneratedDocument(undefined, 'anything')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/data/generatedDocuments.test.ts`
Expected: FAIL — `createGeneratedDocument` is not exported from `./actions`.

- [ ] **Step 3: Write the action**

In `src/data/actions.ts`, add near the other deal mutations (after `updateDealFinancials`, around line 273). Add `DealDocument`, `DocumentGeneration`, and `GeneratedSection` to the existing `import type { ... } from './types'` list:

```ts
/** What the generation flow hands over to be persisted. */
export interface NewGeneratedDocument {
  name: string
  docType: string
  sourceFileIds: string[]
  sourceFileNames: string[]
  instructions: string
  sections: GeneratedSection[]
}

let _generatedDocSeq = 0

/**
 * File a generated document onto the deal. The document carries its whole
 * generation — inputs and outline — so the editor can rebuild the same pages and
 * the review screen stays truthful even if a source file is deleted later.
 *
 * `generatedAt` is stamped here rather than in `documentGeneration.ts`, which
 * must stay deterministic.
 */
export function createGeneratedDocument(
  dealId: string,
  input: NewGeneratedDocument,
): { documentId: string | null } {
  const now = new Date().toISOString()
  _generatedDocSeq += 1
  const documentId = `gendoc-${_generatedDocSeq}-${dealId}`

  const document: DealDocument = {
    id: documentId,
    name: input.name,
    uploadedAt: now,
    aiGenerated: true,
    generation: {
      docType: input.docType,
      sourceFileIds: input.sourceFileIds,
      sourceFileNames: input.sourceFileNames,
      instructions: input.instructions,
      sections: input.sections,
      generatedAt: now,
    },
  }

  const deal = patchListing(dealId, (l) => ({
    ...l,
    documents: [...(l.documents ?? []), document],
    updatedAt: now,
  }))

  return { documentId: deal ? documentId : null }
}

/** The generation behind a document id, or undefined if there isn't one. */
export function resolveGeneratedDocument(
  deal: Listing | undefined,
  documentId: string | undefined,
): DocumentGeneration | undefined {
  if (!deal || !documentId) return undefined
  return deal.documents?.find((d) => d.id === documentId)?.generation
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/data/generatedDocuments.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/data/actions.ts src/data/generatedDocuments.test.ts
git commit -m "feat(docs): file a generated document onto the deal

createGeneratedDocument appends an aiGenerated DealDocument carrying its
whole generation — inputs and outline — so the editor can rebuild the same
pages and the review screen stays truthful even after a source file is
deleted.

generatedAt is stamped here, not in documentGeneration.ts, which has to
stay deterministic for the unit tests and SSR."
```

---

### Task 5: The Rent Roll Summary template page

`rentRollSummary` is the one mapped section with no template. `underwritingPages.ts` already builds a deterministic rent roll table under that exact heading — export it rather than writing the fake tenant data twice.

**Files:**
- Modify: `src/features/editor/underwritingPages.ts:134`
- Modify: `src/features/editor/templates/designer.ts`
- Modify: `src/features/editor/templates/index.ts`
- Modify: `src/features/editor/templates.test.ts`

**Interfaces:**
- Consumes: `buildCtx`, `Ctx` from `#/components/deals/underwriting/underwritingResult`.
- Produces:
  - `function buildRentRollTable(c: Ctx): TableBlock` exported from `src/features/editor/underwritingPages.ts`
  - `function buildRentRollSummaryPage(property?: Property): Page` exported from `src/features/editor/templates/designer.ts`
  - a `rentRollSummary` entry in `TEMPLATES`

Import direction check: `designer.ts` → `underwritingPages.ts` → `templates/helpers.ts`. No cycle, because `helpers.ts` imports neither.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/editor/templates.test.ts`:

```ts
describe('rent roll summary template', () => {
  it('is registered under Financials', () => {
    const def = TEMPLATES.find((t) => t.key === 'rentRollSummary')
    expect(def).toBeTruthy()
    expect(def?.category).toBe('Financials')
    expect(def?.name).toBe('Rent Roll Summary')
  })

  it('builds a page carrying a table of tenants', () => {
    const page = buildTemplatePage('rentRollSummary')
    expect(page.name).toBe('Rent Roll Summary')
    const table = page.blocks.find((b) => b.type === 'table') as { rows: { value: string }[][] }
    expect(table).toBeTruthy()
    // A header row plus at least one tenant.
    expect(table.rows.length).toBeGreaterThan(1)
    expect(table.rows[0].map((c) => c.value)).toContain('Tenant')
  })

  it('is deterministic across builds', () => {
    const a = buildTemplatePage('rentRollSummary')
    const b = buildTemplatePage('rentRollSummary')
    const values = (p: typeof a) =>
      p.blocks.flatMap((blk) =>
        blk.type === 'table' ? blk.rows.flatMap((r) => r.map((c) => c.value)) : [],
      )
    expect(values(a)).toEqual(values(b))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test src/features/editor/templates.test.ts`
Expected: FAIL — no `rentRollSummary` in `TEMPLATES`.

- [ ] **Step 3: Export the table builder**

In `src/features/editor/underwritingPages.ts`, split the existing private `rentRollSection` (line 134) so the table is reusable. Replace it with:

```ts
/**
 * The rent roll table — a deterministic tenant roster derived from the deal's
 * headline figures. Exported so the Rent Roll Summary document template renders
 * the same numbers as the underwriting section rather than inventing its own.
 */
export function buildRentRollTable(c: Ctx): TableBlock {
  const unitSqft = Math.round(c.sqft / 5);
  const rates = [c.rentPerSf, c.rentPerSf - 1, c.rentPerSf + 1.5, c.rentPerSf - 0.5];
  const rows: Cell[][] = [
    [hcell("Suite"), hcell("Tenant"), hcell("SF", "right"), hcell("Rent / mo", "right"), hcell("$/SF/yr", "right")],
  ];
  TENANTS.forEach((tenant, i) => {
    const rate = Math.max(8, rates[i]);
    rows.push([
      vcell(`Suite ${100 + i * 10}`, { align: "left" }),
      vcell(tenant, { align: "left" }),
      vcell(unitSqft.toLocaleString()),
      vcell(money((unitSqft * rate) / 12)),
      vcell(perSf(rate)),
    ]);
  });
  rows.push([
    vcell("Suite 150", { align: "left" }),
    vcell("Vacant", { align: "left" }),
    vcell(unitSqft.toLocaleString()),
    vcell("—"),
    vcell("—"),
  ]);
  return table(rows);
}

function rentRollSection(c: Ctx): Section {
  return section("Rent Roll Summary", buildRentRollTable(c));
}
```

This is a pure extraction — the table's contents are unchanged, so the underwriting section renders exactly as before.

- [ ] **Step 4: Add the page builder**

In `src/features/editor/templates/designer.ts`, add these imports alongside the existing ones:

```ts
import { buildCtx } from "#/components/deals/underwriting/underwritingResult";
import { buildRentRollTable } from "../underwritingPages";
```

Then add the builder next to `buildFinancialSummaryPage`:

```ts
/**
 * "Rent Roll Summary" — the tenant roster as a locked page, shaped like the
 * Financial Summary. Shares the underwriting section's table so a document and
 * its underwriting never disagree about who the tenants are.
 */
export function buildRentRollSummaryPage(property: Property | undefined): Page {
  return {
    id: uid("page"),
    name: "Rent Roll Summary",
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      { id: uid("block"), type: "heading", text: "Rent Roll Summary", style: headingStyle },
      { id: uid("block"), type: "text", text: addressOf(property), style: addressStyle },
      buildRentRollTable(buildCtx(property)),
    ],
  };
}
```

- [ ] **Step 5: Register it**

In `src/features/editor/templates/index.ts`, add `buildRentRollSummaryPage` to the import from `./designer`, then add this entry to `TEMPLATES` directly after the `financialSummary` entry:

```ts
  { key: "rentRollSummary", name: "Rent Roll Summary", category: "Financials", description: "The tenant roster as a table — suites, tenants, SF, rent, and rate per SF.", build: buildRentRollSummaryPage },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --bun run test src/features/editor/templates.test.ts src/features/editor/underwritingPages.test.ts`
Expected: PASS. The underwriting page tests must still pass unchanged — the extraction altered no output.

- [ ] **Step 7: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/editor/underwritingPages.ts src/features/editor/templates/designer.ts src/features/editor/templates/index.ts src/features/editor/templates.test.ts
git commit -m "feat(editor): add a Rent Roll Summary document template

rentRollSummary is the one section the generator maps to that had no
template. Mapping rent-roll files onto Financial Summary instead would have
collapsed the clearest demonstration of the feature — unchecking the rent
roll should visibly remove a page.

underwritingPages already built a deterministic tenant table under exactly
this heading, so its table builder is extracted and exported rather than
the fake tenant data written twice. A document and its underwriting now
cannot disagree about who the tenants are.

Pure extraction: the underwriting section's output is unchanged."
```

---

### Task 6: Build a document from a stored outline

Turn a `GeneratedSection[]` into editor pages, and let the store accept one.

**Files:**
- Modify: `src/features/editor/presets.ts`
- Modify: `src/features/editor/sampleDocument.ts`
- Modify: `src/features/editor/store.ts:65-69` (the `initDocument` declaration) and `:169` (its implementation)
- Create: `src/features/editor/generatedDocument.test.ts`

**Interfaces:**
- Consumes: `GeneratedSection`, `DocumentGeneration` from Task 1; `SECTION_NAME` from Task 1; `buildTemplatePage` from `src/features/editor/templates/index.ts`; `rentRollSummary` from Task 5.
- Produces:
  - `function buildGeneratedDocumentPages(property: Property | undefined, sections: GeneratedSection[]): Page[]` from `presets.ts`
  - `function buildGeneratedDocument(property: Property | undefined, name: string, generation: DocumentGeneration): EditorDocument` from `sampleDocument.ts`
  - `initDocument(listing, underwriting?, marketing?, generated?)` where `generated?: { name: string; generation: DocumentGeneration }`

- [ ] **Step 1: Write the failing tests**

Create `src/features/editor/generatedDocument.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SECTION_NAME } from '#/data/documentGeneration'
import { TEMPLATES } from './templates'
import { buildGeneratedDocumentPages } from './presets'
import { buildGeneratedDocument } from './sampleDocument'
import type { DocumentGeneration, GeneratedSection } from '#/data/types'

const SECTIONS: GeneratedSection[] = [
  { templateKey: 'cover', name: 'Cover Page', origin: 'spine' },
  { templateKey: 'contents', name: 'Table of Contents', origin: 'spine' },
  {
    templateKey: 'rentRollSummary',
    name: 'Rent Roll Summary',
    origin: 'file',
    sourceFileName: 'Rent Roll 2026.xlsx',
  },
  { templateKey: 'advisorBios', name: 'Advisor Bios', origin: 'spine' },
]

describe('templateKey contract', () => {
  // The generator lives in src/data and must not import the editor, so this
  // test is the guard that its keys still resolve here.
  it('resolves every key documentGeneration can emit', () => {
    const registered = new Set(TEMPLATES.map((t) => t.key))
    for (const key of Object.keys(SECTION_NAME)) {
      expect(registered.has(key)).toBe(true)
    }
  })
})

describe('buildGeneratedDocumentPages', () => {
  it('builds one page per section, in order', () => {
    const pages = buildGeneratedDocumentPages(undefined, SECTIONS)
    expect(pages).toHaveLength(SECTIONS.length)
    expect(pages.map((p) => p.name)).toEqual([
      'Cover Page',
      'Table of Contents',
      'Rent Roll Summary',
      'Advisor Bios',
    ])
  })

  it('gives every page a unique id and some blocks', () => {
    const pages = buildGeneratedDocumentPages(undefined, SECTIONS)
    expect(new Set(pages.map((p) => p.id)).size).toBe(pages.length)
    for (const page of pages) expect(page.blocks.length).toBeGreaterThan(0)
  })

  it('returns an empty list for an empty outline', () => {
    expect(buildGeneratedDocumentPages(undefined, [])).toEqual([])
  })

  it('skips a section whose template no longer exists rather than throwing', () => {
    const pages = buildGeneratedDocumentPages(undefined, [
      { templateKey: 'cover', name: 'Cover Page', origin: 'spine' },
      { templateKey: 'no-such-template', name: 'Gone', origin: 'spine' },
    ])
    expect(pages.map((p) => p.name)).toEqual(['Cover Page'])
  })
})

describe('buildGeneratedDocument', () => {
  const generation: DocumentGeneration = {
    docType: 'Offering Memorandum',
    sourceFileIds: ['f1'],
    sourceFileNames: ['Rent Roll 2026.xlsx'],
    instructions: '',
    sections: SECTIONS,
    generatedAt: '2026-08-19T00:00:00.000Z',
  }

  it('names the document and builds its outline', () => {
    const doc = buildGeneratedDocument(undefined, 'OM — 1650 Market St', generation)
    expect(doc.name).toBe('OM — 1650 Market St')
    expect(doc.pages.map((p) => p.name)).toEqual([
      'Cover Page',
      'Table of Contents',
      'Rent Roll Summary',
      'Advisor Bios',
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test src/features/editor/generatedDocument.test.ts`
Expected: FAIL — `buildGeneratedDocumentPages` and `buildGeneratedDocument` do not exist.

- [ ] **Step 3: Build pages from an outline**

In `src/features/editor/presets.ts`, add `GeneratedSection` to the `import type { ... } from "#/data/types"` line, make sure `buildTemplatePage` is imported from `./templates`, and add:

```ts
/**
 * Pages for a generated document: one per outline section, named by the section
 * so the page rail reads back the outline the broker approved.
 *
 * A section whose template is missing is skipped rather than thrown on — a
 * stored outline outlives the registry, and a document that lost one page is
 * far better than an editor that will not open.
 */
export function buildGeneratedDocumentPages(
  property: Property | undefined,
  sections: GeneratedSection[],
): Page[] {
  const registered = new Set(TEMPLATES.map((t) => t.key));
  return sections
    .filter((s) => registered.has(s.templateKey))
    .map((s) => withPageIdentity(buildTemplatePage(s.templateKey, property), s.name));
}
```

Add `TEMPLATES` and `buildTemplatePage` to the existing import from `./templates` if they are not already there.

- [ ] **Step 4: Build the document**

In `src/features/editor/sampleDocument.ts`, add:

```ts
import type { DocumentGeneration } from "#/data/types";
import { buildDocumentPages, buildGeneratedDocumentPages } from "./presets";
```

(merge with the existing `buildDocumentPages` import) and then:

```ts
/**
 * Build a generated document from its stored outline. Distinct from
 * `buildSampleDocument`, which builds the fixed Proposal every deal gets when no
 * generated document was requested.
 */
export function buildGeneratedDocument(
  property: Property | undefined,
  name: string,
  generation: DocumentGeneration,
): EditorDocument {
  return {
    id: "doc-generated",
    name,
    pages: buildGeneratedDocumentPages(property, generation.sections),
  };
}
```

- [ ] **Step 5: Teach the store about it**

In `src/features/editor/store.ts`, change the `initDocument` declaration (line 65) to:

```ts
  initDocument: (
    listing: Property | undefined,
    underwriting?: DealUnderwriting,
    marketing?: DealMarketing,
    /** When present, build this generated document instead of the fixed Proposal. */
    generated?: { name: string; generation: DocumentGeneration },
  ) => void;
```

and its implementation (line 169) to:

```ts
  initDocument: (listing, underwriting, marketing, generated) => {
    const document = generated
      ? buildGeneratedDocument(listing, generated.name, generated.generation)
      : buildSampleDocument(listing, underwriting);
    set({
```

Leave the rest of the body unchanged. Update the import at line 14 to bring in both builders, and add `DocumentGeneration` to the `import type` from `#/data/types`:

```ts
import { buildGeneratedDocument, buildSampleDocument } from "./sampleDocument";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --bun run test src/features/editor/generatedDocument.test.ts`
Expected: PASS, including the `templateKey` contract test.

- [ ] **Step 7: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, all tests pass. The editor store's existing tests must still pass — `initDocument`'s new argument is optional and the no-argument path is unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/features/editor/presets.ts src/features/editor/sampleDocument.ts src/features/editor/store.ts src/features/editor/generatedDocument.test.ts
git commit -m "feat(editor): build a document from a stored outline

initDocument takes an optional generated document; without one it builds
today's fixed Proposal exactly as before, so every existing entry point is
untouched.

A section whose template has gone missing is skipped rather than thrown on.
A stored outline outlives the registry, and a document short one page beats
an editor that will not open.

Includes the guard test for the one-way coupling: documentGeneration lives
in src/data and must not import the editor, so a test asserts every key it
can emit still resolves in TEMPLATES."
```

---

### Task 7: Open a generated document from the editor route

`?doc=<id>` resolves a generated document; without it the route behaves exactly as today.

**Files:**
- Modify: `src/routes/_shell/editor/$listingId.tsx`
- Modify: `src/features/editor/EditorRoot.tsx:22-42`

**Interfaces:**
- Consumes: `resolveGeneratedDocument` from Task 4; `initDocument`'s fourth argument from Task 6.
- Produces: `EditorRoot` accepts `documentId?: string`.

Do **not** rename or move this route file. Route moves break hardcoded `useParams({ from })` and full-reload `<a href>` navigation, and `vite build` catches neither.

- [ ] **Step 1: Add the search param**

In `src/routes/_shell/editor/$listingId.tsx`, extend `validateSearch` — keep `focus` exactly as it is:

```ts
  validateSearch: (
    search: Record<string, unknown>,
  ): { focus?: "underwriting"; doc?: string } => ({
    focus: search.focus === "underwriting" ? "underwriting" : undefined,
    doc: typeof search.doc === "string" && search.doc.length > 0 ? search.doc : undefined,
  }),
```

Then read it in the component and pass it down:

```ts
  const { focus, doc } = Route.useSearch();
```

```tsx
    <EditorRoot
      listing={property}
      listingId={listingId}
      focusUnderwriting={focus === "underwriting"}
      documentId={doc}
    />
```

- [ ] **Step 2: Resolve it in EditorRoot**

In `src/features/editor/EditorRoot.tsx`, add `documentId` to the props:

```tsx
export function EditorRoot({
  listing,
  listingId,
  focusUnderwriting = false,
  documentId,
}: {
  listing: Property | undefined;
  listingId: string;
  /** When true (from `?focus=underwriting`), scroll to the underwriting section on open. */
  focusUnderwriting?: boolean;
  /** When set (from `?doc=`), open that generated document instead of the fixed Proposal. */
  documentId?: string;
}) {
```

Add the import:

```ts
import { resolveGeneratedDocument } from "#/data/actions";
```

and replace the init effect:

```tsx
  useEffect(() => {
    const deal = getListing(listingId);
    const generation = resolveGeneratedDocument(deal, documentId);
    const document = deal?.documents?.find((d) => d.id === documentId);
    initDocument(
      listing,
      deal?.underwriting,
      deal?.marketing,
      generation && document ? { name: document.name, generation } : undefined,
    );
  }, [listing, listingId, documentId, initDocument]);
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors. There is no unit test for this step — the repo has no component tests, and the logic it adds (`resolveGeneratedDocument`) is already covered by Task 4. Behaviour is verified in the browser in Task 12.

- [ ] **Step 4: Verify the unchanged path still works in the browser**

Start the dev server: `bun --bun run dev` (http://localhost:3000).

Using the `playwright` MCP server:
1. `browser_navigate` to `http://localhost:3000/listings`
2. `browser_wait_for` text `Displaying 27 of 27 Deals` — `browser_navigate` returns before the app hydrates, so never snapshot without waiting first. Never use `waitUntil: "networkidle"`; Vite's HMR websocket holds the connection open and it always times out.
3. Open any deal's Documents page, click into the editor, and confirm the fixed Proposal still opens with its cover page.
4. `browser_console_messages` — expect no errors.
5. `browser_close` when done. The browser does not exit on its own; leaving it running orphans ~8 Chrome processes and a temp profile.

Scope any selector to `main.app-shell__main` — TanStack devtools inject their own DOM, and a hidden `<h3>Tanstack Router</h3>` will match a bare `h1,h2,h3` query and hang a visibility wait.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_shell/editor/\$listingId.tsx src/features/editor/EditorRoot.tsx
git commit -m "feat(editor): open a generated document via ?doc=

The editor resolves a generated document off the deal and builds its stored
outline. Without the param it builds the fixed Proposal exactly as before,
so every existing link into the editor is unaffected.

A search param rather than a nested route: moving or adding a route here
would break hardcoded useParams({ from }) and full-reload href navigation,
and vite build catches neither."
```

---

### Task 8: Extract the template picker

A pure refactor with no behaviour change, so the generation screen can take over the modal's first screen in Task 9 without the template list going anywhere.

**Files:**
- Create: `src/components/properties/TemplatePicker.tsx`
- Modify: `src/components/properties/NewDocumentModal.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type DocumentTemplate = { id: string; name: string; orientation: 'landscape' | 'portrait' }`
  - `function TemplatePicker({ onSelect }: { onSelect: (template: DocumentTemplate) => void })` — renders today's search field, the three tabs, and the list.

- [ ] **Step 1: Move the code**

Create `src/components/properties/TemplatePicker.tsx` and move into it, unchanged: the `DocumentTemplate` type, `ORIENTATION_LABEL`, the `template()` helper, `YOUR_TEMPLATES`, `DEFAULT_TEMPLATE_NAMES`, `DEFAULT_TEMPLATES`, `COMPANY_TEMPLATES`, `TABS`, and the `TemplateList` component — plus the search `InputGroup` and the `Tabs` block lifted out of `NewDocumentModal`'s body.

Export `DocumentTemplate` and the new component. The search field and the `Tabs` block move over exactly as they were:

```tsx
/**
 * The template list: search over three tabs of saved, default, and company
 * templates. Extracted verbatim from NewDocumentModal when the modal became
 * AI-first — this is the "Choose from a template instead" path, and it behaves
 * exactly as the modal always did.
 */
export function TemplatePicker({
  onSelect,
}: {
  onSelect: (template: DocumentTemplate) => void;
}) {
  const [query, setQuery] = useState("");

  return (
    <div className="d-flex flex-column gap-3">
      <InputGroup>
        <InputGroup.Addon>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </InputGroup.Addon>
        <Input
          type="search"
          placeholder="Search templates"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>

      <Tabs defaultValue="yours">
        <Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label} ({tab.templates.length})
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Content>
          {TABS.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value}>
              <TemplateList templates={tab.templates} query={query} onSelect={onSelect} />
            </Tabs.Panel>
          ))}
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
```

Bring the imports it needs across too: `useState`/`useMemo` from React, `Input`, `InputGroup`, `Tabs`, `List`, `Empty` from Blueprint, and `faMagnifyingGlass` plus `FontAwesomeIcon`. Remove from `NewDocumentModal` whatever it no longer uses — an unused import is a `tsc` error under this project's config.

The `useEffect` that reset `query` when the modal opened is no longer needed: the component unmounts with the modal, so its state resets naturally.

- [ ] **Step 2: Render it from the modal**

In `NewDocumentModal`, replace the moved markup with `<TemplatePicker onSelect={...} />`, keeping the existing `onSelectTemplate` behaviour identical for now:

```tsx
        <Modal.Body>
          <TemplatePicker
            onSelect={(t) => {
              onSelectTemplate(t.name);
              onOpenChange(false);
            }}
          />
        </Modal.Body>
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify nothing changed in the browser**

With `bun --bun run dev` running, via the `playwright` MCP server: open a deal's Documents page, click **New → New Document**, and confirm the modal looks and behaves as before — search filters, all three tabs render with their counts, and picking a template opens the editor. Check `browser_console_messages` for errors, then `browser_close`.

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/TemplatePicker.tsx src/components/properties/NewDocumentModal.tsx
git commit -m "refactor(docs): extract TemplatePicker from NewDocumentModal

No behaviour change. The template list moves out whole so the next commit
can make the modal AI-first without the list going anywhere — it becomes
the 'Choose from a template instead' path.

Drops the effect that reset the search query on open: the component
unmounts with the modal, so its state resets on its own."
```

---

### Task 9: Screen 1 — the generation screen

**Files:**
- Modify: `src/components/properties/NewDocumentModal.tsx`
- Create: `src/components/properties/SourceFilePicker.tsx`
- Create: `src/components/properties/InstructionSuggestions.tsx`
- Modify: `src/components/properties/PropertyDetailDocuments.tsx`

**Interfaces:**
- Consumes: `DOC_TYPES`, `DocType`, `KIND_LABEL`, `classifyFile`, `suggestionsFor`, `buildOutline`, `SourceFileRef` from Tasks 1–2; `getDealFiles`, `addDealFile` from `#/data/dealFilesActions`; `formatBytes` from `#/lib/formatBytes`; `TemplatePicker`, `DocumentTemplate` from Task 8.
- Produces:
  - `function SourceFilePicker({ items, selectedIds, onToggle, onUpload })`
  - `function InstructionSuggestions({ cards, instructions, onToggle })`
  - `type Screen = 'generate' | 'template' | 'progress' | 'review'` and a `StepIndicator`, both private to `NewDocumentModal.tsx`
  - `NewDocumentModal` props become `{ open, onOpenChange, listingId }`.

- [ ] **Step 1: Build the file picker**

Create `src/components/properties/SourceFilePicker.tsx`. A flat, searchable list of the deal's files — folders are shown as a subtitle rather than navigated, because selecting across folders inside a modal loses sight of what is already checked.

```tsx
import { useMemo, useRef, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faCloudArrowUp } from "@fortawesome/pro-regular-svg-icons";
import { classifyFile, KIND_LABEL } from "#/data/documentGeneration";
import { formatBytes } from "#/lib/formatBytes";
import { fileTypeIcon } from "#/lib/fileTypeIcon";
import type { DealFileItem } from "#/data/types";

export function SourceFilePicker({
  items,
  selectedIds,
  onToggle,
  onUpload,
}: {
  /** Every non-deleted file on the deal, flattened. */
  items: { file: DealFileItem; folderName: string }[];
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onUpload: (files: File[]) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.file.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <span className="fw-semibold">Source files</span>
        <span className="text-muted fs-small">
          {selectedIds.size} of {items.length} selected
        </span>
      </div>

      <InputGroup>
        <InputGroup.Addon>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </InputGroup.Addon>
        <Input
          type="search"
          placeholder="Search files"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>

      {filtered.length === 0 ? (
        <Empty className="py-4">
          <Empty.Content>No files match your search.</Empty.Content>
        </Empty>
      ) : (
        <div
          className="d-flex flex-column gap-1 overflow-auto border rounded p-2"
          style={{ maxHeight: 220 }}
        >
          {filtered.map(({ file, folderName }) => {
            const kind = classifyFile(file.name);
            return (
              <label
                key={file.id}
                className="d-flex align-items-center gap-2 p-2 rounded"
                style={{ cursor: "pointer" }}
              >
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={(c) => onToggle(file.id, c === true)}
                  aria-label={`Use ${file.name}`}
                />
                <FontAwesomeIcon icon={fileTypeIcon(file.name)} className="text-muted" />
                <span className="flex-grow-1" style={{ minWidth: 0 }}>
                  <span className="d-block text-truncate fw-medium">{file.name}</span>
                  <span className="d-block text-muted fs-small">
                    {folderName} · {formatBytes(file.sizeBytes)}
                  </span>
                </span>
                <Badge
                  variant="secondary"
                  appearance={kind === "other" ? "muted" : "accent"}
                >
                  {KIND_LABEL[kind]}
                </Badge>
              </label>
            );
          })}
        </div>
      )}

      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <FontAwesomeIcon icon={faCloudArrowUp} />
          Upload files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="d-none"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length > 0) onUpload(picked);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
```

Signatures already confirmed against the codebase: `fileTypeIcon(name: string): IconDefinition` and `formatBytes(bytes: number | undefined): string` (which renders `undefined` as an em dash on its own, so do not coalesce to `0`). `Badge` takes `variant="secondary"` plus `appearance="muted" | "accent"` in this repo — there is no `info` variant. Do not add margin utility classes to icons inside a `Badge`; Blueprint's Badge already applies a flex gap.

- [ ] **Step 2: Build the suggestion deck**

Create `src/components/properties/InstructionSuggestions.tsx`. Clicking a card appends its sentence to the textarea; clicking again removes it — the textarea stays the single source of truth.

```tsx
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { SuggestionCard } from "#/data/documentGeneration";

export function InstructionSuggestions({
  cards,
  instructions,
  onToggle,
}: {
  cards: SuggestionCard[];
  instructions: string;
  onToggle: (card: SuggestionCard, add: boolean) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-2">
      <span className="form-text mb-0">Suggested additions</span>
      <div className="d-flex flex-wrap gap-2">
        {cards.map((card) => {
          const active = instructions.includes(card.sentence);
          return (
            <Card
              key={card.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              className={active ? "border-primary" : undefined}
              style={{ cursor: "pointer", flex: "1 1 220px" }}
              onClick={() => onToggle(card, !active)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(card, !active);
                }
              }}
            >
              <Card.Body className="p-2">
                <span className="d-flex align-items-center gap-2 fw-medium">
                  <FontAwesomeIcon
                    icon={active ? faCheck : faPlus}
                    className={active ? "text-accent" : "text-muted"}
                  />
                  {card.title}
                </span>
                <span className="d-block text-muted fs-small">{card.effect}</span>
              </Card.Body>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

Confirm the `Card` subcomponent names against the Blueprint docs — `CardBody` is exported as `Card.Body` in some versions and as a separate named export in others; the existing usage in `src/routes/index.tsx` shows which form this project uses.

- [ ] **Step 3: Rewrite the modal's first screen**

In `NewDocumentModal.tsx`, change the props and add the generation screen. The modal now needs `listingId` to read the deal's files.

```tsx
type Screen = "generate" | "template" | "progress" | "review";

export function NewDocumentModal({
  open,
  onOpenChange,
  listingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
}) {
  const [screen, setScreen] = useState<Screen>("generate");
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("Offering Memorandum");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState("");
  const [items, setItems] = useState(() => flattenDealFiles(listingId));

  // Reset every input when the modal opens, so a second run does not inherit
  // the first one's selection.
  useEffect(() => {
    if (!open) return;
    setScreen("generate");
    setName("");
    setDocType("Offering Memorandum");
    setSelectedIds(new Set());
    setInstructions("");
    setItems(flattenDealFiles(listingId));
  }, [open, listingId]);

  const selectedFiles: SourceFileRef[] = items
    .filter((i) => selectedIds.has(i.file.id))
    .map((i) => ({ id: i.file.id, name: i.file.name }));

  const outlineInput = { docType, files: selectedFiles, instructions };
  const outline = buildOutline(outlineInput);
  const cards = suggestionsFor(outlineInput);
  // ...
}
```

Add the flattening helper in the same file:

```tsx
/** The deal's files, flattened with their folder name for the picker's subtitle. */
function flattenDealFiles(listingId: string) {
  const all = getDealFiles(listingId);
  const folderName = (parentId: string | null) =>
    parentId ? (all.find((i) => i.id === parentId)?.name ?? "—") : "Deal files";
  return all
    .filter((i) => i.kind === "file" && !i.deletedAt)
    .map((file) => ({ file, folderName: folderName(file.parentId) }));
}
```

The default document name follows the doc type until the broker edits it. Track that with a `nameEdited` flag rather than overwriting their typing:

```tsx
  const [nameEdited, setNameEdited] = useState(false);
  const effectiveName = nameEdited && name.trim() ? name : `${docType} — ${dealName}`;
```

where `dealName` comes from `getListing(listingId)?.name ?? "Untitled Deal"`.

The suggestion toggle appends or removes the canonical sentence:

```tsx
  function toggleSuggestion(card: SuggestionCard, add: boolean) {
    setInstructions((prev) => {
      if (add) return prev.trim() ? `${prev.trim()} ${card.sentence}` : card.sentence;
      return prev.replace(card.sentence, "").replace(/\s{2,}/g, " ").trim();
    });
  }
```

Uploads go through the real `addDealFile`, so the file lands on the deal's Files page, and auto-select:

```tsx
  function handleUpload(files: File[]) {
    const added = files.map((file, i) => ({
      id: `${listingId}-upload-${Date.now()}-${i}`,
      name: file.name,
      kind: "file" as const,
      parentId: null,
      createdAt: new Date().toISOString(),
      sizeBytes: file.size,
      blob: file,
    }));
    for (const item of added) addDealFile(listingId, item);
    setItems(flattenDealFiles(listingId));
    setSelectedIds((prev) => new Set([...prev, ...added.map((a) => a.id)]));
  }
```

Add the step indicator. Blueprint ships no stepper, so this mirrors the hand-built one in `CreateDealModal` (line 145) — same tokens, same shape, three steps instead of two. It is hidden on the `template` screen, which is not part of the wizard:

```tsx
/** The generation wizard's steps, in order. */
const WIZARD_STEPS = [
  { n: 1 as const, label: "Content" },
  { n: 2 as const, label: "Generate" },
  { n: 3 as const, label: "Review" },
];

/**
 * Three-step progress indicator. Blueprint ships no stepper, so this is
 * hand-built from design tokens: the active/done accent uses `text-bg-primary`
 * (theme primary plus its contrast text) and `text-primary`; inactive steps use
 * `border`/`text-muted`.
 */
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div
      className="d-flex align-items-center gap-2"
      role="group"
      aria-label={`Step ${step} of ${WIZARD_STEPS.length}`}
    >
      {WIZARD_STEPS.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        const lit = active || done;
        return (
          <Fragment key={s.n}>
            <span className="d-inline-flex align-items-center gap-2">
              <span
                className={`d-inline-flex align-items-center justify-content-center rounded-circle fw-semibold fs-small ${
                  lit ? "text-bg-primary" : "border text-muted"
                }`}
                style={{ width: "1.5rem", height: "1.5rem" }}
                aria-hidden
              >
                {done ? <FontAwesomeIcon icon={faCheck} /> : s.n}
              </span>
              <span className={`fs-small fw-semibold ${lit ? "text-primary" : "text-muted"}`}>
                {s.label}
              </span>
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <span className="flex-grow-1 border-top" style={{ minWidth: "1rem" }} aria-hidden />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Which step number a screen sits on. The template path is outside the wizard. */
const STEP_FOR_SCREEN: Record<Screen, 1 | 2 | 3 | null> = {
  generate: 1,
  progress: 2,
  review: 3,
  template: null,
};
```

Now Screen 1's body. Every `Field.Label` is nested inside its `<Field>` — a standalone one crashes at runtime and `tsc` will not catch it:

```tsx
        <Modal.Body className="d-flex flex-column gap-3">
          {step !== null && <StepIndicator step={step} />}

          {screen === "generate" && (
            <>
              <Field>
                <Field.Label>Name</Field.Label>
                <Input
                  value={nameEdited ? name : `${docType} — ${dealName}`}
                  onChange={(e) => {
                    setNameEdited(true);
                    setName(e.target.value);
                  }}
                />
              </Field>

              <Field>
                <Field.Label>Document type</Field.Label>
                <Select
                  value={docType}
                  onValueChange={(v) => v && setDocType(v as DocType)}
                >
                  <Select.Trigger className="w-100">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {DOC_TYPES.map((t) => (
                      <Select.Item key={t} value={t}>
                        {t}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>

              <SourceFilePicker
                items={items}
                selectedIds={selectedIds}
                onToggle={(id, checked) =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    checked ? next.add(id) : next.delete(id);
                    return next;
                  })
                }
                onUpload={handleUpload}
              />

              <Field>
                <Field.Label>Instructions</Field.Label>
                <Textarea
                  rows={3}
                  placeholder="What should this document emphasize?"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </Field>

              <InstructionSuggestions
                cards={cards}
                instructions={instructions}
                onToggle={toggleSuggestion}
              />
            </>
          )}
        </Modal.Body>
```

`Select.Value` is safe here because the doc-type values *are* their labels. Elsewhere in this repo it falls back to the raw value string before the dropdown has been opened, which is why `AddTaskModal` resolves labels by hand through its own `SelectDisplay`.

`step` comes from `STEP_FOR_SCREEN[screen]`. `Fragment` and `faCheck` need importing for the indicator.

The footer:

```tsx
        <Modal.Footer className="d-flex align-items-center justify-content-between">
          <Button variant="ghost" onClick={() => setScreen("template")}>
            Choose from a template instead
          </Button>
          <Button
            variant="primary"
            disabled={selectedIds.size === 0}
            onClick={() => setScreen("progress")}
          >
            Generate
          </Button>
        </Modal.Footer>
```

The `template` screen renders `<TemplatePicker onSelect={...} />` with a Back button returning to `generate`, preserving today's straight-to-editor behaviour for that path.

- [ ] **Step 4: Update the call site**

In `PropertyDetailDocuments.tsx`, pass `listingId` and drop `onSelectTemplate` — navigation now happens from the review screen (Task 11). For this task, keep the modal closing on template selection so nothing is half-wired: have `TemplatePicker`'s `onSelect` navigate to `/editor/$listingId` as it does today.

```tsx
      <NewDocumentModal
        open={newDocumentOpen}
        onOpenChange={setNewDocumentOpen}
        listingId={listingId}
      />
```

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors. Fix any Blueprint prop mismatches against https://buildoutinc.github.io/blueprint/llms.txt rather than guessing.

- [ ] **Step 6: Verify in the browser**

With `bun --bun run dev` running, via the `playwright` MCP server:
1. `browser_navigate` to `http://localhost:3000/listings`, `browser_wait_for` text `Displaying 27 of 27 Deals`.
2. Open a deal's Documents page and click **New → New Document**.
3. Confirm the generation screen is what opens — not the template list.
4. Confirm the picker lists the five new seed files with their kind badges. If they are missing, the IndexedDB store is stale: delete the `keyval-store` database and reload. `SEED_VERSION` should have handled it, so if a delete is needed, check Task 3 Step 4 landed.
5. Check a file and confirm the suggestion deck changes.
6. Click a suggestion and confirm its sentence appears in the textarea; click again and confirm it is removed.
7. Confirm **Generate** is disabled with nothing selected and enabled with one file.
8. Click "Choose from a template instead" and confirm the template list still works.
9. `browser_console_messages` — expect no errors. Then `browser_close`.

- [ ] **Step 7: Commit**

```bash
git add src/components/properties/NewDocumentModal.tsx src/components/properties/SourceFilePicker.tsx src/components/properties/InstructionSuggestions.tsx src/components/properties/PropertyDetailDocuments.tsx
git commit -m "feat(docs): make the New Document modal AI-first

The modal now opens on the generation screen — name, document type, source
files, instructions — with the template list one click away behind 'Choose
from a template instead', where it behaves exactly as it always did.

The file picker is one flat searchable list showing each file's folder as a
subtitle and its kind as a badge, so the classification the generator acts
on is visible before generating. Folder navigation was rejected: selecting
across folders inside a modal loses sight of what is already checked.

Uploads go through the real addDealFile, so a file picked here lands on the
deal's Files page rather than existing only for this generation.

Suggestion cards append their sentence to the textarea and remove it on a
second click. The textarea stays the single source of truth for the prompt
— there is no hidden state beside the text."
```

---

### Task 10: Screen 2 — the generation progress

**Files:**
- Create: `src/components/properties/DocumentGenerationProgress.tsx`
- Modify: `src/components/properties/NewDocumentModal.tsx`

**Interfaces:**
- Consumes: `SourceFileRef` from Task 1; `GeneratedSection` from Task 1.
- Produces: `function DocumentGenerationProgress({ files, sectionCount, onComplete })`

- [ ] **Step 1: Build it**

Create `src/components/properties/DocumentGenerationProgress.tsx`, following the idiom of `src/components/deals/underwriting/UnderwritingProgress.tsx` — a progress bar over a checklist whose items flip pending → working → done, then a hand-off.

```tsx
import { useEffect, useRef, useState } from "react";
import { Progress, CircularProgress } from "@buildoutinc/blueprint-react/ui/Progress";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCircle } from "@fortawesome/pro-regular-svg-icons";
import { cn } from "@buildoutinc/blueprint-react/lib/utils";
import type { SourceFileRef } from "#/data/documentGeneration";

/** Total run time, scaled by how much was fed in and capped so a demo never stalls. */
function durationFor(steps: number): number {
  return Math.min(9_000, Math.max(2_800, 1_400 + steps * 700));
}

/**
 * The faked "AI is reading your files" experience: one step per source file,
 * then extraction, then assembly. Purely client-side theater — there is no
 * backend — but the steps name the broker's actual files so the run reads as
 * being about their deal.
 */
export function DocumentGenerationProgress({
  files,
  sectionCount,
  onComplete,
}: {
  files: SourceFileRef[];
  sectionCount: number;
  onComplete: () => void;
}) {
  const steps = [
    ...files.map((f) => `Reading ${f.name}`),
    "Extracting figures and highlights",
    `Building ${sectionCount} sections`,
  ];

  const [done, setDone] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const perStep = durationFor(steps.length) / steps.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps.length; i++) {
      timers.push(setTimeout(() => setDone(i), perStep * i));
    }
    timers.push(
      setTimeout(() => onCompleteRef.current(), perStep * steps.length + 500),
    );
    return () => timers.forEach(clearTimeout);
    // Steps are derived once for this run; length is the only knob.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2">
        {done < steps.length ? (
          <CircularProgress size="sm" />
        ) : (
          <FontAwesomeIcon icon={faCheck} className="text-accent" />
        )}
        <span className="fw-semibold flex-grow-1">
          {done < steps.length ? "Building your document…" : "Document ready"}
        </span>
        <span className="text-muted fs-small">
          {done} of {steps.length}
        </span>
      </div>

      <Progress value={pct} />

      <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
        {steps.map((label, i) => {
          const complete = i < done;
          const active = i === done;
          return (
            <li
              key={label}
              className={cn("d-flex align-items-center gap-2 fs-small", {
                "text-muted": !complete && !active,
              })}
            >
              <span
                className="d-inline-flex align-items-center justify-content-center"
                style={{ width: 20, height: 20 }}
              >
                {complete ? (
                  <FontAwesomeIcon icon={faCheck} className="text-accent" />
                ) : active ? (
                  <CircularProgress size="sm" />
                ) : (
                  <FontAwesomeIcon icon={faCircle} className="text-muted opacity-50" />
                )}
              </span>
              <span className={cn({ "fw-medium": active })}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

Two files with the same name would collide on the `key`; if the picker can surface duplicates, key on index instead.

- [ ] **Step 2: Wire it into the modal**

In `NewDocumentModal`, render it for `screen === "progress"`, advancing to review on completion. Give the modal no footer buttons on this screen — the run is short and cancelling mid-way has nowhere to go.

```tsx
          {screen === "progress" && (
            <DocumentGenerationProgress
              files={selectedFiles}
              sectionCount={outline.length}
              onComplete={() => setScreen("review")}
            />
          )}
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify in the browser**

With the dev server running, via the `playwright` MCP server: open the modal, select two files, click **Generate**, and confirm the checklist names those two files by name, the bar advances, and the screen hands off on its own. `browser_console_messages`, then `browser_close`.

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/DocumentGenerationProgress.tsx src/components/properties/NewDocumentModal.tsx
git commit -m "feat(docs): add the generation progress screen

One step per selected file, then extraction, then assembly — following
UnderwritingProgress's idiom so the two faked AI runs in the product feel
like the same system.

The steps name the broker's actual files, so a run reads as being about
their deal rather than as a generic spinner. No cancel button: the run is
short and cancelling mid-way has nowhere to return to."
```

---

### Task 11: Screen 3 — review, then open in the editor

**Files:**
- Create: `src/components/properties/GeneratedOutlineReview.tsx`
- Modify: `src/components/properties/NewDocumentModal.tsx`

**Interfaces:**
- Consumes: `GeneratedSection` from Task 1; `classifyFile`, `SourceFileRef` from Task 1; `createGeneratedDocument` from Task 4.
- Produces: `function GeneratedOutlineReview({ sections, instructions, unusedFiles })`

- [ ] **Step 1: Build the review**

Create `src/components/properties/GeneratedOutlineReview.tsx`. Read-only — the editor's page rail already reorders and deletes pages.

```tsx
import { List } from "@buildoutinc/blueprint-react/ui/List";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faWandMagicSparkles } from "@fortawesome/pro-regular-svg-icons";
import type { GeneratedSection } from "#/data/types";
import type { SourceFileRef } from "#/data/documentGeneration";

/**
 * The outline, credited back to what produced it. Read-only on purpose: the
 * editor's page rail already reorders and deletes pages, so an editable review
 * would be a second, weaker copy of that.
 */
export function GeneratedOutlineReview({
  sections,
  docType,
  instructions,
  unusedFiles,
}: {
  sections: GeneratedSection[];
  /** Named in the spine sections' description, e.g. "in every Offering Memorandum". */
  docType: string;
  instructions: string;
  /** Selected files that contributed no section — named rather than silently dropped. */
  unusedFiles: SourceFileRef[];
}) {
  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <span className="fw-semibold">{sections.length} sections</span>
        <List flush>
          {sections.map((section, i) => (
            <List.Item key={`${section.templateKey}-${i}`}>
              <List.ItemContent>
                <List.ItemTitle className="fw-medium">
                  <FontAwesomeIcon icon={faFileLines} className="text-muted" /> {section.name}
                </List.ItemTitle>
                <List.ItemDescription className="text-muted">
                  {section.origin === "file" && `from ${section.sourceFileName}`}
                  {section.origin === "instruction" && (
                    <>
                      <FontAwesomeIcon icon={faWandMagicSparkles} /> from your instructions
                    </>
                  )}
                  {section.origin === "spine" && `in every ${docType}`}
                </List.ItemDescription>
              </List.ItemContent>
            </List.Item>
          ))}
        </List>
      </div>

      {instructions.trim() && (
        <div>
          <span className="fw-semibold">Your instructions</span>
          <p className="text-muted mb-0">{instructions.trim()}</p>
        </div>
      )}

      {unusedFiles.length > 0 && (
        <div>
          <span className="fw-semibold">Reviewed, no section added</span>
          <div className="d-flex flex-wrap gap-2 mt-1">
            {unusedFiles.map((f) => (
              <Badge key={f.id} variant="secondary" appearance="muted">
                {f.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Pass `docType` from the modal so a spine section reads "in every Offering Memorandum" rather than a bare label.

- [ ] **Step 2: Wire it up and persist on open**

In `NewDocumentModal`, render the review for `screen === "review"`, computing the unused files as the selected ones that credited no section:

```tsx
  const unusedFiles = selectedFiles.filter(
    (f) => !outline.some((s) => s.sourceFileName === f.name),
  );
```

```tsx
          {screen === "review" && (
            <GeneratedOutlineReview
              sections={outline}
              docType={docType}
              instructions={instructions}
              unusedFiles={unusedFiles}
            />
          )}
```

The footer persists the document and navigates:

```tsx
        <Modal.Footer className="d-flex align-items-center justify-content-between">
          <Button variant="ghost" onClick={() => setScreen("generate")}>
            Back
          </Button>
          <Button variant="primary" onClick={handleOpenInEditor}>
            Open in editor
          </Button>
        </Modal.Footer>
```

```tsx
  function handleOpenInEditor() {
    const { documentId } = createGeneratedDocument(listingId, {
      name: effectiveName,
      docType,
      sourceFileIds: selectedFiles.map((f) => f.id),
      sourceFileNames: selectedFiles.map((f) => f.name),
      instructions,
      sections: outline,
    });
    onOpenChange(false);
    void navigate({
      to: "/editor/$listingId",
      params: { listingId },
      search: documentId ? { doc: documentId } : {},
    });
  }
```

`Back` returns to screen 1 with every input intact, so the broker can adjust and re-generate. Nothing is persisted until **Open in editor**, so a broker who backs out and closes leaves no orphan document on the deal.

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify in the browser**

With the dev server running, via the `playwright` MCP server:
1. Open the modal, select the T-12, the rent roll, and the master lease, click **Generate**.
2. On review, confirm Financial Highlights and Financial Summary are credited to the T-12, Rent Roll Summary to the rent roll, and the master lease appears under "Reviewed, no section added".
3. Click **Back**, uncheck the rent roll, **Generate** again, and confirm Rent Roll Summary is gone.
4. Click **Open in editor**. Wait for content unique to the editor — do not wait on a generic "page has text" condition, because during client-side navigation the previous view stays mounted and the check passes against the old page.
5. Confirm the page rail lists exactly the reviewed outline.
6. `browser_console_messages`, then `browser_close`.

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/GeneratedOutlineReview.tsx src/components/properties/NewDocumentModal.tsx
git commit -m "feat(docs): add the outline review and open the generated document

The review credits every section back to the file or instruction that
produced it, echoes the instructions, and names the selected files that
contributed nothing rather than silently dropping them.

Read-only on purpose: the editor's page rail already reorders and deletes
pages, so an editable review would be a second, weaker copy of it. Back
returns to screen 1 with every input intact for a re-generate.

Nothing is persisted until Open in editor, so backing out of the review
leaves no orphan document on the deal."
```

---

### Task 12: The Documents table, and end-to-end verification

**Files:**
- Modify: `src/components/properties/PropertyDetailDocuments.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new.

- [ ] **Step 1: Carry the document id into the editor**

`PropertyDetailDocuments` already filters to `aiGenerated` documents, so a generated document appears in the table with no change to the table itself. Its **Edit** button must open that document rather than the fixed Proposal:

```tsx
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        to="/editor/$listingId"
                        params={{ listingId }}
                        search={{ doc: doc.id }}
                      />
                    }
                  >
```

The local `Document` type in that file is mapped from `listing.documents`; no new field is needed, since `doc.id` is already carried through.

- [ ] **Step 2: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, all tests pass.

- [ ] **Step 3: Verify the whole flow in the browser**

With `bun --bun run dev` running, via the `playwright` MCP server. Remember: never `waitUntil: "networkidle"`; scope selectors to `main.app-shell__main`; snapshots are large and are written to `.playwright-mcp/` — grep them rather than reading whole.

1. `browser_navigate` to `http://localhost:3000/listings`; `browser_wait_for` text `Displaying 27 of 27 Deals`.
2. Open a deal, go to its **Documents** page.
3. **New → New Document**. Confirm the generation screen opens first.
4. Name it, pick **Offering Memorandum**, select the T-12, rent roll, submarket report, and site photos.
5. Add the "Lead with NOI" suggestion. Confirm its sentence lands in the textarea.
6. **Generate**, let the run finish.
7. On review, confirm Financial Highlights sits second, right after the cover.
8. **Open in editor**; wait for content unique to the editor. Confirm the page rail matches the outline and the rent roll page renders its tenant table.
9. Save & close back to Documents. Confirm the new row is in the table with today's date.
10. Click **Edit** on that row and confirm the same generated document reopens — not the fixed Proposal.
11. Go to the deal's **Files** page and confirm any file uploaded during the flow is there.
12. `browser_console_messages` — expect no errors on any step.
13. `browser_close`. The browser does not exit on its own; leaving it orphans ~8 Chrome processes and a temp profile in `/var/folders/`.

- [ ] **Step 4: Run the prototype review**

Run the `/prototype-review` skill to catch icon-weight and Blueprint-adoption slips across the new components. Fix what it flags.

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/PropertyDetailDocuments.tsx
git commit -m "feat(docs): open a generated document from the Documents table

The table already filtered to aiGenerated documents, so a generated
document lands there with no change to the table. Its Edit button now
carries ?doc= so it reopens that document rather than the fixed Proposal."
```

- [ ] **Step 6: Delete the spec and plan**

Specs and plans in this repo are in-flight documents, not standing records: when the work ships they are deleted in a `chore(docs):` commit that goes out with the branch. Anything worth keeping that is not already in a commit body — chiefly anything tried and reverted — goes into the PR body **before** the delete.

```bash
git rm docs/superpowers/specs/2026-08-19-ai-document-generation-design.md docs/superpowers/plans/2026-08-19-ai-document-generation.md
git commit -m "chore(docs): remove the shipped AI document generation spec and plan

The work is merged, so the in-flight documents go. The design rationale
lives in the commit bodies on this branch and in the PR description;
git show <commit>^:docs/superpowers/specs/... recovers the originals."
```

- [ ] **Step 7: Ship**

Run the `/ship` skill: it runs the gates, pushes the branch, and opens the PR. It never merges — that stays Joel's call.
