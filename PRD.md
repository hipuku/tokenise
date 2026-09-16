# tokenise: product requirements

Status: draft, 2026-09-16. Private repository, `github.com/hipuku/tokenise`. Experiment on `/experiments`, live at `tokenise.hipuku.dev`.

---

## What it is

tokenise converts design tokens between the four formats described in [The Language We Never Agreed On](https://hipuku.dev/writing/the-language-we-never-agreed-on): DTCG JSON, Figma's native variables export, Tokens Studio JSON, and a Tailwind v4 `@theme` block. Paste tokens in one format, get them in another, and see every token that did not survive the conversion intact, with the reason.

The conversion is not what other tools lack. Style Dictionary, Terrazzo and a number of Figma plugins already convert. None of them report what was lost on the way, and the essay's argument is that the formats diverge exactly there: modes, references and composite types. tokenise shows that loss per token.

No backend, no network requests after load, no storage. Every computation is client-side, as in specifi, hexicon and gray-scott.

---

## Background

| Format | Shape | Modes | References | Composites |
|---|---|---|---|---|
| DTCG 2025.10 | Nested JSON, `$type` / `$value`; colour and dimension values are objects | Resolver module: sets, and modifiers with contexts | `{group.token}` and `$ref` JSON Pointer | `border`, `transition`, `shadow`, `gradient`, `typography`, `strokeStyle` |
| Figma native export | DTCG-shaped JSON, one file per mode | One file per mode | Aliases to other variables | None. Typography and shadow are styles, not variables, and are not exported |
| Tokens Studio | `value` / `type` (legacy) or `$value` / `$type` (W3C); token sets plus `$themes.json` | Themes select sets | `{token.name}` | `typography`, `boxShadow`, `composition`, plus legacy `borderRadius`, `borderWidth`, `spacing`, `sizing` |
| Tailwind v4 | Custom properties in `@theme`, grouped by namespace (`--color-*`, `--text-*`, `--radius-*`, `--ease-*` …) | No mode primitive; switching is a selector outside `@theme` | `var()`, resolved at build under `@theme inline` | Size companions only: `--text-{name}--line-height`, `--letter-spacing`, `--font-weight` |

Checked 2026-09-16:

- DTCG 2025.10 is stable and comprises the Format, Color and Resolver modules. Colour `$value` is `{ colorSpace, components, alpha, hex }`; dimension is `{ value, unit }` with `px` or `rem`; duration is `{ value, unit }` with `ms` or `s`.
- Figma's native DTCG export has been in use since late 2025. It omits variable descriptions and composite tokens.
- Tailwind v4 theme variables, `@theme inline`, `@theme static` and namespace resets are documented at tailwindcss.com/docs/theme.

Two files in this workspace show the problem already:

- `haus/packages/tokens/src/tokens.json` is pre-2025.10 DTCG. Colours are strings (`"oklch(97% 0.012 300)"`) and 20 tokens use `$type: "string"`, which the spec does not define. A strict 2025.10 reader rejects it.
- `kern/src/styles/primitives.css` is Tailwind v4 `@theme inline` with six `clamp()` values, which no JSON format can express as a dimension.

---

## Tools

Four views, the same arrangement as the other experiments: an About view, then the tools, navigated by `ViewId` state with no router.

| Nav label | Icon (lucide) | What it does |
|---|---|---|
| About this tool | `Info` | The four formats, where they diverge, and how each tool works |
| Convert tokens | `ArrowLeftRight` | Paste in one format, pick a target, get the output and the loss report |
| Inspect tokens | `ListTree` | The tokens as tokenise reads them: name, type, value per mode, alias chain |
| Compare formats | `Columns4` | One token written in all four formats side by side |

### About this tool

As in specifi and gray-scott: a `type-h4 text-void-90` title stating the problem, a `type-p-sm text-void-60` introduction, then one `Section` per topic.

- Title along the lines of *The same token, written four ways*.
- A `DataTable` of the four formats (the Background table above).
- A `BulletList` of the loss reasons.
- `ExternalLink` citations to the DTCG 2025.10 spec, Figma's export, Tokens Studio's docs, Tailwind's theme docs, and the essay.
- A `ToolLink` into each tool, as hexicon's About view does.

### Convert tokens

`ViewContainer` → `ToolView`, as in specifi's Rank view.

- **Input:** a `Field` wrapping a `Textarea`, with the detected format in the field's `aside` (`"Tokens Studio, legacy, 48 tokens"`). A `ChipGroup` of `ToggleChip`s to override the detected format. A second `ChipGroup` for the target format.
- **Options**, shown only when the target needs them: rem base, and for Tailwind the mode selector (`[data-theme="…"]` by default, or `.dark`, or `prefers-color-scheme`).
- **Empty:** `EmptyState` with a "Try an example" row of actions loading the haus and kern samples.
- **Output:** a read-only `Textarea` per output file with a `CopyButton`. Figma's import takes one file per mode, so a two-mode set produces two panels.
- **Loss report:** a row of `Metric`s (tokens in, reproduced exactly, changed, dropped), then the entries grouped by reason, each group headed with the reason and a `StatusChip` count, rows in the bordered list style specifi's Rank view uses. A `CalloutCard` explains a reason the first time it appears.

### Inspect tokens

`ToolView` with the same input `Field`. Results as a bordered row list: path in `font-mono`, type as a `StatusChip`, value per mode, and the alias chain written `a → b → value`. A `ChipGroup` switches mode.

### Compare formats

`ToolView` with a token picker from the current input or a sample. Four `Card`s in a two-by-two grid, one per format, each with the token's text and an `InlineCode` note where the format cannot hold it.

---

## Scope, v1

### MUST

| Requirement | Notes |
|---|---|
| Read and write DTCG 2025.10 | Format module in full; Resolver module for modes |
| Read pre-2025.10 DTCG leniently | String colours and dimensions, group-level `$type`, unknown types. Every leniency is a loss-report entry |
| Read and write Figma's native export | Several per-mode files pasted or dropped together read as one set with modes |
| Read and write Tokens Studio JSON | Legacy and W3C variants; single file, and multi-set with `$themes.json` |
| Read and write a Tailwind v4 `@theme` block | Namespaces, `inline`, companion variables, modes from selector blocks |
| Detect the input format | From shape, with the chip override |
| One internal model | Every reader targets it, every writer reads from it. No format-to-format paths |
| Loss report | Every token not reproduced exactly, with a typed reason |
| Input size limit | 500 KB, checked before parsing, with a readable error. Same limit and reason as specifi's Rank view |

### Not in v1

- Figma plugin formats or the Figma REST API. The native export is the Figma input.
- Style Dictionary or Terrazzo configuration output.
- Platform output (Swift, Kotlin, XML).
- Comparing two token sets against each other.
- Components. If the answer is not a token, tokenise has no opinion.
- Zip download. Output is copied per file.

---

## The internal model

One token:

- `path`: group names plus the token name
- `type`: a DTCG 2025.10 type, or `unknown` with the source type kept
- `values`: one per mode, keyed by mode name; a single-mode set has one entry
- each value is a literal in DTCG 2025.10 shape or a reference to another path
- `description`, `deprecated`, `extensions`, when present
- `source`: the format it was read from and the raw value, for the loss report

DTCG 2025.10 is the model's shape because it is the most expressive of the four: reading into it loses nothing that writing out of it cannot report.

---

## Loss report

Each entry names the token, the mode, the source value, the output value or none, and one reason:

| Reason | Example |
|---|---|
| `dropped-type` | A `duration` written to Figma, which has no duration variable |
| `dropped-mode` | A dark mode written to a target with one mode |
| `resolved-alias` | A reference written as its value, because the target cannot hold references |
| `split-composite` | A `typography` token written as `--text-*` plus companions, with its font family dropped |
| `dropped-composite` | A `shadow` written to Figma's export, which has no composite variables |
| `converted-colour` | `oklch()` written as sRGB, with the ΔE when gamut clamping moved it |
| `converted-unit` | `rem` written as `px` at the chosen base |
| `unrepresentable-value` | `clamp()` or `calc()` read from CSS |
| `renamed` | A path changed to be valid in the target |
| `dropped-metadata` | A description, deprecation or extension the target has no field for |
| `lenient-read` | A pre-2025.10 or non-spec value accepted on input |

An empty loss report is a claim that every token round-trips, and the tests hold it to that.

---

## Build

Scaffolded from specifi, which is the closest shape (text in, analysis out).

| | |
|---|---|
| Stack | React 19, TypeScript, Vite, Tailwind CSS v4, kern `github:hipuku/kern#v1.3.0` |
| Shell | `AppShell` with `logo`, `navItems`, `accentActiveClass`, `SocialBar`, `Colophon` with `hoverFills`, and a `smallScreenNotice` in the same voice as the others |
| Styles | `index.css` imports `tailwindcss`, `tw-animate-css` and `kern/kern.css`, registers `@source "../node_modules/kern/src"`, and sets `--primary`, `--ring` and `--link` |
| Fonts | Parkinsans and Geist Mono from Google Fonts in `index.html` |
| Parsing | Hand-written readers in `src/engine/`, no parser dependency. The Tailwind reader scans `@theme` blocks and selector blocks by brace depth, as specifi's stylesheet extraction does |
| Colour | culori, for the DTCG colour spaces kern's `lib/colour.ts` does not cover (display-p3, oklab and the rest) and for CIEDE2000 |
| Tests | Vitest, beside the engine files. One fixture per format, round trips through the model, and a test that every lossy write produces an entry |
| CI | `.github/workflows/ci.yml` copied from specifi: lint, test, build on Node 22, deploy to Cloudflare Pages on `main`, then check the live site serves the new build |
| Deploy | Cloudflare Pages project `tokenise`, `wrangler.toml` with `pages_build_output_dir = "dist"` |
| Docs | README (what it is, Tools, Engineering, Stack, Development) and DESIGN.md (What it is, one section per decision, Accepted tradeoffs), as gray-scott has them |
| Site | Replace the weft entry in hipuku-web's `app/experiments/experiments.ts` |

`src/engine/` has no React and no DOM dependency.

---

## Done when

- All four formats read and write, with fixtures and round-trip tests passing.
- The haus and kern samples convert to every other format with a loss report that accounts for every token.
- CI is green and `tokenise.hipuku.dev` serves the build.
- README and DESIGN.md written.
- The lab card replaced.

---

## Risks

- **The category is crowded.** tokenise's case rests on the loss report. If the report is thin, tokenise is another converter.
- **Figma's native export is recent and incomplete.** Its shape may change; fixtures are dated.
- **Tokens Studio carries years of legacy types.** v1 covers the documented types and reads anything else as `unknown`.
- **Colour conversion is where libraries disagree.** In vault, two libraries clamped the same out-of-gamut OKLCH value differently and produced different contrast ratios. tokenise uses one library and reports the ΔE of every clamp.

---

## Colours

Three palette hues, as each experiment has, taken from the logo (`public/tokenise.svg`): flare for *tok*, solstice for *en*, dusk for *ise*.

| Role | Hue | Base | On `void-0` |
|---|---|---|---|
| `--primary`, `--ring`, active nav | flare | `#E15E42` | 5.24:1 |
| `--link` | solstice | `#F78D2C` | 7.85:1 |
| Third logo syllable and content accents | dusk | `#F5D4C0` | 13.43:1 |

`Colophon` `hoverFills`: flare, solstice, dusk, in logo order.

The other experiments use flare for errors and parse failures. In tokenise flare is the accent, so dropped tokens and errors need a treatment that does not rely on colour alone: the reason label and an icon on every entry.

---

## Open decisions

None.
