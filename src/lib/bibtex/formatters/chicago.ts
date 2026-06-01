import type { FieldSelection } from '../../../parseCitation'
import type { NormalizedEntry } from '../types'
import { formatAuthorsFirstInverted } from './shared'
import { buildTitleQuoted, ensureTrailingPeriod, normalizeDOI } from './shared'

// ── Venue segment ──────────────────────────────────────────────────────────────
// Chicago Notes-Bibliography:
//   Article: "Journal Vol, no. N (Year): Pages."
//   No 'vol.' before volume number — just the numeral.

function buildVenueChicago(entry: NormalizedEntry, sel: FieldSelection): string | null {
  if (entry.type === 'article') {
    const journal = sel.journalOrBooktitle ? (entry.journal ?? entry.booktitle) : null
    const vol     = (sel.volume && entry.volume) ? entry.volume : null
    const no      = (sel.number && entry.number) ? entry.number : null
    const year    = (sel.year   && entry.year)   ? entry.year   : null
    const pages   = (sel.pages  && entry.pages)  ? entry.pages  : null

    // "Journal Vol, no. N"
    let block = ''
    if (journal && vol) block = `${journal} ${vol}`
    else if (journal)   block = journal
    else if (vol)       block = vol
    if (no) block = block ? `${block}, no. ${no}` : `no. ${no}`

    // Append year and/or pages
    if (year && pages)  block = block ? `${block} (${year}): ${pages}` : `(${year}): ${pages}`
    else if (year)      block = block ? `${block} (${year})` : `(${year})`
    else if (pages)     block = block ? `${block}: ${pages}` : pages

    return block ? block + '.' : null
  }

  if (entry.type === 'inproceedings') {
    if (!sel.journalOrBooktitle) return null
    const bt = entry.booktitle ?? entry.journal
    if (!bt) return null
    const prefix = /^[Ii]n\s/.test(bt) ? '' : 'In '
    let result = `${prefix}${bt}`
    const year  = (sel.year  && entry.year)  ? entry.year  : null
    const pages = (sel.pages && entry.pages) ? entry.pages : null
    if (pages) result += `, ${pages}`
    if (year)  result += ` (${year})`
    return result + '.'
  }

  if (entry.type === 'book') {
    const parts: string[] = []
    if (sel.publisher && entry.publisher) {
      parts.push(entry.publisher)
      if (entry.address) parts.push(entry.address)
    }
    if (sel.year && entry.year) parts.push(entry.year)
    if (!parts.length) return null
    return parts.join(', ') + '.'
  }

  // misc
  if (sel.journalOrBooktitle) {
    const venue = entry.journal ?? entry.booktitle
    if (venue) {
      const yr = sel.year && entry.year ? ` (${entry.year})` : ''
      return `${venue}${yr}.`
    }
  }
  return null
}

// ── Public formatter ───────────────────────────────────────────────────────────

export function formatChicago(entry: NormalizedEntry, sel: FieldSelection): string {
  // Chicago NB: "Author. "Title." Journal Vol, no. N (Year): Pages. DOI"
  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsFirstInverted(entry.authors)
    : null

  const titleStr = (sel.title && entry.title) ? entry.title : null
  const venueStr = buildVenueChicago(entry, sel)
  const doiStr   = (sel.doi && entry.doi) ? normalizeDOI(entry.doi) : null

  if (!authorStr && !titleStr && !venueStr && !doiStr) return ''

  const parts: string[] = []
  if (authorStr) parts.push(ensureTrailingPeriod(authorStr))
  if (titleStr)  parts.push(buildTitleQuoted(titleStr))
  if (venueStr)  parts.push(venueStr)
  if (doiStr)    parts.push(doiStr)

  return parts.join(' ')
}
