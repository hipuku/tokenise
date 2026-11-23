import { isRecord, Losses } from './document'
import { indexTokens, resolveValue, sameValue, untypedDetail, valueIn, type Index } from './resolve'
import {
  COMPOSITE_TYPES,
  joinPath,
  type OutputFile,
  type Token,
  type TokenSet,
  type TokenValue,
  type WriteResult,
} from './types'
import { parseCssColour, parseDimensionOrZero, parseDuration } from './values'

/* ─────────────────────────────────────────────────────────────────────────────
   Writes DTCG 2025.10. One mode is a plain token file. Several modes are a
   resolver document: every token's default value in one set, and a modifier
   whose contexts carry only the tokens that differ in that mode, all inline so
   the output is one file that pastes back in.
   ────────────────────────────────────────────────────────────────────────── */

/** Put a value at a path in a nested object, reporting a path already used by a token or a group. */
export function setAtPath(
  root: Record<string, unknown>,
  path: readonly string[],
  leaf: Record<string, unknown>,
  losses: Losses,
): boolean {
  let node = root
  for (const [i, key] of path.slice(0, -1).entries()) {
    const next = node[key]
    if (isRecord(next) && '$value' in next) {
      losses.add('renamed', path, `"${path.slice(0, i + 1).join('.')}" is a token, so it cannot also be a group; this token was not written.`)
      return false
    }
    if (!isRecord(next)) node[key] = {}
    node = node[key] as Record<string, unknown>
  }
  const last = path[path.length - 1]
  if (isRecord(node[last])) {
    losses.add('renamed', path, `"${joinPath(path)}" is a group, so it cannot also be a token; this token was not written.`)
    return false
  }
  node[last] = leaf
  return true
}

/**
 * A model value as a 2025.10 `$value`, or undefined when 2025.10 has no way to
 * say it. Raw text gets one more attempt at parsing for the token's type,
 * because a Tailwind `16px` arrives raw only when its namespace was unknown.
 */
export function toDtcgValue(token: Token, value: TokenValue, mode: string, losses: Losses): unknown {
  if (value.kind === 'reference') return `{${joinPath(value.ref)}}`
  if (value.kind === 'literal') return value.value

  const text = value.text
  const parsed =
    token.type === 'color'
      ? parseCssColour(text)
      : token.type === 'dimension'
        ? parseDimensionOrZero(text)
        : token.type === 'duration'
          ? parseDuration(text)
          : null
  if (parsed) return parsed

  if (token.type && COMPOSITE_TYPES.includes(token.type)) {
    losses.add('unrepresentable-value', token.path, `"${text}" is CSS shorthand; 2025.10 needs the ${token.type} as an object.`, mode)
  } else {
    losses.add('unrepresentable-value', token.path, `"${text}" has no 2025.10 ${token.type ?? 'value'} form.`, mode)
  }
  return undefined
}

function tokenLeaf(token: Token, dtcgValue: unknown): Record<string, unknown> {
  const leaf: Record<string, unknown> = {}
  if (token.type) leaf.$type = token.type
  leaf.$value = dtcgValue
  if (token.description) leaf.$description = token.description
  if (token.deprecated !== undefined) leaf.$deprecated = token.deprecated
  if (token.extensions) leaf.$extensions = token.extensions
  return leaf
}

/** Reference targets that will not be written are replaced by their resolved value. */
function writable(token: Token, value: TokenValue, mode: string, set: TokenSet, index: Index, written: Set<string>, losses: Losses): TokenValue | undefined {
  if (value.kind !== 'reference' || written.has(joinPath(value.ref))) return value
  const resolution = resolveValue(value, mode, set, index)
  if (!resolution.value) {
    losses.add('unrepresentable-value', token.path, `{${joinPath(value.ref)}} does not resolve (${resolution.problem}).`, mode)
    return undefined
  }
  losses.add('resolved-alias', token.path, `{${joinPath(value.ref)}} is not in the output, so its value was written instead.`, mode)
  return resolution.value
}

export function writeDtcg(set: TokenSet): WriteResult {
  const losses = new Losses()
  const index = indexTokens(set)
  const [defaultMode, ...otherModes] = set.modes

  // Which tokens have a writable default value decides which references survive.
  const written = new Set<string>()
  for (const token of set.tokens) {
    if (!token.type) continue
    const value = valueIn(token, defaultMode, set.modes)
    if (value && (value.kind !== 'raw' || toDtcgValue(token, value, defaultMode, new Losses()) !== undefined)) {
      written.add(joinPath(token.path))
    }
  }

  const build = (mode: string, onlyOverrides: boolean): Record<string, unknown> => {
    const root: Record<string, unknown> = {}
    for (const token of set.tokens) {
      if (!token.type) {
        if (mode === defaultMode) {
          losses.add('dropped-type', token.path, untypedDetail(token, defaultMode, 'DTCG 2025.10 type'))
        }
        continue
      }
      const own = token.values[mode]
      if (onlyOverrides && (!own || sameValue(own, token.values[defaultMode]))) continue
      const value = onlyOverrides ? own : valueIn(token, mode, set.modes)
      if (!value) continue
      const target = writable(token, value, mode, set, index, written, losses)
      if (!target) continue
      const dtcgValue = toDtcgValue(token, target, mode, losses)
      if (dtcgValue === undefined) continue
      setAtPath(root, token.path, tokenLeaf(token, dtcgValue), losses)
    }
    return root
  }

  const files: OutputFile[] = []
  if (otherModes.length === 0) {
    files.push({ name: 'tokens.json', text: JSON.stringify(build(defaultMode, false), null, 2) })
  } else {
    const contexts: Record<string, unknown[]> = { [defaultMode]: [] }
    for (const mode of otherModes) contexts[mode] = [build(mode, true)]
    const resolver = {
      version: '2025.10',
      sets: { base: { sources: [build(defaultMode, false)] } },
      modifiers: { mode: { contexts, default: defaultMode } },
      resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/mode' }],
    }
    files.push({ name: 'tokens.resolver.json', text: JSON.stringify(resolver, null, 2) })
  }
  return { files, losses: losses.entries }
}
