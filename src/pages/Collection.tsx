import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { AudioButton } from '../components/AudioButton'
import { PinyinText } from '../components/PinyinText'
import { searchKey } from '../core/pinyin'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { repo } from '../data/repo'

export function CollectionPage() {
  const [settings] = useSettings()
  const [filter, setFilter] = useState('')
  const data = useLiveQuery(async () => ({ words: await db.words.orderBy('addedAt').toArray(), items: await db.items.toArray() }), [])
  const rows = useMemo(() => {
    if (!data) return []
    const f = filter.trim().toLowerCase()
    const fk = searchKey(f)
    return data.words
      .filter((w) => !f || w.hanzi.includes(f) || w.meaning.toLowerCase().includes(f) || (fk && searchKey(w.pinyin).includes(fk)))
      .map((w) => {
        const mine = data.items.filter((i) => i.wordId === w.id)
        const status = !w.introducedAt ? 'new' : mine.length && mine.every((i) => i.state === 'review') ? 'learned' : 'learning'
        return { w, status }
      })
  }, [data, filter])
  if (!data) return null
  return (
    <div className="page">
      <h1>My words <span className="muted">({data.words.length})</span></h1>
      <input className="search" placeholder="Filter by hanzi, pinyin or meaning" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ul className="entries">
        {rows.map(({ w, status }) => (
          <li key={w.id} className="entry">
            <div className="hanzi-cell">{w.hanzi}</div>
            <div className="grow">
              <PinyinText pinyin={w.pinyin} colors={settings.toneColors} />
              <div className="meaning small">{w.meaning}</div>
              <div className="tags"><span className={`tag status-${status}`}>{status}</span></div>
            </div>
            <AudioButton text={w.hanzi} />
            <button className="btn link" title="Remove" onClick={() => confirm(`Remove ${w.hanzi}?`) && repo.removeWord(w.id!)}>✕</button>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">Nothing here yet.</p>}
    </div>
  )
}
