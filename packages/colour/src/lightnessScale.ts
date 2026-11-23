import chroma from 'chroma-js'

export interface LightnessScaleOptions {
  steps?: number
  minL?: number
  maxL?: number
}

/**
 * Generates a perceptually uniform lightness scale in LCH space.
 * Hue and chroma are preserved from the base colour; only L varies.
 * Returns hex strings from lightest to darkest.
 */
export function generateLightnessScale(hex: string, options: LightnessScaleOptions = {}): string[] {
  const { steps = 10, minL = 8, maxL = 97 } = options

  const base = chroma(hex)
  const [, c, h] = base.lch()

  // Scale chroma down toward the extremes so light/dark steps don't
  // look over-saturated. This mirrors how CSS palettes are tuned.
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    const L = maxL - t * (maxL - minL)
    // Reduce chroma at very light and very dark ends
    const cScale = 1 - Math.abs(t - 0.5) * 0.9
    const C = c * cScale
    try {
      return chroma.lch(L, C, isNaN(h) ? 0 : h).hex()
    } catch {
      return chroma.lch(L, 0, 0).hex()
    }
  })
}
