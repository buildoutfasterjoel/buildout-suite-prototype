import { describe, expect, it } from 'vitest'
import { resolveSelection } from './store'
import { buildTemplatePage } from './templates'
import type { ColumnsBlock, EditorDocument, Page, SectionBlock, TableBlock } from './types'

function docOf(...pages: Page[]): EditorDocument {
  return { id: 'doc-test', name: 'Test', pages }
}

/**
 * Selection resolution is what the rich-text toolbar, the style controls, and
 * the breadcrumb all read. It used to look only at a page's top-level blocks,
 * so anything inside a container resolved to null and those three surfaces went
 * blank for it — most visibly on the cover, whose entire title band is nested.
 */
describe('resolveSelection', () => {
  it('resolves text nested inside a section', () => {
    const cover = buildTemplatePage('cover')
    const band = cover.blocks.find((b) => b.type === 'section') as SectionBlock
    const heading = band.blocks.find((b) => b.type === 'heading')
    expect(heading).toBeDefined()

    const { page, block } = resolveSelection(docOf(cover), {
      pageId: cover.id,
      blockId: heading!.id,
    })
    expect(page).toBe(cover)
    expect(block).toBe(heading)
  })

  it('resolves every block nested inside a column', () => {
    const overview = buildTemplatePage('propertyOverview')
    const columns = overview.blocks.find((b) => b.type === 'columns') as ColumnsBlock
    const children = columns.columns.flat()
    expect(children.length).toBeGreaterThan(0)

    for (const child of children) {
      const { block } = resolveSelection(docOf(overview), {
        pageId: overview.id,
        blockId: child.id,
      })
      expect(block).toBe(child)
    }
  })

  // A table inside a column: the cell only resolves once its table does.
  it('resolves a cell of a nested table', () => {
    const overview = buildTemplatePage('propertyOverview')
    const columns = overview.blocks.find((b) => b.type === 'columns') as ColumnsBlock
    const table = columns.columns.flat().find((b) => b.type === 'table') as TableBlock
    const target = table.rows[0][0]

    const { block, cell } = resolveSelection(docOf(overview), {
      pageId: overview.id,
      blockId: table.id,
      cellId: target.id,
    })
    expect(block).toBe(table)
    expect(cell).toBe(target)
  })

  it('still resolves top-level blocks, and yields null for a missing one', () => {
    const cover = buildTemplatePage('cover')
    const top = cover.blocks[0]

    expect(resolveSelection(docOf(cover), { pageId: cover.id, blockId: top.id }).block).toBe(top)
    expect(resolveSelection(docOf(cover), { pageId: cover.id, blockId: 'nope' }).block).toBeNull()
    expect(resolveSelection(docOf(cover), null)).toEqual({ page: null, block: null, cell: null })
  })
})
