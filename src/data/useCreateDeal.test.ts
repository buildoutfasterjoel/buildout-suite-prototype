import { describe, expect, it } from 'vitest'
import { useCreateDeal } from './useCreateDeal'

describe('useCreateDeal', () => {
  it('opens with context and closes clearing it', () => {
    useCreateDeal.getState().openFor({ initialAddress: '123 Main St' })
    expect(useCreateDeal.getState().open).toBe(true)
    expect(useCreateDeal.getState().initialAddress).toBe('123 Main St')

    useCreateDeal.getState().close()
    expect(useCreateDeal.getState().open).toBe(false)
    expect(useCreateDeal.getState().initialAddress).toBeUndefined()
    expect(useCreateDeal.getState().contact).toBeUndefined()
    expect(useCreateDeal.getState().property).toBeUndefined()
  })

  it('carries a space to start on, and clears it on close', () => {
    useCreateDeal.getState().openFor({ spaceUnitId: 'unit-1', lockLease: true })
    expect(useCreateDeal.getState().spaceUnitId).toBe('unit-1')
    expect(useCreateDeal.getState().lockLease).toBe(true)

    useCreateDeal.getState().close()
    expect(useCreateDeal.getState().spaceUnitId).toBeUndefined()
    expect(useCreateDeal.getState().lockLease).toBeUndefined()
  })

  it('openFor with no context opens an empty create flow', () => {
    useCreateDeal.getState().openFor()
    expect(useCreateDeal.getState().open).toBe(true)
    expect(useCreateDeal.getState().contact).toBeUndefined()
    expect(useCreateDeal.getState().property).toBeUndefined()
  })
})
