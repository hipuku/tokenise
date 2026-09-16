import { useState } from 'react'
import { ArrowLeftRight, Columns4, Info, ListTree } from 'lucide-react'
import { AppShell, Colophon, SocialBar } from 'kern'
import { ViewAbout } from '@/components/ViewAbout'
import { ViewConvert } from '@/components/ViewConvert'
import { ViewInspect } from '@/components/ViewInspect'
import { ViewCompare } from '@/components/ViewCompare'
import { useTokenInput } from '@/lib/useTokenInput'
import type { ViewId } from './types'

const NAV_ITEMS = [
  { id: 'about',   label: 'About this tool',  icon: Info           },
  { id: 'convert', label: 'Convert tokens',   icon: ArrowLeftRight },
  { id: 'inspect', label: 'Inspect tokens',   icon: ListTree       },
  { id: 'compare', label: 'Compare formats',  icon: Columns4       },
]

const LOGO_FILLS = {
  hi: 'var(--color-flare)',
  pu: 'var(--color-solstice)',
  ku: 'var(--color-dusk)',
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('about')
  const input = useTokenInput()

  return (
    <AppShell
      logo={<img src="/tokenise.svg" alt="tokenise" className="h-7 w-auto" />}
      navItems={NAV_ITEMS}
      activeId={activeView}
      onNavigate={(id) => setActiveView(id as ViewId)}
      accentActiveClass="text-flare"
      social={<SocialBar siteName="tokenise" githubUrl="https://github.com/hipuku/tokenise" />}
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
      {activeView === 'about'   && <ViewAbout onNavigate={setActiveView} />}
      {activeView === 'convert' && <ViewConvert input={input} />}
      {activeView === 'inspect' && <ViewInspect input={input} />}
      {activeView === 'compare' && <ViewCompare input={input} />}
    </AppShell>
  )
}
