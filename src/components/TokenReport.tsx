import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { write } from '@/engine/convert'
import { DEFAULT_OPTIONS, joinPath, type FormatId, type LossEntry, type TokenSet } from '@/engine/types'
import { REASON, type Outcome } from '@/lib/describe'
import { OutcomeMark } from './OutcomeMark'

type Group = 'dropped' | 'changed'

/**
 * Your tokens against one target format, grouped by the worst thing that format
 * does to each: dropped, then changed, each token with every reason. Tokens that
 * keep their meaning are listed by name only, since there is nothing to explain.
 */
export function TokenReport({ set, target }: { set: TokenSet; target: FormatId }) {
  const { groups, same } = useMemo(() => {
    const byToken = new Map<string, LossEntry[]>()
    for (const loss of write(set, target, DEFAULT_OPTIONS).losses) {
      if (REASON[loss.reason].outcome === 'read') continue
      byToken.set(loss.token, [...(byToken.get(loss.token) ?? []), loss])
    }
    const groups: Record<Group, { token: string; losses: LossEntry[] }[]> = { dropped: [], changed: [] }
    const same: string[] = []
    for (const token of set.tokens.map((t) => joinPath(t.path))) {
      const losses = byToken.get(token)
      if (!losses) {
        same.push(token)
        continue
      }
      const worst: Outcome = losses.some((l) => REASON[l.reason].outcome === 'dropped') ? 'dropped' : 'changed'
      groups[worst as Group].push({ token, losses })
    }
    return { groups, same }
  }, [set, target])

  return (
    <div className="flex flex-col gap-4">
      {(['dropped', 'changed'] as Group[]).map(
        (group) =>
          groups[group].length > 0 && (
            <div key={group} className="overflow-hidden rounded-card border border-line">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line-subtle bg-surface-raised/40">
                <OutcomeMark outcome={group} />
                <span className="type-annotation text-ink-muted">{groups[group].length}</span>
              </div>
              {groups[group].map(({ token, losses }, i) => (
                <div
                  key={token}
                  className={`grid grid-cols-[14rem_1fr] gap-4 px-4 py-3 ${i < groups[group].length - 1 ? 'border-b border-line-subtle' : ''}`}
                >
                  <span className="type-code-sm text-void-80 break-all">{token}</span>
                  <div className="flex flex-col gap-2">
                    {losses.map((loss) => (
                      <p key={`${loss.reason}|${loss.mode}|${loss.detail}`} className="type-annotation text-ink-body">
                        <span className="text-ink-title">{REASON[loss.reason].title}.</span>{' '}
                        {loss.mode && set.modes.length > 1 ? `${loss.mode}: ` : ''}
                        {loss.detail}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ),
      )}

      {same.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line-subtle bg-surface-raised/40">
            <span className="inline-flex items-center gap-1.5 type-annotation-sc text-ink-muted">
              <Check className="w-3.5 h-3.5" />
              Same meaning
            </span>
            <span className="type-annotation text-ink-muted">{same.length}</span>
          </div>
          {groupByRoot(same).map(([root, names], i, groups) => (
            <div
              key={root}
              className={`grid grid-cols-[14rem_1fr] gap-4 px-4 py-3 ${i < groups.length - 1 ? 'border-b border-line-subtle' : ''}`}
            >
              <span className="type-code-sm text-void-80">
                {root} <span className="type-annotation text-ink-muted">{names.length}</span>
              </span>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {names.map((name) => (
                  <li key={name} className="type-code-sm text-void-70">{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Token names grouped by their first path segment (`color.void-10` under
 * `color`), in first-seen order. Single-segment names, as a CSS theme often
 * has, are grouped together as "other".
 */
function groupByRoot(tokens: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const token of tokens) {
    const dot = token.indexOf('.')
    const [root, name] = dot === -1 ? ['other', token] : [token.slice(0, dot), token.slice(dot + 1)]
    groups.set(root, [...(groups.get(root) ?? []), name])
  }
  return [...groups].sort(([a], [b]) => (a === 'other' ? 1 : b === 'other' ? -1 : 0))
}
