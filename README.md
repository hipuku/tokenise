# tokenise

Design token conversion in the browser. Live at [tokenise.hipuku.dev](https://tokenise.hipuku.dev).

Converts tokens between the four formats in common use: DTCG 2025.10 JSON, Figma's variables export, Tokens Studio JSON, and a Tailwind v4 `@theme` stylesheet. Every conversion comes with a report of each token that did not come through exactly, and why.

## Tools

**Convert** — paste a token file on the left, read it in another format on the right. Detection is automatic; conversion works in any direction. Input is paste-only, and both fields are syntax-highlighted.

**Compare a token** — the reference. Eleven fixed examples (typography, shadow, wide-gamut colour, rem spacing, font stack, easing curve, transition, gradient, light and dark, a reference, a raw expression), each chosen because the formats handle it differently. Each shows a verdict per format, a part-by-part table of what each format wrote, and the token as each format writes it.

**Check a file** — the report. Paste or open your own tokens; the format is always detected. The input is one always-visible text field: paste into it, drop files on it, or use Open file; Clear empties it. **Format fidelity** leads: a stacked bar per format showing how much of the file keeps its meaning. Below it, pick a target format to see your tokens grouped by dropped, changed and same meaning, each with every reason.

Each tool starts fresh: nothing pasted in one carries into another.

## Engineering

Every format is read into one internal model shaped like DTCG 2025.10 and written out of it, so there are four readers and four writers rather than twelve pairwise conversions. The readers are hand-written: the Tailwind reader is a brace-depth scanner rather than a CSS parser, as specifi's stylesheet extraction is. Colour spaces and CIEDE2000 come from culori. The engine in `src/engine/` has no React and no DOM dependency.

There is one small preset per source format — a DTCG mix, a Figma variables export, a Tokens Studio theme, and kern's real Tailwind theme — so the list itself shows the four dialects and no preset converts to its own format by default. Each is hand-made and tiny, shaped to carry a couple of the features the formats disagree about. haus's larger `tokens.json` stays in the repo as a test fixture.

See [DESIGN.md](DESIGN.md) for the rationale behind these choices.

## Stack

- React 19 + TypeScript
- Vite, Tailwind CSS v4, [kern](https://github.com/hipuku/kern) (shared component library)
- culori (colour spaces, gamut mapping, CIEDE2000)
- react-simple-code-editor (highlighted, editable code fields; highlighter is hand-written)
- Parkinsans + Geist Mono (Google Fonts)

## Development

```bash
npm install
npm run dev
```

`npm test` runs the engine tests. `npm run build` typechecks and builds.
