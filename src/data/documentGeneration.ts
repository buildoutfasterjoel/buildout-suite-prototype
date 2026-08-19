import type { GeneratedSection } from './types'

/**
 * The AI document generation brain: what a source file is, what each kind of
 * file contributes to a document, and how a document type's spine is shaped.
 *
 * Deliberately pure and deterministic — no Date, no Math.random, and no imports
 * from `features/editor`. The editor consumes the `templateKey` strings this
 * module emits; the coupling runs one way, and a later task adds a test that every
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
