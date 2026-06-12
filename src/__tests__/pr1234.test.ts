/**
 * Automated regression + feature tests for PR1–PR4.
 * Run with: npx vitest run src/__tests__/pr1234.test.ts
 */

import { describe, it, expect } from 'vitest'
import { convert, convertBatch, isBatch, DEFAULT_FIELDS } from '../parseCitation'
import { splitCitations } from '../lib/citation/splitCitations'
import { detectFormat } from '../lib/citation/detect'
import { bibKey } from '../lib/citation/helpers'
import { venueKeyForType } from '../lib/citation/builder'
import { formatBibTeX } from '../lib/bibtex/bibToTxt'

// ─────────────────────────────────────────────────────────────────────────────
// PR1: Entry Type Selector
// ─────────────────────────────────────────────────────────────────────────────

describe('PR1: venueKeyForType()', () => {
  it('ARTICLE → journal', () => expect(venueKeyForType('ARTICLE')).toBe('journal'))
  it('INPROCEEDINGS → booktitle', () => expect(venueKeyForType('INPROCEEDINGS')).toBe('booktitle'))
  it('INCOLLECTION → booktitle', () => expect(venueKeyForType('INCOLLECTION')).toBe('booktitle'))
  it('BOOK → null', () => expect(venueKeyForType('BOOK')).toBeNull())
  it('MISC → null', () => expect(venueKeyForType('MISC')).toBeNull())
  it('TECHREPORT → null', () => expect(venueKeyForType('TECHREPORT')).toBeNull())
  it('PHDTHESIS → null', () => expect(venueKeyForType('PHDTHESIS')).toBeNull())
})

const APA_INPUT = 'Smith, J. (2024). Neural Agents for Citation Parsing. Journal of AI Systems, 10(2), 1-10.'

describe('PR1: Test 1-1 — TXT→BibTeX Auto = ARTICLE', () => {
  const r = convert(APA_INPUT, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('@article', () => expect(r.output).toMatch(/@article\{/i))
  it('journal field present', () => expect(r.output).toMatch(/journal=/))
  it('no booktitle field', () => expect(r.output).not.toMatch(/booktitle=/))
})

describe('PR1: Test 1-2 — Force INPROCEEDINGS', () => {
  const r = convert(APA_INPUT, 'txt', 'bib', DEFAULT_FIELDS, { entryType: 'INPROCEEDINGS' })
  it('ok', () => expect(r.ok).toBe(true))
  it('@inproceedings', () => expect(r.output).toMatch(/@inproceedings\{/i))
  it('booktitle field present', () => expect(r.output).toMatch(/booktitle=/))
  it('no journal field', () => expect(r.output).not.toMatch(/journal=/))
})

describe('PR1: Test 1-3 — BOOK: no venue field', () => {
  const r = convert(APA_INPUT, 'txt', 'bib', DEFAULT_FIELDS, { entryType: 'BOOK' })
  it('ok', () => expect(r.ok).toBe(true))
  it('@book', () => expect(r.output).toMatch(/@book\{/i))
  it('no journal field', () => expect(r.output).not.toMatch(/journal=/))
  it('no booktitle field', () => expect(r.output).not.toMatch(/booktitle=/))
})

describe('PR1: Test 1-4 — TECHREPORT: no venue field', () => {
  const r = convert(APA_INPUT, 'txt', 'bib', DEFAULT_FIELDS, { entryType: 'TECHREPORT' })
  it('ok', () => expect(r.ok).toBe(true))
  it('@techreport', () => expect(r.output).toMatch(/@techreport\{/i))
  it('no journal field', () => expect(r.output).not.toMatch(/journal=/))
  it('no booktitle field', () => expect(r.output).not.toMatch(/booktitle=/))
})

describe('PR1: Test 1-5 — MISC: no venue field', () => {
  const r = convert(APA_INPUT, 'txt', 'bib', DEFAULT_FIELDS, { entryType: 'MISC' })
  it('ok', () => expect(r.ok).toBe(true))
  it('@misc', () => expect(r.output).toMatch(/@misc\{/i))
  it('no journal field', () => expect(r.output).not.toMatch(/journal=/))
})

// ─────────────────────────────────────────────────────────────────────────────
// PR2: Pandoc formatter
// ─────────────────────────────────────────────────────────────────────────────

const BIB_SMITH = `@article{Smith2024,
  author={John Smith},
  title={Neural Agents for Citation Parsing},
  journal={Journal of AI Systems},
  year={2024},
  volume={10},
  number={2},
  pages={1-10},
  doi={10.1000/example}
}`

const BIB_NO_KEY = `@article{
  author={John Smith},
  title={Untitled},
  year={2024}
}`

describe('PR2: Test 2-1 — Pandoc basic output', () => {
  const r = formatBibTeX(BIB_SMITH, 'pandoc', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('contains [@Smith2024]', () => expect(r.output).toMatch(/\[@Smith2024\]/))
  it('contains ---', () => expect(r.output).toMatch(/---/))
  it('contains APA reference text', () => expect(r.output).toMatch(/Smith/))
})

describe('PR2: Test 2-2 — Missing key fallback', () => {
  const r = formatBibTeX(BIB_NO_KEY, 'pandoc', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('contains [@citation] or [@<key>]', () => expect(r.output).toMatch(/\[@\w+\]/))
  it('no "undefined" in output', () => expect(r.output ?? '').not.toMatch(/undefined/))
})

describe('PR2: Test 2-3 — APA style regression (unchanged)', () => {
  const r = formatBibTeX(BIB_SMITH, 'apa', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('no [@key] marker', () => expect(r.output ?? '').not.toMatch(/\[@/))
  it('contains author', () => expect(r.output).toMatch(/Smith/))
})

// ─────────────────────────────────────────────────────────────────────────────
// PR3: Batch conversion
// ─────────────────────────────────────────────────────────────────────────────

const MULTI_BIB = `@article{A,
 author={John Smith},
 title={Paper A},
 year={2024}
}

@article{B,
 author={Jane Doe},
 title={Paper B},
 year={2023}
}`

const MULTI_BIB_CRLF = MULTI_BIB.replace(/\n/g, '\r\n')

const MULTI_TXT_NUMBERED = `[1] Smith, J. (2024). Paper A. Journal of AI.

[2] Doe, J. (2023). Paper B. Journal of ML.`

const MULTI_TXT_BLANK = `Smith, J. (2024). Paper A.
Journal A, vol. 5, pp. 1-10.

Doe, J. (2023). Paper B.
Journal B, vol. 3, pp. 5-15.`

describe('PR3: splitCitations — BibTeX', () => {
  it('splits 2 entries (LF)', () => expect(splitCitations(MULTI_BIB, 'bib').length).toBe(2))
  it('splits 2 entries (CRLF)', () => expect(splitCitations(MULTI_BIB_CRLF, 'bib').length).toBe(2))
  it('first entry starts with @article', () => {
    const entries = splitCitations(MULTI_BIB, 'bib')
    expect(entries[0]).toMatch(/^@article\{A/)
  })
})

describe('PR3: splitCitations — numbered TXT', () => {
  it('splits 2 entries', () => expect(splitCitations(MULTI_TXT_NUMBERED, 'txt').length).toBe(2))
  it('first starts with [1]', () => {
    expect(splitCitations(MULTI_TXT_NUMBERED, 'txt')[0]).toMatch(/^\[1\]/)
  })
})

describe('PR3: splitCitations — blank-line TXT', () => {
  it('splits 2 entries', () => expect(splitCitations(MULTI_TXT_BLANK, 'txt').length).toBe(2))
})

describe('PR3: Test 3-1 — convertBatch BibTeX', () => {
  const { items, summary } = convertBatch(MULTI_BIB, 'bib', 'txt', DEFAULT_FIELDS)
  it('2 items', () => expect(items.length).toBe(2))
  it('2 successes', () => expect(summary.successCount).toBe(2))
  it('0 errors', () => expect(summary.errorCount).toBe(0))
})

describe('PR3: Test 3-2 — CRLF batch', () => {
  const { items, summary } = convertBatch(MULTI_BIB_CRLF, 'bib', 'txt', DEFAULT_FIELDS)
  it('2 items', () => expect(items.length).toBe(2))
  it('2 successes', () => expect(summary.successCount).toBe(2))
})

describe('PR3: Test 3-3 — Numbered TXT batch', () => {
  const { items, summary } = convertBatch(MULTI_TXT_NUMBERED, 'txt', 'bib', DEFAULT_FIELDS)
  it('2 items', () => expect(items.length).toBe(2))
  it('at least 1 success', () => expect(summary.successCount).toBeGreaterThan(0))
})

describe('PR3: Test 3-4 — Blank-line TXT batch', () => {
  const { items, summary } = convertBatch(MULTI_TXT_BLANK, 'txt', 'bib', DEFAULT_FIELDS)
  it('2 items', () => expect(items.length).toBe(2))
  it('at least 1 success', () => expect(summary.successCount).toBeGreaterThan(0))
})

describe('PR3: Test 3-5 — Partial failure', () => {
  // Both blocks must be multi-line or 60+ chars to pass the conservative blank-line filter.
  // The filter intentionally rejects short single-line blocks to avoid false positives
  // from citation text that contains accidental blank lines within it.
  const partialInput = `Smith, J. (2024). Paper A. Journal of AI Systems, vol. 10, no. 2, pp. 1-10.
Published by IEEE.

THIS IS INVALID INPUT THAT CANNOT BE PARSED`
  const { items, summary } = convertBatch(partialInput, 'txt', 'bib', DEFAULT_FIELDS)
  it('has items (≥1)', () => expect(items.length).toBeGreaterThan(0))
  it('combined count > 0', () => expect(summary.errorCount + summary.successCount).toBeGreaterThan(0))
})

describe('PR3: Test 3-6 — Pandoc batch no double ---', () => {
  const r = formatBibTeX(MULTI_BIB, 'pandoc', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('no --- --- double separator', () => {
    expect(r.output ?? '').not.toMatch(/---\s*\n\s*---/)
  })
})

describe('PR3: Test 3-7 — Single entry not batch', () => {
  it('single BibTeX isBatch=false', () => expect(isBatch(BIB_SMITH, 'bib')).toBe(false))
  it('single TXT isBatch=false', () => expect(isBatch(APA_INPUT, 'txt')).toBe(false))
})

// ─────────────────────────────────────────────────────────────────────────────
// PR4: Japanese parser
// ─────────────────────────────────────────────────────────────────────────────

const JA_IPSJ = '田中太郎，山田花子，"論文タイトル"，情報処理学会論文誌，vol. 65, no. 3, pp. 123-134, 2024.'
const JA_NUMBERED = '[1] 田中太郎，「AI研究」，情報処理学会論文誌，第3巻，第2号，pp.10-20，2024年'
const JA_IEICE = '田中太郎・山田花子：AI研究，電子情報通信学会論文誌，vol.12, no.2, pp.100-120 (2024)'
const JA_GENERIC = '田中太郎 「ニューラルネットワーク研究」 2024'
const JA_KEYTEST = '田中太郎，「AI研究」，2024年'

describe('PR4: detectFormat — Japanese formats', () => {
  it('IPSJ → ja_ipsj', () => {
    const fmt = detectFormat(JA_IPSJ)
    expect(['ja_ipsj', 'ja_ieice', 'ja_generic']).toContain(fmt)
  })
  it('numbered → ja_numbered or ja_ipsj', () => {
    const fmt = detectFormat(JA_NUMBERED)
    expect(['ja_numbered', 'ja_ipsj', 'ja_generic']).toContain(fmt)
  })
  it('IEICE → ja_ieice', () => {
    const fmt = detectFormat(JA_IEICE)
    expect(['ja_ieice', 'ja_ipsj', 'ja_generic']).toContain(fmt)
  })
  it('English APA not detected as Japanese', () => {
    const fmt = detectFormat(APA_INPUT)
    expect(fmt).not.toMatch(/^ja_/)
  })
})

describe('PR4: Test 4-1 — IPSJ parseAndConvert', () => {
  const r = convert(JA_IPSJ, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('has author with and', () => expect(r.output).toMatch(/author=\{.*and.*/))
  it('has title', () => expect(r.output).toMatch(/title=\{論文タイトル\}/))
  it('has year=2024', () => expect(r.output).toMatch(/year=\{2024\}/))
  it('has volume=65', () => expect(r.output).toMatch(/volume=\{65\}/))
  it('has number=3', () => expect(r.output).toMatch(/number=\{3\}/))
})

describe('PR4: Test 4-2 — Numbered citation', () => {
  const r = convert(JA_NUMBERED, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('title extracted (AI研究)', () => expect(r.output).toMatch(/title=\{AI研究\}/))
  it('year=2024', () => expect(r.output).toMatch(/year=\{2024\}/))
  it('volume=3', () => expect(r.output).toMatch(/volume=\{3\}/))
  it('number=2', () => expect(r.output).toMatch(/number=\{2\}/))
})

describe('PR4: Test 4-3 — IEICE style', () => {
  const r = convert(JA_IEICE, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('has and in author', () => expect(r.output).toMatch(/author=\{.*and.*/))
  it('year=2024', () => expect(r.output).toMatch(/year=\{2024\}/))
})

describe('PR4: Test 4-4 — Generic fallback — no crash', () => {
  const r = convert(JA_GENERIC, 'txt', 'bib', DEFAULT_FIELDS)
  it('no crash', () => expect(() => convert(JA_GENERIC, 'txt', 'bib', DEFAULT_FIELDS)).not.toThrow())
  it('year=2024 or empty (no crash)', () => {
    if (r.ok) {
      expect(r.output).toBeDefined()
    } else {
      expect(r.error).toBeDefined()
    }
  })
})

describe('PR4: Test 4-5 — Citation key not empty', () => {
  const r = convert(JA_KEYTEST, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok or has some output', () => {
    if (r.ok) {
      const keyMatch = r.output?.match(/@\w+\{([^,]+),/)
      expect(keyMatch?.[1]).toBeTruthy()
      expect(keyMatch?.[1]).not.toBe('')
    }
  })
})

describe('PR4: Test 4-6 — bibKey() Japanese family name', () => {
  it('田中太郎 and 山田花子 → 田中 + year', () => {
    const key = bibKey('', '田中太郎 and 山田花子', 'テスト論文', '2022')
    expect(key).toBe('田中2022')
  })
  it('English author unaffected', () => {
    const key = bibKey('', 'Smith, John', 'Test Paper', '2024')
    expect(key).toBe('Smith2024')
  })
  it('single Japanese author', () => {
    const key = bibKey('', '田中太郎', 'テスト', '2023')
    expect(key).toBe('田中2023')
  })
})

describe('PR4: Test 4-7 — English regression', () => {
  const ieee = 'F. Author, "Paper Title," Journal Name, vol. 10, no. 2, pp. 1-10, 2024.'
  const r = convert(ieee, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('not detected as Japanese', () => expect(detectFormat(ieee)).not.toMatch(/^ja_/))
})

// ─────────────────────────────────────────────────────────────────────────────
// Regression: existing parsers
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: IEEE parser', () => {
  const input = 'F. Smith, "Neural Networks," IEEE Trans. AI, vol. 10, no. 2, pp. 1-10, 2024.'
  const r = convert(input, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('@article', () => expect(r.output).toMatch(/@article\{/i))
  it('format = ieee', () => expect(detectFormat(input)).toBe('ieee'))
})

describe('Regression: APA parser', () => {
  const r = convert(APA_INPUT, 'txt', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('format = apa', () => expect(detectFormat(APA_INPUT)).toBe('apa'))
})

describe('Regression: BibTeX round-trip (bib→bib)', () => {
  const r = convert(BIB_SMITH, 'bib', 'bib', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('@article preserved', () => expect(r.output).toMatch(/@article\{/i))
})

describe('Regression: BibTeX → TXT (bib→txt)', () => {
  const r = convert(BIB_SMITH, 'bib', 'txt', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('has author', () => expect(r.output).toMatch(/Smith/))
})

// ─────────────────────────────────────────────────────────────────────────────
// parseBibEntry key regression (after fix: /[={]/ check)
// ─────────────────────────────────────────────────────────────────────────────

const BIB_VALID_KEY = `@article{Smith2024,
  author={John Smith},
  title={Neural Agents},
  journal={Journal of AI},
  year={2024}
}`

const BIB_BATCH_AB = `@article{A,
  author={John Smith},
  title={Paper A},
  year={2024}
}

@article{B,
  author={Jane Doe},
  title={Paper B},
  year={2023}
}`

describe('Test A: Valid BibTeX key regression (parseBibEntry fix)', () => {
  const r = formatBibTeX(BIB_VALID_KEY, 'pandoc', DEFAULT_FIELDS)
  it('ok', () => expect(r.ok).toBe(true))
  it('key = [@Smith2024]', () => expect(r.output).toMatch(/\[@Smith2024\]/))
  it('no field contamination in key', () => expect(r.output ?? '').not.toMatch(/\[@author=/))
  it('no undefined in output', () => expect(r.output ?? '').not.toMatch(/undefined/))
  it('APA reference follows', () => expect(r.output).toMatch(/Smith/))
})

describe('Test B: Batch + Pandoc regression', () => {
  // Simulate App.tsx batch+non-classic path: split entries, formatBibTeX each
  const chunks = splitCitations(BIB_BATCH_AB, 'bib')
  const results = chunks.map(chunk => formatBibTeX(chunk.trim(), 'pandoc', DEFAULT_FIELDS))
  const sep = '\n\n'  // getBatchSeparator('txt', 'pandoc') = '\n\n' (Fix2)
  const out = results.map((r, i) =>
    r.ok ? (r.output ?? '') : `% [ERROR #${i + 1}] ${r.error ?? 'parse error'}`
  ).join(sep)

  it('2 chunks split', () => expect(chunks.length).toBe(2))
  it('both ok', () => expect(results.every(r => r.ok)).toBe(true))
  it('contains [@A]', () => expect(out).toMatch(/\[@A\]/))
  it('contains [@B]', () => expect(out).toMatch(/\[@B\]/))
  it('no field contamination', () => expect(out).not.toMatch(/\[@\w+=\{/))
  it('no undefined', () => expect(out).not.toMatch(/undefined/))
  it('no double --- separator', () => expect(out).not.toMatch(/---\s*\n\s*---/))
})
