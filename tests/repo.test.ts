import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { HanziDB } from '../src/data/db'
import { Repo } from '../src/data/repo'

let repo: Repo
let n = 0
beforeEach(() => {
  repo = new Repo(new HanziDB(`test-${n++}`))
})

describe('Repo', () => {
  it('adds words once and creates four items each', async () => {
    const a = await repo.addWord({ hanzi: '你好', pinyin: 'ni3 hao3', meaning: 'hello' })
    const b = await repo.addWord({ hanzi: '你好', pinyin: 'ni3 hao3', meaning: 'hello' })
    expect(a.created).toBe(true)
    expect(b.created).toBe(false)
    const c = await repo.addWord({ hanzi: '好', pinyin: 'hao3', meaning: 'good' })
    await repo.addWord({ hanzi: '好', pinyin: 'hao4', meaning: 'to like' })
    expect((await repo.stats()).words).toBe(3)
    expect(c.word.id).toBeTruthy()
  })

  it('builds a queue with intro cards and respects the daily new-word limit', async () => {
    for (const [h, p] of [['一', 'yi1'], ['二', 'er4'], ['三', 'san1']]) await repo.addWord({ hanzi: h, pinyin: p, meaning: h })
    await repo.saveSettings({ ...(await repo.getSettings()), newWordsPerDay: 2 })
    const q = await repo.buildQueue()
    expect(q.filter((c) => c.intro)).toHaveLength(2)
    expect(q).toHaveLength(2 * 5) // intro + 4 kinds per word
    expect(q[0].intro).toBe(true)
  })

  it('schedules grades and removes due items from the next queue', async () => {
    const { word } = await repo.addWord({ hanzi: '一', pinyin: 'yi1', meaning: 'one' })
    await repo.markIntroduced(word.id!)
    let q = await repo.buildQueue()
    expect(q).toHaveLength(4)
    for (const c of q) await repo.grade(c.item, 4)
    q = await repo.buildQueue()
    expect(q).toHaveLength(0)
    expect((await repo.stats()).reviewedToday).toBe(4)
  })

  it('exports and imports', async () => {
    await repo.addWord({ hanzi: '一', pinyin: 'yi1', meaning: 'one' })
    const dump = await repo.exportAll()
    const other = new Repo(new HanziDB(`test-${n++}`))
    await other.importAll(dump)
    expect((await other.stats()).words).toBe(1)
  })
})
