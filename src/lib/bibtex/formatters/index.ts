import type { FieldSelection } from '../../../parseCitation'
import type { CitationStyle, NormalizedEntry } from '../types'
import { formatIEEE }    from './ieee'
import { formatAPA }     from './apa'
import { formatNature }  from './nature'
import { formatACM }     from './acm'
import { formatSpringer } from './springer'
import { formatMLA }     from './mla'
import { formatChicago } from './chicago'
import { formatHarvard } from './harvard'
import { formatPandoc }  from './pandoc'

// ── Formatter type ─────────────────────────────────────────────────────────────

export type Formatter = (entry: NormalizedEntry, sel: FieldSelection) => string

// ── Registry ───────────────────────────────────────────────────────────────────
// 'classic' is intentionally absent — routed via parseCitation.ts convert().
// Styles not yet implemented fall back to IEEE.

const FORMATTERS: Partial<Record<CitationStyle, Formatter>> = {
  ieee:     formatIEEE,
  apa:      formatAPA,
  nature:   formatNature,
  acm:      formatACM,
  springer: formatSpringer,
  mla:      formatMLA,
  chicago:  formatChicago,
  harvard:  formatHarvard,
  pandoc:   formatPandoc,
}

export function selectFormatter(style: CitationStyle): Formatter {
  return FORMATTERS[style] ?? formatIEEE
}
