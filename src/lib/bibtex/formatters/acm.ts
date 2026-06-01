import type { FieldSelection } from '../../../parseCitation'
import type { Author, NormalizedEntry } from '../types'
import { joinAuthorNames } from './shared'
import { hasTerminalPunct, normalizeDOI } from './shared'

// ── Author formatting ──────────────────────────────────────────────────────────
// ACM Reference Format: full given names — "Shangbin Feng and Herun Wan"
// No initials transformation; uses whatever is stored in Author.given.

function formatAuthorACM(a: Author): string {
  if (a.isOrg) return a.family
  const base = a.given ? `${a.given} ${a.family}` : a.family
  return a.suffix ? `${base}, ${a.suffix}` : base
}

function formatAuthorsACM(authors: Author[]): string {
  return joinAuthorNames(authors.map(formatAuthorACM), 'and', true)
}

// ── Venue segment ──────────────────────────────────────────────────────────────
// Year is a separate segment in ACM (placed before title), not inside venue.

function buildVenueACM(entry: NormalizedEntry, sel: FieldSelection): string | null {
  if (entry.type === 'inproceedings') {
    if (!sel.journalOrBooktitle) {
      if (sel.pages && entry.pages) return `${entry.pages}.`
      return null
    }
    const bt = entry.booktitle ?? entry.journal
    if (!bt) return null
    const prefix = /^[Ii]n\s/.test(bt) ? '' : 'In '
    let result = `${prefix}${bt}`
    if (sel.pages && entry.pages) result += `, ${entry.pages}`
    return result + '.'
  }

  if (entry.type === 'article') {
    const parts: string[] = []
    if (sel.journalOrBooktitle) {
      const venue = entry.journal ?? entry.booktitle
      if (venue) parts.push(venue)
    }
    if (sel.volume && entry.volume) {
      const vs = (sel.number && entry.number)
        ? `${entry.volume}, ${entry.number}`
        : entry.volume
      parts.push(vs)
    }
    if (sel.pages && entry.pages) parts.push(entry.pages)
    if (!parts.length) return null
    return parts.join(', ') + '.'
  }

  if (entry.type === 'book') {
    if (!sel.publisher) return null
    const parts: string[] = []
    if (entry.publisher) parts.push(entry.publisher)
    if (entry.address)   parts.push(entry.address)
    return parts.join(', ') + '.'
  }

  // misc
  if (sel.journalOrBooktitle) {
    const venue = entry.journal ?? entry.booktitle
    if (venue) return venue + '.'
  }
  return null
}

// ── Public formatter ───────────────────────────────────────────────────────────

export function formatACM(entry: NormalizedEntry, sel: FieldSelection): string {
  // ACM: "Authors. Year. Title. In Venue, Pages. DOI"
  // Year is placed BEFORE the title (between author and title)

  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsACM(entry.authors)
    : null

  const yearStr  = (sel.year && entry.year) ? entry.year : null
  const titleStr = (sel.title && entry.title) ? entry.title : null
  const venueStr = buildVenueACM(entry, sel)
  const doiStr   = (sel.doi && entry.doi) ? normalizeDOI(entry.doi) : null

  if (!authorStr && !yearStr && !titleStr && !venueStr && !doiStr) return ''

  const parts: string[] = []
  if (authorStr) parts.push(`${authorStr}.`)
  if (yearStr)   parts.push(`${yearStr}.`)   // year before title
  if (titleStr)  parts.push(hasTerminalPunct(titleStr) ? titleStr : `${titleStr}.`)
  if (venueStr)  parts.push(venueStr)
  if (doiStr)    parts.push(doiStr)

  return parts.join(' ')
}
