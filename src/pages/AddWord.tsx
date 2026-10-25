import { pinyin as proPinyin } from 'pinyin-pro'
import { useEffect, useMemo, useState } from 'react'
import { PinyinText } from '../components/PinyinText'
import { hanChars, wordKey } from '../core/hanzi'
import { isValidSyllable, parsePinyin, toNumeric } from '../core/pinyin'
import type { Entry } from '../core/types'
import { useDictionary } from '../data/dictionary-store'
import { useCollection, useSettings } from '../data/hooks'
import { entryToInput, repo } from '../data/repo'
import { EntryRow } from './Decks'

/** pinyin suggestion for hanzi typed by the user (context-aware for polyphonic characters) */
function autoPinyin(hanzi: string): string {
  return toNumeric(proPinyin(hanzi, { type: 'string', toneType: 'symbol', nonZh: 'removed' }))
}

export function AddWordPage() {
  const { dict, isFull, error } = useDictionary(true)
  const [settings] = useSettings()
  const [q, setQ] = useState('')
  const have = useCollection()
  const results = useMemo<Entry[]>(() => (dict && q.trim() ? dict.search(q, 40) : []), [dict, q])

  return (
    <div className="page">
      <h1>Add words</h1>
      <p className="muted">Search by hanzi (简体 or 繁體), pinyin (<code>nihao</code>, <code>ni3hao3</code>, <code>nǐ hǎo</code>) or English.</p>
      <input
        className="search"
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="你好 · ni hao · hello"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!isFull && <div className="muted">Loading the full dictionary (124k entries)… HSK words are searchable already.</div>}
      {error && <div className="error">{error}</div>}
      <ul className="entries">
        {results.map((e) => (
          <EntryRow key={wordKey(e.hanzi, e.pinyin) + e.meaning} e={e} word={have.get(wordKey(e.hanzi, e.pinyin))} colors={settings.toneColors} />
        ))}
      </ul>
      {q.trim() && isFull && results.length === 0 && <div className="muted">No dictionary match. Use the custom form below.</div>}
      <CustomWordForm prefill={q} />
      <BulkAdd />
    </div>
  )
}

function CustomWordForm({ prefill }: { prefill: string }) {
  const [hanzi, setHanzi] = useState('')
  const [py, setPy] = useState('')
  const [pyTouched, setPyTouched] = useState(false)
  const [meaning, setMeaning] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (/\p{Script=Han}/u.test(prefill) && !hanzi) setHanzi(prefill.trim())
  }, [prefill, hanzi])
  useEffect(() => {
    if (!pyTouched && hanzi) setPy(autoPinyin(hanzi))
  }, [hanzi, pyTouched])

  const syl = parsePinyin(py, true)
  const pinyinOk = syl.length > 0 && syl.every((s) => isValidSyllable(s.base))
  const countOk = syl.length === hanChars(hanzi).length
  const valid = hanzi.trim() && pinyinOk && meaning.trim()

  const submit = async () => {
    const { created } = await repo.addWord({ hanzi: hanzi.trim(), pinyin: toNumeric(py), meaning: meaning.trim(), source: 'custom' })
    setMsg(created ? `Added ${hanzi}` : 'Already in your collection')
    if (created) {
      setHanzi('')
      setPy('')
      setMeaning('')
      setPyTouched(false)
    }
  }
  return (
    <section className="panel">
      <h2>Custom word</h2>
      <p className="muted">Type the hanzi and the pinyin is filled in for you (edit it if a character has another reading). Or type pinyin first, then the hanzi.</p>
      <div className="form">
        <label>Hanzi<input value={hanzi} onChange={(e) => setHanzi(e.target.value)} placeholder="你好" /></label>
        <label>
          Pinyin
          <input
            value={py}
            autoCapitalize="off"
            onChange={(e) => {
              setPy(e.target.value)
              setPyTouched(true)
            }}
            placeholder="ni3 hao3 or nǐ hǎo"
          />
        </label>
        {py && <div className="preview">{pinyinOk ? <PinyinText pinyin={toNumeric(py)} /> : <span className="error">Not valid pinyin</span>}{pinyinOk && hanzi && !countOk && <span className="muted"> · {syl.length} syllables for {hanChars(hanzi).length} characters</span>}</div>}
        <label>Meaning<input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="hello" /></label>
        <button className="btn primary" disabled={!valid} onClick={submit}>Add to collection</button>
        {msg && <div className="muted">{msg}</div>}
      </div>
    </section>
  )
}

function BulkAdd() {
  const { dict } = useDictionary(true)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const run = async () => {
    if (!dict) return
    const inputs = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const hit = dict.search(line, 1)[0]
        if (hit && (hit.hanzi === line || hit.traditional === line)) return entryToInput(hit)
        return { hanzi: line, pinyin: autoPinyin(line), meaning: hit?.meaning ?? '(no meaning — edit later)', source: 'custom' as const }
      })
    const { created: n } = await repo.addWords(inputs)
    setMsg(`Added ${n} new word${n === 1 ? '' : 's'} (${inputs.length - n} already existed).`)
    setText('')
  }
  return (
    <section className="panel">
      <h2>Bulk add</h2>
      <p className="muted">One word per line, in hanzi. Meanings and pinyin come from the dictionary.</p>
      <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'学习\n朋友\n咖啡'} />
      <button className="btn" disabled={!text.trim() || !dict} onClick={run}>Add all</button>
      {msg && <div className="muted">{msg}</div>}
    </section>
  )
}
