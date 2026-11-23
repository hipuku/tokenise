import chroma from 'chroma-js'

/**
 * CIEDE2000 perceptual distance between two colours. ~1 is the threshold of
 * human perception; a value under ~2 means the two are effectively identical.
 */
export function deltaE(a: string, b: string): number {
  return chroma.deltaE(a, b)
}
