import type { FieldSelection } from '../../../parseCitation'
import type { Author, NormalizedEntry } from '../types'
import { formatAuthorFamilyFirst } from './shared'
import { hasTerminalPunct, normalizeDOI } from './shared'

// ── Author formatting ──────────────────────────────────────────────────────────
// Springer/LNCS: "Smith, J., Lee, M.K., van der Berg, F.:"
// Initials have no space between them (sep=''), colon after entire list.

function formatAuthorSpringer(a: Author): string {
  return formatAuthorFamilyFirst(a, '')  // "Smith, J.A." not "Smith, J. A."
}

function formatAuthorsSpringer(authors: Author[]): string {
  // All commas, no conjunction — colon appended to entire list
  const names = authors.map(formatAuthorSpringer)
  return names.join(', ') + ':'
}

// ── Venue segment (year in parens at end, same position as Nature) ─────────────
// Springer: "Journal Vol(Issue), Pages (Year)."

function buildVenueSpringer(entry: NormalizedEntry, sel: FieldSelection): string | null {
  const year = (sel.year && entry.year) ? entry.year : null

  if (entry.type === 'article') {
    const journal = sel.journalOrBooktitle ? (entry.journal ?? entry.booktitle) : null
    const vol     = (sel.volume && entry.volume) ? entry.volume : null
    const no      = (sel.number && entry.number) ? entry.number : null
    const pages   = (sel.pages  && entry.pages)  ? entry.pages  : null

    // "Journal Vol(Issue)" — no space before (Issue)
    let block = ''
    if (journal && vol) {
      block = no ? `${journal} ${vol}(${no})` : `${journal} ${vol}`
    } else if (journal) {
      block = journal
    } else if (vol) {
      block = no ? `${vol}(${no})` : vol
    }

    if (pages) block = block ? `${block}, ${pages}` : pages
    if (year)  block = block ? `${block} (${year})` : `(${year})`

    return block ? block + '.' : null
  }

  if (entry.type === 'inproceedings') {
    if (!sel.journalOrBooktitle) return null
    const bt = entry.booktitle ?? entry.journal
    if (!bt) return null
    const prefix = /^[Ii]n\s/.test(bt) ? '' : 'In '
    let result = `${prefix}${bt}`
    if (sel.pages && entry.pages) result += `, ${entry.pages}`
    if (year) result += ` (${year})`
    return result + '.'
  }

  if (entry.type === 'book') {
    // year is independent of publisher — show even when publisher=OFF
    const parts: string[] = []
    if (sel.publisher && entry.publisher) {
      parts.push(entry.publisher)
      if (entry.address) parts.push(entry.address)
    }
    let result = parts.join(', ')
    if (year) result = result ? `${result} (${year})` : `(${year})`
    return result ? result + '.' : null
  }

  // misc
  const venue = sel.journalOrBooktitle ? (entry.journal ?? entry.booktitle) : null
  if (venue) return year ? `${venue} (${year}).` : `${venue}.`
  return null
}

// ── Public formatter ───────────────────────────────────────────────────────────

export function formatSpringer(entry: NormalizedEntry, sel: FieldSelection): string {
  // Springer: "Smith, J., Lee, M.K.: Title. Journal Vol(Issue), Pages (Year). DOI"
  // Year is inside venue unit. Author list ends with ':'.

  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsSpringer(entry.authors)   // ends with ':'
    : null

  const titleStr = (sel.title && entry.title) ? entry.title : null
  const venueStr = buildVenueSpringer(entry, sel)
  const doiStr   = (sel.doi && entry.doi) ? normalizeDOI(entry.doi) : null

  if (!authorStr && !titleStr && !venueStr && !doiStr) return ''

  const parts: string[] = []
  if (authorStr) parts.push(authorStr)
  if (titleStr)  parts.push(hasTerminalPunct(titleStr) ? titleStr : `${titleStr}.`)
  if (venueStr)  parts.push(venueStr)
  if (doiStr)    parts.push(doiStr)

  return parts.join(' ')
}
