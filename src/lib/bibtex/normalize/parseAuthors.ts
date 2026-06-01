import type { Author } from '../types'

// ── Particle dictionary ────────────────────────────────────────────────────────
// Checked first; lowercase-fallback handles less common particles.

const FAMILY_PARTICLES = new Set([
  'van', 'von', 'de', 'del', 'della', 'di', 'du',
  'la', 'le', 'der', 'den', 'ten', 'ter',
  'bin', 'ibn', 'al', 'ap', 'ben', "d'", 'da', 'das', 'dos', 'des',
])

function isParticle(word: string): boolean {
  return FAMILY_PARTICLES.has(word.toLowerCase()) || /^[a-z]/.test(word)
}

// ── Suffix recognition ─────────────────────────────────────────────────────────
// Covers Jr./Sr., Roman numeral generations (I–VIII), academic degrees.

const SUFFIX_RE = /^(Jr\.?|Sr\.?|I{1,4}V?|VI{0,3}|Ph\.?D\.?|M\.?D\.?|Esq\.?)$/i

// ── Single-author parser ───────────────────────────────────────────────────────

function parseSingleAuthor(raw: string): Author {
  const trimmed = raw.trim()
  if (!trimmed) return { family: '', given: '' }

  // Organization — entire token wrapped in { }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return { family: trimmed.slice(1, -1).trim(), given: '', isOrg: true }
  }

  // ── Lastname, ... format (has comma) ──────────────────────────────────────
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim())
    const family = parts[0]

    // "Last, First"
    if (parts.length === 2) {
      return { family, given: parts[1] }
    }

    // "Last, Suffix, First" (BibTeX standard)  or  "Last, First, Suffix" (common)
    if (parts.length === 3) {
      const [, p1, p2] = parts
      if (SUFFIX_RE.test(p1)) return { family, given: p2,  suffix: p1 }
      if (SUFFIX_RE.test(p2)) return { family, given: p1,  suffix: p2 }
    }

    // Graceful fallback: concat all non-family parts as given
    return { family, given: parts.slice(1).join(', ') }
  }

  // ── Firstname Lastname format (no comma) ──────────────────────────────────
  const words = trimmed.split(/\s+/)
  if (words.length === 1) return { family: words[0], given: '' }

  // Find where family name starts: last word + any preceding particle words
  let familyStart = words.length - 1
  while (familyStart > 0 && isParticle(words[familyStart - 1])) {
    familyStart--
  }
  // Guard: never consume all words as particles
  if (familyStart === 0) familyStart = words.length - 1

  return {
    family: words.slice(familyStart).join(' '),
    given:  words.slice(0, familyStart).join(' '),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function parseAuthors(authorField: string): Author[] {
  return authorField
    .split(/\s+and\s+/i)
    .map(s => s.trim())
    .filter(Boolean)
    .map(parseSingleAuthor)
}
