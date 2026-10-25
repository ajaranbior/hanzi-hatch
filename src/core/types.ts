/** The four things you practise for every word. */
export type ItemKind = 'meaning' | 'tone' | 'pronunciation' | 'writing'
export const ITEM_KINDS: ItemKind[] = ['meaning', 'tone', 'pronunciation', 'writing']

export const KIND_LABEL: Record<ItemKind, string> = {
  meaning: 'Meaning',
  tone: 'Tones',
  pronunciation: 'Pronunciation',
  writing: 'Writing',
}

export type WordSource = 'hsk' | 'dictionary' | 'custom'

export interface Word {
  id?: number
  hanzi: string
  /** canonical numeric pinyin, e.g. "ni3 hao3" */
  pinyin: string
  meaning: string
  source: WordSource
  /** HSK 2.0 level (1-6) and HSK 3.0 level (1-7, 7 = 7-9), 0 = not in list */
  oldLevel: number
  newLevel: number
  addedAt: number
  /** set the first time the word is shown in a study session */
  introducedAt?: number
  /** the user already knows this word: kept in the collection but never scheduled */
  known?: boolean
  note?: string
}

export type Grade = 1 | 2 | 3 | 4 // again, hard, good, easy
export const GRADE_LABEL: Record<Grade, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }

export interface ReviewItem {
  /** `${wordId}:${kind}` */
  id: string
  wordId: number
  kind: ItemKind
  state: 'new' | 'learning' | 'review'
  /** ms epoch */
  due: number
  /** days; 0 until first graduation */
  interval: number
  ease: number
  step: number
  reps: number
  lapses: number
  lastReview?: number
}

export interface ReviewLog {
  id?: number
  itemId: string
  wordId: number
  kind: ItemKind
  grade: Grade
  at: number
}

export interface Settings {
  newWordsPerDay: number
  kinds: Record<ItemKind, boolean>
  autoPlayAudio: boolean
  toneColors: boolean
  /** require tone marks/numbers when typing pinyin */
  strictTones: boolean
  /** which character set to show in HSK lists (affects list order only) */
  hskVersion: 'old' | 'new'
  /** writing: show an outline of the character as a faint guide */
  showOutline: boolean
  /** writing: mistakes per stroke before the hint is shown */
  leniency: number
}

export const DEFAULT_SETTINGS: Settings = {
  newWordsPerDay: 10,
  kinds: { meaning: true, tone: true, pronunciation: true, writing: true },
  autoPlayAudio: true,
  toneColors: true,
  strictTones: true,
  hskVersion: 'old',
  showOutline: false,
  leniency: 1,
}

/** A dictionary / HSK entry as shown in search results. */
export interface Entry {
  hanzi: string
  pinyin: string
  meaning: string
  traditional?: string
  oldLevel: number
  newLevel: number
  freq: number
  source: WordSource
}
