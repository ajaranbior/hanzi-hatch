import { describe, expect, it } from 'vitest'
import { checkPinyin, numericToMarked, parsePinyin, pinyinMatches, searchKey, toNumeric } from '../src/core/pinyin'

describe('pinyin parsing', () => {
  it('handles numeric, marked and mixed input', () => {
    expect(toNumeric('ni3 hao3')).toBe('ni3 hao3')
    expect(toNumeric('nǐ hǎo')).toBe('ni3 hao3')
    expect(toNumeric('ni3hao3')).toBe('ni3 hao3')
    expect(toNumeric('nǐhǎo')).toBe('ni3 hao3')
    expect(toNumeric('bùyǔ')).toBe('bu4 yu3')
    expect(toNumeric('chénglǐ')).toBe('cheng2 li3')
    expect(toNumeric('cè lu:è')).toBe('ce4 lüe4')
    expect(toNumeric('nv3 er2')).toBe('nü3 er2')
    expect(toNumeric('xi’an')).toBe('xi5 an5')
    expect(toNumeric('xi1an1')).toBe('xi1 an1')
  })
  it('marks tones correctly', () => {
    expect(numericToMarked('ni3 hao3')).toBe('nǐ hǎo')
    expect(numericToMarked('liu2 xue2 sheng1')).toBe('liú xué shēng')
    expect(numericToMarked('hui4')).toBe('huì')
    expect(numericToMarked('jiu3')).toBe('jiǔ')
    expect(numericToMarked('lüe4')).toBe('lüè')
    expect(numericToMarked('nü3')).toBe('nǚ')
    expect(numericToMarked('gou3')).toBe('gǒu')
    expect(numericToMarked('de5')).toBe('de')
  })
  it('leaves tone unknown when not typed', () => {
    expect(parsePinyin('nihao').map((s) => s.tone)).toEqual([0, 0])
    expect(searchKey('Nǐ Hǎo')).toBe('nihao')
    expect(searchKey('nü3')).toBe('nv')
  })
  it('checks answers', () => {
    expect(checkPinyin('nǐ hǎo', 'ni3 hao3').correct).toBe(true)
    expect(checkPinyin('ni3hao3', 'ni3 hao3').correct).toBe(true)
    expect(checkPinyin('ni3 hao2', 'ni3 hao3')).toEqual({ correct: false, syllables: [true, false] })
    expect(checkPinyin('nihao', 'ni3 hao3').correct).toBe(false)
    expect(checkPinyin('nihao', 'ni3 hao3', false).correct).toBe(true)
    expect(checkPinyin('ba', 'ba5').correct).toBe(true)
    expect(checkPinyin('ni3', 'ni3 hao3').correct).toBe(false)
  })
  it('matches search queries', () => {
    expect(pinyinMatches('ni3hao3', 'ni3 hao3')).toBe('exact')
    expect(pinyinMatches('nihao', 'ni3 hao3')).toBe('toneless')
    expect(pinyinMatches('nih', 'ni3 hao3')).toBe('prefix') // partial typing
    expect(pinyinMatches('ni3hao2', 'ni3 hao3')).toBe(null)
  })
})
