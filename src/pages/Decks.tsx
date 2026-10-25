import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AudioButton } from '../components/AudioButton'
import { PinyinText } from '../components/PinyinText'
import { wordKey } from '../core/hanzi'
import type { Entry } from '../core/types'
import { db } from '../data/db'
import { loadHskDictionary } from '../data/dictionary-store'
import { useSettings } from '../data/hooks'
import { entryToInput, repo } from '../data/repo'
import type { Dictionary } from '../core/dictionary'

function useHsk() {
  const [dict, setDict] = useState<Dictionary | null>(null)
  useEffect(() => {
    loadHskDictionary().then(setDict)
  }, [])
  return dict
}

function useCollectionKeys() {
  return useLiveQuery(async () => {
    await db.words.count()
    return repo.collectionKeys()
  }, []) ?? new Set<string>()
}

const OLD = [1, 2, 3, 4, 5, 6]
const NEW = [1, 2, 3, 4, 5, 6, 7]

export function DecksPage() {
  const dict = useHsk()
  const have = useCollectionKeys()
  const section = (version: 'old' | 'new', levels: number[], title: string, note: string) => (
    <section>
      <h2>{title}</h2>
      <p className="muted">{note}</p>
      <div className="deck-grid">
        {levels.map((l) => {
          const list = dict?.hskList(version, l) ?? []
          const added = list.filter((e) => have.has(wordKey(e.hanzi, e.pinyin))).length
          return (
            <Link key={l} to={`/decks/${version}/${l}`} className="deck">
              <b>HSK {l === 7 ? '7–9' : l}</b>
              <span>{dict ? `${added} / ${list.length} words` : '…'}</span>
              <div className="bar"><div style={{ width: `${list.length ? (100 * added) / list.length : 0}%` }} /></div>
            </Link>
          )
        })}
      </div>
    </section>
  )
  return (
    <div className="page">
      <h1>HSK word lists</h1>
      {section('old', OLD, 'HSK 2.0 (classic, levels 1–6)', 'The long-standing 6-level exam — about 5,000 words.')}
      {section('new', NEW, 'HSK 3.0 (2021 standard, levels 1–7/9)', 'The newer 9-level standard — about 11,000 words.')}
    </div>
  )
}

export function DeckPage() {
  const { version, level } = useParams()
  const v = version === 'new' ? 'new' : 'old'
  const lvl = Number(level)
  const dict = useHsk()
  const have = useCollectionKeys()
  const [settings] = useSettings()
  const [limit, setLimit] = useState(100)
  const [busy, setBusy] = useState(false)
  const list = useMemo<Entry[]>(() => dict?.hskList(v, lvl) ?? [], [dict, v, lvl])
  const missing = list.filter((e) => !have.has(wordKey(e.hanzi, e.pinyin)))

  const addMany = async (entries: Entry[]) => {
    setBusy(true)
    await repo.addWords(entries.map(entryToInput))
    setBusy(false)
  }
  const title = `HSK ${v === 'old' ? '2.0' : '3.0'} · level ${lvl === 7 ? '7–9' : lvl}`
  return (
    <div className="page">
      <Link to="/decks" className="back">← all lists</Link>
      <h1>{title}</h1>
      <p className="muted">
        {list.length - missing.length} of {list.length} words in your collection. New words are introduced {settings.newWordsPerDay} per day (change in Settings).
      </p>
      <div className="row wrap">
        <button className="btn primary" disabled={busy || !missing.length} onClick={() => addMany(missing.slice(0, 10))}>Add next 10</button>
        <button className="btn" disabled={busy || !missing.length} onClick={() => addMany(missing.slice(0, 50))}>Add next 50</button>
        <button className="btn" disabled={busy || !missing.length} onClick={() => confirm(`Add all ${missing.length} words?`) && addMany(missing)}>Add all ({missing.length})</button>
      </div>
      <ul className="entries">
        {list.slice(0, limit).map((e) => (
          <EntryRow key={wordKey(e.hanzi, e.pinyin)} e={e} added={have.has(wordKey(e.hanzi, e.pinyin))} colors={settings.toneColors} />
        ))}
      </ul>
      {limit < list.length && <button className="btn" onClick={() => setLimit(limit + 200)}>Show more</button>}
    </div>
  )
}

export function EntryRow({ e, added, colors }: { e: Entry; added: boolean; colors: boolean }) {
  return (
    <li className="entry">
      <div className="hanzi-cell">{e.hanzi}</div>
      <div className="grow">
        <PinyinText pinyin={e.pinyin} colors={colors} />
        <div className="meaning small">{e.meaning}</div>
        {(e.oldLevel > 0 || e.newLevel > 0) && (
          <div className="tags">
            {e.oldLevel > 0 && <span className="tag">HSK2 L{e.oldLevel}</span>}
            {e.newLevel > 0 && <span className="tag">HSK3 L{e.newLevel === 7 ? '7–9' : e.newLevel}</span>}
          </div>
        )}
      </div>
      <AudioButton text={e.hanzi} />
      <button className="btn" disabled={added} onClick={() => repo.addWord(entryToInput(e))}>{added ? 'Added ✓' : 'Add'}</button>
    </li>
  )
}
