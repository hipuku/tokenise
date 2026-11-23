import type { ReactNode } from 'react'

/**
 * A titled sub-block of a view: an h2 set one step below the view title
 * (type-h5 under ViewHeader's type-h4). kern's Section sets its title at h4,
 * the same size as the view title, which flattens the hierarchy.
 */
export function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="type-h5 text-ink-title">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
