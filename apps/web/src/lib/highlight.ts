/**
 * A tiny syntax highlighter for the two languages tokenise shows, JSON and CSS.
 * It returns an HTML string of `<span class="tok-*">` fragments, themed in
 * `index.css` with the accent palette rather than a literal editor theme.
 *
 * Hand-written rather than pulling in Prism: only two grammars are needed, and
 * this keeps the token classes tied to the design system's colours.
 */

export type CodeLang = 'json' | 'css'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const span = (cls: string, text: string) => `<span class="${cls}">${escapeHtml(text)}</span>`

const JSON_TOKEN = /("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

function highlightJson(code: string): string {
  let out = ''
  let last = 0
  for (let m = JSON_TOKEN.exec(code); m; m = JSON_TOKEN.exec(code)) {
    out += escapeHtml(code.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1] !== undefined) {
      const isKey = /^\s*:/.test(code.slice(last))
      const inner = m[1].slice(1, -1)
      const isRef = /^\{[^}]*\}$/.test(inner)
      out += span(isKey ? 'tok-key' : isRef ? 'tok-ref' : 'tok-str', m[1])
    } else if (m[2] !== undefined) {
      out += span('tok-num', m[2])
    } else if (m[3] !== undefined) {
      out += span(m[3] === 'null' ? 'tok-null' : 'tok-bool', m[3])
    } else {
      out += span('tok-punc', m[4])
    }
  }
  return out + escapeHtml(code.slice(last))
}

const CSS_TOKEN =
  /(\/\*[\s\S]*?\*\/)|(@[\w-]+)|(--[\w-]+)|("[^"]*"|'[^']*')|(#[0-9a-fA-F]{3,8}\b)|([A-Za-z_-][\w-]*)(?=\()|(-?\d*\.?\d+(?:rem|px|em|%|vw|vh|vmin|vmax|ms|s|deg|fr)?\b)|([{}();:,])/g

function highlightCss(code: string): string {
  let out = ''
  let last = 0
  for (let m = CSS_TOKEN.exec(code); m; m = CSS_TOKEN.exec(code)) {
    out += escapeHtml(code.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1] !== undefined) out += span('tok-comment', m[1])
    else if (m[2] !== undefined) out += span('tok-atrule', m[2])
    else if (m[3] !== undefined) out += span('tok-prop', m[3])
    else if (m[4] !== undefined) out += span('tok-str', m[4])
    else if (m[5] !== undefined) out += span('tok-num', m[5])
    else if (m[6] !== undefined) out += span('tok-func', m[6])
    else if (m[7] !== undefined) out += span('tok-num', m[7])
    else out += span('tok-punc', m[8])
  }
  return out + escapeHtml(code.slice(last))
}

export function highlight(code: string, lang: CodeLang): string {
  return lang === 'css' ? highlightCss(code) : highlightJson(code)
}
