import chroma from 'chroma-js'

export interface Oklch {
  /** Perceptual lightness, 0 to 1. */
  l: number
  /** Chroma. 0 is a true grey; around 0.37 is the most saturated sRGB can reach. */
  c: number
  /**
   * Hue in degrees, 0 to 360, or null when the colour is achromatic and has no
   * hue to report. Null rather than NaN, so a caller has to decide what a grey
   * means instead of propagating a value that fails every comparison silently.
   */
  h: number | null
}

/**
 * A hex in OKLCH. Returns null if it will not parse.
 *
 * OKLCH separates lightness from chroma in a way HSL does not: HSL saturation
 * inflates at the extremes of lightness, so a near-black or near-white with a
 * slight tint reads as a strongly saturated hue. Every judgement about whether a
 * colour is "a grey" or "a blue" wants chroma, not saturation.
 */
export function oklch(hex: string): Oklch | null {
  let l: number
  let c: number
  let h: number
  try {
    ;[l, c, h] = chroma(hex).oklch()
  } catch {
    return null
  }
  if (!Number.isFinite(l) || !Number.isFinite(c)) return null
  return { l, c, h: Number.isFinite(h) ? ((h % 360) + 360) % 360 : null }
}

/**
 * Chroma below which a colour is treated as a neutral rather than a tinted hue.
 * Sits well clear of both sides: the tinted greys a design system ships measure
 * under 0.02, and the least saturated colour anyone would call a hue is around
 * 0.17.
 */
export const NEUTRAL_CHROMA = 0.03

/** A named hue range. `min` above `max` wraps past 360. */
export interface HueFamily {
  name: string
  min: number
  max: number
}

/**
 * Hue families, ordered round the wheel from red. `min` above `max` wraps.
 *
 * The boundaries are fitted to 4,275 human-named colours rather than derived.
 * Every entry in `@hipuku/colour/names` whose name ends in a family word, and whose
 * previous word is not also one ("Blue Green" is nobody's evidence), is a colour
 * a person decided the family of: 1,094 Greens, 1,070 Blues, 509 Reds and so on.
 * The eight boundaries are the set that maximises mean per-family recall over
 * that data, which `hue-families.test.ts` asserts and holds at 0.77.
 *
 * They replace a set derived as the midpoints between the measured hues of the
 * eight colours the families are named after. That construction is only right if
 * a family is centred on the colour it is named after, and the data says several
 * are not. The colour called orange sits at hue 71, while the median of 222
 * colours people call orange is 47, so a midpoint at 50 put more than half of
 * them in Red. Purple was worse: its median is 312 and the bin ended at 310.
 *
 * These are not the HSL numbers either. OKLCH hue is a different wheel, and
 * reusing HSL's boundaries (red 0, yellow 60, green 120, blue 240) offsets every
 * family by roughly one place: it puts #ff0000 in Orange and #0000ff in Purple.
 *
 * Two edges are judgement rather than fit. Orange ends at 72 rather than the
 * fitted 70, because #ffa500 is at 71 and a vocabulary that cannot name the
 * colour called orange is not usable; it costs 0.002 of accuracy. And no
 * boundary separates purple from magenta: #800080 and #ff00ff are both at hue
 * 328 and differ only in lightness and chroma. 328 is Purple here, because far
 * more real colours at that hue are called purple than magenta.
 */
export const HUE_FAMILIES = [
  { name: 'Red', min: 11, max: 34 },
  { name: 'Orange', min: 34, max: 72 },
  { name: 'Yellow', min: 72, max: 111 },
  { name: 'Green', min: 111, max: 170 },
  { name: 'Cyan', min: 170, max: 208 },
  { name: 'Blue', min: 208, max: 276 },
  { name: 'Purple', min: 276, max: 338 },
  { name: 'Pink', min: 338, max: 11 },
] as const satisfies readonly HueFamily[]

/**
 * What the default vocabulary can return. A union rather than `string`, because
 * both consumers compare this to literals and group a UI by it, and a boundary
 * that moves is otherwise invisible until someone looks at a colour page. A
 * renamed family should fail a typecheck.
 */
export type HueFamilyName = (typeof HUE_FAMILIES)[number]['name'] | 'Neutral'

/**
 * Family name for a hex: one of HUE_FAMILIES, or "Neutral" below NEUTRAL_CHROMA.
 * Returns null if the hex will not parse.
 *
 * Called with one argument it returns a HueFamilyName. Called with a vocabulary
 * of your own it returns a plain string, because the names are yours.
 *
 * @param families override the bins to use a different vocabulary
 * @param neutralChroma override the neutral cut
 */
export function hueFamily(hex: string): HueFamilyName | null
export function hueFamily(hex: string, families: readonly HueFamily[], neutralChroma?: number): string | null
export function hueFamily(
  hex: string,
  families: readonly HueFamily[] = HUE_FAMILIES,
  neutralChroma: number = NEUTRAL_CHROMA,
): string | null {
  const colour = oklch(hex)
  if (!colour) return null
  if (colour.h === null || colour.c < neutralChroma) return 'Neutral'
  for (const family of families) {
    const inBin =
      family.min > family.max
        ? colour.h >= family.min || colour.h < family.max
        : colour.h >= family.min && colour.h < family.max
    if (inBin) return family.name
  }
  return families[0]?.name ?? 'Neutral'
}
