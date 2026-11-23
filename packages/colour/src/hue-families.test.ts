import { describe, it, expect } from 'vitest'
import { colourNameEntries } from './names/index.js'
import { hueFamily, oklch, HUE_FAMILIES, NEUTRAL_CHROMA } from './oklch.js'

/**
 * The hue bins are fitted rather than derived, so the fit is what has to be
 * held. A boundary is one number, easy to move for one colour that looked
 * wrong, and nothing else in the package would notice a change that made the
 * other 4,274 worse.
 *
 * The labelled set is built here rather than committed: every entry in
 * `@hipuku/colour/names` whose name ends in a family word, and whose previous word
 * is not also one, is a colour a person decided the family of. "Persian Blue"
 * counts, "Blue Green" does not.
 */
const FAMILY_WORDS: Record<string, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  cyan: 'Cyan',
  teal: 'Cyan',
  turquoise: 'Cyan',
  aqua: 'Cyan',
  blue: 'Blue',
  purple: 'Purple',
  violet: 'Purple',
  pink: 'Pink',
  magenta: 'Pink',
}

interface Labelled {
  hex: string
  family: string
}

function labelledColours(): Labelled[] {
  const out: Labelled[] = []
  for (const { hex, name } of colourNameEntries()) {
    const words = name.match(/[A-Za-z']+/g)
    if (!words || words.length < 2) continue
    const last = words[words.length - 1]!.toLowerCase()
    const previous = words[words.length - 2]!.toLowerCase()
    const family = FAMILY_WORDS[last]
    if (!family || previous in FAMILY_WORDS) continue
    const colour = oklch(hex)
    if (!colour || colour.h === null || colour.c < NEUTRAL_CHROMA) continue
    out.push({ hex, family })
  }
  return out
}

/**
 * Mean per-family recall, not plain accuracy. There are five times as many
 * labelled greens as oranges, so plain accuracy can rise while a small family
 * is emptied into its neighbour, which is the failure this file exists to
 * catch.
 */
function meanRecall(colours: Labelled[]): number {
  const total = new Map<string, number>()
  const correct = new Map<string, number>()
  for (const { hex, family } of colours) {
    total.set(family, (total.get(family) ?? 0) + 1)
    if (hueFamily(hex) === family) correct.set(family, (correct.get(family) ?? 0) + 1)
  }
  let sum = 0
  for (const family of total.keys()) sum += (correct.get(family) ?? 0) / total.get(family)!
  return sum / total.size
}

describe('the hue bins against human naming', () => {
  it('reads the dataset it is meant to measure against', () => {
    // A filter that stopped matching would leave an empty set, and an empty set
    // makes every assertion below pass by having nothing to disagree with.
    expect(labelledColours().length).toBeGreaterThan(4000)
  })

  it('agrees with the name a person gave, per family', () => {
    // 0.78 as fitted. The floor is 0.77: a boundary may move for a reason, but
    // not at the cost of the fit. The set derived from midpoints scored 0.62.
    expect(meanRecall(labelledColours())).toBeGreaterThan(0.77)
  })

  it('names every family it declares', () => {
    // A family whose bin no colour reaches is a name in a legend and nothing
    // else, which is how a boundary edit goes wrong quietly.
    const reached = new Set(labelledColours().map(({ hex }) => hueFamily(hex)))
    for (const { name } of HUE_FAMILIES) expect(reached, `${name} is unreachable`).toContain(name)
  })
})

describe('the colours the families are named after', () => {
  // The fit is over names people wrote, and the eight canonical colours are the
  // one place where being right is not a matter of degree.
  const canonical: Array<[string, string]> = [
    ['#ff0000', 'Red'],
    ['#ffa500', 'Orange'],
    ['#ffff00', 'Yellow'],
    ['#008000', 'Green'],
    ['#00ff00', 'Green'],
    ['#00ffff', 'Cyan'],
    ['#008080', 'Cyan'],
    ['#0000ff', 'Blue'],
    ['#000080', 'Blue'],
    ['#87ceeb', 'Blue'],
    ['#800080', 'Purple'],
    ['#4b0082', 'Purple'],
    ['#ee82ee', 'Purple'],
    ['#ffc0cb', 'Pink'],
    ['#ec4899', 'Pink'],
  ]

  it.each(canonical)('%s is %s', (hex, family) => {
    expect(hueFamily(hex)).toBe(family)
  })

  it('cannot separate purple from magenta, and says so', () => {
    // #800080 and #ff00ff are both hue 328: they differ in lightness and chroma
    // and not at all in the thing these bins read. Recorded as a test so the
    // limit is a decision rather than a surprise, and so a future boundary move
    // has to face it.
    const purple = oklch('#800080')!
    const magenta = oklch('#ff00ff')!
    expect(Math.abs(purple.h! - magenta.h!)).toBeLessThan(1)
    expect(hueFamily('#ff00ff')).toBe('Purple')
  })
})
