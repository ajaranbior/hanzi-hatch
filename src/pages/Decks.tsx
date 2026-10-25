import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AudioButton } from '../components/AudioButton'
import { PinyinText } from '../components/PinyinText'
import type { Dictionary } from '../core/dictionary'
import { wordKey } from '../core/hanzi'
import type { Entry, Word } from '../core/types'
import { loadHskDictionary } from '../data/dictionary-store'
import { useCollection, useSettings } from '../data/hooks'
import { entryToInput, repo } from '../data/repo'

function useHsk() {
  const [dict, setDict] = useState<Dictionary | null>(null)
  useEffect(() => {
    loadHskDictionary().then(setDict)
  }, [])
  return dict
}

const OLD = [1, 2, 3, 4, 5, 6]
const NEW = [1, 2, 3, 4, 5, 6, 7]
const STUDY_BATCH = 10

export function DecksPage() {
  const dict = useHsk()
  const have = useCollection()
  const section = (version: 'old' | 'new', levels: number[], title: string, note: string) => (
    <section>
      <h2>{title}</h2>
      <p className="muted">{note}</p>
      <div className="deck-grid">
        {levels.map((l) => {
          const list = dict?.hskList(version, l) ?? []
          const done = list.filter((e) => have.get(wordKey(e.hanzi, e.pinyin))?.known).length
          const added = list.filter((e) => have.has(wordKey(e.hanzi, e.pinyin))).length
          return (
            <Link key={l} to={`/decks/${version}/${l}`} className="deck">
              <b>HSK {l === 7 ? '7–9' : l}</b>
              <span>{dict ? `${added} / ${list.length} added${done ? ` · ${done} known` : ''}` : '…'}</span>
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
  const have = useCollection()
  const [settings] = useSettings()
  const navigate = useNavigate()
  const [limit, setLimit] = useState(100)
  const [busy, setBusy] = useState(false)
  const list = useMemo<Entry[]>(() => dict?.hskList(v, lvl) ?? [], [dict, v, lvl])
  const inCollection = (e: Entry) => have.get(wordKey(e.hanzi, e.pinyin))
  // words still to learn: not known, and not practised yet
  const toLearn = list.filter((e) => {
    const w = inCollection(e)
    return !w?.known && !w?.introducedAt
  })
  const notAdded = list.filter((e) => !inCollection(e))
  const knownCount = list.filter((e) => inCollection(e)?.known).length

  const studyNow = async () => {
    setBusy(true)
    const { words } = await repo.addWords(toLearn.slice(0, STUDY_BATCH).map(entryToInput))
    setBusy(false)
    navigate(`/study?ids=${words.map((w) => w.id).join(',')}`)
  }
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
        {list.length - notAdded.length} of {list.length} words added{knownCount ? `, ${knownCount} marked known` : ''}.
        Study now starts with the next {Math.min(STUDY_BATCH, toLearn.length)} words you haven't practised yet.
      </p>
      <div className="row wrap">
        <button className="btn primary big" disabled={busy || !toLearn.length} onClick={studyNow}>
          Study now ({Math.min(STUDY_BATCH, toLearn.length)} words)
        </button>
        <button className="btn" disabled={busy || !notAdded.length} onClick={() => addMany(notAdded.slice(0, 50))}>Add next 50 for later</button>
        <button className="btn" disabled={busy || !notAdded.length} onClick={() => confirm(`Add all ${notAdded.length} words to your collection?`) && addMany(notAdded)}>Add all ({notAdded.length})</button>
      </div>
      <ul className="entries">
        {list.slice(0, limit).map((e) => (
          <EntryRow key={wordKey(e.hanzi, e.pinyin)} e={e} word={inCollection(e)} colors={settings.toneColors} />
        ))}
      </ul>
      {limit < list.length && <button className="btn" onClick={() => setLimit(limit + 200)}>Show more</button>}
    </div>
  )
}

/** One dictionary / HSK entry with Add and "I know this" actions. */
export function EntryRow({ e, word, colors }: { e: Entry; word?: Word; colors: boolean }) {
  return (
    <li className="entry">
      <div className="hanzi-cell">{e.hanzi}</div>
      <div className="grow">
        <PinyinText pinyin={e.pinyin} colors={colors} />
        <div className="meaning small">{e.meaning}</div>
        <div className="tags">
          {e.oldLevel > 0 && <span className="tag">HSK2 L{e.oldLevel}</span>}
          {e.newLevel > 0 && <span className="tag">HSK3 L{e.newLevel === 7 ? '7–9' : e.newLevel}</span>}
          {word?.known && <span className="tag status-known">known</span>}
        </div>
      </div>
      <AudioButton text={e.hanzi} />
      <div className="actions">
        {!word && (
          <>
            <button className="btn small" onClick={() => repo.addWord(entryToInput(e))}>Add</button>
            <button className="btn small" title="Add as already known — it will not be practised" onClick={() => repo.addWord({ ...entryToInput(e), known: true })}>I know it</button>
          </>
        )}
        {word && !word.known && (
          <>
            <span className="muted small">Added ✓</span>
            <button className="btn small" title="Stop practising this word" onClick={() => repo.setKnown(word.id!, true)}>I know it</button>
          </>
        )}
        {word?.known && <button className="btn small" onClick={() => repo.setKnown(word.id!, false)}>Not yet</button>}
      </div>
    </li>
  )
}
