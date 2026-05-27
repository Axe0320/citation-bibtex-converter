// ── Types ──────────────────────────────────────────────────────────────────────

export type DataType = 'txt' | 'bib'

export interface FieldSelection {
  citationKey: boolean
  author: boolean
  title: boolean
  journalOrBooktitle: boolean
  year: boolean
  volume: boolean
  number: boolean
  pages: boolean
  publisher: boolean
  editor: boolean
  school: boolean
  institution: boolean
  doi: boolean
  url: boolean
  abstract: boolean
  keywords: boolean
}

export const DEFAULT_FIELDS: FieldSelection = {
  citationKey: false,
  author: true,
  title: true,
  journalOrBooktitle: true,
  year: true,
  volume: true,
  number: true,
  pages: true,
  publisher: false,
  editor: false,
  school: false,
  institution: false,
  doi: false,
  url: false,
  abstract: false,
  keywords: false,
}

export interface ValidationWarning {
  level: 'warn' | 'info'
  message: string
}

export interface ParseResult {
  ok: boolean
  output?: string
  error?: string
  warnings?: ValidationWarning[]
}

// ── BibTeX entry parser (brace-depth aware) ────────────────────────────────────

interface BibEntry {
  type: string
  key: string
  fields: Map<string, string> // insertion-order preserved
}

function parseBibEntry(raw: string): BibEntry | null {
  const s = raw.trim()
  const hm = s.match(/^@(\w+)\s*\{\s*([^,\s}]*)/i)
  if (!hm) return null

  const type = hm[1].toUpperCase()
  const key = hm[2].trim()
  const fields = new Map<string, string>()
  let pos = hm[0].length

  while (pos < s.length) {
    while (pos < s.length && /[\s,]/.test(s[pos])) pos++
    if (pos >= s.length || s[pos] === '}') break

    const ns = pos
    while (pos < s.length && /\w/.test(s[pos])) pos++
    const name = s.slice(ns, pos).toLowerCase()
    if (!name) { pos++; continue }

    while (pos < s.length && /[\s=]/.test(s[pos])) pos++
    if (pos >= s.length) break

    let value = ''
    if (s[pos] === '{') {
      pos++
      let depth = 1
      const vs = pos
      while (pos < s.length) {
        if (s[pos] === '{') depth++
        else if (s[pos] === '}') { depth--; if (depth === 0) break }
        pos++
      }
      value = s.slice(vs, pos)
      pos++
    } else if (s[pos] === '"') {
      pos++
      const vs = pos
      while (pos < s.length && s[pos] !== '"') pos++
      value = s.slice(vs, pos)
      pos++
    } else {
      const vs = pos
      while (pos < s.length && !/[\s,}]/.test(s[pos])) pos++
      value = s.slice(vs, pos)
    }

    if (name) fields.set(name, value.trim())
  }

  return { type, key, fields }
}

// ── TXT citation helpers ────────────────────────────────────────────────────────

function extractTitle(text: string): string {
  const quoted = text.match(/^[""](.+?)[""][,.]?\s/)
  if (quoted) return quoted[1].replace(/,$/, '').trim()
  const m = text.match(/^(.+?)\s+[Ii]n\s+/)
  if (m) return m[1].replace(/[,.]$/, '').trim()
  return ''
}

function extractJournal(text: string): string {
  const m = text.match(/\bin\s+(.+?),\s*vol\./i)
  if (m) return m[1].trim()
  const m2 = text.match(/\bin\s+([^,]+(?:,[^,]+)*?),\s*(?:vol|no|pp|20\d{2}|19\d{2})/i)
  if (m2) return m2[1].trim()
  return ''
}

function extractDOI(text: string): string {
  const m = text.match(/\bdoi:\s*([^\s,;]+)/i)
  if (m) return m[1].replace(/\.$/, '').trim()
  const m2 = text.match(/\b(10\.\d{4,}\/[^\s,;]+)/)
  if (m2) return m2[1].replace(/\.$/, '').trim()
  return ''
}

function extractAuthor(text: string): string {
  const m = text.match(/^([^,"]+?),\s*[""]/)
  if (m) return m[1].trim()
  return ''
}

function bibKey(doi: string, title: string, year: string): string {
  if (doi) {
    const last = doi.split('/').pop() ?? ''
    return last.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'cite'
  }
  const t = (title.split(/\s+/)[0] ?? 'cite').replace(/[^a-zA-Z]/g, '')
  return `${t}${year || 'XXXX'}`
}

// ── Validation ──────────────────────────────────────────────────────────────────

function validate(f: {
  author?: string; title?: string; year?: string; pages?: string; doi?: string
}): ValidationWarning[] {
  const w: ValidationWarning[] = []
  if (!f.author?.trim()) w.push({ level: 'warn', message: '著者情報が入力されていません' })
  if (!f.title?.trim())  w.push({ level: 'warn', message: 'タイトルが入力されていません' })
  if (!f.year?.trim())   w.push({ level: 'warn', message: '発行年が入力されていません' })
  const p = f.pages?.trim() ?? ''
  if (!p || /^0[-–]0$/.test(p) || /^\d+$/.test(p)) {
    w.push({ level: 'warn', message: 'ページ情報が不完全な可能性があります' })
  }
  if (!f.doi?.trim()) w.push({ level: 'info', message: 'DOI が見つかりません\n※ DOI は必須ではありません' })
  return w
}

// ── Allowed BibTeX field names from selection ───────────────────────────────────

function allowedFields(sel: FieldSelection): Set<string> {
  const s = new Set<string>()
  if (sel.author)             s.add('author')
  if (sel.title)              s.add('title')
  if (sel.journalOrBooktitle) { s.add('journal'); s.add('booktitle') }
  if (sel.year)               s.add('year')
  if (sel.volume)             s.add('volume')
  if (sel.number)             s.add('number')
  if (sel.pages)              s.add('pages')
  if (sel.publisher)          s.add('publisher')
  if (sel.editor)             s.add('editor')
  if (sel.school)             s.add('school')
  if (sel.institution)        s.add('institution')
  if (sel.doi)                s.add('doi')
  if (sel.url)                s.add('url')
  if (sel.abstract)           s.add('abstract')
  if (sel.keywords)           s.add('keywords')
  return s
}

// Helper: strip trailing comma from last BibTeX field line
function fixLastLine(lines: string[]): void {
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '')
  }
}

// ── TXT → BibTeX ────────────────────────────────────────────────────────────────

function txtToBib(raw: string, sel: FieldSelection): ParseResult {
  const author  = extractAuthor(raw)
  const title   = extractTitle(raw)
  const journal = extractJournal(raw)
  const year    = (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''
  const volume  = (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? ''
  const number  = (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? ''
  const pages   = (raw.match(/\bpp\.?\s*([\d\-–]+)/i) ?? [])[1] ?? ''
  const doi     = extractDOI(raw)

  if (!title && !journal && !year && !doi) {
    return { ok: false, error: '引用情報を抽出できませんでした。フォーマットを確認してください。' }
  }

  const warnings = validate({ author, title, year, pages, doi })
  const key = bibKey(doi, title, year)
  const lines: string[] = [`@ARTICLE{${key},`]

  const add = (cond: boolean, line: string) => { if (cond) lines.push(line) }
  add(sel.author,                         `  author={${author}},`)
  add(sel.journalOrBooktitle && !!journal, `  journal={${journal}},`)
  add(sel.title && !!title,               `  title={${title}},`)
  add(sel.year && !!year,                 `  year={${year}},`)
  add(sel.volume && !!volume,             `  volume={${volume}},`)
  add(sel.number && !!number,             `  number={${number}},`)
  add(sel.pages && !!pages,               `  pages={${pages}},`)
  add(sel.keywords,                       `  keywords={},`)
  add(sel.doi,                            `  doi={${doi}},`)
  add(sel.url,                            `  url={},`)
  add(sel.abstract,                       `  abstract={},`)
  add(sel.publisher,                      `  publisher={},`)
  add(sel.editor,                         `  editor={},`)

  fixLastLine(lines)
  lines.push('}')
  return { ok: true, output: lines.join('\n'), warnings }
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

  if (sel.author && author)             parts.push(`${author},`)
  if (sel.title && title)               parts.push(`"${title},"`)
  if (sel.journalOrBooktitle && journal) parts.push(`${journal},`)
  if (sel.volume && volume)             parts.push(`vol. ${volume},`)
  if (sel.number && number)             parts.push(`no. ${number},`)
  if (sel.pages && pages)               parts.push(`pp. ${pages},`)
  if (sel.year && year)                 parts.push(`${year},`)
  if (sel.doi && doi)                   parts.push(`doi: ${doi}`)

  // Graceful fallback: if nothing could be extracted into parts, return original
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

export function convert(
  raw: string,
  inputType: DataType,
  outputType: DataType,
  sel: FieldSelection,
): ParseResult {
  const text = raw.trim()
  if (!text) {
    const what = inputType === 'bib' ? 'BibTeX' : '引用テキスト'
    return { ok: false, error: `入力が空です。${what}を貼り付けてください。` }
  }
  if (inputType === 'txt' && outputType === 'bib') return txtToBib(text, sel)
  if (inputType === 'bib' && outputType === 'txt') return bibToTxt(text, sel)
  if (inputType === 'bib' && outputType === 'bib') return bibToBib(text, sel)
  return txtToTxt(text, sel)
}
