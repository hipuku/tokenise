# tokenise

Design token conversion in the browser. Live at [tokenise.hipuku.dev](https://tokenise.hipuku.dev).

Converts tokens between the four formats in common use: DTCG 2025.10 JSON, Figma's variables export, Tokens Studio JSON, and a Tailwind v4 `@theme` stylesheet. Every conversion comes with a report of each token that did not come through exactly, and why.

## Tools

**Convert** reads a pasted or opened file, detects its format, and writes it in another. Below the output, the tokens that changed or were dropped are grouped by reason: a mode the target cannot name, a composite it has no slot for, a colour mapped into sRGB with the ΔE it moved, rem multiplied out to px, and eight more.

**Inspect** shows the tokens as they were read, before anything is written: type, value in each mode, and the chain of references each value resolves through.

**Compare** writes one token in all four formats side by side, with what each format could not hold.

## Engineering

Every format is read into one internal model shaped like DTCG 2025.10 and written out of it, so there are four readers and four writers rather than twelve pairwise conversions. The readers are hand-written: the Tailwind reader is a brace-depth scanner rather than a CSS parser, as specifi's stylesheet extraction is. Colour spaces and CIEDE2000 come from culori. The engine in `src/engine/` has no React and no DOM dependency.

The built-in examples are real files from this portfolio: haus's `tokens.json`, which is pre-2025.10 DTCG, and kern's generated Tailwind theme.

See [DESIGN.md](DESIGN.md) for the rationale behind these choices.

## Stack

- React 19 + TypeScript
- Vite, Tailwind CSS v4, [kern](https://github.com/hipuku/kern) (shared component library)
- culori (colour spaces, gamut mapping, CIEDE2000)
- Parkinsans + Geist Mono (Google Fonts)

## Development

```bash
npm install
npm run dev
```

`npm test` runs the engine tests. `npm run build` typechecks and builds.
