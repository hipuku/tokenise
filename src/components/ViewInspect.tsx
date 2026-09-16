import { useMemo, useState } from 'react'
import { ChipGroup, Field, Input, StatusChip, ToggleChip, ToolView, ViewContainer } from 'kern'
import { indexTokens, resolveValue, valueIn } from '@/engine/resolve'
import { joinPath } from '@/engine/types'
import { swatch, valueText } from '@/lib/describe'
import type { TokenInputState } from '@/lib/useTokenInput'
import { cn } from '@/lib/utils'
import { TokenInput } from './TokenInput'
import { SampleActions } from './SampleActions'

export function ViewInspect({ input }: { input: TokenInputState }) {
  const { outcome } = input
  const [modeChoice, setMode] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const set = outcome?.set
  const mode = set && modeChoice && set.modes.includes(modeChoice) ? modeChoice : set?.modes[0]

  const rows = useMemo(() => {
    if (!set || !mode) return []
    const index = indexTokens(set)
    const query = filter.trim().toLowerCase()
    return set.tokens
      .filter((t) => !query || joinPath(t.path).toLowerCase().includes(query) || (t.type ?? t.sourceType ?? '').toLowerCase().includes(query))
      .map((token) => {
        const own = valueIn(token, mode, set.modes)
        const resolved = own ? resolveValue(own, mode, set, index) : undefined
        return { token, own, resolved }
      })
  }, [set, mode, filter])

  return (
    <ViewContainer width="lg">
      <ToolView
        title="Inspect tokens"
        description="The tokens as tokenise reads them, before anything is written: each one's type, its value in a mode, and the chain of references it resolves through."
        isEmpty={input.isEmpty}
        input={<TokenInput input={input} />}
        empty={<SampleActions input={input}>Nothing to inspect yet. Paste a token file above, or load one of these.</SampleActions>}
      >
        {set && mode && (
          <>
            <div className="flex items-end gap-6">
              {set.modes.length > 1 && (
                <ChipGroup label="Mode">
                  {set.modes.map((m) => (
                    <ToggleChip key={m} active={m === mode} onClick={() => setMode(m)}>
                      {m}
                    </ToggleChip>
                  ))}
                </ChipGroup>
              )}
              <Field label="Filter" className="flex-1" aside={<span className="type-annotation text-ink-muted">{rows.length} of {set.tokens.length}</span>}>
                {(control) => <Input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="color, dimension, space.md" {...control} />}
              </Field>
            </div>

            <div className="rounded-xl overflow-hidden border border-void-20">
              {rows.map(({ token, own, resolved }, i) => {
                const colour = swatch(resolved?.value)
                const chain = resolved?.chain ?? []
                return (
                  <div key={joinPath(token.path)} className={cn('flex items-center gap-4 px-4 py-2.5', i < rows.length - 1 && 'border-b border-void-20')}>
                    <span
                      className="w-4 h-4 rounded-inline border border-void-30 shrink-0"
                      style={colour ? { backgroundColor: colour } : undefined}
                      aria-hidden="true"
                    />
                    <span className="type-annotation font-mono text-void-80 w-60 shrink-0 truncate" title={joinPath(token.path)}>
                      {joinPath(token.path)}
                    </span>
                    <StatusChip colour={token.type ? 'neutral' : 'flare'} className="shrink-0">
                      {token.type ?? token.sourceType ?? 'no type'}
                    </StatusChip>
                    <span className="type-annotation font-mono text-void-60 min-w-0 truncate" title={valueText(own)}>
                      {chain.length ? `${chain.map((c) => `{${c}}`).join(' → ')} → ${resolved?.value ? valueText(resolved.value) : resolved?.problem}` : valueText(own)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </ToolView>
    </ViewContainer>
  )
}
