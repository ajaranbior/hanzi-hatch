import { parsePinyin, searchKey, isValidSyllable } from './pinyin'
import { isHan, wordKey } from './hanzi'
import type { Entry } from './types'

/** [hanzi, numeric pinyin, meaning, oldLevel, newLevel, freq, classifier] — see scripts/build-data.mjs */
export type HskRow = [string, string, string, number, number, number, string]
/** [simplified, numeric pinyin, meaning, traditional?] */
export type DictRow = [string, string, string, string?]

interface Indexed extends Entry {
  key: string // toneless, spaceless pinyin ("nihao", ü → v)
  lower: string // lowercased meaning
}

export class Dictionary {
  private entries: Indexed[] = []
  private byHanzi = new Map<string, Indexed[]>()
  private byKey = new Map<string, Indexed[]>()

  constructor(hsk: HskRow[], dict: DictRow[] = []) {
    const seen = new Map<string, Indexed>()
    const add = (e: Entry) => {
      const k = wordKey(e.hanzi, e.pinyin)
      const existing = seen.get(k)
      if (existing) {
        // HSK data wins on levels / frequency, dictionary can add the traditional form
        existing.oldLevel ||= e.oldLevel
        existing.newLevel ||= e.newLevel
        existing.freq = Math.min(existing.freq, e.freq)
        existing.traditional ||= e.traditional
        if (e.source === 'hsk') {
          existing.source = 'hsk'
          existing.meaning = e.meaning || existing.meaning
          existing.lower = existing.meaning.toLowerCase()
        }
        return
      }
      const idx: Indexed = { ...e, key: searchKey(e.pinyin), lower: e.meaning.toLowerCase() }
      seen.set(k, idx)
      this.entries.push(idx)
    }
    for (const r of hsk)
      add({ hanzi: r[0], pinyin: r[1], meaning: r[2], oldLevel: r[3], newLevel: r[4], freq: r[5], source: 'hsk' })
    for (const r of dict)
      add({ hanzi: r[0], pinyin: r[1], meaning: r[2], traditional: r[3], oldLevel: 0, newLevel: 0, freq: 1e6, source: 'dictionary' })
    for (const e of this.entries) {
      push(this.byHanzi, e.hanzi, e)
      if (e.traditional) push(this.byHanzi, e.traditional, e)
      push(this.byKey, e.key, e)
    }
  }

  get size() {
    return this.entries.length
  }

  lookup(hanzi: string): Entry[] {
    return [...(this.byHanzi.get(hanzi) ?? [])].sort(rank)
  }

  /** All entries of an HSK level; `which` picks the 2.0 or 3.0 list. */
  hskList(which: 'old' | 'new', level: number): Entry[] {
    return this.entries
      .filter((e) => (which === 'old' ? e.oldLevel : e.newLevel) === level)
      .sort((a, b) => a.freq - b.freq)
  }

  /**
   * Search by hanzi (simplified or traditional), pinyin (with/without tones or spaces) or English.
   * Results are ordered: exact matches first, then HSK words / common words.
   */
  search(query: string, limit = 30): Entry[] {
    const q = query.trim()
    if (!q) return []
    const scored = new Map<Indexed, number>()
    const bump = (e: Indexed, score: number) => {
      const prev = scored.get(e)
      if (prev === undefined || score < prev) scored.set(e, score)
    }

    if ([...q].some(isHan)) {
      for (const e of this.byHanzi.get(q) ?? []) bump(e, 0)
      for (const e of this.entries) {
        if (e.hanzi.startsWith(q) || e.traditional?.startsWith(q)) bump(e, 10)
        else if (e.hanzi.includes(q) || e.traditional?.includes(q)) bump(e, 20)
      }
    } else {
      const syl = parsePinyin(q)
      const looksPinyin = syl.length > 0 && /^[a-züvu:1-5āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s'’-]+$/i.test(q)
      if (looksPinyin) {
        const key = syl.map((s) => s.base).join('').replace(/ü/g, 'v')
        const tones = syl.map((s) => s.tone)
        const typedTones = tones.every((t) => t !== 0)
        const valid = syl.every((s) => isValidSyllable(s.base))
        for (const e of this.byKey.get(key) ?? []) {
          if (typedTones) {
            const want = e.pinyin.split(' ').map((p) => Number(p.slice(-1)))
            bump(e, want.length === tones.length && want.every((w, i) => w === tones[i]) ? 1 : 30)
          } else bump(e, 2)
        }
        if (!valid || syl.length <= 3) {
          for (const e of this.entries) if (e.key !== key && e.key.startsWith(key)) bump(e, 15 + (e.key.length - key.length))
        }
      }
      const lq = q.toLowerCase()
      if (lq.length >= 2) {
        const word = new RegExp(`(^|[^a-z])${escapeRe(lq)}([^a-z]|$)`)
        for (const e of this.entries) {
          if (e.lower === lq) bump(e, 5)
          else if (e.lower.startsWith(lq) || e.lower.startsWith(`to ${lq}`)) bump(e, 12)
          else if (word.test(e.lower)) bump(e, 25)
        }
      }
    }
    return [...scored.entries()]
      .sort((a, b) => a[1] - b[1] || rank(a[0], b[0]))
      .slice(0, limit)
      .map(([e]) => stripIndex(e))
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k)
  if (a) a.push(v)
  else m.set(k, [v])
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function level(e: Entry) {
  return Math.min(e.oldLevel || 99, e.newLevel || 99)
}

function rank(a: Entry, b: Entry) {
  return level(a) - level(b) || a.freq - b.freq || a.hanzi.length - b.hanzi.length
}

function stripIndex(e: Indexed): Entry {
  const { key: _k, lower: _l, ...rest } = e
  void _k
  void _l
  return rest
}
