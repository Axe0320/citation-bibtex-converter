import type { FieldSelection } from '../../../parseCitation'
import type { CitationStyle, NormalizedEntry } from '../types'
import { formatIEEE } from './ieee'

// ── Formatter type ─────────────────────────────────────────────────────────────

export type Formatter = (entry: NormalizedEntry, sel: FieldSelection) => string

// ── Registry ───────────────────────────────────────────────────────────────────
// Keyed by CitationStyle. 'classic' is intentionally absent — it stays in
// parseCitation.ts and is routed via convert(), not formatBibTeX().
// Styles not yet implemented fall back to IEEE as a temporary placeholder.

const FORMATTERS: Partial<Record<CitationStyle, Formatter>> = {
  ieee:     formatIEEE,
  // apa, acm, nature, springer, mla, chicago, harvard — added in subsequent PRs
}

export function selectFormatter(style: CitationStyle): Formatter {
  return FORMATTERS[style] ?? formatIEEE
}
