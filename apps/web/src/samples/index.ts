import type { InputDocument } from '@/engine/document'
import type { FormatId } from '@/engine/types'
import mixed from './mixed.dtcg.json?raw'
import figma from './figma.tokens.json?raw'
import tokensStudio from './tokens-studio.json?raw'
import kernPrimitives from './kern-primitives.css?raw'

export interface Sample {
  id: string
  label: string
  /** The format this file is written in: one preset per dialect. */
  format: FormatId
  /** One line on what makes this file interesting to convert. */
  hint: string
  documents: InputDocument[]
}

/**
 * One small preset per source format, so the list itself shows the four dialects
 * and every conversion is meaningful (a preset never converts to its own format
 * by default). Deliberately tiny (not production exports), each shaped to carry
 * a couple of the features the formats disagree about.
 */
export const SAMPLES: Sample[] = [
  {
    id: 'mixed',
    label: 'DTCG · mixed',
    format: 'dtcg',
    hint: 'The standard, with a bit of everything: a reference, rem, a duration, a curve, a wide-gamut colour and a typography composite.',
    documents: [{ name: 'tokens.json', text: mixed }],
  },
  {
    id: 'figma',
    label: 'Figma · variables',
    format: 'figma',
    hint: "Figma's variables export: sRGB colours, an alias, a number-typed radius, and com.figma metadata other formats drop.",
    documents: [{ name: 'variables.tokens.json', text: figma }],
  },
  {
    id: 'tokens-studio',
    label: 'Tokens Studio · theme',
    format: 'tokens-studio',
    hint: 'Tokens Studio JSON: a borderRadius type, a maths expression, a box-shadow composite, and a dark theme.',
    documents: [{ name: 'tokens.json', text: tokensStudio }],
  },
  {
    id: 'kern',
    label: 'Tailwind · theme',
    format: 'tailwind',
    hint: "A real Tailwind v4 theme: light/dark modes and fluid clamp() sizes no JSON format can hold.",
    documents: [{ name: 'primitives.css', text: kernPrimitives }],
  },
]
