import { newItem, schedule } from '../core/srs'
import {
  DEFAULT_SETTINGS,
  ITEM_KINDS,
  type Entry,
  type Grade,
  type ItemKind,
  type ReviewItem,
  type Settings,
  type Word,
} from '../core/types'
import { db as defaultDb, type HanziDB } from './db'

export interface NewWordInput {
  hanzi: string
  pinyin: string
  meaning: string
  source?: Word['source']
  oldLevel?: number
  newLevel?: number
  note?: string
}

export function entryToInput(e: Entry): NewWordInput {
  return {
    hanzi: e.hanzi,
    pinyin: e.pinyin,
    meaning: e.meaning,
    source: e.source,
    oldLevel: e.oldLevel,
    newLevel: e.newLevel,
  }
}

export class Repo {
  constructor(private db: HanziDB = defaultDb) {}

  // ---- words -------------------------------------------------------------

  /** Adds a word (and its four practice items). Returns the existing word if it is already in the collection. */
  async addWord(input: NewWordInput, now = Date.now()): Promise<{ word: Word; created: boolean }> {
    return this.db.transaction('rw', this.db.words, this.db.items, async () => {
      const existing = await this.db.words.where('[hanzi+pinyin]').equals([input.hanzi, input.pinyin]).first()
      if (existing) return { word: existing, created: false }
      const word: Word = {
        hanzi: input.hanzi,
        pinyin: input.pinyin,
        meaning: input.meaning,
        source: input.source ?? 'custom',
        oldLevel: input.oldLevel ?? 0,
        newLevel: input.newLevel ?? 0,
        note: input.note,
        addedAt: now,
      }
      const id = (await this.db.words.add(word)) as number
      word.id = id
      await this.db.items.bulkAdd(ITEM_KINDS.map((k) => newItem(id, k, now)))
      return { word, created: true }
    })
  }

  async addWords(inputs: NewWordInput[]): Promise<number> {
    let n = 0
    const base = Date.now()
    for (const [i, input] of inputs.entries()) {
      // keep list order: addedAt is the order new words are introduced in
      if ((await this.addWord(input, base + i)).created) n++
    }
    return n
  }

  async updateWord(id: number, patch: Partial<Pick<Word, 'meaning' | 'note' | 'pinyin' | 'hanzi'>>) {
    await this.db.words.update(id, patch)
  }

  async removeWord(id: number) {
    await this.db.transaction('rw', this.db.words, this.db.items, async () => {
      await this.db.words.delete(id)
      await this.db.items.where('wordId').equals(id).delete()
    })
  }

  /** keys `hanzi|pinyin` of everything in the collection, for "already added" checks */
  async collectionKeys(): Promise<Set<string>> {
    const words = await this.db.words.toArray()
    return new Set(words.map((w) => `${w.hanzi}|${w.pinyin}`))
  }

  // ---- settings ----------------------------------------------------------

  async getSettings(): Promise<Settings> {
    const row = await this.db.kv.get('settings')
    const saved = (row?.value ?? {}) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...saved, kinds: { ...DEFAULT_SETTINGS.kinds, ...saved.kinds } }
  }

  async saveSettings(s: Settings) {
    await this.db.kv.put({ key: 'settings', value: s })
  }

  // ---- study -------------------------------------------------------------

  async stats(now = Date.now()) {
    const settings = await this.getSettings()
    const [items, words] = await Promise.all([this.db.items.toArray(), this.db.words.toArray()])
    const enabled = new Set(ITEM_KINDS.filter((k) => settings.kinds[k]))
    const wordIds = new Set(words.map((w) => w.id))
    const live = items.filter((i) => enabled.has(i.kind) && wordIds.has(i.wordId))
    const introduced = new Set(words.filter((w) => w.introducedAt).map((w) => w.id))
    const dueReviews = live.filter((i) => introduced.has(i.wordId) && i.due <= now).length
    const startOfDay = new Date(now).setHours(0, 0, 0, 0)
    const introducedToday = words.filter((w) => (w.introducedAt ?? 0) >= startOfDay).length
    const waiting = words.filter((w) => !w.introducedAt).length
    const newToday = Math.min(waiting, Math.max(0, settings.newWordsPerDay - introducedToday))
    const reviewedToday = await this.db.logs.where('at').aboveOrEqual(startOfDay).count()
    const learned = live.filter((i) => i.state === 'review').length
    return {
      words: words.length,
      dueReviews,
      newToday,
      waiting,
      reviewedToday,
      learnedItems: learned,
      totalItems: live.length,
    }
  }

  /**
   * The cards for a study session: due reviews first, then up to `newWordsPerDay` new words, each
   * preceded by an intro card.
   */
  async buildQueue(now = Date.now(), extraNew = 0): Promise<QueueCard[]> {
    const settings = await this.getSettings()
    const enabled = ITEM_KINDS.filter((k) => settings.kinds[k])
    const [items, words] = await Promise.all([this.db.items.toArray(), this.db.words.toArray()])
    const byId = new Map(words.map((w) => [w.id!, w]))
    const horizon = now + 15 * 60_000 // learning steps that come due soon are included

    const due = items
      .filter((i) => enabled.includes(i.kind) && byId.get(i.wordId)?.introducedAt && i.due <= horizon)
      .sort((a, b) => a.due - b.due)
    const queue: QueueCard[] = due.map((item) => ({ item, word: byId.get(item.wordId)!, intro: false }))

    const startOfDay = new Date(now).setHours(0, 0, 0, 0)
    const introducedToday = words.filter((w) => (w.introducedAt ?? 0) >= startOfDay).length
    const budget = Math.max(0, settings.newWordsPerDay - introducedToday) + extraNew
    const fresh = words
      .filter((w) => !w.introducedAt)
      .sort((a, b) => a.addedAt - b.addedAt || a.id! - b.id!)
      .slice(0, budget)
    const itemsByWord = new Map<number, ReviewItem[]>()
    for (const i of items) {
      const a = itemsByWord.get(i.wordId)
      if (a) a.push(i)
      else itemsByWord.set(i.wordId, [i])
    }
    for (const w of fresh) {
      const wi = itemsByWord.get(w.id!) ?? []
      const mine = enabled.map((k) => wi.find((i) => i.kind === k)).filter(Boolean) as ReviewItem[]
      if (!mine.length) continue
      queue.push({ item: mine[0], word: w, intro: true })
      for (const item of mine) queue.push({ item, word: w, intro: false })
    }
    return queue
  }

  async markIntroduced(wordId: number, now = Date.now()) {
    await this.db.words.where(':id').equals(wordId).modify((w) => {
      w.introducedAt ??= now
    })
  }

  /** Apply a grade: reschedules the item and writes a log row. Returns the updated item. */
  async grade(item: ReviewItem, grade: Grade, now = Date.now()): Promise<ReviewItem> {
    const next = schedule(item, grade, now)
    await this.db.transaction('rw', this.db.items, this.db.logs, async () => {
      await this.db.items.put(next)
      await this.db.logs.add({ itemId: item.id, wordId: item.wordId, kind: item.kind, grade, at: now })
    })
    return next
  }

  // ---- backup ------------------------------------------------------------

  async exportAll() {
    const [words, items, logs, kv] = await Promise.all([
      this.db.words.toArray(),
      this.db.items.toArray(),
      this.db.logs.toArray(),
      this.db.kv.toArray(),
    ])
    return { app: 'hanzi-hatch', version: 1, exportedAt: new Date().toISOString(), words, items, logs, kv }
  }

  async importAll(data: Awaited<ReturnType<Repo['exportAll']>>) {
    if (data?.app !== 'hanzi-hatch') throw new Error('Not a Hanzi Hatch backup file')
    await this.db.transaction('rw', this.db.words, this.db.items, this.db.logs, this.db.kv, async () => {
      await Promise.all([this.db.words.clear(), this.db.items.clear(), this.db.logs.clear(), this.db.kv.clear()])
      await this.db.words.bulkAdd(data.words)
      await this.db.items.bulkAdd(data.items)
      await this.db.logs.bulkAdd(data.logs)
      await this.db.kv.bulkAdd(data.kv)
    })
  }
}

export interface QueueCard {
  item: ReviewItem
  word: Word
  /** true: show the "new word" introduction instead of a quiz */
  intro: boolean
}

export type { ItemKind }
export const repo = new Repo()
