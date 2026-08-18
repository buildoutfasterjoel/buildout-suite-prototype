import { describe, expect, it } from 'vitest'
import { trailingRowInsertIndex, visibleRows } from './blocks/rowVisibility'
import type { Cell, TableBlock } from './types'
import type { DealMarketing, Property } from '#/data/types'

let n = 0
function cell(value: string, opts: Partial<Cell> = {}): Cell {
  return { id: `cell-${(n += 1)}`, value, style: {} as Cell['style'], ...opts }
}

function table(rows: Cell[][], rowRules?: TableBlock['rowRules']): TableBlock {
  return { id: 'table-1', type: 'table', rows, rowRules, style: {} as TableBlock['style'] }
}

const marketing = {} as unknown as DealMarketing
const multifamily = { propertyType: 'multifamily', residentialUnits: 12, driveInBays: null } as unknown as Property
const industrial = { propertyType: 'industrial', residentialUnits: null, driveInBays: 0 } as unknown as Property

describe('visibleRows', () => {
  it('keeps a row whose type rule matches and drops one whose rule does not', () => {
    const units = cell('Units')
    const t = table([[units, cell('—', { dynamicKey: 'residentialUnits' })]], {
      [units.id]: { types: ['multifamily', 'mixed-use'] },
    })
    expect(visibleRows(t, { property: multifamily, marketing })).toHaveLength(1)
    expect(visibleRows(t, { property: industrial, marketing })).toHaveLength(0)
  })

  it('drops a row whose only dynamic value is empty', () => {
    const label = cell('Units')
    const t = table([[label, cell('—', { dynamicKey: 'residentialUnits' })]])
    expect(visibleRows(t, { property: industrial, marketing })).toHaveLength(0)
  })

  // Zero drive-in bays is a recorded fact, not missing data.
  it('keeps a row whose dynamic value is 0', () => {
    const label = cell('Drive-In Bays')
    const t = table([[label, cell('—', { dynamicKey: 'driveInBays' })]])
    expect(visibleRows(t, { property: industrial, marketing })).toHaveLength(1)
  })

  it('keeps an empty row when keepEmpty is set', () => {
    const label = cell('Units')
    const t = table([[label, cell('—', { dynamicKey: 'residentialUnits' })]], {
      [label.id]: { keepEmpty: true },
    })
    expect(visibleRows(t, { property: industrial, marketing })).toHaveLength(1)
  })

  // A hand-authored row belongs to the user, not to the data.
  it('never drops a row with no dynamic cells', () => {
    const t = table([[cell('Notes'), cell('Anything')]])
    expect(visibleRows(t, { property: industrial, marketing })).toHaveLength(1)
  })

  // Gallery thumbnails render with no property bound; pruning there would
  // collapse the table to nothing and the preview would look broken.
  it('prunes nothing when no property is bound', () => {
    const units = cell('Units')
    const t = table(
      [
        [units, cell('—', { dynamicKey: 'residentialUnits' })],
        [cell('Docks'), cell('—', { dynamicKey: 'dockHighDoors' })],
      ],
      { [units.id]: { types: ['multifamily'] } },
    )
    expect(visibleRows(t, { property: undefined, marketing })).toHaveLength(2)
  })

  it('reports each surviving row’s index in the underlying model', () => {
    const a = cell('A')
    const b = cell('B')
    const t = table(
      [
        [a, cell('—', { dynamicKey: 'residentialUnits' })],
        [b, cell('—', { dynamicKey: 'driveInBays' })],
      ],
    )
    const rows = visibleRows(t, { property: industrial, marketing })
    expect(rows).toHaveLength(1)
    expect(rows[0].index).toBe(1)
  })
})

describe('trailingRowInsertIndex', () => {
  // Model rows: 0 visible, 1 pruned (type mismatch), 2 visible, 3 pruned
  // (type mismatch) — a pruned row sits AFTER the last visible row. The dot
  // gutter's trailing dot (i === visible count) must resolve to just past the
  // last visible row's model index (3), not the naive visible count (2),
  // which would land ON the last visible row instead of after it.
  function tableWithTrailingPrunedRow(): TableBlock {
    const keep = { types: ['industrial' as const] }
    const drop = { types: ['multifamily' as const] }
    return table([
      [cell('A', { id: 'a' }), cell('—', { dynamicKey: 'driveInBays' })],
      [cell('B', { id: 'b' }), cell('—', { dynamicKey: 'driveInBays' })],
      [cell('C', { id: 'c' }), cell('—', { dynamicKey: 'driveInBays' })],
      [cell('D', { id: 'd' }), cell('—', { dynamicKey: 'driveInBays' })],
    ], { a: keep, b: drop, c: keep, d: drop })
  }

  it('resolves the trailing dot past the last visible row, not the visible count', () => {
    const t = tableWithTrailingPrunedRow()
    const visible = visibleRows(t, { property: industrial, marketing })
    const rowIndexMap = visible.map((r) => r.index)

    expect(rowIndexMap).toEqual([0, 2]) // rows 1 and 3 pruned
    const visibleCount = rowIndexMap.length

    const trailing = trailingRowInsertIndex(rowIndexMap, visibleCount)
    expect(trailing).toBe(3) // last visible row's model index (2) + 1
    expect(trailing).not.toBe(visibleCount) // the naive `?? i` fallback would wrongly give 2
  })

  it('returns the mapped index unchanged for a real (non-trailing) row', () => {
    expect(trailingRowInsertIndex([0, 2], 1)).toBe(2)
  })

  it('falls back to 0 when there are no visible rows at all', () => {
    expect(trailingRowInsertIndex([], 0)).toBe(0)
  })
})
