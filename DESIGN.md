# tokenise design notes

What this tool does and why each significant decision was made. If something in the code looks over-engineered or under-engineered, the answer is probably here.

---

## What it is

A design token converter between four formats: DTCG 2025.10, Figma's native variables export, Tokens Studio, and Tailwind v4. It runs entirely in the browser. The conversion is not the point on its own, since Style Dictionary, Terrazzo and several Figma plugins already convert. The point is the loss report: every token that did not come through exactly, with a typed reason.

---

## One model, four readers, four writers

Every reader produces the same `TokenSet`, and every writer consumes it. There is no path from one format directly to another.

Pairwise conversion would need twelve paths, and each would make its own decisions about the same problems: what to do with a mode, a reference, a colour outside sRGB. With one model, a decision is made once, in the writer for the format that cannot hold something, and the loss is reported from that one place.

The model is shaped like DTCG 2025.10 because that is the most expressive of the four. It has modes (through the resolver module), references, composite types and every CSS colour space. Reading into it loses nothing the writers cannot report.

Two things the model keeps that DTCG does not:

- **`raw` values.** A Tailwind `clamp(1rem, 2vw, 2rem)` or a Tokens Studio expression `{spacing.base} * 2` has no DTCG form. It is kept as text so a writer that can hold it (Tailwind, Tokens Studio) still writes it, and a writer that cannot reports `unrepresentable-value`.
- **`sourceType`.** A Tokens Studio `borderRadius` is a DTCG `dimension`, but writing back to Tokens Studio restores `borderRadius`. A plain custom property from a stylesheet keeps its own name when written back to Tailwind.

---

## Leniency is reported, never silent

Most DTCG files in use predate 2025.10. haus's `tokens.json` writes colours as CSS strings, uses a `$type` of `string` the spec does not define, and has values such as `var(--haus-radius-md)` that are CSS rather than DTCG. A strict reader would reject the file; a silent lenient one would make it look valid.

tokenise reads it and adds a `lenient-read` entry for each thing it forgave. A value that could not be typed at all is dropped by every writer, with the value quoted in the reason.

---

## Loss reasons

Eleven reasons in three outcomes. **Dropped**: `dropped-type`, `dropped-mode`, `dropped-composite`, `unrepresentable-value`. **Changed**: `split-composite`, `resolved-alias`, `converted-colour`, `converted-unit`, `renamed`, `dropped-metadata`. **Read leniently**: `lenient-read`.

The summary counts each token once, by its worst outcome, so a token with a converted colour and a dropped description counts as changed, not twice.

An empty report is a claim that every token round-trips. The tests hold it to that for DTCG, Figma and Tailwind round trips, and for kern's real theme.

---

## Colour

A colour keeps the space it was authored in until a writer needs sRGB. Figma variables and Tokens Studio colours are sRGB, so those writers map into sRGB with chroma reduced in OKLCH until the colour is in gamut (culori's `toGamut('rgb', 'oklch')`), and report the CIEDE2000 distance between the source and the result. An in-gamut `oklch()` reports ΔE 0; an out-of-gamut one reports how far it moved.

DTCG 2025.10 and culori scale some components differently (HSL and HWB percentages are 0–100 in DTCG and 0–1 in culori), so the mapping between them is written out once in `values.ts`.

One library throughout. In vault, culori and chroma-js clamped the same out-of-gamut OKLCH value differently and produced different contrast ratios for the same pair.

---

## Tailwind: a scanner, not a parser

The Tailwind reader needs each custom property declaration and the block it sits in: `@theme`, `:root`, or a selector that means a mode (`[data-theme="dark"]`, `.dark`, `@media (prefers-color-scheme: dark)`). It strips comments, tracks brace depth, quotes and parentheses, and ignores everything else. A full CSS parser would add a dependency for a feature that only needs declarations.

Names map to paths by namespace, longest namespace first so `--font-weight-bold` is not read as a font family: `--color-flare-dark` is `color.flare-dark`. Two cases needed a rule:

- **A bare namespace.** `--spacing` and `--spacing-tight` would make `spacing` both a token and a group, which JSON cannot hold. The bare one is read as `spacing.DEFAULT`, Tailwind v3's name for the same thing, and written back without the segment.
- **Size companions.** `--text-sm--line-height` is read as its own token, `text.sm--line-height`, rather than folded into a typography composite. A typography token needs a font family, which Tailwind's companions never carry.

When writing, a group becomes a namespace only when it is one (`color`, `colours`, `radius`, `fontFamily` and so on) and its tokens are that namespace's type. haus's `font.lineHeight.tight` is a number, not a font family, so it is written to `:root` as `--font-line-height-tight` instead of into `@theme`. Tokens with no namespace, durations among them, go to `:root` as plain custom properties: the value is kept, and Tailwind generates no utility for it.

Modes are written as overrides only, under the chosen selector. `prefers-color-scheme` can only name light and dark, so any other mode is `dropped-mode` with that selector.

---

## Figma

Figma's export is DTCG-shaped JSON, one file per mode, with Figma's own data under `com.figma.*` extensions. Reading it is reading DTCG once per file and naming the mode after the file.

Writing it is where most of the loss is. A Figma variable is a colour, number, string or boolean, so durations and curves are `dropped-type`, composites are `dropped-composite` (typography and shadows are styles in Figma, and the export carries no styles), rem is converted to px at the chosen base, and a font family list keeps only its first family.

The Figma fixtures are built from the export's documented shape and from exports described on Figma's forum, not from a file exported from Figma. They should be replaced with a real export.

---

## Several files

Two formats need more than one file: Figma's export is a file per mode, and a DTCG resolver can refer to other files by name. The input keeps a name per file, editable, and a resolver `$ref` matches a file by that name. A single-file resolver with inline sources needs no second file, which is why the DTCG writer produces one.

---

## 500 KB input limit

Checked before anything parses, with a readable error. Same limit and reasoning as specifi's Rank view: an accidental paste of a production bundle should not hang the tab. Real token files are far smaller; haus's is 26 KB.

---

## Routing: no router library

`ViewId` is `useState`, as in specifi, hexicon and gray-scott. The input lives in `App` and is shared by the three tools, so a file read in Convert is already there in Inspect and Compare.

---

## Accepted tradeoffs

**One modifier.** A DTCG resolver can have several modifiers, which multiply into combinations. tokenise reads the first as modes and reports the rest as `dropped-mode`, because none of the other three formats can hold combinations.

**Typography and gradients in Tailwind.** Typography splits into a size and companions and loses its family. Gradients and stroke styles are dropped. Both are reported.

**Tokens Studio duration and cubic bézier.** Tokens Studio has no type for either. They are written with type `other` and reported as `dropped-type`, since no Tokens Studio transform will read them as what they are.

**Colour: first-pass gamut mapping.** Chroma reduction in OKLCH is the CSS Color 4 approach and good enough to report honestly. It is not the only reasonable mapping, and a different tool may produce a slightly different sRGB value for the same out-of-gamut colour.
