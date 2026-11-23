import { checkSize, Losses, type InputDocument } from './document'
import { readDtcg } from './dtcgRead'
import { writeDtcg } from './dtcgWrite'
import { detectFormat } from './detect'
import { inferReferenceTypes } from './resolve'
import { readFigma, writeFigma } from './figma'
import { readTailwind, writeTailwind } from './tailwind'
import { readTokensStudio, writeTokensStudio } from './tokensStudio'
import {
  DEFAULT_OPTIONS,
  type FormatId,
  type LossEntry,
  type OutputFile,
  type TokenSet,
  type WriteOptions,
} from './types'

export interface ReadOutcome {
  format: FormatId
  set: TokenSet
  losses: LossEntry[]
}

export function read(documents: readonly InputDocument[], format?: FormatId): ReadOutcome {
  checkSize(documents)
  const docs = documents.filter((d) => d.text.trim())
  const chosen = format ?? detectFormat(docs)
  const losses = new Losses()
  const readers: Record<FormatId, (d: readonly InputDocument[], l: Losses) => TokenSet> = {
    dtcg: readDtcg,
    figma: readFigma,
    'tokens-studio': readTokensStudio,
    tailwind: readTailwind,
  }
  const set = readers[chosen](docs, losses)
  inferReferenceTypes(set)
  return { format: chosen, set, losses: losses.entries }
}

export function write(set: TokenSet, format: FormatId, options: WriteOptions = DEFAULT_OPTIONS) {
  switch (format) {
    case 'dtcg':
      return writeDtcg(set)
    case 'figma':
      return writeFigma(set, options)
    case 'tokens-studio':
      return writeTokensStudio(set)
    case 'tailwind':
      return writeTailwind(set, options)
  }
}

export interface Conversion extends ReadOutcome {
  target: FormatId
  files: OutputFile[]
  /** Read losses first, then write losses. */
  allLosses: LossEntry[]
}

export function convert(
  documents: readonly InputDocument[],
  target: FormatId,
  options: WriteOptions = DEFAULT_OPTIONS,
  source?: FormatId,
): Conversion {
  const outcome = read(documents, source)
  const { files, losses } = write(outcome.set, target, options)
  return { ...outcome, target, files, allLosses: [...outcome.losses, ...losses] }
}
