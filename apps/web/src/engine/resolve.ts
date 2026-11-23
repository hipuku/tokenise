import { joinPath, type Token, type TokenSet, type TokenValue } from './types'

export type Index = Map<string, Token>

export const indexTokens = (set: TokenSet): Index => new Map(set.tokens.map((t) => [joinPath(t.path), t]))

/** A token's value in a mode, falling back to the default mode when the mode does not override it. */
export function valueIn(token: Token, mode: string, modes: readonly string[]): TokenValue | undefined {
  return token.values[mode] ?? token.values[modes[0]] ?? Object.values(token.values)[0]
}

export interface Resolution {
  /** The first non-reference value, or undefined when the chain breaks or loops. */
  value?: TokenValue
  /** Every path the chain passed through, starting with the token's own references. */
  chain: string[]
  problem?: 'missing' | 'cycle'
}

/** Follow references from a value until a literal or raw value. */
export function resolveValue(value: TokenValue, mode: string, set: TokenSet, index: Index): Resolution {
  const chain: string[] = []
  let current: TokenValue | undefined = value
  while (current?.kind === 'reference') {
    const key = joinPath(current.ref)
    if (chain.includes(key)) return { chain, problem: 'cycle' }
    chain.push(key)
    const target = index.get(key)
    if (!target) return { chain, problem: 'missing' }
    current = valueIn(target, mode, set.modes)
  }
  return { value: current, chain }
}

/**
 * An alias takes its target's type (DTCG 2025.10, and what every other format
 * assumes). Readers that meet an untyped reference leave the type empty; this
 * fills it in once the whole set is read.
 */
export function inferReferenceTypes(set: TokenSet): void {
  const index = indexTokens(set)
  for (const token of set.tokens) {
    if (token.type) continue
    const value = valueIn(token, set.modes[0], set.modes)
    if (value?.kind !== 'reference') continue
    const { chain } = resolveValue(value, set.modes[0], set, index)
    for (let i = chain.length - 1; i >= 0; i--) {
      const type = index.get(chain[i])?.type
      if (type) {
        token.type = type
        break
      }
    }
  }
}

/** Why a token has no type, for the loss report. */
export function untypedDetail(token: Token, mode: string, what: string): string {
  if (token.sourceType) return `"${token.sourceType}" has no ${what}.`
  const value = token.values[mode] ?? Object.values(token.values)[0]
  const shown = value?.kind === 'raw' ? `"${value.text}"` : 'The value'
  return `${shown} has no type, and none could be inferred.`
}

/** Does any mode of this token differ from the default mode? Used to write only overrides per mode. */
export const sameValue = (a: TokenValue | undefined, b: TokenValue | undefined) =>
  JSON.stringify(a) === JSON.stringify(b)
