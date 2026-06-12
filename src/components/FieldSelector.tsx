import type { FieldSelection } from '../parseCitation'

const FIELD_CATEGORIES: Array<{
  title: string
  items: Array<[keyof FieldSelection, string]>
}> = [
  {
    title: '基本情報',
    items: [
      ['citationKey', 'Citation Key'],
      ['author', 'Author'],
      ['title', 'Title'],
      ['journalOrBooktitle', 'Journal / Booktitle'],
      ['year', 'Year'],
      ['volume', 'Volume'],
      ['number', 'Number'],
      ['pages', 'Pages'],
    ],
  },
  {
    title: '出版情報',
    items: [
      ['publisher', 'Publisher'],
      ['editor', 'Editor'],
      ['school', 'School'],
      ['institution', 'Institution'],
    ],
  },
  {
    title: '追加情報',
    items: [
      ['doi', 'DOI'],
      ['url', 'URL'],
      ['abstract', 'Abstract'],
      ['keywords', 'Keywords'],
    ],
  },
]

export default function FieldSelector({
  sel,
  onToggle,
}: {
  sel: FieldSelection
  onToggle: (key: keyof FieldSelection) => void
}) {
  return (
    <div className="field-selector">
      <div className="field-selector-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        表示項目
      </div>
      <div className="field-categories">
        {FIELD_CATEGORIES.map(cat => (
          <div key={cat.title} className="field-category">
            <div className="field-category-title">{cat.title}</div>
            <div className="field-grid">
              {cat.items.map(([key, label]) => (
                <label key={key} className="field-item">
                  <input
                    type="checkbox"
                    checked={sel[key]}
                    onChange={() => onToggle(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
