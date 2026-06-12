import type { BibEntry } from './parser/parseBibEntry'

export function serialize(entry: BibEntry): string {
  const fieldLines: string[] = []
  for (const [name, value] of entry.fields) {
    fieldLines.push(`  ${name}={${value}},`)
  }
  return [`@${entry.type.toLowerCase()}{${entry.key},`, ...fieldLines, `}`].join('\n')
}
