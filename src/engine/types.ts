/**
 * The internal model every reader targets and every writer reads from.
 *
 * Its shape is DTCG 2025.10's, because that is the most expressive of the four
 * formats: reading into it loses nothing that writing out of it cannot report.
 */

export type FormatId = 'dtcg' | 'figma' | 'tokens-studio' | 'tailwind'

export const FORMAT_LABEL: Record<FormatId, string> = {
  dtcg: 'DTCG 2025.10',
  figma: 'Figma export',
  'tokens-studio': 'Tokens Studio',
  tailwind: 'Tailwind v4',
}

/** The DTCG 2025.10 token types. */
export type TokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'strokeStyle'
  | 'border'
  | 'transition'
  | 'shadow'
  | 'gradient'
  | 'typography'

export const TOKEN_TYPES: readonly TokenType[] = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
]

export const COMPOSITE_TYPES: readonly TokenType[] = [
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
]

export interface ColorValue {
  colorSpace: string
  components: (number | 'none')[]
  alpha?: number
  hex?: string
}

export interface DimensionValue {
  value: number
  unit: 'px' | 'rem'
}

export interface DurationValue {
  value: number
  unit: 'ms' | 's'
}

/** A reference to another token, by path. */
export interface Reference {
  ref: string[]
}

/**
 * A value in DTCG 2025.10 shape: a colour or dimension object, a number, a
 * string, an array, or a composite object whose fields may themselves be
 * references. `raw` holds a source value the model has no shape for, such as a
 * CSS `clamp()`, kept so a writer that can hold it (Tailwind, Tokens Studio)
 * can still write it.
 */
export type Literal =
  | ColorValue
  | DimensionValue
  | DurationValue
  | number
  | string
  | readonly unknown[]
  | { readonly [key: string]: unknown }

export type TokenValue = { kind: 'literal'; value: Literal } | { kind: 'reference'; ref: string[] } | { kind: 'raw'; text: string }

export interface Token {
  path: string[]
  /** A DTCG type, or null when the source type has no DTCG equivalent. */
  type: TokenType | null
  /** The type as the source wrote it, when it was not a DTCG type. */
  sourceType?: string
  /** One value per mode name. A single-mode set has one entry. */
  values: Record<string, TokenValue>
  description?: string
  deprecated?: boolean | string
  extensions?: Record<string, unknown>
}

export interface TokenSet {
  /** Mode names in order. The first is the default. */
  modes: string[]
  tokens: Token[]
}

export type LossReason =
  | 'dropped-type'
  | 'dropped-mode'
  | 'resolved-alias'
  | 'split-composite'
  | 'dropped-composite'
  | 'converted-colour'
  | 'converted-unit'
  | 'unrepresentable-value'
  | 'renamed'
  | 'dropped-metadata'
  | 'lenient-read'

export const LOSS_REASONS: readonly LossReason[] = [
  'lenient-read',
  'dropped-type',
  'dropped-mode',
  'dropped-composite',
  'unrepresentable-value',
  'split-composite',
  'resolved-alias',
  'converted-colour',
  'converted-unit',
  'renamed',
  'dropped-metadata',
]

export interface LossEntry {
  reason: LossReason
  /** The token path, joined with dots. */
  token: string
  mode?: string
  detail: string
}

export interface ReadResult {
  set: TokenSet
  losses: LossEntry[]
}

export interface OutputFile {
  name: string
  text: string
}

export interface WriteResult {
  files: OutputFile[]
  losses: LossEntry[]
}

export interface WriteOptions {
  /** Pixels per rem, for converting between the two. */
  remBase: number
  /** How a Tailwind stylesheet switches modes. */
  tailwindModeSelector: 'data-theme' | 'class' | 'media'
}

export const DEFAULT_OPTIONS: WriteOptions = {
  remBase: 16,
  tailwindModeSelector: 'data-theme',
}

export class ReadError extends Error {}

export const joinPath = (path: readonly string[]) => path.join('.')
