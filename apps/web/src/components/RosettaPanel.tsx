import { Check } from 'lucide-react'
import { Card, CopyButton, focusRing } from 'kern'
import { FORMAT_LABEL, type Token, type TokenSet } from '@/engine/types'
import { compareFormats } from '@/lib/compare'
import { cn } from '@/lib/utils'
import { REASON } from '@/lib/describe'
import { highlight } from '@/lib/highlight'
import { FormatChip } from './CodeField'
import { OutcomeMark } from './OutcomeMark'

/**
 * One token written in all four formats side by side, each snippet syntax-
 * highlighted, with a divider and then what that format did to it: changed,
 * dropped, or kept exactly. The literal form of the thesis: one decision, four
 * dialects, and DTCG the one that holds it whole.
 */
export function RosettaPanel({ set, token }: { set: TokenSet; token: Token }) {
  const snippets = compareFormats(set, token)

  return (
    <div className="grid grid-cols-2 auto-rows-fr gap-4">
      {snippets.map((snippet) => {
        const lang = snippet.format === 'tailwind' ? 'css' : 'json'
        return (
          <Card key={snippet.format} className="flex flex-col gap-3 min-w-0">
            <div className="flex min-h-7 items-center justify-between gap-2">
              <FormatChip>{FORMAT_LABEL[snippet.format]}</FormatChip>
              {snippet.text && <CopyButton text={snippet.text} className="w-7 h-7" />}
            </div>

            {snippet.text ? (
              // Focusable, because a region that scrolls but cannot take focus
              // cannot be scrolled from the keyboard.
              <pre
                tabIndex={0}
                role="region"
                aria-label={`${FORMAT_LABEL[snippet.format]} snippet`}
                className={cn('h-64 overflow-auto rounded-sm type-code-sm text-void-70 whitespace-pre-wrap break-all', focusRing)}
                dangerouslySetInnerHTML={{ __html: highlight(snippet.text, lang) }}
              />
            ) : (
              <p className="h-64 type-code-sm text-void-50">Nothing written.</p>
            )}

            <div className="flex flex-col gap-2 border-t border-line pt-3">
              {snippet.losses.length === 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1.5 type-annotation-sc text-void-50">
                    <Check className="w-3.5 h-3.5" />
                    Same meaning
                  </span>
                  <p className="type-annotation text-void-60">
                    Written in {FORMAT_LABEL[snippet.format]}’s own syntax; every value means the same as the source.
                  </p>
                </div>
              ) : (
                snippet.losses.map((loss) => (
                  <div key={`${loss.reason}|${loss.mode}|${loss.detail}`} className="flex flex-col gap-1">
                    <OutcomeMark outcome={REASON[loss.reason].outcome} />
                    <p className="type-annotation text-void-60">
                      {loss.mode && set.modes.length > 1 ? `${loss.mode}: ` : ''}
                      {loss.detail}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
