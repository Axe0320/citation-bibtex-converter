import { useState, useCallback, useEffect, useRef } from 'react'
import {
  convert, convertBatch, isBatch, detectInputMode, DEFAULT_FIELDS, extractDOI,
  type DataType, type FieldSelection, type ValidationWarning, type BibEntryType, type BatchSummary,
} from './parseCitation'
import { fetchByDOI, resolveDOIFromURL, citationDataToBib } from './fetchCitation'
import { formatBibTeX } from './lib/bibtex/bibToTxt'
import { splitCitations } from './lib/citation/splitCitations'
import type { CitationStyle } from './lib/bibtex/types'

// ── Types ──────────────────────────────────────────────────────────────────────

type InputSource = 'text' | 'doi' | 'url' | 'file'

// ── Helpers ────────────────────────────────────────────────────────────────────

const INPUT_PLACEHOLDER: Record<DataType, string> = {
  txt: 'Paste citation text here...\n\nExample:\nAuthor, "Paper Title," Journal Name, vol. X, no. X, pp. X–X, Year, doi: XXXX',
  bib: 'Paste BibTeX here...\n\nExample:\n@article{key,\n  title={Paper Title},\n  author={Author Name},\n  journal={Journal Name},\n  year={2024}\n}',
}
const OUTPUT_PLACEHOLDER: Record<DataType, string> = {
  txt: 'Citation text output will appear here...',
  bib: 'BibTeX output will appear here...',
}
const CONVERT_LABEL: Record<`${DataType}-${DataType}`, string> = {
  'txt-bib': 'Convert to BibTeX',
  'bib-txt': 'Convert to TXT',
  'bib-bib': 'Filter BibTeX',
  'txt-txt': 'Filter Citation',
}
const INPUT_LABEL: Record<DataType, string> = { txt: 'Input — TXT Citation', bib: 'Input — BibTeX' }
const OUTPUT_LABEL: Record<DataType, string> = { txt: 'Output — TXT Citation', bib: 'Output — BibTeX' }

// ── FieldSelector component ────────────────────────────────────────────────────

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

function FieldSelector({
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

function getBatchSeparator(outputType: DataType, style: CitationStyle): string {
  if (outputType === 'bib') return '\n\n'
  if (style === 'pandoc')   return '\n\n'
  return '\n\n---\n\n'
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [inputSource, setInputSource]   = useState<InputSource>('text')
  const [inputType, setInputType]       = useState<DataType>('txt')
  const [outputType, setOutputType]     = useState<DataType>('bib')
  const [manualInput, setManualInput]   = useState(false)
  const [input, setInput]               = useState('')
  const [doiInput, setDoiInput]         = useState('')
  const [urlInput, setUrlInput]         = useState('')
  const [output, setOutput]             = useState('')
  const [inputError, setInputError]     = useState('')
  const [convertError, setConvertError] = useState('')
  const [fetchError, setFetchError]     = useState('')
  const [warnings, setWarnings]         = useState<ValidationWarning[]>([])
  const [copied, setCopied]             = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [isDragOver, setIsDragOver]     = useState(false)
  const [fileName, setFileName]         = useState('')
  const [isFetching, setIsFetching]     = useState(false)
  const [fields, setFields]             = useState<FieldSelection>(DEFAULT_FIELDS)
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('classic')
  const [entryType, setEntryType]       = useState<BibEntryType | 'auto'>('auto')
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Toast auto-hide
  useEffect(() => {
    if (!toastVisible) return
    const t = setTimeout(() => setToastVisible(false), 2200)
    return () => clearTimeout(t)
  }, [toastVisible])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const clearErrors = useCallback(() => {
    setInputError('')
    setConvertError('')
    setFetchError('')
    setWarnings([])
  }, [])

  const handleSourceChange = useCallback((source: InputSource) => {
    setInputSource(source)
    setOutput('')
    clearErrors()
    setCopied(false)
    setEntryType('auto')
  }, [clearErrors])

  const handleInputChange = useCallback((value: string) => {
    setInput(value)
    clearErrors()
    setOutput('')
    setBatchSummary(null)
    if (!value.trim()) { setManualInput(false); setFileName(''); return }
    if (!manualInput) setInputType(detectInputMode(value))
  }, [manualInput, clearErrors])

  const handleTypeSwitch = useCallback((which: 'input' | 'output', type: DataType) => {
    if (which === 'input') { setInputType(type); setManualInput(true) }
    else setOutputType(type)
    setOutput('')
    clearErrors()
    setEntryType('auto')
  }, [clearErrors])

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = (e.target?.result as string) ?? ''
      setInput(content)
      setFileName(file.name)
      setOutput('')
      clearErrors()
      const detected = detectInputMode(content)
      setInputType(detected)
      setManualInput(false)
    }
    reader.readAsText(file, 'UTF-8')
  }, [clearErrors])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleConvert = useCallback(async () => {
    clearErrors()
    setCopied(false)

    // DOI-first: when Text input contains a DOI and target is BibTeX,
    // fetch from Crossref first for complete metadata, fall back to text parsing
    if (inputType === 'txt' && outputType === 'bib' && input.trim()) {
      const doi = extractDOI(input)
      if (doi) {
        setIsFetching(true)
        setOutput('')
        try {
          const data = await fetchByDOI(doi)
          const rawBib = citationDataToBib(data, entryType === 'auto' ? undefined : entryType)
          const result = convert(rawBib, 'bib', outputType, fields)
          if (!result.ok) setConvertError(result.error ?? '')
          else { setOutput(result.output ?? ''); setWarnings(result.warnings ?? []) }
          return
        } catch {
          // Crossref failed → fall through to format-specific text parser
        } finally {
          setIsFetching(false)
        }
      }
    }

    // Citation Style mode: bib→txt with non-classic style → formatBibTeX()
    // Classic: falls through to convert() below — regression zero guaranteed
    if (inputType === 'bib' && outputType === 'txt' && citationStyle !== 'classic') {
      const isMulti = inputSource !== 'doi' && inputSource !== 'url' && isBatch(input, inputType)
      if (isMulti) {
        const chunks = splitCitations(input, 'bib')
        const results = chunks.map(chunk => formatBibTeX(chunk.trim(), citationStyle, fields))
        const sep = getBatchSeparator(outputType, citationStyle)
        const out = results.map((r, i) =>
          r.ok ? (r.output ?? '') : `% [ERROR #${i + 1}] ${r.error ?? 'parse error'}`
        ).join(sep)
        setOutput(out)
        setWarnings([])
        setBatchSummary({
          successCount: results.filter(r => r.ok).length,
          errorCount:   results.filter(r => !r.ok).length,
        })
        return
      }
      const result = formatBibTeX(input.trim(), citationStyle, fields)
      if (!result.ok) {
        if (!input.trim()) setInputError(result.error ?? '')
        else setConvertError(result.error ?? '')
        setOutput('')
        return
      }
      setOutput(result.output ?? '')
      setWarnings(result.warnings ?? [])
      return
    }

    const opts = entryType === 'auto' ? undefined : { entryType }

    // Batch mode: text / file sources with multiple entries
    if (inputSource !== 'doi' && inputSource !== 'url' && isBatch(input, inputType)) {
      const { items, summary } = convertBatch(input, inputType, outputType, fields, opts)
      const sep = getBatchSeparator(outputType, citationStyle)
      const out = items.map(r =>
        r.ok ? (r.output ?? '') : `% [ERROR #${r.index + 1}] ${r.error ?? 'parse error'}`
      ).join(sep)
      setOutput(out)
      setWarnings([])
      setBatchSummary(summary)
      return
    }

    setBatchSummary(null)
    const result = convert(input, inputType, outputType, fields, opts)
    if (!result.ok) {
      if (!input.trim()) setInputError(result.error ?? '')
      else setConvertError(result.error ?? '')
      setOutput('')
      return
    }
    setOutput(result.output ?? '')
    setWarnings(result.warnings ?? [])
  }, [input, inputSource, inputType, outputType, citationStyle, fields, entryType, clearErrors])

  const handleFetch = useCallback(async () => {
    clearErrors()
    setCopied(false)

    let rawInput = ''
    if (inputSource === 'doi') {
      rawInput = doiInput.trim()
      if (!rawInput) { setFetchError('DOIを入力してください。'); return }
    } else if (inputSource === 'url') {
      rawInput = urlInput.trim()
      if (!rawInput) { setFetchError('URLを入力してください。'); return }
    }
    if (!rawInput) return

    setIsFetching(true)
    setOutput('')

    try {
      // URL mode: async DOI resolution (URL regex → HTML meta-tag fetch → CORS proxy)
      // DOI mode: pass directly to fetchByDOI
      const doi = inputSource === 'url'
        ? await resolveDOIFromURL(rawInput)
        : rawInput

      const data = await fetchByDOI(doi)
      const rawBib = citationDataToBib(data, entryType === 'auto' ? undefined : entryType)
      const result = convert(rawBib, 'bib', outputType, fields)
      if (!result.ok) {
        setConvertError(result.error ?? '')
      } else {
        setOutput(result.output ?? '')
        setWarnings(result.warnings ?? [])
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Fetch failed.')
    } finally {
      setIsFetching(false)
    }
  }, [inputSource, doiInput, urlInput, outputType, fields, entryType, clearErrors])

  const handleCopy = useCallback(async () => {
    if (!output) return
    try { await navigator.clipboard.writeText(output) } catch {
      const el = document.createElement('textarea')
      el.value = output; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setToastVisible(true)
    setTimeout(() => setCopied(false), 2200)
  }, [output])

  const handleDownload = useCallback(() => {
    if (!output) return
    const ext = outputType === 'bib' ? 'bib' : 'txt'
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `citation.${ext}`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [output, outputType])

  const handleFieldToggle = useCallback((key: keyof FieldSelection) => {
    setFields(prev => ({ ...prev, [key]: !prev[key] }))
    setOutput('')
    setWarnings([])
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleConvert() }
  }, [handleConvert])

  const handleFetchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleFetch() }
  }, [handleFetch])

  const isFetchSource = inputSource === 'doi' || inputSource === 'url'
  const convertLabel = isFetching
    ? (isFetchSource ? 'Fetching...' : 'DOI 取得中...')
    : isFetchSource
      ? 'Fetch Citation'
      : CONVERT_LABEL[`${inputType}-${outputType}`]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="wrapper">

        {/* Header */}
        <header className="header">
          <h1>Citation ⇄ <span className="accent">BibTeX</span></h1>
          <p>論文引用テキストを変換・整形するツール</p>
        </header>

        {/* Main card */}
        <div className="card">

          {/* Input source tabs */}
          <div className="source-tabs">
            {(['text', 'doi', 'url', 'file'] as InputSource[]).map(src => (
              <button
                key={src}
                className={`source-tab${inputSource === src ? ' active' : ''}`}
                onClick={() => handleSourceChange(src)}
              >
                {src === 'text' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
                  </svg>
                )}
                {src === 'doi' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                )}
                {src === 'url' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                )}
                {src === 'file' && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                )}
                {src === 'text' ? 'Text' : src === 'doi' ? 'DOI' : src === 'url' ? 'URL' : 'File'}
              </button>
            ))}
          </div>

          {/* Type selector — hide Input Type for DOI/URL sources */}
          <div className="type-selector">
            {!isFetchSource && (
              <>
                <div className="type-group">
                  <div className="type-label">Input Type</div>
                  <div className="type-btns">
                    {(['txt', 'bib'] as DataType[]).map(t => (
                      <button key={t} className={`type-btn${inputType === t ? ' active' : ''}`}
                        onClick={() => handleTypeSwitch('input', t)}>
                        {t === 'txt' ? 'TXT' : 'BibTeX'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="type-arrow">→</div>
              </>
            )}
            <div className="type-group">
              <div className="type-label">Output Type</div>
              <div className="type-btns">
                {(['txt', 'bib'] as DataType[]).map(t => (
                  <button key={t} className={`type-btn${outputType === t ? ' active' : ''}`}
                    onClick={() => handleTypeSwitch('output', t)}>
                    {t === 'txt' ? 'TXT' : 'BibTeX'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Citation Style selector — bib→txt mode only */}
          {inputType === 'bib' && outputType === 'txt' && (
            <div className="citation-style-row">
              <span className="citation-style-label">Citation Style</span>
              <select
                className="citation-style-select"
                value={citationStyle}
                onChange={e => {
                  setCitationStyle(e.target.value as CitationStyle)
                  setOutput('')
                  clearErrors()
                }}
              >
                <option value="classic">Classic</option>
                <option value="ieee">IEEE</option>
                <option value="apa">APA (7th)</option>
                <option value="acm">ACM</option>
                <option value="nature">Nature</option>
                <option value="springer">Springer / LNCS</option>
                <option value="mla">MLA</option>
                <option value="chicago">Chicago</option>
                <option value="harvard">Harvard</option>
                <option value="pandoc">Pandoc (Markdown)</option>
              </select>
            </div>
          )}

          {/* Entry Type selector — txt→bib and DOI/URL→bib modes only */}
          {((inputType === 'txt' && outputType === 'bib') || (isFetchSource && outputType === 'bib')) && (
            <div className="citation-style-row">
              <span className="citation-style-label">Entry Type</span>
              <select
                className="citation-style-select"
                value={entryType}
                onChange={e => {
                  setEntryType(e.target.value as BibEntryType | 'auto')
                  setOutput('')
                  clearErrors()
                }}
              >
                <option value="auto">Auto（自動判定）</option>
                <option value="ARTICLE">@article</option>
                <option value="INPROCEEDINGS">@inproceedings</option>
                <option value="INCOLLECTION">@incollection</option>
                <option value="BOOK">@book</option>
                <option value="MISC">@misc</option>
                <option value="PHDTHESIS">@phdthesis</option>
                <option value="MASTERSTHESIS">@mastersthesis</option>
                <option value="TECHREPORT">@techreport</option>
              </select>
            </div>
          )}

          {/* Input section */}
          <div>
            <div className="section-header">
              <div className="section-label">
                <span className="section-num">1</span>
                {isFetchSource
                  ? (inputSource === 'doi' ? 'Input — DOI' : 'Input — Article URL')
                  : inputSource === 'file'
                    ? 'Input — File'
                    : INPUT_LABEL[inputType]
                }
              </div>
            </div>

            {/* DOI source */}
            {inputSource === 'doi' && (
              <div className="fetch-input-wrap">
                <input
                  type="text"
                  className="fetch-input"
                  placeholder="DOI を入力"
                  value={doiInput}
                  onChange={e => { setDoiInput(e.target.value); clearErrors(); setOutput('') }}
                  onKeyDown={handleFetchKeyDown}
                  spellCheck={false}
                />
                <p className="fetch-hint">例: <code>10.xxxx/xxxxx</code> または <code>https://doi.org/10.xxxx/xxxxx</code></p>
              </div>
            )}

            {/* URL source */}
            {inputSource === 'url' && (
              <div className="fetch-input-wrap">
                <input
                  type="text"
                  className="fetch-input"
                  placeholder="https://doi.org/10.xxxx/xxxxx"
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); clearErrors(); setOutput('') }}
                  onKeyDown={handleFetchKeyDown}
                  spellCheck={false}
                />
                <p className="fetch-hint">
                  論文 URL を入力。例: <code>https://doi.org/10.xxxx/xxxxx</code><br/>
                  対応: doi.org / ACM / Springer ／ ※ IEEE・ScienceDirect はサイト制限で取得できない場合があります。その場合は DOI タブでの直接入力を推奨します
                </p>
              </div>
            )}

            {/* File source */}
            {inputSource === 'file' && (
              <>
                <div
                  className={`upload-zone${isDragOver ? ' drag-over' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input ref={fileRef} type="file" accept=".bib,.txt,text/plain"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                  />
                  {fileName ? (
                    <span className="upload-filename">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {fileName}
                      <button className="upload-clear" onClick={e => {
                        e.stopPropagation(); setFileName(''); setInput(''); setOutput(''); clearErrors()
                      }}>×</button>
                    </span>
                  ) : (
                    <span className="upload-hint">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Upload .bib or .txt — drag &amp; drop or click to browse
                    </span>
                  )}
                </div>
                {input && (
                  <textarea
                    rows={7}
                    readOnly
                    value={input}
                    spellCheck={false}
                    style={{ marginTop: '0.5rem' }}
                  />
                )}
              </>
            )}

            {/* Text source */}
            {inputSource === 'text' && (
              <>
                <div
                  className={`upload-zone${isDragOver ? ' drag-over' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input ref={fileRef} type="file" accept=".bib,.txt,text/plain"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                  />
                  {fileName ? (
                    <span className="upload-filename">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {fileName}
                      <button className="upload-clear" onClick={e => {
                        e.stopPropagation(); setFileName(''); setInput(''); setOutput(''); clearErrors()
                      }}>×</button>
                    </span>
                  ) : (
                    <span className="upload-hint">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Upload .bib or .txt — drag &amp; drop or click to browse
                    </span>
                  )}
                </div>

                <textarea
                  rows={7}
                  placeholder={INPUT_PLACEHOLDER[inputType]}
                  value={input}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={inputError ? 'has-error' : ''}
                  spellCheck={false}
                  style={{ marginTop: '0.5rem' }}
                />
              </>
            )}

            {inputError   && <div className="error-msg"><span>⚠</span> {inputError}</div>}
            {convertError && <div className="error-msg"><span>⚠</span> {convertError}</div>}
            {fetchError   && <div className="error-msg"><span>⚠</span> {fetchError}</div>}
          </div>

          {/* Convert / Fetch button */}
          <button
            className={`convert-btn${isFetching ? ' loading' : ''}`}
            onClick={isFetchSource ? handleFetch : handleConvert}
            disabled={isFetching}
          >
            {isFetching ? (
              <svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : isFetchSource ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            )}
            {convertLabel}
            {!isFetching && <span className="btn-shortcut">Ctrl + Enter</span>}
          </button>

          <div className="divider" />

          {/* Output section */}
          <div>
            <div className="section-header">
              <div className="section-label">
                <span className="section-num">2</span>
                {OUTPUT_LABEL[outputType]}
              </div>
              <div className="action-row">
                <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={handleCopy} disabled={!output}>
                  {copied ? <>✓ Copied!</> : (
                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg> Copy</>
                  )}
                </button>
                <button className="download-btn" onClick={handleDownload} disabled={!output}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {outputType === 'bib' ? 'Download .bib' : 'Download .txt'}
                </button>
              </div>
            </div>

            <textarea
              rows={10}
              readOnly
              value={output}
              placeholder={OUTPUT_PLACEHOLDER[outputType]}
              spellCheck={false}
            />

            {/* Validation warnings */}
            {warnings.length > 0 && output && (
              <div className="validation-warnings">
                {warnings.map((w, i) => (
                  <div key={i} className={w.level === 'warn' ? 'warn-msg' : 'info-msg'}>
                    <span>{w.level === 'warn' ? '⚠' : 'ℹ'}</span>
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* Batch summary */}
            {batchSummary && output && (
              <div className="validation-warnings">
                <div className={batchSummary.errorCount > 0 ? 'warn-msg' : 'info-msg'}>
                  <span>{batchSummary.errorCount > 0 ? '⚠' : 'ℹ'}</span>
                  {batchSummary.successCount}件成功
                  {batchSummary.errorCount > 0 && ` / ${batchSummary.errorCount}件エラー（出力内の % [ERROR #N] を確認してください）`}
                </div>
              </div>
            )}
          </div>

          <div className="divider" />

          {/* Field selector */}
          <FieldSelector sel={fields} onToggle={handleFieldToggle} />
        </div>

        <footer className="footer">Powered by React + TypeScript + Vite</footer>
      </div>

      {/* Toast */}
      <div className={`toast${toastVisible ? ' visible' : ''}`}>
        <span className="toast-dot" />
        クリップボードにコピーしました
      </div>
    </div>
  )
}
