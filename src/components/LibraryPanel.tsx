import { useState } from 'react'
import type { LibraryEntry } from '../lib/library/types'

interface Props {
  entries: LibraryEntry[]
  onRemove: (key: string) => void
  onClear: () => void
  onDownloadAll: () => void
}

function entryPreview(e: LibraryEntry): string {
  const author = e.raw.match(/\bauthor\s*=\s*[{"]([^}"]+)/)?.[1]
    ?.split(' and ')[0]?.trim() ?? ''
  const year = e.raw.match(/\byear\s*=\s*[{"](\d{4})/)?.[1] ?? ''
  return [author, year].filter(Boolean).join(' · ')
}

export default function LibraryPanel({ entries, onRemove, onClear, onDownloadAll }: Props) {
  const [open, setOpen] = useState(true)

  return (
    <div className="library-panel">
      <div className="library-header" onClick={() => setOpen(o => !o)}>
        <span className="library-header-title">
          <span className="library-toggle-icon">{open ? '▼' : '▶'}</span>
          Library
          <span className="library-count">{entries.length}</span>
        </span>
        <div className="library-actions" onClick={e => e.stopPropagation()}>
          <button
            className="lib-action-btn"
            onClick={onDownloadAll}
            disabled={entries.length === 0}
            title="Download all as .bib"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download All
          </button>
          <button
            className="lib-action-btn lib-action-danger"
            onClick={onClear}
            disabled={entries.length === 0}
            title="Clear all entries"
          >
            Clear All
          </button>
        </div>
      </div>

      {open && (
        <div className="library-list">
          {entries.length === 0 ? (
            <div className="library-empty">Library is empty — convert to BibTeX and click "+ Add to Library"</div>
          ) : (
            entries.map(e => (
              <div key={e.key} className="library-item">
                <span className="lib-type">@{e.type.toLowerCase()}</span>
                <span className="lib-key">{e.key}</span>
                <span className="lib-preview">{entryPreview(e)}</span>
                <button className="lib-remove" onClick={() => onRemove(e.key)} title="Remove">×</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
