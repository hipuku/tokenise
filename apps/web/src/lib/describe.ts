import type { ComponentType } from 'react'
import { ArrowRightLeft, BookOpenCheck, CircleSlash } from 'lucide-react'
import type { AccentColour } from 'kern'
import {
  isColorValue,
  isCubicBezier,
  isDimensionValue,
  isDurationValue,
  colourToCss,
  cubicBezierToCss,
  dimensionToCss,
  durationToCss,
} from '@/engine/values'
import { joinPath, type LossEntry, type LossReason, type TokenValue } from '@/engine/types'

/* ─────────────────────────────────────────────────────────────────────────────
   Words for the loss report, in one place.

   Every reason belongs to one of three outcomes. The other experiments use
   flare for errors; here flare is the accent, so an outcome is never told by
   colour alone. Each carries a label and an icon as well.
   ────────────────────────────────────────────────────────────────────────── */

export type Outcome = 'dropped' | 'changed' | 'read'

export const OUTCOME: Record<Outcome, { label: string; icon: ComponentType<{ className?: string }>; colour: AccentColour }> = {
  dropped: { label: 'Dropped', icon: CircleSlash, colour: 'flare' },
  changed: { label: 'Changed', icon: ArrowRightLeft, colour: 'solstice' },
  read: { label: 'Read leniently', icon: BookOpenCheck, colour: 'dusk' },
}

export const REASON: Record<LossReason, { outcome: Outcome; title: string; explanation: string }> = {
  'dropped-type': {
    outcome: 'dropped',
    title: 'No matching type',
    explanation: 'The target format has no type for these tokens, so they were left out or written with a type no tool will read correctly.',
  },
  'dropped-mode': {
    outcome: 'dropped',
    title: 'Mode dropped',
    explanation: 'The target has no way to name this mode, so its values were not written.',
  },
  'dropped-composite': {
    outcome: 'dropped',
    title: 'Composite dropped',
    explanation: 'The target has no composite of this kind. In Figma, typography and shadows are styles, and the variables export does not carry styles.',
  },
  'unrepresentable-value': {
    outcome: 'dropped',
    title: 'Value has no equivalent',
    explanation: 'The value exists in the source but has no form in the target: a CSS clamp() in JSON, a Tokens Studio expression, a reference that does not resolve.',
  },
  'split-composite': {
    outcome: 'changed',
    title: 'Composite split',
    explanation: 'One token became several. Tailwind writes a type style as a size with companion variables, and has no slot for the family.',
  },
  'resolved-alias': {
    outcome: 'changed',
    title: 'Alias resolved',
    explanation: 'The token referred to another that is not in the output, so its value was written in place of the reference. Changing the original no longer updates it.',
  },
  'converted-colour': {
    outcome: 'changed',
    title: 'Colour converted',
    explanation: 'The target only holds sRGB. Colours in wider spaces were mapped into sRGB, with chroma clamped in OKLCH when out of gamut. The ΔE says how far each one moved.',
  },
  'converted-unit': {
    outcome: 'changed',
    title: 'Unit converted',
    explanation: 'The target has no rem, so rem values were multiplied out at the chosen base. They no longer scale with the reader’s font size.',
  },
  renamed: {
    outcome: 'changed',
    title: 'Renamed',
    explanation: 'The name had to change to be valid in the target, or collided with another token.',
  },
  'dropped-metadata': {
    outcome: 'changed',
    title: 'Metadata dropped',
    explanation: 'The value survived, but its description, deprecation flag or extensions did not. The target has no field for them.',
  },
  'lenient-read': {
    outcome: 'read',
    title: 'Read leniently',
    explanation: 'The source is not valid for its own format here, and was read anyway: a colour as a CSS string, a missing $type, a type the spec does not define.',
  },
}

export interface Summary {
  tokens: number
  exact: number
  changed: number
  dropped: number
}

/** Tokens counted once each, by the most severe outcome any of their entries has. */
export function summarise(tokenPaths: readonly string[][], losses: readonly LossEntry[]): Summary {
  const worst = new Map<string, Outcome>()
  for (const loss of losses) {
    const outcome = REASON[loss.reason].outcome
    if (outcome === 'read') continue
    if (worst.get(loss.token) !== 'dropped') worst.set(loss.token, outcome)
  }
  const names = new Set(tokenPaths.map(joinPath))
  let changed = 0
  let dropped = 0
  for (const [token, outcome] of worst) {
    if (!names.has(token)) continue
    if (outcome === 'dropped') dropped++
    else changed++
  }
  return { tokens: names.size, exact: names.size - changed - dropped, changed, dropped }
}

/** A value as short text for tables. */
export function valueText(value: TokenValue | undefined): string {
  if (!value) return 'none'
  if (value.kind === 'reference') return `{${joinPath(value.ref)}}`
  if (value.kind === 'raw') return value.text
  const v = value.value
  if (isColorValue(v)) return colourToCss(v) ?? JSON.stringify(v)
  if (isDimensionValue(v)) return dimensionToCss(v)
  if (isDurationValue(v)) return durationToCss(v)
  if (isCubicBezier(v)) return cubicBezierToCss(v)
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v.join(', ')
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  return JSON.stringify(v)
}

/** A CSS colour for a swatch, when the value is one. */
export function swatch(value: TokenValue | undefined): string | undefined {
  if (value?.kind !== 'literal' || !isColorValue(value.value)) return undefined
  return colourToCss(value.value) ?? undefined
}
