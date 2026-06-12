export interface LibraryEntry {
  key: string
  type: string
  raw: string
  addedAt: number
}

export type SaveResult = 'ok' | 'warn' | 'full'
