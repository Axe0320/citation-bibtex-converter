import type { Author } from '../../types'

// Given name → initials, e.g. "John A." → "J. A." (sep=' ') or "J.A." (sep='')
export function toInitials(given: string, sep = ' '): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map(p => `${p[0].toUpperCase()}.`)
    .join(sep)
}

// "Last, F. M." style — used by APA, Nature, Springer (sep controls init spacing)
export function formatAuthorFamilyFirst(a: Author, initialSep = ' '): string {
  if (a.isOrg) return a.family
  const initials = a.given ? toInitials(a.given, initialSep) : ''
  const base     = initials ? `${a.family}, ${initials}` : a.family
  return a.suffix ? `${base}, ${a.suffix}` : base
}

// MLA / Chicago Notes-Bibliography: first author inverted, rest normal.
// etAlThreshold: authors.length >= threshold → "et al."
//   MLA 9th:       threshold=3  (3+  authors → et al.)
//   Chicago 17th:  threshold=4  (4+  authors → et al., 3 listed in full)
// Does NOT transform given names to initials — uses BibTeX value as-is.
export function formatAuthorsFirstInverted(authors: Author[], etAlThreshold = 3): string {
  if (!authors.length) return ''
  const first    = authors[0]
  const firstStr = first.isOrg ? first.family
    : first.given ? `${first.family}, ${first.given}` : first.family

  if (authors.length === 1) return firstStr

  if (authors.length === 2) {
    const s         = authors[1]
    const secondStr = s.isOrg ? s.family
      : s.given ? `${s.given} ${s.family}` : s.family
    return `${firstStr}, and ${secondStr}`
  }

  if (authors.length < etAlThreshold) {
    // List all authors (between 3 and threshold-1)
    const rest = authors.slice(1).map(s =>
      s.isOrg ? s.family : s.given ? `${s.given} ${s.family}` : s.family,
    )
    return `${firstStr}, ${rest.slice(0, -1).join(', ')}, and ${rest[rest.length - 1]}`
  }

  // threshold+ authors → et al.
  return `${firstStr}, et al.`
}

// Generic list joining with configurable conjunction and optional serial comma
export function joinAuthorNames(
  names:       string[],
  conjunction: string,
  serialComma: boolean,
): string {
  if (!names.length) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} ${conjunction} ${names[1]}`
  const last = names[names.length - 1]
  const rest = names.slice(0, -1).join(', ')
  return serialComma
    ? `${rest}, ${conjunction} ${last}`
    : `${rest} ${conjunction} ${last}`
}
