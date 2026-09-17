import type { ReactNode } from 'react'
import { BulletItem, BulletList, DataTable, ExternalLink, InlineCode, Section, ViewContainer } from 'kern'
import { LOSS_REASONS } from '@/engine/types'
import { REASON } from '@/lib/describe'
import { OutcomeMark } from './OutcomeMark'

export function ViewAbout() {
  return (
    <ViewContainer width="lg" gap="lg">

      {/* ── Title + intro ── */}
      <div className="flex flex-col gap-3">
        <h1 className="type-h3 text-ink-title">tokenise</h1>
        <p className="type-p-sm text-void-60">
          A design token is one decision: this is the colour for primary actions. But there is no single way to write it
          down. The{' '}
          <ExternalLink href="https://www.designtokens.org/tr/2025.10/">Design Tokens Community Group</ExternalLink>{' '}
          published a stable JSON format in October 2025. Figma exports variables in its own shape of that format.
          Tokens Studio kept the format it had before the spec existed. Tailwind v4 writes tokens as CSS custom
          properties and uses no JSON at all.
        </p>
        <p className="type-p-sm text-void-60">
          They overlap for most tokens and disagree at the edges: modes, references, composite values, colour spaces and
          units. <strong className="text-void-80 font-semibold">Convert</strong> moves a file between any two.{' '}
          <strong className="text-void-80 font-semibold">Compare a token</strong> shows where the formats can’t agree,
          and <strong className="text-void-80 font-semibold">Check a file</strong> shows what that means for your own
          tokens. The background is in{' '}
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
              <span className="whitespace-nowrap"><ExternalLink href="https://www.designtokens.org/tr/2025.10/format/">DTCG 2025.10</ExternalLink></span>,
              'A resolver document: sets, and a modifier with one context per mode',
              <TC>{'{group.token}'}</TC>,
              'Typography, shadow, border, transition, gradient, stroke style',
            ],
            [
              <span className="whitespace-nowrap"><ExternalLink href="https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables">Figma variables</ExternalLink></span>,
              'One file per mode',
              'Aliases to other variables',
              'None. Typography and shadows are styles, and the export has no styles',
            ],
            [
              <span className="whitespace-nowrap"><ExternalLink href="https://docs.tokens.studio/manage-tokens/token-types">Tokens Studio</ExternalLink></span>,
              'Themes, each selecting token sets',
              <TC>{'{token.name}'}</TC>,
              'Typography, box shadow, border, composition',
            ],
            [
              <span className="whitespace-nowrap"><ExternalLink href="https://tailwindcss.com/docs/theme">Tailwind v4</ExternalLink></span>,
              'None. A selector redefines the properties',
              <TC>var(--name)</TC>,
              <>
                Size companions only: <TC>--text-sm--line-height</TC>
              </>,
            ],
          ]}
        />
      </Section>

      {/* ── Convert ── */}
      <Section title="Convert tokens">
        <p className="type-p-sm text-void-60">
          Every format is read into one internal model shaped like DTCG 2025.10, the most expressive of the four, and
          written out of it. There is no direct path from one format to another, so a conversion never depends on which
          pair was chosen. The model keeps what the source wrote: a colour stays in the space it was authored in until a
          target needs sRGB, and a Tokens Studio type such as <C>borderRadius</C> is restored when the output is Tokens
          Studio again. Paste a file, pick a target, copy the result.
        </p>
      </Section>

      {/* ── The loss report ── */}
      <Section title="What gets reported">
        <p className="type-p-sm text-void-60">
          A token has the same meaning when it converts with nothing to report, even if the syntax looks nothing alike.
          Otherwise it falls under one of eleven reasons, grouped by what happened to it — the same reasons Compare and
          Check a file use.
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

      {/* ── Compare and Check a file ── */}
      <Section title="Seeing the difference">
        <p className="type-p-sm text-void-60">
          <strong className="text-void-80 font-semibold">Compare a token</strong> is the reference: eleven example tokens,
          each written in all four formats, with what each one keeps, changes or drops, part by part. Every kind of token
          the formats disagree about has an example.
        </p>
        <p className="type-p-sm text-void-60">
          <strong className="text-void-80 font-semibold">Check a file</strong> is the report: paste your own tokens to see
          how much of the file each format keeps, then pick a format to see every token it drops or changes, and why.
        </p>
      </Section>

    </ViewContainer>
  )
}

/** Inline code in prose: the design system's `type-code` size (0.9375rem). */
function C({ children }: { children: ReactNode }) {
  return <InlineCode colour="solstice">{children}</InlineCode>
}

/**
 * Inline code inside a `DataTable` cell. The cells are `type-annotation`
 * (0.8125rem), so an `InlineCode` at `type-code` reads a size too large beside
 * them; this matches the cell's own type size in the mono family.
 */
function TC({ children }: { children: ReactNode }) {
  return (
    <code className="type-annotation font-mono bg-surface-raised px-[5px] py-[1px] rounded-inline text-solstice">
      {children}
    </code>
  )
}
