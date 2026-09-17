import { useState } from 'react'
import { ArrowLeftRight, Columns4, FileSearch, Info } from 'lucide-react'
import { AppShell, Colophon, SocialBar } from 'kern'
import { ViewAbout } from '@/components/ViewAbout'
import { ViewConvert } from '@/components/ViewConvert'
import { ViewCompare } from '@/components/ViewCompare'
import { ViewDifference } from '@/components/ViewDifference'
import type { ViewId } from './types'

const NAV_ITEMS = [
  { id: 'about',      label: 'About this tool', icon: Info           },
  { id: 'convert',    label: 'Convert tokens',  icon: ArrowLeftRight },
  { id: 'compare',    label: 'Compare a token', icon: Columns4       },
  { id: 'difference', label: 'Check a file',    icon: FileSearch     },
]

const LOGO_FILLS = {
  hi: 'var(--color-flare)',
  pu: 'var(--color-solstice)',
  ku: 'var(--color-dusk)',
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('about')

  return (
    <AppShell
      logo={<img src="/tokenise.svg" alt="tokenise" className="h-7 w-auto" />}
      navItems={NAV_ITEMS}
      activeId={activeView}
      onNavigate={(id) => setActiveView(id as ViewId)}
      accentActiveClass="text-flare"
      social={<SocialBar siteName="tokenise" />}
      colophon={<Colophon name="tokenise" hoverFills={LOGO_FILLS} />}
      smallScreenNotice={
        <div className="flex flex-col gap-2 text-center max-w-xs">
          <p className="type-h4 text-ink-title">
            <code className="font-mono text-flare">--screen: small</code> has no equivalent
          </p>
          <p className="type-p-sm text-ink-body">
            tokenise is desktop-only for now. Open it on a wider screen to see what converts.
          </p>
        </div>
      }
    >
      {/*
       * Each view owns its own input state, as in the sibling experiments. The
       * views are mounted only while active, so switching tabs starts the tool
       * fresh — nothing pasted in one carries into another.
       */}
      {activeView === 'about'      && <ViewAbout />}
      {activeView === 'convert'    && <ViewConvert />}
      {activeView === 'compare'    && <ViewCompare />}
      {activeView === 'difference' && <ViewDifference />}
    </AppShell>
  )
}
