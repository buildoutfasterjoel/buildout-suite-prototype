import { describe, expect, it } from 'vitest'
import { buildPropertySummaryPage } from './templates/designer'
import { visibleRows } from './blocks/rowVisibility'
import type { ColumnsBlock, ImageBlock, ListBlock, TableBlock } from './types'
import type { DealMarketing, Property } from '#/data/types'

const marketing = {} as unknown as DealMarketing

function propertyOfType(propertyType: Property['propertyType']): Property {
  return {
    propertyType,
    buildingSqFt: 24000,
    lotSqFt: 40000,
    yearBuilt: 1998,
    stories: 4,
    numberOfBuildings: 1,
    zoning: 'C-2',
    parkingSpaces: 60,
    buildingClass: 'A',
    residentialUnits: propertyType === 'multifamily' ? 12 : null,
    totalBathrooms: propertyType === 'multifamily' ? 14 : null,
    dockHighDoors: propertyType === 'industrial' ? 6 : null,
    numberOfLots: propertyType === 'land' ? 3 : null,
  } as unknown as Property
}

function factTable(page = buildPropertySummaryPage()): TableBlock {
  const columns = page.blocks.find((b) => b.type === 'columns') as ColumnsBlock
  const table = columns.columns.flat().find((b) => b.type === 'table')
  if (!table || table.type !== 'table') throw new Error('no fact table')
  return table
}

function rowLabels(propertyType: Property['propertyType']): string[] {
  const property = propertyOfType(propertyType)
  return visibleRows(factTable(), { property, marketing }).map((r) => r.cells[0].value)
}

describe('buildPropertySummaryPage', () => {
  it('leads with a full-bleed hero', () => {
    const hero = buildPropertySummaryPage().blocks[0] as ImageBlock
    expect(hero.type).toBe('image')
    expect(hero.fullBleed).toBe(true)
  })

  it('keeps the base page chrome so it stays a numbered page', () => {
    const page = buildPropertySummaryPage()
    expect(page.chrome ?? 'base').toBe('base')
    expect(page.bleed ?? false).toBe(false)
  })

  it('binds the left column to the deal’s sale copy', () => {
    const columns = buildPropertySummaryPage().blocks.find((b) => b.type === 'columns') as ColumnsBlock
    const left = columns.columns[0]
    expect(left.some((b) => b.type === 'dynamic' && b.dynamicKey === 'marketing.saleDescription')).toBe(true)
    const list = left.find((b) => b.type === 'list') as ListBlock
    expect(list.dynamicKey).toBe('marketing.saleBullets')
  })

  it('shows units for multifamily and not for industrial', () => {
    expect(rowLabels('multifamily')).toContain('Units')
    expect(rowLabels('industrial')).not.toContain('Units')
  })

  it('shows dock doors for industrial and not for multifamily', () => {
    expect(rowLabels('industrial')).toContain('Dock-High Doors')
    expect(rowLabels('multifamily')).not.toContain('Dock-High Doors')
  })

  // Land has no building, so the building-shaped rows must not print.
  it('drops building rows for land and shows lot rows instead', () => {
    const land = rowLabels('land')
    expect(land).not.toContain('Building Size')
    expect(land).not.toContain('Stories')
    expect(land).toContain('Number of Lots')
  })

  it('gives every asset class at least the shared rows', () => {
    for (const t of ['office', 'retail', 'hospitality', 'special-purpose'] as const) {
      expect(rowLabels(t)).toContain('Zoning')
    }
  })
})
