import { baseName, isRecord, Losses, mergeTokens, parseJson, type InputDocument } from './document'
import { setAtPath } from './dtcgWrite'
import { indexTokens, resolveValue, sameValue, untypedDetail, valueIn } from './resolve'
import {
  ReadError,
  joinPath,
  type Literal,
  type Token,
  type TokenSet,
  type TokenType,
  type TokenValue,
  type WriteResult,
} from './types'
import {
  colourToSrgb,
  containsCurlyReference,
  cubicBezierToCss,
  dimensionToCss,
  durationToCss,
  fontFamilyToCss,
  isColorValue,
  isCubicBezier,
  isDimensionValue,
  isDurationValue,
  parseCssColour,
  parseCurlyReference,
  parseDimensionOrZero,
  parseFontFamily,
  parseFontWeight,
} from './values'

/* ─────────────────────────────────────────────────────────────────────────────
   Tokens Studio predates the DTCG spec and still carries the types it had
   before the spec settled: `sizing`, `spacing`, `borderRadius` and the rest are
   all a DTCG `dimension`; `fontFamilies` is `fontFamily`; `boxShadow` is
   `shadow`. It writes values as strings, keys tokens with `value`/`type` (or
   `$value`/`$type` in its W3C mode), groups tokens into sets, and selects sets
   per theme in `$themes`. Each theme is a mode here.

   A token keeps its Tokens Studio type in `sourceType`, so writing back to
   Tokens Studio restores `borderRadius` rather than flattening it to
   `dimension`.
   ────────────────────────────────────────────────────────────────────────── */

const TYPE_MAP: Record<string, TokenType | null> = {
  color: 'color',
  dimension: 'dimension',
  sizing: 'dimension',
  spacing: 'dimension',
  borderRadius: 'dimension',
  borderWidth: 'dimension',
  fontSizes: 'dimension',
  letterSpacing: 'dimension',
  paragraphSpacing: 'dimension',
  opacity: 'number',
  number: 'number',
  lineHeights: 'number',
  fontWeights: 'fontWeight',
  fontFamilies: 'fontFamily',
  typography: 'typography',
  boxShadow: 'shadow',
  border: 'border',
  text: null,
  textCase: null,
  textDecoration: null,
  asset: null,
  boolean: null,
  other: null,
  composition: null,
}

const REVERSE_TYPE: Partial<Record<TokenType, string>> = {
  color: 'color',
  dimension: 'dimension',
  number: 'number',
  fontWeight: 'fontWeights',
  fontFamily: 'fontFamilies',
  typography: 'typography',
  shadow: 'boxShadow',
  border: 'border',
}

const tokenKeys = (node: Record<string, unknown>) =>
  'value' in node && ('type' in node || typeof node.value !== 'object')
    ? { value: 'value', type: 'type', description: 'description' }
    : '$value' in node
      ? { value: '$value', type: '$type', description: '$description' }
      : null

export function looksLikeTokensStudio(json: unknown): boolean {
  if (!isRecord(json)) return false
  if ('$themes' in json || '$metadata' in json) return true
  let found = false
  const walk = (node: Record<string, unknown>) => {
    for (const [key, child] of Object.entries(node)) {
      if (found || key.startsWith('$') || !isRecord(child)) continue
      if ('value' in child && 'type' in child) found = true
      else if (typeof child.$type === 'string' && child.$type in TYPE_MAP && !(child.$type in REVERSE_TYPE)) found = true
      else walk(child)
    }
  }
  walk(json)
  return found
}

function readValue(
  raw: unknown,
  sourceType: string,
  path: string[],
  mode: string,
  losses: Losses,
): TokenValue {
  const type = TYPE_MAP[sourceType]
  if (typeof raw === 'string') {
    const ref = parseCurlyReference(raw)
    if (ref) return { kind: 'reference', ref }
    if (containsCurlyReference(raw)) {
      losses.add('unrepresentable-value', path, `"${raw}" is a Tokens Studio expression; only Tokens Studio can evaluate it.`, mode)
      return { kind: 'raw', text: raw }
    }
  }

  const literal = (value: Literal): TokenValue => ({ kind: 'literal', value })
  const asString = typeof raw === 'number' ? String(raw) : raw

  switch (type) {
    case 'color':
      if (typeof asString === 'string') {
        const colour = parseCssColour(asString)
        if (colour) return literal(colour)
      }
      break
    case 'dimension':
      if (typeof asString === 'string') {
        // A unitless Tokens Studio size is pixels.
        const dimension = parseDimensionOrZero(/^-?\d*\.?\d+$/.test(asString) ? `${asString}px` : asString)
        if (dimension) return literal(dimension)
      }
      break
    case 'number':
      if (typeof asString === 'string' && asString.trim() !== '' && !Number.isNaN(Number(asString))) return literal(Number(asString))
      break
    case 'fontWeight':
      if (typeof asString === 'string') {
        const weight = parseFontWeight(asString)
        if (weight !== null) return literal(weight)
      }
      break
    case 'fontFamily':
      if (typeof asString === 'string') return literal(parseFontFamily(asString))
      break
    case 'typography':
      if (isRecord(raw)) return literal(readTypography(raw))
      break
    case 'shadow': {
      const layers = Array.isArray(raw) ? raw : [raw]
      if (layers.every(isRecord)) {
        const shadows = layers.map((l) => readShadow(l as Record<string, unknown>))
        return literal(shadows.length === 1 ? shadows[0] : shadows)
      }
      break
    }
    case 'border':
      if (isRecord(raw)) {
        return literal({ width: dimOrRef(raw.width), style: raw.style, color: colourOrRef(raw.color) })
      }
      break
  }
  if (typeof raw === 'string') return { kind: 'raw', text: raw }
  return literal(raw as Literal)
}

const dimOrRef = (v: unknown) => {
  if (typeof v === 'number') return { value: v, unit: 'px' }
  if (typeof v !== 'string') return v
  if (parseCurlyReference(v)) return v
  return parseDimensionOrZero(/^-?\d*\.?\d+$/.test(v) ? `${v}px` : v) ?? v
}
const colourOrRef = (v: unknown) => (typeof v === 'string' && !parseCurlyReference(v) ? parseCssColour(v) ?? v : v)

function readTypography(t: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (t.fontFamily !== undefined) out.fontFamily = typeof t.fontFamily === 'string' && !parseCurlyReference(t.fontFamily) ? parseFontFamily(t.fontFamily) : t.fontFamily
  if (t.fontWeight !== undefined) out.fontWeight = typeof t.fontWeight === 'string' && !parseCurlyReference(t.fontWeight) ? parseFontWeight(t.fontWeight) ?? t.fontWeight : t.fontWeight
  if (t.fontSize !== undefined) out.fontSize = dimOrRef(t.fontSize)
  if (t.lineHeight !== undefined) {
    const lh = t.lineHeight
    out.lineHeight = typeof lh === 'string' && /^\d*\.?\d+%$/.test(lh) ? Number(lh.slice(0, -1)) / 100 : typeof lh === 'string' && !Number.isNaN(Number(lh)) ? Number(lh) : lh
  }
  if (t.letterSpacing !== undefined) out.letterSpacing = dimOrRef(t.letterSpacing)
  for (const key of ['paragraphSpacing', 'textCase', 'textDecoration']) if (t[key] !== undefined) out[key] = t[key]
  return out
}

function readShadow(s: Record<string, unknown>): Record<string, unknown> {
  return {
    color: colourOrRef(s.color),
    offsetX: dimOrRef(s.x ?? s.offsetX ?? 0),
    offsetY: dimOrRef(s.y ?? s.offsetY ?? 0),
    blur: dimOrRef(s.blur ?? 0),
    spread: dimOrRef(s.spread ?? 0),
    ...(s.type === 'innerShadow' || s.inset === true ? { inset: true } : {}),
  }
}

function readSet(root: unknown, mode: string, losses: Losses): Token[] {
  const tokens: Token[] = []
  const walk = (node: Record<string, unknown>, path: string[], inheritedType?: string) => {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$') || !isRecord(child)) continue
      const childPath = [...path, key]
      const keys = tokenKeys(child)
      if (!keys) {
        walk(child, childPath, typeof child.$type === 'string' ? child.$type : inheritedType)
        continue
      }
      const sourceType = typeof child[keys.type] === 'string' ? (child[keys.type] as string) : inheritedType ?? 'other'
      if (!(sourceType in TYPE_MAP)) {
        losses.add('lenient-read', childPath, `"${sourceType}" is not a Tokens Studio type; read as other.`, mode)
      }
      const token: Token = {
        path: childPath,
        type: TYPE_MAP[sourceType] ?? null,
        sourceType,
        values: { [mode]: readValue(child[keys.value], sourceType, childPath, mode, losses) },
      }
      if (typeof child[keys.description] === 'string') token.description = child[keys.description] as string
      if (isRecord(child.$extensions)) token.extensions = child.$extensions
      tokens.push(token)
    }
  }
  if (isRecord(root)) walk(root, [])
  return tokens
}

interface Theme {
  name: string
  selectedTokenSets: Record<string, string>
}

export function readTokensStudio(documents: readonly InputDocument[], losses: Losses): TokenSet {
  const sets = new Map<string, unknown>()
  let themes: Theme[] = []
  let order: string[] = []

  for (const document of documents) {
    const json = parseJson(document)
    const name = baseName(document.name)
    if (name === '$themes' && Array.isArray(json)) {
      themes = json as Theme[]
      continue
    }
    if (name === '$metadata' && isRecord(json)) {
      if (Array.isArray(json.tokenSetOrder)) order = json.tokenSetOrder as string[]
      continue
    }
    if (!isRecord(json)) throw new ReadError(`${document.name} does not hold a token object.`)
    if (Array.isArray(json.$themes)) themes = json.$themes as Theme[]
    if (isRecord(json.$metadata) && Array.isArray(json.$metadata.tokenSetOrder)) {
      order = json.$metadata.tokenSetOrder as string[]
    }
    const multiSet = order.length > 0 || themes.length > 0
    if (multiSet && documents.length === 1) {
      for (const [key, value] of Object.entries(json)) if (!key.startsWith('$') && isRecord(value)) sets.set(key, value)
    } else {
      sets.set(name, json)
    }
  }
  if (!order.length) order = [...sets.keys()]

  const merged = new Map<string, Token>()
  const modes: string[] = []
  const selections = themes.length
    ? themes.map((theme) => ({
        mode: theme.name,
        sets: order.filter((s) => theme.selectedTokenSets?.[s] && theme.selectedTokenSets[s] !== 'disabled'),
      }))
    : [{ mode: 'default', sets: order }]

  for (const { mode, sets: chosen } of selections) {
    modes.push(mode)
    for (const setName of chosen) {
      const tokens = sets.get(setName)
      if (!tokens) {
        losses.add('lenient-read', setName, `The theme "${mode}" selects the set "${setName}", which is not in the input.`, mode)
        continue
      }
      for (const token of readSet(tokens, mode, losses)) mergeTokens(merged, token)
    }
  }
  return { modes, tokens: [...merged.values()] }
}

/* ─── Writing ─────────────────────────────────────────────────────────────── */

function writeValue(token: Token, value: TokenValue, mode: string, set: TokenSet, written: Set<string>, losses: Losses): unknown {
  if (value.kind === 'reference') {
    if (written.has(joinPath(value.ref))) return `{${joinPath(value.ref)}}`
    const resolved = resolveValue(value, mode, set, indexTokens(set))
    if (!resolved.value) {
      losses.add('unrepresentable-value', token.path, `{${joinPath(value.ref)}} does not resolve (${resolved.problem}).`, mode)
      return undefined
    }
    losses.add('resolved-alias', token.path, `{${joinPath(value.ref)}} is not in the output, so its value was written instead.`, mode)
    return writeValue(token, resolved.value, mode, set, written, losses)
  }
  if (value.kind === 'raw') return value.text
  return writeLiteral(token, value.value, mode, losses)
}

function str(token: Token, v: unknown, mode: string, losses: Losses): unknown {
  if (typeof v === 'string' || typeof v === 'number') return v
  if (isColorValue(v)) {
    const srgb = colourToSrgb(v)
    if (!srgb) return undefined
    if (srgb.converted) {
      const moved = srgb.deltaE > 0 ? `, clamped into gamut (ΔE ${srgb.deltaE})` : ''
      losses.add('converted-colour', token.path, `${v.colorSpace} written as ${srgb.hex}${moved}.`, mode)
    }
    return srgb.hex
  }
  if (isDimensionValue(v)) return dimensionToCss(v)
  if (isDurationValue(v)) return durationToCss(v)
  if (isCubicBezier(v)) return cubicBezierToCss(v)
  if (Array.isArray(v) && v.every((f) => typeof f === 'string')) return fontFamilyToCss(v)
  return undefined
}

function writeLiteral(token: Token, literal: unknown, mode: string, losses: Losses): unknown {
  switch (token.type) {
    case 'typography': {
      const t = literal as Record<string, unknown>
      return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, str(token, v, mode, losses) ?? v]))
    }
    case 'shadow': {
      const layers = (Array.isArray(literal) ? literal : [literal]) as Record<string, unknown>[]
      const out = layers.map((s) => ({
        x: str(token, s.offsetX, mode, losses),
        y: str(token, s.offsetY, mode, losses),
        blur: str(token, s.blur, mode, losses),
        spread: str(token, s.spread, mode, losses),
        color: str(token, s.color, mode, losses),
        type: s.inset ? 'innerShadow' : 'dropShadow',
      }))
      return out.length === 1 ? out[0] : out
    }
    case 'border': {
      const b = literal as Record<string, unknown>
      return { width: str(token, b.width, mode, losses), style: b.style, color: str(token, b.color, mode, losses) }
    }
  }
  const value = str(token, literal, mode, losses)
  if (value === undefined) {
    losses.add('unrepresentable-value', token.path, `The ${token.type ?? 'value'} has no Tokens Studio form.`, mode)
  }
  return value
}

export function writeTokensStudio(set: TokenSet): WriteResult {
  const losses = new Losses()
  const [defaultMode, ...otherModes] = set.modes

  const typed = set.tokens.filter((token) => {
    const known = token.sourceType && token.sourceType in TYPE_MAP
    if (known || (token.type && REVERSE_TYPE[token.type])) return true
    if (token.type === 'duration' || token.type === 'cubicBezier') {
      losses.add('dropped-type', token.path, `Tokens Studio has no ${token.type} type; written as "other", which no transform reads as a ${token.type}.`)
      return true
    }
    if (token.type) {
      losses.add('dropped-composite', token.path, `Tokens Studio has no ${token.type} type.`)
      return false
    }
    losses.add('dropped-type', token.path, `${untypedDetail(token, set.modes[0], 'Tokens Studio type')} Written as "other".`)
    return true
  })
  const written = new Set(typed.map((t) => joinPath(t.path)))

  const typeOf = (token: Token) =>
    token.sourceType && token.sourceType in TYPE_MAP ? token.sourceType : (token.type && REVERSE_TYPE[token.type]) ?? 'other'

  const build = (mode: string, onlyOverrides: boolean) => {
    const root: Record<string, unknown> = {}
    for (const token of typed) {
      const own = token.values[mode]
      if (onlyOverrides && (!own || sameValue(own, token.values[defaultMode]))) continue
      const value = onlyOverrides ? own : valueIn(token, mode, set.modes)
      if (!value) continue
      const tsValue = writeValue(token, value, mode, set, written, losses)
      if (tsValue === undefined) continue
      const leaf: Record<string, unknown> = { value: tsValue, type: typeOf(token) }
      if (token.description) leaf.description = token.description
      if (token.deprecated !== undefined) losses.add('dropped-metadata', token.path, 'Tokens Studio has no deprecation flag.')
      if (token.extensions) leaf.$extensions = token.extensions
      setAtPath(root, token.path, leaf, losses)
    }
    return root
  }

  if (!otherModes.length) {
    return { files: [{ name: 'tokens.json', text: JSON.stringify(build(defaultMode, false), null, 2) }], losses: losses.entries }
  }
  const output: Record<string, unknown> = { global: build(defaultMode, false) }
  for (const mode of otherModes) output[mode] = build(mode, true)
  output.$themes = set.modes.map((mode, i) => ({
    id: mode,
    name: mode,
    selectedTokenSets: i === 0 ? { global: 'enabled' } : { global: 'source', [mode]: 'enabled' },
  }))
  output.$metadata = { tokenSetOrder: ['global', ...otherModes] }
  return { files: [{ name: 'tokens.json', text: JSON.stringify(output, null, 2) }], losses: losses.entries }
}
