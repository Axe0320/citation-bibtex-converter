import type { FieldSelection } from '../../../parseCitation'
import type { NormalizedEntry } from '../types'
import { formatAuthorsFirstInverted } from './shared'
import { buildTitleQuoted, ensureTrailingPeriod, normalizeDOI } from './shared'

// ── Venue segment ──────────────────────────────────────────────────────────────
// MLA article: "Journal, vol. V, no. N, Year, pp. P–P."
// Note: year comes BEFORE pages in MLA.

function buildVenueMLA(entry: NormalizedEntry, sel: FieldSelection): string | null {
  if (entry.type === 'article') {
    const parts: string[] = []
    if (sel.journalOrBooktitle) {
      const venue = entry.journal ?? entry.booktitle
      if (venue) parts.push(venue)
    }
    if (sel.volume && entry.volume) parts.push(`vol. ${entry.volume}`)
    if (sel.number && entry.number) parts.push(`no. ${entry.number}`)
    if (sel.year   && entry.year)   parts.push(entry.year)     // year before pages
    if (sel.pages  && entry.pages)  parts.push(`pp. ${entry.pages}`)
    if (!parts.length) return null
    return parts.join(', ') + '.'
  }

  if (entry.type === 'inproceedings') {
    if (!sel.journalOrBooktitle) return null
    const bt = entry.booktitle ?? entry.journal
    if (!bt) return null
    const prefix = /^[Ii]n\s/.test(bt) ? '' : 'In '
    let result = `${prefix}${bt}`
    if (sel.year  && entry.year)  result += `, ${entry.year}`
    if (sel.pages && entry.pages) result += `, pp. ${entry.pages}`
    return result + '.'
  }

  if (entry.type === 'book') {
    const parts: string[] = []
    if (sel.publisher && entry.publisher) parts.push(entry.publisher)
    if (sel.year && entry.year) parts.push(entry.year)
    if (!parts.length) return null
    return parts.join(', ') + '.'
  }

  // misc
  if (sel.journalOrBooktitle) {
    const venue = entry.journal ?? entry.booktitle
    if (venue) {
      const yr = sel.year && entry.year ? `, ${entry.year}` : ''
      return `${venue}${yr}.`
    }
  }
  return null
}

// ── Public formatter ───────────────────────────────────────────────────────────

export function formatMLA(entry: NormalizedEntry, sel: FieldSelection): string {
  // MLA: "Author(s). "Title." Journal, vol. V, no. N, Year, pp. P–P."
  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsFirstInverted(entry.authors)
    : null

  const titleStr = (sel.title && entry.title) ? entry.title : null
  const venueStr = buildVenueMLA(entry, sel)   // year is inside venue
  const doiStr   = (sel.doi && entry.doi) ? normalizeDOI(entry.doi) : null

  if (!authorStr && !titleStr && !venueStr && !doiStr) return ''

  const parts: string[] = []
  if (authorStr) parts.push(ensureTrailingPeriod(authorStr))
  if (titleStr) {
    // MLA: article/conference titles in quotes; book titles NOT quoted
    const titleSeg = entry.type === 'book'
      ? ensureTrailingPeriod(titleStr)
      : buildTitleQuoted(titleStr)
    parts.push(titleSeg)
  }
  if (venueStr)  parts.push(venueStr)
  if (doiStr)    parts.push(doiStr)

  return parts.join(' ')
}
