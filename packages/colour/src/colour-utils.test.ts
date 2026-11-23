import { describe, it, expect } from 'vitest'
import chroma from 'chroma-js'
import { generateLightnessScale } from './lightnessScale.js'
import { basicColourNames, createNamedColourMatcher } from './namedColour.js'
import { hueFamily, oklch, HUE_FAMILIES } from './oklch.js'
import { wcagContrast, isLight, suggestTextColour } from './contrast.js'
import { clusterByPerceptualDistance } from './cluster.js'
import { nearestNamedColour } from './namedColour.js'

describe('generateLightnessScale', () => {
  it('returns the requested number of steps', () => {
    const scale = generateLightnessScale('#3b82f6', { steps: 10 })
    expect(scale).toHaveLength(10)
  })

  it('returns valid hex strings', () => {
    const scale = generateLightnessScale('#e11d48', { steps: 5 })
    for (const hex of scale) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('goes from light to dark', () => {
    const scale = generateLightnessScale('#7c3aed', { steps: 5 })
    const first = chroma(scale[0]).luminance()
    const last = chroma(scale[4]).luminance()
    expect(first).toBeGreaterThan(last)
  })
})

describe('wcagContrast', () => {
  it('black on white passes AAA', () => {
    const result = wcagContrast('#000000', '#ffffff')
    expect(result.ratio).toBeGreaterThan(20)
    expect(result.passAA).toBe(true)
    expect(result.passAAA).toBe(true)
  })

  it('light grey on white fails AA', () => {
    const result = wcagContrast('#cccccc', '#ffffff')
    expect(result.passAA).toBe(false)
  })

  it('ratio is rounded to 2 decimal places', () => {
    const result = wcagContrast('#000000', '#ffffff')
    expect(result.ratio).toBe(Math.round(result.ratio * 100) / 100)
  })

  // WCAG compares the ratio itself with the threshold, without rounding: 4.496:1
  // fails 4.5:1. These three sit just under each threshold and display as exactly
  // it, which is where rounding before comparing went wrong (hipuku/haus#136).
  it('compares the unrounded ratio with the AA threshold', () => {
    const result = wcagContrast('#007cc3', '#ffffff') // 4.4957:1
    expect(result.ratio).toBe(4.5)
    expect(result.passAA).toBe(false)
  })

  it('compares the unrounded ratio with the AAA threshold', () => {
    const result = wcagContrast('#003cf8', '#ffffff') // 6.9958:1
    expect(result.ratio).toBe(7)
    expect(result.passAAA).toBe(false)
  })

  it('compares the unrounded ratio with the large-text threshold', () => {
    const result = wcagContrast('#009bf5', '#ffffff') // 2.9970:1
    expect(result.ratio).toBe(3)
    expect(result.passAALarge).toBe(false)
  })
})

describe('isLight', () => {
  it('white is light', () => expect(isLight('#ffffff')).toBe(true))
  it('black is not light', () => expect(isLight('#000000')).toBe(false))
  it('mid grey is not light (below 0.35 luminance)', () => {
    expect(isLight('#808080')).toBe(false)
  })
})

describe('suggestTextColour', () => {
  it('returns black for a light background from palette', () => {
    const result = suggestTextColour('#ffffff', ['#000000', '#ffffff', '#888888'])
    expect(result).toBe('#000000')
  })

  it('falls back to white on dark background when palette is empty', () => {
    expect(suggestTextColour('#000000', [])).toBe('#ffffff')
  })

  it('falls back to black on light background when palette is empty', () => {
    expect(suggestTextColour('#ffffff', [])).toBe('#000000')
  })
})

describe('clusterByPerceptualDistance', () => {
  it('returns empty array for empty input', () => {
    expect(clusterByPerceptualDistance([])).toEqual([])
  })

  it('groups near-identical colours into one cluster', () => {
    const clusters = clusterByPerceptualDistance(['#ff0000', '#fe0000', '#fd0000'])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].size).toBe(3)
  })

  it('keeps perceptually distinct colours separate', () => {
    const clusters = clusterByPerceptualDistance(['#ff0000', '#0000ff', '#00ff00'])
    expect(clusters.length).toBeGreaterThanOrEqual(2)
  })

  it('deduplicates identical hexes', () => {
    const clusters = clusterByPerceptualDistance(['#ff0000', '#ff0000', '#ff0000'])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].size).toBe(1)
  })

  it('representative is a valid hex', () => {
    const clusters = clusterByPerceptualDistance(['#c0392b', '#e74c3c'])
    expect(clusters[0].representative).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('nearestNamedColour', () => {
  it('returns topN results', () => {
    const matches = nearestNamedColour('#ff0000', 3)
    expect(matches).toHaveLength(3)
  })

  it('nearest match for pure red is "red"', () => {
    const matches = nearestNamedColour('#ff0000', 1)
    expect(matches[0].name).toBe('red')
  })

  it('nearest match for pure blue is "blue"', () => {
    const matches = nearestNamedColour('#0000ff', 1)
    expect(matches[0].name).toBe('blue')
  })

  it('results are sorted by distance ascending', () => {
    const matches = nearestNamedColour('#ff8800', 5)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].distance).toBeGreaterThanOrEqual(matches[i - 1].distance)
    }
  })

  it('each match has a valid hex', () => {
    for (const m of nearestNamedColour('#123456', 5)) {
      expect(m.hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('createNamedColourMatcher', () => {
  it('matches against the dataset it is given, not the bundled one', () => {
    const nameColour = createNamedColourMatcher([
      { hex: '#ff0000', name: 'Only Red' },
      { hex: '#0000ff', name: 'Only Blue' },
    ])
    expect(nameColour('#fe0202', 1)[0]!.name).toBe('Only Red')
  })

  it('breaks a tie on equal distance by name, so the order is not the dataset order', () => {
    // Two entries equidistant from the query. Without a tie break the winner is
    // whichever the dataset listed first, and a reordered dataset changes the answer.
    const forwards = createNamedColourMatcher([
      { hex: '#ff0000', name: 'Zulu Red' },
      { hex: '#ff0000', name: 'Alpha Red' },
    ])
    const backwards = createNamedColourMatcher([
      { hex: '#ff0000', name: 'Alpha Red' },
      { hex: '#ff0000', name: 'Zulu Red' },
    ])
    expect(forwards('#ff0000')[0]!.name).toBe('Alpha Red')
    expect(backwards('#ff0000')[0]!.name).toBe('Alpha Red')
  })

  it('ranks on the true distance, not the rounded one', () => {
    // Two entries whose distances round to the same tenth. The nearer one has to
    // win, and it is the one the name tiebreak would put second, so a matcher
    // that rounds before sorting fails here. On the 31,900-entry dataset that
    // mistake renamed 8% of colours.
    // Both are ΔE 1.0 from #808080 once rounded: 0.9567 and 0.9996.
    const nameColour = createNamedColourMatcher([
      { hex: '#7e7e7d', name: 'Alpha Grey' },
      { hex: '#7e7e7f', name: 'Zulu Grey' },
    ])
    const [first, second] = nameColour('#808080', 2)
    expect(first!.name).toBe('Zulu Grey')
    expect(first!.distance).toBe(second!.distance)
  })

  it('returns an empty list for an empty dataset rather than throwing', () => {
    expect(createNamedColourMatcher([])('#ff0000')).toEqual([])
  })

  it('bundles 289 basic colour terms', () => {
    expect(basicColourNames).toHaveLength(289)
    for (const entry of basicColourNames) expect(entry.hex).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('oklch', () => {
  it('reports lightness, chroma and hue', () => {
    const red = oklch('#ff0000')!
    expect(red.l).toBeCloseTo(0.628, 2)
    expect(red.c).toBeCloseTo(0.258, 2)
    expect(red.h).toBeCloseTo(29.2, 0)
  })

  it('reports no hue for a true grey rather than NaN', () => {
    expect(oklch('#2b2b2b')!.h).toBeNull()
    expect(oklch('#000000')!.h).toBeNull()
  })

  it('returns null for a colour it cannot parse', () => {
    expect(oklch('not a colour')).toBeNull()
  })
})

describe('hueFamily', () => {
  it('calls tinted near-blacks and near-whites Neutral', () => {
    // The greys a design system ships. HSL saturation reads these as hues,
    // which is the whole reason this is chroma-based.
    for (const hex of ['#0b0b14', '#101820', '#f7f7fa', '#12100e', '#8a8f98', '#2b2b2b']) {
      expect(hueFamily(hex)).toBe('Neutral')
    }
  })

  it('names the primaries as themselves', () => {
    // The bins are midpoints between measured OKLCH hues, not the HSL numbers.
    // Reusing HSL's boundaries offsets every family by roughly one place, which
    // is how #ff0000 ends up called Orange and #0000ff called Purple.
    expect(hueFamily('#ff0000')).toBe('Red')
    expect(hueFamily('#ffff00')).toBe('Yellow')
    expect(hueFamily('#00ff00')).toBe('Green')
    expect(hueFamily('#0000ff')).toBe('Blue')
  })

  it('names the hues a site actually uses', () => {
    expect(hueFamily('#2563eb')).toBe('Blue')
    expect(hueFamily('#16a34a')).toBe('Green')
    expect(hueFamily('#dc2626')).toBe('Red')
    expect(hueFamily('#ffa500')).toBe('Orange')
    expect(hueFamily('#ec4899')).toBe('Pink')
    expect(hueFamily('#7c3aed')).toBe('Purple')
  })

  it('covers the whole wheel with no gap between bins', () => {
    for (let h = 0; h < 360; h += 1) {
      const named = HUE_FAMILIES.some(f => (f.min > f.max ? h >= f.min || h < f.max : h >= f.min && h < f.max))
      expect(named, `hue ${h} falls in no family`).toBe(true)
    }
  })

  it('accepts a different vocabulary', () => {
    expect(hueFamily('#ff0000', [{ name: 'Warm', min: 300, max: 90 }])).toBe('Warm')
  })

  it('returns null for a colour it cannot parse', () => {
    expect(hueFamily('nope')).toBeNull()
  })
})
