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
