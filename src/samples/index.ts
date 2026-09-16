import type { InputDocument } from '@/engine/document'
import hausTokens from './haus.tokens.json?raw'
import kernPrimitives from './kern-primitives.css?raw'

export interface Sample {
  id: string
  label: string
  documents: InputDocument[]
}

/**
 * Two real files from this portfolio rather than invented ones, because each
 * already shows the problem: haus's is pre-2025.10 DTCG with CSS in some of its
 * values, and kern's is a Tailwind v4 theme with fluid `clamp()` sizes no JSON
 * format can hold.
 */
export const SAMPLES: Sample[] = [
  {
    id: 'haus',
    label: 'haus tokens.json',
    documents: [{ name: 'tokens.json', text: hausTokens }],
  },
  {
    id: 'kern',
    label: 'kern theme',
    documents: [{ name: 'primitives.css', text: kernPrimitives }],
  },
]
