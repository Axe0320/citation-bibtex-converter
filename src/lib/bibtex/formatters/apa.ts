import type { FieldSelection } from '../../../parseCitation'
import type { NormalizedEntry } from '../types'
import { buildAPAReference } from './shared'

export function formatAPA(entry: NormalizedEntry, sel: FieldSelection): string {
  return buildAPAReference(entry, sel)
}
