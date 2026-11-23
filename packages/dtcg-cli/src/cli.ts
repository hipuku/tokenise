import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import { convert, DEFAULT_OPTIONS, FORMAT_LABEL, ReadError, type FormatId, type WriteOptions } from '@hipuku/dtcg'

const FORMATS = Object.keys(FORMAT_LABEL) as FormatId[]
const MODE_SELECTORS: WriteOptions['tailwindModeSelector'][] = ['data-theme', 'class', 'media']

export const USAGE = `Usage: dtcg <file...> --to <format> [options]

Converts design tokens between formats and reports what the conversion loses.

Formats: ${FORMATS.join(', ')}

Options:
  --to <format>           The format to write. Required.
  --from <format>         The format to read. Detected from the input when left out.
  --out <dir>             Write the output files into this directory. Without it, a
                          single output file goes to stdout.
  --rem-base <px>         Pixels per rem. Default ${DEFAULT_OPTIONS.remBase}.
  --mode-selector <kind>  How a Tailwind stylesheet switches modes: ${MODE_SELECTORS.join(', ')}.
                          Default ${DEFAULT_OPTIONS.tailwindModeSelector}.
  -h, --help              Show this.

Losses are printed to stderr, so stdout carries only the converted tokens.

Exit codes: 0 converted, 1 the input could not be read, 2 the command was wrong.
`

export interface Output {
  stdout: (text: string) => void
  stderr: (text: string) => void
}

const isFormat = (value: string): value is FormatId => (FORMATS as string[]).includes(value)

/** Runs the command and returns the exit code. */
export async function run(argv: string[], out: Output): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        to: { type: 'string' },
        from: { type: 'string' },
        out: { type: 'string' },
        'rem-base': { type: 'string' },
        'mode-selector': { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    })
  } catch (error) {
    out.stderr(`${(error as Error).message}\n\n${USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) {
    out.stdout(USAGE)
    return 0
  }

  const usage = (message: string) => {
    out.stderr(`${message}\n\n${USAGE}`)
    return 2
  }
  if (!positionals.length) return usage('Name at least one file to read.')
  if (!values.to) return usage('--to is required.')
  if (!isFormat(values.to)) return usage(`--to must be one of ${FORMATS.join(', ')}.`)
  if (values.from && !isFormat(values.from)) return usage(`--from must be one of ${FORMATS.join(', ')}.`)

  const options: WriteOptions = { ...DEFAULT_OPTIONS }
  if (values['rem-base'] !== undefined) {
    const remBase = Number(values['rem-base'])
    if (!Number.isFinite(remBase) || remBase <= 0) return usage('--rem-base must be a positive number.')
    options.remBase = remBase
  }
  if (values['mode-selector'] !== undefined) {
    const selector = values['mode-selector'] as WriteOptions['tailwindModeSelector']
    if (!MODE_SELECTORS.includes(selector)) return usage(`--mode-selector must be one of ${MODE_SELECTORS.join(', ')}.`)
    options.tailwindModeSelector = selector
  }

  let documents
  try {
    documents = await Promise.all(
      positionals.map(async file => ({ name: basename(file), text: await readFile(file, 'utf8') })),
    )
  } catch (error) {
    out.stderr(`${(error as Error).message}\n`)
    return 1
  }

  let result
  try {
    result = convert(documents, values.to, options, values.from as FormatId | undefined)
  } catch (error) {
    if (error instanceof ReadError) {
      out.stderr(`${error.message}\n`)
      return 1
    }
    throw error
  }

  if (values.out) {
    await mkdir(values.out, { recursive: true })
    for (const file of result.files) {
      const path = join(values.out, file.name)
      await writeFile(path, file.text)
      out.stderr(`wrote ${path}\n`)
    }
  } else if (result.files.length === 1) {
    out.stdout(result.files[0].text)
  } else {
    out.stderr(`${FORMAT_LABEL[values.to]} output is ${result.files.length} files. Pass --out <dir>.\n`)
    return 2
  }

  const losses = result.allLosses
  out.stderr(
    `${FORMAT_LABEL[result.format]} to ${FORMAT_LABEL[values.to]}: ${losses.length} ${losses.length === 1 ? 'loss' : 'losses'}\n`,
  )
  for (const loss of losses) {
    out.stderr(`  ${loss.token}${loss.mode ? ` (${loss.mode})` : ''}: ${loss.reason}. ${loss.detail}\n`)
  }
  return 0
}
