import { accentText } from 'kern'
import { OUTCOME, type Outcome } from '@/lib/describe'
import { cn } from '@/lib/utils'

/**
 * An outcome by icon and word as well as colour, since flare is this tool's
 * accent and not only its error colour: colour alone could not carry it.
 */
export function OutcomeMark({ outcome }: { outcome: Outcome }) {
  const { icon: Icon, label, colour } = OUTCOME[outcome]
  return (
    <span className={cn('inline-flex items-center gap-1.5 type-annotation-sc', accentText[colour])}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}
