import type { FieldSelection } from '../../../parseCitation'
import type { Author, NormalizedEntry } from '../types'
import { formatAuthorFamilyFirst, joinAuthorNames } from './shared'
import { hasTerminalPunct, normalizeDOI } from './shared'

// ── Author formatting ──────────────────────────────────────────────────────────
// Nature: "Smith, J., Lee, M. K. & van der Berg, F."  (no serial comma before &)

function formatAuthorNature(a: Author): string {
  return formatAuthorFamilyFirst(a)  // "Smith, J." — same single-author form as APA
}

function formatAuthorsNature(authors: Author[]): string {
  return joinAuthorNames(authors.map(formatAuthorNature), '&', false)
}

// ── Venue segment (year is included at the END in parens) ─────────────────────
// Nature: "Journal Vol, Pages (Year)."

function buildVenueNature(entry: NormalizedEntry, sel: FieldSelection): string | null {
  const year = (sel.year && entry.year) ? entry.year : null

  if (entry.type === 'article') {
    const journal = sel.journalOrBooktitle ? (entry.journal ?? entry.booktitle) : null
    const vol     = (sel.volume && entry.volume) ? entry.volume : null
    const pages   = (sel.pages  && entry.pages)  ? entry.pages  : null

    // Build "Journal vol, pages" block
    let block = ''
    if (journal && vol) block = `${journal} ${vol}`
    else if (journal)   block = journal
    else if (vol)       block = vol

    if (pages) block = block ? `${block}, ${pages}` : pages
    if (year)  block = block ? `${block} (${year})` : `(${year})`

    return block ? block + '.' : null
  }

  if (entry.type === 'inproceedings') {
    if (!sel.journalOrBooktitle) return null
    const bt = entry.booktitle ?? entry.journal
    if (!bt) return null
    const prefix = /^[Ii]n\s/.test(bt) ? '' : 'in '
    let result = `${prefix}${bt}`
    if (sel.pages && entry.pages) result += `, ${entry.pages}`
    if (year) result += ` (${year})`
    return result + '.'
  }

  if (entry.type === 'book') {
    if (!sel.publisher) return null
    const parts: string[] = []
    if (entry.publisher) parts.push(entry.publisher)
    if (entry.address)   parts.push(entry.address)
    let result = parts.join(', ')
    if (year) result = result ? `${result} (${year})` : `(${year})`
    return result ? result + '.' : null
  }

  // misc
  const venue = sel.journalOrBooktitle ? (entry.journal ?? entry.booktitle) : null
  if (venue) {
    return year ? `${venue} (${year}).` : `${venue}.`
  }
  return null
}

// ── Public formatter ───────────────────────────────────────────────────────────

export function formatNature(entry: NormalizedEntry, sel: FieldSelection): string {
  // Nature: Author Title. Journal Vol, Pages (Year). DOI
  // Year is inside venue unit — NOT a standalone segment
  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsNature(entry.authors)
    : null

  const titleStr = (sel.title && entry.title) ? entry.title : null
  const venueStr = buildVenueNature(entry, sel)   // year included here
  const doiStr   = (sel.doi && entry.doi) ? normalizeDOI(entry.doi) : null

  if (!authorStr && !titleStr && !venueStr && !doiStr) return ''

  const parts: string[] = []
  if (authorStr) parts.push(authorStr)
  if (titleStr)  parts.push(hasTerminalPunct(titleStr) ? titleStr : `${titleStr}.`)
  if (venueStr)  parts.push(venueStr)
  if (doiStr)    parts.push(doiStr)

  return parts.join(' ')
}
