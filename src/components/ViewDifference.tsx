import { useState } from 'react'
import { ToggleChip, ViewHeader } from 'kern'
import { FORMAT_LABEL, type FormatId } from '@/engine/types'
import { useTokenInput } from '@/lib/useTokenInput'
import { Block } from './Block'
import { FidelityBars } from './FidelityBars'
import { TokenInput } from './TokenInput'
import { TokenReport } from './TokenReport'

const TARGETS: FormatId[] = ['dtcg', 'figma', 'tokens-studio', 'tailwind']

/**
 * Check a file: what happens to your own tokens. Compare is the reference for
 * how each format handles a kind of token; this is the report for a real file —
 * how much of it each format keeps, then token by token for the one you pick.
 */
export function ViewDifference() {
  const input = useTokenInput()
  const set = input.outcome?.set
  const [target, setTarget] = useState<FormatId>('figma')

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-8">
      <ViewHeader
        title="Check a file"
        description="Paste or open your token file to see what each format keeps, changes or drops — token by token."
      />

      <TokenInput input={input} />

      {set && (
        <>
          <Block title="How much each format keeps">
            <FidelityBars set={set} />
          </Block>

          <Block
            title="Token by token"
            aside={
              <div role="group" aria-label="Target format" className="flex flex-wrap gap-2">
                {TARGETS.map((format) => (
                  <ToggleChip key={format} active={format === target} onClick={() => setTarget(format)}>
                    {FORMAT_LABEL[format]}
                  </ToggleChip>
                ))}
              </div>
            }
          >
            <TokenReport set={set} target={target} />
          </Block>
        </>
      )}
    </div>
  )
}
