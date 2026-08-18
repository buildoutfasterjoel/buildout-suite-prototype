import { describe, expect, it } from 'vitest'
import { fullBleedStyle } from './blocks/fullBleed'
import { PAGE_PADDING } from './types'

describe('fullBleedStyle', () => {
  it('is empty for a normal image', () => {
    expect(fullBleedStyle(false, false)).toEqual({})
    expect(fullBleedStyle(undefined, true)).toEqual({})
  })

  it('cancels the page margin on both sides', () => {
    const style = fullBleedStyle(true, false)
    expect(style.marginLeft).toBe(-PAGE_PADDING)
    expect(style.marginRight).toBe(-PAGE_PADDING)
    expect(style.width).toBe(`calc(100% + ${PAGE_PADDING * 2}px)`)
    expect(style.marginTop).toBeUndefined()
  })

  // A hero leading the page should sit flush under the logo band, not float
  // 40px below it.
  it('also cancels the top margin when the image leads the page', () => {
    expect(fullBleedStyle(true, true).marginTop).toBe(-PAGE_PADDING)
  })
})
