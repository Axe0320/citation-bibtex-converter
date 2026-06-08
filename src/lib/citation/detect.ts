import type { ParsedFields, CiteFormat } from './types'
import {
  parseIEEE, parseMDPI, parseAPA, parseHarvard, parseVancouverAMA,
  parseAuthorLib, parseACMACL, parseSpringerNature, parseSpringerAPA,
  parseElsevier, parseUnknown,
} from './parsers'

interface Detector {
  format:   CiteFormat
  priority: number          // higher fires first; gaps of 10 leave room for future insertion
  detect:   (t: string) => boolean
  parse:    (raw: string) => ParsedFields
}

// Priority values encode the legacy if-chain order and make overlap reasoning explicit:
//   apa (80) must precede springer_nature (30) and springer_apa (20)
//   because `(YYYY). Capital` matches the APA pattern before the Springer patterns fire.
const DETECTORS: Detector[] = [
  { format: 'ieee',            priority: 100, detect: t => /^[A-Z]\. \w/.test(t) && /"/.test(t),                                  parse: parseIEEE },
  { format: 'mdpi',            priority:  90, detect: t => /^[\w-]+, [A-Z]\.;/.test(t),                                           parse: parseMDPI },
  { format: 'apa',             priority:  80, detect: t => /\((?:19|20)\d{2}\)\. [A-Z]/.test(t),                                  parse: parseAPA },
  { format: 'author_lib',      priority:  70, detect: t => / ; .+ \/ /.test(t),                                                   parse: parseAuthorLib },
  { format: 'harvard',         priority:  60, detect: t => /(19|20)\d{2}, '/.test(t),                                             parse: parseHarvard },
  { format: 'vancouver_ama',   priority:  50, detect: t => /\d+\(\d+\):\d+/.test(t),                                             parse: parseVancouverAMA },
  { format: 'acm_acl',         priority:  40, detect: t => /\. (?:19|20)\d{2}\. .+\./.test(t),                                   parse: parseACMACL },
  { format: 'springer_nature', priority:  30, detect: t => /\bet al\./.test(t) && /\((?:19|20)\d{2}\)/.test(t),                  parse: parseSpringerNature },
  { format: 'springer_apa',    priority:  20, detect: t => / & [A-Z][a-z]+, [A-Z]/.test(t) && /\((?:19|20)\d{2}\)/.test(t),     parse: parseSpringerAPA },
  { format: 'elsevier',        priority:  10, detect: t => /\bVolume \d+/.test(t) || /\bISSN\b/.test(t),                         parse: parseElsevier },
]

// Immutable sorted view — highest priority wins; DETECTORS itself is never mutated.
const SORTED_DETECTORS = [...DETECTORS].sort((a, b) => b.priority - a.priority)

export function detectFormat(text: string): CiteFormat {
  return SORTED_DETECTORS.find(d => d.detect(text))?.format ?? 'unknown'
}

export function parseByFormat(raw: string, fmt: CiteFormat): ParsedFields {
  return (SORTED_DETECTORS.find(d => d.format === fmt) ?? { parse: parseUnknown }).parse(raw)
}
