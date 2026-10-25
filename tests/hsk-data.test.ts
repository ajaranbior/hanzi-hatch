import { describe, expect, it } from 'vitest'
import hsk from '../public/data/hsk.json'
import type { HskRow } from '../src/core/dictionary'

const rows = hsk as unknown as HskRow[]
const by = new Map(rows.map((r) => [r[0], r]))

describe('hsk.json', () => {
  it('has exactly one reading per hanzi', () => {
    expect(by.size).toBe(rows.length)
  })
  it('uses the common reading', () => {
    const want: Record<string, string> = { 的: 'de5', 看: 'kan4', 读: 'du2', 好: 'hao3', 了: 'le5', 会: 'hui4', 都: 'dou1', 东西: 'dong1 xi5', 女人: 'nü3 ren2' }
    for (const [h, py] of Object.entries(want)) expect(by.get(h)?.[1], h).toBe(py)
  })
  it('has short, usable meanings', () => {
    expect(by.get('白')![2]).toMatch(/^white/)
    expect(rows.filter((r) => /^surname/i.test(r[2]))).toHaveLength(0)
  })
})
