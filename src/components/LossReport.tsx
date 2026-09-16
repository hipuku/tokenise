import { useState } from 'react'
import { Button, InlineCode, Metric, StatusChip, accentText } from 'kern'
import { LOSS_REASONS, type LossEntry, type LossReason } from '@/engine/types'
import { OUTCOME, REASON, summarise, type Outcome } from '@/lib/describe'
import { cn } from '@/lib/utils'

/** Rows shown per reason before the rest fold away. haus alone produces 147 lenient reads. */
const FOLD_AT = 6

export function LossReport({ tokenPaths, losses, modes }: { tokenPaths: string[][]; losses: LossEntry[]; modes: string[] }) {
  const summary = summarise(tokenPaths, losses)
  const byReason = new Map<LossReason, LossEntry[]>()
  for (const loss of losses) byReason.set(loss.reason, [...(byReason.get(loss.reason) ?? []), loss])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-3">
        <Metric label="Tokens in" value={summary.tokens} valueClassName="type-h4 font-mono text-ink-title" />
        <Metric label="Exact" value={summary.exact} valueClassName="type-h4 font-mono text-ink-title" />
        <Metric label="Changed" value={summary.changed} valueClassName="type-h4 font-mono text-solstice" />
        <Metric label="Dropped" value={summary.dropped} valueClassName="type-h4 font-mono text-flare" />
      </div>

      {losses.length === 0 && (
        <p className="type-p-sm text-void-60">Every token converted exactly. Nothing to report.</p>
      )}

      {LOSS_REASONS.filter((reason) => byReason.has(reason)).map((reason) => (
        <ReasonGroup key={reason} reason={reason} entries={byReason.get(reason)!} showMode={modes.length > 1} />
      ))}
    </div>
  )
}

function ReasonGroup({ reason, entries, showMode }: { reason: LossReason; entries: LossEntry[]; showMode: boolean }) {
  const [open, setOpen] = useState(false)
  const { outcome, title, explanation } = REASON[reason]
  const shown = open ? entries : entries.slice(0, FOLD_AT)

  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center gap-2">
        <OutcomeMark outcome={outcome} />
        <h3 className="type-h6 text-void-80">{title}</h3>
        <StatusChip colour={OUTCOME[outcome].colour}>{entries.length}</StatusChip>
        <InlineCode colour="neutral" className="ml-auto">
          {reason}
        </InlineCode>
      </div>
      <p className="type-annotation text-void-60">{explanation}</p>

      <div className="rounded-xl overflow-hidden border border-void-20">
        {shown.map((entry, i) => (
          <div
            key={`${entry.token}|${entry.mode}|${entry.detail}`}
            className={cn('flex items-baseline gap-4 px-4 py-2.5', i < shown.length - 1 && 'border-b border-void-20')}
          >
            <span className="type-annotation font-mono text-void-80 w-56 shrink-0 truncate" title={entry.token}>
              {entry.token}
            </span>
            {showMode && (
              <span className="type-annotation font-mono text-void-50 w-16 shrink-0 truncate">{entry.mode ?? 'all'}</span>
            )}
            <span className="type-annotation text-void-60 min-w-0">{entry.detail}</span>
          </div>
        ))}
      </div>

      {entries.length > FOLD_AT && (
        <Button size="sm" variant="link" className="self-start" onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `Show all ${entries.length}`}
        </Button>
      )}
    </section>
  )
}

/** Outcome by icon and word as well as colour, since flare is this tool's accent and not only its error colour. */
export function OutcomeMark({ outcome }: { outcome: Outcome }) {
  const { icon: Icon, label, colour } = OUTCOME[outcome]
  return (
    <span className={cn('inline-flex items-center gap-1.5 type-annotation-sc', accentText[colour])}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}
