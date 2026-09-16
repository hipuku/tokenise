import { useMemo, useState } from 'react'
import { Card, Field, Input, Label, ToolView, ViewContainer } from 'kern'
import { FORMAT_LABEL, joinPath } from '@/engine/types'
import { compareFormats } from '@/lib/compare'
import { REASON } from '@/lib/describe'
import type { TokenInputState } from '@/lib/useTokenInput'
import { OutcomeMark } from './LossReport'
import { TokenInput } from './TokenInput'
import { SampleActions } from './SampleActions'

export function ViewCompare({ input }: { input: TokenInputState }) {
  const { outcome } = input
  const set = outcome?.set
  const [query, setQuery] = useState('')

  const paths = useMemo(() => set?.tokens.map((t) => joinPath(t.path)) ?? [], [set])
  const token = set?.tokens.find((t) => joinPath(t.path) === query) ?? set?.tokens[0]
  const snippets = useMemo(() => (set && token ? compareFormats(set, token) : []), [set, token])

  return (
    <ViewContainer width="lg">
      <ToolView
        title="Compare formats"
        description="One token written in all four formats side by side, with what each format could not hold."
        isEmpty={input.isEmpty}
        input={<TokenInput input={input} />}
        empty={<SampleActions input={input}>Nothing to compare yet. Paste a token file above, or load one of these.</SampleActions>}
      >
        {set && token && (
          <>
            <Field label="Token" hint="Start typing a token path." aside={<span className="type-annotation text-ink-muted">{paths.length} tokens</span>}>
              {(control) => (
                <>
                  <Input
                    value={query}
                    placeholder={joinPath(token.path)}
                    onChange={(e) => setQuery(e.target.value)}
                    list="token-paths"
                    className="font-mono"
                    spellCheck={false}
                    {...control}
                  />
                  <datalist id="token-paths">
                    {paths.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              {snippets.map((snippet) => (
                <Card key={snippet.format} className="flex flex-col gap-3 min-w-0">
                  <Label as="span" className="type-annotation-sc text-void-60">
                    {FORMAT_LABEL[snippet.format]}
                  </Label>
                  {snippet.text ? (
                    <pre className="type-code text-void-70 whitespace-pre-wrap break-all max-h-72 overflow-auto">{snippet.text}</pre>
                  ) : (
                    <p className="type-annotation text-void-60">Not written.</p>
                  )}
                  {snippet.losses.map((loss) => (
                    <div key={`${loss.reason}|${loss.mode}|${loss.detail}`} className="flex flex-col gap-1">
                      <OutcomeMark outcome={REASON[loss.reason].outcome} />
                      <p className="type-annotation text-void-60">
                        {loss.mode && set.modes.length > 1 ? `${loss.mode}: ` : ''}
                        {loss.detail}
                      </p>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          </>
        )}
      </ToolView>
    </ViewContainer>
  )
}
