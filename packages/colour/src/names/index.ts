/**
 * Named colour data.
 *
 * The meodai colour-names dataset: 31,900 hex values with a human name each.
 * Data only, no dependencies and no matching logic, so a project that wants ΔE
 * from `@hipuku/colour` does not pay 764KB for names it never asks about. A
 * subpath rather than a package of its own, so a bundler drops it unless it
 * is imported.
 *
 * Pair it with `createNamedColourMatcher`:
 *
 *   import { colourNameEntries } from '@hipuku/colour/names'
 *   import { createNamedColourMatcher } from '@hipuku/colour'
 *
 *   const nameColour = createNamedColourMatcher(colourNameEntries())
 *   nameColour('#4f84ba')  // [{ name: 'Blue Vault', hex: '#4e83bd', distance: 0.7 }, …]
 */

import raw from './colournames.json' with { type: 'json' }

/** One dataset entry, with the hex normalised to `#rrggbb`. */
export interface ColourNameEntry {
  hex: string
  name: string
}

/**
 * The dataset as stored: keys are six hex digits with no leading `#`, and a
 * value that starts with a zero keeps it (`"00ffff"`), so a key is always six
 * characters. Exposed for a consumer that wants the raw map.
 */
export const colourNames: Record<string, string> = raw

/** How many colours the dataset holds. */
export const COLOUR_NAME_COUNT = Object.keys(raw).length

let entries: ColourNameEntry[] | undefined

/**
 * The dataset as `{ hex, name }` with hexes normalised to `#rrggbb`.
 *
 * Built on first call and then reused. Doing it at module load would cost every
 * importer 31,900 string operations whether or not they name a colour.
 */
export function colourNameEntries(): ColourNameEntry[] {
  if (!entries) {
    entries = Object.entries(colourNames).map(([hex, name]) => ({
      hex: `#${hex.padStart(6, '0').toLowerCase()}`,
      name,
    }))
  }
  return entries
}
