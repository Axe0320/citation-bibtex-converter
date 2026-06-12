// ── BibTeX entry parser (brace-depth aware) ────────────────────────────────────
// Moved from parseCitation.ts — content unchanged, export keywords added.

export interface BibEntry {
  type: string
  key: string
  fields: Map<string, string> // insertion-order preserved
}

export function parseBibEntry(raw: string): BibEntry | null {
  const s = raw.trim()
  const hm = s.match(/^@(\w+)\s*\{\s*([^,\s}]*)/i)
  if (!hm) return null

  const type = hm[1].toUpperCase()
  // Discard if key looks like a captured field (contains = or {) — happens when
  // there is no key on the opening line (e.g. @article{\n  author=...)
  const rawKey = hm[2].trim()
  const key = /[={]/.test(rawKey) ? '' : rawKey
  const fields = new Map<string, string>()
  let pos = hm[0].length

  while (pos < s.length) {
    while (pos < s.length && /[\s,]/.test(s[pos])) pos++
    if (pos >= s.length || s[pos] === '}') break

    const ns = pos
    while (pos < s.length && /\w/.test(s[pos])) pos++
    const name = s.slice(ns, pos).toLowerCase()
    if (!name) { pos++; continue }

    while (pos < s.length && /[\s=]/.test(s[pos])) pos++
    if (pos >= s.length) break

    let value = ''
    if (s[pos] === '{') {
      pos++
      let depth = 1
      const vs = pos
      while (pos < s.length) {
        if (s[pos] === '{') depth++
        else if (s[pos] === '}') { depth--; if (depth === 0) break }
        pos++
      }
      value = s.slice(vs, pos)
      pos++
    } else if (s[pos] === '"') {
      pos++
      const vs = pos
      while (pos < s.length && s[pos] !== '"') pos++
      value = s.slice(vs, pos)
      pos++
    } else {
      const vs = pos
      while (pos < s.length && !/[\s,}]/.test(s[pos])) pos++
      value = s.slice(vs, pos)
    }

    if (name) fields.set(name, value.trim())
  }

  return { type, key, fields }
}
