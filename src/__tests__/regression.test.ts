/**
 * Regression tests for bugs found and fixed during QA.
 * Each test is labelled with its bug ID so future readers can trace cause→fix.
 */

import { describe, it, expect } from 'vitest'
import { DEFAULT_FIELDS } from '../parseCitation'
import { splitCitations } from '../lib/citation/splitCitations'
import { formatBibTeX } from '../lib/bibtex/bibToTxt'

// ─── B1 ──────────────────────────────────────────────────────────────────────
// Bug:  @article{ (no key on opening line) caused parseBibEntry to capture
//       "author={John" as the citation key, producing [@author={John] in Pandoc
//       output instead of the expected [@citation] fallback.
// Fix:  parseBibEntry.ts — rawKey containing '=' or '{' is treated as empty.
// Risk: Any refactor of the parseBibEntry key-extraction regex.

describe('B1 — parseBibEntry key fallback when key is missing', () => {
  const noKeyBib = `@article{
  author={John Smith},
  title={Untitled},
  year={2024}
}`

  it('falls back to [@citation] when BibTeX key is absent', () => {
    const r = formatBibTeX(noKeyBib, 'pandoc', DEFAULT_FIELDS)
    expect(r.ok).toBe(true)
    expect(r.output).toContain('[@citation]')
  })

  it('does not contaminate cite key with field content', () => {
    const r = formatBibTeX(noKeyBib, 'pandoc', DEFAULT_FIELDS)
    expect(r.output ?? '').not.toContain('[@author=')
  })

  it('does not throw on missing key input', () => {
    expect(() => formatBibTeX(noKeyBib, 'pandoc', DEFAULT_FIELDS)).not.toThrow()
  })
})

// ─── B2 ──────────────────────────────────────────────────────────────────────
// Bug:  In App.tsx, the citationStyle !== 'classic' branch returned early before
//       the batch check, so only the first BibTeX entry was formatted when
//       multiple entries were pasted with a non-classic style (e.g. Pandoc).
//       Entries 2..N were silently ignored.
// Fix:  App.tsx — inside the non-classic path, call isBatch() first;
//       if true, split with splitCitations() and apply formatBibTeX per entry.
// Risk: Any reordering of handleConvert branches or addition of new styles.

describe('B2 — batch BibTeX with non-classic style: all entries processed', () => {
  const multiBib = `@article{A,
  author={John Smith},
  title={Paper A},
  year={2024}
}

@article{B,
  author={Jane Doe},
  title={Paper B},
  year={2023}
}`

  // Split mirrors what the fixed App.tsx path does before calling formatBibTeX.
  const chunks = splitCitations(multiBib, 'bib')
  const results = chunks.map(c => formatBibTeX(c.trim(), 'pandoc', DEFAULT_FIELDS))

  it('input splits into exactly 2 entries', () => {
    expect(chunks.length).toBe(2)
  })

  it('both entries convert successfully', () => {
    expect(results.every(r => r.ok)).toBe(true)
  })

  it('first entry produces [@A]', () => {
    expect(results[0].output).toContain('[@A]')
  })

  it('second entry is not silently ignored — produces [@B]', () => {
    expect(results[1].output).toContain('[@B]')
  })

  it('no undefined leaks into any output', () => {
    const combined = results.map(r => r.output ?? '').join('\n')
    expect(combined).not.toContain('undefined')
  })
})
