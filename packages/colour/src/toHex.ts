import chroma from 'chroma-js'

/**
 * `color(srgb r g b [/ a])`, the one modern syntax chroma does not parse.
 * Components are 0–1 floats rather than bytes.
 */
function parseColorSrgb(value: string): string | null {
  const m = value.match(/^color\(\s*srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*(?:\/\s*([\d.eE+-]+%?)\s*)?\)$/)
  if (!m) return null

  const channels = [m[1], m[2], m[3]].map(c => parseFloat(c!) * 255)
  if (channels.some(c => !Number.isFinite(c))) return null

  const rawAlpha = m[4]
  const alpha = rawAlpha == null ? 1 : rawAlpha.endsWith('%') ? parseFloat(rawAlpha) / 100 : parseFloat(rawAlpha)
  if (!Number.isFinite(alpha) || alpha === 0) return null

  try {
    return chroma(channels as [number, number, number])
      .alpha(alpha)
      .hex()
      .toLowerCase()
  } catch {
    return null
  }
}

/**
 * `rgb()/rgba()` with out-of-range or fractional channels, which chroma rejects
 * these, but CSS defines them as clamped and rounded, and a probe should not
 * throw away a colour because a stylesheet wrote `rgb(255.6, -3, 128.4)`.
 */
function parseLooseRgb(value: string): string | null {
  const m = value.match(/^rgba?\(([^)]+)\)$/)
  if (!m) return null

  const parts = m[1]!.split(/[,/\s]+/).filter(Boolean)
  if (parts.length < 3) return null

  const channels = parts.slice(0, 3).map(p => {
    const n = p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p)
    return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : NaN
  })
  if (channels.some(c => Number.isNaN(c))) return null

  const rawAlpha = parts[3]
  const alpha = rawAlpha == null ? 1 : rawAlpha.endsWith('%') ? parseFloat(rawAlpha) / 100 : parseFloat(rawAlpha)
  if (!Number.isFinite(alpha) || alpha === 0) return null

  try {
    return chroma(channels as [number, number, number])
      .alpha(Math.min(1, alpha))
      .hex()
      .toLowerCase()
  } catch {
    return null
  }
}

/**
 * Any CSS colour → lowercase hex. Returns null for fully transparent or
 * unparseable input, and appends an alpha pair when 0 < alpha < 1.
 *
 * This exists because `getComputedStyle` does not normalise to `rgb()` any
 * more. A colour authored in OKLCH comes back as `oklch(0.52 0.138 300)`
 * verbatim, so anything reading computed styles has to speak the modern colour
 * syntaxes or silently lose every value.
 *
 * @example
 * toHex('oklch(0.52 0.138 300)')  // '#7653ab'
 * toHex('rgba(0, 0, 0, 0)')       // null, fully transparent
 */
export function toHex(input: string): string | null {
  if (!input) return null

  const value = input.trim().toLowerCase()
  if (value === '' || value === 'transparent' || value === 'none' || value === 'currentcolor') return null

  if (value.startsWith('color(')) return parseColorSrgb(value)
  if (value.startsWith('rgb')) return parseLooseRgb(value)

  let colour: chroma.Color
  try {
    colour = chroma(value)
  } catch {
    return null
  }

  // A fully transparent colour carries no design decision, so treat it as absent
  // rather than as black, which is what its channels would otherwise report.
  if (colour.alpha() === 0) return null

  return colour.hex().toLowerCase()
}
