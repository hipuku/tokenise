import type { ReactNode } from 'react'
import { BulletItem, BulletList, DataTable, ExternalLink, InlineCode, Section, ToolLink, ViewContainer } from 'kern'
import { LOSS_REASONS } from '@/engine/types'
import { REASON } from '@/lib/describe'
import type { ViewId } from '../types'
import { OutcomeMark } from './LossReport'

export function ViewAbout({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  return (
    <ViewContainer width="lg" gap="lg">

      {/* ── Title + intro ── */}
      <div className="flex flex-col gap-3">
        <h1 className="type-h4 text-void-90">The same token, written four ways</h1>
        <p className="type-p-sm text-void-60">
          A design token is one decision: this is the colour for primary actions. Where that decision is written down
          depends on the tool. The{' '}
          <ExternalLink href="https://www.designtokens.org/tr/2025.10/">Design Tokens Community Group</ExternalLink>{' '}
          published a stable JSON format in October 2025. Figma exports variables in its own shape of that format.
          Tokens Studio kept the format it had before the spec existed. Tailwind v4 writes tokens as CSS custom
          properties and uses no JSON at all.
        </p>
        <p className="type-p-sm text-void-60">
          The four overlap for most tokens and disagree at the edges: modes, references, composite values, colour
          spaces and units. Converting between them is the easy part, and several tools already do it. tokenise also
          reports every token that did not survive the conversion exactly, and why. The background is in{' '}
          <ExternalLink href="https://hipuku.dev/writing/the-language-we-never-agreed-on">
            The Language We Never Agreed On
          </ExternalLink>
          .
        </p>
      </div>

      {/* ── The four formats ── */}
      <Section title="The four formats">
        <DataTable
          caption="How the four formats differ"
          columns={['Format', 'Modes', 'References', 'Composites']}
          rows={[
            [
              <ExternalLink href="https://www.designtokens.org/tr/2025.10/format/">DTCG 2025.10</ExternalLink>,
              'A resolver document: sets, and a modifier with one context per mode',
              <C>{'{group.token}'}</C>,
              'Typography, shadow, border, transition, gradient, stroke style',
            ],
            [
              <ExternalLink href="https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables">Figma export</ExternalLink>,
              'One file per mode',
              'Aliases to other variables',
              'None. Typography and shadows are styles, and the export has no styles',
            ],
            [
              <ExternalLink href="https://docs.tokens.studio/manage-tokens/token-types">Tokens Studio</ExternalLink>,
              'Themes, each selecting token sets',
              <C>{'{token.name}'}</C>,
              'Typography, box shadow, border, composition',
            ],
            [
              <ExternalLink href="https://tailwindcss.com/docs/theme">Tailwind v4</ExternalLink>,
              'None. A selector redefines the properties',
              <C>var(--name)</C>,
              <>
                Size companions only: <C>--text-sm--line-height</C>
              </>,
            ],
          ]}
        />
      </Section>

      {/* ── Convert ── */}
      <Section title="Convert tokens">
        <p className="type-p-sm text-void-60">
          Every format is read into one internal model shaped like DTCG 2025.10, the most expressive of the four, and
          written out of it. There is no direct path from one format to another, so a conversion never depends on
          which pair was chosen. The model keeps what the source wrote: a colour stays in the space it was authored in
          until a target needs sRGB, and a Tokens Studio type such as <C>borderRadius</C> is restored when the output
          is Tokens Studio again.
        </p>
        <ToolLink onClick={() => onNavigate('convert')} colour="flare">
          Convert tokens →
        </ToolLink>
      </Section>

      {/* ── The loss report ── */}
      <Section title="What the report counts">
        <p className="type-p-sm text-void-60">
          A token is exact when it converts with nothing to report. Otherwise each entry has one of eleven reasons,
          grouped by what happened to the token.
        </p>
        <BulletList>
          {LOSS_REASONS.map((reason) => (
            <BulletItem key={reason}>
              <span className="inline-flex items-center gap-2">
                <OutcomeMark outcome={REASON[reason].outcome} />
                <strong className="text-void-80 font-semibold">{REASON[reason].title}.</strong>
              </span>{' '}
              {REASON[reason].explanation}
            </BulletItem>
          ))}
        </BulletList>
        <p className="type-p-sm text-void-60">
          Colour conversion reports how far a colour moved as CIEDE2000 ΔE, the same measure hexicon uses. A ΔE under 1
          is not visible; above 2 it is.
        </p>
      </Section>

      {/* ── Inspect and compare ── */}
      <Section title="Inspect and compare">
        <p className="type-p-sm text-void-60">
          Inspect shows the tokens as they were read, before anything is written: each type, each value per mode, and
          the chain of references a value resolves through. A token with no type is marked, because every writer
          drops it.
        </p>
        <ToolLink onClick={() => onNavigate('inspect')} colour="solstice">
          Inspect tokens →
        </ToolLink>
        <p className="type-p-sm text-void-60">
          Compare writes a single token in all four formats at once, with what each one could not hold beside it.
        </p>
        <ToolLink onClick={() => onNavigate('compare')} colour="dusk">
          Compare formats →
        </ToolLink>
      </Section>

    </ViewContainer>
  )
}

function C({ children }: { children: ReactNode }) {
  return <InlineCode colour="solstice">{children}</InlineCode>
}
