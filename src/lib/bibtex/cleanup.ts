import { parseBibEntry } from './parser/parseBibEntry'
import type { BibEntry } from './parser/parseBibEntry'
import { serialize } from './serializer'
import { bibKey } from '../citation/helpers'
import { venueKeyForType } from '../citation/builder'
import type { BibEntryType } from '../citation/types'

export interface CleanupOptions {
  entryType?: BibEntryType
  normalizeKeys: boolean
  removeEmptyFields: boolean
}

function isEmptyBibField(v: string | undefined): boolean {
  return v == null || /^\s*$/.test(v)
}

function toAlphaSuffix(n: number): string {
  let result = ''
  while (n > 0) {
    n--
    result = String.fromCharCode(97 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

function deconflictKey(entry: BibEntry, used: Set<string>): BibEntry {
  if (!used.has(entry.key)) return entry
  let i = 0
  let key = entry.key
  while (used.has(key)) key = entry.key + toAlphaSuffix(++i)
  return { ...entry, key }
}

export function removeEmptyFields(entry: BibEntry): BibEntry {
  const fields = new Map<string, string>()
  for (const [name, value] of entry.fields) {
    if (!isEmptyBibField(value)) fields.set(name, value)
  }
  return { ...entry, fields }
}

export function retagEntry(entry: BibEntry, to: BibEntryType): BibEntry {
  const targetVenue = venueKeyForType(to)
  const hasJournal  = entry.fields.has('journal')
  const hasBoktitle = entry.fields.has('booktitle')

  const fields = new Map<string, string>()
  for (const [name, value] of entry.fields) {
    if (targetVenue === 'booktitle') {
      if (name === 'journal') {
        if (!hasBoktitle) fields.set('booktitle', value)
        // else drop journal — booktitle already present
      } else {
        fields.set(name, value)
      }
    } else if (targetVenue === 'journal') {
      if (name === 'booktitle') {
        if (!hasJournal) fields.set('journal', value)
        // else drop booktitle — journal already present
      } else {
        fields.set(name, value)
      }
    } else {
      // BOOK / MISC / etc — no venue field
      if (name !== 'journal' && name !== 'booktitle') fields.set(name, value)
    }
  }

  return { ...entry, type: to, fields }
}

export function normalizeKey(entry: BibEntry): BibEntry {
  const author = entry.fields.get('author') ?? ''
  const title  = entry.fields.get('title')  ?? ''
  const year   = entry.fields.get('year')   ?? ''
  const doi    = entry.fields.get('doi')    ?? ''
  return { ...entry, key: bibKey(doi, author, title, year) }
}

export function applyCleanupBatch(raws: string[], opts: CleanupOptions): string[] {
  const usedKeys = new Set<string>()
  return raws.map(raw => {
    const parsed = parseBibEntry(raw)
    if (!parsed) return raw
    let p = parsed
    if (opts.entryType)         p = retagEntry(p, opts.entryType)
    if (opts.normalizeKeys)     p = deconflictKey(normalizeKey(p), usedKeys)
    if (opts.removeEmptyFields) p = removeEmptyFields(p)
    usedKeys.add(p.key)
    return serialize(p)
  })
}
