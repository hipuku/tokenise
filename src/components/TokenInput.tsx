import { useRef } from 'react'
import { FilePlus, Upload, X } from 'lucide-react'
import { Button, ChipGroup, Field, IconButton, Input, Textarea, ToggleChip } from 'kern'
import { FORMAT_LABEL, type FormatId } from '@/engine/types'
import { MAX_INPUT_BYTES } from '@/engine/document'
import { EMPTY_DOCUMENT, type SourceChoice, type TokenInputState } from '@/lib/useTokenInput'

const SOURCE_CHOICES: SourceChoice[] = ['auto', 'dtcg', 'figma', 'tokens-studio', 'tailwind']

const PLACEHOLDER = `{
  "color": {
    "$type": "color",
    "ink": { "$value": { "colorSpace": "srgb", "components": [0.1, 0.1, 0.1] } },
    "text": { "$value": "{color.ink}" }
  }
}`

/**
 * The input every tool reads from: one or more files, pasted or opened.
 *
 * Several files are needed for two formats. Figma exports one file per mode,
 * and a DTCG resolver or a Tokens Studio project can refer to other files by
 * name. So each file keeps its name, and the name is editable.
 */
export function TokenInput({ input }: { input: TokenInputState }) {
  const { documents, setDocuments, source, setSource, outcome, error } = input
  const fileInput = useRef<HTMLInputElement>(null)
  const several = documents.length > 1

  const update = (index: number, patch: Partial<(typeof documents)[number]>) =>
    setDocuments(documents.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  const open = async (files: FileList | null) => {
    if (!files?.length) return
    const read = await Promise.all([...files].map(async (f) => ({ name: f.name, text: await f.text() })))
    setDocuments(read)
  }

  const modes = outcome?.set.modes ?? []
  const aside = outcome ? (
    <span className="type-annotation text-ink-muted">
      {FORMAT_LABEL[outcome.format]}, {outcome.set.tokens.length} tokens
      {modes.length > 1 ? `, ${modes.length} modes` : ''}
    </span>
  ) : undefined

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={several ? 'Files' : 'Tokens'}
        aside={aside}
        error={error ?? undefined}
        hint={
          several
            ? 'Figma per-mode files take their mode from the file name.'
            : `Paste a file, or open one or more. Up to ${MAX_INPUT_BYTES / 1000} KB.`
        }
      >
        {(control) => (
          <div className="flex flex-col gap-3">
            {documents.map((document, i) => (
              <div key={i} className="flex flex-col gap-2">
                {several && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={document.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      aria-label={`File ${i + 1} name`}
                      className="font-mono"
                    />
                    <IconButton
                      variant="ghost"
                      aria-label={`Remove ${document.name}`}
                      onClick={() => setDocuments(documents.filter((_, j) => j !== i))}
                    >
                      <X className="w-4 h-4" />
                    </IconButton>
                  </div>
                )}
                <Textarea
                  value={document.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  rows={several ? 8 : 12}
                  placeholder={i === 0 ? PLACEHOLDER : undefined}
                  spellCheck={false}
                  invalid={Boolean(error)}
                  className="font-mono"
                  {...(i === 0 ? control : { 'aria-label': `File ${i + 1} contents` })}
                />
              </div>
            ))}
          </div>
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="w-3.5 h-3.5" />
          Open files
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDocuments([...documents, { ...EMPTY_DOCUMENT, name: `file-${documents.length + 1}.json` }])}
        >
          <FilePlus className="w-3.5 h-3.5" />
          Add a file
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".json,.css,application/json,text/css"
          className="hidden"
          onChange={(e) => {
            void open(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <ChipGroup label="Read as">
        {SOURCE_CHOICES.map((choice) => (
          <ToggleChip key={choice} active={source === choice} onClick={() => setSource(choice)}>
            {choice === 'auto' ? 'Detect' : FORMAT_LABEL[choice as FormatId]}
          </ToggleChip>
        ))}
      </ChipGroup>
    </div>
  )
}
