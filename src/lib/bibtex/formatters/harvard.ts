import type { FieldSelection } from '../../../parseCitation'
import type { Author, NormalizedEntry } from '../types'
import { formatAuthorFamilyFirst, joinAuthorNames } from './shared'
import { ensureTrailingPeriod, normalizeDOI } from './shared'

// ── Author formatting ──────────────────────────────────────────────────────────
// Harvard: "Smith, J., Lee, M. & Wang, T."  (Last, F. — '&' before last, no serial comma)

function formatAuthorHarvard(a: Author): string {
  return formatAuthorFamilyFirst(a)  // "Smith, J."
}

function formatAuthorsHarvard(authors: Author[]): string {
  return joinAuthorNames(authors.map(formatAuthorHarvard), '&', false)
}

// ── Public formatter ───────────────────────────────────────────────────────────
// Harvard: all fields comma-separated in one flat stream.
//   "Authors Year, 'Title', Journal, vol. V, no. N, pp. P–P."
// Year follows author with a space (no parens). Title in single quotes.

export function formatHarvard(entry: NormalizedEntry, sel: FieldSelection): string {
  const parts: string[] = []

  // Author + year as one token (year with no parens, no period between them)
  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsHarvard(entry.authors)
    : null
  const yearStr = (sel.year && entry.year) ? entry.year : null

  if (authorStr && yearStr) {
    parts.push(`${authorStr} ${yearStr}`)
  } else if (authorStr) {
    parts.push(authorStr)
  } else if (yearStr) {
    parts.push(yearStr)
  }

  // Title in single quotes
  if (sel.title && entry.title) {
    parts.push(`'${entry.title}'`)
  }

  // Venue fields — all independent optional segments
  if (sel.journalOrBooktitle) {
    const venue = entry.journal ?? entry.booktitle
    if (venue) parts.push(venue)
  }
  if (sel.volume && entry.volume) parts.push(`vol. ${entry.volume}`)
  if (sel.number && entry.number) parts.push(`no. ${entry.number}`)
  if (sel.pages  && entry.pages)  parts.push(`pp. ${entry.pages}`)

  // DOI
  if (sel.doi && entry.doi) parts.push(normalizeDOI(entry.doi))

  if (!parts.length) return ''

  return ensureTrailingPeriod(parts.join(', '))
}
