import Dexie, { type EntityTable } from 'dexie'
import type { ReviewItem, ReviewLog, Word } from '../core/types'

export interface KV {
  key: string
  value: unknown
}

/** Local-first storage (IndexedDB). Same schema works inside a Capacitor WebView later. */
export class HanziDB extends Dexie {
  words!: EntityTable<Word, 'id'>
  items!: EntityTable<ReviewItem, 'id'>
  logs!: EntityTable<ReviewLog, 'id'>
  kv!: EntityTable<KV, 'key'>

  constructor(name = 'hanzi-hatch') {
    super(name)
    this.version(1).stores({
      words: '++id, &[hanzi+pinyin], oldLevel, newLevel, addedAt, introducedAt',
      items: 'id, wordId, state, due',
      logs: '++id, at, wordId',
      kv: 'key',
    })
  }
}

export const db = new HanziDB()
