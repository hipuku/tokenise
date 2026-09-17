import type { ReactNode } from 'react'
import EditorImport from 'react-simple-code-editor'
import { CopyButton, StatusChip } from 'kern'
import { highlight, type CodeLang } from '@/lib/highlight'
import { cn } from '@/lib/utils'

// react-simple-code-editor is CommonJS; Vite's interop can wrap the default
// export an extra level, so unwrap it defensively.
const Editor = ((EditorImport as unknown as { default?: typeof EditorImport }).default ?? EditorImport) as typeof EditorImport

/**
 * Every code box in tokenise: one chrome, with its controls inside it. A chip
 * top left says what the code is (a detected format, or that it was not
 * recognised), a copy button top right copies all of it, and actions sit bottom
 * right. Editable boxes use `react-simple-code-editor` (a transparent textarea
 * over a highlighted layer); read-only ones are a highlighted `<pre>`. The code
 * scrolls between the two bars; the bars never do.
 */
export function CodeField({
  value,
  onValueChange,
  language,
  readOnly,
  placeholder,
  invalid,
  chip,
  actions,
  children,
  heightClass = 'h-[30rem]',
  className,
  ...aria
}: {
  value: string
  onValueChange?: (value: string) => void
  language: CodeLang
  readOnly?: boolean
  placeholder?: string
  invalid?: boolean
  /** Bottom left: what this code is. */
  chip?: ReactNode
  /** Bottom right: what you can do to it. */
  actions?: ReactNode
  /** Replaces the code area, e.g. a list of opened files that cannot share one field. */
  children?: ReactNode
  heightClass?: string
  className?: string
  'aria-label'?: string
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-card border bg-surface-panel transition-colors',
        heightClass,
        invalid ? 'border-flare' : 'border-line-subtle',
        !readOnly && 'focus-within:border-line-strong',
        className,
      )}
    >
      {value && <CopyButton text={value} className="absolute top-2 right-2 z-10 w-7 h-7" />}

      <div className="flex-1 min-h-0 overflow-auto pt-4 pr-8 type-code-sm">
        {children ||
          (readOnly ? (
            value ? (
              <pre className="px-4 pb-4 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlight(value, language) }} />
            ) : (
              <p className="px-4 pb-4 text-ink-muted">{placeholder}</p>
            )
          ) : (
            <Editor
              value={value}
              onValueChange={(v) => onValueChange?.(v)}
              highlight={(code) => highlight(code, language)}
              padding={{ top: 0, right: 16, bottom: 16, left: 16 }}
              placeholder={placeholder}
              textareaClassName="focus:outline-none"
              className="min-h-full"
              spellCheck={false}
              {...aria}
            />
          ))}
      </div>

      {(chip || actions) && (
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
          <div className="flex items-center gap-2">{chip}</div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
    </div>
  )
}

/** The bottom-left chip: a neutral detected format, or flare when nothing could be read. */
export function FormatChip({ children, error }: { children: ReactNode; error?: boolean }) {
  return <StatusChip colour={error ? 'flare' : 'neutral'}>{children}</StatusChip>
}
