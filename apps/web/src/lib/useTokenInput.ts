import { useMemo, useState } from 'react'
import { read, type ReadOutcome } from '@/engine/convert'
import type { InputDocument } from '@/engine/document'
import { ReadError, type FormatId } from '@/engine/types'

export type SourceChoice = FormatId | 'auto'

export interface TokenInputState {
  documents: InputDocument[]
  setDocuments: (documents: InputDocument[]) => void
  source: SourceChoice
  setSource: (source: SourceChoice) => void
  outcome: ReadOutcome | null
  error: string | null
  isEmpty: boolean
}

export const EMPTY_DOCUMENT: InputDocument = { name: 'tokens.json', text: '' }

/**
 * The pasted input, shared by the three tools so a file read once is there in
 * each of them. Reading happens here, on every change: a token file is small and
 * the engine is fast, so there is no button to press.
 */
export function useTokenInput(initialDocuments: InputDocument[] = [EMPTY_DOCUMENT]): TokenInputState {
  const [documents, setDocuments] = useState<InputDocument[]>(initialDocuments)
  const [source, setSource] = useState<SourceChoice>('auto')

  const isEmpty = documents.every((d) => !d.text.trim())

  const { outcome, error } = useMemo(() => {
    if (isEmpty) return { outcome: null, error: null }
    try {
      return { outcome: read(documents, source === 'auto' ? undefined : source), error: null }
    } catch (e) {
      if (e instanceof ReadError) return { outcome: null, error: e.message }
      return { outcome: null, error: `This input could not be read as ${source === 'auto' ? 'any of the four formats' : source}.` }
    }
  }, [documents, source, isEmpty])

  return { documents, setDocuments, source, setSource, outcome, error, isEmpty }
}
