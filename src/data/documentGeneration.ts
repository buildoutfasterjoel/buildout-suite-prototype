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
    offerWhen: (_base, kinds) => kinds.has('rent-roll'),
  },
  {
    id: 'emphasize-location',
    title: 'Emphasize location',
    sentence: 'Emphasize the location and surrounding submarket.',
    effect: 'Adds Location & Map',
    matches: /emphasi\w+.*location/i,
    phase: 'add',
    offerWhen: (_base, kinds) => kinds.has('market'),
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
