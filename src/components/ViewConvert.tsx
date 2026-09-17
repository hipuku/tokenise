import { useMemo, useState } from 'react'
import { Label, ToggleChip, ChipGroup, ViewHeader } from 'kern'
import { write } from '@/engine/convert'
import { DEFAULT_OPTIONS, FORMAT_LABEL, type FormatId, type OutputFile, type WriteOptions } from '@/engine/types'
import { useTokenInput } from '@/lib/useTokenInput'
import { SAMPLES } from '@/samples'
import { Select } from './Select'
import { CodeField, FormatChip } from './CodeField'

const TARGETS: FormatId[] = ['dtcg', 'figma', 'tokens-studio', 'tailwind']
const TARGET_OPTIONS = TARGETS.map((id) => ({ value: id, label: FORMAT_LABEL[id] }))
const PRESET_OPTIONS = [{ value: '', label: 'Paste your own' }, ...SAMPLES.map((s) => ({ value: s.id, label: s.label }))]

const MODE_SELECTORS: { id: WriteOptions['tailwindModeSelector']; label: string }[] = [
  { id: 'data-theme', label: '[data-theme]' },
  { id: 'class', label: '.class' },
  { id: 'media', label: 'prefers-color-scheme' },
]

/** One text blob for the output field. Figma writes a file per mode, so those are separated by a header. */
function joinFiles(files: OutputFile[]): string {
  if (files.length === 1) return files[0].text
  return files.map((f) => `/* ${f.name} */\n${f.text}`).join('\n\n')
}

/**
 * Convert: paste a token file on the left, read it in another format on the
 * right. Two mirrored, syntax-highlighted fields; the source format is detected
 * automatically.
 */
export function ViewConvert() {
  const input = useTokenInput()
  const { documents, setDocuments, outcome, error } = input
  const text = documents[0]?.text ?? ''

  const [presetId, setPresetId] = useState('')
  const [target, setTarget] = useState<FormatId>('tailwind')
  const [modeSelector, setModeSelector] = useState<WriteOptions['tailwindModeSelector']>('data-theme')

  const output = useMemo(() => {
    if (!outcome) return ''
    return joinFiles(write(outcome.set, target, { ...DEFAULT_OPTIONS, tailwindModeSelector: modeSelector }).files)
  }, [outcome, target, modeSelector])

  const hasModes = (outcome?.set.modes.length ?? 0) > 1

  const choosePreset = (id: string) => {
    setPresetId(id)
    input.setSource('auto')
    const sample = SAMPLES.find((s) => s.id === id)
    setDocuments(sample ? sample.documents : [{ name: 'tokens.json', text: '' }])
    // Never convert a preset to its own format on load: DTCG converges on the
    // standard, and the standard itself goes to Tailwind, so there is always
    // something to see.
    if (sample) setTarget(sample.format === 'dtcg' ? 'tailwind' : 'dtcg')
  }

  const editSource = (value: string) => {
    setPresetId('')
    setDocuments([{ name: documents[0]?.name ?? 'tokens.json', text: value }])
  }

  const sourceLang = outcome?.format === 'tailwind' ? 'css' : 'json'
  const detected = error
    ? <FormatChip error>Not recognised</FormatChip>
    : outcome
      ? <FormatChip>Detected: {FORMAT_LABEL[outcome.format]}</FormatChip>
      : undefined

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-8">
      <ViewHeader
        title="Convert tokens"
        description="Paste a token file on the left and read it in another format on the right. The source format is detected automatically."
      />

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* ── Source ── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label as="label" htmlFor="preset" className="type-annotation-sc text-void-60">
              Try a preset
            </Label>
            <Select id="preset" value={presetId} options={PRESET_OPTIONS} onChange={(e) => choosePreset(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <CodeField
              chip={detected}
              value={text}
              onValueChange={editSource}
              language={sourceLang}
              placeholder="Paste a token file here, or pick a preset above."
              invalid={Boolean(error)}
              aria-label="Source tokens"
            />
            {error && <p className="type-annotation text-flare">{error}</p>}
          </div>
        </div>

        {/* ── Result ── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label as="label" htmlFor="target" className="type-annotation-sc text-void-60">
              Convert to
            </Label>
            <Select id="target" value={target} options={TARGET_OPTIONS} onChange={(e) => setTarget(e.target.value as FormatId)} />
          </div>

          {target === 'tailwind' && hasModes && (
            <ChipGroup label="Switch modes with">
              {MODE_SELECTORS.map((option) => (
                <ToggleChip key={option.id} mono active={modeSelector === option.id} onClick={() => setModeSelector(option.id)}>
                  {option.label}
                </ToggleChip>
              ))}
            </ChipGroup>
          )}

          <div className="flex flex-col gap-1.5">
            <CodeField
              value={output}
              language={target === 'tailwind' ? 'css' : 'json'}
              readOnly
              placeholder="The converted tokens appear here."
              aria-label={`${FORMAT_LABEL[target]} output`}
            />
            {outcome?.format === target && (
              <p className="type-annotation text-ink-muted">
                {target === 'figma'
                  ? 'Same format as the source. Figma’s variables export is DTCG-shaped JSON with com.figma extensions, so it reads much like DTCG; nothing was converted.'
                  : 'Same format as the source, so nothing was converted; only the formatting may differ.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
