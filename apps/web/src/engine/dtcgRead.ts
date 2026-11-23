import {
  baseName,
  isRecord,
  mergeTokens,
  parseJson,
  type InputDocument,
  type Losses,
} from './document'
import { ReadError, TOKEN_TYPES, type Token, type TokenSet, type TokenType, type TokenValue } from './types'
import {
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
   Reads DTCG JSON: a single 2025.10 token file, a resolver document with its
   sets and modifiers, and the pre-2025.10 shape haus and most tools still write,
   where colours and dimensions are CSS strings. Figma's export is this format
   too, one file per mode, so its reader calls into here.

   Leniency is never silent. Every value accepted outside the 2025.10 grammar
   adds a `lenient-read` entry, so a file that looks fine because tokenise
   forgave it still says what it forgave.
   ────────────────────────────────────────────────────────────────────────── */

const isTokenType = (value: unknown): value is TokenType =>
  typeof value === 'string' && (TOKEN_TYPES as readonly string[]).includes(value)

/** A `$ref` JSON Pointer to a token's `$value`, as a path. Null for anything deeper. */
function pointerToPath(pointer: string): string[] | null {
  const match = /^#\/(.+)\/\$value$/.exec(pointer)
  if (!match) return null
  return match[1].split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
}

/**
 * Normalise one `$value` for its declared type into model shape. Returns the
 * value and, when the type was absent, the type it was inferred as.
 */
export function readDtcgValue(
  raw: unknown,
  declared: TokenType | null,
  sourceType: string | undefined,
  path: string[],
  mode: string,
  losses: Losses,
): { value: TokenValue; type: TokenType | null } {
  const lenient = (detail: string) => losses.add('lenient-read', path, detail, mode)

  if (typeof raw === 'string') {
    const ref = parseCurlyReference(raw)
    if (ref) return { value: { kind: 'reference', ref }, type: declared }
  }
  if (isRecord(raw) && typeof raw.$ref === 'string') {
    const ref = pointerToPath(raw.$ref)
    if (ref) return { value: { kind: 'reference', ref }, type: declared }
    return { value: { kind: 'raw', text: raw.$ref }, type: declared }
  }

  const type = declared ?? inferType(raw)
  if (!declared && type) lenient(`No $type; read as ${type} from the value.`)
  if (!declared && !type && !sourceType) {
    lenient(
      typeof raw === 'string' && /\bvar\(/.test(raw)
        ? `No $type, and "${raw}" is a CSS expression, not a DTCG value or reference.`
        : 'No $type, and none could be inferred from the value.',
    )
  }

  switch (type) {
    case 'color': {
      if (isColorValue(raw)) return { value: { kind: 'literal', value: raw }, type }
      if (typeof raw === 'string') {
        const parsed = parseCssColour(raw)
        if (parsed) {
          lenient(`Colour written as the CSS string "${raw}", not a 2025.10 colour object.`)
          return { value: { kind: 'literal', value: parsed }, type }
        }
      }
      break
    }
    case 'dimension': {
      if (isDimensionValue(raw)) return { value: { kind: 'literal', value: raw }, type }
      if (typeof raw === 'string') {
        const parsed = parseDimensionOrZero(raw)
        if (parsed) {
          lenient(`Dimension written as the string "${raw}", not a 2025.10 dimension object.`)
          return { value: { kind: 'literal', value: parsed }, type }
        }
        lenient(`"${raw}" is not a px or rem dimension.`)
        return { value: { kind: 'raw', text: raw }, type }
      }
      if (typeof raw === 'number') {
        lenient(`Dimension written as the bare number ${raw}; read as px.`)
        return { value: { kind: 'literal', value: { value: raw, unit: 'px' } }, type }
      }
      break
    }
    case 'duration': {
      if (isDurationValue(raw)) return { value: { kind: 'literal', value: raw }, type }
      if (typeof raw === 'string') {
        const parsed = parseDuration(raw)
        if (parsed) {
          lenient(`Duration written as the string "${raw}", not a 2025.10 duration object.`)
          return { value: { kind: 'literal', value: parsed }, type }
        }
      }
      if (typeof raw === 'number') {
        lenient(`Duration written as the bare number ${raw}; read as ms.`)
        return { value: { kind: 'literal', value: { value: raw, unit: 'ms' } }, type }
      }
      break
    }
    case 'cubicBezier': {
      if (isCubicBezier(raw)) return { value: { kind: 'literal', value: raw }, type }
      if (typeof raw === 'string') {
        const parsed = parseCubicBezier(raw)
        if (parsed) {
          lenient(`Cubic bézier written as the string "${raw}", not an array of four numbers.`)
          return { value: { kind: 'literal', value: parsed }, type }
        }
      }
      break
    }
    case 'fontWeight': {
      if (typeof raw === 'number') return { value: { kind: 'literal', value: raw }, type }
      if (typeof raw === 'string') {
        const parsed = parseFontWeight(raw)
        if (parsed !== null) return { value: { kind: 'literal', value: parsed }, type }
      }
      break
    }
    case 'fontFamily': {
      if (typeof raw === 'string' && raw.includes(',')) {
        lenient(`Font family list written as one string; split into ${raw.split(',').length} families.`)
        return { value: { kind: 'literal', value: parseFontFamily(raw) }, type }
      }
      if (typeof raw === 'string' || (Array.isArray(raw) && raw.every((f) => typeof f === 'string'))) {
        return { value: { kind: 'literal', value: raw }, type }
      }
      break
    }
    case 'number': {
      if (typeof raw === 'number') return { value: { kind: 'literal', value: raw }, type }
      if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
        lenient(`Number written as the string "${raw}".`)
        return { value: { kind: 'literal', value: Number(raw) }, type }
      }
      break
    }
    case null:
      break
    default:
      // strokeStyle and the composites: kept in DTCG shape. References inside them
      // stay as "{a.b}" strings, which every writer resolves the same way.
      if (isRecord(raw) || Array.isArray(raw) || typeof raw === 'string') {
        return { value: { kind: 'literal', value: raw as Record<string, unknown> }, type }
      }
  }

  if (type) lenient(`The value does not match the ${type} type; kept as written.`)
  if (typeof raw === 'string') return { value: { kind: 'raw', text: raw }, type }
  if (typeof raw === 'number' || isRecord(raw) || Array.isArray(raw)) {
    return { value: { kind: 'literal', value: raw as Record<string, unknown> }, type }
  }
  return { value: { kind: 'raw', text: JSON.stringify(raw) }, type }
}

function inferType(raw: unknown): TokenType | null {
  if (isColorValue(raw)) return 'color'
  if (isDimensionValue(raw)) return 'dimension'
  if (isDurationValue(raw)) return 'duration'
  if (typeof raw === 'string') {
    if (parseCurlyReference(raw)) return null
    if (parseDimensionOrZero(raw) && raw.trim() !== '0') return 'dimension'
    if (parseDuration(raw)) return 'duration'
    if (parseCssColour(raw)) return 'color'
  }
  return null
}

/** Read one DTCG token tree into tokens for one mode. */
export function readDtcgTree(root: unknown, mode: string, losses: Losses, documentName: string): Token[] {
  if (!isRecord(root)) throw new ReadError(`${documentName} does not hold a token object.`)
  const tokens: Token[] = []

  const walk = (node: Record<string, unknown>, path: string[], inheritedType: string | undefined) => {
    const groupType = typeof node.$type === 'string' ? node.$type : inheritedType

    if (typeof node.$extends === 'string') {
      const target = parseCurlyReference(node.$extends)
      const source = target && target.reduce<unknown>((n, key) => (isRecord(n) ? n[key] : undefined), root)
      if (isRecord(source)) walk(source, path, groupType)
      else losses.add('lenient-read', path, `$extends ${node.$extends} does not resolve to a group; ignored.`, mode)
    }

    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$') || !isRecord(child)) continue
      const childPath = [...path, key]
      if ('$value' in child) {
        const own = typeof child.$type === 'string' ? child.$type : groupType
        const declared = isTokenType(own) ? own : null
        const sourceType = own && !declared ? own : undefined
        if (sourceType) {
          losses.add('lenient-read', childPath, `$type "${sourceType}" is not a DTCG 2025.10 type.`, mode)
        }
        const { value, type } = readDtcgValue(child.$value, declared, sourceType, childPath, mode, losses)
        const token: Token = { path: childPath, type, values: { [mode]: value } }
        if (sourceType) token.sourceType = sourceType
        if (typeof child.$description === 'string') token.description = child.$description
        if (typeof child.$deprecated === 'boolean' || typeof child.$deprecated === 'string') {
          token.deprecated = child.$deprecated
        }
        if (isRecord(child.$extensions)) token.extensions = child.$extensions
        tokens.push(token)
      } else {
        walk(child, childPath, groupType)
      }
    }
  }

  walk(root, [], undefined)
  return tokens
}

/* ─── Resolver documents ──────────────────────────────────────────────────── */

export const isResolverDocument = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && Array.isArray(value.resolutionOrder)

/**
 * Read a 2025.10 resolver. Sets and modifier contexts are sources: inline token
 * objects, or `$ref`s to the other pasted documents by file name. tokenise reads
 * one modifier as the mode switch; a second modifier would multiply the modes
 * into combinations, which none of the other three formats can hold.
 */
export function readResolver(
  resolver: Record<string, unknown>,
  others: readonly InputDocument[],
  losses: Losses,
): TokenSet {
  const sets = isRecord(resolver.sets) ? resolver.sets : {}
  const modifiers = isRecord(resolver.modifiers) ? resolver.modifiers : {}

  const loadSource = (source: unknown): unknown => {
    if (isRecord(source) && typeof source.$ref === 'string') {
      const ref = source.$ref
      const local = /^#\/(sets|modifiers)\/(.+)$/.exec(ref)
      if (local) return local[1] === 'sets' ? sets[local[2]] : undefined
      const match = others.find((d) => d.name === ref || baseName(d.name) === baseName(ref))
      if (!match) {
        throw new ReadError(`The resolver refers to "${ref}". Paste that file as another document.`)
      }
      return parseJson(match)
    }
    return source
  }

  const sourcesOf = (entry: unknown): unknown[] => {
    const loaded = loadSource(entry)
    if (isRecord(loaded) && Array.isArray(loaded.sources)) return loaded.sources.map(loadSource)
    return [loaded]
  }

  const order = resolver.resolutionOrder as unknown[]
  let modifier: { name: string; contexts: Record<string, unknown[]>; defaultContext?: string } | null = null
  const base: unknown[] = []

  for (const entry of order) {
    const ref = isRecord(entry) && typeof entry.$ref === 'string' ? entry.$ref : null
    const modifierName = ref && /^#\/modifiers\/(.+)$/.exec(ref)?.[1]
    const modifierDef = modifierName ? modifiers[modifierName] : isRecord(entry) && isRecord(entry.contexts) ? entry : null
    if (isRecord(modifierDef) && isRecord(modifierDef.contexts)) {
      const name = modifierName ?? (typeof modifierDef.name === 'string' ? modifierDef.name : 'modifier')
      if (modifier) {
        losses.add('dropped-mode', name, `Only one modifier is read as modes; "${name}" was ignored.`)
        continue
      }
      const contexts: Record<string, unknown[]> = {}
      for (const [context, sources] of Object.entries(modifierDef.contexts)) {
        contexts[context] = (Array.isArray(sources) ? sources : [sources]).map(loadSource)
      }
      modifier = {
        name,
        contexts,
        defaultContext: typeof modifierDef.default === 'string' ? modifierDef.default : undefined,
      }
    } else {
      base.push(...sourcesOf(entry))
    }
  }

  const contextNames = modifier ? Object.keys(modifier.contexts) : ['default']
  if (modifier?.defaultContext && contextNames.includes(modifier.defaultContext)) {
    contextNames.splice(contextNames.indexOf(modifier.defaultContext), 1)
    contextNames.unshift(modifier.defaultContext)
  }

  const merged = new Map<string, Token>()
  for (const mode of contextNames) {
    const sources = [...base, ...(modifier ? modifier.contexts[mode] : [])]
    for (const source of sources) {
      for (const token of readDtcgTree(source, mode, losses, 'resolver source')) mergeTokens(merged, token)
    }
  }
  return { modes: contextNames, tokens: [...merged.values()] }
}

/** Read DTCG input: a resolver plus the files it refers to, or plain token files (merged, one mode). */
export function readDtcg(documents: readonly InputDocument[], losses: Losses): TokenSet {
  const parsed = documents.map((d) => ({ document: d, json: parseJson(d) }))
  const resolver = parsed.find((p) => isResolverDocument(p.json))
  if (resolver) {
    return readResolver(
      resolver.json as Record<string, unknown>,
      documents.filter((d) => d !== resolver.document),
      losses,
    )
  }
  const merged = new Map<string, Token>()
  for (const { document, json } of parsed) {
    for (const token of readDtcgTree(json, 'default', losses, document.name)) mergeTokens(merged, token)
  }
  return { modes: ['default'], tokens: [...merged.values()] }
}
