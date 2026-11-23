# @hipuku/dtcg

Reads design tokens from four formats into one model, writes that model back out to any of them,
and reports what each conversion loses. The engine behind the tokenise app.

Formats: DTCG (including resolver documents with modes), Figma variables exports, Tokens Studio,
and Tailwind v4 `@theme` stylesheets.

Not published yet. Version 0.1.0 is unreleased.

## Use

```ts
import { convert } from '@hipuku/dtcg'

const result = convert([{ name: 'tokens.json', text }], 'tailwind')
// result.format: the format detected in the input
// result.files: the written output, one or more files
// result.allLosses: what was lost reading the input, then writing the target,
//   each entry naming the token, the reason and a detail
```

`read` and `write` are the two halves of `convert`, for reading once and writing several formats.
`detectFormat` returns the format of a set of documents from their shape. `read` throws a
`ReadError` when the input cannot be read.

## Develop

```bash
pnpm --filter @hipuku/dtcg build
pnpm --filter @hipuku/dtcg test
```

The tests read real exports from `src/fixtures`, including copies of two of the app's samples.
