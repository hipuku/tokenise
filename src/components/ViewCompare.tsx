import { useMemo, useState } from 'react'
import { ToggleChip, ViewHeader } from 'kern'
import { read } from '@/engine/convert'
import { compareFormats } from '@/lib/compare'
import { EXAMPLES } from '@/lib/examples'
import { Block } from './Block'
import { FormatVerdicts } from './FormatVerdicts'
import { PropertyTable } from './PropertyTable'
import { RosettaPanel } from './RosettaPanel'

/**
 * Compare a token: a handful of fixed examples, each written in all four formats
 * at once. They are chosen so each format fails a different one. Read verdict
 * first, then part by part, then as each format writes it.
 */
export function ViewCompare() {
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id)
  const example = EXAMPLES.find((e) => e.id === exampleId)!

  const { set, token, snippets } = useMemo(() => {
    const outcome = read([{ name: example.fileName ?? 'token.json', text: example.source }])
    const token = outcome.set.tokens.find((t) => t.path.join('.') === example.token) ?? outcome.set.tokens[0]
    return { set: outcome.set, token, snippets: compareFormats(outcome.set, token) }
  }, [example])

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col gap-8">
      <ViewHeader
        title="Compare a token"
        description="The same token written in all four formats. Each example breaks a different format, so pick one to see what each keeps, changes or drops."
      />
      <div role="group" aria-label="Example" className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((e) => (
          <ToggleChip key={e.id} active={e.id === exampleId} onClick={() => setExampleId(e.id)}>
            {e.label}
          </ToggleChip>
        ))}
      </div>
      <Block title="At a glance">
        <FormatVerdicts snippets={snippets} />
      </Block>
      <Block title="By property">
        <PropertyTable example={example} snippets={snippets} />
      </Block>
      <Block title="As written">
        <RosettaPanel set={set} token={token} />
      </Block>
    </div>
  )
}

