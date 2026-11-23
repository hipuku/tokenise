import { Losses, mergeTokens, type InputDocument } from './document'
import { indexTokens, resolveValue, sameValue, valueIn } from './resolve'
import {
  joinPath,
  type Literal,
  type Token,
  type TokenSet,
  type TokenType,
  type TokenValue,
  type WriteOptions,
  type WriteResult,
} from './types'
import {
  colourToCss,
  cubicBezierToCss,
  dimensionToCss,
  durationToCss,
  fontFamilyToCss,
  isColorValue,
  isCubicBezier,
  isDimensionValue,
  isDurationValue,
  parseCssColour,
  parseCubicBezier,
  parseCurlyReference,
  parseDimensionOrZero,
  parseDuration,
  parseFontFamily,
  parseFontWeight,
} from './values'

/* ─────────────────────────────────────────────────────────────────────────────
   Tailwind v4 keeps its tokens as custom properties in `@theme` blocks, named by
   namespace: `--color-*`, `--text-*`, `--radius-*`. It has no mode primitive, so
   a dark theme is the same properties redefined under a selector.

   The reader is a scanner, not a CSS parser, for the same reason specifi's
   stylesheet extraction is: it needs declarations and the block each sits in,
   nothing more. It tracks brace depth, strips comments, and reads `@theme`,
   `:root`, and the selectors that mean a mode.
   ────────────────────────────────────────────────────────────────────────── */

/** Namespaces, longest first so `--font-weight-*` is not read as `--font-*`. */
const NAMESPACES: [string, TokenType | null][] = [
  ['inset-shadow', 'shadow'],
  ['drop-shadow', 'shadow'],
  ['font-weight', 'fontWeight'],
  ['perspective', 'dimension'],
  ['breakpoint', 'dimension'],
  ['container', 'dimension'],
  ['tab-size', 'number'],
  ['duration', 'duration'],
  ['tracking', 'dimension'],
  ['leading', 'number'],
  ['spacing', 'dimension'],
  ['animate', null],
  ['aspect', null],
  ['radius', 'dimension'],
  ['shadow', 'shadow'],
  ['color', 'color'],
  ['blur', 'dimension'],
  ['zoom', null],
  ['text', 'dimension'],
  ['font', 'fontFamily'],
  ['ease', 'cubicBezier'],
]

export const CUSTOM_PROPERTY = 'custom property'

/**
 * `--spacing` alone is a token and `--spacing-tight` another, so in a tree
 * `spacing` would be both a token and a group. The bare one is read as
 * `spacing.DEFAULT`, Tailwind v3's name for the same thing, and written back
 * without the segment.
 */
const DEFAULT_SEGMENT = 'DEFAULT'

interface Declaration {
  name: string
  value: string
  mode: string
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
}

/** The mode a block's prelude selects, or undefined when it is not a token block. */
function modeOf(prelude: string, outer: string | undefined): string | undefined {
  const p = prelude.trim()
  if (/^@theme\b/.test(p)) return 'default'
  if (p === ':root' || p === 'html') return outer ?? 'default'
  const dataTheme = /^(?::root|html)?\[data-theme=["']?([\w-]+)["']?\]$/.exec(p)
  if (dataTheme) return dataTheme[1]
  const cls = /^(?::root|html)?\.([\w-]+)$/.exec(p)
  if (cls) return cls[1]
  const media = /^@media\s*\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)$/.exec(p)
  if (media) return media[1]
  return undefined
}

function scan(css: string): { declarations: Declaration[]; inline: boolean } {
  const text = stripComments(css)
  const declarations: Declaration[] = []
  let inline = false
  const stack: (string | undefined)[] = []
  let buffer = ''
  let quote: string | null = null
  let parens = 0

  const flushDeclaration = () => {
    const mode = stack[stack.length - 1]
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]*?)\s*$/.exec(buffer)
    if (mode && match && !match[1].endsWith('-*')) declarations.push({ name: match[1], value: match[2], mode })
    buffer = ''
  }

  for (const char of text) {
    if (quote) {
      buffer += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }
    if (char === '(') parens++
    if (char === ')') parens--
    if (char === '{' && parens === 0) {
      const prelude = buffer.trim()
      if (/^@theme\b.*\binline\b/.test(prelude)) inline = true
      stack.push(modeOf(prelude, stack[stack.length - 1]))
      buffer = ''
    } else if (char === '}' && parens === 0) {
      flushDeclaration()
      stack.pop()
    } else if (char === ';' && parens === 0) {
      flushDeclaration()
    } else {
      buffer += char
    }
  }
  return { declarations, inline }
}

/** `--color-flare-dark` → namespace `color`, path `['color', 'flare-dark']`. */
function nameToPath(name: string): { path: string[]; type: TokenType | null; namespace?: string } {
  const bare = name.slice(2)
  for (const [namespace, type] of NAMESPACES) {
    if (bare === namespace) return { path: [namespace, DEFAULT_SEGMENT], type, namespace }
    if (bare.startsWith(`${namespace}-`)) {
      const rest = bare.slice(namespace.length + 1)
      // `--text-sm--line-height` and its siblings: companions of a size.
      const companion = namespace === 'text' ? /^(.+)--(line-height|letter-spacing|font-weight)$/.exec(rest) : null
      if (companion) {
        const type = companion[2] === 'font-weight' ? 'fontWeight' : companion[2] === 'line-height' ? 'number' : 'dimension'
        return { path: [namespace, rest], type, namespace }
      }
      return { path: [namespace, rest], type, namespace }
    }
  }
  return { path: [bare], type: null }
}

function readValue(raw: string, type: TokenType | null, names: Map<string, string[]>): { value: TokenValue; type: TokenType | null } {
  const varRef = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw)
  if (varRef) {
    const target = names.get(varRef[1])
    if (target) return { value: { kind: 'reference', ref: target }, type }
    return { value: { kind: 'raw', text: raw }, type }
  }

  const inferred =
    type ??
    (parseCssColour(raw)
      ? 'color'
      : parseDimensionOrZero(raw) && raw.trim() !== '0'
        ? 'dimension'
        : parseDuration(raw)
          ? 'duration'
          : /^-?\d*\.?\d+$/.test(raw.trim())
            ? 'number'
            : null)
  const literal = (value: Literal): { value: TokenValue; type: TokenType | null } => ({
    value: { kind: 'literal', value },
    type: inferred,
  })

  switch (inferred) {
    case 'color': {
      const colour = parseCssColour(raw)
      if (colour) return literal(colour)
      break
    }
    case 'dimension': {
      const dimension = parseDimensionOrZero(raw)
      if (dimension) return literal(dimension)
      break
    }
    case 'duration': {
      const duration = parseDuration(raw)
      if (duration) return literal(duration)
      break
    }
    case 'cubicBezier': {
      const bezier = parseCubicBezier(raw)
      if (bezier) return literal(bezier)
      break
    }
    case 'fontWeight': {
      const weight = parseFontWeight(raw)
      if (weight !== null) return literal(weight)
      break
    }
    case 'fontFamily':
      return literal(parseFontFamily(raw))
    case 'number':
      if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return literal(Number(raw))
      break
  }
  return { value: { kind: 'raw', text: raw }, type: inferred }
}

export function readTailwind(documents: readonly InputDocument[]): TokenSet {
  const declarations = documents.flatMap((d) => scan(d.text).declarations)
  const names = new Map(declarations.map((d) => [d.name, nameToPath(d.name).path]))
  const modes = ['default', ...new Set(declarations.map((d) => d.mode).filter((m) => m !== 'default'))]
  const merged = new Map<string, Token>()

  for (const declaration of declarations) {
    const { path, type: namespaceType, namespace } = nameToPath(declaration.name)
    const { value, type } = readValue(declaration.value, namespaceType, names)
    const token: Token = { path, type, values: { [declaration.mode]: value } }
    if (!namespace) token.sourceType = CUSTOM_PROPERTY
    mergeTokens(merged, token)
  }

  return { modes, tokens: [...merged.values()] }
}

export const looksLikeTailwind = (text: string) => /@theme\b/.test(text) || /^\s*(:root|\[data-theme)/m.test(text) || /^\s*--[\w-]+\s*:/m.test(text)

/* ─── Writing ─────────────────────────────────────────────────────────────── */

/** Group names the other formats use for what Tailwind calls a namespace. */
const NAMESPACE_ALIASES: Record<string, string> = {
  color: 'color', colors: 'color', colour: 'color', colours: 'color',
  spacing: 'spacing', space: 'spacing', size: 'spacing', sizing: 'spacing',
  radius: 'radius', radii: 'radius', borderradius: 'radius', 'border-radius': 'radius',
  shadow: 'shadow', shadows: 'shadow', boxshadow: 'shadow', elevation: 'shadow',
  ease: 'ease', easing: 'ease', easings: 'ease',
  font: 'font', fonts: 'font', fontfamily: 'font', fontfamilies: 'font', 'font-family': 'font',
  'font-weight': 'font-weight', fontweight: 'font-weight', fontweights: 'font-weight',
  text: 'text', 'font-size': 'text', fontsize: 'text', fontsizes: 'text',
  tracking: 'tracking', letterspacing: 'tracking', 'letter-spacing': 'tracking',
  leading: 'leading', lineheight: 'leading', lineheights: 'leading', 'line-height': 'leading',
  breakpoint: 'breakpoint', breakpoints: 'breakpoint', screens: 'breakpoint',
  duration: 'duration', durations: 'duration',
  blur: 'blur', container: 'container', perspective: 'perspective',
}

/** Namespaces Tailwind generates utilities from. Anything else is a plain custom property in `:root`. */
const THEME_NAMESPACES = new Set(NAMESPACES.map(([n]) => n).filter((n) => n !== 'duration'))

function sanitise(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function propertyName(token: Token): { name: string; inTheme: boolean; renamed: boolean } {
  // A plain custom property read from a stylesheet keeps its own name.
  if (token.sourceType === CUSTOM_PROPERTY) {
    const joined = token.path.join('-')
    const cleaned = token.path.map(sanitise).filter(Boolean).join('-')
    return { name: `--${cleaned}`, inTheme: false, renamed: cleaned !== joined }
  }
  const [first, ...rest] = token.path
  const found = NAMESPACE_ALIASES[first.toLowerCase()]
  const expected = NAMESPACES.find(([n]) => n === found)?.[1]
  // A group named like a namespace only counts when its token is that namespace's type:
  // haus's `font.lineHeight.tight` is a number, not a font family.
  const alias = found && (expected === undefined || expected === token.type || found === 'text') ? found : undefined
  const namespace = alias
  const segments = (alias ? rest : token.path).filter((s, i, all) => !(s === DEFAULT_SEGMENT && i === all.length - 1))
  const joined = (alias ? rest : token.path).filter((s) => s !== DEFAULT_SEGMENT).join('-')
  const cleaned = segments.map(sanitise).filter(Boolean).join('-')
  const name = `--${namespace ? (cleaned ? `${namespace}-${cleaned}` : namespace) : cleaned}`
  return { name, inTheme: Boolean(namespace && THEME_NAMESPACES.has(namespace)), renamed: cleaned !== joined }
}

function cssValue(
  token: Token,
  value: TokenValue,
  mode: string,
  set: TokenSet,
  names: Map<string, string>,
  losses: Losses,
): string | undefined {
  if (value.kind === 'raw') return value.text
  if (value.kind === 'reference') {
    const target = names.get(joinPath(value.ref))
    if (target) return `var(${target})`
    const resolved = resolveValue(value, mode, set, indexTokens(set))
    if (!resolved.value) {
      losses.add('unrepresentable-value', token.path, `{${joinPath(value.ref)}} does not resolve (${resolved.problem}).`, mode)
      return undefined
    }
    losses.add('resolved-alias', token.path, `{${joinPath(value.ref)}} is not in the output, so its value was written instead.`, mode)
    return cssValue(token, resolved.value, mode, set, names, losses)
  }
  return literalToCss(token, value.value, mode, names, losses)
}

const refText = (v: unknown, names: Map<string, string>): string | undefined => {
  if (typeof v !== 'string') return undefined
  const ref = parseCurlyReference(v)
  if (!ref) return undefined
  const target = names.get(joinPath(ref))
  return target ? `var(${target})` : undefined
}

function part(v: unknown, names: Map<string, string>): string | undefined {
  const ref = refText(v, names)
  if (ref) return ref
  if (isColorValue(v)) return colourToCss(v) ?? undefined
  if (isDimensionValue(v)) return dimensionToCss(v)
  if (isDurationValue(v)) return durationToCss(v)
  if (isCubicBezier(v)) return cubicBezierToCss(v)
  if (typeof v === 'string' && parseCurlyReference(v)) return undefined
  if (typeof v === 'number' || typeof v === 'string') return String(v)
  return undefined
}

function literalToCss(token: Token, literal: unknown, mode: string, names: Map<string, string>, losses: Losses): string | undefined {
  const single = part(literal, names)
  if (single !== undefined && token.type !== 'fontFamily') return single

  switch (token.type) {
    case 'fontFamily':
      if (typeof literal === 'string' || Array.isArray(literal)) return fontFamilyToCss(literal as string[])
      break
    case 'shadow': {
      const layers = Array.isArray(literal) ? literal : [literal]
      const css = layers.map((layer) => {
        if (typeof layer !== 'object' || layer === null) return undefined
        const s = layer as Record<string, unknown>
        const bits = [s.offsetX, s.offsetY, s.blur, s.spread].map((b) => part(b, names))
        const colour = part(s.color, names)
        if (bits.some((b) => b === undefined) || !colour) return undefined
        return `${s.inset === true ? 'inset ' : ''}${bits.join(' ')} ${colour}`
      })
      if (css.every(Boolean)) return css.join(', ')
      break
    }
    case 'border': {
      const b = literal as Record<string, unknown>
      const width = part(b.width, names)
      const style = typeof b.style === 'string' ? b.style : undefined
      const colour = part(b.color, names)
      if (width && style && colour) return `${width} ${style} ${colour}`
      break
    }
    case 'transition': {
      const t = literal as Record<string, unknown>
      const duration = part(t.duration, names)
      const timing = part(t.timingFunction, names)
      const delay = part(t.delay, names)
      if (duration && timing) return [duration, timing, delay].filter(Boolean).join(' ')
      break
    }
  }
  losses.add('unrepresentable-value', token.path, `The ${token.type ?? 'value'} has no CSS custom property form here.`, mode)
  return undefined
}

export function writeTailwind(set: TokenSet, options: WriteOptions): WriteResult {
  const losses = new Losses()
  const [defaultMode, ...otherModes] = set.modes

  const names = new Map<string, string>()
  const used = new Map<string, string>()
  const placement = new Map<string, boolean>()
  for (const token of set.tokens) {
    if (token.type === 'typography' || token.type === 'gradient' || token.type === 'strokeStyle') continue
    const { name, inTheme, renamed } = propertyName(token)
    const key = joinPath(token.path)
    if (used.has(name)) {
      losses.add('renamed', token.path, `${name} is already ${used.get(name)}; this token was not written.`)
      continue
    }
    if (renamed) losses.add('renamed', token.path, `Written as ${name}.`)
    used.set(name, key)
    names.set(key, name)
    placement.set(key, inTheme)
  }

  const themeLines: Record<string, string[]> = {}
  const rootLines: Record<string, string[]> = {}
  for (const mode of set.modes) {
    themeLines[mode] = []
    rootLines[mode] = []
  }

  const emit = (mode: string, name: string, css: string, inTheme: boolean) =>
    (inTheme && mode === defaultMode ? themeLines : rootLines)[mode].push(`  ${name}: ${css};`)

  for (const token of set.tokens) {
    const key = joinPath(token.path)

    if (token.type === 'typography') {
      writeTypography(token, set, names, emit, losses)
      continue
    }
    if (token.type === 'gradient' || token.type === 'strokeStyle') {
      losses.add('dropped-composite', token.path, `Tailwind has no ${token.type} theme variable.`)
      continue
    }
    const name = names.get(key)
    if (!name) continue

    for (const mode of set.modes) {
      const own = token.values[mode]
      if (mode !== defaultMode && (!own || sameValue(own, token.values[defaultMode]))) continue
      const value = mode === defaultMode ? valueIn(token, mode, set.modes) : own
      if (!value) continue
      const css = cssValue(token, value, mode, set, names, losses)
      if (css !== undefined) emit(mode, name, css, placement.get(key) ?? false)
    }
    if (token.description || token.deprecated !== undefined || token.extensions) {
      losses.add('dropped-metadata', token.path, 'CSS custom properties have no description, deprecation or extensions.')
    }
  }

  const blocks: string[] = ['@import "tailwindcss";']
  if (themeLines[defaultMode].length) blocks.push(`@theme {\n${themeLines[defaultMode].join('\n')}\n}`)
  if (rootLines[defaultMode].length) blocks.push(`:root {\n${rootLines[defaultMode].join('\n')}\n}`)

  for (const mode of otherModes) {
    const lines = rootLines[mode]
    if (!lines.length) continue
    if (options.tailwindModeSelector === 'media') {
      if (mode !== 'dark' && mode !== 'light') {
        losses.add('dropped-mode', mode, `prefers-color-scheme has only light and dark; "${mode}" was not written.`)
        continue
      }
      blocks.push(`@media (prefers-color-scheme: ${mode}) {\n  :root {\n${lines.map((l) => `  ${l}`).join('\n')}\n  }\n}`)
    } else {
      const selector = options.tailwindModeSelector === 'class' ? `.${sanitise(mode)}` : `[data-theme="${mode}"]`
      blocks.push(`${selector} {\n${lines.join('\n')}\n}`)
    }
  }

  return { files: [{ name: 'theme.css', text: `${blocks.join('\n\n')}\n` }], losses: losses.entries }
}

/**
 * Tailwind's type utility is a size with companions: `--text-sm`,
 * `--text-sm--line-height`, `--text-sm--letter-spacing`, `--text-sm--font-weight`.
 * There is no slot for the family, so a typography token splits, and loses it.
 */
function writeTypography(
  token: Token,
  set: TokenSet,
  names: Map<string, string>,
  emit: (mode: string, name: string, css: string, inTheme: boolean) => void,
  losses: Losses,
) {
  const [first, ...rest] = token.path
  const segments = NAMESPACE_ALIASES[first.toLowerCase()] ? rest : token.path
  const base = `--text-${segments.map(sanitise).filter(Boolean).join('-')}`
  const index = indexTokens(set)

  for (const mode of set.modes) {
    const own = token.values[mode]
    if (mode !== set.modes[0] && (!own || sameValue(own, token.values[set.modes[0]]))) continue
    const resolved = resolveValue(valueIn(token, mode, set.modes)!, mode, set, index)
    if (resolved.value?.kind !== 'literal' || typeof resolved.value.value !== 'object' || resolved.value.value === null) {
      losses.add('unrepresentable-value', token.path, 'The typography value is not an object.', mode)
      continue
    }
    const t = resolved.value.value as Record<string, unknown>
    const fields: [string, unknown][] = [
      ['', t.fontSize],
      ['--line-height', t.lineHeight],
      ['--letter-spacing', t.letterSpacing],
      ['--font-weight', t.fontWeight],
    ]
    for (const [suffix, v] of fields) {
      const css = part(v, names)
      if (css !== undefined) emit(mode, `${base}${suffix}`, css, true)
    }
    losses.add('split-composite', token.path, `Written as ${base} and its companions; the font family has no slot and was dropped.`, mode)
  }
}
