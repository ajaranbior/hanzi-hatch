/**
 * Pinyin helpers. Canonical storage format is "numeric with ü": `nü3 hao3`,
 * syllables separated by single spaces, tone 5 = neutral.
 * Pure TypeScript, no DOM — reusable from a React Native / Capacitor shell.
 */

export interface Syllable {
  /** toneless letters, lowercase, ü for the u-umlaut (e.g. "nü", "lüe") */
  base: string
  /** 1-4, 5 for neutral */
  tone: 1 | 2 | 3 | 4 | 5
}

const TONE_MARKS: Record<string, [string, number]> = {}
;(
  [
    ['a', 'āáǎà'],
    ['e', 'ēéěè'],
    ['i', 'īíǐì'],
    ['o', 'ōóǒò'],
    ['u', 'ūúǔù'],
    ['ü', 'ǖǘǚǜ'],
  ] as const
).forEach(([v, marks]) => {
  ;[...marks].forEach((m, i) => (TONE_MARKS[m] = [v, i + 1]))
})

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
const FINALS = [
  'a', 'ai', 'an', 'ang', 'ao', 'e', 'ei', 'en', 'eng', 'er', 'i', 'ia', 'ian', 'iang', 'iao', 'ie', 'in', 'ing', 'iong',
  'iu', 'o', 'ong', 'ou', 'u', 'ua', 'ue', 'uai', 'uan', 'uang', 'ui', 'un', 'uo', 'ü', 'üe', 'üan', 'ün', 'ê',
]
const SYLLABLES = new Set<string>()
for (const f of FINALS) SYLLABLES.add(f)
for (const i of INITIALS) for (const f of FINALS) SYLLABLES.add(i + f)
// interjections / odd syllables that occur in dictionaries
;['hm', 'hng', 'm', 'n', 'ng', 'ei', 'o', 'lo', 'yo', 'dia', 'nou', 'den', 'kei', 'lia', 'nia', 'sei', 'zhei', 'cei', 'fiao', 'ds'].forEach((s) =>
  SYLLABLES.add(s),
)

/** j/q/x/y write ü as u (xue, yu); n/l write üe with the umlaut (nüe, lüe). */
function normalizeBase(base: string): string {
  return base.replace(/^([jqxy])ü/, '$1u').replace(/^([nl])ue$/, '$1üe')
}

function normalizeLetters(s: string): string {
  return s.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü')
}

/** Is this a valid toneless syllable (after ü normalisation)? */
export function isValidSyllable(base: string): boolean {
  return SYLLABLES.has(base)
}

/**
 * Segment a run of letters into syllables. `toneAt` maps char index → tone for tone marks,
 * so we never put two marked vowels in one syllable. Returns null if impossible.
 */
function segment(letters: string, marks: number[]): string[] | null {
  const n = letters.length
  const memo = new Map<number, string[] | null>()
  const go = (i: number): string[] | null => {
    if (i === n) return []
    if (memo.has(i)) return memo.get(i)!
    let best: string[] | null = null
    for (let len = Math.min(6, n - i); len >= 1; len--) {
      const piece = letters.slice(i, i + len)
      if (!SYLLABLES.has(piece)) continue
      let marked = 0
      for (let k = i; k < i + len; k++) if (marks[k]) marked++
      if (marked > 1) continue
      const rest = go(i + len)
      if (rest) {
        const cand = [piece, ...rest]
        // prefer fewer syllables, tie → first found (longest-first)
        if (!best || cand.length < best.length) best = cand
      }
    }
    memo.set(i, best)
    return best
  }
  return go(0)
}

/**
 * Parse free-form pinyin into syllables. Accepts tone marks, tone numbers (ni3 hao3),
 * ü as ü / v / u:, with or without spaces. Syllables typed without a tone get tone 5 only
 * when `neutralWhenMissing` is set, otherwise tone is returned as 0 (unknown).
 */
export function parsePinyin(input: string, neutralWhenMissing = false): Array<{ base: string; tone: 0 | 1 | 2 | 3 | 4 | 5 }> {
  const out: Array<{ base: string; tone: 0 | 1 | 2 | 3 | 4 | 5 }> = []
  for (const group of tokenizeWithMarks(input)) {
    const { letters, marks, trailing } = group
    const segs = segment(letters, marks) ?? [letters]
    // assign tones: marked vowel positions, plus explicit trailing digit applies to last syllable
    let pos = 0
    segs.forEach((seg, idx) => {
      let tone = 0
      for (let k = pos; k < pos + seg.length; k++) if (marks[k]) tone = marks[k]
      pos += seg.length
      if (idx === segs.length - 1 && trailing) tone = trailing
      out.push({ base: normalizeBase(seg), tone: (tone || (neutralWhenMissing ? 5 : 0)) as 0 | 1 | 2 | 3 | 4 | 5 })
    })
  }
  return out
}

interface Group {
  letters: string
  marks: number[]
  trailing: number
}

/** Split input into letter runs; a tone digit ends a run, tone marks are recorded per letter. */
function tokenizeWithMarks(input: string): Group[] {
  const groups: Group[] = []
  const raw = input.replace(/[’'`´·\-_,.;/]/g, ' ').split(/\s+/).filter(Boolean)
  for (const g of raw) {
    let letters = ''
    let marks: number[] = []
    const flush = (digit: number) => {
      if (letters || digit) groups.push({ letters, marks, trailing: digit })
      letters = ''
      marks = []
    }
    for (const ch of normalizeLetters(g)) {
      if (/[1-5]/.test(ch)) flush(Number(ch))
      else if (TONE_MARKS[ch]) {
        letters += TONE_MARKS[ch][0]
        marks.push(TONE_MARKS[ch][1])
      } else if (/[a-zü]/.test(ch)) {
        letters += ch
        marks.push(0)
      }
    }
    flush(0)
  }
  return groups.filter((g) => g.letters)
}
/** Canonical numeric form: neutral tone → 5, unknown tone → 5 too (dictionary data has no tone-less syllables). */
export function toNumeric(input: string): string {
  return parsePinyin(input, true)
    .map((s) => `${s.base}${s.tone}`)
    .join(' ')
}

export function splitNumeric(numeric: string): Syllable[] {
  return parsePinyin(numeric, true).map((s) => ({ base: s.base, tone: s.tone as Syllable['tone'] }))
}

/** Place a tone mark on a syllable following the standard rule (a/e first, ou → o, else last vowel). */
export function syllableToMarked(base: string, tone: number): string {
  if (tone < 1 || tone > 4) return base
  const idx = markIndex(base)
  if (idx < 0) return base
  const ch = base[idx]
  const marks = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' }[ch as 'a']
  return base.slice(0, idx) + marks[tone - 1] + base.slice(idx + 1)
}

function markIndex(base: string): number {
  const a = base.indexOf('a')
  if (a >= 0) return a
  const e = base.indexOf('e')
  if (e >= 0) return e
  const ou = base.indexOf('ou')
  if (ou >= 0) return ou
  for (let i = base.length - 1; i >= 0; i--) if ('iouü'.includes(base[i])) return i
  return -1
}

/** "ni3 hao3" → "nǐ hǎo" */
export function numericToMarked(numeric: string): string {
  return splitNumeric(numeric)
    .map((s) => syllableToMarked(s.base, s.tone))
    .join(' ')
}

export function formatSyllable(s: Syllable): string {
  return syllableToMarked(s.base, s.tone)
}

/** Strip tones: "ni3 hao3" → "ni hao"; ü → v optional for typed search keys. */
export function toToneless(input: string): string {
  return parsePinyin(input)
    .map((s) => s.base)
    .join(' ')
}

/** Key for searching without tones or spaces: "nǐ hǎo" / "ni3hao3" / "ni hao" → "nihao" (ü → v). */
export function searchKey(input: string): string {
  return toToneless(input).replace(/ü/g, 'v').replace(/\s/g, '')
}

export type AnswerCheck = { correct: boolean; syllables: boolean[] }

/**
 * Compare what the user typed to the expected numeric pinyin. Typed tones are required unless
 * `requireTones` is false (then only the letters are compared).
 */
export function checkPinyin(typed: string, expectedNumeric: string, requireTones = true): AnswerCheck {
  const want = splitNumeric(expectedNumeric)
  const got = parsePinyin(typed)
  const syllables = want.map((w, i) => {
    const g = got[i]
    if (!g || g.base !== w.base) return false
    if (!requireTones) return true
    // typing "ma" for a neutral tone syllable is accepted
    return g.tone === w.tone || (w.tone === 5 && g.tone === 0)
  })
  return { correct: got.length === want.length && syllables.every(Boolean), syllables }
}

/** Does `candidate` (numeric pinyin) match a user query with or without tones? */
export function pinyinMatches(query: string, numeric: string): 'exact' | 'toneless' | 'prefix' | null {
  const q = parsePinyin(query)
  if (!q.length) return null
  const c = splitNumeric(numeric)
  const qKey = q.map((s) => s.base).join('')
  const cKey = c.map((s) => s.base).join('')
  if (qKey === cKey) {
    const allTones = q.every((s) => s.tone !== 0)
    if (!allTones) return 'toneless'
    return q.every((s, i) => s.tone === c[i]?.tone || (s.tone === 5 && c[i]?.tone === 5)) ? 'exact' : null
  }
  if (cKey.startsWith(qKey) && q.every((s) => s.tone === 0)) return 'prefix'
  return null
}

export const TONE_NAMES: Record<number, string> = { 1: 'high flat', 2: 'rising', 3: 'dip', 4: 'falling', 5: 'neutral' }
