import type { ParsedFields } from './types'
import type { NormalizedEntry } from '../bibtex/types'
import { parseAuthors } from '../bibtex/normalize/parseAuthors'

// ── Canonical citation ─────────────────────────────────────────────────────────
// Extends NormalizedEntry with authorRaw pass-through so buildBibTeX can use
// the original author string without re-serializing the parsed Author[].
// Required-string redeclarations (journal, volume, number, pages, doi) keep
// buildBibTeX compatible without logic changes.

export interface CanonicalCitation extends NormalizedEntry {
  authorRaw: string
}

export function toCanonical(f: ParsedFields): CanonicalCitation {
  return {
    type:      'article',
    key:       '',
    title:     f.title,
    authors:   parseAuthors(f.author),
    authorRaw: f.author,
    year:      f.year,
    journal:   f.journal || undefined,
    volume:    f.volume  || undefined,
    number:    f.number  || undefined,
    pages:     f.pages   || undefined,
    doi:       f.doi     || undefined,
  }
}
