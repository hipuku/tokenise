import {
  differenceCiede2000,
  formatCss,
  formatHex,
  formatHex8,
  inGamut,
  parse,
  toGamut,
  type Color,
} from 'culori'
import type { ColorValue, DimensionValue, DurationValue } from './types'

/* ─── Colour ──────────────────────────────────────────────────────────────────
   DTCG 2025.10 names its colour spaces after CSS Color 4. culori names them
   differently and scales some components differently (DTCG writes HSL and HWB
   percentages as 0–100, culori as 0–1), so the mapping is written out once here
   rather than guessed at each call site. */

interface SpaceMap {
  mode: string
  channels: string[]
  /** Multiply culori's channel by this to get DTCG's component. */
  scale?: number[]
}

const SPACES: Record<string, SpaceMap> = {
  srgb: { mode: 'rgb', channels: ['r', 'g', 'b'] },
  'srgb-linear': { mode: 'lrgb', channels: ['r', 'g', 'b'] },
  hsl: { mode: 'hsl', channels: ['h', 's', 'l'], scale: [1, 100, 100] },
  hwb: { mode: 'hwb', channels: ['h', 'w', 'b'], scale: [1, 100, 100] },
  lab: { mode: 'lab', channels: ['l', 'a', 'b'] },
  lch: { mode: 'lch', channels: ['l', 'c', 'h'] },
  oklab: { mode: 'oklab', channels: ['l', 'a', 'b'] },
  oklch: { mode: 'oklch', channels: ['l', 'c', 'h'] },
  'display-p3': { mode: 'p3', channels: ['r', 'g', 'b'] },
  'a98-rgb': { mode: 'a98', channels: ['r', 'g', 'b'] },
  'prophoto-rgb': { mode: 'prophoto', channels: ['r', 'g', 'b'] },
  rec2020: { mode: 'rec2020', channels: ['r', 'g', 'b'] },
  'xyz-d65': { mode: 'xyz65', channels: ['x', 'y', 'z'] },
  'xyz-d50': { mode: 'xyz50', channels: ['x', 'y', 'z'] },
}

const SPACE_BY_MODE = Object.fromEntries(Object.entries(SPACES).map(([space, m]) => [m.mode, space]))

const round = (n: number, places = 4) => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

function toCulori(value: ColorValue): Color | null {
  const map = SPACES[value.colorSpace]
  if (!map) return null
  const colour: Record<string, unknown> = { mode: map.mode }
  map.channels.forEach((channel, i) => {
    const component = value.components[i]
    if (component === 'none' || component === undefined) return
    colour[channel] = component / (map.scale?.[i] ?? 1)
  })
  if (value.alpha !== undefined && value.alpha !== 1) colour.alpha = value.alpha
  return colour as unknown as Color
}

function fromCulori(colour: Color): ColorValue | null {
  const space = SPACE_BY_MODE[colour.mode]
  if (!space) return null
  const map = SPACES[space]
  const record = colour as unknown as Record<string, number | undefined>
  const components = map.channels.map((channel, i) => {
    const v = record[channel]
    return v === undefined || Number.isNaN(v) ? ('none' as const) : round(v * (map.scale?.[i] ?? 1))
  })
  const value: ColorValue = { colorSpace: space, components }
  if (colour.alpha !== undefined && colour.alpha !== 1) value.alpha = round(colour.alpha)
  if (inSrgb(colour)) value.hex = formatHex(colour)
  return value
}

const inSrgb = inGamut('rgb')

/** Parse any CSS colour string into a DTCG colour, in the space it was written in. */
export function parseCssColour(text: string): ColorValue | null {
  const colour = parse(text.trim())
  return colour ? fromCulori(colour) : null
}

/** Is this object a DTCG 2025.10 colour value? */
export function isColorValue(value: unknown): value is ColorValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ColorValue).colorSpace === 'string' &&
    Array.isArray((value as ColorValue).components)
  )
}

/** A DTCG colour as a CSS colour string in its own space. */
export function colourToCss(value: ColorValue): string | null {
  const colour = toCulori(value)
  if (!colour) return null
  if (value.colorSpace === 'srgb') return colour.alpha !== undefined ? formatHex8(colour) : formatHex(colour)
  return formatCss(colour)
}

export interface SrgbResult {
  hex: string
  /** 0–1 channels, as Figma stores them. */
  rgba: { r: number; g: number; b: number; a: number }
  /** CIEDE2000 between the source and the sRGB result. 0 when nothing moved. */
  deltaE: number
  /** True when the colour was written in a space other than sRGB. */
  converted: boolean
}

/** A DTCG colour mapped into sRGB, clamping chroma in OKLCH when it is out of gamut. */
export function colourToSrgb(value: ColorValue): SrgbResult | null {
  const colour = toCulori(value)
  if (!colour) return null
  const mapped = toGamut('rgb', 'oklch')(colour)
  const deltaE = round(differenceCiede2000()(colour, mapped), 2)
  const alpha = colour.alpha ?? 1
  return {
    hex: alpha === 1 ? formatHex(mapped) : formatHex8({ ...mapped, alpha }),
    rgba: {
      r: round(mapped.r, 6),
      g: round(mapped.g, 6),
      b: round(mapped.b, 6),
      a: round(alpha, 6),
    },
    deltaE,
    converted: value.colorSpace !== 'srgb',
  }
}

/* ─── Dimension and duration ──────────────────────────────────────────────── */

const NUMBER = String.raw`(-?\d*\.?\d+(?:e-?\d+)?)`

export function parseDimension(text: string): DimensionValue | null {
  const match = new RegExp(`^${NUMBER}(px|rem)$`, 'i').exec(text.trim())
  if (!match) return null
  return { value: Number(match[1]), unit: match[2].toLowerCase() as 'px' | 'rem' }
}

/** A bare number is a zero-unit dimension only when it is zero. */
export function parseDimensionOrZero(text: string): DimensionValue | null {
  if (text.trim() === '0') return { value: 0, unit: 'px' }
  return parseDimension(text)
}

export function parseDuration(text: string): DurationValue | null {
  const match = new RegExp(`^${NUMBER}(ms|s)$`, 'i').exec(text.trim())
  if (!match) return null
  return { value: Number(match[1]), unit: match[2].toLowerCase() as 'ms' | 's' }
}

export function isDimensionValue(value: unknown): value is DimensionValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DimensionValue).value === 'number' &&
    ((value as DimensionValue).unit === 'px' || (value as DimensionValue).unit === 'rem')
  )
}

export function isDurationValue(value: unknown): value is DurationValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DurationValue).value === 'number' &&
    ((value as DurationValue).unit === 'ms' || (value as DurationValue).unit === 's')
  )
}

export const dimensionToCss = (d: DimensionValue) => `${d.value}${d.unit}`
export const durationToCss = (d: DurationValue) => `${d.value}${d.unit}`

export function dimensionToPx(d: DimensionValue, remBase: number): number {
  return d.unit === 'px' ? d.value : round(d.value * remBase, 4)
}

/* ─── Cubic bézier and font weight ────────────────────────────────────────── */

const NAMED_EASINGS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

export function parseCubicBezier(text: string): [number, number, number, number] | null {
  const trimmed = text.trim()
  if (NAMED_EASINGS[trimmed]) return NAMED_EASINGS[trimmed]
  const match = /^cubic-bezier\(([^)]*)\)$/i.exec(trimmed)
  if (!match) return null
  const parts = match[1].split(',').map((p) => Number(p.trim()))
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return null
  return parts as [number, number, number, number]
}

export const cubicBezierToCss = (b: readonly number[]) => `cubic-bezier(${b.join(', ')})`

export function isCubicBezier(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((v) => typeof v === 'number')
}

/** The keyword aliases DTCG 2025.10 allows for font weights. */
export const FONT_WEIGHT_NAMES: Record<string, number> = {
  thin: 100,
  hairline: 100,
  'extra-light': 200,
  'ultra-light': 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  'semi-bold': 600,
  'demi-bold': 600,
  bold: 700,
  'extra-bold': 800,
  'ultra-bold': 800,
  black: 900,
  heavy: 900,
  'extra-black': 950,
  'ultra-black': 950,
}

export function parseFontWeight(text: string): number | null {
  const trimmed = text.trim().toLowerCase()
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    return n >= 1 && n <= 1000 ? n : null
  }
  const named = FONT_WEIGHT_NAMES[trimmed.replace(/\s+/g, '-')]
  return named ?? null
}

/** Split a CSS font-family list, dropping quotes. */
export function parseFontFamily(text: string): string | string[] {
  const families = text
    .split(',')
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
  return families.length === 1 ? families[0] : families
}

export function fontFamilyToCss(value: string | readonly string[]): string {
  const list = typeof value === 'string' ? [value] : value
  return list.map((f) => (/\s/.test(f) && !/^[a-z-]+$/.test(f) ? `'${f}'` : f)).join(', ')
}

/* ─── References ──────────────────────────────────────────────────────────── */

/** `{group.token}` as a whole value. */
export function parseCurlyReference(text: string): string[] | null {
  const match = /^\{([^{}]+)\}$/.exec(text.trim())
  return match ? match[1].split('.') : null
}

/** Does the text contain a reference inside something larger, like `{a} * 2`? */
export const containsCurlyReference = (text: string) => /\{[^{}]+\}/.test(text)
