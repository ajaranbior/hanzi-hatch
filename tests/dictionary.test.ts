import { describe, expect, it } from 'vitest'
import { Dictionary, type DictRow, type HskRow } from '../src/core/dictionary'
import { alignWord } from '../src/core/hanzi'
import { newItem, schedule } from '../src/core/srs'

const hsk: HskRow[] = [
  ['你好', 'ni3 hao3', 'hello', 1, 1, 100, ''],
  ['好', 'hao3', 'good', 1, 1, 50, ''],
  ['女儿', 'nü3 er2', 'daughter', 2, 1, 300, '个'],
]
const dict: DictRow[] = [
  ['你好', 'ni3 hao3', 'hello; hi', '你好'],
  ['拟好', 'ni3 hao3', 'to draft well'],
  ['好', 'hao4', 'to be fond of'],
  ['女儿', 'nü3 er2', 'daughter', '女兒'],
]
const d = new Dictionary(hsk, dict)

describe('Dictionary', () => {
  it('merges HSK and dictionary entries', () => {
    expect(d.size).toBe(5)
    expect(d.lookup('女兒')[0].oldLevel).toBe(2)
  })
  it('searches by hanzi', () => {
    expect(d.search('好').map((e) => e.hanzi + e.pinyin)).toEqual(['好hao3', '好hao4', '你好ni3 hao3', '拟好ni3 hao3'])
  })
  it('searches by pinyin with and without tones', () => {
    expect(d.search('nihao')[0].hanzi).toBe('你好')
    expect(d.search('ni3hao3')[0].hanzi).toBe('你好')
    expect(d.search('nǐ hǎo')[0].hanzi).toBe('你好')
    expect(d.search('hao4')[0].pinyin).toBe('hao4')
    expect(d.search('nv er').map((e) => e.hanzi)).toContain('女儿')
  })
  it('searches by english', () => {
    expect(d.search('daughter')[0].hanzi).toBe('女儿')
  })
})

describe('alignWord', () => {
  it('pairs characters with syllables', () => {
    expect(alignWord('你好', 'ni3 hao3').map((g) => g.syllable?.tone)).toEqual([3, 3])
    expect(alignWord('3C', 'san1 C').map((g) => g.syllable)).toEqual([undefined, undefined])
  })
})

describe('srs', () => {
  const t0 = 1_700_000_000_000
  it('graduates after two good answers and grows intervals', () => {
    let it = newItem(1, 'tone', t0)
    it = schedule(it, 3, t0)
    expect(it.state).toBe('learning')
    it = schedule(it, 3, t0 + 60_000)
    expect(it.state).toBe('review')
    expect(it.interval).toBe(1)
    const a = schedule(it, 3, t0 + 86_400_000)
    expect(a.interval).toBeGreaterThan(it.interval)
    const lapsed = schedule(a, 1, t0 + 2 * 86_400_000)
    expect(lapsed.state).toBe('learning')
    expect(lapsed.lapses).toBe(1)
    expect(lapsed.ease).toBeLessThan(a.ease)
  })
})
