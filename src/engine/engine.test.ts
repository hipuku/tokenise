import { describe, expect, it } from 'vitest'
import { convert, read, write } from './convert'
import { detectFormat } from './detect'
import { ReadError, joinPath, type FormatId, type LossEntry, type TokenSet } from './types'
import modesText from './fixtures/modes.dtcg.json?raw'
import studioText from './fixtures/tokens-studio.json?raw'
import themeText from './fixtures/theme.css?raw'
import figmaLight from './fixtures/figma-Light.tokens.json?raw'
import figmaDark from './fixtures/figma-Dark.tokens.json?raw'
import hausText from '../samples/haus.tokens.json?raw'
import kernText from '../samples/kern-primitives.css?raw'

const SAMPLES: Record<string, string> = { 'haus.tokens.json': hausText, 'kern-primitives.css': kernText }
const sample = (file: string) => ({ name: file, text: SAMPLES[file] })

const modesDtcg = { name: 'tokens.resolver.json', text: modesText }
const studio = { name: 'tokens-studio.json', text: studioText }
const tailwind = { name: 'theme.css', text: themeText }
const figma = [
  { name: 'Light.tokens.json', text: figmaLight },
  { name: 'Dark.tokens.json', text: figmaDark },
]

const FORMATS: FormatId[] = ['dtcg', 'figma', 'tokens-studio', 'tailwind']

const reasons = (losses: LossEntry[]) => new Set(losses.map((l) => l.reason))
const lossFor = (losses: LossEntry[], token: string) => losses.filter((l) => l.token === token)
const token = (set: TokenSet, path: string) => set.tokens.find((t) => joinPath(t.path) === path)

describe('detectFormat', () => {
  it('tells the four formats apart', () => {
    expect(detectFormat([modesDtcg])).toBe('dtcg')
    expect(detectFormat([studio])).toBe('tokens-studio')
    expect(detectFormat([tailwind])).toBe('tailwind')
    expect(detectFormat(figma)).toBe('figma')
    expect(detectFormat([sample('haus.tokens.json')])).toBe('dtcg')
    expect(detectFormat([sample('kern-primitives.css')])).toBe('tailwind')
  })

  it('refuses input that is none of them', () => {
    expect(() => detectFormat([{ name: 'x', text: 'hello' }])).toThrow(ReadError)
    expect(() => detectFormat([{ name: 'x', text: '{ "a": 1 }' }])).toThrow(ReadError)
  })

  it('caps the input size before parsing', () => {
    expect(() => read([{ name: 'big.json', text: `{"a":"${'x'.repeat(600_000)}"}` }])).toThrow(/limit/)
  })
})

describe('DTCG', () => {
  it('reads a resolver modifier as modes', () => {
    const { set } = read([modesDtcg])
    expect(set.modes).toEqual(['light', 'dark'])
    const text = token(set, 'color.text')!
    expect(text.values.light).toEqual({ kind: 'reference', ref: ['color', 'ink'] })
    expect(text.values.dark).toEqual({ kind: 'reference', ref: ['color', 'paper'] })
    expect(text.description).toBe('Body text')
  })

  it('round-trips through itself with no losses', () => {
    const first = convert([modesDtcg], 'dtcg')
    expect(first.allLosses).toEqual([])
    const second = convert(first.files.map((f) => ({ name: f.name, text: f.text })), 'dtcg')
    expect(second.allLosses).toEqual([])
    expect(second.set).toEqual(first.set)
  })

  it('reports every leniency in a pre-2025.10 file', () => {
    const { set, losses } = read([sample('haus.tokens.json')])
    expect(reasons(losses)).toEqual(new Set(['lenient-read']))
    expect(lossFor(losses, 'color.aronia.500')[0].detail).toMatch(/CSS string/)
    // A string colour is still read as a colour, in the space it was written in.
    const aronia = token(set, 'color.aronia.500')!.values.default
    expect(aronia).toMatchObject({ kind: 'literal', value: { colorSpace: 'oklch', components: [0.52, 0.138, 300] } })
  })

  it('says why a CSS expression has no type', () => {
    const { allLosses } = convert([sample('haus.tokens.json')], 'dtcg')
    const radius = lossFor(allLosses, 'semantic.color.radius-control')
    expect(radius.map((l) => l.reason)).toContain('dropped-type')
  })
})

describe('Tokens Studio', () => {
  it('reads themes as modes and legacy types as DTCG types', () => {
    const { set, losses } = read([studio])
    expect(set.modes).toEqual(['light', 'dark'])
    expect(token(set, 'radius.sm')).toMatchObject({ type: 'dimension', sourceType: 'borderRadius' })
    expect(token(set, 'radius.sm')!.values.light).toEqual({ kind: 'literal', value: { value: 4, unit: 'px' } })
    expect(token(set, 'colors.surface')!.values.dark).toMatchObject({ kind: 'literal', value: { hex: '#121213' } })
    expect(lossFor(losses, 'spacing.double')[0].reason).toBe('unrepresentable-value')
  })

  it('keeps its own types when written back', () => {
    const { files } = convert([studio], 'tokens-studio')
    const out = JSON.parse(files[0].text)
    expect(out.global.radius.sm.type).toBe('borderRadius')
    expect(out.dark.colors.surface.value).toBe('#121213')
    expect(out.$themes.map((t: { name: string }) => t.name)).toEqual(['light', 'dark'])
  })
})

describe('Tailwind', () => {
  it('reads namespaces, companions, references and a data-theme mode', () => {
    const { set } = read([tailwind])
    expect(set.modes).toEqual(['default', 'dark'])
    expect(token(set, 'color.text')!.values.dark).toEqual({ kind: 'reference', ref: ['color', 'paper'] })
    expect(token(set, 'spacing.DEFAULT')!.type).toBe('dimension')
    expect(token(set, 'text.body--line-height')).toMatchObject({ type: 'number' })
    expect(token(set, 'ease.standard')!.values.default).toEqual({ kind: 'literal', value: [0.2, 0, 0, 1] })
    expect(token(set, 'text.fluid')!.values.default).toEqual({ kind: 'raw', text: 'clamp(1rem, 2vw, 2rem)' })
  })

  it('round-trips a stylesheet it wrote with no losses', () => {
    const first = convert([tailwind], 'tailwind')
    expect(first.allLosses).toEqual([])
    expect(first.files[0].text).toContain('--spacing: 0.25rem;')
    expect(first.files[0].text).toContain('[data-theme="dark"] {\n  --color-text: var(--color-paper);\n}')
    const second = convert([{ name: 'theme.css', text: first.files[0].text }], 'tailwind')
    expect(second.set).toEqual(first.set)
  })

  it('round-trips kern with no losses', () => {
    expect(convert([sample('kern-primitives.css')], 'tailwind').allLosses).toEqual([])
  })

  it('writes modes with the chosen selector', () => {
    const { set } = read([modesDtcg])
    const cls = write(set, 'tailwind', { remBase: 16, tailwindModeSelector: 'class' })
    expect(cls.files[0].text).toContain('.dark {')
    const media = write(set, 'tailwind', { remBase: 16, tailwindModeSelector: 'media' })
    expect(media.files[0].text).toContain('@media (prefers-color-scheme: dark) {')
  })

  it('drops a mode prefers-color-scheme cannot name', () => {
    const set: TokenSet = {
      modes: ['default', 'brand'],
      tokens: [
        {
          path: ['color', 'a'],
          type: 'color',
          values: {
            default: { kind: 'literal', value: { colorSpace: 'srgb', components: [1, 0, 0], hex: '#ff0000' } },
            brand: { kind: 'literal', value: { colorSpace: 'srgb', components: [0, 0, 1], hex: '#0000ff' } },
          },
        },
      ],
    }
    const { losses } = write(set, 'tailwind', { remBase: 16, tailwindModeSelector: 'media' })
    expect(losses.map((l) => l.reason)).toEqual(['dropped-mode'])
  })
})

describe('Figma', () => {
  it('reads one file per mode, named by the file', () => {
    const { set } = read(figma)
    expect(set.modes).toEqual(['Light', 'Dark'])
    expect(token(set, 'color.ink')!.extensions).toMatchObject({ 'com.figma.variableId': 'VariableID:1:1' })
  })

  it('writes one file per mode and round-trips', () => {
    const first = convert(figma, 'figma')
    expect(first.files.map((f) => f.name)).toEqual(['Light.tokens.json', 'Dark.tokens.json'])
    expect(first.allLosses).toEqual([])
    const second = convert(first.files, 'figma')
    expect(second.set).toEqual(first.set)
  })
})

describe('loss report', () => {
  const dtcgToFigma = convert([modesDtcg], 'figma')
  const dtcgToTailwind = convert([modesDtcg], 'tailwind')
  const dtcgToStudio = convert([modesDtcg], 'tokens-studio')

  it('reports a composite Figma cannot hold', () => {
    expect(lossFor(dtcgToFigma.allLosses, 'type.body')[0].reason).toBe('dropped-composite')
  })

  it('reports a type Figma has no variable for', () => {
    expect(lossFor(dtcgToFigma.allLosses, 'motion.standard')[0].reason).toBe('dropped-type')
  })

  it('writes duration to Figma in seconds and font weight as a number, the forms its import accepts', () => {
    const set: TokenSet = {
      modes: ['default'],
      tokens: [
        { path: ['motion', 'fast'], type: 'duration', values: { default: { kind: 'literal', value: { value: 150, unit: 'ms' } } } },
        { path: ['font', 'bold'], type: 'fontWeight', values: { default: { kind: 'literal', value: 700 } } },
      ],
    }
    const { files, losses } = write(set, 'figma')
    const json = JSON.parse(files[0].text)
    expect(json.motion.fast).toEqual({ $type: 'duration', $value: { value: 0.15, unit: 's' } })
    expect(json.font.bold).toEqual({ $type: 'number', $value: 700 })
    expect(losses).toEqual([])
  })

  it('reports rem written as px, at the chosen base', () => {
    const entry = lossFor(dtcgToFigma.allLosses, 'space.md')[0]
    expect(entry.reason).toBe('converted-unit')
    expect(entry.detail).toContain('16px')
    const at10 = convert([modesDtcg], 'figma', { remBase: 10, tailwindModeSelector: 'data-theme' })
    expect(lossFor(at10.allLosses, 'space.md')[0].detail).toContain('10px')
  })

  it('reports an out-of-gamut colour with its ΔE', () => {
    const entry = lossFor(dtcgToFigma.allLosses, 'color.accent')[0]
    expect(entry.reason).toBe('converted-colour')
    expect(entry.detail).toMatch(/ΔE \d/)
  })

  it('reports a typography split into Tailwind companions', () => {
    expect(lossFor(dtcgToTailwind.allLosses, 'type.body').map((l) => l.reason)).toContain('split-composite')
    expect(dtcgToTailwind.files[0].text).toContain('--text-type-body--line-height: 1.5;')
  })

  it('reports metadata a format has no field for', () => {
    expect(lossFor(dtcgToTailwind.allLosses, 'color.text')[0].reason).toBe('dropped-metadata')
  })

  it('reports a computed CSS value JSON cannot hold', () => {
    const { allLosses } = convert([tailwind], 'dtcg')
    expect(lossFor(allLosses, 'text.fluid')[0].reason).toBe('unrepresentable-value')
  })

  it('reports an alias resolved because its target was dropped', () => {
    const set: TokenSet = {
      modes: ['default'],
      tokens: [
        { path: ['motion', 'fast'], type: 'duration', values: { default: { kind: 'literal', value: { value: 100, unit: 'ms' } } } },
        { path: ['motion', 'alias'], type: 'number', values: { default: { kind: 'reference', ref: ['size', 'missing'] } } },
      ],
    }
    const { losses } = write(set, 'figma')
    expect(lossFor(losses, 'motion.alias')[0].detail).toMatch(/does not resolve/)
  })

  it('reports a name that had to change', () => {
    const set: TokenSet = {
      modes: ['default'],
      tokens: [{ path: ['color', 'Brand Primary'], type: 'color', values: { default: { kind: 'literal', value: { colorSpace: 'srgb', components: [1, 0, 0], hex: '#ff0000' } } } }],
    }
    const { losses, files } = write(set, 'tailwind')
    expect(losses[0]).toMatchObject({ reason: 'renamed', detail: 'Written as --color-brand-primary.' })
    expect(files[0].text).toContain('--color-brand-primary: #ff0000;')
  })

  it('writes duration and cubic bezier to Tokens Studio as other, and says so', () => {
    expect(lossFor(dtcgToStudio.allLosses, 'motion.standard')[0].reason).toBe('dropped-type')
  })

  it('never reports a loss without a reason it can name', () => {
    for (const source of [[modesDtcg], [studio], [tailwind], figma]) {
      for (const target of FORMATS) {
        for (const entry of convert(source, target).allLosses) {
          expect(entry.detail.length).toBeGreaterThan(10)
        }
      }
    }
  })
})
