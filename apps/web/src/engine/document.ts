import { ReadError, joinPath, type LossEntry, type LossReason, type Token } from './types'

/** One pasted or dropped file. The name matters for per-mode files and resolver `$ref`s. */
export interface InputDocument {
  name: string
  text: string
}

/**
 * The whole input is capped before anything parses it, for the same reason as
 * specifi's Rank view: an accidental paste of a production bundle should give a
 * readable error, not a hung tab. 500 KB is far above any real token file.
 */
export const MAX_INPUT_BYTES = 500_000

export function checkSize(documents: readonly InputDocument[]): void {
  const bytes = documents.reduce((sum, d) => sum + new TextEncoder().encode(d.text).length, 0)
  if (bytes > MAX_INPUT_BYTES) {
    throw new ReadError(
      `The input is ${Math.round(bytes / 1000)} KB. The limit is ${MAX_INPUT_BYTES / 1000} KB.`,
    )
  }
}

export function parseJson(document: InputDocument): unknown {
  try {
    return JSON.parse(document.text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ReadError(`${document.name} is not valid JSON: ${message}`)
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A file name without its directory or token-file extensions: `theme/Dark.tokens.json` → `Dark`. */
export function baseName(name: string): string {
  const file = name.split('/').pop() ?? name
  return file.replace(/\.(tokens\.)?json$/i, '').replace(/\.resolver$/i, '')
}

/** Collects loss entries, dropping exact duplicates. */
export class Losses {
  readonly entries: LossEntry[] = []
  private readonly seen = new Set<string>()

  add(reason: LossReason, token: readonly string[] | string, detail: string, mode?: string): void {
    const name = typeof token === 'string' ? token : joinPath(token)
    const key = `${reason}|${name}|${mode ?? ''}|${detail}`
    if (this.seen.has(key)) return
    this.seen.add(key)
    this.entries.push({ reason, token: name, mode, detail })
  }
}

/** Merge tokens read from several sources, later values for the same path and mode winning. */
export function mergeTokens(into: Map<string, Token>, token: Token): void {
  const key = joinPath(token.path)
  const existing = into.get(key)
  if (!existing) {
    into.set(key, { ...token, values: { ...token.values } })
    return
  }
  Object.assign(existing.values, token.values)
  existing.type = existing.type ?? token.type
  existing.sourceType = existing.sourceType ?? token.sourceType
  existing.description = token.description ?? existing.description
  existing.deprecated = token.deprecated ?? existing.deprecated
  if (token.extensions) existing.extensions = { ...existing.extensions, ...token.extensions }
}
