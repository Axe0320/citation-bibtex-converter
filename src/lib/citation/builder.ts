import type { FieldSelection, ValidationWarning, ParseResult } from './types'
import type { CanonicalCitation } from './canonical'
import { bibKey, fixLastLine } from './helpers'

export function validate(f: {
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

export function allowedFields(sel: FieldSelection): Set<string> {
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

export function buildBibTeX(
  entryType: string,
  venueKey: 'journal' | 'booktitle',
  canonical: CanonicalCitation,
  sel: FieldSelection,
  warnings: ValidationWarning[],
): ParseResult {
  const key   = bibKey(canonical.doi ?? '', canonical.authorRaw, canonical.title, canonical.year)
  const lines: string[] = [`@${entryType}{${key},`]
  const add = (cond: boolean, line: string) => { if (cond) lines.push(line) }

  add(sel.author,                                        `  author={${canonical.authorRaw}},`)
  add(sel.journalOrBooktitle && !!canonical.journal,     `  ${venueKey}={${canonical.journal}},`)
  add(sel.title && !!canonical.title,                    `  title={${canonical.title}},`)
  add(sel.year && !!canonical.year,                      `  year={${canonical.year}},`)
  add(sel.volume && !!canonical.volume,                  `  volume={${canonical.volume}},`)
  add(sel.number && !!canonical.number,                  `  number={${canonical.number}},`)
  add(sel.pages && !!canonical.pages,                    `  pages={${canonical.pages}},`)
  add(sel.keywords,                                      `  keywords={},`)
  add(sel.doi,                                           `  doi={${canonical.doi ?? ''}},`)
  add(sel.url,                                           `  url={},`)
  add(sel.abstract,                                      `  abstract={},`)
  add(sel.publisher,                                     `  publisher={},`)
  add(sel.editor,                                        `  editor={},`)

  fixLastLine(lines)
  lines.push('}')
  return { ok: true, output: lines.join('\n'), warnings }
}
