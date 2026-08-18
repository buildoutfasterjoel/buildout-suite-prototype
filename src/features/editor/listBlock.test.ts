import { describe, expect, it } from 'vitest'
import { createBlock } from './blocks/blockFactory'
import { blockLabel, BLOCK_ICONS } from './blocks/blockMeta'
import { pageHasDynamicContent } from './tree'
import { resolveList } from './dynamic'
import type { DealMarketing, Property } from '#/data/types'
import type { ListBlock, Page } from './types'

function pageWith(block: ListBlock): Page {
  return { id: 'page-1', name: 'Test', blocks: [block] }
}

describe('list block', () => {
  it('is created with editable starter items and a bullet marker', () => {
    const block = createBlock('list')
    expect(block.type).toBe('list')
    if (block.type !== 'list') throw new Error('unreachable')
    expect(block.marker).toBe('bullet')
    expect(block.items.length).toBeGreaterThan(0)
    expect(block.dynamicKey).toBeUndefined()
  })

  it('has an icon and a label', () => {
    const block = createBlock('list')
    expect(BLOCK_ICONS.list).toBeDefined()
    expect(blockLabel(block)).toBe('List')
  })

  // The Pages panel's bolt indicator has to notice a bound list, or a page
  // whose only live content is its bullets looks static.
  it('counts as dynamic page content when bound', () => {
    const bound = { ...(createBlock('list') as ListBlock), dynamicKey: 'marketing.saleBullets' as const }
    expect(pageHasDynamicContent(pageWith(bound))).toBe(true)
    expect(pageHasDynamicContent(pageWith(createBlock('list') as ListBlock))).toBe(false)
  })
})

describe('resolveList', () => {
  const property = {} as unknown as Property
  const marketing = { saleBullets: ['Corner lot', 'Fully leased'] } as unknown as DealMarketing

  it('returns the bound array for a dynamic list', () => {
    const block = { ...(createBlock('list') as ListBlock), dynamicKey: 'marketing.saleBullets' as const }
    expect(resolveList(block, { property, marketing })).toEqual(['Corner lot', 'Fully leased'])
  })

  it('returns the static items when unbound', () => {
    const block = { ...(createBlock('list') as ListBlock), items: ['One', 'Two'] }
    expect(resolveList(block, { property, marketing })).toEqual(['One', 'Two'])
  })

  // A bound list with no data must render nothing rather than "undefined".
  it('returns an empty array when the bound field is missing', () => {
    const block = { ...(createBlock('list') as ListBlock), dynamicKey: 'marketing.leaseBullets' as const }
    expect(resolveList(block, { property, marketing })).toEqual([])
  })
})
