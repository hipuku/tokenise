# @hipuku/dtcg-cli

`dtcg` converts design tokens between DTCG, Figma variables, Tokens Studio and Tailwind v4, and
reports what each conversion loses. The command-line side of
[`@hipuku/dtcg`](../dtcg/README.md).

Not published yet. Version 0.1.0 is unreleased.

## Use

```bash
dtcg tokens.json --to tailwind > theme.css
dtcg Light.tokens.json Dark.tokens.json --to dtcg --out tokens/
dtcg theme.css --from tailwind --to figma --out figma/
```

The converted tokens go to stdout when the output is one file, and to `--out` otherwise. The loss
report goes to stderr, one line per loss: the token, its mode, the reason and a detail.

| Option | Meaning |
| ------ | ------- |
| `--to <format>` | The format to write: `dtcg`, `figma`, `tokens-studio` or `tailwind`. Required |
| `--from <format>` | The format to read. Detected from the input when left out |
| `--out <dir>` | Write the output files here. Required when the output is more than one file |
| `--rem-base <px>` | Pixels per rem. Default 16 |
| `--mode-selector <kind>` | How a Tailwind stylesheet switches modes: `data-theme`, `class` or `media` |

Exit codes: 0 converted, 1 the input could not be read, 2 the command was wrong.
