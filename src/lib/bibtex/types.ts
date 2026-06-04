export type CitationStyle =
  | 'classic'
  | 'ieee'
  | 'apa'
  | 'acm'
  | 'nature'
  | 'springer'
  | 'mla'
  | 'chicago'
  | 'harvard'

export interface Author {
  family: string
  given:  string
  suffix?: string   // Jr., Sr., III, PhD, etc. — raw, no transformation
  isOrg?: boolean  // true when wrapped in {braces}
}

export interface NormalizedEntry {
  type:       'article' | 'inproceedings' | 'book' | 'misc'
  key:        string
  title:      string
  authors:    Author[]
  year:       string
  journal?:   string   // raw BibTeX 'journal' field
  booktitle?: string   // raw BibTeX 'booktitle' field
  volume?:    string
  number?:    string
  pages?:     string   // "--" normalized to "–"
  doi?:       string
  publisher?: string
  address?:   string
  edition?:   string
  url?:       string
  note?:      string
}
