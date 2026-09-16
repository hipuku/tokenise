import { useMemo, useState } from 'react'
import { ChipGroup, Field, Input, Section, ToggleChip, ToolView, ViewContainer } from 'kern'
import { write } from '@/engine/convert'
import { DEFAULT_OPTIONS, FORMAT_LABEL, type FormatId, type WriteOptions } from '@/engine/types'
import type { TokenInputState } from '@/lib/useTokenInput'
import { TokenInput } from './TokenInput'
import { OutputFiles } from './OutputFiles'
import { LossReport } from './LossReport'
import { SampleActions } from './SampleActions'

const TARGETS: FormatId[] = ['dtcg', 'figma', 'tokens-studio', 'tailwind']

const MODE_SELECTORS: { id: WriteOptions['tailwindModeSelector']; label: string }[] = [
  { id: 'data-theme', label: '[data-theme]' },
  { id: 'class', label: '.class' },
  { id: 'media', label: 'prefers-color-scheme' },
]

export function ViewConvert({ input }: { input: TokenInputState }) {
  const [target, setTarget] = useState<FormatId>('tailwind')
  const [remBase, setRemBase] = useState(String(DEFAULT_OPTIONS.remBase))
  const [modeSelector, setModeSelector] = useState<WriteOptions['tailwindModeSelector']>('data-theme')

  const base = Number(remBase)
  const baseError = remBase.trim() === '' || !(base > 0) ? 'Enter a number of pixels above zero.' : undefined
  const { outcome } = input

  const result = useMemo(() => {
    if (!outcome || baseError) return null
    const written = write(outcome.set, target, { remBase: base, tailwindModeSelector: modeSelector })
    return { files: written.files, losses: [...outcome.losses, ...written.losses] }
  }, [outcome, target, base, baseError, modeSelector])

  const hasModes = (outcome?.set.modes.length ?? 0) > 1

  return (
    <ViewContainer width="lg">
      <ToolView
        title="Convert tokens"
        description="Paste tokens in one format and get them in another. Every token that did not come through exactly is listed below the output, with the reason."
        isEmpty={input.isEmpty}
        input={
          <div className="flex flex-col gap-6">
            <TokenInput input={input} />
            <ChipGroup label="Write as">
              {TARGETS.map((format) => (
                <ToggleChip key={format} active={target === format} onClick={() => setTarget(format)}>
                  {FORMAT_LABEL[format]}
                </ToggleChip>
              ))}
            </ChipGroup>
            {target === 'figma' && (
              <Field label="Pixels per rem" error={baseError} hint="Figma has no rem, so rem values are multiplied out.">
                {(control) => (
                  <Input type="number" value={remBase} onChange={(e) => setRemBase(e.target.value)} className="max-w-32 font-mono" {...control} />
                )}
              </Field>
            )}
            {target === 'tailwind' && hasModes && (
              <ChipGroup label="Switch modes with">
                {MODE_SELECTORS.map((option) => (
                  <ToggleChip key={option.id} mono active={modeSelector === option.id} onClick={() => setModeSelector(option.id)}>
                    {option.label}
                  </ToggleChip>
                ))}
              </ChipGroup>
            )}
          </div>
        }
        empty={<SampleActions input={input}>Nothing to convert yet. Paste a token file above, or load one of these.</SampleActions>}
      >
        {result && outcome && (
          <>
            <Section title={FORMAT_LABEL[target]} as="h2">
              <OutputFiles files={result.files} />
            </Section>
            <Section title="What changed" as="h2">
              <LossReport tokenPaths={outcome.set.tokens.map((t) => t.path)} losses={result.losses} modes={outcome.set.modes} />
            </Section>
          </>
        )}
      </ToolView>
    </ViewContainer>
  )
}
