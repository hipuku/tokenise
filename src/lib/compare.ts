import { write } from '@/engine/convert'
import { indexTokens, resolveValue } from '@/engine/resolve'
import { propertyName } from '@/engine/tailwind'
import { DEFAULT_OPTIONS, joinPath, type FormatId, type LossEntry, type Token, type TokenSet } from '@/engine/types'

export interface FormatSnippet {
  format: FormatId
  /** The token as that format writes it, or null when it was not written. */
  text: string | null
  losses: LossEntry[]
}

/** The token plus every token its references pass through, so aliases survive in the snippet. */
function subset(set: TokenSet, token: Token): TokenSet {
  const index = indexTokens(set)
  const keep = new Set([joinPath(token.path)])
  for (const mode of set.modes) {
    const value = token.values[mode]
    if (value) for (const key of resolveValue(value, mode, set, index).chain) keep.add(key)
  }
  return { modes: set.modes, tokens: set.tokens.filter((t) => keep.has(joinPath(t.path))) }
}

const at = (node: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>((n, key) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[key] : undefined), node)

function jsonSnippet(format: FormatId, files: { name: string; text: string }[], path: string[], set: TokenSet): string | null {
  const parts: string[] = []
  for (const file of files) {
    const json = JSON.parse(file.text) as Record<string, unknown>
    const candidates: [string, unknown][] =
      format === 'dtcg' && 'resolutionOrder' in json
        ? [
            ['base', at(json, ['sets', 'base', 'sources', '0', ...path])],
            ...set.modes.slice(1).map((m) => [m, at(json, ['modifiers', 'mode', 'contexts', m, '0', ...path])] as [string, unknown]),
          ]
        : format === 'tokens-studio' && '$themes' in json
          ? [['global', at(json, ['global', ...path])], ...set.modes.slice(1).map((m) => [m, at(json, [m, ...path])] as [string, unknown])]
          : [[files.length > 1 ? file.name : '', at(json, path)]]
    for (const [label, leaf] of candidates) {
      if (leaf === undefined) continue
      parts.push(`${label ? `// ${label}\n` : ''}${JSON.stringify({ [path[path.length - 1]]: leaf }, null, 2)}`)
    }
  }
  return parts.length ? parts.join('\n\n') : null
}

function cssSnippet(css: string, token: Token): string | null {
  const name = propertyName(token).name
  const typographyBase = `--text-${token.path.slice(token.path[0] === 'text' ? 1 : 0).join('-')}`
  const lines: string[] = []
  let block = ''
  for (const line of css.split('\n')) {
    if (line.trim().endsWith('{')) block = line.trim()
    const property = /^\s*(--[\w-]+):/.exec(line)?.[1]
    if (property && (property === name || property.startsWith(`${typographyBase}`))) {
      lines.push(`${block} ${line.trim()}`)
    }
  }
  return lines.length ? lines.join('\n') : null
}

export function compareFormats(set: TokenSet, token: Token): FormatSnippet[] {
  const small = subset(set, token)
  const key = joinPath(token.path)
  return (['dtcg', 'figma', 'tokens-studio', 'tailwind'] as FormatId[]).map((format) => {
    const { files, losses } = write(small, format, DEFAULT_OPTIONS)
    const text =
      format === 'tailwind' ? cssSnippet(files[0].text, token) : jsonSnippet(format, files, token.path, small)
    return { format, text, losses: losses.filter((l) => l.token === key) }
  })
}
