import type { FieldSelection } from '../../../parseCitation'
import type { NormalizedEntry } from '../types'
import { buildAPAReference } from './shared'

export function formatPandoc(entry: NormalizedEntry, sel: FieldSelection): string {
  const key     = entry.key || 'citation'
  const citeKey = `[@${key}]`
  const ref     = buildAPAReference(entry, sel)
  return ref ? `${citeKey}\n\n---\n${ref}` : citeKey
}
