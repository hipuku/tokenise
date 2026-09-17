import { useMemo } from 'react'
import { write } from '@/engine/convert'
import { DEFAULT_OPTIONS, FORMAT_LABEL, type FormatId, type TokenSet } from '@/engine/types'
import { summarise } from '@/lib/describe'

const TARGETS: FormatId[] = ['dtcg', 'figma', 'tokens-studio', 'tailwind']

const pct = (n: number, total: number) => `${total ? (n / total) * 100 : 0}%`

/**
 * One stacked bar per format: how much of the whole file survives it — kept,
 * changed, dropped — with a fidelity percentage. The top-line answer to "which
 * format is safest for these tokens", and DTCG's full bar is the thesis: the
 * standard is the one that loses nothing.
 */
export function FidelityBars({ set }: { set: TokenSet }) {
  const rows = useMemo(() => {
    const paths = set.tokens.map((t) => t.path)
    return TARGETS.map((format) => {
      const { losses } = write(set, format, DEFAULT_OPTIONS)
      const s = summarise(paths, losses)
      return { format, ...s, fidelity: s.tokens ? Math.round((s.exact / s.tokens) * 100) : 100 }
    })
  }, [set])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 type-annotation text-ink-muted">
        <Legend className="bg-void-40" label="same meaning" />
        <Legend className="bg-solstice" label="changed" />
        <Legend className="bg-flare" label="dropped" />
        <span className="ml-auto">{set.tokens.length} tokens</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.format} className="grid grid-cols-[13rem_1fr_2.5rem] items-center gap-3">
            <span className="type-p-sm text-ink-body">
              {FORMAT_LABEL[r.format]}
              {r.format === 'dtcg' && <span className="type-annotation text-ink-muted ml-2">standard</span>}
            </span>
            <span className="flex h-3.5 rounded-inline overflow-hidden bg-void-10" role="img" aria-label={`${r.exact} same meaning, ${r.changed} changed, ${r.dropped} dropped`}>
              {r.exact > 0 && <span style={{ width: pct(r.exact, r.tokens) }} className="bg-void-40" />}
              {r.changed > 0 && <span style={{ width: pct(r.changed, r.tokens) }} className="bg-solstice" />}
              {r.dropped > 0 && <span style={{ width: pct(r.dropped, r.tokens) }} className="bg-flare" />}
            </span>
            <span className="type-annotation font-mono text-ink-body text-right">{r.fidelity}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-[3px] ${className}`} />
      {label}
    </span>
  )
}
