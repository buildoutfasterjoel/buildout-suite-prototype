import { describe, expect, it } from 'vitest'
import {
  MAP_STYLES,
  MAP_SIZES,
  MAP_ZOOM_MIN,
  clampZoom,
  mapSizeHeight,
  mapStyleDef,
} from './blocks/mapStyles'
import { createBlock } from './blocks/blockFactory'
import { buildLocationMapPage } from './templates/designer'
import { buildTemplatePage } from './templates'
import { buildDocumentPages } from './presets'
import { useEditorStore } from './store'
import { pageHasDynamicContent } from './tree'
import type { ColumnsBlock, DynamicBlock, MapBlock, TableBlock } from './types'
import type { Property } from '#/data/types'

function mapBlockOf(page = buildLocationMapPage()): MapBlock {
  const map = page.blocks.find((b) => b.type === 'map')
  if (!map || map.type !== 'map') throw new Error('no map block')
  return map
}

describe('map tile styles', () => {
  it('offers streets, satellite, and terrain, each on a keyless source', () => {
    expect(MAP_STYLES.map((s) => s.key)).toEqual(['streets', 'satellite', 'terrain'])
    for (const style of MAP_STYLES) {
      expect(style.url).toMatch(/^https:\/\//)
      // A source needing a token would break the moment the demo left this machine.
      expect(style.url).not.toMatch(/key=|token=|access_token/)
      expect(style.attribution.length).toBeGreaterThan(0)
    }
  })

  it('falls back to streets for an unknown style', () => {
    expect(mapStyleDef('nope' as never).key).toBe('streets')
  })

  // Past a source's maxZoom the tiles 404 and Leaflet paints grey.
  it('clamps zoom to what the chosen style actually serves', () => {
    expect(clampZoom(19, 'terrain')).toBe(17)
    expect(clampZoom(19, 'satellite')).toBe(18)
    expect(clampZoom(19, 'streets')).toBe(19)
    expect(clampZoom(1, 'streets')).toBe(MAP_ZOOM_MIN)
    expect(clampZoom(14, 'streets')).toBe(14)
  })
})

describe('map size presets', () => {
  it('maps each preset to its height', () => {
    expect(mapSizeHeight('sm')).toBe(240)
    expect(mapSizeHeight('md')).toBe(360)
    expect(mapSizeHeight('lg')).toBe(520)
  })

  // `full` means "no fixed height, grow into the page". Defaulting that null
  // away with `??` silently turned Full into Medium.
  it('gives full no height of its own, and only defaults an unknown size', () => {
    expect(mapSizeHeight('full')).toBeNull()
    expect(mapSizeHeight('xl' as never)).toBe(360)
  })

  it('labels every preset for the segmented control', () => {
    expect(MAP_SIZES.map((s) => s.label)).toEqual(['S', 'M', 'L', 'Full'])
  })
})

describe('a new map block', () => {
  it('starts on streets, mid-zoom, medium, with a hairline frame', () => {
    const block = createBlock('map') as MapBlock
    expect(block).toMatchObject({
      type: 'map',
      mapStyle: 'streets',
      zoom: 14,
      size: 'md',
      borderWidth: 1,
      borderStyle: 'solid',
    })
  })
})

describe('updateMapBlock', () => {
  // Enough of a Property for every seeded template to build (the cover prints
  // the type and building size).
  const property = {
    id: 'p1',
    name: 'Test Asset',
    propertyType: 'industrial',
    buildingSqFt: 24000,
    lat: 35.2,
    lng: -80.8,
  } as unknown as Property

  function seedWithMap(): MapBlock {
    useEditorStore.getState().initDocument(property)
    const page = useEditorStore.getState().document.pages.find((p) => p.name === 'Location Map')
    if (!page) throw new Error('seeded document has no Location Map page')
    return mapBlockOf(page)
  }

  it('patches only the fields passed, and marks the document dirty', () => {
    const before = seedWithMap()
    useEditorStore.getState().updateMapBlock(before.id, { mapStyle: 'satellite', zoom: 17 })

    const after = mapBlockOf(
      useEditorStore.getState().document.pages.find((p) => p.name === 'Location Map')!,
    )
    expect(after.mapStyle).toBe('satellite')
    expect(after.zoom).toBe(17)
    expect(after.size).toBe(before.size)
    expect(after.borderColor).toBe(before.borderColor)
    expect(useEditorStore.getState().dirty).toBe(true)
  })

  it('accepts a cleared border color', () => {
    const block = seedWithMap()
    useEditorStore.getState().updateMapBlock(block.id, { borderColor: null, borderWidth: 0 })
    const after = mapBlockOf(
      useEditorStore.getState().document.pages.find((p) => p.name === 'Location Map')!,
    )
    expect(after.borderColor).toBeNull()
    expect(after.borderWidth).toBe(0)
  })

  it('ignores a block that is not a map', () => {
    seedWithMap()
    const doc = useEditorStore.getState().document
    const heading = doc.pages[1].blocks[0]
    useEditorStore.getState().updateMapBlock(heading.id, { zoom: 2 })
    expect(useEditorStore.getState().document.pages[1].blocks[0]).toEqual(heading)
  })
})

describe('the Location template', () => {
  it('runs a real map over a narrative column and a location table', () => {
    const page = buildLocationMapPage()
    expect(page.blocks.map((b) => b.type)).toEqual(['heading', 'map', 'columns'])

    const row = page.blocks[2] as ColumnsBlock
    expect(row.columnCount).toBe(2)
    expect((row.columns[0][1] as DynamicBlock).dynamicKey).toBe('marketing.locationDescription')
    expect((row.columns[1][0] as TableBlock).rows.map((r) => r[0].value)).toEqual([
      'Address',
      'City',
      'State',
      'County',
      'Submarket',
    ])
  })

  // A base page has ~814px of content stack; heading + copy row need the rest.
  it('seeds the map at the medium preset so the copy below it still fits', () => {
    expect(mapBlockOf().size).toBe('md')
    expect(mapSizeHeight(mapBlockOf().size)).toBe(360)
  })

  it('reads as a page with live data', () => {
    expect(pageHasDynamicContent(buildLocationMapPage())).toBe(true)
  })

  it('is offered in the gallery and seeded into the proposal', () => {
    expect(buildTemplatePage('locationMap').blocks.some((b) => b.type === 'map')).toBe(true)
    const seeded = buildDocumentPages(undefined).find((p) => p.name === 'Location Map')
    expect(seeded).toBeDefined()
    expect(seeded!.blocks.some((b) => b.type === 'map')).toBe(true)
  })
})
