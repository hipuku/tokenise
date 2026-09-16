import { EmptyState, ToggleChip } from 'kern'
import { SAMPLES } from '@/samples'
import type { TokenInputState } from '@/lib/useTokenInput'

/** The empty state every tool shows: paste something, or load a real file. */
export function SampleActions({ input, children }: { input: TokenInputState; children: string }) {
  return (
    <EmptyState
      title="Try an example"
      actions={SAMPLES.map((sample) => (
        <ToggleChip
          key={sample.id}
          active={false}
          onClick={() => {
            input.setSource('auto')
            input.setDocuments(sample.documents)
          }}
        >
          {sample.label}
        </ToggleChip>
      ))}
    >
      {children}
    </EmptyState>
  )
}
