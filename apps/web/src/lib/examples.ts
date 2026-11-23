import type { FormatId } from '@/engine/types'
import { colourToCss } from '@/engine/values'
import type { ColorValue } from '@/engine/types'
import type { FormatSnippet } from './compare'

/**
 * The examples Compare offers. Each was picked because the four formats fail it
 * differently, and each was checked against the formats' own documentation:
 *
 * - Typography: Figma variables have no composite type (type styles are not in
 *   the variables export); Tailwind v4 writes a size with `--line-height`,
 *   `--letter-spacing` and `--font-weight` companions but family lives in the
 *   separate `--font-*` namespace.
 * - Shadow: Figma again has no variable for it; Tokens Studio's boxShadow and
 *   Tailwind's `--shadow-*` both hold every part.
 * - Wide-gamut colour: Figma variables and Tokens Studio's hex strings are sRGB,
 *   so a Display P3 colour is clamped; CSS, and so Tailwind, keeps color().
 * - Rem spacing: Figma variables have no units, so rem is multiplied out to px.
 * - Font stack: a Figma string variable holds one family, not a fallback list.
 * - Easing curve: neither Figma nor Tokens Studio has a curve type; Tokens
 *   Studio can only file it as "other".
 * - Transition: a composite only CSS can spell in one value.
 * - Gradient: in DTCG, and none of the other three has a variable for it.
 * - Modes: every format holds light and dark, each its own way: a resolver
 *   modifier, a file per mode, a set per theme, a selector block.
 * - Reference: every format keeps an alias as an alias.
 * - Raw expression: a clamp() is CSS. JSON formats with typed values cannot
 *   hold it, so this one starts from Tailwind and is measured against it.
 */

export interface ExampleRow {
  key: string
  label: string
}

export interface Example {
  id: string
  label: string
  source: string
  /** The name the source is read under, when the name matters to detection. */
  fileName?: string
  /** The token to show, by path; the first token when omitted. */
  token?: string
  /** The column the others are measured against: DTCG unless DTCG cannot hold the example. */
  standard?: FormatId
  rows: ExampleRow[]
  /** Each row's value as that format wrote it, or null where it has no place for it. */
  /** Folds a value to the form the table compares on, when formats spell the same thing differently. */
  compareAs?: (value: string) => string
  valuesOf: (snippet: FormatSnippet) => Record<string, string | null>
}

const dim = (v: unknown): string =>
  v && typeof v === 'object' && 'value' in v && 'unit' in v ? `${v.value}${v.unit}` : String(v)

const colour = (v: unknown): string =>
  v && typeof v === 'object' && 'colorSpace' in v ? (colourToCss(v as ColorValue) ?? JSON.stringify(v)) : String(v)

/** The first token's value in a JSON snippet: `$value` for DTCG and Figma, `value` for Tokens Studio. */
function leafValue(text: string): unknown {
  const leaf = Object.values(JSON.parse(text) as Record<string, Record<string, unknown>>)[0]
  return leaf.$value ?? leaf.value
}

const cubic = (v: unknown): string => (Array.isArray(v) && v.length === 4 ? `cubic-bezier(${v.join(', ')})` : String(v))

/** A single DTCG-style value as the short text the table compares on. */
function literal(v: unknown): string {
  if (Array.isArray(v) && v.every((x) => typeof x === 'number') && v.length === 4) return cubic(v)
  if (Array.isArray(v)) return v.join(', ')
  if (v && typeof v === 'object' && 'colorSpace' in v) return colour(v)
  return dim(v)
}

/** The value of the one custom property in a Tailwind snippet. */
const cssValue = (text: string) => /--[\w-]+:\s*([^;]+);/.exec(text)?.[1].trim() ?? null

const VALUE_ROW: ExampleRow[] = [{ key: 'value', label: 'Value' }]

/** A one-value token: every format's value read the plain way. */
const single = (s: FormatSnippet) =>
  read(VALUE_ROW, s, {
    dtcg: (text) => ({ value: literal(leafValue(text)) }),
    figma: (text) => ({ value: literal(leafValue(text)) }),
    'tokens-studio': (text) => ({ value: String(leafValue(text)) }),
    tailwind: (text) => ({ value: cssValue(text) }),
  })

/** A multi-mode snippet split at its `// name` headers, in mode order. */
const sections = (text: string) => text.split(/\n\n(?=\/\/ )/).map((part) => part.replace(/^\/\/ .*\n/, ''))

const MODE_ROWS: ExampleRow[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]

const perMode = (text: string, valueOf: (part: string) => string | null) =>
  Object.fromEntries(sections(text).map((part, i) => [MODE_ROWS[i].key, valueOf(part)]))

const empty = (rows: ExampleRow[]) => Object.fromEntries(rows.map((r) => [r.key, null])) as Record<string, string | null>

function read(rows: ExampleRow[], snippet: FormatSnippet, by: Partial<Record<FormatId, (text: string) => Record<string, string | null>>>) {
  const reader = by[snippet.format]
  if (!snippet.text || !reader) return empty(rows)
  try {
    return { ...empty(rows), ...reader(snippet.text) }
  } catch {
    return empty(rows)
  }
}

const TYPOGRAPHY_ROWS: ExampleRow[] = [
  { key: 'fontFamily', label: 'Font family' },
  { key: 'fontSize', label: 'Font size' },
  { key: 'fontWeight', label: 'Font weight' },
  { key: 'lineHeight', label: 'Line height' },
  { key: 'letterSpacing', label: 'Letter spacing' },
]

const typographyJson = (text: string) => {
  const v = leafValue(text) as Record<string, unknown>
  return Object.fromEntries(
    TYPOGRAPHY_ROWS.filter((r) => v[r.key] !== undefined).map((r) => {
      const x = v[r.key]
      return [r.key, Array.isArray(x) ? x.join(', ') : dim(x)]
    }),
  )
}

const SHADOW_ROWS: ExampleRow[] = [
  { key: 'offsetX', label: 'Offset x' },
  { key: 'offsetY', label: 'Offset y' },
  { key: 'blur', label: 'Blur' },
  { key: 'spread', label: 'Spread' },
  { key: 'color', label: 'Colour' },
]

const TRANSITION_ROWS: ExampleRow[] = [
  { key: 'duration', label: 'Duration' },
  { key: 'delay', label: 'Delay' },
  { key: 'timingFunction', label: 'Timing function' },
]

export const EXAMPLES: Example[] = [
  {
    id: 'typography',
    label: 'Typography',
    rows: TYPOGRAPHY_ROWS,
    source: `{
  "text": {
    "heading": {
      "$type": "typography",
      "$value": {
        "fontFamily": ["Inter", "sans-serif"],
        "fontSize": { "value": 2, "unit": "rem" },
        "fontWeight": 700,
        "lineHeight": 1.1,
        "letterSpacing": { "value": -0.02, "unit": "rem" }
      }
    }
  }
}`,
    valuesOf: (s) =>
      read(TYPOGRAPHY_ROWS, s, {
        dtcg: typographyJson,
        'tokens-studio': typographyJson,
        tailwind: (text) => {
          const at = (suffix: string) => new RegExp(`--text-[\\w-]+?${suffix}:\\s*([^;]+);`).exec(text)?.[1].trim() ?? null
          return {
            fontSize: at(''),
            fontWeight: at('--font-weight'),
            lineHeight: at('--line-height'),
            letterSpacing: at('--letter-spacing'),
          }
        },
      }),
  },
  {
    id: 'shadow',
    label: 'Shadow',
    rows: SHADOW_ROWS,
    source: `{
  "elevation": {
    "card": {
      "$type": "shadow",
      "$value": {
        "color": { "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.2 },
        "offsetX": { "value": 0, "unit": "px" },
        "offsetY": { "value": 4, "unit": "px" },
        "blur": { "value": 12, "unit": "px" },
        "spread": { "value": 0, "unit": "px" }
      }
    }
  }
}`,
    valuesOf: (s) =>
      read(SHADOW_ROWS, s, {
        dtcg: (text) => {
          const v = leafValue(text) as Record<string, unknown>
          return { offsetX: dim(v.offsetX), offsetY: dim(v.offsetY), blur: dim(v.blur), spread: dim(v.spread), color: colour(v.color) }
        },
        'tokens-studio': (text) => {
          const v = leafValue(text) as Record<string, string>
          return { offsetX: v.x, offsetY: v.y, blur: v.blur, spread: v.spread, color: v.color }
        },
        tailwind: (text): Record<string, string | null> => {
          const parts = /--shadow-[\w-]+:\s*([^;]+);/.exec(text)?.[1].trim().split(/\s+/)
          if (!parts || parts.length < 5) return {}
          const [offsetX, offsetY, blur, spread, color] = parts
          return { offsetX, offsetY, blur, spread, color }
        },
      }),
  },
  {
    id: 'colour',
    label: 'Wide-gamut colour',
    rows: VALUE_ROW,
    source: `{
  "color": {
    "accent": {
      "$type": "color",
      "$value": { "colorSpace": "display-p3", "components": [1, 0.3, 0.1] }
    }
  }
}`,
    valuesOf: (s) =>
      read(VALUE_ROW, s, {
        dtcg: (text) => ({ value: colour(leafValue(text)) }),
        figma: (text) => ({ value: (leafValue(text) as { hex: string }).hex }),
        'tokens-studio': (text) => ({ value: String(leafValue(text)) }),
        tailwind: (text) => ({ value: cssValue(text) }),
      }),
  },
  {
    id: 'rem',
    label: 'Rem spacing',
    rows: VALUE_ROW,
    source: `{
  "space": {
    "lg": { "$type": "dimension", "$value": { "value": 1.5, "unit": "rem" } }
  }
}`,
    valuesOf: single,
  },
  {
    id: 'font-stack',
    label: 'Font stack',
    rows: VALUE_ROW,
    source: `{
  "font": {
    "body": { "$type": "fontFamily", "$value": ["Inter", "Helvetica", "sans-serif"] }
  }
}`,
    valuesOf: single,
  },
  {
    id: 'easing',
    label: 'Easing curve',
    rows: VALUE_ROW,
    source: `{
  "ease": {
    "out": { "$type": "cubicBezier", "$value": [0.2, 0, 0, 1] }
  }
}`,
    valuesOf: single,
  },
  {
    id: 'transition',
    label: 'Transition',
    rows: TRANSITION_ROWS,
    source: `{
  "motion": {
    "fade": {
      "$type": "transition",
      "$value": {
        "duration": { "value": 200, "unit": "ms" },
        "delay": { "value": 0, "unit": "ms" },
        "timingFunction": [0.4, 0, 0.2, 1]
      }
    }
  }
}`,
    valuesOf: (s) =>
      read(TRANSITION_ROWS, s, {
        dtcg: (text) => {
          const v = leafValue(text) as Record<string, unknown>
          return { duration: dim(v.duration), delay: dim(v.delay), timingFunction: cubic(v.timingFunction) }
        },
        tailwind: (text): Record<string, string | null> => {
          const m = /^(\S+) (cubic-bezier\([^)]*\)) (\S+)$/.exec(cssValue(text) ?? '')
          return m ? { duration: m[1], timingFunction: m[2], delay: m[3] } : {}
        },
      }),
  },
  {
    id: 'gradient',
    label: 'Gradient',
    rows: [{ key: 'stops', label: 'Stops' }],
    source: `{
  "background": {
    "hero": {
      "$type": "gradient",
      "$value": [
        { "color": { "colorSpace": "srgb", "components": [1, 0.37, 0.26] }, "position": 0 },
        { "color": { "colorSpace": "srgb", "components": [0.36, 0.25, 0.8] }, "position": 1 }
      ]
    }
  }
}`,
    valuesOf: (s) =>
      read([{ key: 'stops', label: 'Stops' }], s, {
        dtcg: (text) => ({
          stops: (leafValue(text) as { color: unknown; position: number }[])
            .map((stop) => `${colour(stop.color)} ${stop.position * 100}%`)
            .join(', '),
        }),
      }),
  },
  {
    id: 'modes',
    label: 'Light and dark',
    rows: MODE_ROWS,
    fileName: 'tokens.resolver.json',
    source: `{
  "version": "2025.10",
  "sets": {
    "base": {
      "sources": [
        { "color": { "surface": { "$type": "color", "$value": { "colorSpace": "srgb", "components": [1, 1, 1] } } } }
      ]
    }
  },
  "modifiers": {
    "mode": {
      "contexts": {
        "light": [],
        "dark": [
          { "color": { "surface": { "$type": "color", "$value": { "colorSpace": "srgb", "components": [0.07, 0.07, 0.07] } } } }
        ]
      },
      "default": "light"
    }
  },
  "resolutionOrder": [{ "$ref": "#/sets/base" }, { "$ref": "#/modifiers/mode" }]
}`,
    valuesOf: (s) =>
      read(MODE_ROWS, s, {
        dtcg: (text) => perMode(text, (part) => colour(leafValue(part))),
        figma: (text) => perMode(text, (part) => colour(leafValue(part))),
        'tokens-studio': (text) => perMode(text, (part) => String(leafValue(part))),
        tailwind: (text) => ({
          light: /@theme \{ --[\w-]+:\s*([^;]+);/.exec(text)?.[1] ?? null,
          dark: /\[data-theme="dark"\] \{ --[\w-]+:\s*([^;]+);/.exec(text)?.[1] ?? null,
        }),
      }),
  },
  {
    id: 'reference',
    label: 'Reference',
    rows: VALUE_ROW,
    token: 'color.button',
    source: `{
  "color": {
    "brand": { "$type": "color", "$value": { "colorSpace": "srgb", "components": [0.88, 0.37, 0.26] } },
    "button": { "$type": "color", "$value": "{color.brand}" }
  }
}`,
    valuesOf: (s) =>
      read(VALUE_ROW, s, {
        dtcg: (text) => ({ value: String(leafValue(text)) }),
        figma: (text) => ({ value: String(leafValue(text)) }),
        'tokens-studio': (text) => ({ value: String(leafValue(text)) }),
        tailwind: (text) => ({ value: cssValue(text) }),
      }),
    // var(--color-brand) is CSS for {color.brand}: the same reference.
    compareAs: (value) => value.replace(/^var\(--color-([\w-]+)\)$/, '{color.$1}'),
  },
  {
    id: 'raw',
    label: 'Raw expression',
    rows: VALUE_ROW,
    fileName: 'theme.css',
    standard: 'tailwind',
    source: `@theme {
  --text-fluid: clamp(1rem, 2vw + 1rem, 2rem);
}`,
    valuesOf: single,
  },
]
