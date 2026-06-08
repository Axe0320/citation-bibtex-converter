import { extractDOI, extractTitle, extractJournal, extractAuthor } from './helpers'
import type { ParsedFields } from './types'

export function parseIEEE(raw: string): ParsedFields {
  // Author: "F. Lastname, F. Lastname, ..., and F. Lastname," before quoted title
  const authorM =
    raw.match(/^((?:[A-Z]\. [\w'-]+(?:,\s+)?)+\s*and [A-Z]\. [\w'-]+),\s*"/) ??
    raw.match(/^((?:[A-Z]\. [\w'-]+,?\s*)+),\s*"/)
  const author = authorM ? authorM[1].trim() : ''

  // Title: text inside the first pair of ASCII double quotes
  const titleM  = raw.match(/"([^"]+)"/)
  // IEEE source has "Title," — strip trailing comma inside quotes
  const title   = titleM ? titleM[1].trim().replace(/,\s*$/, '') : ''

  // Journal article: "in Journal, vol." | Conference: "Title," YEAR Name (ABBREV), City
  const journalM = raw.match(/\bin\s+(.+?),\s*vol\./i)
               ?? raw.match(/"[^"]+,?"\s+(\d{4}\s+.+?\([A-Z\w]+\)),\s*[A-Z]/)

  return {
    author,
    title,
    journal: journalM ? journalM[1].trim() : '',
    year:    (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:  (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:   (raw.match(/\bpp\.?\s*([\d\-–]+)/i) ?? [])[1] ?? '',
    doi:     extractDOI(raw),
  }
}

export function parseMDPI(raw: string): ParsedFields {
  // Authors: "Lastname, F.; Lastname2, F.; LastnameN, F." (semicolon-separated)
  const authorM = raw.match(/^([\w-]+, [A-Z]\.(?:\w\.)?(?:; [\w-]+, [A-Z]\.(?:\w\.)?)*)\s+[A-Z]/)
  const authorRaw = authorM ? authorM[1] : ''
  const author    = authorRaw.replace(/;\s*/g, ' and ')

  // After author block: "Title. Journal Year, Vol, PageOrArticle."
  const afterAuth = authorRaw ? raw.slice(authorRaw.length).trim() : raw
  const m = afterAuth.match(/^(.+?)\.\s+(.+?)\s+((?:19|20)\d{2}),\s*(\d+),\s*(\d+)/)

  return {
    author,
    title:   m ? m[1].trim() : '',
    journal: m ? m[2].trim() : '',
    year:    m ? m[3] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  m ? m[4] : '',
    number:  '',
    pages:   m ? m[5] : '',
    doi:     extractDOI(raw),
  }
}

export function parseSpringerNature(raw: string): ParsedFields {
  // Authors: everything up to and including "et al."
  const authorM = raw.match(/^(.+?\bet al\.)\s+/)
  const author  = authorM ? authorM[1].trim() : ''
  const rest    = author ? raw.slice(authorM![0].length) : raw

  // "Title. Journal Vol, PagesOrArticle (Year)."
  const m = rest.match(/^(.+?)\.\s+(.+?)\s+(\d+),\s*([\d–\-]+)\s*\(((?:19|20)\d{2})\)/)

  return {
    author,
    title:   m ? m[1].trim() : '',
    journal: m ? m[2].trim() : '',
    year:    m ? m[5] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  m ? m[3] : '',
    number:  '',
    pages:   m ? m[4] : '',
    doi:     extractDOI(raw),
  }
}

export function parseSpringerAPA(raw: string): ParsedFields {
  // Authors: "Lastname, F., Lastname2, F. & LastnameN, F."
  // Block ends at "& Lastname, F." followed by space + uppercase title start
  const authorM = raw.match(/^(.+?& [\w-]+, [A-Z]\.(?:[A-Z]\.)?)\s+[A-Z]/)
  const author  = authorM ? authorM[1].trim() : ''
  const rest    = author ? raw.slice(author.length).trim() : raw

  // "Title. Journal Vol, Pages (Year)."
  const m = rest.match(/^(.+?)\.\s+(.+?)\s+(\d+),\s*([\d–\-]+)\s*\(((?:19|20)\d{2})\)/)

  return {
    author,
    title:   m ? m[1].trim() : '',
    journal: m ? m[2].trim() : '',
    year:    m ? m[5] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  m ? m[3] : '',
    number:  '',
    pages:   m ? m[4] : '',
    doi:     extractDOI(raw),
  }
}

export function parseAPA(raw: string): ParsedFields {
  // "Lastname, F., ..., & LastnameN, F. (Year). Title. Journal, Vol(Issue), PageOrArticle."
  const yM     = raw.match(/\(((?:19|20)\d{2})\)\./)
  const year   = yM ? yM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''
  const author = yM ? raw.slice(0, yM.index!).trim().replace(/[.,]\s*$/, '') : ''
  const after  = yM ? raw.slice(yM.index! + yM[0].length).trim() : raw

  // Title: first sentence (up to ". JournalStart")
  const tM    = after.match(/^(.+?)\.\s+([A-Z])/)
  const title = tM ? tM[1].trim() : ''
  const rest  = tM ? after.slice(tM[0].length - tM[2].length) : after

  // Journal: text up to the first comma
  const jM      = rest.match(/^([^,]+)/)
  const journal = jM ? jM[1].trim() : ''

  // Volume and number from "57(4)" or fallback to first number after comma
  const volNumM = rest.match(/,\s*(\d+)\((\d+)\)/)
  const volM    = volNumM ? null : rest.match(/,\s*(\d+),/)
  const volume  = volNumM ? volNumM[1] : (volM ? volM[1] : '')
  const number  = volNumM ? volNumM[2] : ''

  // Pages / article number: last number before end of string
  const pM    = rest.match(/,\s*([\d]+)\.?\s*$/)
  const pages = pM ? pM[1] : ''

  return { author, title, journal, year, volume, number, pages, doi: extractDOI(raw) }
}

export function parseHarvard(raw: string): ParsedFields {
  // "Lastname, F, ..., & LastnameN, F Year, 'Title', Journal, vol. V, no. N, Article."
  const yM      = raw.match(/\b((19|20)\d{2}),\s*'/)
  const year    = yM ? yM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''
  const author  = yM ? raw.slice(0, yM.index!).trim().replace(/[,\s]+$/, '') : ''

  const tM      = raw.match(/'([^']+)'/)
  const title   = tM ? tM[1].trim() : ''

  const after   = tM ? raw.slice(raw.indexOf(tM[0]) + tM[0].length) : ''
  const jM      = after.match(/^,\s*([^,]+)/)

  return {
    author,
    title,
    journal:  jM ? jM[1].trim() : '',
    year,
    volume:   (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:   (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:    '',
    doi:      extractDOI(raw),
  }
}

export function parseVancouverAMA(raw: string): ParsedFields {
  // Vancouver: "Lastname F, Lastname2 D. Title. Journal. Year Mon;Vol(Issue):Pages."
  // AMA:       "Lastname F, Lastname2 F. Title. Journal. Year; Vol(Issue):Pages."
  // Both split cleanly by ". " into [authors, title, journal, year/vol info]
  const parts   = raw.split(/\.\s+/)
  const author  = parts[0]?.trim() ?? ''
  const title   = parts[1]?.trim() ?? ''
  const journal = parts[2]?.trim() ?? ''

  const yearM   = (parts[3] ?? '').match(/^((19|20)\d{2})/)
  const year    = yearM ? yearM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''

  const vipM    = raw.match(/(\d+)\((\d+)\):(\d+)/)

  return {
    author,
    title,
    journal,
    year,
    volume:   vipM ? vipM[1] : '',
    number:   vipM ? vipM[2] : '',
    pages:    vipM ? vipM[3] : '',
    doi:      extractDOI(raw),
  }
}

export function parseAuthorLib(raw: string): ParsedFields {
  // "Lastname, Firstname ; Lastname2, Firstname2 ; ... et al. / Title : Subtitle. In: Journal. Year ; Vol. V, No. N."
  const slashIdx = raw.indexOf(' / ')
  const author   = slashIdx >= 0
    ? raw.slice(0, slashIdx).replace(/\s*;\s*/g, ' and ').trim()
    : ''

  const rest    = slashIdx >= 0 ? raw.slice(slashIdx + 3) : raw
  const tM      = rest.match(/^(.+?)\.\s+In:/)
  const title   = tM ? tM[1].replace(/ : /g, ': ').trim() : ''
  const jM      = rest.match(/\bIn:\s+(.+?)\./)

  return {
    author,
    title,
    journal:  jM ? jM[1].trim() : '',
    year:     (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:   (raw.match(/\bVol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:   (raw.match(/\bNo\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:    '',
    doi:      extractDOI(raw),
  }
}

export function parseACMACL(raw: string): ParsedFields {
  // Handles: ACM/ACL conference, ACM journal, Chicago (quoted title)
  // Common anchor: "Lastname. Year. ..."
  const authorM = raw.match(/^(.+?)\.\s+((?:19|20)\d{2})\./)
  const author  = authorM ? authorM[1].trim() : ''
  const year    = authorM ? authorM[2] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? ''

  const afterYear = authorM ? raw.slice(authorM.index! + authorM[0].length) : raw
  const isConf    = /\bIn\s/.test(afterYear)

  let title = '', journal = ''

  if (isConf) {
    const tM = raw.match(/\.\s+(?:19|20)\d{2}\.\s+(.+?)\.\s+In\s/)
    title = tM ? tM[1].trim() : ''
    // Stop at "(CONF YEAR)" or ", pages"
    const btM = raw.match(/\bIn\s+(.+?)(?:\s*\([A-Z][\w -]*20\d{2}\)|,\s*pages?)/)
    journal = btM ? btM[1].trim() : ''
  } else {
    // Chicago: title is in double quotes
    const quotedTM = raw.match(/\.\s+(?:19|20)\d{2}\.\s+"([^"]+)"/)
    if (quotedTM) {
      title = quotedTM[1].trim()
      // Journal: first capitalised word-sequence before the volume number
      const jM = raw.match(/"[^"]+"\s+([A-Z][^,\d]+?)\s+\d+/)
      journal = jM ? jM[1].trim() : ''
    } else {
      // ACM journal: "Title. Journal Vol, ..."
      const tM = raw.match(/\.\s+(?:19|20)\d{2}\.\s+(.+?)\.\s+[A-Z]/)
      title = tM ? tM[1].trim() : ''
      const jM = raw.match(/(?:19|20)\d{2}\.\s+.+?\.\s+(.+?)\s+\d+,/)
      journal = jM ? jM[1].trim() : ''
    }
  }

  const pagesM =
    raw.match(/\bpages?\s+([\d–\-]+)/) ??
    raw.match(/,\s*([\d]+[–\-][\d]+)\.?\s*(?:https?|$)/) ??
    raw.match(/USA,\s*([\d]+[–\-][\d]+)/) ??
    raw.match(/([\d]+[–\-][\d]+)/)
  const pages = pagesM ? pagesM[1] : ''

  return { author, title, journal, year, volume: '', number: '', pages, doi: extractDOI(raw) }
}

export function parseElsevier(raw: string): ParsedFields {
  // "Firstname Lastname, Firstname Lastname, ..., Title, Journal, Volume N, Year, Article, ISSN..."
  // Author segments match "Firstname Lastname" (two capitalised words)
  const segments  = raw.split(/,\s*/)
  const nameRe    = /^[A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+$/
  let lastAuthorIdx = -1
  for (let i = 0; i < segments.length; i++) {
    if (nameRe.test(segments[i].trim())) lastAuthorIdx = i
    else if (lastAuthorIdx >= 0) break
  }

  const author  = segments.slice(0, lastAuthorIdx + 1).join(', ')
  const rest    = segments.slice(lastAuthorIdx + 1)
  const title   = rest[0]?.trim() ?? ''
  // Journal: segment after title, stripping any "Volume …" tail
  const journal = (rest[1] ?? '').replace(/\s*Volume.*/i, '').trim()

  const volM    = raw.match(/\bVolume\s+(\d+)/i)
  const yearM   = raw.match(/\bVolume\s+\d+,\s*((?:19|20)\d{2})/i)
  const artM    = raw.match(/\bVolume\s+\d+,\s*(?:19|20)\d{2},\s*(\d+)/)

  return {
    author,
    title,
    journal,
    year:   yearM ? yearM[1] : (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume: volM  ? volM[1]  : '',
    number: '',
    pages:  artM  ? artM[1]  : '',
    doi:    extractDOI(raw),
  }
}

export function parseUnknown(raw: string): ParsedFields {
  return {
    author:  extractAuthor(raw),
    title:   extractTitle(raw),
    journal: extractJournal(raw),
    year:    (raw.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? '',
    volume:  (raw.match(/\bvol\.?\s*(\d+)/i) ?? [])[1] ?? '',
    number:  (raw.match(/\bno\.?\s*(\d+)/i) ?? [])[1] ?? '',
    pages:   (raw.match(/\bpp\.?\s*([\d\-–]+)/i) ?? [])[1] ?? '',
    doi:     extractDOI(raw),
  }
}
