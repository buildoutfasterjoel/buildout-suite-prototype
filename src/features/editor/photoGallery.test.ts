import { describe, expect, it } from 'vitest'
import { buildPhotoGalleryPage } from './templates/designer'
import { buildTemplatePage } from './templates'
import { buildDocumentPages } from './presets'
import { galleryPhotoIds } from '#/components/properties/propertyDisplay'
import type { ColumnsBlock, ImageBlock } from './types'
import { PAGE_HEIGHT, PAGE_PADDING, PAGE_WIDTH } from './types'

function grid(page = buildPhotoGalleryPage()): ColumnsBlock {
  const columns = page.blocks.find((b) => b.type === 'columns')
  if (!columns || columns.type !== 'columns') throw new Error('no columns block')
  return columns
}

function tiles(page = buildPhotoGalleryPage()): ImageBlock[] {
  return grid(page).columns.flat() as ImageBlock[]
}

/** The `h=` a tile's URL asks Unsplash for — the height it renders at. */
function tileHeight(tile: ImageBlock): number {
  return Number(new URL(tile.src).searchParams.get('h'))
}

describe('buildPhotoGalleryPage', () => {
  it('is a titled page over a three-column grid, nothing else', () => {
    const page = buildPhotoGalleryPage()
    expect(page.name).toBe('Property Photos')
    expect(page.blocks.map((b) => b.type)).toEqual(['heading', 'columns'])
    expect(grid(page).columnCount).toBe(3)
  })

  it('fills every column with image blocks only', () => {
    for (const column of grid().columns) {
      expect(column.length).toBeGreaterThan(0)
      expect(column.every((b) => b.type === 'image')).toBe(true)
    }
    expect(tiles()).toHaveLength(9)
  })

  // Every tile is a plain image block on purpose: that is what makes the page
  // swappable, since the picker only opens for an image selection.
  it('leaves each tile swappable, with its own crop to preserve', () => {
    const crops = tiles().map((t) => t.src)
    expect(new Set(crops).size).toBe(crops.length)
    for (const tile of tiles()) {
      expect(tile.src).toContain('fit=crop')
    }
  })

  it('mixes portrait, square, and landscape crops', () => {
    const width = Math.floor((PAGE_WIDTH - PAGE_PADDING * 2 - 16 * 2) / 3)
    const heights = tiles().map(tileHeight)
    expect(tiles().every((t) => t.src.includes(`w=${width}`))).toBe(true)
    expect(heights.some((h) => h > width)).toBe(true) // portrait
    expect(heights.some((h) => h === width)).toBe(true) // square
    expect(heights.some((h) => h < width)).toBe(true) // landscape
  })

  // A column that runs long pushes the grid past the footer and off the sheet.
  it('keeps every column within a few pixels of the same height, and on the page', () => {
    const stackGap = 12
    const columnHeights = grid().columns.map(
      (column) =>
        (column as ImageBlock[]).reduce((sum, tile) => sum + tileHeight(tile), 0) +
        stackGap * (column.length - 1),
    )
    const tallest = Math.max(...columnHeights)
    expect(tallest - Math.min(...columnHeights)).toBeLessThanOrEqual(8)
    // Heading + block gap + the page's own margins have to fit above and below.
    expect(tallest).toBeLessThan(PAGE_HEIGHT - PAGE_PADDING * 2 - 200)
  })

  it('opens on the deal’s own hero photo, then walks its gallery without repeating', () => {
    const page = buildPhotoGalleryPage({ id: 'deal-7' } as never)
    const expected = galleryPhotoIds('deal-7', 9)
    expect(tiles(page)[0].src).toContain(expected[0])
    const photos = tiles(page).map((t) => new URL(t.src).pathname)
    expect(new Set(photos).size).toBe(photos.length)
  })

  it('is offered in the template gallery', () => {
    expect(buildTemplatePage('photoGallery').name).toBe('Property Photos')
  })

  // The seeded document keeps the section name its contents page advertises.
  it('replaces the Additional Photos stub, keeping that name', () => {
    const pages = buildDocumentPages(undefined)
    const photos = pages.find((p) => p.name === 'Additional Photos')
    expect(photos).toBeDefined()
    expect(photos!.blocks[0]).toMatchObject({ type: 'heading', text: 'Additional Photos' })
    expect((grid(photos!).columns.flat() as ImageBlock[]).length).toBe(9)
  })
})
