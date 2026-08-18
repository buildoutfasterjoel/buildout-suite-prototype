import { describe, expect, it } from 'vitest'
import { useEditorStore } from './store'
import type { DealMarketing, Property } from '#/data/types'

const property = { id: 'p1', name: 'Test Asset', buildingSqFt: 1000 } as unknown as Property
const marketing = { saleDescription: 'Copy from the deal.' } as unknown as DealMarketing

describe('initDocument', () => {
  it('stores the marketing record alongside the property', () => {
    useEditorStore.getState().initDocument(property, undefined, marketing)
    expect(useEditorStore.getState().activeMarketing).toBe(marketing)
    expect(useEditorStore.getState().activeListing).toBe(property)
  })

  // Opening a second document must not leave the first one's copy behind.
  it('clears the marketing record when the next document has none', () => {
    useEditorStore.getState().initDocument(property, undefined, marketing)
    useEditorStore.getState().initDocument(property, undefined, undefined)
    expect(useEditorStore.getState().activeMarketing).toBeUndefined()
  })
})
