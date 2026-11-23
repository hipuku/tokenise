import { describe, expect, it } from 'vitest'
import { toHex } from './toHex.js'

describe('toHex', () => {
  it('parses the classic rgb syntaxes', () => {
    expect(toHex('rgb(37, 99, 235)')).toBe('#2563eb')
    expect(toHex('rgba(37, 99, 235, 1)')).toBe('#2563eb')
    expect(toHex('#2563EB')).toBe('#2563eb')
  })

  it('parses OKLCH, which is what getComputedStyle now returns for oklch-authored colours', () => {
    expect(toHex('oklch(0.52 0.138 300)')).toBe('#7653ab')
    expect(toHex('oklch(1 0 0)')).toBe('#ffffff')
  })

  it('parses OKLab', () => {
    expect(toHex('oklab(0.5 0.1 -0.1)')).toBe('#81459a')
  })

  it('parses color(srgb …), including float and percentage alpha', () => {
    expect(toHex('color(srgb 0 0 0)')).toBe('#000000')
    expect(toHex('color(srgb 1 1 1)')).toBe('#ffffff')
    expect(toHex('color(srgb 0.2 0.4 0.6 / 0.5)')).toBe('#336699' + '80')
    expect(toHex('color(srgb 0.2 0.4 0.6 / 50%)')).toBe('#336699' + '80')
  })

  it('appends an alpha pair when partially transparent', () => {
    expect(toHex('rgba(0, 0, 0, 0.5)')).toBe('#00000080')
    expect(toHex('oklch(0.52 0.138 300 / 0.5)')).toBe('#7653ab80')
  })

  it('returns null for anything carrying no colour decision', () => {
    for (const v of ['', 'transparent', 'none', 'currentColor', 'rgba(0, 0, 0, 0)', 'color(srgb 0 0 0 / 0)']) {
      expect(toHex(v)).toBeNull()
    }
  })

  it('clamps and rounds out-of-range rgb channels, as CSS defines', () => {
    expect(toHex('rgb(255.6, -3, 128.4)')).toBe('#ff0080')
    expect(toHex('rgb(100%, 0%, 50%)')).toBe('#ff0080')
  })

  it('parses named colours', () => {
    expect(toHex('blue')).toBe('#0000ff')
  })

  it('returns null rather than throwing on unparseable input', () => {
    expect(toHex('not-a-colour')).toBeNull()
    expect(toHex('rgb(oops)')).toBeNull()
  })
})
