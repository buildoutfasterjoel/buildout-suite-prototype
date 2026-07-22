import { describe, expect, it } from 'vitest'
import { BRAND, BRAND_SWATCHES, SERIF, SANS } from './brand'

describe('BRAND', () => {
  it('names the demo brand Meridian Point Real Estate', () => {
    expect(BRAND.name).toBe('Meridian Point Real Estate')
  })

  it('reuses the existing document logo asset', () => {
    expect(BRAND.logoSrc).toBe('/assets/branding/gemini-logo.png')
  })

  it('exposes heading and body fonts', () => {
    expect(BRAND.fonts.heading).toBe(SERIF)
    expect(BRAND.fonts.body).toBe(SANS)
  })

  it('derives BRAND_SWATCHES from the palette values', () => {
    expect(BRAND_SWATCHES).toEqual(Object.values(BRAND.palette))
    expect(BRAND_SWATCHES).toContain('#7422ce')
  })
})
