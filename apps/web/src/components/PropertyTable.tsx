import { FORMAT_LABEL } from '@/engine/types'
import { verdict, type FormatSnippet } from '@/lib/compare'
import type { Example } from '@/lib/examples'
import { OutcomeMark } from './OutcomeMark'

/**
 * The example token part by part against the four formats: the value each wrote,
 * Dropped where it has no place for it, and Changed where it wrote something
 * other than the standard did. A one-row example has no parts to tell apart, so
 * a value that reads the same but lost its type carries the format's verdict.
 * Measured against DTCG, or the example's own source where DTCG cannot hold it.
 */
export function PropertyTable({ example, snippets }: { example: Example; snippets: FormatSnippet[] }) {
  const columns = snippets.map((s) => ({ format: s.format, values: example.valuesOf(s), verdict: verdict(s) }))
  const standard = columns.find((c) => c.format === (example.standard ?? 'dtcg'))!.values

  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="grid grid-cols-[10rem_repeat(4,1fr)] border-b border-line-subtle bg-surface-raised/40">
        <div className="px-4 py-3 type-annotation-sc text-ink-body">Property</div>
        {columns.map(({ format }) => (
          <div key={format} className="px-4 py-3 type-annotation-sc text-ink-body">{FORMAT_LABEL[format]}</div>
        ))}
      </div>
      {example.rows.map((row, i) => (
        <div
          key={row.key}
          className={`grid grid-cols-[10rem_repeat(4,1fr)] ${i < example.rows.length - 1 ? 'border-b border-line-subtle' : ''}`}
        >
          <div className="px-4 py-3 type-p-sm text-ink-body">{row.label}</div>
          {columns.map(({ format, values, verdict }) => {
            const value = values[row.key]
            const fold = (v: string | null) => (v !== null && example.compareAs ? example.compareAs(v) : v)
            const mark =
              fold(value) !== fold(standard[row.key]) ? 'changed' : example.rows.length === 1 && verdict !== 'kept' ? verdict : null
            return (
              <div key={format} className="flex flex-col gap-1 px-4 py-3 min-w-0">
                {value === null ? (
                  <OutcomeMark outcome="dropped" />
                ) : (
                  <>
                    <span className="type-code-sm text-void-80 break-words" title={value}>{value}</span>
                    {mark && <OutcomeMark outcome={mark} />}
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
