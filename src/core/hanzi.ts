import { splitNumeric, type Syllable } from './pinyin'

export const isHan = (ch: string) => /\p{Script=Han}/u.test(ch)

export function hanChars(s: string): string[] {
  return [...s].filter(isHan)
}

export interface Glyph {
  ch: string
  /** syllable aligned to this character, when counts line up */
  syllable?: Syllable
}

/** Pair each character of a word with its syllable (only Han characters consume a syllable). */
export function alignWord(hanzi: string, numeric: string): Glyph[] {
  const syl = splitNumeric(numeric)
  const han = hanChars(hanzi)
  const aligned = syl.length === han.length
  let i = 0
  return [...hanzi].map((ch) => {
    if (!isHan(ch)) return { ch }
    return { ch, syllable: aligned ? syl[i++] : undefined }
  })
}

export const wordKey = (hanzi: string, numeric: string) => `${hanzi}|${numeric}`
