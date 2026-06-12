// ── Types ──────────────────────────────────────────────────────────────────────

import type { BibEntryType } from './lib/citation/types'

export interface CitationData {
  title: string
  authors: string[]
  journal: string
  year: string
  volume: string
  number: string
  pages: string
  doi: string
  publisher: string
  url: string
}

// ── DOI extraction from URL string ────────────────────────────────────────────

export function extractDOIFromURL(url: string): string | null {
  const s = url.trim()

  // https://doi.org/10.xxx or https://dx.doi.org/10.xxx
  const m1 = s.match(/(?:https?:\/\/)?(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^\s?&#]+)/i)
  if (m1) return decodeURIComponent(m1[1]).replace(/[./,;]+$/, '')

  // DOI in URL path: /10.xxxx/yyyy  (e.g. link.springer.com/article/10.xxx/yyy)
  const m2 = s.match(/\/(10\.\d{4,}\/[^\s?&#/][^\s?&#]*)/)
  if (m2) return m2[1].replace(/[./,;]+$/, '')

  // Raw DOI entered directly
  const m3 = s.match(/^(10\.\d{4,}\/\S+)/)
  if (m3) return m3[1].replace(/[./,;]+$/, '')

  return null
}

// ── HTML meta-tag DOI extraction ──────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseMetaContent(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const re1 = new RegExp(
      `<meta[^>]+(?:name|property)=["']${escapeRe(name)}["'][^>]+content=["']([^"']+)["']`, 'i',
    )
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapeRe(name)}["']`, 'i',
    )
    const m = html.match(re1) ?? html.match(re2)
    if (m) return m[1].trim()
  }
  return null
}

function extractDOIFromHTML(html: string): string | null {
  // citation_doi — IEEE, ScienceDirect, Springer, most academic publishers
  const cit = parseMetaContent(html, 'citation_doi')
  if (cit && /^10\./.test(cit)) return cit.replace(/[./,;]+$/, '')

  // prism.doi — Elsevier journals
  const prism = parseMetaContent(html, 'prism.doi')
  if (prism && /^10\./.test(prism)) return prism.replace(/[./,;]+$/, '')

  // DC.Identifier — Dublin Core, value may be prefixed "doi:10.xxx"
  const dc = parseMetaContent(html, 'DC.Identifier', 'dc.identifier')
  if (dc) {
    const stripped = dc.replace(/^doi:\s*/i, '')
    if (/^10\./.test(stripped)) return stripped.replace(/[./,;]+$/, '')
  }

  // og:url pointing to doi.org
  const ogUrl = parseMetaContent(html, 'og:url')
  if (ogUrl) {
    const doi = extractDOIFromURL(ogUrl)
    if (doi) return doi
  }

  return null
}

const FETCH_TIMEOUT_MS = 15_000

function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

async function tryFetchHTML(url: string): Promise<string | null> {
  // Direct fetch (works only if site sends CORS headers — unlikely for most publishers)
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'text/html,application/xhtml+xml' } })
    if (res.ok) {
      console.log('[fetchDOI] direct fetch succeeded')
      return await res.text()
    }
  } catch { /* CORS blocked or timed out */ }

  // corsproxy.io
  try {
    const res = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(url)}`)
    if (res.ok) {
      console.log('[fetchDOI] corsproxy.io succeeded')
      return await res.text()
    }
  } catch { /* proxy unavailable or timed out */ }

  // allorigins.win (returns JSON envelope)
  try {
    const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const json = await res.json() as { contents?: string }
      if (json.contents) {
        console.log('[fetchDOI] allorigins.win succeeded')
        return json.contents
      }
    }
  } catch { /* proxy unavailable or timed out */ }

  console.log('[fetchDOI] all fetch attempts blocked/failed for:', url)
  return null
}

// Async DOI resolution: URL string regex first, then HTML meta-tag fallback
export async function resolveDOIFromURL(url: string): Promise<string> {
  const fromUrl = extractDOIFromURL(url)
  if (fromUrl) {
    console.log('[fetchDOI] DOI from URL string:', fromUrl)
    return fromUrl
  }

  console.log('[fetchDOI] No DOI in URL string, fetching page meta tags:', url)
  const html = await tryFetchHTML(url)

  if (html) {
    const doi = extractDOIFromHTML(html)
    if (doi) {
      console.log('[fetchDOI] DOI from meta tags:', doi)
      return doi
    }
    console.log('[fetchDOI] Page fetched but no DOI meta tag found')
  }

  throw new Error(
    'URLから DOI を取得できませんでした\n' +
    '一部サイトでは取得が制限されます。\n' +
    'DOI が分かる場合は、直接入力してください\n' +
    '例：10.xxxx/xxxxx',
  )
}

// ── Crossref fetch ─────────────────────────────────────────────────────────────

export async function fetchByDOI(rawDOI: string): Promise<CitationData> {
  let doi = rawDOI.trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim()
    .replace(/[./,;]+$/, '')

  if (!/^10\.\d{4,}\//.test(doi)) {
    throw new Error('Invalid DOI format. Expected format: 10.XXXX/YYYY')
  }

  let res: Response
  try {
    res = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { headers: { Accept: 'application/json' } },
    )
  } catch {
    throw new Error('Network error. Please check your internet connection and try again.')
  }

  if (res.status === 404) throw new Error('DOI not found. Please verify the DOI and try again.')
  if (!res.ok) throw new Error(`Unable to fetch citation data (HTTP ${res.status}).`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json()
  if (!json?.message) throw new Error('Unexpected response from Crossref.')
  return parseCrossref(json.message)
}

// ── Crossref response → CitationData ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCrossref(msg: any): CitationData {
  const title = (msg.title as string[] | undefined)?.[0]?.trim() ?? ''

  const authors: string[] = (
    (msg.author ?? []) as Array<{ family?: string; given?: string; name?: string }>
  )
    .map(a => {
      if (a.name) return a.name.trim()
      const given = a.given ? ` ${a.given.charAt(0)}.` : ''
      return `${a.family ?? ''}${given}`.trim()
    })
    .filter(Boolean)

  const containers = msg['container-title'] as string[] | undefined
  const journal = containers?.[0]?.trim() ?? ''

  const pub = msg['published-print'] ?? msg['published-online'] ?? msg.published
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const year: string = ((pub as any)?.['date-parts']?.[0]?.[0] ?? '').toString()

  const doi = ((msg.DOI ?? '') as string).trim()

  return {
    title,
    authors,
    journal,
    year,
    volume:    ((msg.volume    ?? '') as string).trim(),
    number:    ((msg.issue     ?? '') as string).trim(),
    pages:     ((msg.page      ?? '') as string).replace(/--/, '–').trim(),
    doi,
    publisher: ((msg.publisher ?? '') as string).trim(),
    url:       doi ? `https://doi.org/${doi}` : '',
  }
}

// ── CitationData → full BibTeX (pipe into convert()) ──────────────────────────

export function citationDataToBib(data: CitationData, entryType: BibEntryType = 'ARTICLE'): string {
  const author = data.authors.join(' and ')
  const last   = data.doi.split('/').pop() ?? ''
  const key    = last.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14)
    || `${(data.title.split(/\s+/)[0] ?? 'cite').replace(/[^a-zA-Z]/g, '')}${data.year || 'XXXX'}`

  const lines = [
    `@${entryType.toLowerCase()}{${key},`,
    `  author={${author}},`,
    `  title={${data.title}},`,
    `  journal={${data.journal}},`,
    `  year={${data.year}},`,
    `  volume={${data.volume}},`,
    `  number={${data.number}},`,
    `  pages={${data.pages}},`,
    `  doi={${data.doi}},`,
    `  publisher={${data.publisher}},`,
    `  url={${data.url}}`,
    `}`,
  ]
  return lines.join('\n')
}
