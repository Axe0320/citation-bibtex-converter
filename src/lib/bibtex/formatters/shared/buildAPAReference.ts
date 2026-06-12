import type { FieldSelection } from '../../../../parseCitation'
import type { Author, NormalizedEntry } from '../../types'
import { formatAuthorFamilyFirst, joinAuthorNames, hasTerminalPunct, normalizeDOI } from '.'

function formatAuthorAPA(a: Author): string {
  return formatAuthorFamilyFirst(a)
}

function formatAuthorsAPA(authors: Author[]): string {
  return joinAuthorNames(authors.map(formatAuthorAPA), '&', true)
}

function buildVenueAPA(entry: NormalizedEntry, sel: FieldSelection): string | null {
  if (entry.type === 'article') {
    const parts: string[] = []
    if (sel.journalOrBooktitle) {
      const venue = entry.journal ?? entry.booktitle
      if (venue) parts.push(venue)
    }
    if (sel.volume && entry.volume) {
      const vs = (sel.number && entry.number)
        ? `${entry.volume}(${entry.number})`
        : entry.volume
      parts.push(vs)
    }
    if (sel.pages && entry.pages) parts.push(entry.pages)
    if (!parts.length) return null
    return parts.join(', ') + '.'
  }
  if (entry.type === 'inproceedings') {
    if (!sel.journalOrBooktitle) {
      if (sel.pages && entry.pages) return `(pp. ${entry.pages}).`
      return null
    }
    const bt = entry.booktitle ?? entry.journal
    if (!bt) return null
    const prefix = /^[Ii]n\s/.test(bt) ? '' : 'In '
    let result = `${prefix}${bt}`
    if (sel.pages && entry.pages) result += ` (pp. ${entry.pages})`
    return result + '.'
  }
  if (entry.type === 'book') {
    if (!sel.publisher) return null
    const parts: string[] = []
    if (entry.publisher) parts.push(entry.publisher)
    if (entry.address)   parts.push(entry.address)
    return parts.join(', ') + '.'
  }
  if (sel.journalOrBooktitle) {
    const venue = entry.journal ?? entry.booktitle
    if (venue) return venue + '.'
  }
  return null
}

export function buildAPAReference(entry: NormalizedEntry, sel: FieldSelection): string {
  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsAPA(entry.authors)
    : null
  const yearStr  = (sel.year && entry.year) ? entry.year : null
  const titleStr = (sel.title && entry.title) ? entry.title : null
  const venueStr = buildVenueAPA(entry, sel)
  const doiStr   = (sel.doi && entry.doi) ? normalizeDOI(entry.doi) : null

  if (!authorStr && !yearStr && !titleStr && !venueStr && !doiStr) return ''

  const parts: string[] = []
  if (authorStr && yearStr) {
    parts.push(`${authorStr} (${yearStr}).`)
  } else if (authorStr) {
    parts.push(hasTerminalPunct(authorStr) ? authorStr : `${authorStr}.`)
  } else if (yearStr) {
    parts.push(`(${yearStr}).`)
  }
  if (titleStr) {
    parts.push(hasTerminalPunct(titleStr) ? titleStr : `${titleStr}.`)
  }
  if (venueStr) parts.push(venueStr)
  if (doiStr)   parts.push(doiStr)

  return parts.join(' ')
}
