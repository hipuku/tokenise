import { Check } from 'lucide-react'
import { FORMAT_LABEL } from '@/engine/types'
import { verdict, type FormatSnippet } from '@/lib/compare'
import { OutcomeMark } from './OutcomeMark'

/**
 * One cell per format: the format as the heading, the verdict under it, the
 * reason last: three steps down in size, so the answer reads before any code.
 */
export function FormatVerdicts({ snippets }: { snippets: FormatSnippet[] }) {
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-card border border-line divide-x divide-line-subtle">
      {snippets.map((snippet) => {
        const outcome = verdict(snippet)
        return (
          <div key={snippet.format} className="flex flex-col gap-2 p-4 min-w-0">
            <h3 className="type-p-base font-medium text-ink-title">
              {FORMAT_LABEL[snippet.format]}
              {snippet.format === 'dtcg' && <span className="type-annotation text-ink-muted ml-2">standard</span>}
            </h3>
            {outcome === 'kept' ? (
              <span className="inline-flex items-center gap-1.5 type-annotation-sc text-ink-muted">
                <Check className="w-3.5 h-3.5" />
                Same meaning
              </span>
            ) : (
              <OutcomeMark outcome={outcome} />
            )}
            <p className="type-annotation text-ink-muted">
              {snippet.losses[0]?.detail ?? 'Different syntax, every value means the same.'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
