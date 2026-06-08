import type { ParsedFields } from './types'

// ── Canonical citation ─────────────────────────────────────────────────────────
// Lightweight DTO for TXT → BibTeX path only.
// Contains exactly the fields buildBibTeX() needs — no BibTeX-side types.

export interface CanonicalCitation {
  authorRaw: string
  title:     string
  year:      string
  journal?:  string
  volume?:   string
  number?:   string
  pages?:    string
  doi?:      string
}

export function toCanonical(f: ParsedFields): CanonicalCitation {
  return {
    authorRaw: f.author,
    title:     f.title,
    year:      f.year,
    journal:   f.journal || undefined,
    volume:    f.volume  || undefined,
    number:    f.number  || undefined,
    pages:     f.pages   || undefined,
    doi:       f.doi     || undefined,
  }
}
