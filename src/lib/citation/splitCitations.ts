import type { DataType } from './types'

export function splitCitations(raw: string, type: DataType): string[] {
  if (type === 'bib') {
    // Match-based split: each entry captured up to the next @ or end of string.
    // \r?\n handles both LF and CRLF line endings.
    const entries = raw.match(/@[\w-]+\s*\{[\s\S]*?(?=\r?\n\s*@[\w-]+\s*\{|\s*$)/g)
    return (entries ?? raw.split(/(?:^|\r?\n)(?=\s*@\w+\s*\{)/i))
      .map(s => s.trim()).filter(Boolean)
  }

  // TXT: numbered list takes priority (e.g. [1], 1., (1))
  const numMatches = [...raw.matchAll(/(?:^|\n)\s*(?:\[?\d+\]\.?|\(\d+\))\s+/g)]
  if (numMatches.length > 1) {
    return raw.split(/(?=(?:^|\n)\s*(?:\[?\d+\]\.?|\(\d+\))\s+)/)
      .map(s => s.trim()).filter(Boolean)
  }

  // Fallback: blank-line split — only keep blocks that look like citations
  // (2+ lines OR 60+ chars to avoid splitting on short blank lines inside an entry)
  return raw.split(/\n{2,}/)
    .map(s => s.trim())
    .filter(s => s.split('\n').length >= 2 || s.length > 60)
}

export function isBatch(raw: string, type: DataType): boolean {
  return splitCitations(raw, type).length > 1
}
