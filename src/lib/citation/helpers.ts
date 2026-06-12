export function extractTitle(text: string): string {
  const quoted = text.match(/^[""](.+?)[""][,.]?\s/)
  if (quoted) return quoted[1].replace(/,$/, '').trim()
  const m = text.match(/^(.+?)\s+[Ii]n\s+/)
  if (m) return m[1].replace(/[,.]$/, '').trim()
  return ''
}

export function extractJournal(text: string): string {
  const m = text.match(/\bin\s+(.+?),\s*vol\./i)
  if (m) return m[1].trim()
  const m2 = text.match(/\bin\s+([^,]+(?:,[^,]+)*?),\s*(?:vol|no|pp|20\d{2}|19\d{2})/i)
  if (m2) return m2[1].trim()
  return ''
}

export function extractDOI(text: string): string {
  const m = text.match(/\bdoi:\s*([^\s,;]+)/i)
  if (m) return m[1].replace(/\.$/, '').trim()
  const m2 = text.match(/\b(10\.\d{4,}\/[^\s,;]+)/)
  if (m2) return m2[1].replace(/\.$/, '').trim()
  return ''
}

export function extractAuthor(text: string): string {
  const m = text.match(/^([^,"]+?),\s*[""]/)
  if (m) return m[1].trim()
  return ''
}

// ── bibKey helpers (internal) ──────────────────────────────────────────────────

function extractFamilyName(token: string): string {
  const t = token.trim().replace(/\s+et\s+al\.?\s*$/i, '').trim()
  if (!t) return ''
  const ci = t.indexOf(',')
  if (ci > 0) return t.slice(0, ci).trim().split(/\s+/)[0]
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0]
  if (/^[A-Z]\./.test(words[0])) return words[words.length - 1]  // "F. Lastname"
  if (/^[A-Z]$/.test(words[words.length - 1])) return words[0]   // "Lastname F"
  return words[words.length - 1]
}

function splitAuthorTokens(authorRaw: string): string[] {
  // Split on "and" / "&" first, then flatten any comma-run left in IEEE tokens.
  let tokens: string[]
  if (/ and /i.test(authorRaw)) tokens = authorRaw.split(/ and /i)
  else if (/ & /.test(authorRaw)) tokens = authorRaw.split(/ & /)
  else tokens = [authorRaw]

  const result: string[] = []
  for (const tok of tokens) {
    const t = tok.trim().replace(/,$/, '').trim()
    // IEEE comma-list inside one token: "F. Lastname, F. Lastname"
    if (/^[A-Z]\. \w/.test(t) && t.includes(',')) {
      result.push(...t.split(/,\s+/).filter(Boolean))
    } else if (/^[A-Z][a-z]+ [A-Z](,|$)/.test(t)) {
      // Vancouver/AMA: "Family I, Family I"
      result.push(...t.split(/, /).filter(Boolean))
    } else {
      result.push(t)
    }
  }
  return result.filter(Boolean)
}

export function bibKey(doi: string, authorRaw: string, title: string, year: string): string {
  if (doi) {
    // Optional chaining guards against undefined in edge cases
    const last = doi.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) ?? ''
    return last || 'cite'
  }
  const yr = year || 'Unknown'
  const families = splitAuthorTokens(authorRaw)
    .slice(0, 1)
    .map(t => extractFamilyName(t.trim()))
    .map(n => {
      const ascii = n.replace(/[^a-zA-Z]/g, '')
      if (ascii) return ascii
      // For pure CJK names: use first 2 characters as a family-name estimate
      // e.g. '田中太郎' → '田中', '山田花子' → '山田'
      return n.replace(/[^一-鿿぀-ヿ]/g, '').slice(0, 2)
    })
    .filter(Boolean)
  if (families.length > 0) return families.join('') + yr
  const firstWord = title.split(/\s+/)[0] ?? ''
  const titleKey  = firstWord.replace(/[^a-zA-Z]/g, '')
    || firstWord.replace(/[^一-鿿぀-ヿ]/g, '').slice(0, 2)
  return `${titleKey || 'cite'}${yr}`
}

export function fixLastLine(lines: string[]): void {
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '')
  }
}
