import { extractDOI } from '../helpers'
import type { ParsedFields } from '../types'

// ── Japanese citation parsers ──────────────────────────────────────────────────

function extractJaTitle(raw: string): string {
  return (raw.match(/「([^」]+)」/) ?? raw.match(/"([^"]+)"/))?.[1]?.trim() ?? ''
}

// All authors joined as "A and B and C" (BibTeX multi-author syntax)
function extractJaAuthor(raw: string): string {
  const titleBoundary = raw.search(/[「"]/)
  const block = titleBoundary > 0 ? raw.slice(0, titleBoundary) : raw.split(/[，。]/)[0]
  const cleaned = block.replace(/^\s*\[?\d+\]\.?\s*/, '').trim()
  return cleaned
    .split(/[・，]/)
    .map(a => a.trim())
    .filter(Boolean)
    .join(' and ')
}

function extractJaVol(raw: string): string {
  return (raw.match(/第\s*(\d+)\s*巻/) ?? raw.match(/vol\.?\s*(\d+)/i))?.[1] ?? ''
}

function extractJaNo(raw: string): string {
  return (raw.match(/第\s*(\d+)\s*号/) ?? raw.match(/no\.?\s*(\d+)/i))?.[1] ?? ''
}

function extractJaYear(raw: string): string {
  return (raw.match(/(\d{4})年/) ?? raw.match(/[（(](\d{4})[）)]/))?.[1] ?? ''
}

function extractJaPages(raw: string): string {
  const m = raw.match(/pp\.?\s*([\d\-–\/]+)/i)
  if (m) return m[1].replace('/', '–')
  return ''
}

function extractJaJournal(raw: string, titleEnd: number): string {
  if (titleEnd < 0) return ''
  // Closing bracket of title: find end of 「...」 or "..."
  const closeIdx = raw.indexOf('」', titleEnd)
  const closeIdx2 = raw.indexOf('"', titleEnd)
  const afterTitle = closeIdx >= 0
    ? raw.slice(closeIdx + 1)
    : closeIdx2 >= 0 ? raw.slice(closeIdx2 + 1) : ''
  // Journal is the first non-empty token after the title delimiter
  return afterTitle.split(/[，、,]/).map(s => s.trim()).find(Boolean) ?? ''
}

// ja_ipsj: 田中太郎，山田花子，"タイトル"，誌名，vol.X, no.X, pp.X–X, 2024.
export function parseJaIPSJ(raw: string): ParsedFields {
  const titleStart = raw.search(/[「"]/)
  return {
    author:  extractJaAuthor(raw),
    title:   extractJaTitle(raw),
    journal: extractJaJournal(raw, titleStart),
    year:    (extractJaYear(raw) || (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0]) ?? '',
    volume:  extractJaVol(raw),
    number:  extractJaNo(raw),
    pages:   extractJaPages(raw),
    doi:     extractDOI(raw),
  }
}

// ja_ieice: 著者・著者：タイトル，誌名，vol.X, no.X, pp.X–X (2024)
export function parseJaIEICE(raw: string): ParsedFields {
  const colonIdx = raw.indexOf('：')
  let author = ''
  let titleRaw = raw
  if (colonIdx > 0) {
    const authorBlock = raw.slice(0, colonIdx)
    author = authorBlock.split(/[・，]/).map(a => a.trim()).filter(Boolean).join(' and ')
    titleRaw = raw.slice(colonIdx + 1).trim()
  }
  const title   = titleRaw.split(/[，、,]/)[0]?.trim() ?? ''
  const journal = titleRaw.split(/[，、,]/)[1]?.trim() ?? ''
  return {
    author,
    title,
    journal,
    year:   (extractJaYear(raw) || (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0]) ?? '',
    volume: extractJaVol(raw),
    number: extractJaNo(raw),
    pages:  extractJaPages(raw),
    doi:    extractDOI(raw),
  }
}

// ja_numbered: [1] 著者名，「タイトル」，誌名，… → strips leading number and delegates
export function parseJaNumbered(raw: string): ParsedFields {
  const stripped = raw.replace(/^\s*\[?\d+\]\.?\s*/, '')
  return parseJaIPSJ(stripped)
}

// ja_generic: best-effort extraction for any Japanese-character citation
export function parseJaGeneric(raw: string): ParsedFields {
  return {
    author:  extractJaAuthor(raw),
    title:   extractJaTitle(raw),
    journal: '',
    year:    (extractJaYear(raw) || (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0]) ?? '',
    volume:  extractJaVol(raw),
    number:  extractJaNo(raw),
    pages:   extractJaPages(raw),
    doi:     extractDOI(raw),
  }
}
