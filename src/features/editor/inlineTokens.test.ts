// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  hasTokens,
  hydrateTokens,
  isTokenChip,
  keyFromTokenPath,
  normalizePastedHtml,
  plainTextPreview,
  serializeTokens,
  tokenChipHtml,
  tokenDisplayText,
  tokenSyntax,
} from './inlineTokens'
import type { DocumentData } from './dynamic'
import type { DealMarketing, Property } from '#/data/types'

const property = {
  name: 'The Thompson Block',
  city: 'Chicago',
  state: 'IL',
  county: '',
  askingPrice: 2000000,
  buildingSqFt: 24000,
  capRate: 6.25,
  yearBuilt: 1960,
  buildingClass: null,
} as unknown as Property

const marketing = {
  saleTitle: 'Smith & Sons <Trust>',
  saleBullets: ['Corner lot', 'Fully leased'],
} as unknown as DealMarketing

const data: DocumentData = { property, marketing }

/** Build a live element holding display HTML, the way InlineText's DOM looks. */
function displayEl(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('token syntax', () => {
  it('prefixes property facts and passes marketing keys through', () => {
    expect(tokenSyntax('city')).toBe('{{property.city}}')
    expect(tokenSyntax('marketing.saleTitle')).toBe('{{marketing.saleTitle}}')
  })

  it('round-trips a path back to its key', () => {
    expect(keyFromTokenPath('property.city')).toBe('city')
    expect(keyFromTokenPath('marketing.saleTitle')).toBe('marketing.saleTitle')
  })

  // Bare braces in prose are more likely typography than a binding.
  it('rejects an unnamespaced or empty path', () => {
    expect(keyFromTokenPath('city')).toBeNull()
    expect(keyFromTokenPath('property.')).toBeNull()
    expect(keyFromTokenPath('marketing.')).toBeNull()
  })

  it('detects whether a stored string carries a token', () => {
    expect(hasTokens('A building in {{property.city}}')).toBe(true)
    expect(hasTokens('A building in Chicago')).toBe(false)
  })
})

describe('hydrateTokens', () => {
  it('replaces a token mid-sentence with a chip carrying the live value', () => {
    const html = hydrateTokens('A building in {{property.city}} today.', data)
    expect(html).toContain('>Chicago<')
    expect(html).toContain('data-token-key="property.city"')
    expect(html).toContain('contenteditable="false"')
    expect(html.startsWith('A building in ')).toBe(true)
    expect(html.endsWith(' today.')).toBe(true)
  })

  it('leaves the formatting around a token untouched', () => {
    const html = hydrateTokens('<b>{{property.city}}</b>, <i>IL</i>', data)
    expect(html.startsWith('<b><span')).toBe(true)
    expect(html).toContain('</span></b>, <i>IL</i>')
  })

  it('hydrates every token in the string', () => {
    const html = hydrateTokens('{{property.city}}, {{property.state}}', data)
    expect(html).toContain('>Chicago<')
    expect(html).toContain('>IL<')
  })

  // No filters exist, so the format has to come from the field itself.
  it('applies the field default format', () => {
    expect(tokenDisplayText('askingPrice', data)).toBe('$2,000,000')
    expect(tokenDisplayText('capRate', data)).toBe('6.25%')
    expect(tokenDisplayText('yearBuilt', data)).toBe('1960')
    expect(tokenDisplayText('buildingSqFt', data)).toBe('24,000')
    expect(tokenDisplayText('marketing.saleBullets', data)).toBe('Corner lot, Fully leased')
  })

  // "a building in — with 24,000 SF" reads as a typo; the field name does not.
  it('renders an empty value as a muted chip naming the field', () => {
    const html = hydrateTokens('in {{property.county}} county', data)
    expect(html).toContain('data-token-unset="true"')
    expect(html).toContain('>County<')
    expect(html).not.toContain('—')
    expect(tokenDisplayText('buildingClass', data)).toBe('Building Class')
  })

  it('tolerates whitespace inside the braces', () => {
    expect(hydrateTokens('{{ property.city }}', data)).toContain('>Chicago<')
  })

  it('leaves a path it cannot namespace as literal text', () => {
    expect(hydrateTokens('{{city}}', data)).toBe('{{city}}')
  })

  // An unknown field is shown, not swallowed, so the user can see and delete it.
  it('renders an unknown field in a known namespace as an unset chip', () => {
    const html = hydrateTokens('{{property.nope}}', data)
    expect(html).toContain('data-token-key="property.nope"')
    expect(html).toContain('data-token-unset="true"')
  })

  it('escapes a resolved value so it cannot inject markup', () => {
    const html = hydrateTokens('{{marketing.saleTitle}}', data)
    expect(html).toContain('Smith &amp; Sons &lt;Trust&gt;')
    expect(displayEl(html).textContent).toBe('Smith & Sons <Trust>')
  })
})

describe('serializeTokens', () => {
  it('turns a chip back into its token', () => {
    const el = displayEl(hydrateTokens('A building in {{property.city}}.', data))
    expect(serializeTokens(el)).toBe('A building in {{property.city}}.')
  })

  it('leaves the caret-bearing DOM untouched', () => {
    const el = displayEl(hydrateTokens('{{property.city}}', data))
    const before = el.innerHTML
    serializeTokens(el)
    expect(el.innerHTML).toBe(before)
  })

  // execCommand("bold") across a chip nests tags around it...
  it('finds a chip wrapped in formatting', () => {
    const el = displayEl(`<b><i>${tokenChipHtml('city', data)}</i></b> and more`)
    expect(serializeTokens(el)).toBe('<b><i>{{property.city}}</i></b> and more')
  })

  // ...and sometimes inside it, which a one-level childNodes read would miss.
  it('finds a chip whose own children were formatted', () => {
    const el = displayEl(
      '<span class="bo-editor-token" data-token-key="property.city" contenteditable="false"><b>Chi<i>cago</i></b></span>',
    )
    expect(serializeTokens(el)).toBe('{{property.city}}')
  })

  it('serializes a chip nested several levels deep', () => {
    const el = displayEl(
      `<div><span style="font-size: 20px">A <b>bold ${tokenChipHtml('state', data)}</b></span></div>`,
    )
    expect(serializeTokens(el)).toContain('bold {{property.state}}')
  })

  it('drops a chip whose key cannot be parsed rather than storing a broken token', () => {
    const el = displayEl(
      'keep <span data-token-key="bogus" contenteditable="false">x</span> this',
    )
    expect(serializeTokens(el)).toBe('keep  this')
  })

  it('re-escapes text through the round trip', () => {
    const el = displayEl(hydrateTokens('{{marketing.saleTitle}} &amp; more', data))
    expect(serializeTokens(el)).toBe('{{marketing.saleTitle}} &amp; more')
  })

  // The equivalence check in InlineText depends on this being a fixed point:
  // if a round trip drifted, every keystroke would rewrite the DOM under the caret.
  it('is a stable round trip', () => {
    const stored = 'A <b>{{property.city}}</b> building, {{property.county}}, built {{property.yearBuilt}}.'
    const display = hydrateTokens(stored, data)
    expect(serializeTokens(displayEl(display))).toBe(stored)
    expect(hydrateTokens(serializeTokens(displayEl(display)), data)).toBe(display)
  })
})

describe('isTokenChip', () => {
  it('recognizes only a chip element', () => {
    const el = displayEl(hydrateTokens('a {{property.city}}', data))
    expect(isTokenChip(el.lastChild)).toBe(true)
    expect(isTokenChip(el.firstChild)).toBe(false)
    expect(isTokenChip(null)).toBe(false)
  })
})

describe('normalizePastedHtml', () => {
  // A chip copied from a document bound to another listing carries that
  // listing's text; pasting must re-resolve it against this document's data.
  it('re-resolves a pasted chip against the current data', () => {
    const stale =
      '<span class="bo-editor-token" data-token-key="property.city" contenteditable="false">Milwaukee</span>'
    const pasted = normalizePastedHtml(stale, data)
    expect(pasted).toContain('>Chicago<')
    expect(pasted).not.toContain('Milwaukee')
  })

  it('keeps the formatting around a pasted chip', () => {
    const pasted = normalizePastedHtml(`<b>${tokenChipHtml('state', data)}</b>`, data)
    expect(pasted.startsWith('<b><span')).toBe(true)
  })
})

describe('plainTextPreview', () => {
  it('names the field rather than printing its token', () => {
    expect(plainTextPreview('{{property.name}}')).toBe('Deal Name')
    expect(plainTextPreview('Located in {{property.city}}')).toBe('Located in City')
  })

  it('strips markup and decodes entities', () => {
    expect(plainTextPreview('<b>Bold</b> &amp; <i>italic</i>')).toBe('Bold & italic')
    expect(plainTextPreview('a&nbsp;&nbsp;b')).toBe('a b')
  })

  it('is empty for empty content, so callers can fall back to a type name', () => {
    expect(plainTextPreview('')).toBe('')
    expect(plainTextPreview('<br>')).toBe('')
  })
})
