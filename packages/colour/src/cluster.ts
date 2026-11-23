import chroma from 'chroma-js'

export interface ColourCluster {
  representative: string // hex, the colour closest to the cluster centroid
  members: string[] // all hex values in the cluster
  size: number
}

/**
 * Groups colours by CIEDE2000 perceptual distance.
 * Two colours belong to the same cluster when their ΔE < threshold.
 * Uses single-linkage: any member within threshold of a new colour
 * pulls it into that cluster. Returns clusters sorted by size descending.
 */
export function clusterByPerceptualDistance(hexes: string[], threshold = 8): ColourCluster[] {
  if (hexes.length === 0) return []

  const unique = [...new Set(hexes.map(h => h.toLowerCase()))]
  const clusterOf: number[] = unique.map((_, i) => i)

  function find(i: number): number {
    if (clusterOf[i] !== i) clusterOf[i] = find(clusterOf[i])
    return clusterOf[i]
  }

  function union(i: number, j: number) {
    const ri = find(i),
      rj = find(j)
    if (ri !== rj) clusterOf[ri] = rj
  }

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (chroma.deltaE(unique[i], unique[j]) < threshold) {
        union(i, j)
      }
    }
  }

  const groups = new Map<number, string[]>()
  for (let i = 0; i < unique.length; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(unique[i])
  }

  return [...groups.values()]
    .map(members => ({
      representative: centroid(members),
      members,
      size: members.length,
    }))
    .sort((a, b) => b.size - a.size)
}

function centroid(hexes: string[]): string {
  const labs = hexes.map(h => chroma(h).lab())
  const mean = labs
    .reduce((acc, [L, a, b]) => [acc[0] + L, acc[1] + a, acc[2] + b], [0, 0, 0])
    .map(v => v / labs.length) as [number, number, number]

  let best = hexes[0]
  let bestDist = Infinity
  for (const h of hexes) {
    const [L, a, b] = chroma(h).lab()
    const dist = Math.hypot(L - mean[0], a - mean[1], b - mean[2])
    if (dist < bestDist) {
      bestDist = dist
      best = h
    }
  }
  return best
}
