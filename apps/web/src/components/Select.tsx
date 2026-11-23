import type { ComponentPropsWithRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

/**
 * A styled native select. kern has no dropdown atom yet, so this matches the
 * house input chrome (surface, border, border-only focus) around a real
 * `<select>` and adds the chevron browsers hide when `appearance` is stripped.
 * A candidate to promote into kern.
 */
export function Select({
  options,
  placeholder,
  className,
  ...props
}: { options: SelectOption[]; placeholder?: string } & Omit<ComponentPropsWithRef<'select'>, 'children'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'w-full type-p-sm bg-surface-panel text-ink-title appearance-none cursor-pointer',
          'border border-line-subtle rounded-card pl-4 pr-10 py-2.5',
          'outline-none transition-colors duration-(--duration-fast) ease-(--ease-standard) focus:border-line-strong',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden="true" />
    </div>
  )
}
