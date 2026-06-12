import type { LibraryEntry, SaveResult } from './types'

const STORAGE_KEY      = 'citation-lib'
const HARD_LIMIT_COUNT = 500
const SOFT_LIMIT_BYTES = 4 * 1024 * 1024

function byteSize(lib: LibraryEntry[]): number {
  return new Blob([JSON.stringify(lib)]).size
}

export function checkBeforeSave(lib: LibraryEntry[]): SaveResult {
  if (lib.length > HARD_LIMIT_COUNT) return 'full'
  if (byteSize(lib) > SOFT_LIMIT_BYTES) return 'warn'
  return 'ok'
}

export function load(): LibraryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as LibraryEntry[]
  } catch { return [] }
}

export function save(lib: LibraryEntry[]): SaveResult {
  const pre = checkBeforeSave(lib)
  if (pre === 'full') return 'full'
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib))
    return pre
  } catch {
    return 'full'
  }
}

export function mergeReplace(
  current: LibraryEntry[],
  incoming: LibraryEntry[],
): { merged: LibraryEntry[]; replaced: number } {
  const map = new Map(current.map(e => [e.key, e]))
  let replaced = 0
  for (const e of incoming) {
    if (map.has(e.key)) replaced++
    map.set(e.key, e)
  }
  return { merged: [...map.values()], replaced }
}
