export type DataType = 'txt' | 'bib'

export interface FieldSelection {
  citationKey: boolean
  author: boolean
  title: boolean
  journalOrBooktitle: boolean
  year: boolean
  volume: boolean
  number: boolean
  pages: boolean
  publisher: boolean
  editor: boolean
  school: boolean
  institution: boolean
  doi: boolean
  url: boolean
  abstract: boolean
  keywords: boolean
}

export const DEFAULT_FIELDS: FieldSelection = {
  citationKey: false,
  author: true,
  title: true,
  journalOrBooktitle: true,
  year: true,
  volume: true,
  number: true,
  pages: true,
  publisher: false,
  editor: false,
  school: false,
  institution: false,
  doi: false,
  url: false,
  abstract: false,
  keywords: false,
}

export interface ValidationWarning {
  level: 'warn' | 'info'
  message: string
}

export interface ParseResult {
  ok: boolean
  output?: string
  error?: string
  warnings?: ValidationWarning[]
}

export interface ParsedFields {
  author:  string
  title:   string
  journal: string
  year:    string
  volume:  string
  number:  string
  pages:   string
  doi:     string
}

export type CiteFormat =
  | 'ieee'
  | 'mdpi'
  | 'apa'
  | 'harvard'
  | 'vancouver_ama'
  | 'author_lib'
  | 'springer_nature'
  | 'springer_apa'
  | 'acm_acl'
  | 'elsevier'
  | 'ja_ipsj'
  | 'ja_ieice'
  | 'ja_numbered'
  | 'ja_generic'
  | 'unknown'

export type BibEntryType =
  | 'ARTICLE'
  | 'INPROCEEDINGS'
  | 'INCOLLECTION'
  | 'BOOK'
  | 'MISC'
  | 'PHDTHESIS'
  | 'MASTERSTHESIS'
  | 'TECHREPORT'
