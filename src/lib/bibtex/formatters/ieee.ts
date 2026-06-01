import type { FieldSelection } from '../../../parseCitation'
import type { Author, NormalizedEntry } from '../types'
import { toInitials, joinAuthorNames } from './shared'
import { hasTerminalPunct, ensureTrailingPeriod } from './shared'

// ── Author formatting ──────────────────────────────────────────────────────────

function formatAuthorIEEE(a: Author): string {
  if (a.isOrg) return a.family
  const initials = a.given ? toInitials(a.given) : ''
  const base     = initials ? `${initials} ${a.family}` : a.family
  return a.suffix ? `${base}, ${a.suffix}` : base
}

function formatAuthorsIEEE(authors: Author[]): string {
  return joinAuthorNames(authors.map(formatAuthorIEEE), 'and', true)
}

// ── Title formatting ───────────────────────────────────────────────────────────

function buildTitleIEEE(title: string, hasPost: boolean): string {
  if (hasPost) return hasTerminalPunct(title) ? `"${title}"` : `"${title},"`
  return hasTerminalPunct(title) ? `"${title}"` : `"${title}."`
}

// ── Post-title segments (venue, year, doi) ─────────────────────────────────────

function buildPostIEEE(entry: NormalizedEntry, sel: FieldSelection): string[] {
  const parts: string[] = []

  switch (entry.type) {
    case 'article': {
      const jParts: string[] = []
      if (sel.journalOrBooktitle) {
        const venue = entry.journal ?? entry.booktitle
        if (venue) jParts.push(venue)
      }
      if (sel.volume && entry.volume) jParts.push(`vol. ${entry.volume}`)
      if (sel.number && entry.number) jParts.push(`no. ${entry.number}`)
      if (sel.pages  && entry.pages)  jParts.push(`pp. ${entry.pages}`)
      if (jParts.length) parts.push(jParts.join(', '))
      if (sel.year && entry.year) parts.push(entry.year)
      if (sel.doi  && entry.doi)  parts.push(`doi: ${entry.doi}`)
      break
    }
    case 'inproceedings': {
      if (sel.journalOrBooktitle) {
        const bt = entry.booktitle ?? entry.journal
        if (bt) {
          const prefix = /^[Ii]n\s/.test(bt) ? '' : 'in '
          parts.push(`${prefix}${bt}`)
        }
      }
      if (sel.year  && entry.year)  parts.push(entry.year)
      if (sel.pages && entry.pages) parts.push(`pp. ${entry.pages}`)
      if (sel.doi   && entry.doi)   parts.push(`doi: ${entry.doi}`)
      break
    }
    case 'book': {
      if (sel.publisher && entry.publisher) {
        const pubParts = [entry.publisher]
        if (entry.address) pubParts.push(entry.address)
        parts.push(pubParts.join(', '))
      }
      if (sel.year && entry.year) parts.push(entry.year)
      if (sel.doi  && entry.doi)  parts.push(`doi: ${entry.doi}`)
      break
    }
    default: {
      if (sel.journalOrBooktitle) {
        const venue = entry.journal ?? entry.booktitle
        if (venue) parts.push(venue)
      }
      if (sel.year && entry.year) parts.push(entry.year)
      if (sel.doi  && entry.doi)  parts.push(`doi: ${entry.doi}`)
    }
  }

  return parts
}

// ── Assembly ───────────────────────────────────────────────────────────────────

function assembleBook(
  authorStr: string | null,
  titleStr:  string | null,
  postStr:   string | null,
): string {
  let result = ''
  if (authorStr && titleStr) {
    result = `${authorStr}, ${titleStr}.`
  } else if (authorStr) {
    result = authorStr
  } else if (titleStr) {
    result = `${titleStr}.`
  }
  if (postStr) {
    if (result && !result.endsWith('.')) result += '.'
    result = result ? `${result} ${postStr}` : postStr
  }
  return ensureTrailingPeriod(result)
}

function assembleNonBook(
  authorStr: string | null,
  titleSeg:  string | null,
  postStr:   string | null,
): string {
  const parts = [authorStr, titleSeg, postStr].filter((p): p is string => !!p)
  if (parts.length === 0) return ''

  let result = parts[0]
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1]
    // After "Title," / "Title?" / "Title!" — title's own punct acts as separator
    if (/[,?!]"$/.test(prev)) {
      result += ` ${parts[i]}`
    } else {
      result += `, ${parts[i]}`
    }
  }
  return ensureTrailingPeriod(result)
}

// ── Public formatter ───────────────────────────────────────────────────────────

export function formatIEEE(entry: NormalizedEntry, sel: FieldSelection): string {
  const isBook = entry.type === 'book'

  const authorStr = (sel.author && entry.authors.length > 0)
    ? formatAuthorsIEEE(entry.authors)
    : null

  const post    = buildPostIEEE(entry, sel)
  const postStr = post.length > 0 ? post.join(', ') : null

  let titleSeg: string | null = null
  if (sel.title && entry.title) {
    titleSeg = isBook
      ? entry.title
      : buildTitleIEEE(entry.title, !!postStr)
  }

  if (!authorStr && !titleSeg && !postStr) return ''

  return isBook
    ? assembleBook(authorStr, titleSeg, postStr)
    : assembleNonBook(authorStr, titleSeg, postStr)
}
