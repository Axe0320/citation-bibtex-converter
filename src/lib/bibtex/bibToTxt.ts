import type { FieldSelection, ParseResult, ValidationWarning } from '../../parseCitation'
import { parseBibEntry } from './parser'
import { normalizeBibEntry } from './normalize'
import { selectFormatter } from './formatters'
import type { CitationStyle, NormalizedEntry } from './types'

// ── Validation (mirrors parseCitation.ts validate, adapted for NormalizedEntry) ─

function validateNormalized(e: NormalizedEntry): ValidationWarning[] {
  const w: ValidationWarning[] = []
  const hasAuthor = e.authors.length > 0 && (e.authors[0].family || e.authors[0].isOrg)
  if (!hasAuthor)  w.push({ level: 'warn', message: '著者情報が入力されていません' })
  if (!e.title)    w.push({ level: 'warn', message: 'タイトルが入力されていません' })
  if (!e.year)     w.push({ level: 'warn', message: '発行年が入力されていません' })
  if (!e.pages)    w.push({ level: 'warn', message: 'ページ情報が不完全な可能性があります' })
  if (!e.doi)      w.push({ level: 'info', message: 'DOI が見つかりません\n※ DOI は必須ではありません' })
  return w
}

// ── Public API ─────────────────────────────────────────────────────────────────
// Called by App.tsx for Citation Style mode (style !== 'classic').
// Classic mode stays in parseCitation.ts → convert('bib', 'txt').

export function formatBibTeX(
  raw:   string,
  style: CitationStyle,
  sel:   FieldSelection,
): ParseResult {
  const entry = parseBibEntry(raw.trim())
  if (!entry) {
    return { ok: false, error: 'BibTeX形式ではありません。@article{...} の形式で入力してください。' }
  }

  const normalized = normalizeBibEntry(entry)
  const warnings   = validateNormalized(normalized)

  const formatter = selectFormatter(style)
  const output    = formatter(normalized, sel)

  if (!output) {
    return { ok: false, error: '選択フィールドが空です。Display Fields で項目を有効にしてください。' }
  }

  return { ok: true, output, warnings }
}
