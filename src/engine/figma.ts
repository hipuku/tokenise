import { baseName, isRecord, Losses, mergeTokens, parseJson, type InputDocument } from './document'
import { readDtcgTree } from './dtcgRead'
import { setAtPath } from './dtcgWrite'
import { indexTokens, resolveValue, untypedDetail, valueIn } from './resolve'
import {
  COMPOSITE_TYPES,
  joinPath,
  type OutputFile,
  type Token,
  type TokenSet,
  type TokenValue,
  type WriteOptions,
  type WriteResult,
} from './types'
import { colourToSrgb, dimensionToPx, isColorValue, isDimensionValue, parseCssColour, parseDimensionOrZero } from './values'

/* ─────────────────────────────────────────────────────────────────────────────
   Figma's native variables export is DTCG-shaped JSON, one file per mode, with
   Figma's own metadata under `com.figma.*` extensions. So reading it is reading
   DTCG once per file and naming the mode after the file.

   Writing it is where the loss is. A Figma variable is a colour, a number, a
   string or a boolean: there are no composite variables (typography and shadow
   are styles, and the export does not carry styles), no durations, no curves,
   no rem. Every one of those is reported rather than approximated silently.
   ────────────────────────────────────────────────────────────────────────── */

const FIGMA_EXTENSION = /^com\.figma\./

export function hasFigmaExtensions(json: unknown): boolean {
  if (!isRecord(json)) return false
  if (isRecord(json.$extensions) && Object.keys(json.$extensions).some((k) => FIGMA_EXTENSION.test(k))) return true
  return Object.entries(json).some(([key, child]) => !key.startsWith('$') && hasFigmaExtensions(child))
}

export function readFigma(documents: readonly InputDocument[], losses: Losses): TokenSet {
  const merged = new Map<string, Token>()
  const modes: string[] = []
  for (const document of documents) {
    const mode = documents.length === 1 ? 'default' : baseName(document.name)
    if (!modes.includes(mode)) modes.push(mode)
    for (const token of readDtcgTree(parseJson(document), mode, losses, document.name)) mergeTokens(merged, token)
  }
  return { modes, tokens: [...merged.values()] }
}

const WRITABLE_TYPES = new Set(['color', 'dimension', 'number', 'fontFamily', 'fontWeight'])

export function writeFigma(set: TokenSet, options: WriteOptions): WriteResult {
  const losses = new Losses()
  const index = indexTokens(set)

  const accepted = set.tokens.filter((token) => {
    if (!token.type) {
      losses.add('dropped-type', token.path, untypedDetail(token, set.modes[0], 'Figma variable type'))
      return false
    }
    if (COMPOSITE_TYPES.includes(token.type)) {
      losses.add('dropped-composite', token.path, `Figma has no ${token.type} variable; it is a style, and the export does not carry styles.`)
      return false
    }
    if (!WRITABLE_TYPES.has(token.type)) {
      losses.add('dropped-type', token.path, `Figma has no ${token.type} variable.`)
      return false
    }
    return true
  })
  const written = new Set(accepted.map((t) => joinPath(t.path)))

  const valueFor = (token: Token, value: TokenValue, mode: string): unknown => {
    if (value.kind === 'reference') {
      if (written.has(joinPath(value.ref))) return `{${joinPath(value.ref)}}`
      const resolved = resolveValue(value, mode, set, index)
      if (!resolved.value) {
        losses.add('unrepresentable-value', token.path, `{${joinPath(value.ref)}} does not resolve (${resolved.problem}).`, mode)
        return undefined
      }
      losses.add('resolved-alias', token.path, `{${joinPath(value.ref)}} is not a Figma variable, so its value was written instead.`, mode)
      return valueFor(token, resolved.value, mode)
    }

    const literal = value.kind === 'raw' ? rawAsLiteral(token, value.text) : value.value
    if (literal === undefined) {
      losses.add('unrepresentable-value', token.path, `"${value.kind === 'raw' ? value.text : ''}" has no Figma variable form.`, mode)
      return undefined
    }

    switch (token.type) {
      case 'color': {
        if (!isColorValue(literal)) break
        const srgb = colourToSrgb(literal)
        if (!srgb) break
        if (srgb.converted) {
          const moved = srgb.deltaE > 0 ? `, clamped into gamut (ΔE ${srgb.deltaE})` : ''
          losses.add('converted-colour', token.path, `${literal.colorSpace} written as sRGB ${srgb.hex}${moved}.`, mode)
        }
        const [r, g, b] = [srgb.rgba.r, srgb.rgba.g, srgb.rgba.b]
        const colour: Record<string, unknown> = { colorSpace: 'srgb', components: [r, g, b], hex: srgb.hex.slice(0, 7) }
        if (srgb.rgba.a !== 1) colour.alpha = srgb.rgba.a
        return colour
      }
      case 'dimension': {
        if (!isDimensionValue(literal)) break
        if (literal.unit === 'rem') {
          const px = dimensionToPx(literal, options.remBase)
          losses.add('converted-unit', token.path, `${literal.value}rem written as ${px}px at ${options.remBase}px per rem; Figma has no rem.`, mode)
          return { value: px, unit: 'px' }
        }
        return literal
      }
      case 'fontFamily': {
        if (typeof literal === 'string') return literal
        if (Array.isArray(literal) && typeof literal[0] === 'string') {
          if (literal.length > 1) {
            losses.add('unrepresentable-value', token.path, `A Figma string variable holds one family; kept "${literal[0]}", dropped ${literal.slice(1).join(', ')}.`, mode)
          }
          return literal[0]
        }
        break
      }
      default:
        if (typeof literal === 'number') return literal
    }
    losses.add('unrepresentable-value', token.path, `The value has no Figma ${token.type} variable form.`, mode)
    return undefined
  }

  const files: OutputFile[] = set.modes.map((mode) => {
    const root: Record<string, unknown> = {}
    for (const token of accepted) {
      const value = valueIn(token, mode, set.modes)
      if (!value) continue
      const figmaValue = valueFor(token, value, mode)
      if (figmaValue === undefined) continue
      const leaf: Record<string, unknown> = { $type: token.type, $value: figmaValue }
      if (token.description) leaf.$description = token.description
      if (token.extensions) {
        const kept = Object.fromEntries(Object.entries(token.extensions).filter(([k]) => FIGMA_EXTENSION.test(k)))
        const dropped = Object.keys(token.extensions).filter((k) => !FIGMA_EXTENSION.test(k))
        if (dropped.length) losses.add('dropped-metadata', token.path, `Extensions ${dropped.join(', ')} are not Figma's; dropped.`)
        if (Object.keys(kept).length) leaf.$extensions = kept
      }
      if (token.deprecated !== undefined) losses.add('dropped-metadata', token.path, 'Figma variables have no deprecation flag.')
      setAtPath(root, token.path, leaf, losses)
    }
    const name = set.modes.length === 1 && mode === 'default' ? 'tokens.json' : `${mode}.tokens.json`
    return { name, text: JSON.stringify(root, null, 2) }
  })

  return { files, losses: losses.entries }
}

function rawAsLiteral(token: Token, text: string): unknown {
  if (token.type === 'color') return parseCssColour(text) ?? undefined
  if (token.type === 'dimension') return parseDimensionOrZero(text) ?? undefined
  if (token.type === 'number' && text.trim() !== '' && !Number.isNaN(Number(text))) return Number(text)
  if (token.type === 'fontFamily') return text
  return undefined
}
