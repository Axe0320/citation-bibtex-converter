import type { BibEntry } from '../parser'
import type { NormalizedEntry } from '../types'
import { parseAuthors } from './parseAuthors'

// ── Entry type normalization ───────────────────────────────────────────────────

function normalizeType(raw: string): NormalizedEntry['type'] {
  switch (raw.toUpperCase()) {
    case 'ARTICLE':        return 'article'
    case 'INPROCEEDINGS':
    case 'CONFERENCE':
    case 'PROCEEDINGS':    return 'inproceedings'
    case 'BOOK':
    case 'BOOKLET':        return 'book'
    default:               return 'misc'
  }
}

// ── Lossless field helper ──────────────────────────────────────────────────────
// Returns undefined (not '') for absent / blank fields.

function field(f: Record<string, string>, key: string): string | undefined {
  const v = f[key]?.trim()
  return v || undefined
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function normalizeBibEntry(entry: BibEntry): NormalizedEntry {
  const f = Object.fromEntries(entry.fields)

  return {
    type:      normalizeType(entry.type),
    key:       entry.key,
    title:     field(f, 'title') ?? '',
    authors:   f.author ? parseAuthors(f.author) : [],
    year:      field(f, 'year') ?? '',
    // journal and booktitle kept separate — formatter decides which to use
    journal:   field(f, 'journal'),
    booktitle: field(f, 'booktitle'),
    volume:    field(f, 'volume'),
    number:    field(f, 'number'),
    // "--" → en-dash per BibTeX/LaTeX convention
    pages:     f.pages?.trim() ? f.pages.trim().replace(/--+/g, '–') : undefined,
    doi:       field(f, 'doi'),
    publisher: field(f, 'publisher'),
    address:   field(f, 'address'),
    edition:   field(f, 'edition'),
    url:       field(f, 'url'),
    note:      field(f, 'note'),
  }
}
