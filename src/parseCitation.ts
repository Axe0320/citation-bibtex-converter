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

// ── Shared TXT helpers (also used by txtToTxt fallback) ───────────────────────

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

export function extractDOI(text: string): string {
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

function fixLastLine(lines: string[]): void {
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '')
  }
}

// ── Format detection ───────────────────────────────────────────────────────────

type CiteFormat =
  | 'ieee'
  | 'mdpi'
  | 'apa'
  | 'harvard'
  | 'vancouver_ama'
  | 'author_lib'
  | 'springer_nature'
  | 'springer_apa'
  | 'acm_acl'
  | 'elsevier'
  | 'unknown'

function detectFormat(text: string): CiteFormat {
  // IEEE: "F. Lastname, ..., "Title," in Journal, vol. X, no. Y, pp. Z"
  if (/^[A-Z]\. \w/.test(text) && /"/.test(text)) return 'ieee'
  // MDPI/ACS: "Lastname, F.; Lastname2, F.; ..."
  if (/^[\w-]+, [A-Z]\.;/.test(text)) return 'mdpi'
  // APA: "(Year). Title" — year in parens followed by period + title capital
  if (/\((?:19|20)\d{2}\)\. [A-Z]/.test(text)) return 'apa'
  // Author Library: " ; " author separator AND " / " author–title boundary
  if (/ ; .+ \/ /.test(text)) return 'author_lib'
  // Harvard: standalone year before single-quoted title — "I 2020, 'Title'"
  if (/(19|20)\d{2}, '/.test(text)) return 'harvard'
  // Vancouver / AMA: "Vol(Issue):Pages" pattern
  if (/\d+\(\d+\):\d+/.test(text)) return 'vancouver_ama'
  // ACM/ACL/Chicago: "Lastname. Year. Title[. In Proceedings]..."
  if (/\. (?:19|20)\d{2}\. .+\./.test(text)) return 'acm_acl'
  // Springer Nature: "... et al. Title. Journal Vol, Article (Year)."
  if (/\bet al\./.test(text) && /\((?:19|20)\d{2}\)/.test(text)) return 'springer_nature'
  // Springer APA: "... & Lastname, F. Title. Journal Vol, Pages (Year)."
  if (/ & [A-Z][a-z]+, [A-Z]/.test(text) && /\((?:19|20)\d{2}\)/.test(text)) return 'springer_apa'
  // Elsevier: "..., Volume NNN, Year, ArticleNo, ISSN..."
  if (/\bVolume \d+/.test(text) || /\bISSN\b/.test(text)) return 'elsevier'
  return 'unknown'
}

// ── Internal parsed-fields container ──────────────────────────────────────────

interface ParsedFields {
  author:  string
  title:   string
  journal: string
  year:    string
  volume:  string
  number:  string
  pages:   string
  doi:     string
}

// ── Format-specific parsers ────────────────────────────────────────────────────

function parseIEEE(raw: string): ParsedFields {
  // Author: "F. Lastname, F. Lastname, ..., and F. Lastname," before quoted title
  const authorM =
    raw.match(/^((?:[A-Z]\. [\w'-]+(?:,\s+)?)+\s*and [A-Z]\. [\w'-]+),\s*"/) ??
    raw.match(/^((?:[A-Z]\. [\w'-]+,?\s*)+),\s*"/)
  const author = authorM ? authorM[1].trim() : ''

  // Title: text inside the first pair of ASCII double quotes
  const titleM  = raw.match(/"([^"]+)"/)
  // IEEE source has "Title," — strip trailing comma inside quotes
  const title   = titleM ? titleM[1].trim().replace(/,\s*$/, '') : ''

  // Journal article: "in Journal, vol." | Conference: "Title," YEAR Name (ABBREV), City
  const journalM = raw.match(/\bin\s+(.+?),\s*vol\./i)
               ?? raw.match(/"[^"]+,?"\s+(\d{4}\s+.+?\([A-Z\w]+\)),\s*[A-Z]/)

  return {
    author,
    title,
    journal: journalM ? journalM[1].trim() : '',
    year:    (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:  (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:   (raw.match(/\bpp\.?\s*([\d\-–]+)/i) ?? [])[1] ?? '',
    doi:     extractDOI(raw),
  }
}

function parseMDPI(raw: string): ParsedFields {
  // Authors: "Lastname, F.; Lastname2, F.; LastnameN, F." (semicolon-separated)
  const authorM = raw.match(/^([\w-]+, [A-Z]\.(?:\w\.)?(?:; [\w-]+, [A-Z]\.(?:\w\.)?)*)\s+[A-Z]/)
  const authorRaw = authorM ? authorM[1] : ''
  const author    = authorRaw.replace(/;\s*/g, ' and ')

  // After author block: "Title. Journal Year, Vol, PageOrArticle."
  const afterAuth = authorRaw ? raw.slice(authorRaw.length).trim() : raw
  const m = afterAuth.match(/^(.+?)\.\s+(.+?)\s+((?:19|20)\d{2}),\s*(\d+),\s*(\d+)/)

  return {
    author,
    title:   m ? m[1].trim() : '',
    journal: m ? m[2].trim() : '',
    year:    m ? m[3] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  m ? m[4] : '',
    number:  '',
    pages:   m ? m[5] : '',
    doi:     extractDOI(raw),
  }
}

function parseSpringerNature(raw: string): ParsedFields {
  // Authors: everything up to and including "et al."
  const authorM = raw.match(/^(.+?\bet al\.)\s+/)
  const author  = authorM ? authorM[1].trim() : ''
  const rest    = author ? raw.slice(authorM![0].length) : raw

  // "Title. Journal Vol, PagesOrArticle (Year)."
  const m = rest.match(/^(.+?)\.\s+(.+?)\s+(\d+),\s*([\d–\-]+)\s*\(((?:19|20)\d{2})\)/)

  return {
    author,
    title:   m ? m[1].trim() : '',
    journal: m ? m[2].trim() : '',
    year:    m ? m[5] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  m ? m[3] : '',
    number:  '',
    pages:   m ? m[4] : '',
    doi:     extractDOI(raw),
  }
}

function parseSpringerAPA(raw: string): ParsedFields {
  // Authors: "Lastname, F., Lastname2, F. & LastnameN, F."
  // Block ends at "& Lastname, F." followed by space + uppercase title start
  const authorM = raw.match(/^(.+?& [\w-]+, [A-Z]\.(?:[A-Z]\.)?)\s+[A-Z]/)
  const author  = authorM ? authorM[1].trim() : ''
  const rest    = author ? raw.slice(author.length).trim() : raw

  // "Title. Journal Vol, Pages (Year)."
  const m = rest.match(/^(.+?)\.\s+(.+?)\s+(\d+),\s*([\d–\-]+)\s*\(((?:19|20)\d{2})\)/)

  return {
    author,
    title:   m ? m[1].trim() : '',
    journal: m ? m[2].trim() : '',
    year:    m ? m[5] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  m ? m[3] : '',
    number:  '',
    pages:   m ? m[4] : '',
    doi:     extractDOI(raw),
  }
}

function parseAPA(raw: string): ParsedFields {
  // "Lastname, F., ..., & LastnameN, F. (Year). Title. Journal, Vol(Issue), PageOrArticle."
  const yM     = raw.match(/\(((?:19|20)\d{2})\)\./)
  const year   = yM ? yM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''
  const author = yM ? raw.slice(0, yM.index!).trim().replace(/[.,]\s*$/, '') : ''
  const after  = yM ? raw.slice(yM.index! + yM[0].length).trim() : raw

  // Title: first sentence (up to ". JournalStart")
  const tM    = after.match(/^(.+?)\.\s+([A-Z])/)
  const title = tM ? tM[1].trim() : ''
  const rest  = tM ? after.slice(tM[0].length - tM[2].length) : after

  // Journal: text up to the first comma
  const jM      = rest.match(/^([^,]+)/)
  const journal = jM ? jM[1].trim() : ''

  // Volume and number from "57(4)" or fallback to first number after comma
  const volNumM = rest.match(/,\s*(\d+)\((\d+)\)/)
  const volM    = volNumM ? null : rest.match(/,\s*(\d+),/)
  const volume  = volNumM ? volNumM[1] : (volM ? volM[1] : '')
  const number  = volNumM ? volNumM[2] : ''

  // Pages / article number: last number before end of string
  const pM    = rest.match(/,\s*([\d]+)\.?\s*$/)
  const pages = pM ? pM[1] : ''

  return { author, title, journal, year, volume, number, pages, doi: extractDOI(raw) }
}

function parseHarvard(raw: string): ParsedFields {
  // "Lastname, F, ..., & LastnameN, F Year, 'Title', Journal, vol. V, no. N, Article."
  const yM      = raw.match(/\b((19|20)\d{2}),\s*'/)
  const year    = yM ? yM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''
  const author  = yM ? raw.slice(0, yM.index!).trim().replace(/[,\s]+$/, '') : ''

  const tM      = raw.match(/'([^']+)'/)
  const title   = tM ? tM[1].trim() : ''

  const after   = tM ? raw.slice(raw.indexOf(tM[0]) + tM[0].length) : ''
  const jM      = after.match(/^,\s*([^,]+)/)

  return {
    author,
    title,
    journal:  jM ? jM[1].trim() : '',
    year,
    volume:   (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:   (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:    '',
    doi:      extractDOI(raw),
  }
}

function parseVancouverAMA(raw: string): ParsedFields {
  // Vancouver: "Lastname F, Lastname2 D. Title. Journal. Year Mon;Vol(Issue):Pages."
  // AMA:       "Lastname F, Lastname2 F. Title. Journal. Year; Vol(Issue):Pages."
  // Both split cleanly by ". " into [authors, title, journal, year/vol info]
  const parts   = raw.split(/\.\s+/)
  const author  = parts[0]?.trim() ?? ''
  const title   = parts[1]?.trim() ?? ''
  const journal = parts[2]?.trim() ?? ''

  const yearM   = (parts[3] ?? '').match(/^((19|20)\d{2})/)
  const year    = yearM ? yearM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''

  const vipM    = raw.match(/(\d+)\((\d+)\):(\d+)/)

  return {
    author,
    title,
    journal,
    year,
    volume:   vipM ? vipM[1] : '',
    number:   vipM ? vipM[2] : '',
    pages:    vipM ? vipM[3] : '',
    doi:      extractDOI(raw),
  }
}

function parseAuthorLib(raw: string): ParsedFields {
  // "Lastname, Firstname ; Lastname2, Firstname2 ; ... et al. / Title : Subtitle. In: Journal. Year ; Vol. V, No. N."
  const slashIdx = raw.indexOf(' / ')
  const author   = slashIdx >= 0
    ? raw.slice(0, slashIdx).replace(/\s*;\s*/g, ' and ').trim()
    : ''

  const rest    = slashIdx >= 0 ? raw.slice(slashIdx + 3) : raw
  const tM      = rest.match(/^(.+?)\.\s+In:/)
  const title   = tM ? tM[1].replace(/ : /g, ': ').trim() : ''
  const jM      = rest.match(/\bIn:\s+(.+?)\./)

  return {
    author,
    title,
    journal:  jM ? jM[1].trim() : '',
    year:     (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:   (raw.match(/\bVol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:   (raw.match(/\bNo\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:    '',
    doi:      extractDOI(raw),
  }
}

function parseACMACL(raw: string): ParsedFields {
  // Handles: ACM/ACL conference, ACM journal, Chicago (quoted title)
  // Common anchor: "Lastname. Year. ..."
  const authorM = raw.match(/^(.+?)\.\s+((?:19|20)\d{2})\./)
  const author  = authorM ? authorM[1].trim() : ''
  const year    = authorM ? authorM[2] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''

  const afterYear = authorM ? raw.slice(authorM.index! + authorM[0].length) : raw
  const isConf    = /\bIn\s/.test(afterYear)

  let title = '', journal = ''

  if (isConf) {
    const tM = raw.match(/\.\s+(?:19|20)\d{2}\.\s+(.+?)\.\s+In\s/)
    title = tM ? tM[1].trim() : ''
    // Stop at "(CONF YEAR)" or ", pages"
    const btM = raw.match(/\bIn\s+(.+?)(?:\s*\([A-Z][\w -]*20\d{2}\)|,\s*pages?)/)
    journal = btM ? btM[1].trim() : ''
  } else {
    // Chicago: title is in double quotes
    const quotedTM = raw.match(/\.\s+(?:19|20)\d{2}\.\s+"([^"]+)"/)
    if (quotedTM) {
      title = quotedTM[1].trim()
      // Journal: first capitalised word-sequence before the volume number
      const jM = raw.match(/"[^"]+"\s+([A-Z][^,\d]+?)\s+\d+/)
      journal = jM ? jM[1].trim() : ''
    } else {
      // ACM journal: "Title. Journal Vol, ..."
      const tM = raw.match(/\.\s+(?:19|20)\d{2}\.\s+(.+?)\.\s+[A-Z]/)
      title = tM ? tM[1].trim() : ''
      const jM = raw.match(/(?:19|20)\d{2}\.\s+.+?\.\s+(.+?)\s+\d+,/)
      journal = jM ? jM[1].trim() : ''
    }
  }

  const pagesM =
    raw.match(/\bpages?\s+([\d–\-]+)/) ??
    raw.match(/,\s*([\d]+[–\-][\d]+)\.?\s*(?:https?|$)/) ??
    raw.match(/USA,\s*([\d]+[–\-][\d]+)/) ??
    raw.match(/([\d]+[–\-][\d]+)/)
  const pages = pagesM ? pagesM[1] : ''

  return { author, title, journal, year, volume: '', number: '', pages, doi: extractDOI(raw) }
}

function parseElsevier(raw: string): ParsedFields {
  // "Firstname Lastname, Firstname Lastname, ..., Title, Journal, Volume N, Year, Article, ISSN..."
  // Author segments match "Firstname Lastname" (two capitalised words)
  const segments  = raw.split(/,\s*/)
  const nameRe    = /^[A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+$/
  let lastAuthorIdx = -1
  for (let i = 0; i < segments.length; i++) {
    if (nameRe.test(segments[i].trim())) lastAuthorIdx = i
    else if (lastAuthorIdx >= 0) break
  }

  const author  = segments.slice(0, lastAuthorIdx + 1).join(', ')
  const rest    = segments.slice(lastAuthorIdx + 1)
  const title   = rest[0]?.trim() ?? ''
  // Journal: segment after title, stripping any "Volume …" tail
  const journal = (rest[1] ?? '').replace(/\s*Volume.*/i, '').trim()

  const volM    = raw.match(/\bVolume\s+(\d+)/i)
  const yearM   = raw.match(/\bVolume\s+\d+,\s*((?:19|20)\d{2})/i)
  const artM    = raw.match(/\bVolume\s+\d+,\s*(?:19|20)\d{2},\s*(\d+)/)

  return {
    author,
    title,
    journal,
    year:   yearM ? yearM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume: volM  ? volM[1]  : '',
    number: '',
    pages:  artM  ? artM[1]  : '',
    doi:    extractDOI(raw),
  }
}

function parseUnknown(raw: string): ParsedFields {
  return {
    author:  extractAuthor(raw),
    title:   extractTitle(raw),
    journal: extractJournal(raw),
    year:    (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:  (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:   (raw.match(/\bpp\.?\s*([\d\-–]+)/i) ?? [])[1] ?? '',
    doi:     extractDOI(raw),
  }
}

function parseByFormat(raw: string, fmt: CiteFormat): ParsedFields {
  switch (fmt) {
    case 'ieee':            return parseIEEE(raw)
    case 'mdpi':            return parseMDPI(raw)
    case 'apa':             return parseAPA(raw)
    case 'harvard':         return parseHarvard(raw)
    case 'vancouver_ama':   return parseVancouverAMA(raw)
    case 'author_lib':      return parseAuthorLib(raw)
    case 'springer_nature': return parseSpringerNature(raw)
    case 'springer_apa':    return parseSpringerAPA(raw)
    case 'acm_acl':         return parseACMACL(raw)
    case 'elsevier':        return parseElsevier(raw)
    default:                return parseUnknown(raw)
  }
}

// ── BibTeX builder (shared by txtToBib) ───────────────────────────────────────

function buildBibTeX(
  entryType: string,
  venueKey: 'journal' | 'booktitle',
  f: ParsedFields,
  sel: FieldSelection,
  warnings: ValidationWarning[],
): ParseResult {
  const key   = bibKey(f.doi, f.title, f.year)
  const lines: string[] = [`@${entryType}{${key},`]
  const add = (cond: boolean, line: string) => { if (cond) lines.push(line) }

  add(sel.author,                                `  author={${f.author}},`)
  add(sel.journalOrBooktitle && !!f.journal,     `  ${venueKey}={${f.journal}},`)
  add(sel.title && !!f.title,                    `  title={${f.title}},`)
  add(sel.year && !!f.year,                      `  year={${f.year}},`)
  add(sel.volume && !!f.volume,                  `  volume={${f.volume}},`)
  add(sel.number && !!f.number,                  `  number={${f.number}},`)
  add(sel.pages && !!f.pages,                    `  pages={${f.pages}},`)
  add(sel.keywords,                              `  keywords={},`)
  add(sel.doi,                                   `  doi={${f.doi}},`)
  add(sel.url,                                   `  url={},`)
  add(sel.abstract,                              `  abstract={},`)
  add(sel.publisher,                             `  publisher={},`)
  add(sel.editor,                                `  editor={},`)

  fixLastLine(lines)
  lines.push('}')
  return { ok: true, output: lines.join('\n'), warnings }
}

// ── TXT → BibTeX ────────────────────────────────────────────────────────────────

function txtToBib(raw: string, sel: FieldSelection): ParseResult {
  const fmt      = detectFormat(raw)
  const f        = parseByFormat(raw, fmt)

  if (!f.title && !f.journal && !f.year && !f.doi) {
    return { ok: false, error: '引用情報を抽出できませんでした。フォーマットを確認してください。' }
  }

  const warnings  = validate({ author: f.author, title: f.title, year: f.year, pages: f.pages, doi: f.doi })
  // Conference papers → @INPROCEEDINGS with booktitle
  // Conference if acm_acl AND text contains "In Proceedings" / "In " keyword
  const isConf    = fmt === 'acm_acl' && /\bIn\s/.test(raw)
  const entryType = isConf ? 'INPROCEEDINGS' : 'ARTICLE'
  const venueKey  = isConf ? 'booktitle'     : 'journal'

  return buildBibTeX(entryType, venueKey, f, sel, warnings)
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
