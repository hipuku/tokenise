import { isRecord, parseJson, type InputDocument } from './document'
import { isResolverDocument } from './dtcgRead'
import { hasFigmaExtensions } from './figma'
import { looksLikeTailwind } from './tailwind'
import { looksLikeTokensStudio } from './tokensStudio'
import { ReadError, type FormatId } from './types'

/**
 * Which format the input is, from its shape. Order matters: Figma's export is
 * valid DTCG, so the Figma extensions are checked before plain DTCG, and a
 * Tokens Studio file in W3C mode also has `$value`, so its own markers come
 * before DTCG as well.
 */
export function detectFormat(documents: readonly InputDocument[]): FormatId {
  const nonEmpty = documents.filter((d) => d.text.trim())
  if (!nonEmpty.length) throw new ReadError('There is nothing to read.')

  const first = nonEmpty[0].text.trimStart()
  if (!first.startsWith('{') && !first.startsWith('[')) {
    if (nonEmpty.every((d) => looksLikeTailwind(d.text))) return 'tailwind'
    throw new ReadError('This is neither JSON nor a stylesheet with custom properties.')
  }

  const parsed = nonEmpty.map(parseJson)
  if (parsed.some(isResolverDocument)) return 'dtcg'
  if (parsed.some(hasFigmaExtensions)) return 'figma'
  if (parsed.some(looksLikeTokensStudio) || nonEmpty.some((d) => /^\$(themes|metadata)(\.json)?$/.test(d.name))) {
    return 'tokens-studio'
  }
  if (parsed.some((json) => isRecord(json) && JSON.stringify(json).includes('"$value"'))) return 'dtcg'
  throw new ReadError('No tokens found: no $value, value or custom property declarations.')
}
