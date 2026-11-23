# @hipuku/colour

Colour maths for design tools, on chroma-js: CIEDE2000 distance, WCAG contrast, OKLCH and hue
families, perceptual clustering, lightness scales, hex normalising, and nearest-name matching.
The 31,900-entry colour-name dataset is on its own subpath, so code that only needs the maths does
not bundle 764KB of names.

Not published yet. Version 0.1.0 is unreleased. It replaces `haus-colour-utils` and
`haus-colour-names`, which stay published until their consumers move.

## Use

```ts
import { deltaE, wcagContrast, createNamedColourMatcher } from '@hipuku/colour'
import { colourNameEntries } from '@hipuku/colour/names'

deltaE('#4f84ba', '#4e83bd') // 0.66
wcagContrast('#000', '#fff').ratio // 21

const nameColour = createNamedColourMatcher(colourNameEntries())
nameColour('#4f84ba')[0] // { name: 'Blue Vault', hex: '#4e83bd', distance: 0.7 }
```

## Exports

| From | What |
| ---- | ---- |
| `@hipuku/colour` | `toHex`, `deltaE`, `wcagContrast`, `isLight`, `suggestTextColour`, `clusterByPerceptualDistance`, `generateLightnessScale`, `oklch`, `hueFamily`, `HUE_FAMILIES`, `NEUTRAL_CHROMA`, `nearestNamedColour`, `createNamedColourMatcher`, `basicColourNames` |
| `@hipuku/colour/names` | `colourNames`, `colourNameEntries`, `COLOUR_NAME_COUNT` |

`nearestNamedColour` and `basicColourNames` use a bundled set of 289 basic colour terms.
