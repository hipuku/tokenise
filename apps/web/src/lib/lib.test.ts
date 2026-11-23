import { describe, expect, it } from 'vitest'
import { convert, read } from '@/engine/convert'
import { joinPath } from '@/engine/types'
import { SAMPLES } from '@/samples'
import hausTokens from '@/samples/haus.tokens.json?raw'
import { compareFormats } from './compare'
import { summarise, valueText } from './describe'

describe('summarise', () => {
  it('counts each token once, by its worst outcome', () => {
    const haus = [{ name: 'tokens.json', text: hausTokens }]
    const conversion = convert(haus, 'figma')
    const summary = summarise(conversion.set.tokens.map((t) => t.path), conversion.allLosses)
    expect(summary.tokens).toBe(conversion.set.tokens.length)
    expect(summary.exact + summary.changed + summary.dropped).toBe(summary.tokens)
    expect(summary.dropped).toBeGreaterThan(0)
  })
})

describe('compareFormats', () => {
  it('writes one token in all four formats, keeping its alias target', () => {
    const { set } = read([
      {
        name: 'theme.css',
        text: '@theme { --color-ink: #1a1a1a; --color-text: var(--color-ink); --text-fluid: clamp(1rem, 2vw, 2rem); }',
      },
    ])
    const text = set.tokens.find((t) => joinPath(t.path) === 'color.text')!
    const snippets = compareFormats(set, text)
    expect(snippets.map((s) => s.format)).toEqual(['dtcg', 'figma', 'tokens-studio', 'tailwind'])
    expect(snippets.find((s) => s.format === 'dtcg')!.text).toContain('{color.ink}')
    expect(snippets.find((s) => s.format === 'tailwind')!.text).toContain('--color-text: var(--color-ink);')

    const fluid = set.tokens.find((t) => joinPath(t.path) === 'text.fluid')!
    const figma = compareFormats(set, fluid).find((s) => s.format === 'figma')!
    expect(figma.text).toBeNull()
    expect(figma.losses[0].reason).toBe('unrepresentable-value')
  })

  it('handles every token in both samples without throwing', () => {
    for (const sample of SAMPLES) {
      const { set } = read(sample.documents)
      for (const token of set.tokens) expect(() => compareFormats(set, token)).not.toThrow()
    }
  })
})

describe('valueText', () => {
  it('shows references, raw CSS and literals as text', () => {
    expect(valueText({ kind: 'reference', ref: ['a', 'b'] })).toBe('{a.b}')
    expect(valueText({ kind: 'raw', text: 'clamp(1rem, 2vw, 2rem)' })).toBe('clamp(1rem, 2vw, 2rem)')
    expect(valueText({ kind: 'literal', value: { value: 4, unit: 'px' } })).toBe('4px')
    expect(valueText(undefined)).toBe('none')
  })
})
