import chroma from 'chroma-js'
import colornames from './colornames.json' with { type: 'json' }

export interface NamedColourMatch {
  name: string
  hex: string // the named colour's canonical hex
  distance: number // CIEDE2000 ΔE
}

/** One entry of a name dataset. `@hipuku/colour/names` emits exactly this shape. */
export interface NamedColourEntry {
  hex: string
  name: string
}

interface IndexedEntry extends NamedColourEntry {
  L: number
  a: number
  b: number
}

// Two-stage search: CIE76 (fast Euclidean in Lab) narrows the dataset to
// candidates within a generous radius; CIEDE2000 re-scores for accuracy.
const CIE76_RADIUS = 28

/**
 * Build a matcher over a name dataset.
 *
 * The bundled dataset here is 289 basic colour terms, which is what most callers
 * want and costs nothing to carry. For exhaustive naming, import
 * `@hipuku/colour/names` (31,900 entries, 764KB) and pass its entries in:
 *
 *   const nameColour = createNamedColourMatcher(colourNameEntries())
 *
 * Keeping the data on its own subpath is deliberate. A caller who only wants
 * CIEDE2000 or WCAG contrast should not bundle a name dataset to get it.
 *
 * Lab values are computed on the first query rather than at construction, so
 * building a matcher you never call is free.
 */
export function createNamedColourMatcher(
  entries: NamedColourEntry[],
): (hex: string, topN?: number) => NamedColourMatch[] {
  let indexed: IndexedEntry[] | undefined

  return function nearest(hex: string, topN = 5): NamedColourMatch[] {
    if (!indexed) {
      indexed = entries.map(entry => {
        const [L, a, b] = chroma(entry.hex).lab()
        return { ...entry, L, a, b }
      })
    }

    const [L1, a1, b1] = chroma(hex).lab()

    const candidates: IndexedEntry[] = []
    for (const entry of indexed) {
      const d = Math.sqrt((L1 - entry.L) ** 2 + (a1 - entry.a) ** 2 + (b1 - entry.b) ** 2)
      if (d < CIE76_RADIUS) candidates.push(entry)
    }

    // If nothing is in radius, fall back to the whole set by CIE76.
    const pool = candidates.length > 0 ? candidates : indexed

    // Sort on the raw distance and round only for display. Rounding first put
    // every candidate within 0.05 of another into a tie, and the tiebreak then
    // decided the name: on the 31,900-entry dataset that renamed 8% of colours
    // to something that was not the nearest match. The name comparison stays as
    // a tiebreak for genuinely equal distances, so the result is deterministic.
    return pool
      .map(entry => ({
        name: entry.name,
        hex: entry.hex,
        distance: chroma.deltaE(hex, entry.hex),
      }))
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
      .slice(0, topN)
      .map(match => ({ ...match, distance: Math.round(match.distance * 10) / 10 }))
  }
}

/** The 289 basic colour terms bundled with this package. */
export const basicColourNames: NamedColourEntry[] = Object.entries(colornames as Record<string, string>).map(
  ([rawHex, name]) => ({ hex: `#${rawHex.padStart(6, '0').toLowerCase()}`, name }),
)

/**
 * Closest named colour by CIEDE2000, over the bundled 289 terms.
 * Returns the top N matches (default 5).
 */
export const nearestNamedColour = createNamedColourMatcher(basicColourNames)
