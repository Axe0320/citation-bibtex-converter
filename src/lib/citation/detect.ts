import type { ParsedFields, CiteFormat } from './types'
import {
  parseIEEE, parseMDPI, parseAPA, parseHarvard, parseVancouverAMA,
  parseAuthorLib, parseACMACL, parseSpringerNature, parseSpringerAPA,
  parseElsevier, parseUnknown,
} from './parsers'

interface Detector {
  format: CiteFormat
  detect: (t: string) => boolean
  parse:  (raw: string) => ParsedFields
}

// ORDER MATTERS: order must match legacy detectFormat() if-chain exactly.
const DETECTORS: Detector[] = [
  { format: 'ieee',            detect: t => /^[A-Z]\. \w/.test(t) && /"/.test(t),                                       parse: parseIEEE },
  { format: 'mdpi',            detect: t => /^[\w-]+, [A-Z]\.;/.test(t),                                                parse: parseMDPI },
  { format: 'apa',             detect: t => /\((?:19|20)\d{2}\)\. [A-Z]/.test(t),                                       parse: parseAPA },
  { format: 'author_lib',      detect: t => / ; .+ \/ /.test(t),                                                        parse: parseAuthorLib },
  { format: 'harvard',         detect: t => /(19|20)\d{2}, '/.test(t),                                                  parse: parseHarvard },
  { format: 'vancouver_ama',   detect: t => /\d+\(\d+\):\d+/.test(t),                                                  parse: parseVancouverAMA },
  { format: 'acm_acl',         detect: t => /\. (?:19|20)\d{2}\. .+\./.test(t),                                        parse: parseACMACL },
  { format: 'springer_nature', detect: t => /\bet al\./.test(t) && /\((?:19|20)\d{2}\)/.test(t),                       parse: parseSpringerNature },
  { format: 'springer_apa',    detect: t => / & [A-Z][a-z]+, [A-Z]/.test(t) && /\((?:19|20)\d{2}\)/.test(t),          parse: parseSpringerAPA },
  { format: 'elsevier',        detect: t => /\bVolume \d+/.test(t) || /\bISSN\b/.test(t),                              parse: parseElsevier },
]

export function detectFormat(text: string): CiteFormat {
  return DETECTORS.find(d => d.detect(text))?.format ?? 'unknown'
}

export function parseByFormat(raw: string, fmt: CiteFormat): ParsedFields {
  return (DETECTORS.find(d => d.format === fmt) ?? { parse: parseUnknown }).parse(raw)
}
