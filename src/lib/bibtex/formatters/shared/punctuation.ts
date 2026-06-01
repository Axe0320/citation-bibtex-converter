// True if title/string already ends with sentence-ending punctuation
export const hasTerminalPunct = (s: string): boolean => /[.?!]$/.test(s)

// Adds trailing period unless the string already ends with one (or with '."' / '?"')
export const ensureTrailingPeriod = (s: string): string =>
  /[.?"!]"$/.test(s) || s.endsWith('.') ? s : s + '.'

// Title in double quotes with period inside — MLA / Chicago style.
// Period omitted when title already has terminal punct (?, !, .).
export function buildTitleQuoted(title: string): string {
  return hasTerminalPunct(title) ? `"${title}"` : `"${title}."`
}

// Normalises any DOI representation to https://doi.org/...
// Handles: "10.xxx/yyy", "doi:10.xxx/yyy", "https://doi.org/10.xxx/yyy"
export function normalizeDOI(raw: string): string {
  const clean = raw
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
  return clean ? `https://doi.org/${clean}` : ''
}
