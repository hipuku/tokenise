import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from 'kern'
import { FORMAT_LABEL } from '@/engine/types'
import { MAX_INPUT_BYTES } from '@/engine/document'
import { EMPTY_DOCUMENT, type TokenInputState } from '@/lib/useTokenInput'
import { CodeField, FormatChip } from './CodeField'

/**
 * The token file a report reads. One code box that is always there, with no
 * mode to enter or leave: paste into it, drop files onto it, or open them from
 * its corner. An opened file fills the box and stays editable, so pasting and
 * opening are two ways into the same place. The format is always detected and
 * shown as the box's chip.
 *
 * Several files (Figma exports one per mode; resolvers and Tokens Studio
 * projects can span files) cannot share one field, so they show as a list of
 * names until cleared.
 */
export function TokenInput({ input }: { input: TokenInputState }) {
  const { documents, setDocuments, outcome, error, isEmpty } = input
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const several = documents.length > 1

  const open = async (files: FileList | null) => {
    if (!files?.length) return
    setDocuments(await Promise.all([...files].map(async (f) => ({ name: f.name, text: await f.text() }))))
  }

  const modes = outcome?.set.modes ?? []
  const chip = error ? (
    <FormatChip error>Not recognised</FormatChip>
  ) : outcome ? (
    <FormatChip>
      {FORMAT_LABEL[outcome.format]} · {outcome.set.tokens.length} {outcome.set.tokens.length === 1 ? 'token' : 'tokens'}
      {modes.length > 1 ? ` · ${modes.length} modes` : ''}
    </FormatChip>
  ) : undefined

  return (
    <div
      className="flex flex-col gap-2"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void open(e.dataTransfer.files)
      }}
    >
      <CodeField
        value={several ? '' : documents[0].text}
        onValueChange={(text) => setDocuments([{ ...documents[0], text }])}
        language={outcome?.format === 'tailwind' ? 'css' : 'json'}
        invalid={Boolean(error)}
        placeholder={`Paste a token file, or drop or open one. DTCG, Figma variables, Tokens Studio or Tailwind CSS, up to ${MAX_INPUT_BYTES / 1000} KB.`}
        heightClass="h-80"
        className={dragging ? 'border-dashed border-(--primary)' : undefined}
        chip={chip}
        aria-label="Tokens"
        actions={
          <>
            {!isEmpty && (
              <Button size="sm" variant="ghost" className="text-flare hover:text-flare" onClick={() => setDocuments([EMPTY_DOCUMENT])}>
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
            <Button size="sm" variant="surface" onClick={() => fileInput.current?.click()}>
              <Upload className="w-3.5 h-3.5" />
              Open file
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".json,.css,application/json,text/css"
              hidden
              onChange={(e) => {
                void open(e.target.files)
                e.target.value = ''
              }}
            />
          </>
        }
      >
        {several && (
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {documents.map((d) => (
              <span key={d.name} className="type-code-sm text-void-80 rounded-inline bg-surface-raised px-2 py-1">
                {d.name}
              </span>
            ))}
          </div>
        )}
      </CodeField>
      {error && <p className="type-annotation text-flare">{error}</p>}
    </div>
  )
}
