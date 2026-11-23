# tokenise

![tokenise: a DTCG token file on the left, the same tokens as Tailwind v4 theme variables on the right](docs/screenshot.png)

Design token conversion in the browser. Live at [tokenise.hipuku.dev](https://tokenise.hipuku.dev).

Converts between DTCG 2025.10 JSON, Figma variables, Tokens Studio JSON and Tailwind v4 `@theme`, and reports every token that did not come through exactly, and why.

## Tools

- **Convert** a token file from one format to another.
- **Compare** how each format writes eleven tricky tokens.
- **Check** a file: how much of it each format keeps.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, [kern](https://github.com/hipuku/kern), culori.

## Development

```bash
pnpm install
pnpm dev
```

`pnpm test`, `pnpm lint` and `pnpm typecheck` run the checks CI runs. The app is in `apps/web`.

## Licence

MIT
