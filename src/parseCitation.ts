import { parseBibEntry } from './lib/bibtex/parser'

// ── Public API re-exports (App.tsx imports from here — do not change paths) ────

export type { DataType, FieldSelection, ValidationWarning, ParseResult } from './lib/citation/types'
export { DEFAULT_FIELDS } from './lib/citation/types'
export { extractDOI } from './lib/citation/helpers'

// ── Internal imports ────────────────────────────────────────────────────────────

import type { DataType, FieldSelection, ParseResult, BibEntryType } from './lib/citation/types'
import { extractTitle, extractJournal, extractAuthor, extractDOI, fixLastLine } from './lib/citation/helpers'
import { detectFormat, parseByFormat } from './lib/citation/detect'
import { toCanonical } from './lib/citation/canonical'
import { validate, allowedFields, buildBibTeX, venueKeyForType } from './lib/citation/builder'
import { splitCitations, isBatch } from './lib/citation/splitCitations'

export type { BibEntryType }
export { isBatch }

interface ConvertOpts {
  entryType?: BibEntryType
}

export interface BatchItemResult extends ParseResult {
  index: number
  inputSnippet: string
}

export interface BatchSummary {
  successCount: number
  errorCount: number
}

// ── TXT → BibTeX ────────────────────────────────────────────────────────────────

function txtToBib(raw: string, sel: FieldSelection, opts?: ConvertOpts): ParseResult {
  const fmt       = detectFormat(raw)
  const f         = parseByFormat(raw, fmt)
  const canonical = toCanonical(f)

  if (!f.title && !f.journal && !f.year && !f.doi) {
    return { ok: false, error: '引用情報を抽出できませんでした。フォーマットを確認してください。' }
  }

  const warnings = validate({ author: f.author, title: f.title, year: f.year, pages: f.pages, doi: f.doi })

  const detectedIsConf                       = (fmt === 'acm_acl' && /\bIn\s/.test(raw)) ||
                                               (fmt === 'lncs' && /\bIn:\s/.test(raw))
  const autoVenueKey: 'journal' | 'booktitle' = detectedIsConf ? 'booktitle' : 'journal'
  const entryType = opts?.entryType ?? (detectedIsConf ? 'INPROCEEDINGS' : 'ARTICLE')
  // Manual override: use venueKeyForType() which may return null (suppresses venue field).
  // Auto-detect: always output journal or booktitle.
  const venueKey = opts?.entryType ? venueKeyForType(entryType) : autoVenueKey

  return buildBibTeX(entryType, venueKey, canonical, sel, warnings)
}

// ── BibTeX → TXT ────────────────────────────────────────────────────────────────

function bibToTxt(raw: string, sel: FieldSelection): ParseResult {
  const entry = parseBibEntry(raw)
  if (!entry) return { ok: false, error: 'BibTeX形式ではありません。@article{...} の形式で入力してください。' }

  const f = Object.fromEntries(entry.fields)
  const author    = f.author ?? ''
  const title     = f.title ?? ''
  const venue     = f.journal ?? f.booktitle ?? ''
  const year      = f.year ?? ''
  const volume    = f.volume ?? ''
  const number    = f.number ?? ''
  const pages     = f.pages ?? ''
  const doi       = f.doi ?? ''
  const publisher = f.publisher ?? ''
  const url       = f.url ?? ''

  if (!author && !title && !venue && !year) {
    return { ok: false, error: 'BibTeXから情報を抽出できませんでした。' }
  }

  const warnings = validate({ author, title, year, pages, doi })
  const parts: string[] = []

  if (sel.author && author)            parts.push(`${author},`)
  if (sel.title && title)              parts.push(`"${title},"`)
  if (sel.journalOrBooktitle && venue) parts.push(`${venue},`)
  if (sel.volume && volume)            parts.push(`vol. ${volume},`)
  if (sel.number && number)            parts.push(`no. ${number},`)
  if (sel.pages && pages)              parts.push(`pp. ${pages.replace(/-+/g, '–')},`)
  if (sel.year && year)                parts.push(`${year},`)
  if (sel.publisher && publisher)      parts.push(`${publisher},`)
  if (sel.doi && doi)                  parts.push(`doi: ${doi}`)
  if (sel.url && url)                  parts.push(`[Online]. Available: ${url}`)

  if (parts.length === 0) return { ok: false, error: '選択フィールドが空です。Display Fields で項目を有効にしてください。' }

  let out = parts.join(' ').replace(/,\s*$/, '') + '.'
  out = out.replace(/,\s*,/g, ',')
  return { ok: true, output: out, warnings }
}

// ── BibTeX → BibTeX ─────────────────────────────────────────────────────────────

function bibToBib(raw: string, sel: FieldSelection): ParseResult {
  const entry = parseBibEntry(raw)
  if (!entry) return { ok: false, error: 'BibTeX形式ではありません。' }

  const f = Object.fromEntries(entry.fields)
  const warnings = validate({ author: f.author, title: f.title, year: f.year, pages: f.pages, doi: f.doi })

  const allowed = allowedFields(sel)
  const keyStr = entry.key || 'cite'
  const lines: string[] = [`@${entry.type}{${keyStr},`]

  for (const [name, value] of entry.fields) {
    if (allowed.has(name)) lines.push(`  ${name}={${value}},`)
  }

  if (lines.length === 1) lines.push('  % no fields selected')
  fixLastLine(lines)
  lines.push('}')
  return { ok: true, output: lines.join('\n'), warnings }
}

// ── TXT → TXT ───────────────────────────────────────────────────────────────────

function txtToTxt(raw: string, sel: FieldSelection): ParseResult {
  const author  = extractAuthor(raw)
  const title   = extractTitle(raw)
  const journal = extractJournal(raw)
  const year    = (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''
  const volume  = (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? ''
  const number  = (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? ''
  const pages   = (raw.match(/\bpp\.?\s*([\d\-–]+)/i) ?? [])[1] ?? ''
  const doi     = extractDOI(raw)

  if (!author && !title && !journal && !year && !doi) {
    return { ok: false, error: '引用情報を抽出できませんでした。' }
  }

  const warnings = validate({ author, title, year, pages, doi })
  const parts: string[] = []

  if (sel.author && author)              parts.push(`${author},`)
  if (sel.title && title)                parts.push(`"${title},"`)
  if (sel.journalOrBooktitle && journal) parts.push(`${journal},`)
  if (sel.volume && volume)              parts.push(`vol. ${volume},`)
  if (sel.number && number)              parts.push(`no. ${number},`)
  if (sel.pages && pages)                parts.push(`pp. ${pages},`)
  if (sel.year && year)                  parts.push(`${year},`)
  if (sel.doi && doi)                    parts.push(`doi: ${doi}`)

  if (parts.length === 0) return { ok: true, output: raw.trim(), warnings }

  let out = parts.join(' ').replace(/,\s*$/, '') + '.'
  out = out.replace(/,\s*,/g, ',')
  return { ok: true, output: out, warnings }
}

// ── Public API ──────────────────────────────────────────────────────────────────

export function detectInputMode(text: string): DataType {
  return /^\s*@(article|inproceedings|book|misc|incollection|phdthesis|mastersthesis|techreport|conference|proceedings)\s*\{/i.test(text)
    ? 'bib'
    : 'txt'
}

export function convertBatch(
  raw: string,
  inputType: DataType,
  outputType: DataType,
  sel: FieldSelection,
  opts?: ConvertOpts,
): { items: BatchItemResult[]; summary: BatchSummary } {
  const chunks = splitCitations(raw, inputType)
  const items: BatchItemResult[] = chunks.map((chunk, i) => ({
    ...convert(chunk, inputType, outputType, sel, opts),
    index: i,
    inputSnippet: chunk.slice(0, 60).replace(/\n/g, ' '),
  }))
  return {
    items,
    summary: {
      successCount: items.filter(r => r.ok).length,
      errorCount:   items.filter(r => !r.ok).length,
    },
  }
}

export function convert(
  raw: string,
  inputType: DataType,
  outputType: DataType,
  sel: FieldSelection,
  opts?: ConvertOpts,
): ParseResult {
  const text = raw.trim()
  if (!text) {
    const what = inputType === 'bib' ? 'BibTeX' : '引用テキスト'
    return { ok: false, error: `入力が空です。${what}を貼り付けてください。` }
  }
  if (inputType === 'txt' && outputType === 'bib') return txtToBib(text, sel, opts)
  if (inputType === 'bib' && outputType === 'txt') return bibToTxt(text, sel)
  if (inputType === 'bib' && outputType === 'bib') return bibToBib(text, sel)
  return txtToTxt(text, sel)
}
